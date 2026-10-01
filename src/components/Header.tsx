import React from 'react';
import { Play, Pause, FastForward, Clock, PlusCircle } from 'lucide-react';
import { SimulationClockState, SimulationSpeed } from '../types/simulation';
import { MarketConfig } from '../types/market';
import { MarketSessionEngine } from '../game/session/MarketSessionEngine';

interface HeaderProps {
  clock: SimulationClockState;
  marketConfig: MarketConfig;
  worldId: string;
  onTogglePlay: () => void;
  onChangeSpeed: (speed: SimulationSpeed) => void;
  onAdvanceTime: (jump: '1h' | '1d' | '1w' | '1m') => void;
  onOpenNewWorldModal: () => void;
}

const SPEEDS: SimulationSpeed[] = [1, 2, 5, 10, 50, 100];

export const Header: React.FC<HeaderProps> = ({
  clock,
  marketConfig,
  worldId,
  onTogglePlay,
  onChangeSpeed,
  onAdvanceTime,
  onOpenNewWorldModal,
}) => {
  const sessionState = React.useMemo(() => {
    return MarketSessionEngine.getSessionState(marketConfig, clock.currentTimestamp);
  }, [marketConfig, clock.currentTimestamp]);

  return (
    <header className="sticky top-0 z-30 bg-neutral-950/95 border-b border-neutral-800 backdrop-blur-md px-3 md:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Brand & World Info */}
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono tracking-tighter">STOCKSIM</span>
              <span className="text-xs text-neutral-500 font-normal">v1.0</span>
            </span>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 border-l border-neutral-800 pl-3">
              <span>{marketConfig.flag}</span>
              <span className="font-medium text-neutral-200">{marketConfig.name.split('(')[0]}</span>
              <span className="text-neutral-600">·</span>
              <span className="font-mono text-[11px] text-neutral-400">{worldId}</span>
            </div>
          </div>

          <button
            onClick={onOpenNewWorldModal}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-300 bg-neutral-900 border border-neutral-700/80 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Tạo thế giới mới"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">Thế giới mới</span>
          </button>
        </div>

        {/* Right: Simulation Clock & Step Controls */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 md:gap-4">
          {/* Simulated Clock Display with Authoritative Market Session */}
          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-300 font-medium">{clock.displayDate}</span>
            <span className="text-neutral-500">·</span>
            <span className="text-emerald-400 font-bold">{clock.displayTime}</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold uppercase tracking-wider ${
                sessionState.session === 'OPEN'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : sessionState.session === 'ATO' || sessionState.session === 'ATC'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : sessionState.session === 'LUNCH_BREAK'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : sessionState.session === 'PRE_MARKET' || sessionState.session === 'AFTER_HOURS'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
              title={sessionState.displayNameVi}
            >
              {sessionState.session === 'OPEN' ? 'Khớp lệnh' : sessionState.session}
            </span>
          </div>

          {/* Play / Pause & Speed Selector */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 border border-neutral-800 rounded-lg">
            <button
              onClick={onTogglePlay}
              className={`p-1.5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                clock.isPaused
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-amber-600 text-white hover:bg-amber-500'
              }`}
              title={clock.isPaused ? 'Tiếp tục mô phỏng' : 'Tạm dừng mô phỏng'}
            >
              {clock.isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            </button>

            {/* Speeds */}
            <div className="flex items-center">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => onChangeSpeed(s)}
                  className={`px-2 py-1 text-[11px] font-mono font-medium rounded transition-colors cursor-pointer ${
                    clock.speed === s && !clock.isPaused
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Time Jump Controls */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-neutral-400">
            <span className="text-neutral-500 mr-1 flex items-center gap-0.5">
              <FastForward className="w-3 h-3" /> Tua:
            </span>
            <button
              onClick={() => onAdvanceTime('1h')}
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              +1 Giờ
            </button>
            <button
              onClick={() => onAdvanceTime('1d')}
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              +1 Ngày
            </button>
            <button
              onClick={() => onAdvanceTime('1w')}
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              +1 Tuần
            </button>
            <button
              onClick={() => onAdvanceTime('1m')}
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              +1 Tháng
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
