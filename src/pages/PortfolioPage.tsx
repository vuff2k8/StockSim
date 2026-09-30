import React, { useState } from 'react';
import {
  Wallet,
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Layers,
  ArrowRight,
  Shield,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { Portfolio, Position } from '../types/portfolio';
import { Instrument, MarketConfig } from '../types/market';
import { OrderSide, OrderTier } from '../types/order';
import { SubmitOrderParams, SubmitOrderResult } from '../game/orders/OrderEngine';
import {
  formatCurrency,
  formatPercent,
  formatStockPrice,
} from '../utils/formatters';

interface PortfolioPageProps {
  portfolio: Portfolio;
  instruments: Record<string, Instrument>;
  marketConfig: MarketConfig;
  onSelectInstrument: (symbol: string) => void;
  onOpenOrderModal: (instrument: Instrument, side: OrderSide, tier?: OrderTier) => void;
  onSubmitOrder: (params: SubmitOrderParams) => SubmitOrderResult;
  onNavigateTab: (tab: 'home' | 'markets' | 'portfolio' | 'history' | 'settings') => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
  portfolio,
  instruments,
  marketConfig,
  onSelectInstrument,
  onOpenOrderModal,
  onSubmitOrder,
  onNavigateTab,
}) => {
  const positionsList = Object.values(portfolio.positions);
  const isTotalReturnPositive = portfolio.totalReturn >= 0;
  const isRealizedPositive = portfolio.realizedPnL >= 0;
  const isUnrealizedPositive = portfolio.unrealizedPnL >= 0;

  const [quickCloseFeedback, setQuickCloseFeedback] = useState<string | null>(null);

  const handleQuickClose = (pos: Position, pct: number) => {
    const inst = instruments[pos.symbol];
    if (!inst) return;

    const rawQty = Math.floor((pos.quantity * pct) / 100);
    const lot = marketConfig.rules.lotSize || 1;
    const roundedQty = Math.max(lot, Math.floor(rawQty / lot) * lot);
    const finalQty = Math.min(pos.quantity, roundedQty);

    const res = onSubmitOrder({
      instrument: inst,
      side: pos.side === 'LONG' ? 'SELL' : 'BUY',
      positionEffect: pos.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
      orderType: 'MARKET',
      tier: 'BASIC',
      quantity: finalQty,
    });

    if (res.success) {
      setQuickCloseFeedback(`Đã đóng ${pct}% vị thế ${pos.symbol} (${finalQty.toLocaleString()} CP) thành công.`);
      setTimeout(() => setQuickCloseFeedback(null), 2000);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Toast Feedback */}
      {quickCloseFeedback && (
        <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-semibold">
          {quickCloseFeedback}
        </div>
      )}

      {/* Margin Call Warning if present */}
      {portfolio.isMarginCall && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-800 text-rose-200 rounded-xl text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>CẢNH BÁO: TÀI KHOẢN KÝ QUỸ ĐANG Ở MỨC NGUY HIỂM</span>
          </div>
          <p className="text-[11px]">
            Tỷ lệ ký quỹ (Margin Ratio) đạt {(portfolio.marginRatio * 100).toFixed(1)}%. Hãy nộp thêm tiền hoặc đóng các vị thế thua lỗ để tránh bị giải chấp tự động.
          </p>
        </div>
      )}

      {/* 1. Margin & Portfolio Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Total Assets / Equity */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Tổng tài sản (Equity)</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-xl md:text-2xl font-bold text-white">
            {formatCurrency(portfolio.totalAssets, portfolio.currency)}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono mt-1">
            Vốn ban đầu: {formatCurrency(portfolio.startingCapital, portfolio.currency, { compact: true })}
          </div>
        </div>

        {/* Cash & Margin Used */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Tiền mặt / Đã ký quỹ</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono text-base md:text-lg font-bold text-neutral-200">
            {formatCurrency(portfolio.cash, portfolio.currency)}
          </div>
          <div className="text-[11px] text-amber-400 font-mono mt-1">
            Ký quỹ dùng: {formatCurrency(portfolio.usedMargin, portfolio.currency, { compact: true })}
          </div>
        </div>

        {/* Available Margin */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">Sức mua ký quỹ</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-base md:text-lg font-bold text-emerald-400">
            {formatCurrency(portfolio.availableMargin, portfolio.currency)}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono mt-1">
            Margin Ratio: {(portfolio.marginRatio * 100).toFixed(1)}%
          </div>
        </div>

        {/* Total Return */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider">TỔNG LỢI NHUẬN</span>
            {isTotalReturnPositive ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
          </div>
          <div className={`font-mono text-base md:text-lg font-bold ${isTotalReturnPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isTotalReturnPositive ? '▲ +' : '▼ '}{formatCurrency(portfolio.totalReturn, portfolio.currency)}
          </div>
          <div className="text-[11px] font-mono font-bold mt-1 text-emerald-400">
            {formatPercent(portfolio.totalReturnPercent)}
          </div>
        </div>
      </div>

      {/* 2. Positions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
            Chi tiết Vị thế Danh mục ({positionsList.length})
          </h2>
        </div>

        {positionsList.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center space-y-3">
            <p className="text-xs md:text-sm text-neutral-400">
              Hiện tại danh mục của bạn chưa có cổ phiếu nào.
            </p>
            <button
              onClick={() => onNavigateTab('markets')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all cursor-pointer text-xs"
            >
              <span>Xem Bảng giá & Đặt lệnh</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {positionsList.map((pos) => {
              const inst = instruments[pos.symbol];
              const isProfit = pos.unrealizedPnL >= 0;

              return (
                <div
                  key={pos.symbol}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div
                      className="cursor-pointer"
                      onClick={() => onSelectInstrument(pos.symbol)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-white hover:text-emerald-400">
                          {pos.symbol}
                        </span>
                        <span className="text-xs text-neutral-400 truncate max-w-[200px]">{pos.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                            pos.side === 'LONG' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {pos.side}
                        </span>
                        {pos.leverage > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 text-[10px] font-mono font-bold">
                            {pos.leverage}X
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono mt-0.5">
                        Khối lượng: <span className="text-white font-bold">{pos.quantity.toLocaleString()} CP</span> · Giá vốn:{' '}
                        <span className="text-neutral-200">{formatStockPrice(pos.averagePrice, pos.currency)}</span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right font-mono">
                      <div className="text-base font-bold text-white">
                        {formatCurrency(pos.marketValue, pos.currency)}
                      </div>
                      <div className={`text-xs font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '▲ +' : '▼ '}{formatCurrency(pos.unrealizedPnL, pos.currency)} ({formatPercent(pos.unrealizedPnLPercent)})
                      </div>
                    </div>
                  </div>

                  {/* Position Details & Liquidation */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-neutral-950 rounded-lg text-xs font-mono">
                    <div>
                      <span className="text-neutral-500 block text-[10px]">Giá hiện tại</span>
                      <span className="text-neutral-200 font-bold">{formatStockPrice(pos.currentPrice, pos.currency)}</span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[10px]">Ký quỹ đã dùng</span>
                      <span className="text-amber-400">{formatCurrency(pos.marginUsed, pos.currency)}</span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[10px]">Mục tiêu TP / SL</span>
                      <span className="text-neutral-300">
                        {pos.tpPrice ? `TP: ${formatStockPrice(pos.tpPrice, pos.currency)}` : '—'} /{' '}
                        {pos.slPrice ? `SL: ${formatStockPrice(pos.slPrice, pos.currency)}` : '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[10px]">Giá thanh lý (Liq)</span>
                      <span className={pos.liquidationPrice ? 'text-rose-400 font-bold' : 'text-neutral-500'}>
                        {pos.liquidationPrice ? formatStockPrice(pos.liquidationPrice, pos.currency) : 'Không có'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Position Management Actions */}
                  <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-neutral-400 text-[11px] mr-1">Thao tác nhanh:</span>
                    <button
                      onClick={() => handleQuickClose(pos, 25)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono cursor-pointer"
                    >
                      Đóng 25%
                    </button>
                    <button
                      onClick={() => handleQuickClose(pos, 50)}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono cursor-pointer"
                    >
                      Đóng 50%
                    </button>
                    <button
                      onClick={() => handleQuickClose(pos, 100)}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded font-mono cursor-pointer"
                    >
                      Đóng 100%
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => inst && onOpenOrderModal(inst, 'BUY', 'ADVANCED')}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded font-medium cursor-pointer"
                      >
                        Mua thêm
                      </button>
                      <button
                        onClick={() => inst && onOpenOrderModal(inst, 'SELL', 'ADVANCED')}
                        className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded font-medium cursor-pointer"
                      >
                        Bán bớt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
