import { MarketSessionEngine } from '../src/game/session/MarketSessionEngine';
import { MarketSessionType } from '../src/types/session';
import { SUPPORTED_MARKETS } from '../src/data/markets';
import { OrderEngine } from '../src/game/orders/OrderEngine';
import { ConditionalOrderEngine } from '../src/game/orders/ConditionalOrderEngine';
import { Instrument } from '../src/types/market';
import { Order } from '../src/types/order';
import { Portfolio } from '../src/types/portfolio';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

async function runSessionTests() {
  console.log('=== RUNNING CHECKPOINT 2: MARKET SESSION ENGINE & CALENDAR TESTS ===\n');

  // Helper to construct UTC ms from Date.UTC
  // Wed Jan 15 2025
  const vnTime = (hour: number, minute: number, second: number = 0) => {
    // VN is UTC+7 -> UTC hour is VN hour - 7
    return Date.UTC(2025, 0, 15, hour - 7, minute, second);
  };

  const usTime = (hour: number, minute: number, second: number = 0) => {
    // US EST in Jan is UTC-5 -> UTC hour is US hour + 5
    return Date.UTC(2025, 0, 15, hour + 5, minute, second);
  };

  const jpTime = (hour: number, minute: number, second: number = 0) => {
    // Tokyo is UTC+9 -> UTC hour is JP hour - 9
    return Date.UTC(2025, 0, 15, hour - 9, minute, second);
  };

  const sgTime = (hour: number, minute: number, second: number = 0) => {
    // SG is UTC+8 -> UTC hour is SG hour - 8
    return Date.UTC(2025, 0, 15, hour - 8, minute, second);
  };

  const euTime = (hour: number, minute: number, second: number = 0) => {
    // Paris CET in Jan is UTC+1 -> UTC hour is Paris hour - 1
    return Date.UTC(2025, 0, 15, hour - 1, minute, second);
  };

  // --- TEST 1: Vietnam weekday before open ---
  console.log('--- TEST 1: Vietnam weekday before open ---');
  const vnBeforeOpen = MarketSessionEngine.getSessionState('vietnam', vnTime(8, 0));
  assert(vnBeforeOpen.session === MarketSessionType.CLOSED, '08:00 VN is CLOSED');
  assert(!vnBeforeOpen.isTradable, '08:00 VN is not tradable');
  assert(!vnBeforeOpen.isContinuousTrading, '08:00 VN is not continuous trading');

  // --- TEST 2: Vietnam ATO ---
  console.log('\n--- TEST 2: Vietnam ATO ---');
  const vnAto = MarketSessionEngine.getSessionState('vietnam', vnTime(9, 5));
  assert(vnAto.session === MarketSessionType.ATO, '09:05 VN is ATO');
  assert(vnAto.isTradable, '09:05 VN isTradable is true for auction match');
  assert(!vnAto.isContinuousTrading, '09:05 VN is not continuous trading');

  // --- TEST 3: Vietnam continuous session ---
  console.log('\n--- TEST 3: Vietnam continuous session ---');
  const vnOpen = MarketSessionEngine.getSessionState('vietnam', vnTime(10, 0));
  assert(vnOpen.session === MarketSessionType.OPEN, '10:00 VN is OPEN');
  assert(vnOpen.isTradable, '10:00 VN is tradable');
  assert(vnOpen.isContinuousTrading, '10:00 VN is continuous trading');

  // --- TEST 4: Vietnam lunch break ---
  console.log('\n--- TEST 4: Vietnam lunch break ---');
  const vnLunch = MarketSessionEngine.getSessionState('vietnam', vnTime(12, 0));
  assert(vnLunch.session === MarketSessionType.LUNCH_BREAK, '12:00 VN is LUNCH_BREAK');
  assert(!vnLunch.isTradable, '12:00 VN is not tradable');
  assert(!vnLunch.isContinuousTrading, '12:00 VN is not continuous trading');

  // --- TEST 5: Vietnam ATC ---
  console.log('\n--- TEST 5: Vietnam ATC ---');
  const vnAtc = MarketSessionEngine.getSessionState('vietnam', vnTime(14, 35));
  assert(vnAtc.session === MarketSessionType.ATC, '14:35 VN is ATC');
  assert(vnAtc.isTradable, '14:35 VN isTradable is true for closing auction match');
  assert(!vnAtc.isContinuousTrading, '14:35 VN is not continuous trading');

  // --- TEST 6: Vietnam after close ---
  console.log('\n--- TEST 6: Vietnam after close ---');
  const vnClosed = MarketSessionEngine.getSessionState('vietnam', vnTime(16, 0));
  assert(vnClosed.session === MarketSessionType.CLOSED, '16:00 VN is CLOSED');
  assert(!vnClosed.isTradable, '16:00 VN is not tradable');

  // --- TEST 7: Vietnam weekend ---
  console.log('\n--- TEST 7: Vietnam weekend ---');
  // Saturday Jan 18 2025 at 10:00 VN time
  const vnSat = Date.UTC(2025, 0, 18, 3, 0, 0);
  const vnWeekend = MarketSessionEngine.getSessionState('vietnam', vnSat);
  assert(vnWeekend.session === MarketSessionType.CLOSED, 'Saturday is CLOSED');
  assert(!vnWeekend.isTradable, 'Saturday is not tradable');
  assert(vnWeekend.displayNameVi.includes('Cuối tuần'), 'Weekend display name mentions Cuối tuần');

  // --- TEST 8: US before open ---
  console.log('\n--- TEST 8: US before open ---');
  const usPre = MarketSessionEngine.getSessionState('us', usTime(8, 30));
  assert(usPre.session === MarketSessionType.PRE_MARKET, '08:30 US is PRE_MARKET');
  assert(!usPre.isTradable, '08:30 US is not tradable for continuous execution');
  const usNight = MarketSessionEngine.getSessionState('us', usTime(2, 0));
  assert(usNight.session === MarketSessionType.CLOSED, '02:00 US is CLOSED');

  // --- TEST 9: US market open ---
  console.log('\n--- TEST 9: US market open ---');
  const usOpen = MarketSessionEngine.getSessionState('us', usTime(11, 0));
  assert(usOpen.session === MarketSessionType.OPEN, '11:00 US is OPEN');
  assert(usOpen.isTradable, '11:00 US is tradable');
  assert(usOpen.isContinuousTrading, '11:00 US is continuous trading');

  // --- TEST 10: US after close ---
  console.log('\n--- TEST 10: US after close ---');
  const usAfter = MarketSessionEngine.getSessionState('us', usTime(17, 0));
  assert(usAfter.session === MarketSessionType.AFTER_HOURS, '17:00 US is AFTER_HOURS');
  const usLateClosed = MarketSessionEngine.getSessionState('us', usTime(21, 0));
  assert(usLateClosed.session === MarketSessionType.CLOSED, '21:00 US is CLOSED');

  // --- TEST 11: US weekend ---
  console.log('\n--- TEST 11: US weekend ---');
  // Sunday Jan 19 2025
  const usSunday = Date.UTC(2025, 0, 19, 18, 0, 0);
  const usWk = MarketSessionEngine.getSessionState('us', usSunday);
  assert(usWk.session === MarketSessionType.CLOSED, 'Sunday US is CLOSED');
  assert(!usWk.isTradable, 'Sunday US is not tradable');

  // --- TEST 12: Japan session ---
  console.log('\n--- TEST 12: Japan session ---');
  const jpMorning = MarketSessionEngine.getSessionState('japan', jpTime(10, 0));
  assert(jpMorning.session === MarketSessionType.OPEN, '10:00 Tokyo is OPEN');
  const jpLunch = MarketSessionEngine.getSessionState('japan', jpTime(12, 0));
  assert(jpLunch.session === MarketSessionType.LUNCH_BREAK, '12:00 Tokyo is LUNCH_BREAK');
  assert(!jpLunch.isTradable, 'Tokyo lunch is not tradable');
  const jpAfternoon = MarketSessionEngine.getSessionState('japan', jpTime(14, 0));
  assert(jpAfternoon.session === MarketSessionType.OPEN, '14:00 Tokyo is OPEN afternoon');

  // --- TEST 13: Singapore session ---
  console.log('\n--- TEST 13: Singapore session ---');
  const sgMorning = MarketSessionEngine.getSessionState('singapore', sgTime(10, 30));
  assert(sgMorning.session === MarketSessionType.OPEN, '10:30 SG is OPEN');
  const sgLunch = MarketSessionEngine.getSessionState('singapore', sgTime(12, 30));
  assert(sgLunch.session === MarketSessionType.LUNCH_BREAK, '12:30 SG is LUNCH_BREAK');
  const sgAfternoon = MarketSessionEngine.getSessionState('singapore', sgTime(15, 0));
  assert(sgAfternoon.session === MarketSessionType.OPEN, '15:00 SG is OPEN');

  // --- TEST 14: Europe session ---
  console.log('\n--- TEST 14: Europe session ---');
  const euOpen = MarketSessionEngine.getSessionState('europe', euTime(11, 0));
  assert(euOpen.session === MarketSessionType.OPEN, '11:00 Europe is OPEN');
  const euClosed = MarketSessionEngine.getSessionState('europe', euTime(20, 0));
  assert(euClosed.session === MarketSessionType.CLOSED, '20:00 Europe is CLOSED');

  // --- TEST 15: Same simulation timestamp interpreted differently in different market timezones ---
  console.log('\n--- TEST 15: Multi-timezone interpretation of same epoch timestamp ---');
  const multiTimestamp = Date.UTC(2025, 0, 15, 2, 45, 0); // 02:45 UTC
  const sVN = MarketSessionEngine.getSessionState('vietnam', multiTimestamp);
  const sUS = MarketSessionEngine.getSessionState('us', multiTimestamp);
  const sJP = MarketSessionEngine.getSessionState('japan', multiTimestamp);
  const sSG = MarketSessionEngine.getSessionState('singapore', multiTimestamp);
  const sEU = MarketSessionEngine.getSessionState('europe', multiTimestamp);

  assert(sVN.session === MarketSessionType.OPEN, '02:45 UTC is 09:45 VN -> OPEN');
  assert(sUS.session === MarketSessionType.CLOSED, '02:45 UTC is 21:45 NY -> CLOSED');
  assert(sJP.session === MarketSessionType.LUNCH_BREAK, '02:45 UTC is 11:45 Tokyo -> LUNCH_BREAK');
  assert(sSG.session === MarketSessionType.OPEN, '02:45 UTC is 10:45 SG -> OPEN');
  assert(sEU.session === MarketSessionType.CLOSED, '02:45 UTC is 03:45 Paris -> CLOSED');

  // --- TEST 16: Device timezone must NOT affect simulated session result ---
  console.log('\n--- TEST 16: Independence from device timezone ---');
  // Formatter uses explicit IANA string; verify localTimeInfo fields are deterministic
  const localVN = MarketSessionEngine.getLocalTimeInfo(multiTimestamp, 'Asia/Ho_Chi_Minh');
  assert(localVN.hour === 9 && localVN.minute === 45, 'VN local hour is 9:45 regardless of host machine timezone');
  const localNY = MarketSessionEngine.getLocalTimeInfo(multiTimestamp, 'America/New_York');
  assert(localNY.hour === 21 && localNY.minute === 45, 'NY local hour is 21:45 regardless of host machine timezone');

  // --- TEST 17: Order submission during closed session ---
  console.log('\n--- TEST 17: Order submission during closed session ---');
  const dummyInst: Instrument = {
    symbol: 'FPT',
    name: 'FPT Corp',
    exchange: 'HOSE',
    market: 'vietnam',
    currency: 'VND',
    sector: 'Công nghệ',
    currentPrice: 100000,
    previousClose: 100000,
    openPrice: 100000,
    dayHigh: 100000,
    dayLow: 100000,
    volume: 500000,
    volatility: 0.02,
    history: [],
    assetType: 'Stock',
    style: 'Growth',
    beta: 1.0,
    momentum: 0.01,
    liquidity: 1.0,
    lotSize: 100,
    isRealDataOrigin: true,
  };

  const dummyPortfolio: Portfolio = {
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

  const feeConfig = { rate: 0.0015, minFee: 0 };
  const closedTimestamp = new Date(vnTime(8, 0)).toISOString();
  const marketOrderRes = OrderEngine.submitOrder(
    {
      instrument: dummyInst,
      side: 'BUY',
      orderType: 'MARKET',
      tier: 'BASIC',
      quantity: 100,
    },
    dummyPortfolio,
    feeConfig,
    SUPPORTED_MARKETS.vietnam,
    closedTimestamp
  );
  assert(!marketOrderRes.success, 'Market order rejected during closed session');
  assert(
    Boolean(marketOrderRes.errorMessage?.includes('đóng cửa') || marketOrderRes.errorMessage?.includes('liên tục')),
    'Appropriate error message returned'
  );

  // Limit order should be accepted for queueing
  const limitOrderRes = OrderEngine.submitOrder(
    {
      instrument: dummyInst,
      side: 'BUY',
      orderType: 'LIMIT',
      tier: 'BASIC',
      quantity: 100,
      limitPrice: 98000,
    },
    dummyPortfolio,
    feeConfig,
    SUPPORTED_MARKETS.vietnam,
    closedTimestamp
  );
  assert(limitOrderRes.success, 'Limit order accepted during closed session into queue');
  assert((limitOrderRes.newOpenOrders?.length || 0) > 0, 'New open order created in pending state');

  // --- TEST 18: Order submission during open session ---
  console.log('\n--- TEST 18: Order submission during open session ---');
  const openTimestamp = new Date(vnTime(10, 0)).toISOString();
  const openMarketRes = OrderEngine.submitOrder(
    {
      instrument: dummyInst,
      side: 'BUY',
      orderType: 'MARKET',
      tier: 'BASIC',
      quantity: 100,
    },
    dummyPortfolio,
    feeConfig,
    SUPPORTED_MARKETS.vietnam,
    openTimestamp
  );
  assert(openMarketRes.success, 'Market order fills during continuous open session');
  assert(!!openMarketRes.transaction, 'Transaction generated for market fill');

  // --- TEST 19: Pending conditional order during closed session ---
  console.log('\n--- TEST 19: Pending conditional order during non-tradable session ---');
  const pendingLimitOrder: Order = {
    id: 'ord-cond-test-1',
    symbol: 'FPT',
    instrumentName: 'FPT Corp',
    currency: 'VND',
    side: 'BUY',
    positionEffect: 'OPEN_LONG',
    orderType: 'LIMIT',
    tier: 'BASIC',
    quantity: 100,
    remainingQuantity: 100,
    filledQuantity: 0,
    limitPrice: 105000, // Price is above market (100000), normally would trigger buy fill
    marginRequired: 0,
    estimatedSlippage: 0,
    fee: 0,
    totalCost: 0,
    leverage: 1,
    createdAt: closedTimestamp,
    updatedAt: closedTimestamp,
    status: 'PENDING',
    timeInForce: 'GTC',
  };

  // Evaluate during LUNCH_BREAK (12:00 VN time)
  const lunchTimestamp = new Date(vnTime(12, 0)).toISOString();
  const lunchEval = ConditionalOrderEngine.evaluateOrders(
    [pendingLimitOrder],
    { FPT: dummyInst },
    dummyPortfolio,
    SUPPORTED_MARKETS.vietnam.rules,
    lunchTimestamp
  );
  assert(lunchEval.filledOrders.length === 0, 'No orders filled during lunch break');
  assert(lunchEval.updatedOpenOrders.length === 1, 'Order remains pending during lunch break');

  // Evaluate during OPEN (13:15 VN time)
  const afternoonOpenTimestamp = new Date(vnTime(13, 15)).toISOString();
  const openEval = ConditionalOrderEngine.evaluateOrders(
    [pendingLimitOrder],
    { FPT: dummyInst },
    dummyPortfolio,
    SUPPORTED_MARKETS.vietnam.rules,
    afternoonOpenTimestamp
  );
  assert(openEval.filledOrders.length === 1, 'Order filled once market resumes continuous trading');
  assert(openEval.transactions.length === 1, 'Transaction emitted on fill');

  // --- TEST 20: Session transition exactly at boundary ---
  console.log('\n--- TEST 20: Session transition exactly at boundary ---');
  // Check VN boundary at 08:59:59 (PRE_MARKET) vs 09:00:00 (ATO)
  const preAto = MarketSessionEngine.getSessionState('vietnam', vnTime(8, 59, 59));
  assert(preAto.session === MarketSessionType.PRE_MARKET, '08:59:59 is PRE_MARKET');
  const startAto = MarketSessionEngine.getSessionState('vietnam', vnTime(9, 0, 0));
  assert(startAto.session === MarketSessionType.ATO, '09:00:00 exactly is ATO');

  // Check 09:14:59 (ATO) vs 09:15:00 (OPEN)
  const endAto = MarketSessionEngine.getSessionState('vietnam', vnTime(9, 14, 59));
  assert(endAto.session === MarketSessionType.ATO, '09:14:59 is still ATO');
  const startOpen = MarketSessionEngine.getSessionState('vietnam', vnTime(9, 15, 0));
  assert(startOpen.session === MarketSessionType.OPEN, '09:15:00 exactly transitions to OPEN');

  // Check 11:29:59 (OPEN) vs 11:30:00 (LUNCH_BREAK)
  const endMorning = MarketSessionEngine.getSessionState('vietnam', vnTime(11, 29, 59));
  assert(endMorning.session === MarketSessionType.OPEN, '11:29:59 is OPEN');
  const startLunch = MarketSessionEngine.getSessionState('vietnam', vnTime(11, 30, 0));
  assert(startLunch.session === MarketSessionType.LUNCH_BREAK, '11:30:00 transitions to LUNCH_BREAK');

  // Check 12:59:59 (LUNCH_BREAK) vs 13:00:00 (OPEN)
  const endLunch = MarketSessionEngine.getSessionState('vietnam', vnTime(12, 59, 59));
  assert(endLunch.session === MarketSessionType.LUNCH_BREAK, '12:59:59 is LUNCH_BREAK');
  const startAfternoon = MarketSessionEngine.getSessionState('vietnam', vnTime(13, 0, 0));
  assert(startAfternoon.session === MarketSessionType.OPEN, '13:00:00 transitions to OPEN');

  // Check 14:29:59 (OPEN) vs 14:30:00 (ATC)
  const endAfternoon = MarketSessionEngine.getSessionState('vietnam', vnTime(14, 29, 59));
  assert(endAfternoon.session === MarketSessionType.OPEN, '14:29:59 is OPEN');
  const startAtc = MarketSessionEngine.getSessionState('vietnam', vnTime(14, 30, 0));
  assert(startAtc.session === MarketSessionType.ATC, '14:30:00 transitions to ATC');

  // Check 14:44:59 (ATC) vs 14:45:00 (AFTER_HOURS/PLO)
  const endAtc = MarketSessionEngine.getSessionState('vietnam', vnTime(14, 44, 59));
  assert(endAtc.session === MarketSessionType.ATC, '14:44:59 is ATC');
  const startPlo = MarketSessionEngine.getSessionState('vietnam', vnTime(14, 45, 0));
  assert(startPlo.session === MarketSessionType.AFTER_HOURS, '14:45:00 transitions to AFTER_HOURS');

  // Check 14:59:59 (AFTER_HOURS) vs 15:00:00 (CLOSED)
  const endPlo = MarketSessionEngine.getSessionState('vietnam', vnTime(14, 59, 59));
  assert(endPlo.session === MarketSessionType.AFTER_HOURS, '14:59:59 is AFTER_HOURS');
  const startClosed = MarketSessionEngine.getSessionState('vietnam', vnTime(15, 0, 0));
  assert(startClosed.session === MarketSessionType.CLOSED, '15:00:00 transitions to CLOSED');

  console.log('\n=== ALL 20 MARKET SESSION ENGINE TESTS PASSED ===');
}

runSessionTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
