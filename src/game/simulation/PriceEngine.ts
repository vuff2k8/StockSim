import { Candle, Instrument } from '../../types/market';
import { SimulationEvent } from '../../types/simulation';
import { SeededRandom } from '../../utils/seedRandom';

export interface PriceEngineParams {
  instruments: Record<string, Instrument>;
  marketTrend: number; // e.g. -0.01 to +0.01
  sectorTrends: Record<string, number>;
  activeEvents: SimulationEvent[];
  rng: SeededRandom;
  tickTimestamp: string;
  isNewDay?: boolean;
}

export class PriceEngine {
  /**
   * Deterministically calculate the next price state for all instruments
   */
  public static stepPrices(params: PriceEngineParams): Record<string, Instrument> {
    const { instruments, marketTrend, sectorTrends, activeEvents, rng, tickTimestamp, isNewDay } = params;
    const updated: Record<string, Instrument> = {};

    for (const [symbol, inst] of Object.entries(instruments)) {
      // 1. Market factor scaled by stock beta
      const marketFactor = marketTrend * inst.beta;

      // 2. Sector factor
      const sectorDrift = sectorTrends[inst.sector] || 0;
      const sectorSensitivity = inst.style === 'Defensive' ? 0.6 : inst.style === 'Growth' ? 1.3 : 1.0;
      const sectorFactor = sectorDrift * sectorSensitivity;

      // 3. Momentum factor (momentum persists with damping)
      const momentumFactor = inst.momentum * 0.2;

      // 4. Mean reversion factor toward previous close
      const pctFromPrevClose = inst.previousClose > 0 
        ? (inst.currentPrice - inst.previousClose) / inst.previousClose 
        : 0;
      const meanReversionFactor = -0.04 * pctFromPrevClose;

      // 5. Liquidity factor (less liquid stocks suffer higher price impact / noise)
      const liquidityFactor = (1 - inst.liquidity) * rng.nextGaussian() * inst.volatility * 0.4;

      // 6. Volatility & random noise (Box-Muller gaussian)
      const noiseVariance = inst.style === 'High-Beta' ? 1.4 : inst.style === 'Defensive' ? 0.7 : 1.0;
      const randomNoise = rng.nextGaussian() * inst.volatility * 0.6 * noiseVariance;

      // 7. Event impact
      let eventFactor = 0;
      for (const ev of activeEvents) {
        if (!ev.affectedMarket || ev.affectedMarket === inst.market) {
          if (!ev.affectedSector || ev.affectedSector === inst.sector) {
            // High-beta stocks amplify events, defensive stocks dampen
            const eventMultiplier = inst.style === 'High-Beta' ? 1.5 : inst.style === 'Defensive' ? 0.5 : 1.0;
            eventFactor += ev.impact * 0.15 * eventMultiplier;
          }
        }
      }

      // Total return for this step
      const stepReturn = marketFactor + sectorFactor + momentumFactor + meanReversionFactor + liquidityFactor + randomNoise + eventFactor;

      // New price calculation
      let newPrice = inst.currentPrice * (1 + stepReturn);

      // Sanity checks and price floor
      const minPrice = inst.currency === 'VND' ? 100 : 0.01;
      if (newPrice < minPrice) newPrice = minPrice;

      // Market-specific price limits:
      // In Vietnam (HOSE), daily price limit is ±7% of reference price (previous close)
      if (inst.market === 'vietnam') {
        const ceiling = Math.floor(inst.previousClose * 1.07);
        const floor = Math.ceil(inst.previousClose * 0.93);
        if (newPrice > ceiling) newPrice = ceiling;
        if (newPrice < floor) newPrice = floor;
        newPrice = Math.round(newPrice / 10) * 10; // Round to nearest 10 or 50 VND
      } else {
        newPrice = Number(newPrice.toFixed(2));
      }

      // Volume pressure and activity
      const baseTickVolume = inst.volume > 0 ? Math.floor(inst.volume * 0.01) : 1000;
      const volatilityVolumeMultiplier = 1 + Math.abs(stepReturn) * 20;
      const tickVolume = Math.floor(baseTickVolume * volatilityVolumeMultiplier * (0.8 + rng.next() * 0.4));
      const accumulatedVolume = (isNewDay ? 0 : inst.volume) + tickVolume;

      // Day High / Low
      const dayHigh = isNewDay ? newPrice : Math.max(inst.dayHigh, newPrice);
      const dayLow = isNewDay ? newPrice : Math.min(inst.dayLow, newPrice);
      const openPrice = isNewDay ? newPrice : inst.openPrice;
      const previousClose = isNewDay ? inst.currentPrice : inst.previousClose;

      // Update momentum for next step with decay and new return impulse
      const newMomentum = inst.momentum * 0.85 + stepReturn * 0.15;

      // Update history candles
      const updatedHistory = [...inst.history];
      if (updatedHistory.length === 0 || isNewDay) {
        // Create new daily candle
        updatedHistory.push({
          timestamp: tickTimestamp,
          open: openPrice,
          high: dayHigh,
          low: dayLow,
          close: newPrice,
          volume: accumulatedVolume,
        });
      } else {
        // Update current candle
        const lastIndex = updatedHistory.length - 1;
        const lastCandle = updatedHistory[lastIndex];
        updatedHistory[lastIndex] = {
          ...lastCandle,
          high: Math.max(lastCandle.high, newPrice),
          low: Math.min(lastCandle.low, newPrice),
          close: newPrice,
          volume: accumulatedVolume,
        };
      }

      // Keep up to 60 candles in memory for performance
      if (updatedHistory.length > 60) {
        updatedHistory.shift();
      }

      updated[symbol] = {
        ...inst,
        currentPrice: newPrice,
        previousClose,
        openPrice,
        dayHigh,
        dayLow,
        volume: accumulatedVolume,
        momentum: newMomentum,
        history: updatedHistory,
      };
    }

    return updated;
  }
}
