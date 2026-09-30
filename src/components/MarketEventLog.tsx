import React from 'react';
import { Radio, AlertTriangle, Info } from 'lucide-react';
import { SimulationEvent } from '../types/simulation';

interface MarketEventLogProps {
  events: SimulationEvent[];
}

export const MarketEventLog: React.FC<MarketEventLogProps> = ({ events }) => {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            MARKET EVENTS
          </h3>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-semibold border border-neutral-700/50">
          SIMULATION EVENT
        </span>
      </div>

      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-500">
            Chưa có sự kiện mô phỏng mới. Hãy bật tiếp tục hoặc tua thời gian để theo dõi phản ứng thị trường.
          </div>
        ) : (
          events.slice(0, 10).map((ev) => {
            const timeStr = ev.timestamp.includes('T')
              ? ev.timestamp.split('T')[1].slice(0, 5)
              : ev.timestamp;

            return (
              <div
                key={ev.id}
                className="p-2.5 bg-neutral-950/70 border border-neutral-800/80 rounded-lg text-xs hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[11px] text-neutral-400 font-semibold">
                    {timeStr}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {ev.affectedSector && (
                      <span className="text-[10px] text-neutral-400">
                        {ev.affectedSector}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded font-mono ${
                        ev.severity === 'high'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : ev.severity === 'medium'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {ev.severity.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="font-semibold text-neutral-200 mb-0.5">
                  {ev.title}
                </div>
                <div className="text-[11px] text-neutral-400 leading-relaxed">
                  {ev.description}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
