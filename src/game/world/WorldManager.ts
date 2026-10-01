import { SUPPORTED_MARKETS } from '../../data/markets';
import { MarketDataProvider } from '../../services/market-data/MarketDataProvider';
import { defaultMarketDataProvider } from '../../services/market-data/RealMarketDataProvider';
import { Instrument } from '../../types/market';
import { InstrumentSnapshot, WorldSnapshot, WorldState } from '../../types/world';
import { SeededRandom } from '../../utils/seedRandom';
import { MarketEngine } from '../market/MarketEngine';
import { IndexEngine } from '../market/IndexEngine';
import { PortfolioEngine } from '../portfolio/PortfolioEngine';
import { SimulationClock } from '../simulation/SimulationClock';
import { ConditionalOrderEngine } from '../orders/ConditionalOrderEngine';
import { MarginLiquidationEngine } from '../portfolio/MarginLiquidationEngine';
import { createDefaultUiSettings } from '../../styles/presets';
import { SaveManager } from './SaveManager';
import { Order, Transaction } from '../../types/order';
import { SimulationEvent } from '../../types/simulation';

export interface CreateWorldOptions {
  marketId: string;
  startingCapital?: number;
  difficulty?: 'easy' | 'normal' | 'hard';
  universeType?: 'full' | 'bluechip' | 'etf_heavy';
  customSeed?: number;
  provider?: MarketDataProvider;
}

export class WorldManager {
  /**
   * Performs the initial world creation workflow
   */
  public static async createNewWorld(options: CreateWorldOptions): Promise<WorldState> {
    const marketConfig = SUPPORTED_MARKETS[options.marketId] || SUPPORTED_MARKETS.vietnam;
    const provider = options.provider || defaultMarketDataProvider;
    const seed = options.customSeed || Math.floor(Math.random() * 900000000 + 100000000);
    const difficulty = options.difficulty || 'normal';
    const startingCapital = options.startingCapital || marketConfig.defaultStartingCapital;

    // Step 1, 2, 3: Load instruments and fetch initial market data & historical data
    let rawInstruments = await provider.loadUniverse(marketConfig.id, seed);

    if (options.universeType === 'bluechip') {
      rawInstruments = rawInstruments.filter((i) => i.style === 'Defensive' || i.style === 'Growth');
    }

    if (!rawInstruments || rawInstruments.length === 0) {
      throw new Error('Không thể tải dữ liệu thị trường cho thế giới mới. Vui lòng thử lại.');
    }

    const normalizedInstruments: Record<string, Instrument> = {};
    const instrumentSnapshots: InstrumentSnapshot[] = [];
    const sourceTimestamp = new Date().toISOString();

    for (const inst of rawInstruments) {
      if (inst.currentPrice <= 0) {
        inst.currentPrice = 100;
      }
      if (inst.previousClose <= 0) {
        inst.previousClose = inst.currentPrice;
      }

      normalizedInstruments[inst.symbol] = inst;

      instrumentSnapshots.push({
        symbol: inst.symbol,
        name: inst.name,
        exchange: inst.exchange,
        market: inst.market,
        currency: inst.currency,
        sector: inst.sector,
        initialPrice: inst.currentPrice,
        initialVolume: inst.volume,
        volatility: inst.volatility,
        initialHistory: [...inst.history],
      });
    }

    const worldId = `WS-${marketConfig.id.toUpperCase()}-${seed.toString(36).toUpperCase()}`;
    const snapshot: WorldSnapshot = {
      id: worldId,
      createdAt: new Date().toISOString(),
      sourceTimestamp,
      market: marketConfig.id,
      currency: marketConfig.currency,
      seed,
      startingCapital,
      difficulty,
      instruments: instrumentSnapshots,
    };

    const clock = SimulationClock.createInitialState(sourceTimestamp);
    const portfolio = PortfolioEngine.createInitialPortfolio(startingCapital, marketConfig.currency);
    const marketIndex = IndexEngine.createInitialIndex(marketConfig, sourceTimestamp);
    const uiSettings = createDefaultUiSettings('trader');

    const worldState: WorldState = {
      snapshot,
      marketConfig,
      instruments: normalizedInstruments,
      marketIndex,
      portfolio,
      openOrders: [],
      orderHistory: [],
      transactions: [],
      clock,
      events: [],
      activeEvents: [],
      watchlist: Object.keys(normalizedInstruments).slice(0, 4),
      settings: {
        marketFeeRate: marketConfig.defaultFeeRate,
        autoSaveIntervalSeconds: 15,
      },
      uiSettings,
      version: 1,
    };

    SaveManager.saveGame(worldState);
    return worldState;
  }

  /**
   * Advances simulation by one tick, evaluates conditional orders, updates portfolio, and processes liquidations
   */
  public static stepSimulation(
    currentState: WorldState,
    marketEngine: MarketEngine,
    rng: SeededRandom
  ): WorldState {
    const { nextClock, isNewDay } = SimulationClock.tick(currentState.clock);
    if (nextClock === currentState.clock) {
      return currentState;
    }

    const tickTimestamp = nextClock.displayDate + 'T' + nextClock.displayTime + '.000Z';

    // 1. Advance market prices and index
    const marketResult = marketEngine.step(
      currentState.instruments,
      currentState.marketIndex,
      currentState.marketConfig,
      currentState.activeEvents,
      currentState.events,
      rng,
      tickTimestamp,
      isNewDay
    );

    let portfolio = currentState.portfolio;
    let openOrders = currentState.openOrders || [];
    let orderHistory = currentState.orderHistory || [];
    let transactions = currentState.transactions || [];
    let events = marketResult.events;

    // 2. Evaluate Conditional Orders (Limit, Stop, TP, SL, Trailing, Bracket, OCO)
    if (openOrders.length > 0) {
      const orderEval = ConditionalOrderEngine.evaluateOrders(
        openOrders,
        marketResult.instruments,
        portfolio,
        currentState.marketConfig.rules,
        tickTimestamp,
        isNewDay
      );

      openOrders = orderEval.updatedOpenOrders;
      if (orderEval.filledOrders.length > 0 || orderEval.cancelledOrders.length > 0) {
        orderHistory = [...orderEval.filledOrders, ...orderEval.cancelledOrders, ...orderHistory].slice(0, 100);
      }
      if (orderEval.transactions.length > 0) {
        transactions = [...orderEval.transactions, ...transactions];

        // Apply filled orders to portfolio positions using canonical helper
        for (const tx of orderEval.transactions) {
          const filledInst = marketResult.instruments[tx.symbol];
          if (!filledInst) continue;
          portfolio = WorldManager.applyTransactionToPortfolio(portfolio, tx, filledInst);
        }
      }

      if (orderEval.events.length > 0) {
        events = [...orderEval.events, ...events].slice(0, 50);
      }
    }

    // 3. Update Portfolio valuations & Check Margin Liquidations
    const liquidationResult = MarginLiquidationEngine.checkAndExecuteLiquidations(
      portfolio,
      marketResult.instruments,
      currentState.marketConfig.rules,
      tickTimestamp
    );

    portfolio = liquidationResult.updatedPortfolio;
    if (liquidationResult.liquidatedTransactions.length > 0) {
      transactions = [...liquidationResult.liquidatedTransactions, ...transactions];
    }
    if (liquidationResult.events.length > 0) {
      events = [...liquidationResult.events, ...events].slice(0, 50);
    }

    return {
      ...currentState,
      instruments: marketResult.instruments,
      marketIndex: marketResult.marketIndex,
      portfolio,
      openOrders,
      orderHistory,
      transactions,
      clock: nextClock,
      events,
      activeEvents: marketResult.activeEvents,
      version: currentState.version + 1,
    };
  }

  /**
   * Fast-forward manual advance
   */
  public static advanceTimeJump(
    currentState: WorldState,
    jump: '1h' | '1d' | '1w' | '1m',
    marketEngine: MarketEngine,
    rng: SeededRandom
  ): WorldState {
    let clockResult = SimulationClock.advance1Hour(currentState.clock);
    if (jump === '1d') clockResult = SimulationClock.advance1Day(currentState.clock);
    else if (jump === '1w') clockResult = SimulationClock.advance1Week(currentState.clock);
    else if (jump === '1m') clockResult = SimulationClock.advance1Month(currentState.clock);

    const { nextClock, isNewDay, ticksSimulated } = clockResult;
    const tickTimestamp = nextClock.displayDate + 'T' + nextClock.displayTime + '.000Z';

    let currentInstruments = currentState.instruments;
    let currentIndex = currentState.marketIndex;
    let currentActive = currentState.activeEvents;
    let currentEvents = currentState.events;
    let openOrders = currentState.openOrders || [];
    let orderHistory = currentState.orderHistory || [];
    let transactions = currentState.transactions || [];

    let currentPortfolio = currentState.portfolio;

    // Run batch simulation steps in memory
    const stepsToRun = Math.min(ticksSimulated, 25);
    for (let i = 0; i < stepsToRun; i++) {
      const stepRes = marketEngine.step(
        currentInstruments,
        currentIndex,
        currentState.marketConfig,
        currentActive,
        currentEvents,
        rng,
        tickTimestamp,
        i === stepsToRun - 1 ? isNewDay : false
      );
      currentInstruments = stepRes.instruments;
      currentIndex = stepRes.marketIndex;
      currentActive = stepRes.activeEvents;
      currentEvents = stepRes.events;

      // Evaluate orders if any
      if (openOrders.length > 0) {
        const orderEval = ConditionalOrderEngine.evaluateOrders(
          openOrders,
          currentInstruments,
          currentPortfolio,
          currentState.marketConfig.rules,
          tickTimestamp,
          i === stepsToRun - 1 ? isNewDay : false
        );
        openOrders = orderEval.updatedOpenOrders;
        if (orderEval.filledOrders.length > 0 || orderEval.cancelledOrders.length > 0) {
          orderHistory = [...orderEval.filledOrders, ...orderEval.cancelledOrders, ...orderHistory];
        }
        if (orderEval.transactions.length > 0) {
          transactions = [...orderEval.transactions, ...transactions];
          for (const tx of orderEval.transactions) {
            const inst = currentInstruments[tx.symbol];
            if (inst) {
              currentPortfolio = WorldManager.applyTransactionToPortfolio(currentPortfolio, tx, inst);
            }
          }
        }
        if (orderEval.events.length > 0) {
          currentEvents = [...orderEval.events, ...currentEvents];
        }
      }
    }

    const nextPortfolio = PortfolioEngine.updatePortfolioWithPrices(
      currentPortfolio,
      currentInstruments,
      currentState.marketConfig.rules,
      isNewDay
    );

    const updatedState: WorldState = {
      ...currentState,
      instruments: currentInstruments,
      marketIndex: currentIndex,
      portfolio: nextPortfolio,
      openOrders,
      orderHistory: orderHistory.slice(0, 100),
      transactions,
      clock: nextClock,
      events: currentEvents.slice(0, 50),
      activeEvents: currentActive,
      version: currentState.version + 1,
    };

    SaveManager.saveGame(updatedState);
    return updatedState;
  }

  /**
   * Canonical transaction settlement: applies a trade execution to portfolio positions and cash
   */
  public static applyTransactionToPortfolio(
    portfolio: import('../../types/portfolio').Portfolio,
    tx: Transaction,
    inst: Instrument
  ): import('../../types/portfolio').Portfolio {
    const newPositions = { ...portfolio.positions };
    const pos = newPositions[tx.symbol];
    const isBuy = tx.side === 'BUY';
    const val = tx.quantity * tx.price;
    let nextCash = portfolio.cash;
    let nextRealizedPnL = portfolio.realizedPnL;

    if (isBuy) {
      if (pos && pos.side === 'SHORT') {
        // Buy to cover short (partial or full)
        const coveredQty = Math.min(pos.quantity, tx.quantity);
        const coveredEntryCost = pos.averagePrice * coveredQty;
        const coveredExitCost = tx.price * coveredQty;
        const pnl = coveredEntryCost - coveredExitCost - tx.fee;
        const freedMargin = (pos.marginUsed * coveredQty) / pos.quantity;

        nextCash += freedMargin + pnl;
        nextRealizedPnL += pnl;

        if (pos.quantity <= tx.quantity) {
          delete newPositions[tx.symbol];
        } else {
          newPositions[tx.symbol] = {
            ...pos,
            quantity: pos.quantity - coveredQty,
            marginUsed: Math.max(0, pos.marginUsed - freedMargin),
            totalCost: Math.max(0, pos.totalCost - freedMargin),
            realizedPnL: pos.realizedPnL + pnl,
          };
        }
      } else if (pos && pos.side === 'LONG') {
        // Adding to existing long
        const marginRequired = val / (pos.leverage || 1);
        nextCash -= (marginRequired + tx.fee);
        const totalQty = pos.quantity + tx.quantity;
        const totalCost = pos.totalCost + val + tx.fee;
        newPositions[tx.symbol] = {
          ...pos,
          quantity: totalQty,
          averagePrice: (pos.averagePrice * pos.quantity + tx.price * tx.quantity) / totalQty,
          currentPrice: tx.price,
          totalCost,
          marginUsed: pos.marginUsed + marginRequired,
        };
      } else {
        // New Long
        const leverage = tx.leverage || 1;
        const marginRequired = val / leverage;
        nextCash -= (marginRequired + tx.fee);
        newPositions[tx.symbol] = {
          symbol: tx.symbol,
          name: tx.instrumentName,
          currency: tx.currency,
          side: 'LONG',
          quantity: tx.quantity,
          averagePrice: tx.price,
          currentPrice: tx.price,
          marketValue: val,
          totalCost: val + tx.fee,
          unrealizedPnL: -tx.fee,
          unrealizedPnLPercent: 0,
          realizedPnL: 0,
          leverage,
          marginUsed: marginRequired,
        };
      }
    } else {
      // SELL
      if (pos && pos.side === 'LONG') {
        // Sell long (partial or full)
        const soldQty = Math.min(pos.quantity, tx.quantity);
        const soldEntryCost = pos.averagePrice * soldQty;
        const proceeds = tx.price * soldQty - tx.fee;
        const pnl = proceeds - soldEntryCost;
        const freedMargin = (pos.marginUsed * soldQty) / pos.quantity;

        nextCash += freedMargin + pnl;
        nextRealizedPnL += pnl;

        if (pos.quantity <= tx.quantity) {
          delete newPositions[tx.symbol];
        } else {
          newPositions[tx.symbol] = {
            ...pos,
            quantity: pos.quantity - soldQty,
            totalCost: Math.max(0, pos.totalCost - soldEntryCost),
            marginUsed: Math.max(0, pos.marginUsed - freedMargin),
            realizedPnL: pos.realizedPnL + pnl,
          };
        }
      } else {
        // New Short
        const leverage = tx.leverage || 1;
        const marginRequired = val / leverage;
        nextCash -= (marginRequired + tx.fee);
        newPositions[tx.symbol] = {
          symbol: tx.symbol,
          name: tx.instrumentName,
          currency: tx.currency,
          side: 'SHORT',
          quantity: tx.quantity,
          averagePrice: tx.price,
          currentPrice: tx.price,
          marketValue: val,
          totalCost: marginRequired,
          unrealizedPnL: -tx.fee,
          unrealizedPnLPercent: 0,
          realizedPnL: 0,
          leverage,
          marginUsed: marginRequired,
        };
      }
    }

    return {
      ...portfolio,
      cash: nextCash,
      realizedPnL: nextRealizedPnL,
      positions: newPositions,
    };
  }
}
