import React from 'react';
import { Home, LineChart, PieChart, History, Settings } from 'lucide-react';

export type NavTab = 'home' | 'markets' | 'portfolio' | 'history' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  openPositionsCount: number;
  openOrdersCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  openPositionsCount,
  openOrdersCount = 0,
}) => {
  const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Tổng quan', icon: Home },
    { id: 'markets', label: 'Thị trường', icon: LineChart },
    { id: 'portfolio', label: 'Danh mục', icon: PieChart },
    { id: 'history', label: 'Lịch sử', icon: History },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 border-t border-neutral-800/90 backdrop-blur-lg">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = currentTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTab(t.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] transition-colors relative cursor-pointer ${
                isActive ? 'text-emerald-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                {t.id === 'portfolio' && openPositionsCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-emerald-500 text-neutral-950 rounded-full text-[9px] font-mono font-bold flex items-center justify-center">
                    {openPositionsCount}
                  </span>
                )}
                {t.id === 'history' && openOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-amber-500 text-neutral-950 rounded-full text-[9px] font-mono font-bold flex items-center justify-center">
                    {openOrdersCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 truncate max-w-[64px]">
                {t.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-0.5 bg-emerald-400 rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
