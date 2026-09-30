import React, { useState } from 'react';
import { Globe2, Sparkles, Shield, DollarSign, ArrowRight, Loader2, RefreshCw, Check } from 'lucide-react';
import { SUPPORTED_MARKETS, MARKET_LIST } from '../data/markets';
import { WorldManager } from '../game/world/WorldManager';
import { WorldState } from '../types/world';
import { formatCurrency } from '../utils/formatters';

interface CreateWorldPageProps {
  onWorldCreated: (world: WorldState) => void;
  onCancel?: () => void;
  hasExistingWorld?: boolean;
}

export const CreateWorldPage: React.FC<CreateWorldPageProps> = ({
  onWorldCreated,
  onCancel,
  hasExistingWorld,
}) => {
  const [selectedMarketId, setSelectedMarketId] = useState<string>('vietnam');
  const marketConfig = SUPPORTED_MARKETS[selectedMarketId] || SUPPORTED_MARKETS.vietnam;

  const [startingCapital, setStartingCapital] = useState<number>(marketConfig.defaultStartingCapital);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [universeType, setUniverseType] = useState<'full' | 'bluechip'>('full');
  const [customSeed, setCustomSeed] = useState<number>(() => Math.floor(Math.random() * 900000000 + 100000000));

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMarketChange = (marketId: string) => {
    setSelectedMarketId(marketId);
    const cfg = SUPPORTED_MARKETS[marketId];
    if (cfg) {
      setStartingCapital(cfg.defaultStartingCapital);
    }
    setErrorMessage(null);
  };

  const handleGenerateNewSeed = () => {
    setCustomSeed(Math.floor(Math.random() * 900000000 + 100000000));
  };

  const handleCreateWorld = async () => {
    try {
      setErrorMessage(null);
      setLoadingStep('1/4: Đang tải danh sách cổ phiếu & dữ liệu thị trường thực tế...');
      await new Promise((r) => setTimeout(r, 200));

      setLoadingStep('2/4: Xác thực và chuẩn hóa giá khớp, lịch sử nến và biên độ dao động...');
      await new Promise((r) => setTimeout(r, 250));

      setLoadingStep('3/4: Tạo hạt giống mô phỏng (Seed) & Đóng băng Snapshot thế giới...');
      const newWorld = await WorldManager.createNewWorld({
        marketId: selectedMarketId,
        startingCapital,
        difficulty,
        universeType,
        customSeed,
      });

      setLoadingStep('4/4: Khởi động hệ thống mô phỏng...');
      await new Promise((r) => setTimeout(r, 200));

      onWorldCreated(newWorld);
    } catch (err: any) {
      setLoadingStep(null);
      setErrorMessage(err.message || 'Không thể tạo thế giới mới. Vui lòng kiểm tra lại cấu hình.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 p-6 md:p-8 border-b border-neutral-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Globe2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                KHỞI TẠO THẾ GIỚI TÀI CHÍNH (CREATE NEW WORLD)
              </h1>
              <p className="text-xs md:text-sm text-neutral-400">
                Thế giới tài chính sẽ được snapshot từ dữ liệu thị trường thực tế, sau đó tự do biến đổi độc lập.
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-6">
          {/* 1. Chọn Thị Trường */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-3">
              1. Chọn Thị trường Khởi tạo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {MARKET_LIST.map((m) => {
                const isSelected = selectedMarketId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMarketChange(m.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-800 border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{m.flag}</span>
                      <span className="font-bold text-xs text-white truncate">{m.country}</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      {m.currency} · Lô {m.lotSize}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400">
              <span className="text-neutral-200 font-semibold">{marketConfig.name}:</span> {marketConfig.description}
            </div>
          </div>

          {/* 2. Vốn Khởi Đầu */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                2. Vốn Đầu Tư Khởi Điểm ({marketConfig.currency})
              </label>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {formatCurrency(startingCapital, marketConfig.currency)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {marketConfig.capitalPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStartingCapital(preset)}
                  className={`py-2 px-3 text-xs font-mono font-medium rounded-lg border transition-colors cursor-pointer ${
                    startingCapital === preset
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-850'
                  }`}
                >
                  {formatCurrency(preset, marketConfig.currency, { compact: true })}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={1000}
              step={1000}
              value={startingCapital}
              onChange={(e) => setStartingCapital(Math.max(1000, Number(e.target.value) || 0))}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 3. Độ Khó & Vũ Trụ Tài Sản */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-2">
                3. Độ Khó Mô Phỏng
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                {[
                  { id: 'easy' as const, label: 'Dễ' },
                  { id: 'normal' as const, label: 'Chuẩn' },
                  { id: 'hard' as const, label: 'Khó' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      difficulty === d.id
                        ? 'bg-neutral-800 text-emerald-400 font-bold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-2">
                4. Hạt Giống Thế Giới (Seed)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(Number(e.target.value) || 1)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateNewSeed}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors cursor-pointer"
                  title="Tạo hạt giống ngẫu nhiên"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}

          {/* Loading Pipeline Indicator */}
          {loadingStep && (
            <div className="p-4 bg-neutral-950 border border-emerald-500/50 rounded-xl space-y-2">
              <div className="flex items-center gap-3 text-xs text-emerald-400 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{loadingStep}</span>
              </div>
              <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-3/4 animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-800">
            {hasExistingWorld && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={!!loadingStep}
                className="px-5 py-2.5 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                Quay lại thế giới hiện tại
              </button>
            )}

            <button
              type="button"
              onClick={handleCreateWorld}
              disabled={!!loadingStep}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>TẠO THẾ GIỚI (CREATE WORLD)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
