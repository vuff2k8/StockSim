import React from 'react';
import { Shield, AlertTriangle, PieChart, Activity, AlertCircle } from 'lucide-react';
import { Portfolio, RiskMetrics } from '../types/portfolio';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface RiskPanelProps {
  portfolio: Portfolio;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ portfolio }) => {
  const currency = portfolio.currency || 'VND';
  const equity = portfolio.equity ?? portfolio.totalAssets ?? portfolio.cash ?? 0;
  const usedMargin = portfolio.usedMargin ?? 0;
  const availableMargin = portfolio.availableMargin ?? portfolio.cash ?? 0;
  const marginRatio = portfolio.marginRatio ?? 0;
  const isMarginCall = !!portfolio.isMarginCall;

  // Safe fallback for riskMetrics to prevent any undefined crashes
  const riskMetrics: RiskMetrics = portfolio.riskMetrics || {
    totalExposure: portfolio.portfolioValue || 0,
    longExposure: portfolio.portfolioValue || 0,
    shortExposure: 0,
    grossExposure: portfolio.portfolioValue || 0,
    netExposure: portfolio.portfolioValue || 0,
    accountLeverage: equity > 0 ? Number(((portfolio.portfolioValue || 0) / equity).toFixed(2)) : 0,
    marginUsed: usedMargin,
    availableMargin,
    marginRatio,
    isMarginWarning: marginRatio >= 0.8 && usedMargin > 0,
    isLiquidationRisk: false,
    largestPositionPercent: 0,
    concentrationPercent: 0,
    potentialLossEstimate: usedMargin * 0.5,
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${isMarginCall ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            QUẢN TRỊ RỦI RO & KÝ QUỸ (RISK & MARGIN)
          </h3>
        </div>
        <span
          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
            isMarginCall
              ? 'bg-rose-950 text-rose-300 border border-rose-800'
              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
          }`}
        >
          {isMarginCall ? 'CẢNH BÁO KÝ QUỸ (CALL MARGIN)' : 'AN TOÀN (NOMINAL)'}
        </span>
      </div>

      {/* Margin Call Warning Banner if breached */}
      {isMarginCall && (
        <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-200 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>CẢNH BÁO TỶ LỆ KÝ QUỸ NGUY HIỂM!</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Tỷ lệ sử dụng margin đã chạm {(marginRatio * 100).toFixed(1)}%. Hãy nộp thêm tiền hoặc chủ động đóng bớt vị thế để tránh bị thanh lý cưỡng chế (Liquidation).
          </p>
        </div>
      )}

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-2.5 bg-neutral-950 rounded-lg">
          <span className="text-[10px] text-neutral-500 uppercase block mb-0.5">Vốn chủ sở hữu (Equity)</span>
          <span className="text-white font-bold text-sm">{formatCurrency(equity, currency)}</span>
        </div>

        <div className="p-2.5 bg-neutral-950 rounded-lg">
          <span className="text-[10px] text-neutral-500 uppercase block mb-0.5">Ký quỹ đã dùng</span>
          <span className="text-amber-400 font-bold text-sm">{formatCurrency(usedMargin, currency)}</span>
        </div>

        <div className="p-2.5 bg-neutral-950 rounded-lg">
          <span className="text-[10px] text-neutral-500 uppercase block mb-0.5">Sức mua ký quỹ</span>
          <span className="text-emerald-400 font-bold text-sm">{formatCurrency(availableMargin, currency)}</span>
        </div>

        <div className="p-2.5 bg-neutral-950 rounded-lg">
          <span className="text-[10px] text-neutral-500 uppercase block mb-0.5">Tỷ lệ Margin Ratio</span>
          <span className={`font-bold text-sm ${marginRatio > 0.7 ? 'text-rose-400' : 'text-neutral-200'}`}>
            {(marginRatio * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Exposure Analysis */}
      <div className="pt-2 border-t border-neutral-800 space-y-2">
        <div className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-neutral-400" />
          Phân tích Vị thế & Mức độ Rủi ro
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-400">Tổng phơi bày (Gross):</span>
            <span className="text-white font-semibold">
              {formatCurrency(riskMetrics.grossExposure ?? 0, currency, { compact: true })}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-400">Phơi bày ròng (Net):</span>
            <span className="text-white font-semibold">
              {formatCurrency(riskMetrics.netExposure ?? 0, currency, { compact: true })}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-400">Đòn bẩy thực tế:</span>
            <span className="text-neutral-200 font-bold">
              {(riskMetrics.accountLeverage ?? 0).toFixed(2)}x
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-400">Vị thế Long:</span>
            <span className="text-emerald-400">
              {formatCurrency(riskMetrics.longExposure ?? 0, currency, { compact: true })}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-400">Vị thế Short:</span>
            <span className="text-rose-400">
              {formatCurrency(riskMetrics.shortExposure ?? 0, currency, { compact: true })}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-400">Độ tập trung mã max:</span>
            <span
              className={`font-bold ${
                (riskMetrics.largestPositionPercent ?? 0) > 50 ? 'text-amber-400' : 'text-neutral-200'
              }`}
            >
              {riskMetrics.largestPositionSymbol
                ? `${riskMetrics.largestPositionSymbol} (${(riskMetrics.largestPositionPercent ?? 0).toFixed(1)}%)`
                : '0%'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
