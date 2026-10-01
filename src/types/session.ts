/**
 * Standardized Market Session Types and State
 * Authoritative source of truth for market trading hours, phases, and calendar rules.
 */

export enum MarketSessionType {
  CLOSED = 'CLOSED',
  PRE_MARKET = 'PRE_MARKET',
  ATO = 'ATO',
  OPEN = 'OPEN',
  LUNCH_BREAK = 'LUNCH_BREAK',
  ATC = 'ATC',
  AFTER_HOURS = 'AFTER_HOURS',
}

export interface MarketLocalTimeInfo {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  minuteOfDay: number; // 0-1439
  weekday: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
  isWeekend: boolean;
  marketDate: string; // YYYY-MM-DD
  localTime: string;  // HH:mm:ss
}

export interface MarketSessionState {
  marketId: string;
  session: MarketSessionType;
  isTradable: boolean;           // Orders can execute right now
  isOrderEntryAllowed: boolean;  // Orders can be entered into the system
  isContinuousTrading: boolean;  // Standard continuous matching active
  marketDate: string;            // YYYY-MM-DD in market's local timezone
  localTime: string;             // HH:mm:ss in market's local timezone
  timezone: string;
  nextSessionTimestamp: number;  // Epoch ms for next phase transition
  previousSessionTimestamp: number; // Epoch ms when current phase began
  nextSessionType?: MarketSessionType;
  displayNameVi: string;         // Standard Vietnamese display label
  reason?: string;               // Optional explanation (e.g. 'Cuối tuần', 'Nghỉ lễ')
}

export interface SessionBoundaryRule {
  session: MarketSessionType;
  startMinute: number; // minute of day (0-1439)
  endMinute: number;   // minute of day (exclusive or inclusive depending on rule)
  displayNameVi: string;
  isTradable: boolean;
  isOrderEntryAllowed: boolean;
  isContinuousTrading: boolean;
}
