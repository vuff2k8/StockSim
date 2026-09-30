import { Instrument, MarketTradingRules } from '../../types/market';
import { Portfolio, Position } from '../../types/portfolio';
import { MarginLiquidationEngine } from './MarginLiquidationEngine';

export class PortfolioEngine {
  /**
   * Initializes a fresh portfolio with starting capital and currency
   */
  public static createInitialPortfolio(startingCapital: number, currency: string): Portfolio {
    return {
      cash: startingCapital,
      startingCapital,
      currency,
      positions: {},
      totalInvested: 0,
      portfolioValue: 0,
      totalAssets: startingCapital,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      realizedPnL: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      dayStartAssets: startingCapital,
      todayPnL: 0,
      todayPnLPercent: 0,

      // Initial margin metrics
      equity: startingCapital,
      usedMargin: 0,
      availableMargin: startingCapital,
      maintenanceMargin: 0,
      marginRatio: 0,
      isMarginCall: false,
      riskMetrics: {
        totalExposure: 0,
        longExposure: 0,
        shortExposure: 0,
        grossExposure: 0,
        netExposure: 0,
        accountLeverage: 0,
        marginUsed: 0,
        availableMargin: startingCapital,
        marginRatio: 0,
        isMarginWarning: false,
        isLiquidationRisk: false,
        largestPositionPercent: 0,
        largestSectorExposure: 0,
        concentrationPercent: 0,
        potentialLossEstimate: 0,
      },
    };
  }

  /**
   * Re-evaluates entire portfolio against newly simulated instrument prices using MarginLiquidationEngine
   */
  public static updatePortfolioWithPrices(
    portfolio: Portfolio,
    instruments: Record<string, Instrument>,
    tradingRules: MarketTradingRules,
    isNewDay: boolean = false
  ): Portfolio {
    const updated = MarginLiquidationEngine.calculatePortfolioMetrics(portfolio, instruments, tradingRules);

    const dayStartAssets = isNewDay ? updated.totalAssets : portfolio.dayStartAssets;
    const todayPnL = updated.totalAssets - dayStartAssets;
    const todayPnLPercent = dayStartAssets > 0 ? (todayPnL / dayStartAssets) * 100 : 0;

    return {
      ...updated,
      dayStartAssets,
      todayPnL,
      todayPnLPercent,
    };
  }
}
