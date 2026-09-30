import React, { useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Sliders,
  Shield,
  XCircle,
} from 'lucide-react';
import { Instrument, MarketConfig } from '../types/market';
import { Portfolio } from '../types/portfolio';
import { FeeConfig, OrderSide, OrderTier } from '../types/order';
import { PriceChart } from '../charts/PriceChart';
import { TradingTerminalOrderPanel } from '../components/TradingTerminalOrderPanel';
import { MarketDepthWidget } from '../components/MarketDepthWidget';
import { SubmitOrderParams, SubmitOrderResult } from '../game/orders/OrderEngine';
import {
  formatCurrency,
  formatPercent,
  formatStockPrice,
  formatVolume,
} from '../utils/formatters';

interface StockDetailPageProps {
  instrument: Instrument;
  portfolio: Portfolio;
  marketConfig: MarketConfig;
  feeConfig: FeeConfig;
  isWatchlisted: boolean;
  onToggleWatchlist: (symbol: string) => void;
  onBack: () => void;
  onSubmitOrder: (params: SubmitOrderParams) => SubmitOrderResult;
}

export const StockDetailPage: React.FC<StockDetailPageProps> = ({
  instrument,
  portfolio,
  marketConfig,
  feeConfig,
  isWatchlisted,
  onToggleWatchlist,
  onBack,
  onSubmitOrder,
}) => {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<OrderTier>('BASIC');

  const position = portfolio.positions[instrument.symbol];
  const holdingQuantity = position ? position.quantity : 0;

  const change = instrument.currentPrice - instrument.previousClose;
  const changePct = instrument.previousClose > 0 ? (change / instrument.previousClose) * 100 : 0;
  const isUp = change >= 0;

  const handleOpenOrder = (tier: OrderTier) => {
    setSelectedTier(tier);
    setOrderModalOpen(true);
  };

  // Quick close partial position
  const handleQuickClose = (pct: number) => {
    if (!position || position.quantity <= 0) return;
    const rawQty = Math.floor((position.quantity * pct) / 100);
    const lot = marketConfig.rules.lotSize || 1;
    const roundedQty = Math.max(lot, Math.floor(rawQty / lot) * lot);

    onSubmitOrder({
      instrument,
      side: position.side === 'LONG' ? 'SELL' : 'BUY',
      positionEffect: position.side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
      orderType: 'MARKET',
      tier: 'BASIC',
      quantity: Math.min(position.quantity, roundedQty),
    });
  };

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Top Bar with Back Button & Watchlist Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại thị trường</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleWatchlist(instrument.symbol)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
              isWatchlisted
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            {isWatchlisted ? (
              <>
                <BookmarkCheck className="w-3.5 h-3.5 fill-current" />
                <span>Đang theo dõi</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Theo dõi (Watch)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stock Hero Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="font-mono text-2xl md:text-3xl font-bold text-white tracking-tight">
                {instrument.symbol}
              </h1>
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs font-mono font-semibold">
                {instrument.exchange}
              </span>
              <span className="text-xs text-neutral-500">· {instrument.market.toUpperCase()}</span>
            </div>
            <p className="text-sm text-neutral-400 font-medium">{instrument.name}</p>
            <div className="flex items-center gap-3 text-xs text-neutral-500 mt-2">
              <span>Ngành: <span className="text-neutral-300">{instrument.sector}</span></span>
              <span>·</span>
              <span>Phong cách: <span className="text-emerald-400 font-medium">{instrument.style}</span></span>
              <span>·</span>
              <span>Beta: <span className="font-mono text-neutral-300">{instrument.beta.toFixed(2)}</span></span>
            </div>
          </div>

          {/* Price & Change Block */}
          <div className="sm:text-right shrink-0">
            <div className="font-mono text-2xl md:text-3xl font-bold text-white">
              {formatStockPrice(instrument.currentPrice, instrument.currency)}
            </div>
            <div className={`flex items-center sm:justify-end gap-1.5 font-mono text-sm font-bold mt-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? '▲ ' : '▼ '}
              <span>{isUp ? '+' : ''}{formatStockPrice(change, instrument.currency)}</span>
              <span>({formatPercent(changePct)})</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-1">
              Khối lượng phiên: {formatVolume(instrument.volume)}
            </div>
          </div>
        </div>

        {/* 3 Tier Action Triggers: Basic / Advanced / Pro */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-neutral-800">
          <button
            onClick={() => handleOpenOrder('BASIC')}
            className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 border border-neutral-700"
          >
            <span>LỆNH CƠ BẢN</span>
            <span className="text-[10px] text-neutral-400 font-normal">Buy / Sell Market</span>
          </button>

          <button
            onClick={() => handleOpenOrder('ADVANCED')}
            className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 border border-neutral-700"
          >
            <span>LỆNH NÂNG CAO</span>
            <span className="text-[10px] text-neutral-400 font-normal">Limit / Stop / TP / SL</span>
          </button>

          <button
            onClick={() => handleOpenOrder('PRO')}
            className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 border border-neutral-700"
          >
            <span>LỆNH PRO</span>
            <span className="text-[10px] text-neutral-400 font-normal">Margin / Short / Bracket</span>
          </button>
        </div>
      </div>

      {/* Grid: Interactive Price Chart + Simulated Market Depth Order Book */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PriceChart
            candles={instrument.history}
            currency={instrument.currency}
            symbol={instrument.symbol}
            currentPrice={instrument.currentPrice}
          />
        </div>

        <div>
          <MarketDepthWidget instrument={instrument} />
        </div>
      </div>

      {/* Position Status & Quick Exit Actions */}
      {position && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                Vị thế của bạn: {position.side} {position.symbol} ({position.quantity.toLocaleString()} CP)
              </h3>
            </div>
            {position.leverage > 1 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                ĐÒN BẨY {position.leverage}X
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-neutral-500 block mb-0.5">Giá vốn bình quân</span>
              <span className="text-neutral-200 font-semibold">{formatStockPrice(position.averagePrice, position.currency)}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Giá trị thị trường</span>
              <span className="text-white font-bold">{formatCurrency(position.marketValue, position.currency)}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Lợi nhuận tạm tính (P/L)</span>
              <span className={`font-bold ${position.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {position.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(position.unrealizedPnL, position.currency)} ({formatPercent(position.unrealizedPnLPercent)})
              </span>
            </div>
            {position.liquidationPrice && (
              <div>
                <span className="text-neutral-500 block mb-0.5">Giá thanh lý cưỡng chế</span>
                <span className="text-rose-400 font-bold">{formatStockPrice(position.liquidationPrice, position.currency)}</span>
              </div>
            )}
          </div>

          {/* Quick Exit Buttons */}
          <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-400 text-[11px] mr-1">Đóng nhanh vị thế:</span>
            <button
              onClick={() => handleQuickClose(25)}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-mono cursor-pointer"
            >
              Đóng 25%
            </button>
            <button
              onClick={() => handleQuickClose(50)}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-mono cursor-pointer"
            >
              Đóng 50%
            </button>
            <button
              onClick={() => handleQuickClose(100)}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded font-mono cursor-pointer"
            >
              Đóng 100% (Thoát hết)
            </button>
            <button
              onClick={() => handleOpenOrder('ADVANCED')}
              className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded font-medium cursor-pointer ml-auto"
            >
              Cài đặt TP / SL / Trailing
            </button>
          </div>
        </div>
      )}

      {/* Trading Rules & Market Parameters */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800 mb-3">
          <Activity className="w-4 h-4 text-neutral-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Quy định giao dịch thị trường ({marketConfig.country})
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <span className="text-neutral-500 block mb-0.5">Lô giao dịch</span>
            <span className="text-neutral-300">{marketConfig.rules.lotSize} cổ phiếu</span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Bán khống (Short)</span>
            <span className={marketConfig.rules.allowShort ? 'text-emerald-400' : 'text-neutral-400'}>
              {marketConfig.rules.allowShort ? 'Cho phép' : 'Không hỗ trợ'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Đòn bẩy tối đa</span>
            <span className="text-amber-400 font-bold">{marketConfig.rules.maxLeverage}x</span>
          </div>
          <div>
            <span className="text-neutral-500 block mb-0.5">Biên độ ngày</span>
            <span className="text-neutral-300">
              {marketConfig.rules.priceBandPercent ? `±${(marketConfig.rules.priceBandPercent * 100).toFixed(0)}%` : 'Tự do'}
            </span>
          </div>
        </div>
      </div>

      {/* Order Modal Drawer */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3">
          <TradingTerminalOrderPanel
            instrument={instrument}
            portfolio={portfolio}
            marketConfig={marketConfig}
            feeConfig={feeConfig}
            activeTier={selectedTier}
            onTierChange={(t) => setSelectedTier(t)}
            onSubmitOrder={onSubmitOrder}
            onClose={() => setOrderModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
