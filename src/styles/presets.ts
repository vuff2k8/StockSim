import { UiPreset, UiSettings, WidgetConfig } from '../types/ui';

export const ALL_WIDGETS: { id: WidgetConfig['id']; label: string }[] = [
  { id: 'totalAssets', label: 'Tổng tài sản & Lợi nhuận' },
  { id: 'cash', label: 'Tiền mặt & Sức mua' },
  { id: 'portfolio', label: 'Vị thế danh mục (Positions)' },
  { id: 'marketStatus', label: 'Chỉ số thị trường & Phiên' },
  { id: 'watchlist', label: 'Danh mục theo dõi (Watchlist)' },
  { id: 'marketChart', label: 'Biểu đồ kỹ thuật (Chart)' },
  { id: 'marketDepth', label: 'Sổ lệnh giả lập (Market Depth / BBO)' },
  { id: 'orderPanel', label: 'Bảng đặt lệnh giao dịch' },
  { id: 'openOrders', label: 'Lệnh chờ khớp (Open Orders)' },
  { id: 'riskPanel', label: 'Quản trị rủi ro & Ký quỹ (Risk & Margin)' },
  { id: 'topGainers', label: 'Top Tăng mạnh nhất' },
  { id: 'topLosers', label: 'Top Giảm mạnh nhất' },
  { id: 'marketEvents', label: 'Nhật ký sự kiện mô phỏng (Events Log)' },
];

export function createDefaultUiSettings(preset: UiPreset = 'trader'): UiSettings {
  let activeIds: WidgetConfig['id'][] = [];

  switch (preset) {
    case 'investor':
      activeIds = ['totalAssets', 'cash', 'portfolio', 'watchlist', 'marketChart', 'topGainers', 'topLosers', 'marketEvents'];
      break;
    case 'trader':
      activeIds = ['totalAssets', 'marketChart', 'marketDepth', 'orderPanel', 'portfolio', 'openOrders', 'riskPanel', 'watchlist', 'topGainers', 'topLosers'];
      break;
    case 'analyst':
      activeIds = ['marketChart', 'marketDepth', 'riskPanel', 'topGainers', 'topLosers', 'marketEvents', 'watchlist', 'portfolio'];
      break;
    case 'story':
      activeIds = ['marketEvents', 'marketStatus', 'totalAssets', 'portfolio', 'watchlist', 'topGainers', 'topLosers'];
      break;
    case 'terminal':
    default:
      activeIds = ALL_WIDGETS.map((w) => w.id);
      break;
  }

  const widgets: WidgetConfig[] = ALL_WIDGETS.map((w, index) => ({
    id: w.id,
    label: w.label,
    enabled: activeIds.includes(w.id),
    order: index,
  }));

  return {
    theme: 'dark',
    density: preset === 'terminal' ? 'compact' : 'normal',
    preset,
    activeOrderTier: preset === 'investor' ? 'BASIC' : preset === 'trader' ? 'ADVANCED' : 'PRO',
    widgets,
    showPerformancePanel: false,
    enableKeyboardShortcuts: true,
    slippageMultiplier: 1.0,
  };
}
