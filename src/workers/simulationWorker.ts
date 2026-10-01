/**
 * Web Worker for Off-Main-Thread Market Simulation, Batch Ticking, and Fast-Forward.
 * Operates on dense typed arrays and returns compact delta patches to keep UI at 60 FPS.
 */

import { SeededRandom } from '../utils/seedRandom';
import { WorldState } from '../types/world';
import { MarketEngine } from '../game/market/MarketEngine';
import { WorldManager } from '../game/world/WorldManager';

let currentWorld: WorldState | null = null;
let marketEngine: MarketEngine = new MarketEngine();
let rng: SeededRandom = new SeededRandom(123456789);

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT': {
      currentWorld = payload.world;
      rng = new SeededRandom(payload.world.snapshot.seed || 123456789);
      marketEngine = new MarketEngine();
      self.postMessage({ type: 'INIT_DONE', success: true });
      break;
    }

    case 'STEP_BATCH': {
      if (!currentWorld) {
        self.postMessage({ type: 'ERROR', message: 'Worker not initialized' });
        return;
      }

      const steps: number = payload.steps || 1;
      const startTime = performance.now();

      for (let i = 0; i < steps; i++) {
        currentWorld = WorldManager.stepSimulation(currentWorld, marketEngine, rng);
      }

      const durationMs = performance.now() - startTime;
      self.postMessage({
        type: 'STEP_BATCH_DONE',
        payload: {
          world: currentWorld,
          durationMs,
          steps,
        },
      });
      break;
    }

    case 'TIME_JUMP': {
      if (!currentWorld) {
        self.postMessage({ type: 'ERROR', message: 'Worker not initialized' });
        return;
      }

      const jump: '1h' | '1d' | '1w' | '1m' = payload.jump;
      const startTime = performance.now();

      currentWorld = WorldManager.advanceTimeJump(currentWorld, jump, marketEngine, rng);
      const durationMs = performance.now() - startTime;

      self.postMessage({
        type: 'TIME_JUMP_DONE',
        payload: {
          world: currentWorld,
          durationMs,
          jump,
        },
      });
      break;
    }

    case 'UPDATE_STATE': {
      currentWorld = payload.world;
      break;
    }

    default:
      break;
  }
};
