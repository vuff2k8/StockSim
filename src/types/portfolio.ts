export type PositionSide = 'LONG' | 'SHORT';

export interface Position {
  symbol: string;
  name: string;
  currency: string;
  side: PositionSide;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  totalCost: number; // For LONG: avgPrice * qty; For SHORT: margin reserved
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  leverage: number; // 1x to 10x
  marginUsed: number;
  liquidationPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  trailingPercent?: number;
  highestPriceSinceActive?: number;
  lowestPriceSinceActive?: number;
}

export interface RiskMetrics {
  totalExposure: number;
  longExposure: number;
  shortExposure: number;
  grossExposure: number;
  netExposure: number;
  accountLeverage: number;
  marginUsed: number;
  availableMargin: number;
  marginRatio: number; // e.g. 0.35 (35%)
  isMarginWarning: boolean;
  isLiquidationRisk: boolean;
  largestPositionSymbol?: string;
  largestPositionPercent: number;
  largestSector?: string;
  largestSectorExposure: number;
  concentrationPercent: number;
  potentialLossEstimate: number;
}

export interface Portfolio {
  cash: number;
  startingCapital: number;
  currency: string;
  positions: Record<string, Position>;
  totalInvested: number;
  portfolioValue: number; // Sum of market values of all holdings
  totalAssets: number; // Cash + portfolioValue (or equity)
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  totalReturn: number; // totalAssets - startingCapital
  totalReturnPercent: number;
  dayStartAssets: number;
  todayPnL: number;
  todayPnLPercent: number;

  // Margin and risk tracking
  equity: number;
  usedMargin: number;
  availableMargin: number;
  maintenanceMargin: number;
  marginRatio: number;
  isMarginCall: boolean;
  riskMetrics: RiskMetrics;
}
