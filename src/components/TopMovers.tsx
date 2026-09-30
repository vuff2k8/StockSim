import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Instrument } from '../types/market';
import { formatPercent, formatStockPrice } from '../utils/formatters';

interface TopMoversProps {
  instruments: Instrument[];
  onSelectInstrument: (symbol: string) => void;
}

export const TopMovers: React.FC<TopMoversProps> = ({ instruments, onSelectInstrument }) => {
  const sorted = [...instruments].map((inst) => {
    const change = inst.currentPrice - inst.previousClose;
    const changePct = inst.previousClose > 0 ? (change / inst.previousClose) * 100 : 0;
    return { ...inst, change, changePct };
  });

  const gainers = [...sorted].sort((a, b) => b.changePct - a.changePct).slice(0, 4);
  const losers = [...sorted].sort((a, b) => a.changePct - b.changePct).slice(0, 4);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Top Gainers */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Top Tăng Giá (Gainers)
          </h3>
        </div>

        <div className="space-y-2">
          {gainers.map((inst) => (
            <div
              key={inst.symbol}
              onClick={() => onSelectInstrument(inst.symbol)}
              className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/60 hover:bg-neutral-800/80 transition-colors cursor-pointer border border-neutral-800/50"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{inst.symbol}</span>
                  <span className="text-[10px] text-neutral-400 truncate hidden xs:inline max-w-[120px]">
                    {inst.name}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400">{inst.sector}</span>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-xs font-medium text-neutral-200">
                  {formatStockPrice(inst.currentPrice, inst.currency)}
                </div>
                <div className="font-mono text-xs font-bold text-emerald-400">
                  {formatPercent(inst.changePct)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 mb-3">
          <TrendingDown className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Top Giảm Giá (Losers)
          </h3>
        </div>

        <div className="space-y-2">
          {losers.map((inst) => (
            <div
              key={inst.symbol}
              onClick={() => onSelectInstrument(inst.symbol)}
              className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/60 hover:bg-neutral-800/80 transition-colors cursor-pointer border border-neutral-800/50"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-white">{inst.symbol}</span>
                  <span className="text-[10px] text-neutral-400 truncate hidden xs:inline max-w-[120px]">
                    {inst.name}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400">{inst.sector}</span>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-xs font-medium text-neutral-200">
                  {formatStockPrice(inst.currentPrice, inst.currency)}
                </div>
                <div className="font-mono text-xs font-bold text-rose-400">
                  {formatPercent(inst.changePct)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
