import React, { useState, useEffect } from 'react';
import { Activity, X, RefreshCw, Zap, Database, Play } from 'lucide-react';
import { simulationScheduler } from '../game/simulation/SimulationScheduler';
import { WorldState } from '../types/world';
import { PerformanceMetrics } from '../types/ui';
import { SaveManager } from '../game/world/SaveManager';
import { WorldBinaryCodec } from '../services/storage/BinaryCodec';

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
  const [benchResult, setBenchResult] = useState<string | null>(null);
  const [isRunningBench, setIsRunningBench] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(simulationScheduler.getPerformanceMetrics(worldState));
    }, 500);

    return () => clearInterval(interval);
  }, [worldState]);

  const saveMetrics = SaveManager.getMetrics();

  // Benchmarking Actions
  const run100TicksBench = () => {
    if (!worldState) return;
    setIsRunningBench(true);
    setTimeout(() => {
      const start = performance.now();
      simulationScheduler.advanceTimeJump('1h');
      const elapsed = performance.now() - start;
      setBenchResult(`1H jump executed in ${elapsed.toFixed(1)} ms`);
      setIsRunningBench(false);
    }, 50);
  };

  const run1DayBench = () => {
    if (!worldState) return;
    setIsRunningBench(true);
    setTimeout(() => {
      const start = performance.now();
      simulationScheduler.advanceTimeJump('1d');
      const elapsed = performance.now() - start;
      setBenchResult(`1-Day jump executed in ${elapsed.toFixed(1)} ms`);
      setIsRunningBench(false);
    }, 50);
  };

  const runCompressionBench = async () => {
    if (!worldState) return;
    setIsRunningBench(true);
    try {
      const jsonStart = performance.now();
      const jsonStr = JSON.stringify(worldState);
      const jsonMs = (performance.now() - jsonStart).toFixed(1);
      const jsonBytes = new TextEncoder().encode(jsonStr).length;

      const binStart = performance.now();
      const rawBin = WorldBinaryCodec.encode(worldState);
      const binMs = (performance.now() - binStart).toFixed(1);

      const compStart = performance.now();
      const compBin = await WorldBinaryCodec.compress(rawBin);
      const compMs = (performance.now() - compStart).toFixed(1);

      const savings = (((jsonBytes - compBin.length) / jsonBytes) * 100).toFixed(1);

      setBenchResult(
        `JSON: ${(jsonBytes / 1024).toFixed(1)}KB (${jsonMs}ms) → Binary: ${(rawBin.length / 1024).toFixed(1)}KB (${binMs}ms) → Gzip: ${(compBin.length / 1024).toFixed(1)}KB (${compMs}ms) | Giảm ${savings}%!`
      );
    } catch (err: any) {
      setBenchResult(`Lỗi benchmark: ${err?.message || err}`);
    } finally {
      setIsRunningBench(false);
    }
  };

  return (
    <div className="fixed bottom-16 right-4 z-50 bg-neutral-950/95 border border-emerald-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md w-80 text-xs font-mono text-neutral-300">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2.5">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>PERFORMANCE MONITOR</span>
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

        {/* Binary Compression Telemetry */}
        <div className="pt-2 border-t border-neutral-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              IndexedDB Binary Save:
            </span>
            <span>{saveMetrics.savingsPercent > 0 ? `-${saveMetrics.savingsPercent}%` : 'Chuẩn'}</span>
          </div>
          {saveMetrics.compressedBytes > 0 && (
            <div className="text-[10px] text-neutral-400 flex justify-between">
              <span>Kích thước: {(saveMetrics.compressedBytes / 1024).toFixed(1)} KB</span>
              <span>Lưu trong: {saveMetrics.saveDurationMs} ms</span>
            </div>
          )}
        </div>

        {/* Benchmark triggers */}
        <div className="pt-2 border-t border-neutral-800 flex gap-1.5">
          <button
            onClick={run100TicksBench}
            disabled={isRunningBench}
            className="flex-1 py-1 px-1.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] text-neutral-300 rounded border border-neutral-800 cursor-pointer"
          >
            Test 1 Giờ
          </button>
          <button
            onClick={run1DayBench}
            disabled={isRunningBench}
            className="flex-1 py-1 px-1.5 bg-neutral-900 hover:bg-neutral-800 text-[10px] text-neutral-300 rounded border border-neutral-800 cursor-pointer"
          >
            Test 1 Ngày
          </button>
          <button
            onClick={runCompressionBench}
            disabled={isRunningBench}
            className="flex-1 py-1 px-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-[10px] text-emerald-300 rounded border border-emerald-800/60 cursor-pointer"
          >
            Nén Save
          </button>
        </div>

        {benchResult && (
          <div className="p-1.5 mt-1 bg-neutral-900 rounded text-[10px] text-emerald-300 leading-tight">
            {benchResult}
          </div>
        )}
      </div>
    </div>
  );
};
