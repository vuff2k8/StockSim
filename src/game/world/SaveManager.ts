import { StorageService, SavedWorldSummary } from '../../services/storage/StorageService';
import { WorldState } from '../../types/world';

export class SaveManager {
  /**
   * Saves the current world state
   */
  public static saveGame(state: WorldState): boolean {
    return StorageService.saveActiveWorld(state);
  }

  /**
   * Loads the current active world from storage
   */
  public static loadGame(): WorldState | null {
    return StorageService.loadActiveWorld();
  }

  /**
   * Resets active world (clears game state)
   */
  public static resetGame(): void {
    StorageService.resetActiveWorld();
  }

  /**
   * Lists all saved world slots
   */
  public static listSavedSlots(): SavedWorldSummary[] {
    return StorageService.listSavedWorlds();
  }

  /**
   * Exports world to JSON string
   */
  public static exportSave(state: WorldState): string {
    return StorageService.exportWorldJson(state);
  }

  /**
   * Imports world from JSON string
   */
  public static importSave(jsonString: string): WorldState {
    return StorageService.importWorldJson(jsonString);
  }
}
