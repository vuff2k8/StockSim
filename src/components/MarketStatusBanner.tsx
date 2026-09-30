import React from 'react';
import { formatDateTime } from '../utils/formatters';

interface MarketStatusBannerProps {
  sourceTimestamp: string;
  marketName: string;
  isPaused: boolean;
  speed: number;
}

export const MarketStatusBanner: React.FC<MarketStatusBannerProps> = ({
  sourceTimestamp,
  marketName,
  isPaused,
  speed,
}) => {
  return (
    <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-neutral-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-neutral-200">
            {marketName}
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            Khởi tạo từ dữ liệu thực tế vào: <span className="text-neutral-200 font-mono">{formatDateTime(sourceTimestamp)}</span>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400 italic">
            Mọi giá cả và biến động sau khởi tạo là giả lập mô phỏng.
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-amber-400/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            REAL MARKET DATA (GỐC)
          </span>
          <span className="text-neutral-700">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-neutral-500' : 'bg-emerald-400 animate-pulse'}`}></span>
            SIMULATION ({isPaused ? 'TẠM DỪNG' : `${speed}X`})
          </span>
        </div>
      </div>
    </div>
  );
};
