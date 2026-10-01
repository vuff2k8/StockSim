import { Instrument, MarketConfig } from '../../types/market';
import { MarketIndexState, SimulationEvent } from '../../types/simulation';
import { SeededRandom } from '../../utils/seedRandom';
import { EventEngine } from '../simulation/EventEngine';
import { IndexEngine } from './IndexEngine';
import { NumericMarketState } from '../numeric/NumericMarketState';
import { MarketSessionEngine } from '../session/MarketSessionEngine';

export interface MarketEngineStepResult {
  instruments: Record<string, Instrument>;
  marketIndex: MarketIndexState;
  events: SimulationEvent[];
  activeEvents: SimulationEvent[];
  sectorTrends: Record<string, number>;
}

export class MarketEngine {
  private numericState: NumericMarketState | null = null;
  private lastInstrumentKeyCount: number = 0;

  /**
   * Performs one simulation tick using dense numeric Structure-of-Arrays
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
    // 0. Check authoritative MarketSessionState
    const sessionState = MarketSessionEngine.getSessionState(marketConfig, tickTimestamp);

    // 1. Update active simulation events
    const { updatedActive } = EventEngine.updateActiveEvents(activeEvents);

    // 2. Potentially trigger a new simulation event
    const newEvent = EventEngine.maybeTriggerEvent(rng, tickTimestamp, marketConfig.id, updatedActive.length);
    const currentActive = newEvent ? [...updatedActive, newEvent] : updatedActive;
    const currentAllEvents = newEvent ? [newEvent, ...allEvents].slice(0, 50) : allEvents;

    // 3. Compute macro market trend
    const macroTrend = rng.nextGaussian() * 0.002;

    // 4. Ensure NumericMarketState is initialized
    const symCount = Object.keys(instruments).length;
    if (!this.numericState || this.lastInstrumentKeyCount !== symCount) {
      this.numericState = new NumericMarketState(instruments);
      this.lastInstrumentKeyCount = symCount;
    }

    // If market is CLOSED or non-tradable break, do not drift intraday prices
    if (!sessionState.isTradable) {
      if (isNewDay) {
        this.numericState.resetDayBaseline();
      }
      const nextInstruments = this.numericState.toRecord();
      return {
        instruments: nextInstruments,
        marketIndex,
        events: currentAllEvents,
        activeEvents: currentActive,
        sectorTrends: {},
      };
    }

    // Step prices using dense typed arrays during tradable sessions
    const tickMs = new Date(tickTimestamp).getTime();
    this.numericState.stepPrices(macroTrend, currentActive, rng, tickMs, isNewDay);

    const nextInstruments = this.numericState.toRecord();

    // 5. Update market index based on simulated instrument universe
    const nextMarketIndex = IndexEngine.calculateIndex(
      marketIndex,
      nextInstruments,
      marketConfig.baseIndexValue,
      tickTimestamp
    );

    // Extract sector drifts for telemetry
    const sectorTrends: Record<string, number> = {};
    for (let s = 0; s < this.numericState.sectorNames.length; s++) {
      sectorTrends[this.numericState.sectorNames[s]] = this.numericState.sectorDrifts[s];
    }

    return {
      instruments: nextInstruments,
      marketIndex: nextMarketIndex,
      events: currentAllEvents,
      activeEvents: currentActive,
      sectorTrends,
    };
  }

  public getNumericState(): NumericMarketState | null {
    return this.numericState;
  }
}
