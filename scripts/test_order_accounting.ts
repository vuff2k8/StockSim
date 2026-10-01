import { OrderEngine } from '../src/game/orders/OrderEngine';
import { WorldManager } from '../src/game/world/WorldManager';
import { MarginLiquidationEngine } from '../src/game/portfolio/MarginLiquidationEngine';
import { SimulationClock } from '../src/game/simulation/SimulationClock';
import { WorldBinaryCodec } from '../src/services/storage/BinaryCodec';
import { SUPPORTED_MARKETS } from '../src/data/markets';
import { Instrument } from '../src/types/market';
import { Portfolio } from '../src/types/portfolio';
import { Transaction } from '../src/types/order';

async function runCheckpoint1Tests() {
  console.log('=== RUNNING CHECKPOINT 1 CORE RECONCILIATION TESTS ===\n');
  let failures = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
    } else {
      console.error(`[FAIL] ${msg}`);
      failures++;
    }
  }

  // --- TEST 1: Bracket Order remainingQuantity > 0 ---
  console.log('--- TEST 1: Bracket Orders remainingQuantity fix ---');
  const dummyInst: Instrument = {
    symbol: 'FPT',
    name: 'FPT Corp',
    exchange: 'HOSE',
    market: 'vietnam',
    currency: 'VND',
    sector: 'Technology',
    currentPrice: 100000,
    previousClose: 100000,
    openPrice: 100000,
    dayHigh: 100000,
    dayLow: 100000,
    volume: 1000000,
    volatility: 0.02,
    history: [],
    assetType: 'Stock',
    style: 'Growth',
    beta: 1.0,
    momentum: 0,
    liquidity: 0.8,
    lotSize: 100,
    isRealDataOrigin: true,
  };

  const initialPortfolio: Portfolio = {
    cash: 50000000,
    startingCapital: 50000000,
    currency: 'VND',
    positions: {},
    totalInvested: 0,
    portfolioValue: 0,
    totalAssets: 50000000,
    unrealizedPnL: 0,
    unrealizedPnLPercent: 0,
    realizedPnL: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    dayStartAssets: 50000000,
    todayPnL: 0,
    todayPnLPercent: 0,
    equity: 50000000,
    usedMargin: 0,
    availableMargin: 50000000,
    maintenanceMargin: 0,
    marginRatio: 0,
    isMarginCall: false,
    riskMetrics: {} as any,
  };

  const orderRes = OrderEngine.submitOrder(
    {
      instrument: dummyInst,
      side: 'BUY',
      orderType: 'MARKET',
      tier: 'ADVANCED',
      quantity: 100,
      tpPrice: 110000,
      slPrice: 95000,
      leverage: 1,
    },
    initialPortfolio,
    { rate: 0.0015, minFee: 0 },
    SUPPORTED_MARKETS.vietnam,
    '2026-10-01T09:15:00.000Z'
  );

  assert(orderRes.success === true, 'Order submission succeeded');
  assert(orderRes.newOpenOrders !== undefined && orderRes.newOpenOrders.length === 2, 'Generated 2 child bracket orders (TP and SL)');
  if (orderRes.newOpenOrders) {
    const tpOrder = orderRes.newOpenOrders.find((o) => o.orderType === 'TAKE_PROFIT');
    const slOrder = orderRes.newOpenOrders.find((o) => o.orderType === 'STOP_LOSS');
    assert(tpOrder !== undefined && tpOrder.remainingQuantity === 100, 'TP order remainingQuantity === 100 (not 0)');
    assert(slOrder !== undefined && slOrder.remainingQuantity === 100, 'SL order remainingQuantity === 100 (not 0)');
  }

  // --- TEST 2: Partial Close of Long Position ---
  console.log('\n--- TEST 2: Partial Close of Long Position ---');
  const portfolioWithLong: Portfolio = {
    ...initialPortfolio,
    cash: 0,
    positions: {
      FPT: {
        symbol: 'FPT',
        name: 'FPT Corp',
        currency: 'VND',
        side: 'LONG',
        quantity: 500,
        averagePrice: 100000,
        currentPrice: 100000,
        marketValue: 50000000,
        totalCost: 50000000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        leverage: 1,
        marginUsed: 50000000,
      },
    },
  };

  const partialSellTx: Transaction = {
    id: 'tx-sell-1',
    symbol: 'FPT',
    instrumentName: 'FPT Corp',
    side: 'SELL',
    quantity: 100,
    price: 110000,
    fee: 10000,
    total: 10990000,
    currency: 'VND',
    timestamp: '2026-10-01T10:00:00.000Z',
  };

  const updatedAfterPartial = WorldManager.applyTransactionToPortfolio(portfolioWithLong, partialSellTx, dummyInst);
  const remainingPos = updatedAfterPartial.positions['FPT'];
  assert(remainingPos !== undefined, 'Position FPT still exists after selling 100 of 500 shares');
  assert(remainingPos?.quantity === 400, `Remaining quantity is 400 (got ${remainingPos?.quantity})`);
  assert(remainingPos?.averagePrice === 100000, 'Average price remains unchanged at 100,000 VND');
  assert(updatedAfterPartial.realizedPnL === 990000, `Realized P/L is 990,000 VND (got ${updatedAfterPartial.realizedPnL})`);
  assert(updatedAfterPartial.cash === 10990000, `Cash credited with margin + pnl = 10,990,000 VND (got ${updatedAfterPartial.cash})`);

  // --- TEST 3: Short Position Accounting & Total Assets ---
  console.log('\n--- TEST 3: Short Position Valuation in MarginLiquidationEngine ---');
  const portfolioWithShort: Portfolio = {
    ...initialPortfolio,
    cash: 50000000,
    positions: {
      FPT: {
        symbol: 'FPT',
        name: 'FPT Corp',
        currency: 'VND',
        side: 'SHORT',
        quantity: 100,
        averagePrice: 100000,
        currentPrice: 100000,
        marketValue: 10000000,
        totalCost: 10000000,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        leverage: 1,
        marginUsed: 10000000,
      },
    },
  };

  const metricsShort = MarginLiquidationEngine.calculatePortfolioMetrics(
    portfolioWithShort,
    { FPT: dummyInst },
    SUPPORTED_MARKETS.vietnam.rules
  );

  assert(metricsShort.portfolioValue === 0, `portfolioValue is 0 (short liabilities excluded; got ${metricsShort.portfolioValue})`);
  assert(metricsShort.totalAssets <= 50000000, `totalAssets does not falsely inflate above cash (got ${metricsShort.totalAssets})`);
  assert(metricsShort.equity === 50000000, `Equity is 50,000,000 VND (cash + unrealized; got ${metricsShort.equity})`);

  // --- TEST 4: Leveraged Long Liquidation Loan Settlement ---
  console.log('\n--- TEST 4: Leveraged Long Liquidation Loan Settlement ---');
  // 5x leveraged long: bought 100M with 20M margin (80M loan). Now price drops to 85M.
  const leveragedPortfolio: Portfolio = {
    ...initialPortfolio,
    cash: 10000000,
    positions: {
      FPT: {
        symbol: 'FPT',
        name: 'FPT Corp',
        currency: 'VND',
        side: 'LONG',
        quantity: 1000,
        averagePrice: 100000,
        currentPrice: 85000,
        marketValue: 85000000,
        totalCost: 100000000, // notional
        unrealizedPnL: -15000000,
        unrealizedPnLPercent: -15,
        realizedPnL: 0,
        leverage: 5,
        marginUsed: 20000000,
        liquidationPrice: 86000, // triggered
      },
    },
  };

  const droppedInst = { ...dummyInst, currentPrice: 85000 };
  const liqResult = MarginLiquidationEngine.checkAndExecuteLiquidations(
    leveragedPortfolio,
    { FPT: droppedInst },
    SUPPORTED_MARKETS.vietnam.rules,
    '2026-10-01T10:00:00.000Z'
  );

  assert(liqResult.liquidatedTransactions.length === 1, 'Liquidation transaction triggered');
  // Gross proceeds: 85M - 1% fee (850k) = 84.15M
  // Unpaid loan principal: 100M - 20M = 80M
  // Net cash received should be: 84.15M - 80M = 4.15M
  // New cash should be: 10M + 4.15M = 14.15M (NOT 10M + 84.15M = 94.15M!)
  const expectedNewCash = 10000000 + (84150000 - 80000000);
  assert(
    Math.abs(liqResult.updatedPortfolio.cash - expectedNewCash) < 100,
    `Cash settled loan correctly: expected ~${expectedNewCash}, got ${liqResult.updatedPortfolio.cash}`
  );
  assert(liqResult.updatedPortfolio.positions['FPT'] === undefined, 'Liquidated position removed');

  // --- TEST 5: Simulation Clock UTC consistency ---
  console.log('\n--- TEST 5: Simulation Clock Consistency ---');
  const clock = SimulationClock.createInitialState('2026-10-01T09:15:00.000Z');
  assert(clock.displayDate === '2026-10-01', `displayDate is '2026-10-01' (got ${clock.displayDate})`);
  assert(clock.displayTime === '09:15:00', `displayTime is '09:15:00' (got ${clock.displayTime})`);

  const ticked = SimulationClock.tick({ ...clock, isPaused: false, speed: 1 });
  assert(ticked.nextClock.displayTime === '09:18:00', `Tick advanced 3 minutes to '09:18:00' (got ${ticked.nextClock.displayTime})`);

  // --- TEST 6: BinaryCodec Canonical Config Lookup ---
  console.log('\n--- TEST 6: BinaryCodec Canonical Config Lookup ---');
  const testWorld = await WorldManager.createNewWorld({ marketId: 'us', customSeed: 99999 });
  const encoded = WorldBinaryCodec.encode(testWorld);
  const decoded = WorldBinaryCodec.decode(encoded);

  assert(decoded.marketConfig.id === 'us', 'Decoded marketConfig id is "us"');
  assert(decoded.marketConfig.rules.allowShort === true, 'US market allows short selling');
  assert(decoded.marketConfig.tradingHours.timezone === 'America/New_York', `Timezone is America/New_York (got ${decoded.marketConfig.tradingHours.timezone})`);
  assert(decoded.marketConfig.rules.maxLeverage === 5, 'US market max leverage is 5x');

  console.log(`\n=== CHECKPOINT 1 TESTS COMPLETED: ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURES`} ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

runCheckpoint1Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
