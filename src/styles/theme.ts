import { ThemeId, UiDensity } from '../types/ui';

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  positive: string; // Green / Buy
  positiveBg: string;
  negative: string; // Red / Sell
  negativeBg: string;
  warning: string;
  cardBg: string;
  tableHover: string;
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  dark: {
    id: 'dark',
    name: 'Dark Slate (Mặc định)',
    background: '#090a0f',
    surface: '#11141d',
    surfaceElevated: '#171c28',
    border: '#1f2638',
    borderSubtle: '#161c2b',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    accent: '#10b981',
    accentHover: '#059669',
    positive: '#10b981',
    positiveBg: 'rgba(16, 185, 129, 0.12)',
    negative: '#f43f5e',
    negativeBg: 'rgba(244, 63, 94, 0.12)',
    warning: '#f59e0b',
    cardBg: '#11141d',
    tableHover: 'rgba(255, 255, 255, 0.03)',
  },
  oled: {
    id: 'oled',
    name: 'OLED Pure Black',
    background: '#000000',
    surface: '#080808',
    surfaceElevated: '#121212',
    border: '#222222',
    borderSubtle: '#141414',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#525252',
    accent: '#00ff88',
    accentHover: '#00cc6a',
    positive: '#00ff88',
    positiveBg: 'rgba(0, 255, 136, 0.15)',
    negative: '#ff3366',
    negativeBg: 'rgba(255, 51, 102, 0.15)',
    warning: '#ffaa00',
    cardBg: '#080808',
    tableHover: 'rgba(255, 255, 255, 0.05)',
  },
  terminal: {
    id: 'terminal',
    name: 'Retro Terminal (CRT Green)',
    background: '#040d06',
    surface: '#07170a',
    surfaceElevated: '#0b2410',
    border: '#133e1c',
    borderSubtle: '#0d2b13',
    textPrimary: '#4ade80',
    textSecondary: '#22c55e',
    textMuted: '#15803d',
    accent: '#4ade80',
    accentHover: '#22c55e',
    positive: '#4ade80',
    positiveBg: 'rgba(74, 222, 128, 0.15)',
    negative: '#f87171',
    negativeBg: 'rgba(248, 113, 113, 0.15)',
    warning: '#facc15',
    cardBg: '#07170a',
    tableHover: 'rgba(74, 222, 128, 0.06)',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Monochrome',
    background: '#0a0a0c',
    surface: '#121216',
    surfaceElevated: '#1a1a20',
    border: '#272730',
    borderSubtle: '#1e1e26',
    textPrimary: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    accent: '#38bdf8',
    accentHover: '#0284c7',
    positive: '#2dd4bf',
    positiveBg: 'rgba(45, 212, 191, 0.12)',
    negative: '#fb7185',
    negativeBg: 'rgba(251, 113, 133, 0.12)',
    warning: '#fbbf24',
    cardBg: '#121216',
    tableHover: 'rgba(255, 255, 255, 0.04)',
  },
  light: {
    id: 'light',
    name: 'Financial Light',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceElevated: '#f1f5f9',
    border: '#e2e8f0',
    borderSubtle: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    accent: '#059669',
    accentHover: '#047857',
    positive: '#16a34a',
    positiveBg: 'rgba(22, 163, 74, 0.1)',
    negative: '#dc2626',
    negativeBg: 'rgba(220, 38, 38, 0.1)',
    warning: '#d97706',
    cardBg: '#ffffff',
    tableHover: 'rgba(0, 0, 0, 0.02)',
  },
};

export interface DensityTokens {
  paddingCard: string;
  paddingTable: string;
  rowHeight: string;
  fontSizeBase: string;
  gap: string;
}

export const DENSITIES: Record<UiDensity, DensityTokens> = {
  compact: {
    paddingCard: 'p-2.5 md:p-3',
    paddingTable: 'py-1.5 px-2.5',
    rowHeight: 'h-8',
    fontSizeBase: 'text-[11px]',
    gap: 'gap-2',
  },
  normal: {
    paddingCard: 'p-3.5 md:p-4',
    paddingTable: 'py-2.5 px-3.5',
    rowHeight: 'h-10',
    fontSizeBase: 'text-xs md:text-sm',
    gap: 'gap-3',
  },
  comfortable: {
    paddingCard: 'p-5 md:p-6',
    paddingTable: 'py-3.5 px-4',
    rowHeight: 'h-12',
    fontSizeBase: 'text-sm md:text-base',
    gap: 'gap-4',
  },
};
