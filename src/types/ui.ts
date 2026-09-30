export type ThemeId = 'dark' | 'light' | 'oled' | 'terminal' | 'minimal';

export type UiDensity = 'compact' | 'normal' | 'comfortable';

export type UiPreset = 'investor' | 'trader' | 'analyst' | 'story' | 'terminal';

export type DashboardWidgetId =
  | 'totalAssets'
  | 'cash'
  | 'portfolio'
  | 'marketStatus'
  | 'watchlist'
  | 'marketChart'
  | 'topGainers'
  | 'topLosers'
  | 'marketEvents'
  | 'orderPanel'
  | 'openOrders'
  | 'riskPanel'
  | 'marketDepth';

export interface WidgetConfig {
  id: DashboardWidgetId;
  label: string;
  enabled: boolean;
  order: number;
}

export interface UiSettings {
  theme: ThemeId;
  density: UiDensity;
  preset: UiPreset;
  activeOrderTier: 'BASIC' | 'ADVANCED' | 'PRO';
  widgets: WidgetConfig[];
  showPerformancePanel: boolean;
  enableKeyboardShortcuts: boolean;
  slippageMultiplier: number; // 1 = normal, 0.5 = low, 2 = high
}

export interface PerformanceMetrics {
  fps: number;
  tps: number; // ticks per second
  renderedInstruments: number;
  activeOrdersCount: number;
  activePositionsCount: number;
  lastStepDurationMs: number;
  memoryEstimateMb?: number;
}
