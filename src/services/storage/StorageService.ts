import { WorldState } from '../../types/world';
import { IndexedDBStorageService } from './IndexedDBStorageService';
import { WorldBinaryCodec } from './BinaryCodec';

const STORAGE_KEY_CURRENT_WORLD = 'stocksim_current_world';
const STORAGE_KEY_SAVED_SLOTS = 'stocksim_saved_worlds';

export interface SavedWorldSummary {
  id: string;
  name: string;
  market: string;
  currency: string;
  totalAssets: number;
  totalReturnPercent: number;
  savedAt: string;
  simulationTime: string;
}

export class StorageService {
  private static saveDebounceTimer: any = null;
  public static lastSaveMetrics = {
    originalBytes: 0,
    compressedBytes: 0,
    savingsPercent: 0,
    saveDurationMs: 0,
  };

  /**
   * Save active world using async IndexedDB binary compression with debounced fallback
   */
  public static saveActiveWorld(state: WorldState): boolean {
    const startTime = performance.now();

    // Trigger async binary save to IndexedDB
    IndexedDBStorageService.saveWorldBinary(state)
      .then((res) => {
        this.lastSaveMetrics = {
          originalBytes: res.originalSize,
          compressedBytes: res.byteSize,
          savingsPercent: Math.round(((res.originalSize - res.byteSize) / res.originalSize) * 100),
          saveDurationMs: Math.round(performance.now() - startTime),
        };
      })
      .catch((err) => {
        console.warn('Async binary save failed', err);
      });

    // Update lightweight slot summary in localStorage
    this.updateSavedSlot(state);
    return true;
  }

  /**
   * Load active world: prefers IndexedDB binary; falls back to localStorage
   */
  public static async loadActiveWorldAsync(): Promise<WorldState | null> {
    try {
      const fromDB = await IndexedDBStorageService.loadWorldBinary();
      if (fromDB) return fromDB;
    } catch (err) {
      console.warn('IndexedDB load failed', err);
    }
    return this.loadActiveWorld();
  }

  /**
   * Synchronous load from localStorage fallback
   */
  public static loadActiveWorld(): WorldState | null {
    if (typeof localStorage === 'undefined') return null;

    try {
      const serialized = localStorage.getItem(STORAGE_KEY_CURRENT_WORLD);
      if (!serialized) return null;
      const parsed = JSON.parse(serialized) as WorldState;

      if (!parsed.snapshot || !parsed.portfolio || !parsed.instruments || !parsed.marketConfig) {
        console.warn('Corrupted world save file found');
        return null;
      }
      return parsed;
    } catch (err) {
      console.error('Failed to parse saved world from localStorage', err);
      return null;
    }
  }

  /**
   * List all saved worlds in storage
   */
  public static listSavedWorlds(): SavedWorldSummary[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_SLOTS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Clear current active world (Reset)
   */
  public static resetActiveWorld(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_CURRENT_WORLD);
        localStorage.removeItem('stocksim_active_world_id');
      } catch (err) {
        console.error('Failed to reset active world in localStorage', err);
      }
    }
  }

  /**
   * Export world state to JSON string for backup/export
   */
  public static exportWorldJson(state: WorldState): string {
    return JSON.stringify(state, null, 2);
  }

  /**
   * Import world state from JSON string
   */
  public static importWorldJson(jsonString: string): WorldState {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.snapshot || !parsed.portfolio || !parsed.instruments) {
        throw new Error('Dữ liệu tệp sao lưu không đúng định dạng StockSim.');
      }
      return parsed;
    } catch (err) {
      throw new Error('Không thể đọc tệp lưu trữ. Dữ liệu bị lỗi hoặc sai định dạng.');
    }
  }

  private static updateSavedSlot(state: WorldState): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const existing = this.listSavedWorlds();
      const updatedSlot: SavedWorldSummary = {
        id: state.snapshot.id,
        name: `${state.marketConfig.name} (${state.clock.displayDate})`,
        market: state.snapshot.market,
        currency: state.snapshot.currency,
        totalAssets: state.portfolio.equity,
        totalReturnPercent: state.portfolio.totalReturnPercent,
        savedAt: new Date().toISOString(),
        simulationTime: `${state.clock.displayDate} ${state.clock.displayTime}`,
      };

      const filtered = existing.filter((s) => s.id !== state.snapshot.id);
      const updatedList = [updatedSlot, ...filtered].slice(0, 10);
      localStorage.setItem(STORAGE_KEY_SAVED_SLOTS, JSON.stringify(updatedList));
      localStorage.setItem('stocksim_active_world_id', state.snapshot.id);
    } catch (err) {
      console.warn('Failed to update slot summary', err);
    }
  }
}
