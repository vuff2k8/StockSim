/**
 * Bridge between Main Thread and Web Worker for high-throughput market simulation.
 * Falls back transparently to in-thread execution if Web Worker is not supported.
 */

import { WorldState } from '../../types/world';
import { MarketEngine } from '../market/MarketEngine';
import { SeededRandom } from '../../utils/seedRandom';
import { WorldManager } from '../world/WorldManager';

export class WorkerSimulationBridge {
  private worker: Worker | null = null;
  private isWorkerReady: boolean = false;
  private marketEngine: MarketEngine = new MarketEngine();
  private rng: SeededRandom = new SeededRandom(123456789);

  // Pending promises resolver map
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private requestCounter: number = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../../workers/simulationWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (e: MessageEvent) => {
          const { type, payload, message } = e.data;
          if (type === 'INIT_DONE') {
            this.isWorkerReady = true;
          } else if (type === 'STEP_BATCH_DONE' || type === 'TIME_JUMP_DONE') {
            const resolver = this.pendingRequests.get(type);
            if (resolver) {
              resolver.resolve(payload);
              this.pendingRequests.delete(type);
            }
          } else if (type === 'ERROR') {
            console.warn('Worker error:', message);
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Simulation worker encountered error, falling back to main thread', err);
          this.worker = null;
          this.isWorkerReady = false;
        };
      } catch (err) {
        console.warn('Web Worker initialization failed, using main thread simulation', err);
        this.worker = null;
      }
    }
  }

  public init(world: WorldState): void {
    this.rng = new SeededRandom(world.snapshot.seed);
    if (this.worker) {
      this.worker.postMessage({ type: 'INIT', payload: { world } });
    }
  }

  public updateState(world: WorldState): void {
    if (this.worker && this.isWorkerReady) {
      this.worker.postMessage({ type: 'UPDATE_STATE', payload: { world } });
    }
  }

  /**
   * Runs batch of simulation steps (in Worker if available, or on main thread)
   */
  public async stepBatch(
    currentWorld: WorldState,
    steps: number
  ): Promise<{ world: WorldState; durationMs: number }> {
    if (this.worker && this.isWorkerReady) {
      return new Promise<{ world: WorldState; durationMs: number }>((resolve, reject) => {
        this.pendingRequests.set('STEP_BATCH_DONE', { resolve, reject });
        this.worker!.postMessage({
          type: 'STEP_BATCH',
          payload: { steps },
        });

        // Timeout fallback after 3s
        setTimeout(() => {
          if (this.pendingRequests.has('STEP_BATCH_DONE')) {
            this.pendingRequests.delete('STEP_BATCH_DONE');
            // Execute locally
            const res = this.stepBatchLocally(currentWorld, steps);
            resolve(res);
          }
        }, 3000);
      });
    }

    return this.stepBatchLocally(currentWorld, steps);
  }

  /**
   * Fast-forwards time jump (1h, 1d, 1w, 1m) in Worker or locally
   */
  public async timeJump(
    currentWorld: WorldState,
    jump: '1h' | '1d' | '1w' | '1m'
  ): Promise<{ world: WorldState; durationMs: number }> {
    if (this.worker && this.isWorkerReady) {
      return new Promise<{ world: WorldState; durationMs: number }>((resolve, reject) => {
        this.pendingRequests.set('TIME_JUMP_DONE', { resolve, reject });
        this.worker!.postMessage({
          type: 'TIME_JUMP',
          payload: { jump },
        });

        setTimeout(() => {
          if (this.pendingRequests.has('TIME_JUMP_DONE')) {
            this.pendingRequests.delete('TIME_JUMP_DONE');
            const res = this.timeJumpLocally(currentWorld, jump);
            resolve(res);
          }
        }, 5000);
      });
    }

    return this.timeJumpLocally(currentWorld, jump);
  }

  private stepBatchLocally(currentWorld: WorldState, steps: number): { world: WorldState; durationMs: number } {
    const startTime = performance.now();
    let state = currentWorld;
    for (let i = 0; i < steps; i++) {
      state = WorldManager.stepSimulation(state, this.marketEngine, this.rng);
    }
    const durationMs = performance.now() - startTime;
    return { world: state, durationMs };
  }

  private timeJumpLocally(currentWorld: WorldState, jump: '1h' | '1d' | '1w' | '1m'): { world: WorldState; durationMs: number } {
    const startTime = performance.now();
    const updated = WorldManager.advanceTimeJump(currentWorld, jump, this.marketEngine, this.rng);
    const durationMs = performance.now() - startTime;
    return { world: updated, durationMs };
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isWorkerReady = false;
    }
  }
}

export const workerSimulationBridge = new WorkerSimulationBridge();
