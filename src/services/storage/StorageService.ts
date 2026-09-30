import { WorldState } from '../../types/world';

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
  /**
   * Save the active world state to localStorage
   */
  public static saveActiveWorld(state: WorldState): boolean {
    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY_CURRENT_WORLD, serialized);

      // Also update slot in saved slots list
      this.updateSavedSlot(state);
      return true;
    } catch (err) {
      console.error('Storage error: Failed to save active world', err);
      return false;
    }
  }

  /**
   * Load the active world state from localStorage
   */
  public static loadActiveWorld(): WorldState | null {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY_CURRENT_WORLD);
      if (!serialized) return null;
      const parsed = JSON.parse(serialized) as WorldState;

      // Basic schema validation
      if (!parsed.snapshot || !parsed.portfolio || !parsed.instruments || !parsed.marketConfig) {
        console.warn('Corrupted world save file found');
        return null;
      }
      return parsed;
    } catch (err) {
      console.error('Failed to parse saved world', err);
      return null;
    }
  }

  /**
   * List all saved worlds in storage
   */
  public static listSavedWorlds(): SavedWorldSummary[] {
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
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_WORLD);
    } catch (err) {
      console.error('Failed to reset active world', err);
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

  private static updateSavedSlot(state: WorldState) {
    try {
      const slots = this.listSavedWorlds();
      const summary: SavedWorldSummary = {
        id: state.snapshot.id,
        name: `${state.marketConfig.country} - ${state.snapshot.difficulty.toUpperCase()}`,
        market: state.snapshot.market,
        currency: state.snapshot.currency,
        totalAssets: state.portfolio.totalAssets,
        totalReturnPercent: state.portfolio.totalReturnPercent,
        savedAt: new Date().toISOString(),
        simulationTime: state.clock.displayDate + ' ' + state.clock.displayTime,
      };

      const existingIndex = slots.findIndex((s) => s.id === state.snapshot.id);
      if (existingIndex >= 0) {
        slots[existingIndex] = summary;
      } else {
        slots.unshift(summary);
      }

      localStorage.setItem(STORAGE_KEY_SAVED_SLOTS, JSON.stringify(slots.slice(0, 10)));
    } catch {
      // Ignore slot update failure
    }
  }
}
