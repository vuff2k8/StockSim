/**
 * High-performance circular ring buffer for historical OHLCV candle data.
 * Backed by continuous Float64Arrays to avoid GC churn and array copying.
 */
import { Candle } from '../../types/market';

export class CandleRingBuffer {
  public readonly capacity: number;
  private head: number = 0; // Index of the next write position
  public count: number = 0; // Number of valid candles stored

  // Structure-of-Arrays typed buffers
  public readonly timestamps: Float64Array; // Epoch milliseconds
  public readonly opens: Float64Array;
  public readonly highs: Float64Array;
  public readonly lows: Float64Array;
  public readonly closes: Float64Array;
  public readonly volumes: Float64Array;

  // Cached presentation candles (invalidated on mutation)
  private cachedCandles: Candle[] | null = null;

  constructor(capacity: number = 60) {
    this.capacity = capacity;
    this.timestamps = new Float64Array(capacity);
    this.opens = new Float64Array(capacity);
    this.highs = new Float64Array(capacity);
    this.lows = new Float64Array(capacity);
    this.closes = new Float64Array(capacity);
    this.volumes = new Float64Array(capacity);
  }

  /**
   * Pushes a new candle into the circular buffer. Overwrites oldest when full.
   */
  public push(
    timestampMs: number,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
  ): void {
    const idx = this.head;
    this.timestamps[idx] = timestampMs;
    this.opens[idx] = open;
    this.highs[idx] = high;
    this.lows[idx] = low;
    this.closes[idx] = close;
    this.volumes[idx] = volume;

    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
    this.cachedCandles = null; // Invalidate cache
  }

  /**
   * In-place update of the most recent candle (hot path during continuous session ticks)
   */
  public updateLatest(high: number, low: number, close: number, volume: number): void {
    if (this.count === 0) return;
    const latestIdx = (this.head - 1 + this.capacity) % this.capacity;
    if (high > this.highs[latestIdx]) this.highs[latestIdx] = high;
    if (low < this.lows[latestIdx]) this.lows[latestIdx] = low;
    this.closes[latestIdx] = close;
    this.volumes[latestIdx] = volume;
    this.cachedCandles = null;
  }

  /**
   * Returns the latest candle close price
   */
  public getLatestClose(): number {
    if (this.count === 0) return 0;
    const latestIdx = (this.head - 1 + this.capacity) % this.capacity;
    return this.closes[latestIdx];
  }

  /**
   * Converts ring buffer contents to an array of Candle objects in chronological order.
   * Caches result until next mutation to avoid allocating UI objects on every read.
   */
  public toArray(): Candle[] {
    if (this.cachedCandles && this.cachedCandles.length === this.count) {
      return this.cachedCandles;
    }

    const result: Candle[] = new Array(this.count);
    const startIdx = this.count < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (startIdx + i) % this.capacity;
      const ts = this.timestamps[idx];
      result[i] = {
        timestamp: new Date(ts).toISOString(),
        open: this.opens[idx],
        high: this.highs[idx],
        low: this.lows[idx],
        close: this.closes[idx],
        volume: this.volumes[idx],
      };
    }

    this.cachedCandles = result;
    return result;
  }

  /**
   * Initializes buffer from an existing Candle array (used during World initialization)
   */
  public loadFromCandles(candles: Candle[]): void {
    this.count = 0;
    this.head = 0;
    const start = Math.max(0, candles.length - this.capacity);
    for (let i = start; i < candles.length; i++) {
      const c = candles[i];
      const ts = typeof c.timestamp === 'string' ? new Date(c.timestamp).getTime() : (c.timestamp as any);
      this.push(ts, c.open, c.high, c.low, c.close, c.volume);
    }
  }

  /**
   * Fast clone of buffer
   */
  public clone(): CandleRingBuffer {
    const copy = new CandleRingBuffer(this.capacity);
    copy.head = this.head;
    copy.count = this.count;
    copy.timestamps.set(this.timestamps);
    copy.opens.set(this.opens);
    copy.highs.set(this.highs);
    copy.lows.set(this.lows);
    copy.closes.set(this.closes);
    copy.volumes.set(this.volumes);
    return copy;
  }
}
