import { Candle, Instrument, MarketStatus, Quote } from '../../types/market';

export interface MarketDataProvider {
  /**
   * Search for instruments by symbol or name
   */
  searchSymbols(query: string, market?: string): Promise<Instrument[]>;

  /**
   * Fetch latest quote for a symbol
   */
  getQuote(symbol: string): Promise<Quote>;

  /**
   * Fetch historical candles for an instrument
   */
  getHistoricalData(
    symbol: string,
    start: string,
    end: string
  ): Promise<Candle[]>;

  /**
   * Retrieve trading session and operating status for a market
   */
  getMarketStatus(market: string, currentSimTimestamp?: number): Promise<MarketStatus>;

  /**
   * Load instruments for initial world creation
   */
  loadUniverse(marketId: string, seed?: number): Promise<Instrument[]>;
}
