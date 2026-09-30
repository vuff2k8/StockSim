import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { Instrument } from '../types/market';
import { MarketDepthEngine } from '../game/market/MarketDepthEngine';
import { formatCurrency, formatStockPrice, formatVolume } from '../utils/formatters';

interface MarketDepthWidgetProps {
  instrument: Instrument;
}

export const MarketDepthWidget: React.FC<MarketDepthWidgetProps> = ({ instrument }) => {
  const orderBook = useMemo(() => {
    return MarketDepthEngine.generateOrderBook(instrument, 5);
  }, [instrument.symbol, instrument.currentPrice, instrument.volume]);

  const maxTotal = Math.max(
    orderBook.bids[orderBook.bids.length - 1]?.total || 1,
    orderBook.asks[orderBook.asks.length - 1]?.total || 1
  );

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            SỔ LỆNH KHỚP (SIMULATED DEPTH)
          </h3>
        </div>
        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-semibold">
          SIMULATION
        </span>
      </div>

      {/* Mid Price & Spread Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-neutral-950 rounded-lg text-xs font-mono">
        <div className="text-neutral-400">
          Chênh lệch (Spread):{' '}
          <span className="text-neutral-200 font-semibold">
            {formatStockPrice(orderBook.spread, instrument.currency)}
          </span>
        </div>
        <div className="text-neutral-400">
          Giá trung vị:{' '}
          <span className="text-white font-bold">
            {formatStockPrice(orderBook.midPrice, instrument.currency)}
          </span>
        </div>
      </div>

      {/* Asks (Sell Orders) descending */}
      <div className="space-y-1">
        <div className="grid grid-cols-3 text-[10px] uppercase font-mono text-neutral-500 px-1">
          <span>Giá Bán</span>
          <span className="text-right">Khối lượng</span>
          <span className="text-right">Tích lũy</span>
        </div>

        {orderBook.asks
          .slice()
          .reverse()
          .map((ask, idx) => {
            const widthPct = Math.min(100, (ask.total / maxTotal) * 100);
            return (
              <div
                key={`ask-${idx}`}
                className="relative grid grid-cols-3 text-xs font-mono py-0.5 px-1 rounded overflow-hidden"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none"
                  style={{ width: `${widthPct}%` }}
                />
                <span className="text-rose-400 font-semibold relative z-10">
                  {formatStockPrice(ask.price, instrument.currency)}
                </span>
                <span className="text-right text-neutral-300 relative z-10">
                  {formatVolume(ask.quantity)}
                </span>
                <span className="text-right text-neutral-500 relative z-10">
                  {formatVolume(ask.total)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Bids (Buy Orders) ascending */}
      <div className="space-y-1 pt-1 border-t border-neutral-800/60">
        <div className="grid grid-cols-3 text-[10px] uppercase font-mono text-neutral-500 px-1">
          <span>Giá Mua</span>
          <span className="text-right">Khối lượng</span>
          <span className="text-right">Tích lũy</span>
        </div>

        {orderBook.bids.map((bid, idx) => {
          const widthPct = Math.min(100, (bid.total / maxTotal) * 100);
          return (
            <div
              key={`bid-${idx}`}
              className="relative grid grid-cols-3 text-xs font-mono py-0.5 px-1 rounded overflow-hidden"
            >
              <div
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                style={{ width: `${widthPct}%` }}
              />
              <span className="text-emerald-400 font-semibold relative z-10">
                {formatStockPrice(bid.price, instrument.currency)}
              </span>
              <span className="text-right text-neutral-300 relative z-10">
                {formatVolume(bid.quantity)}
              </span>
              <span className="text-right text-neutral-500 relative z-10">
                {formatVolume(bid.total)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-neutral-500 text-center pt-1 font-mono">
        Thanh khoản sổ lệnh ước tính: {formatCurrency(orderBook.estimatedLiquidity, instrument.currency, { compact: true })}
      </div>
    </div>
  );
};
