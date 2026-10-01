import React from 'react';
import { Home, LineChart, PieChart, History, Settings, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { NavTab } from './BottomNav';
import { MarketIndexState } from '../types/simulation';
import { Portfolio } from '../types/portfolio';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  marketIndex: MarketIndexState;
  portfolio: Portfolio;
  openPositionsCount: number;
  openOrdersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  marketIndex,
  portfolio,
  openPositionsCount,
  openOrdersCount = 0,
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: 'Tổng quan', desc: 'Bảng điều khiển chính', icon: Home },
    { id: 'markets' as NavTab, label: 'Thị trường', desc: 'Bảng giá cổ phiếu & ETF', icon: LineChart },
    { id: 'portfolio' as NavTab, label: 'Danh mục', desc: 'Tài sản & Vị thế mở', icon: PieChart, badge: openPositionsCount },
    { id: 'history' as NavTab, label: 'Lịch sử', desc: 'Sổ lệnh giao dịch', icon: History, badge: openOrdersCount > 0 ? openOrdersCount : undefined },
    { id: 'settings' as NavTab, label: 'Cài đặt', desc: 'Sao lưu & Tùy biến giao diện', icon: Settings },
  ];

  const isIndexUp = marketIndex.change >= 0;

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-neutral-950 border-r border-neutral-800 min-h-0 h-auto p-4 justify-between">
      <div className="space-y-6">
        {/* Market Index Widget */}
        <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl">
          <div className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider mb-1">
            {marketIndex.name}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xl font-bold text-white">
              {marketIndex.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <div className={`flex items-center text-xs font-mono font-bold ${isIndexUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isIndexUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{formatPercent(marketIndex.changePercent)}</span>
            </div>
          </div>
          <div className="text-[10px] text-neutral-500 font-mono mt-1">
            Mô phỏng nội tại · Biến động: {marketIndex.change > 0 ? '+' : ''}{marketIndex.change} điểm
          </div>
        </div>

        {/* Navigation items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-neutral-800/90 text-white font-semibold border border-neutral-700/60 shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
                  <div className="text-left">
                    <div className="text-xs font-medium">{item.label}</div>
                  </div>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Mini Portfolio Snapshot */}
      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-neutral-400" />
            <span>Tiền mặt khả dụng</span>
          </span>
        </div>
        <div className="font-mono text-sm font-bold text-neutral-200">
          {formatCurrency(portfolio.cash, portfolio.currency)}
        </div>
        <div className="pt-2 border-t border-neutral-800/80 flex justify-between text-[11px] text-neutral-400">
          <span>Tổng giá trị tài sản:</span>
          <span className="font-mono font-medium text-emerald-400">
            {formatCurrency(portfolio.totalAssets, portfolio.currency, { compact: true })}
          </span>
        </div>
      </div>
    </aside>
  );
};
