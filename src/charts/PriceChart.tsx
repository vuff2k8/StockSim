import React, { useState, useMemo } from 'react';
import { Candle } from '../types/market';
import { formatStockPrice, formatVolume } from '../utils/formatters';

interface PriceChartProps {
  candles: Candle[];
  currency: string;
  symbol: string;
  currentPrice: number;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M';

const PriceChartComponent: React.FC<PriceChartProps> = ({ candles, currency, symbol, currentPrice }) => {
  const [range, setRange] = useState<TimeRange>('1M');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Filter candles based on range
  const filteredCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    let count = 30;
    if (range === '1D') count = 8;
    else if (range === '1W') count = 14;
    else if (range === '1M') count = 30;
    else if (range === '3M') count = 60;
    return candles.slice(-count);
  }, [candles, range]);

  // Compute scale boundaries
  const { minPrice, maxPrice, maxVolume, priceRange } = useMemo(() => {
    if (filteredCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVolume: 1000, priceRange: 100 };
    }
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    for (const c of filteredCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    // Add 2% padding
    const padding = (max - min) * 0.05 || max * 0.02 || 1;
    const boundedMin = Math.max(0, min - padding);
    const boundedMax = max + padding;
    return {
      minPrice: boundedMin,
      maxPrice: boundedMax,
      maxVolume: maxVol || 1,
      priceRange: boundedMax - boundedMin || 1,
    };
  }, [filteredCandles]);

  const svgWidth = 800;
  const svgHeight = 280;
  const chartHeight = 200;
  const volumeHeight = 60;
  const volumeTop = 220;

  const candleWidth = useMemo(() => {
    if (filteredCandles.length === 0) return 10;
    return Math.max(4, Math.min(24, (svgWidth / filteredCandles.length) * 0.65));
  }, [filteredCandles.length]);

  const activeCandle = hoveredCandle || (filteredCandles.length > 0 ? filteredCandles[filteredCandles.length - 1] : null);
  const isUp = activeCandle ? activeCandle.close >= activeCandle.open : true;

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 md:p-4 backdrop-blur-sm">
      {/* Chart Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-neutral-800/80">
        <div>
          <div className="text-xs text-neutral-400 font-medium">
            {activeCandle ? (
              <span className="flex items-center gap-2">
                <span>{new Date(activeCandle.timestamp).toLocaleDateString('vi-VN')}</span>
                <span className="text-neutral-600">·</span>
                <span>Mở: <span className="font-mono text-neutral-200">{formatStockPrice(activeCandle.open, currency)}</span></span>
                <span className="text-neutral-600">·</span>
                <span>Cao: <span className="font-mono text-emerald-400">{formatStockPrice(activeCandle.high, currency)}</span></span>
                <span className="text-neutral-600">·</span>
                <span>Thấp: <span className="font-mono text-rose-400">{formatStockPrice(activeCandle.low, currency)}</span></span>
                <span className="text-neutral-600">·</span>
                <span>KL: <span className="font-mono text-neutral-200">{formatVolume(activeCandle.volume)}</span></span>
              </span>
            ) : (
              'Biểu đồ giá mô phỏng'
            )}
          </div>
        </div>

        {/* Timeframe Selector (Segmented buttons) */}
        <div className="flex items-center p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
          {(['1D', '1W', '1M', '3M'] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => setRange(t)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                range === t
                  ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 md:h-64 overflow-visible"
          onMouseLeave={() => setHoveredCandle(null)}
        >
          {/* Background Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = chartHeight * (1 - pct);
            const priceVal = minPrice + priceRange * pct;
            return (
              <g key={idx}>
                <line
                  x1={0}
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="#262626"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                />
                <text
                  x={svgWidth - 4}
                  y={y - 4}
                  fill="#737373"
                  fontSize="10"
                  textAnchor="end"
                  className="font-mono"
                >
                  {formatStockPrice(priceVal, currency)}
                </text>
              </g>
            );
          })}

          {/* Volume Baseline Grid */}
          <line
            x1={0}
            y1={volumeTop}
            x2={svgWidth}
            y2={volumeTop}
            stroke="#262626"
            strokeWidth={0.8}
          />
          <text x={svgWidth - 4} y={volumeTop - 4} fill="#525252" fontSize="9" textAnchor="end" className="font-mono">
            Khối lượng
          </text>

          {/* Candlesticks & Volume Bars */}
          {filteredCandles.map((c, i) => {
            const x = (i + 0.5) * (svgWidth / filteredCandles.length);
            const openY = chartHeight - ((c.open - minPrice) / priceRange) * chartHeight;
            const closeY = chartHeight - ((c.close - minPrice) / priceRange) * chartHeight;
            const highY = chartHeight - ((c.high - minPrice) / priceRange) * chartHeight;
            const lowY = chartHeight - ((c.low - minPrice) / priceRange) * chartHeight;

            const isCandleUp = c.close >= c.open;
            const candleColor = isCandleUp ? '#10b981' : '#f43f5e';
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            // Volume bar
            const volHeight = (c.volume / maxVolume) * volumeHeight;
            const volY = svgHeight - volHeight;

            return (
              <g
                key={i}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={() => setHoveredCandle(c)}
                onTouchStart={() => setHoveredCandle(c)}
              >
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth={1.5}
                />

                {/* Candle Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={candleColor}
                  rx={1}
                />

                {/* Volume Bar */}
                <rect
                  x={x - candleWidth / 2}
                  y={volY}
                  width={candleWidth}
                  height={volHeight}
                  fill={candleColor}
                  opacity={0.35}
                  rx={1}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const PriceChart = React.memo<PriceChartProps>(PriceChartComponent);
