import React, { useState, useMemo } from 'react';
import { X, AlertCircle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { Instrument, MarketConfig } from '../types/market';
import { OrderSide, FeeConfig } from '../types/order';
import { Portfolio } from '../types/portfolio';
import { OrderEngine } from '../game/orders/OrderEngine';
import { formatCurrency, formatStockPrice, formatPercent } from '../utils/formatters';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: Instrument;
  portfolio: Portfolio;
  marketConfig: MarketConfig;
  feeConfig: FeeConfig;
  initialSide?: OrderSide;
  onExecuteOrder: (side: OrderSide, quantity: number) => { success: boolean; errorMessage?: string };
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  instrument,
  portfolio,
  marketConfig,
  feeConfig,
  initialSide = 'BUY',
  onExecuteOrder,
}) => {
  const [side, setSide] = useState<OrderSide>(initialSide);
  const lotSize = marketConfig.lotSize || 1;
  const [quantity, setQuantity] = useState<number>(lotSize);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const existingPosition = portfolio.positions[instrument.symbol];
  const holdingQuantity = existingPosition ? existingPosition.quantity : 0;

  // Calculate live order preview
  const preview = useMemo(() => {
    return OrderEngine.calculatePreview(
      {
        instrument,
        side,
        quantity,
        orderType: 'MARKET',
        tier: 'BASIC',
        price: instrument.currentPrice,
      },
      portfolio,
      feeConfig,
      marketConfig
    );
  }, [instrument, side, quantity, portfolio, feeConfig, marketConfig]);

  if (!isOpen) return null;

  const handleQuickAdd = (multiplier: number) => {
    setQuantity((prev) => Math.max(lotSize, prev + lotSize * multiplier));
    setFeedback(null);
  };

  const handleMaxQuantity = () => {
    if (side === 'BUY') {
      const priceWithFee = instrument.currentPrice * (1 + feeConfig.rate);
      const maxShares = Math.floor(portfolio.cash / priceWithFee);
      const roundedToLot = Math.floor(maxShares / lotSize) * lotSize;
      setQuantity(Math.max(lotSize, roundedToLot));
    } else {
      setQuantity(holdingQuantity > 0 ? holdingQuantity : lotSize);
    }
    setFeedback(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview.isValid) {
      setFeedback({ type: 'error', message: preview.errorMessage || 'Lệnh không hợp lệ.' });
      return;
    }

    const result = onExecuteOrder(side, quantity);
    if (result.success) {
      setFeedback({
        type: 'success',
        message: `Đã thực hiện lệnh ${side === 'BUY' ? 'MUA' : 'BÁN'} thành công ${quantity.toLocaleString()} ${instrument.symbol}!`,
      });
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1200);
    } else {
      setFeedback({
        type: 'error',
        message: result.errorMessage || 'Lệnh bị từ chối.',
      });
    }
  };

  const isUp = instrument.currentPrice >= instrument.previousClose;
  const priceChange = instrument.currentPrice - instrument.previousClose;
  const priceChangePct = instrument.previousClose > 0 ? (priceChange / instrument.previousClose) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white font-mono">{instrument.symbol}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                  {instrument.exchange}
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate max-w-[240px]">{instrument.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Price Banner */}
        <div className="bg-neutral-950 px-5 py-3 border-b border-neutral-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-500 block">Giá khớp hiện tại</span>
            <span className="text-xl font-bold font-mono text-white">
              {formatStockPrice(instrument.currentPrice, instrument.currency)}
            </span>
          </div>

          <div className={`flex items-center gap-1 font-mono text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{formatPercent(priceChangePct)}</span>
          </div>
        </div>

        {/* Buy / Sell Tab Buttons */}
        <div className="p-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl mb-4 border border-neutral-800">
            <button
              type="button"
              onClick={() => { setSide('BUY'); setFeedback(null); }}
              className={`py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                side === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              MUA (BUY)
            </button>
            <button
              type="button"
              onClick={() => { setSide('SELL'); setFeedback(null); }}
              className={`py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                side === 'SELL'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              BÁN (SELL)
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                <span>Số lượng đặt lệnh (Lô: {lotSize})</span>
                <span>
                  {side === 'BUY'
                    ? `Tiền mặt: ${formatCurrency(portfolio.cash, portfolio.currency, { compact: true })}`
                    : `Hiện có: ${holdingQuantity.toLocaleString()} CP`}
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min={lotSize}
                  step={lotSize}
                  value={quantity || ''}
                  onChange={(e) => {
                    setQuantity(parseInt(e.target.value) || 0);
                    setFeedback(null);
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 font-mono text-base text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder={`Bội số của ${lotSize}`}
                />
                <span className="absolute right-3 top-2.5 text-xs text-neutral-500 font-mono">CP</span>
              </div>

              {/* Quick Increment Buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(1)}
                  className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono transition-colors cursor-pointer"
                >
                  +{lotSize}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(5)}
                  className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono transition-colors cursor-pointer"
                >
                  +{lotSize * 5}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(10)}
                  className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono transition-colors cursor-pointer"
                >
                  +{lotSize * 10}
                </button>
                <button
                  type="button"
                  onClick={handleMaxQuantity}
                  className="flex-1 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-semibold rounded font-mono transition-colors cursor-pointer"
                >
                  Tối đa
                </button>
              </div>
            </div>

            {/* Order Preview Breakdown */}
            <div className="bg-neutral-950/90 border border-neutral-800/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Giá trị lệnh:</span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(preview.orderValue, instrument.currency)}
                </span>
              </div>

              <div className="flex justify-between text-neutral-400">
                <span>Phí giao dịch ({(feeConfig.rate * 100).toFixed(2)}%):</span>
                <span className="font-mono text-neutral-400">
                  {formatCurrency(preview.fee, instrument.currency)}
                </span>
              </div>

              <div className="pt-2 border-t border-neutral-800 flex justify-between font-semibold">
                <span className="text-neutral-300">
                  {side === 'BUY' ? 'Tổng thanh toán:' : 'Thực nhận sau phí:'}
                </span>
                <span className={`font-mono text-sm ${side === 'BUY' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {formatCurrency(preview.totalCost, instrument.currency)}
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-neutral-500 pt-1">
                <span>Tiền mặt sau lệnh:</span>
                <span className="font-mono">
                  {formatCurrency(preview.remainingCash, instrument.currency)}
                </span>
              </div>
            </div>

            {/* Error or Success Feedback Banner */}
            {feedback && (
              <div
                className={`p-3 rounded-xl flex items-start gap-2 text-xs ${
                  feedback.type === 'error'
                    ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                    : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                }`}
              >
                {feedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {!feedback && !preview.isValid && preview.errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/50 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{preview.errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={!preview.isValid}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  !preview.isValid
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : side === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50'
                }`}
              >
                {side === 'BUY' ? 'XÁC NHẬN MUA' : 'XÁC NHẬN BÁN'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
