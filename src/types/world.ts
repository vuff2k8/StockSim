import { Candle, Instrument, MarketConfig } from './market';
import { Portfolio } from './portfolio';
import { Transaction, Order } from './order';
import { SimulationClockState, SimulationEvent, MarketIndexState } from './simulation';
import { UiSettings } from './ui';

export interface InstrumentSnapshot {
  symbol: string;
  name: string;
  exchange: string;
  market: string;
  currency: string;
  sector: string;
  initialPrice: number;
  initialVolume: number;
  volatility: number;
  initialHistory: Candle[];
}

export interface WorldSnapshot {
  id: string;
  createdAt: string; // ISO string when world was generated
  sourceTimestamp: string; // ISO string of initial real market data
  market: string;
  currency: string;
  seed: number;
  startingCapital: number;
  difficulty: 'easy' | 'normal' | 'hard';
  instruments: InstrumentSnapshot[];
}

export interface WorldSettings {
  marketFeeRate: number; // e.g. 0.0015
  autoSaveIntervalSeconds: number;
}

export interface WorldState {
  snapshot: WorldSnapshot;
  marketConfig: MarketConfig;
  instruments: Record<string, Instrument>;
  marketIndex: MarketIndexState;
  portfolio: Portfolio;
  openOrders: Order[]; // Active orders waiting to be filled or triggered
  orderHistory: Order[]; // Historical orders: filled, cancelled, rejected, liquidated
  transactions: Transaction[];
  clock: SimulationClockState;
  events: SimulationEvent[];
  activeEvents: SimulationEvent[];
  watchlist: string[];
  settings: WorldSettings;
  uiSettings: UiSettings;
  version: number;
}
