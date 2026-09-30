import { Instrument, MarketTradingRules } from '../../types/market';
import { Portfolio, Position, RiskMetrics } from '../../types/portfolio';
import { SimulationEvent } from '../../types/simulation';
import { Transaction } from '../../types/order';

export interface LiquidationStepResult {
  updatedPortfolio: Portfolio;
  liquidatedTransactions: Transaction[];
  events: SimulationEvent[];
}

export class MarginLiquidationEngine {
  /**
   * Recalculates full equity, used margin, margin ratio, risk metrics, and checks for margin call / liquidation
   */
  public static calculatePortfolioMetrics(
    portfolio: Portfolio,
    instruments: Record<string, Instrument>,
    tradingRules: MarketTradingRules
  ): Portfolio {
    let totalInvested = 0;
    let portfolioValue = 0;
    let totalUnrealizedPnL = 0;
    let totalRealizedPnL = portfolio.realizedPnL;

    let longExposure = 0;
    let shortExposure = 0;
    let usedMargin = 0;

    const positions = { ...portfolio.positions };
    const sectorExposures: Record<string, number> = {};

    let largestPositionSymbol: string | undefined;
    let largestPositionVal = 0;

    for (const [symbol, pos] of Object.entries(positions)) {
      const inst = instruments[symbol];
      const currentPrice = inst ? inst.currentPrice : pos.currentPrice;

      // Track watermark for trailing stops
      const highestPriceSinceActive = Math.max(pos.highestPriceSinceActive ?? currentPrice, currentPrice);
      const lowestPriceSinceActive = Math.min(pos.lowestPriceSinceActive ?? currentPrice, currentPrice);

      let marketVal = 0;
      let unrealized = 0;
      let unrealizedPct = 0;
      let exposure = 0;
      let posMargin = pos.marginUsed;

      if (pos.side === 'LONG') {
        marketVal = pos.quantity * currentPrice;
        exposure = marketVal;
        longExposure += exposure;

        // Cost basis
        unrealized = marketVal - pos.totalCost;
        unrealizedPct = pos.totalCost > 0 ? (unrealized / pos.totalCost) * 100 : 0;
      } else {
        // SHORT position
        // When price drops -> profit. When price rises -> loss.
        marketVal = pos.quantity * currentPrice;
        exposure = marketVal;
        shortExposure += exposure;

        const notionalEntry = pos.quantity * pos.averagePrice;
        unrealized = notionalEntry - marketVal;
        unrealizedPct = pos.totalCost > 0 ? (unrealized / pos.totalCost) * 100 : 0;
      }

      // Liquidation price estimation
      // Long: LiqPrice = EntryPrice * (1 - (1/Leverage) + MaintenanceMarginRatio)
      // Short: LiqPrice = EntryPrice * (1 + (1/Leverage) - MaintenanceMarginRatio)
      const lev = Math.max(1, pos.leverage);
      const maintRatio = tradingRules.maintenanceMarginRatio;
      let liquidationPrice: number | undefined;

      if (lev > 1 || pos.side === 'SHORT') {
        if (pos.side === 'LONG') {
          liquidationPrice = Math.max(0, pos.averagePrice * (1 - 1 / lev + maintRatio));
        } else {
          liquidationPrice = pos.averagePrice * (1 + 1 / lev - maintRatio);
        }
      }

      positions[symbol] = {
        ...pos,
        currentPrice,
        marketValue: marketVal,
        unrealizedPnL: unrealized,
        unrealizedPnLPercent: unrealizedPct,
        highestPriceSinceActive,
        lowestPriceSinceActive,
        liquidationPrice: liquidationPrice ? Number(liquidationPrice.toFixed(inst?.currency === 'VND' ? 0 : 2)) : undefined,
      };

      totalInvested += pos.totalCost;
      portfolioValue += marketVal;
      totalUnrealizedPnL += unrealized;
      usedMargin += posMargin;

      if (exposure > largestPositionVal) {
        largestPositionVal = exposure;
        largestPositionSymbol = symbol;
      }

      const sector = inst?.sector || 'Khác';
      sectorExposures[sector] = (sectorExposures[sector] || 0) + exposure;
    }

    // Equity = Cash + total unrealized P/L
    // (For spot: Cash + MarketValue. With margin/short: Cash + UnrealizedPnL)
    const equity = Math.max(0, portfolio.cash + totalUnrealizedPnL);
    const availableMargin = Math.max(0, equity - usedMargin);
    const maintenanceMargin = usedMargin * tradingRules.maintenanceMarginRatio;

    const marginRatio = equity > 0 ? usedMargin / equity : 0;
    const isMarginWarning = marginRatio >= 0.8 && usedMargin > 0;
    const isLiquidationRisk = equity <= maintenanceMargin && usedMargin > 0;

    const grossExposure = longExposure + shortExposure;
    const netExposure = longExposure - shortExposure;
    const accountLeverage = equity > 0 ? Number((grossExposure / equity).toFixed(2)) : 0;

    // Largest sector
    let largestSector: string | undefined;
    let largestSectorExposure = 0;
    for (const [sec, exp] of Object.entries(sectorExposures)) {
      if (exp > largestSectorExposure) {
        largestSectorExposure = exp;
        largestSector = sec;
      }
    }

    const concentrationPercent = grossExposure > 0 ? (largestPositionVal / grossExposure) * 100 : 0;
    const potentialLossEstimate = usedMargin * 0.5;

    const riskMetrics: RiskMetrics = {
      totalExposure: grossExposure,
      longExposure,
      shortExposure,
      grossExposure,
      netExposure,
      accountLeverage,
      marginUsed: usedMargin,
      availableMargin,
      marginRatio,
      isMarginWarning,
      isLiquidationRisk,
      largestPositionSymbol,
      largestPositionPercent: concentrationPercent,
      largestSector,
      largestSectorExposure,
      concentrationPercent,
      potentialLossEstimate,
    };

    const totalAssets = portfolio.cash + portfolioValue;
    const totalReturn = totalAssets - portfolio.startingCapital;
    const totalReturnPercent = portfolio.startingCapital > 0 ? (totalReturn / portfolio.startingCapital) * 100 : 0;

    return {
      ...portfolio,
      positions,
      totalInvested,
      portfolioValue,
      totalAssets,
      unrealizedPnL: totalUnrealizedPnL,
      unrealizedPnLPercent: totalInvested > 0 ? (totalUnrealizedPnL / totalInvested) * 100 : 0,
      realizedPnL: totalRealizedPnL,
      totalReturn,
      totalReturnPercent,
      equity,
      usedMargin,
      availableMargin,
      maintenanceMargin,
      marginRatio,
      isMarginCall: isMarginWarning || isLiquidationRisk,
      riskMetrics,
    };
  }

  /**
   * Evaluates if any position breached liquidation threshold and automatically liquidates it
   */
  public static checkAndExecuteLiquidations(
    portfolio: Portfolio,
    instruments: Record<string, Instrument>,
    tradingRules: MarketTradingRules,
    timestamp: string
  ): LiquidationStepResult {
    let currentPortfolio = this.calculatePortfolioMetrics(portfolio, instruments, tradingRules);
    const liquidatedTransactions: Transaction[] = [];
    const events: SimulationEvent[] = [];

    // Check individual position liquidation prices or overall equity breach
    const positionsToLiquidate: string[] = [];

    for (const [sym, pos] of Object.entries(currentPortfolio.positions)) {
      const inst = instruments[sym];
      if (!inst) continue;

      if (pos.liquidationPrice !== undefined) {
        if (pos.side === 'LONG' && inst.currentPrice <= pos.liquidationPrice) {
          positionsToLiquidate.push(sym);
        } else if (pos.side === 'SHORT' && inst.currentPrice >= pos.liquidationPrice) {
          positionsToLiquidate.push(sym);
        }
      }
    }

    // Or if total equity breached maintenance margin
    if (
      positionsToLiquidate.length === 0 &&
      currentPortfolio.usedMargin > 0 &&
      currentPortfolio.equity <= currentPortfolio.maintenanceMargin
    ) {
      // Find position with highest loss
      let worstLossSym: string | null = null;
      let minPnL = Infinity;
      for (const [sym, pos] of Object.entries(currentPortfolio.positions)) {
        if (pos.unrealizedPnL < minPnL) {
          minPnL = pos.unrealizedPnL;
          worstLossSym = sym;
        }
      }
      if (worstLossSym) positionsToLiquidate.push(worstLossSym);
    }

    if (positionsToLiquidate.length === 0) {
      return { updatedPortfolio: currentPortfolio, liquidatedTransactions, events };
    }

    // Execute liquidations
    const newPositions = { ...currentPortfolio.positions };
    let newCash = currentPortfolio.cash;
    let realizedPnLDelta = 0;

    for (const sym of positionsToLiquidate) {
      const pos = newPositions[sym];
      const inst = instruments[sym];
      if (!pos || !inst) continue;

      const currentPrice = inst.currentPrice;
      const orderValue = pos.quantity * currentPrice;
      const liquidationFee = orderValue * tradingRules.liquidationFeeRate;

      // Close position
      if (pos.side === 'LONG') {
        const proceeds = orderValue - liquidationFee;
        newCash += proceeds;
        const lossOrGain = proceeds - pos.totalCost;
        realizedPnLDelta += lossOrGain;
      } else {
        // Short liquidation: buy back
        const notionalEntry = pos.quantity * pos.averagePrice;
        const pnl = notionalEntry - orderValue;
        // Return reserved margin plus pnl minus fee
        newCash += pos.marginUsed + pnl - liquidationFee;
        realizedPnLDelta += pnl - liquidationFee;
      }

      delete newPositions[sym];

      liquidatedTransactions.push({
        id: `tx-liq-${Date.now()}-${sym}`,
        timestamp,
        side: pos.side === 'LONG' ? 'SELL' : 'BUY',
        positionEffect: pos.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
        symbol: sym,
        instrumentName: pos.name,
        quantity: pos.quantity,
        price: currentPrice,
        fee: liquidationFee,
        total: orderValue,
        currency: pos.currency,
        realizedPnL: pos.unrealizedPnL - liquidationFee,
      });

      events.push({
        id: `ev-liq-${Date.now()}-${sym}`,
        timestamp,
        title: `CẢNH BÁO GIẢI CHẤP (LIQUIDATION): ${sym}`,
        description: `Vị thế ${pos.side} mã ${sym} đã bị kích hoạt cưỡng chế bán giải chấp tự động do vi phạm tỷ lệ duy trì ký quỹ an toàn. Phí phạt giải chấp: ${liquidationFee.toLocaleString()} ${pos.currency}.`,
        severity: 'high',
        impact: -0.01,
        duration: 8,
        remainingDuration: 8,
      });
    }

    currentPortfolio = {
      ...currentPortfolio,
      cash: newCash,
      realizedPnL: currentPortfolio.realizedPnL + realizedPnLDelta,
      positions: newPositions,
    };

    const finalPortfolio = this.calculatePortfolioMetrics(currentPortfolio, instruments, tradingRules);

    return {
      updatedPortfolio: finalPortfolio,
      liquidatedTransactions,
      events,
    };
  }
}
