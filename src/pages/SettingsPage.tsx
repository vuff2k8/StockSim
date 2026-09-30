import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  PlusCircle,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Palette,
  Layout,
  Sliders,
  Activity,
  Keyboard,
} from 'lucide-react';
import { WorldState } from '../types/world';
import { ThemeId, UiDensity, UiPreset, UiSettings, WidgetConfig } from '../types/ui';
import { THEMES } from '../styles/theme';
import { ALL_WIDGETS, createDefaultUiSettings } from '../styles/presets';
import { SaveManager } from '../game/world/SaveManager';
import { formatDateTime } from '../utils/formatters';

interface SettingsPageProps {
  worldState: WorldState;
  onWorldUpdated: (world: WorldState) => void;
  onOpenCreateWorld: () => void;
  onResetWorld: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  worldState,
  onWorldUpdated,
  onOpenCreateWorld,
  onResetWorld,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const ui = worldState.uiSettings || createDefaultUiSettings('trader');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleUpdateUi = (partial: Partial<UiSettings>) => {
    const updatedUi = { ...ui, ...partial };
    const nextState: WorldState = {
      ...worldState,
      uiSettings: updatedUi,
    };
    onWorldUpdated(nextState);
    SaveManager.saveGame(nextState);
    showToast('Đã lưu tùy biến giao diện!');
  };

  const handlePresetSelect = (preset: UiPreset) => {
    const defaultSettings = createDefaultUiSettings(preset);
    handleUpdateUi({
      preset,
      density: defaultSettings.density,
      activeOrderTier: defaultSettings.activeOrderTier,
      widgets: defaultSettings.widgets,
    });
  };

  const handleToggleWidget = (widgetId: WidgetConfig['id']) => {
    const currentWidgets = [...(ui.widgets || ALL_WIDGETS.map((w, i) => ({ ...w, enabled: true, order: i })))];
    const target = currentWidgets.find((w) => w.id === widgetId);
    if (target) {
      target.enabled = !target.enabled;
      handleUpdateUi({ widgets: currentWidgets });
    }
  };

  const handleManualSave = () => {
    const success = SaveManager.saveGame(worldState);
    if (success) {
      showToast('Đã lưu trạng thái thế giới vào trình duyệt thành công!');
    } else {
      showToast('Lỗi: Không thể lưu trạng thái.');
    }
  };

  const handleExportJson = () => {
    const jsonStr = SaveManager.exportSave(worldState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stocksim_${worldState.snapshot.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất tệp sao lưu JSON!');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = SaveManager.importSave(text);
        onWorldUpdated(imported);
        SaveManager.saveGame(imported);
        showToast('Đã nạp thế giới từ tệp sao lưu!');
      } catch (err: any) {
        showToast(err.message || 'Lỗi khi nhập tệp sao lưu.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-4xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Appearance & Theme Customization */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
          <Palette className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            TÙY BIẾN GIAO DIỆN & CHỦ ĐỀ (THEME & APPEARANCE)
          </h2>
        </div>

        {/* Theme Selectors */}
        <div>
          <label className="text-xs font-semibold text-neutral-300 block mb-2">
            Chủ đề màu sắc (Theme Tokens)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.keys(THEMES) as ThemeId[]).map((themeKey) => {
              const th = THEMES[themeKey];
              const isSelected = ui.theme === themeKey;
              return (
                <button
                  key={themeKey}
                  onClick={() => handleUpdateUi({ theme: themeKey })}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800 border-emerald-500 ring-1 ring-emerald-500/50'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-full border border-neutral-700 shrink-0"
                      style={{ backgroundColor: th.background }}
                    />
                    <span className="font-bold text-xs text-white truncate">{th.name.split(' ')[0]}</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">{th.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Density Selectors */}
        <div>
          <label className="text-xs font-semibold text-neutral-300 block mb-2">
            Độ dày mật độ thông tin (Density)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'compact' as const, label: 'Compact (Đậm đặc)', desc: 'Kiểu Bloomberg/Refinitiv' },
              { id: 'normal' as const, label: 'Normal (Tiêu chuẩn)', desc: 'Cân bằng scannability' },
              { id: 'comfortable' as const, label: 'Comfortable (Thoáng)', desc: 'Dễ đọc trên mobile' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => handleUpdateUi({ density: d.id })}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  ui.density === d.id
                    ? 'bg-neutral-800 border-emerald-500 text-white'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">{d.label}</div>
                <div className="text-[10px] text-neutral-500">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Preset Layouts */}
        <div>
          <label className="text-xs font-semibold text-neutral-300 block mb-2">
            Cấu hình giao diện mẫu (UI Presets)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'investor' as const, label: 'Investor', desc: 'Danh mục & cơ bản' },
              { id: 'trader' as const, label: 'Trader', desc: 'Chart & Sổ lệnh' },
              { id: 'analyst' as const, label: 'Analyst', desc: 'Thống kê & Depth' },
              { id: 'story' as const, label: 'Story', desc: 'Sự kiện & Dòng tin' },
              { id: 'terminal' as const, label: 'Terminal', desc: 'Toàn bộ widget' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  ui.preset === p.id
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="text-xs">{p.label}</div>
                <div className="text-[10px] text-neutral-500">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Dashboard Widgets Toggle */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
          <Layout className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            QUẢN LÝ TIỆN ÍCH DASHBOARD (WIDGETS)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {ALL_WIDGETS.map((w) => {
            const widgetCfg = ui.widgets?.find((item) => item.id === w.id);
            const isEnabled = widgetCfg ? widgetCfg.enabled : true;

            return (
              <div
                key={w.id}
                onClick={() => handleToggleWidget(w.id)}
                className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors cursor-pointer select-none"
              >
                <span className="text-neutral-300">{w.label}</span>
                <span
                  className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                    isEnabled ? 'bg-emerald-500' : 'bg-neutral-700'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Performance & Keyboard Shortcuts */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            HIỆU NĂNG & PHÍM TẮT (PERFORMANCE & SHORTCUTS)
          </h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
            <div>
              <div className="font-semibold text-white">Bảng chẩn đoán hiệu năng (Developer Debug Panel)</div>
              <div className="text-[11px] text-neutral-400">
                Hiển thị thông số FPS, TPS mô phỏng, số lượng lệnh mở và thời gian thực thi tick.
              </div>
            </div>
            <button
              onClick={() => handleUpdateUi({ showPerformancePanel: !ui.showPerformancePanel })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                ui.showPerformancePanel
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {ui.showPerformancePanel ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-neutral-400" />
                <span>Phím tắt Desktop (B = Mua, S = Bán, Space = Dừng/Tiếp tục, Esc = Đóng)</span>
              </div>
              <div className="text-[11px] text-neutral-400">
                Tự động không can thiệp khi đang nhập liệu trong ô văn bản.
              </div>
            </div>
            <button
              onClick={() => handleUpdateUi({ enableKeyboardShortcuts: !ui.enableKeyboardShortcuts })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                ui.enableKeyboardShortcuts
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {ui.enableKeyboardShortcuts ? 'BẬT' : 'TẮT'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Save & Backup */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white pb-3 border-b border-neutral-800">
          LƯU TRỮ & SAO LƯU THẾ GIỚI
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleManualSave}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer text-xs shadow-md shadow-emerald-950/40"
          >
            <Save className="w-4 h-4" />
            <span>LƯU THẾ GIỚI (SAVE GAME)</span>
          </button>

          <button
            onClick={onOpenCreateWorld}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-xs border border-neutral-700"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>TẠO THẾ GIỚI MỚI (NEW WORLD)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất file JSON</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Nhập từ file JSON</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
        </div>
      </div>

      {/* 5. Danger Zone: Reset Game */}
      <div className="bg-neutral-900 border border-rose-900/40 rounded-xl p-5">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 mb-3 text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="text-xs font-bold uppercase tracking-wider">VÙNG NGUY HIỂM (DANGER ZONE)</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-white">Xóa & Đặt lại thế giới (Reset Game)</div>
            <div className="text-[11px] text-neutral-400">
              Xóa toàn bộ thế giới hiện tại, danh mục, sổ lệnh và bắt đầu lại.
            </div>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn xóa thế giới hiện tại?')) {
                onResetWorld();
              }
            }}
            className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Đặt lại toàn bộ (Reset)
          </button>
        </div>
      </div>
    </div>
  );
};
