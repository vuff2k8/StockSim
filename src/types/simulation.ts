export type SimulationSpeed = 0 | 1 | 2 | 5 | 10 | 50 | 100;

export interface SimulationClockState {
  currentTimestamp: number; // Unix epoch ms
  displayDate: string; // YYYY-MM-DD
  displayTime: string; // HH:mm:ss
  speed: SimulationSpeed;
  isPaused: boolean;
  totalTicks: number;
}

export type EventSeverity = 'low' | 'medium' | 'high';

export interface SimulationEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: EventSeverity;
  affectedMarket?: string;
  affectedSector?: string;
  impact: number; // e.g. -0.05 to +0.05 return shift
  duration: number; // duration in ticks/minutes
  remainingDuration: number;
}

export interface MarketIndexState {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  history: { timestamp: string; value: number }[];
}
