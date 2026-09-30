import { Instrument, OrderBook, OrderBookEntry } from '../../types/market';

export class MarketDepthEngine {
  /**
   * Generates a realistic simulated order book around the current market price
   */
  public static generateOrderBook(instrument: Instrument, depthLevels: number = 5): OrderBook {
    const currentPrice = instrument.currentPrice;
    const tickSize = instrument.currency === 'VND' ? 50 : 0.01;
    // Spread varies with volatility & liquidity (typically 0.05% to 0.4%)
    const spreadPct = Math.max(0.0005, (1 - instrument.liquidity) * 0.003 + instrument.volatility * 0.05);
    const halfSpread = Math.max(tickSize, Math.round((currentPrice * spreadPct * 0.5) / tickSize) * tickSize);

    const bestBid = currentPrice - halfSpread;
    const bestAsk = currentPrice + halfSpread;
    const spread = Number((bestAsk - bestBid).toFixed(2));
    const midPrice = Number(((bestBid + bestAsk) / 2).toFixed(2));

    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    const baseLot = instrument.lotSize || 100;
    const baseVolumePerLevel = Math.max(baseLot * 5, Math.floor((instrument.volume * 0.002) / depthLevels));

    let bidCum = 0;
    let askCum = 0;

    for (let i = 0; i < depthLevels; i++) {
      // Bids step down
      const bidPrice = Math.max(tickSize, bestBid - i * tickSize * (i + 1));
      const bidQty = Math.floor(baseVolumePerLevel * (1 + Math.sin(i * 1.5) * 0.4 + Math.random() * 0.3));
      bidCum += bidQty;
      bids.push({
        price: Number(bidPrice.toFixed(instrument.currency === 'VND' ? 0 : 2)),
        quantity: bidQty,
        total: bidCum,
      });

      // Asks step up
      const askPrice = bestAsk + i * tickSize * (i + 1);
      const askQty = Math.floor(baseVolumePerLevel * (1 + Math.cos(i * 1.5) * 0.4 + Math.random() * 0.3));
      askCum += askQty;
      asks.push({
        price: Number(askPrice.toFixed(instrument.currency === 'VND' ? 0 : 2)),
        quantity: askQty,
        total: askCum,
      });
    }

    return {
      symbol: instrument.symbol,
      timestamp: new Date().toISOString(),
      bids,
      asks,
      spread,
      midPrice,
      estimatedLiquidity: Math.round((bidCum + askCum) * currentPrice),
    };
  }

  /**
   * Calculates realistic simulated execution slippage based on order size, volatility, and liquidity
   */
  public static calculateSlippage(
    instrument: Instrument,
    quantity: number,
    side: 'BUY' | 'SELL',
    multiplier: number = 1.0
  ): { slippagePercent: number; slippageAmount: number; effectivePrice: number } {
    const price = instrument.currentPrice;
    const orderValue = price * quantity;
    // Daily turnover proxy
    const avgDailyTurnover = Math.max(10_000_000, instrument.volume * price);
    const participationRate = Math.min(0.2, orderValue / avgDailyTurnover);

    // Slippage model = base spread cost + market impact exponent
    const baseSlippagePct = 0.0003 + (1 - instrument.liquidity) * 0.001;
    const impactPct = Math.pow(participationRate, 0.7) * (instrument.volatility * 2);
    const totalSlippagePct = Math.min(0.03, (baseSlippagePct + impactPct) * multiplier);

    const slippageAmount = price * totalSlippagePct;
    const effectivePrice = side === 'BUY' ? price + slippageAmount : price - slippageAmount;

    return {
      slippagePercent: totalSlippagePct,
      slippageAmount,
      effectivePrice: Number(effectivePrice.toFixed(instrument.currency === 'VND' ? 0 : 2)),
    };
  }
}
