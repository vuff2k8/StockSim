import { Instrument, MarketConfig } from '../../types/market';
import { MarketIndexState, SimulationEvent } from '../../types/simulation';
import { SeededRandom } from '../../utils/seedRandom';
import { EventEngine } from '../simulation/EventEngine';
import { PriceEngine } from '../simulation/PriceEngine';
import { IndexEngine } from './IndexEngine';

export interface MarketEngineStepResult {
  instruments: Record<string, Instrument>;
  marketIndex: MarketIndexState;
  events: SimulationEvent[];
  activeEvents: SimulationEvent[];
  sectorTrends: Record<string, number>;
}

export class MarketEngine {
  private sectorDrifts: Record<string, number> = {};

  /**
   * Performs one simulation tick across market components
   */
  public step(
    instruments: Record<string, Instrument>,
    marketIndex: MarketIndexState,
    marketConfig: MarketConfig,
    activeEvents: SimulationEvent[],
    allEvents: SimulationEvent[],
    rng: SeededRandom,
    tickTimestamp: string,
    isNewDay: boolean
  ): MarketEngineStepResult {
    // 1. Update active simulation events
    const { updatedActive } = EventEngine.updateActiveEvents(activeEvents);

    // 2. Potentially trigger a new simulation event
    const newEvent = EventEngine.maybeTriggerEvent(rng, tickTimestamp, marketConfig.id, updatedActive.length);
    const currentActive = newEvent ? [...updatedActive, newEvent] : updatedActive;
    const currentAllEvents = newEvent ? [newEvent, ...allEvents].slice(0, 50) : allEvents;

    // 3. Compute macro market trend and sector drifts
    // Macro drift swings gently between -0.005 and +0.005 with Gaussian noise
    const macroTrend = rng.nextGaussian() * 0.002;

    // Evolve sector drifts
    const sectors = new Set<string>();
    for (const inst of Object.values(instruments)) {
      if (inst.sector) sectors.add(inst.sector);
    }

    for (const sector of sectors) {
      const prevDrift = this.sectorDrifts[sector] || 0;
      // Drift evolves with mean reversion toward 0
      const nextDrift = prevDrift * 0.9 + rng.nextGaussian() * 0.003;
      this.sectorDrifts[sector] = Math.max(-0.03, Math.min(0.03, nextDrift));
    }

    // 4. Step instrument prices deterministically
    const nextInstruments = PriceEngine.stepPrices({
      instruments,
      marketTrend: macroTrend,
      sectorTrends: this.sectorDrifts,
      activeEvents: currentActive,
      rng,
      tickTimestamp,
      isNewDay,
    });

    // 5. Update market index based on simulated instrument universe
    const nextMarketIndex = IndexEngine.calculateIndex(
      marketIndex,
      nextInstruments,
      marketConfig.baseIndexValue,
      tickTimestamp
    );

    return {
      instruments: nextInstruments,
      marketIndex: nextMarketIndex,
      events: currentAllEvents,
      activeEvents: currentActive,
      sectorTrends: { ...this.sectorDrifts },
    };
  }
}
