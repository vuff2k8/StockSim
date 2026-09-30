import React, { useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  Bookmark,
  Layers,
  Clock,
  Shield,
  Activity,
  Sliders,
} from 'lucide-react';
import { WorldState } from '../types/world';
import { Instrument } from '../types/market';
import { UiPreset } from '../types/ui';
import { TopMovers } from '../components/TopMovers';
import { MarketEventLog } from '../components/MarketEventLog';
import { MarketDepthWidget } from '../components/MarketDepthWidget';
import { RiskPanel } from '../components/RiskPanel';
import { OpenOrdersTable } from '../components/OpenOrdersTable';
import { PriceChart } from '../charts/PriceChart';
import { createDefaultUiSettings } from '../styles/presets';
import {
  formatCurrency,
  formatPercent,
  formatStockPrice,
  formatDateTime,
} from '../utils/formatters';

interface DashboardPageProps {
  worldState: WorldState;
  onSelectInstrument: (symbol: string) => void;
  onCancelOrder: (orderId: string) => void;
  onNavigateTab: (tab: 'home' | 'markets' | 'portfolio' | 'history' | 'settings') => void;
  onUpdatePreset: (preset: UiPreset) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  worldState,
  onSelectInstrument,
  onCancelOrder,
  onNavigateTab,
  onUpdatePreset,
}) => {
  const {
    portfolio,
    snapshot,
    marketConfig,
    instruments,
    marketIndex,
    events,
    watchlist,
    openOrders = [],
    uiSettings,
  } = worldState;

  const isTotalReturnPositive = portfolio.totalReturn >= 0;
  const isTodayPositive = portfolio.todayPnL >= 0;
  const instrumentList = useMemo(() => Object.values(instruments), [instruments]);
  const openPositions = useMemo(() => Object.values(portfolio.positions), [portfolio.positions]);

  // Featured stock for chart/depth widget (first in watchlist or first instrument)
  const featuredInstrument = useMemo(() => {
    const sym = watchlist[0] || instrumentList[0]?.symbol;
    return instruments[sym] || instrumentList[0];
  }, [watchlist, instruments, instrumentList]);

  // Map of enabled widgets from uiSettings
  const enabledWidgetMap = useMemo(() => {
    const map = new Set<string>();
    if (uiSettings?.widgets) {
      for (const w of uiSettings.widgets) {
        if (w.enabled) map.add(w.id);
      }
    } else {
      // Default fallback
      map.add('totalAssets');
      map.add('marketStatus');
      map.add('portfolio');
      map.add('watchlist');
      map.add('topGainers');
      map.add('topLosers');
      map.add('marketEvents');
    }
    return map;
  }, [uiSettings]);

  const presets: { id: UiPreset; label: string }[] = [
    { id: 'trader', label: 'Trader (Giao dịch)' },
    { id: 'investor', label: 'Investor (Đầu tư)' },
    { id: 'analyst', label: 'Analyst (Phân tích)' },
    { id: 'terminal', label: 'Terminal (Chuyên sâu)' },
    { id: 'story', label: 'Story (Diễn biến)' },
  ];

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* 1. UI Preset Quick Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs">
        <div className="flex items-center gap-1.5 text-neutral-400 font-semibold px-2">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Giao diện mẫu (Preset):</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onUpdatePreset(p.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                uiSettings.preset === p.id
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. World Snapshot Metadata Bar */}
      {enabledWidgetMap.has('marketStatus') && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2 text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-white">{snapshot.id}</span>
            <span>·</span>
            <span className="text-neutral-200">{marketConfig.name}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Seed: <span className="text-white">{snapshot.seed}</span></span>
            <span>·</span>
            <span>Đòn bẩy max: <span className="text-amber-400">{marketConfig.rules.maxLeverage}x</span></span>
            <span>·</span>
            <span>Short: <span className={marketConfig.rules.allowShort ? 'text-emerald-400' : 'text-neutral-500'}>{marketConfig.rules.allowShort ? 'Bật' : 'Tắt'}</span></span>
          </div>
        </div>
      )}

      {/* 3. TOTAL ASSETS & PORTFOLIO METRICS */}
      {enabledWidgetMap.has('totalAssets') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span className="uppercase font-semibold tracking-wider">TỔNG TÀI SẢN (EQUITY)</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-mono text-xl md:text-2xl font-bold text-white">
              {formatCurrency(portfolio.totalAssets, portfolio.currency)}
            </div>
            <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>Vốn ban đầu:</span>
              <span className="text-neutral-200">{formatCurrency(portfolio.startingCapital, portfolio.currency, { compact: true })}</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span className="uppercase font-semibold tracking-wider">TIỀN MẶT / KÝ QUỸ DÙNG</span>
              <PieChart className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="font-mono text-base md:text-lg font-bold text-neutral-200">
              {formatCurrency(portfolio.cash, portfolio.currency)}
            </div>
            <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>Đã ký quỹ:</span>
              <span className="text-amber-400 font-bold">{formatCurrency(portfolio.usedMargin, portfolio.currency, { compact: true })}</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span className="uppercase font-semibold tracking-wider">LÃI / LỖ PHIÊN NAY</span>
              {isTodayPositive ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
            </div>
            <div className={`font-mono text-xl md:text-2xl font-bold ${isTodayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTodayPositive ? '▲ +' : '▼ '}{formatCurrency(portfolio.todayPnL, portfolio.currency)}
            </div>
            <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>Tỷ suất phiên:</span>
              <span className={`font-bold ${isTodayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPercent(portfolio.todayPnLPercent)}
              </span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
              <span className="uppercase font-semibold tracking-wider">TỔNG LỢI NHUẬN (TOTAL P/L)</span>
              <span className="text-[10px] font-mono text-neutral-500">Toàn thời gian</span>
            </div>
            <div className={`font-mono text-xl md:text-2xl font-bold ${isTotalReturnPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTotalReturnPositive ? '▲ +' : '▼ '}{formatCurrency(portfolio.totalReturn, portfolio.currency)}
            </div>
            <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex justify-between text-[11px] text-neutral-400 font-mono">
              <span>Tỷ suất sinh lời:</span>
              <span className={`font-bold ${isTotalReturnPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPercent(portfolio.totalReturnPercent)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Technical Chart & Simulated Depth (if enabled) */}
      {enabledWidgetMap.has('marketChart') && featuredInstrument && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={enabledWidgetMap.has('marketDepth') ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold text-neutral-300">
                Biểu đồ tiêu điểm: <span className="font-mono text-emerald-400 font-bold">{featuredInstrument.symbol}</span> ({featuredInstrument.name})
              </div>
              <button
                onClick={() => onSelectInstrument(featuredInstrument.symbol)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
              >
                Mở chi tiết & Đặt lệnh →
              </button>
            </div>
            <PriceChart
              candles={featuredInstrument.history}
              currency={featuredInstrument.currency}
              symbol={featuredInstrument.symbol}
              currentPrice={featuredInstrument.currentPrice}
            />
          </div>

          {enabledWidgetMap.has('marketDepth') && (
            <div>
              <MarketDepthWidget instrument={featuredInstrument} />
            </div>
          )}
        </div>
      )}

      {/* 5. Open Orders Widget */}
      {enabledWidgetMap.has('openOrders') && openOrders.length > 0 && (
        <OpenOrdersTable
          orders={openOrders}
          onCancelOrder={onCancelOrder}
          onSelectInstrument={onSelectInstrument}
        />
      )}

      {/* 6. Risk & Margin Panel */}
      {enabledWidgetMap.has('riskPanel') && (
        <RiskPanel portfolio={portfolio} />
      )}

      {/* 7. Watchlist */}
      {enabledWidgetMap.has('watchlist') && watchlist.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800 mb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                DANH MỤC THEO DÕI (WATCHLIST)
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('markets')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              Xem tất cả thị trường →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {watchlist.map((sym) => {
              const inst = instruments[sym];
              if (!inst) return null;
              const isInstUp = inst.currentPrice >= inst.previousClose;
              const diffPct = inst.previousClose > 0 ? ((inst.currentPrice - inst.previousClose) / inst.previousClose) * 100 : 0;

              return (
                <div
                  key={sym}
                  onClick={() => onSelectInstrument(sym)}
                  className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-sm text-white">{sym}</span>
                    <span className="text-[10px] text-neutral-400">{inst.exchange}</span>
                  </div>
                  <div className="font-mono text-xs font-semibold text-neutral-200">
                    {formatStockPrice(inst.currentPrice, inst.currency)}
                  </div>
                  <div className={`font-mono text-[11px] font-bold mt-0.5 ${isInstUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isInstUp ? '▲ ' : '▼ '}{formatPercent(diffPct)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Portfolio Holdings Summary */}
      {enabledWidgetMap.has('portfolio') && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                VỊ THẾ ĐANG NẮM GIỮ ({openPositions.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('portfolio')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              Quản lý chi tiết danh mục →
            </button>
          </div>

          {openPositions.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-400 space-y-2">
              <p>Bạn chưa nắm giữ vị thế nào trong thế giới này.</p>
              <button
                onClick={() => onNavigateTab('markets')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Khám phá bảng giá & Mở lệnh
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {openPositions.map((pos) => {
                const isProfit = pos.unrealizedPnL >= 0;
                return (
                  <div
                    key={pos.symbol}
                    onClick={() => onSelectInstrument(pos.symbol)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white">{pos.symbol}</span>
                        <span className="text-xs text-neutral-400">{pos.name}</span>
                        {pos.side === 'SHORT' && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 text-[10px] font-mono font-bold">
                            SHORT
                          </span>
                        )}
                        {pos.leverage > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[10px] font-mono font-bold">
                            {pos.leverage}X
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        Khối lượng: <span className="text-neutral-200 font-semibold">{pos.quantity.toLocaleString()}</span> · Giá vào:{' '}
                        <span className="text-neutral-200">{formatStockPrice(pos.averagePrice, pos.currency)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 text-right">
                      <div>
                        <span className="text-[10px] text-neutral-500 block sm:hidden">Giá trị</span>
                        <span className="font-mono text-xs font-semibold text-neutral-200">
                          {formatCurrency(pos.marketValue, pos.currency)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-neutral-500 block sm:hidden">Lãi / Lỗ</span>
                        <div className={`font-mono text-xs font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '▲ +' : '▼ '}{formatCurrency(pos.unrealizedPnL, pos.currency)}
                          <span className="text-[11px] ml-1">({formatPercent(pos.unrealizedPnLPercent)})</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 9. Top Movers & Simulation Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(enabledWidgetMap.has('topGainers') || enabledWidgetMap.has('topLosers')) && (
          <div className="lg:col-span-2">
            <TopMovers instruments={instrumentList} onSelectInstrument={onSelectInstrument} />
          </div>
        )}

        {enabledWidgetMap.has('marketEvents') && (
          <div>
            <MarketEventLog events={events} />
          </div>
        )}
      </div>
    </div>
  );
};
