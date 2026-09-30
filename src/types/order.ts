export type OrderSide = 'BUY' | 'SELL';

export type PositionEffect = 'OPEN_LONG' | 'CLOSE_LONG' | 'OPEN_SHORT' | 'CLOSE_SHORT';

export type OrderTier = 'BASIC' | 'ADVANCED' | 'PRO';

export type OrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'STOP_MARKET'
  | 'STOP_LIMIT'
  | 'TRAILING_STOP'
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'BRACKET'
  | 'OCO';

export type OrderStatus =
  | 'PENDING'
  | 'TRIGGERED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'LIQUIDATED';

export type TimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK';

export interface FeeConfig {
  rate: number; // broker fee rate (e.g. 0.0015 for 0.15%)
  minFee: number; // minimum absolute fee
  exchangeFeeRate?: number;
  borrowFeeDailyRate?: number;
  liquidationFeeRate?: number;
}

export interface Order {
  id: string;
  symbol: string;
  instrumentName: string;
  currency: string;
  side: OrderSide;
  positionEffect: PositionEffect;
  orderType: OrderType;
  tier: OrderTier;
  status: OrderStatus;
  timeInForce: TimeInForce;
  leverage: number; // 1x to 10x
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  price?: number; // target price for limit/order value calculation
  limitPrice?: number;
  stopPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  trailingPercent?: number; // e.g. 0.05 for 5%
  trailingDelta?: number; // fixed distance in currency
  watermarkPrice?: number; // highest for long, lowest for short
  marginRequired: number;
  estimatedSlippage: number;
  fee: number;
  totalCost: number;
  createdAt: string; // ISO
  updatedAt: string;
  triggeredAt?: string;
  filledAt?: string;
  parentOrderId?: string; // For bracket/OCO child orders
  linkedOcoOrderId?: string; // Linked counter order for OCO
  bracketChildType?: 'ENTRY' | 'TP' | 'SL';
  cancellationReason?: string;
}

export interface OrderPreview {
  symbol: string;
  side: OrderSide;
  positionEffect: PositionEffect;
  orderType: OrderType;
  tier: OrderTier;
  quantity: number;
  price: number;
  limitPrice?: number;
  stopPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  trailingPercent?: number;
  leverage: number;
  orderValue: number;
  fee: number;
  estimatedSlippage: number;
  marginRequired: number;
  totalCost: number;
  remainingCash: number;
  remainingMargin: number;
  maximumLoss?: number;
  potentialProfit?: number;
  estimatedLiquidationPrice?: number;
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
  requiresHighRiskConfirmation?: boolean;
}

export interface Transaction {
  id: string;
  orderId?: string;
  timestamp: string;
  side: OrderSide;
  positionEffect?: PositionEffect;
  symbol: string;
  instrumentName: string;
  quantity: number;
  price: number;
  fee: number;
  slippage?: number;
  total: number;
  currency: string;
  realizedPnL?: number;
  leverage?: number;
}
