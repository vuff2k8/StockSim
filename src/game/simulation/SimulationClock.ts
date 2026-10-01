import { SimulationClockState, SimulationSpeed } from '../../types/simulation';
import { MarketConfig } from '../../types/market';
import { MarketSessionState } from '../../types/session';
import { MarketSessionEngine } from '../session/MarketSessionEngine';

export class SimulationClock {
  /**
   * Authoritative lookup of MarketSessionState for this clock state
   */
  public static getSessionState(
    state: SimulationClockState,
    marketConfigOrId: MarketConfig | string
  ): MarketSessionState {
    return MarketSessionEngine.getSessionState(marketConfigOrId, state.currentTimestamp);
  }

  /**
   * Generates initial clock state from an ISO starting timestamp
   */
  public static createInitialState(sourceIsoTimestamp: string): SimulationClockState {
    const date = new Date(sourceIsoTimestamp);
    // Align time to 09:15:00 if it was evening or weekend for continuous market trading feel
    date.setUTCHours(9, 15, 0, 0);

    return {
      currentTimestamp: date.getTime(),
      displayDate: date.toISOString().slice(0, 10),
      displayTime: date.toISOString().slice(11, 19),
      speed: 1,
      isPaused: true,
      totalTicks: 0,
    };
  }

  /**
   * Advances the clock by a single tick based on active speed
   * Base tick = 3 minutes of simulated time
   */
  public static tick(state: SimulationClockState): {
    nextClock: SimulationClockState;
    isNewDay: boolean;
    minutesAdvanced: number;
  } {
    if (state.isPaused || state.speed === 0) {
      return { nextClock: state, isNewDay: false, minutesAdvanced: 0 };
    }

    // Minutes advance per real-world loop based on speed
    const baseMinutes = 3;
    const minutesAdvanced = baseMinutes * state.speed;
    const advanceMs = minutesAdvanced * 60 * 1000;

    const prevDate = new Date(state.currentTimestamp);
    const prevDay = prevDate.getUTCDate();

    const nextTimestamp = state.currentTimestamp + advanceMs;
    const nextDate = new Date(nextTimestamp);
    const isNewDay = nextDate.getUTCDate() !== prevDay;

    return {
      nextClock: {
        ...state,
        currentTimestamp: nextTimestamp,
        displayDate: nextDate.toISOString().slice(0, 10),
        displayTime: nextDate.toISOString().slice(11, 19),
        totalTicks: state.totalTicks + 1,
      },
      isNewDay,
      minutesAdvanced,
    };
  }

  /**
   * Jumps simulation time forward by a specific duration (1 hour, 1 day, 1 week, 1 month)
   */
  public static advanceByMilliseconds(
    state: SimulationClockState,
    ms: number
  ): {
    nextClock: SimulationClockState;
    isNewDay: boolean;
    ticksSimulated: number;
  } {
    const prevDate = new Date(state.currentTimestamp);
    const prevDay = prevDate.getUTCDate();

    const nextTimestamp = state.currentTimestamp + ms;
    const nextDate = new Date(nextTimestamp);
    const isNewDay = nextDate.getUTCDate() !== prevDay;

    // Estimate equivalent ticks (assuming 3 min/tick)
    const ticksSimulated = Math.max(1, Math.min(60, Math.floor(ms / (3 * 60 * 1000))));

    return {
      nextClock: {
        ...state,
        currentTimestamp: nextTimestamp,
        displayDate: nextDate.toISOString().slice(0, 10),
        displayTime: nextDate.toISOString().slice(11, 19),
        totalTicks: state.totalTicks + ticksSimulated,
      },
      isNewDay,
      ticksSimulated,
    };
  }

  public static advance1Hour(state: SimulationClockState) {
    return this.advanceByMilliseconds(state, 60 * 60 * 1000);
  }

  public static advance1Day(state: SimulationClockState) {
    return this.advanceByMilliseconds(state, 24 * 60 * 60 * 1000);
  }

  public static advance1Week(state: SimulationClockState) {
    return this.advanceByMilliseconds(state, 7 * 24 * 60 * 60 * 1000);
  }

  public static advance1Month(state: SimulationClockState) {
    return this.advanceByMilliseconds(state, 30 * 24 * 60 * 60 * 1000);
  }
}
