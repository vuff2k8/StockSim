export type AssetType = 'Stock' | 'ETF' | 'Index';

export interface Candle {
  timestamp: string; // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp: string;
}

export interface MarketStatus {
  market: string;
  isOpen: boolean;
  currentSession: string; // e.g. "Continuous", "Closed", "Pre-market", "ATC"
  timezone: string;
  tradingHours: string;
  nextOpen?: string;
  nextClose?: string;
}

export type StockStyle = 'Growth' | 'Defensive' | 'Momentum' | 'High-Beta' | 'Value' | 'ETF-Index';

export interface Instrument {
  symbol: string;
  name: string;
  exchange: string;
  market: string; // 'vietnam' | 'us' | 'japan' | 'singapore' | 'europe'
  currency: string; // 'VND' | 'USD' | 'JPY' | 'SGD' | 'EUR'
  sector: string;
  currentPrice: number;
  previousClose: number;
  openPrice: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  volatility: number; // 0.01 to 0.08
  history: Candle[];
  assetType: AssetType;
  style: StockStyle;
  beta: number;
  momentum: number;
  liquidity: number; // Volume weight in order flow
  lotSize: number;
  isRealDataOrigin: boolean;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: string;
  bids: OrderBookEntry[]; // Buy orders descending
  asks: OrderBookEntry[]; // Sell orders ascending
  spread: number;
  midPrice: number;
  estimatedLiquidity: number;
}

export interface MarketTradingRules {
  allowShort: boolean;
  maxLeverage: number; // 1 = spot only, 2 = 2x, 5 = 5x, 10 = 10x
  lotSize: number;
  settlementPeriod: string; // e.g. "T+2", "T+1", "T+0"
  priceBandPercent: number | null; // e.g. 0.07 for ±7% on HOSE, null for US
  tradingFeeRate: number; // e.g. 0.0015 (0.15%)
  exchangeFeeRate: number; // e.g. 0.0003
  borrowFeeDailyRate: number; // e.g. 0.0003 for overnight margin/short
  maintenanceMarginRatio: number; // e.g. 0.25 (25%)
  liquidationFeeRate: number; // e.g. 0.01 (1%)
  allowedOrderTypes: string[]; // e.g. ['MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT', 'TRAILING_STOP', 'TAKE_PROFIT', 'STOP_LOSS', 'BRACKET', 'OCO']
  minPriceIncrement: number; // tick size (e.g. 10 or 50 VND, 0.01 USD)
}

export interface MarketConfig {
  id: string;
  name: string;
  country: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  defaultStartingCapital: number;
  capitalPresets: number[];
  lotSize: number;
  tradingHours: {
    openHour: number; // 0-23
    openMinute: number;
    closeHour: number;
    closeMinute: number;
    timezone: string;
  };
  defaultFeeRate: number; // e.g. 0.0015 (0.15%)
  indexSymbol: string;
  indexName: string;
  baseIndexValue: number;
  description: string;
  rules: MarketTradingRules;
}
