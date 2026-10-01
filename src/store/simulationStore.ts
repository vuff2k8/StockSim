/**
 * Ultra-fast external state store with selective subscriptions using useSyncExternalStore.
 * Decouples the simulation hot loop from React component tree renders.
 */
import { useSyncExternalStore, useCallback } from 'react';
import { WorldState } from '../types/world';
import { Instrument } from '../types/market';
import { Portfolio } from '../types/portfolio';
import { Order, Transaction } from '../types/order';
import { MarketIndexState, SimulationClockState, SimulationEvent } from '../types/simulation';
import { UiSettings } from '../types/ui';

type Listener = () => void;

class SimulationStore {
  private state: WorldState | null = null;
  private stateVersion: number = 0;

  // Granular subscription sets
  private allListeners = new Set<Listener>();
  private clockListeners = new Set<Listener>();
  private portfolioListeners = new Set<Listener>();
  private instrumentListeners = new Map<string, Set<Listener>>();
  private marketListListeners = new Set<Listener>();
  private orderListeners = new Set<Listener>();
  private eventListeners = new Set<Listener>();
  private indexListeners = new Set<Listener>();
  private uiListeners = new Set<Listener>();

  public setState(nextState: WorldState | ((prev: WorldState | null) => WorldState | null)): void {
    const prev = this.state;
    const next = typeof nextState === 'function' ? nextState(prev) : nextState;
    if (!next) {
      this.state = null;
      this.notifyAll();
      return;
    }

    this.state = next;
    this.stateVersion++;

    // Granular change detection
    if (!prev) {
      this.notifyAll();
      return;
    }

    // 1. Clock changed
    if (prev.clock.currentTimestamp !== next.clock.currentTimestamp || prev.clock.isPaused !== next.clock.isPaused || prev.clock.speed !== next.clock.speed) {
      this.notifySet(this.clockListeners);
    }

    // 2. Portfolio changed
    if (prev.portfolio !== next.portfolio) {
      this.notifySet(this.portfolioListeners);
    }

    // 3. Open orders / history changed
    if (prev.openOrders !== next.openOrders || prev.orderHistory !== next.orderHistory) {
      this.notifySet(this.orderListeners);
    }

    // 4. Market Index changed
    if (prev.marketIndex.value !== next.marketIndex.value) {
      this.notifySet(this.indexListeners);
    }

    // 5. Events changed
    if (prev.events !== next.events || prev.activeEvents !== next.activeEvents) {
      this.notifySet(this.eventListeners);
    }

    // 6. UI settings changed
    if (prev.uiSettings !== next.uiSettings) {
      this.notifySet(this.uiListeners);
    }

    // 7. Individual instruments changed
    if (prev.instruments !== next.instruments) {
      this.notifySet(this.marketListListeners);
      for (const [sym, set] of this.instrumentListeners.entries()) {
        if (prev.instruments[sym] !== next.instruments[sym]) {
          this.notifySet(set);
        }
      }
    }

    this.notifySet(this.allListeners);
  }

  public getState(): WorldState | null {
    return this.state;
  }

  public getVersion(): number {
    return this.stateVersion;
  }

  // --- Subscriptions ---
  public subscribeAll(listener: Listener): () => void {
    this.allListeners.add(listener);
    return () => this.allListeners.delete(listener);
  }

  public subscribeClock(listener: Listener): () => void {
    this.clockListeners.add(listener);
    return () => this.clockListeners.delete(listener);
  }

  public subscribePortfolio(listener: Listener): () => void {
    this.portfolioListeners.add(listener);
    return () => this.portfolioListeners.delete(listener);
  }

  public subscribeMarketList(listener: Listener): () => void {
    this.marketListListeners.add(listener);
    return () => this.marketListListeners.delete(listener);
  }

  public subscribeInstrument(symbol: string, listener: Listener): () => void {
    if (!this.instrumentListeners.has(symbol)) {
      this.instrumentListeners.set(symbol, new Set());
    }
    this.instrumentListeners.get(symbol)!.add(listener);
    return () => {
      const set = this.instrumentListeners.get(symbol);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.instrumentListeners.delete(symbol);
      }
    };
  }

  public subscribeOrders(listener: Listener): () => void {
    this.orderListeners.add(listener);
    return () => this.orderListeners.delete(listener);
  }

  public subscribeEvents(listener: Listener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public subscribeIndex(listener: Listener): () => void {
    this.indexListeners.add(listener);
    return () => this.indexListeners.delete(listener);
  }

  public subscribeUi(listener: Listener): () => void {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }

  private notifySet(listeners: Set<Listener>): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Store listener error', err);
      }
    }
  }

  private notifyAll(): void {
    this.notifySet(this.allListeners);
    this.notifySet(this.clockListeners);
    this.notifySet(this.portfolioListeners);
    this.notifySet(this.marketListListeners);
    this.notifySet(this.orderListeners);
    this.notifySet(this.eventListeners);
    this.notifySet(this.indexListeners);
    this.notifySet(this.uiListeners);
    for (const set of this.instrumentListeners.values()) {
      this.notifySet(set);
    }
  }
}

export const simulationStore = new SimulationStore();

// --- Selective React Hooks ---

export function useWorldState(): WorldState | null {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeAll(cb),
    () => simulationStore.getState()
  );
}

export function useSimulationClock(): SimulationClockState | null {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeClock(cb),
    () => simulationStore.getState()?.clock ?? null
  );
}

export function usePortfolio(): Portfolio | null {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribePortfolio(cb),
    () => simulationStore.getState()?.portfolio ?? null
  );
}

export function useMarketIndex(): MarketIndexState | null {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeIndex(cb),
    () => simulationStore.getState()?.marketIndex ?? null
  );
}

export function useInstruments(): Record<string, Instrument> | null {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeMarketList(cb),
    () => simulationStore.getState()?.instruments ?? null
  );
}

export function useInstrument(symbol: string): Instrument | null {
  const subscribe = useCallback(
    (cb: Listener) => simulationStore.subscribeInstrument(symbol, cb),
    [symbol]
  );
  return useSyncExternalStore(
    subscribe,
    () => simulationStore.getState()?.instruments[symbol] ?? null
  );
}

export function useOpenOrders(): Order[] {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeOrders(cb),
    () => simulationStore.getState()?.openOrders ?? []
  );
}

export function useOrderHistory(): Order[] {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeOrders(cb),
    () => simulationStore.getState()?.orderHistory ?? []
  );
}

export function useSimulationEvents(): SimulationEvent[] {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeEvents(cb),
    () => simulationStore.getState()?.events ?? []
  );
}

export function useUiSettings(): UiSettings | undefined {
  return useSyncExternalStore(
    (cb) => simulationStore.subscribeUi(cb),
    () => simulationStore.getState()?.uiSettings
  );
}
