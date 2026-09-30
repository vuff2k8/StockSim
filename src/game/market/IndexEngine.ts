import { Instrument, MarketConfig } from '../../types/market';
import { MarketIndexState } from '../../types/simulation';

export class IndexEngine {
  /**
   * Initializes market index from market configuration
   */
  public static createInitialIndex(config: MarketConfig, initialTimestamp: string): MarketIndexState {
    return {
      symbol: config.indexSymbol,
      name: config.indexName,
      value: config.baseIndexValue,
      change: 0,
      changePercent: 0,
      history: [{ timestamp: initialTimestamp, value: config.baseIndexValue }],
    };
  }

  /**
   * Calculates new index value from the simulated instrument universe
   */
  public static calculateIndex(
    currentIndex: MarketIndexState,
    instruments: Record<string, Instrument>,
    baseIndexValue: number,
    timestamp: string
  ): MarketIndexState {
    const instList = Object.values(instruments);
    if (instList.length === 0) return currentIndex;

    // Weight by liquidity and volume
    let totalWeight = 0;
    let weightedChangeRatio = 0;

    for (const inst of instList) {
      const weight = Math.max(0.1, inst.liquidity * (inst.assetType === 'ETF' ? 1.5 : 1.0));
      const priceChangeRatio = inst.previousClose > 0 ? (inst.currentPrice - inst.previousClose) / inst.previousClose : 0;
      weightedChangeRatio += priceChangeRatio * weight;
      totalWeight += weight;
    }

    const marketAverageReturn = totalWeight > 0 ? weightedChangeRatio / totalWeight : 0;
    const newValue = Number((baseIndexValue * (1 + marketAverageReturn)).toFixed(2));
    const change = Number((newValue - baseIndexValue).toFixed(2));
    const changePercent = baseIndexValue > 0 ? Number(((change / baseIndexValue) * 100).toFixed(2)) : 0;

    const newHistory = [...currentIndex.history, { timestamp, value: newValue }];
    if (newHistory.length > 80) {
      newHistory.shift();
    }

    return {
      symbol: currentIndex.symbol,
      name: currentIndex.name,
      value: newValue,
      change,
      changePercent,
      history: newHistory,
    };
  }
}
