import { WorldState } from '../../types/world';
import { WorldManager } from '../world/WorldManager';
import { MarketEngine } from '../market/MarketEngine';
import { SeededRandom } from '../../utils/seedRandom';
import { PerformanceMetrics } from '../../types/ui';

export type StateGetter = () => WorldState | null;
export type StateSetter = (updater: (prev: WorldState) => WorldState) => void;

export class SimulationScheduler {
  private static instance: SimulationScheduler | null = null;

  private timerId: any = null;
  private animFrameId: any = null;
  private isRunning: boolean = false;

  private getState: StateGetter | null = null;
  private setState: StateSetter | null = null;
  private marketEngine: MarketEngine = new MarketEngine();
  private rng: SeededRandom = new SeededRandom(123456789);

  // Performance telemetry
  private lastTickTime: number = performance.now();
  private tickCountInWindow: number = 0;
  private lastTpsCalculationTime: number = performance.now();
  private currentTps: number = 0;
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 60;
  private lastDurationMs: number = 0;

  public static getInstance(): SimulationScheduler {
    if (!SimulationScheduler.instance) {
      SimulationScheduler.instance = new SimulationScheduler();
    }
    return SimulationScheduler.instance;
  }

  public init(getState: StateGetter, setState: StateSetter, seed: number) {
    this.stop();
    this.getState = getState;
    this.setState = setState;
    this.rng = new SeededRandom(seed);
    this.startPerformanceMonitor();
  }

  public start() {
    this.stop(); // Enforce single active timer invariant
    this.isRunning = true;
    this.scheduleNextTick();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public pause() {
    if (this.setState) {
      this.setState((prev) => ({
        ...prev,
        clock: { ...prev.clock, isPaused: true },
      }));
    }
    this.stop();
  }

  public resume() {
    if (this.setState) {
      this.setState((prev) => ({
        ...prev,
        clock: { ...prev.clock, isPaused: false },
      }));
    }
    this.start();
  }

  public setSpeed(speed: number) {
    if (this.setState) {
      this.setState((prev) => ({
        ...prev,
        clock: { ...prev.clock, speed: speed as any, isPaused: speed === 0 },
      }));
    }
    if (speed > 0) {
      this.start();
    } else {
      this.stop();
    }
  }

  private scheduleNextTick() {
    if (!this.isRunning || !this.getState || !this.setState) return;

    const state = this.getState();
    if (!state || state.clock.isPaused || state.clock.speed === 0) {
      this.stop();
      return;
    }

    const speed = state.clock.speed;

    // Normal speeds: smooth cadence (1x, 2x, 5x, 10x)
    // High speeds: batch internally (50x, 100x)
    let delayMs = 300;
    let batchSteps = 1;

    if (speed === 1) delayMs = 600;
    else if (speed === 2) delayMs = 400;
    else if (speed === 5) delayMs = 250;
    else if (speed === 10) delayMs = 150;
    else if (speed === 50) {
      delayMs = 150;
      batchSteps = 5; // 5 steps per render frame
    } else if (speed === 100) {
      delayMs = 120;
      batchSteps = 10; // 10 steps per render frame
    }

    this.timerId = setTimeout(() => {
      this.executeTickBatch(batchSteps);
      if (this.isRunning) {
        this.scheduleNextTick();
      }
    }, delayMs);
  }

  private executeTickBatch(steps: number) {
    if (!this.getState || !this.setState) return;

    const startTime = performance.now();

    this.setState((prevState) => {
      if (!prevState || prevState.clock.isPaused) return prevState;

      let currentState = prevState;
      for (let i = 0; i < steps; i++) {
        currentState = WorldManager.stepSimulation(
          currentState,
          this.marketEngine,
          this.rng
        );
      }
      return currentState;
    });

    const elapsed = performance.now() - startTime;
    this.lastDurationMs = Number(elapsed.toFixed(1));
    this.tickCountInWindow += steps;

    // TPS calculation every 1s
    const now = performance.now();
    if (now - this.lastTpsCalculationTime >= 1000) {
      this.currentTps = Number(
        ((this.tickCountInWindow * 1000) / (now - this.lastTpsCalculationTime)).toFixed(1)
      );
      this.tickCountInWindow = 0;
      this.lastTpsCalculationTime = now;
    }
  }

  /**
   * Fast-forward batch advance (1h, 1d, 1w, 1m) without rendering intermediate states
   */
  public advanceTimeJump(jump: '1h' | '1d' | '1w' | '1m') {
    if (!this.setState) return;

    const startTime = performance.now();

    this.setState((prev) => {
      if (!prev) return prev;
      return WorldManager.advanceTimeJump(
        prev,
        jump,
        this.marketEngine,
        this.rng
      );
    });

    this.lastDurationMs = Number((performance.now() - startTime).toFixed(1));
  }

  private startPerformanceMonitor() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const checkFrame = () => {
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
        this.frameCount = 0;
        this.lastFpsTime = now;
      }
      this.animFrameId = requestAnimationFrame(checkFrame);
    };

    this.animFrameId = requestAnimationFrame(checkFrame);
  }

  public getPerformanceMetrics(state: WorldState | null): PerformanceMetrics {
    const renderedInstruments = state ? Object.keys(state.instruments).length : 0;
    const activeOrdersCount = state ? state.openOrders?.length || 0 : 0;
    const activePositionsCount = state ? Object.keys(state.portfolio.positions).length : 0;

    return {
      fps: this.currentFps,
      tps: this.currentTps,
      renderedInstruments,
      activeOrdersCount,
      activePositionsCount,
      lastStepDurationMs: this.lastDurationMs,
      memoryEstimateMb: typeof window !== 'undefined' && (performance as any).memory
        ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
        : undefined,
    };
  }

  public destroy() {
    this.stop();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const simulationScheduler = SimulationScheduler.getInstance();
