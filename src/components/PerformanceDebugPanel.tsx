import React, { useState, useEffect } from 'react';
import { Activity, X, RefreshCw } from 'lucide-react';
import { simulationScheduler } from '../game/simulation/SimulationScheduler';
import { WorldState } from '../types/world';
import { PerformanceMetrics } from '../types/ui';

interface PerformanceDebugPanelProps {
  worldState: WorldState | null;
  onClose: () => void;
}

export const PerformanceDebugPanel: React.FC<PerformanceDebugPanelProps> = ({
  worldState,
  onClose,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() =>
    simulationScheduler.getPerformanceMetrics(worldState)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(simulationScheduler.getPerformanceMetrics(worldState));
    }, 500);

    return () => clearInterval(interval);
  }, [worldState]);

  return (
    <div className="fixed bottom-16 right-4 z-50 bg-neutral-950/95 border border-emerald-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md w-72 text-xs font-mono text-neutral-300">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2.5">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>PERF DEBUG PANEL</span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white p-0.5 rounded cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-neutral-500">UI Frame Rate:</span>
          <span className={`font-bold ${metrics.fps < 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {metrics.fps} FPS
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-500">Simulation Speed:</span>
          <span className="text-neutral-200">{metrics.tps} TPS</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-500">Rendered Instruments:</span>
          <span className="text-neutral-200">{metrics.renderedInstruments} mã</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-500">Active Open Orders:</span>
          <span className="text-neutral-200">{metrics.activeOrdersCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-500">Active Positions:</span>
          <span className="text-neutral-200">{metrics.activePositionsCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-500">Last Tick Step Exec:</span>
          <span className="text-neutral-200">{metrics.lastStepDurationMs} ms</span>
        </div>

        {metrics.memoryEstimateMb !== undefined && (
          <div className="flex justify-between pt-1 border-t border-neutral-800/80">
            <span className="text-neutral-500">Heap Memory:</span>
            <span className="text-neutral-200">~{metrics.memoryEstimateMb} MB</span>
          </div>
        )}
      </div>
    </div>
  );
};
