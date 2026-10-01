/**
 * High-Capacity Asynchronous IndexedDB Storage for StockSim Binary Saves.
 * Bypasses the 5MB localStorage limit and supports large instrument universes and checkpoints.
 */

import { WorldState } from '../../types/world';
import { WorldBinaryCodec } from './BinaryCodec';

const DB_NAME = 'StockSimDB';
const DB_VERSION = 1;
const STORE_WORLDS = 'worlds';
const STORE_META = 'meta';

export interface WorldMetaRecord {
  id: string;
  name: string;
  market: string;
  currency: string;
  updatedAt: string;
  seed: number;
  byteSize: number;
  isCompressed: boolean;
}

export class IndexedDBStorageService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB not supported in this environment'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_WORLDS)) {
            db.createObjectStore(STORE_WORLDS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'id' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  /**
   * Saves WorldState as compressed binary blob to IndexedDB with metadata
   */
  public static async saveWorldBinary(world: WorldState): Promise<{ byteSize: number; originalSize: number }> {
    const rawBinary = WorldBinaryCodec.encode(world);
    const originalSize = rawBinary.length;
    const compressed = await WorldBinaryCodec.compress(rawBinary);
    const byteSize = compressed.length;

    const meta: WorldMetaRecord = {
      id: world.snapshot.id,
      name: `${world.marketConfig.name} (${world.clock.displayDate})`,
      market: world.snapshot.market,
      currency: world.snapshot.currency,
      updatedAt: new Date().toISOString(),
      seed: world.snapshot.seed,
      byteSize,
      isCompressed: true,
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_WORLDS, STORE_META], 'readwrite');
        tx.objectStore(STORE_WORLDS).put({ id: world.snapshot.id, data: compressed });
        tx.objectStore(STORE_META).put(meta);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      // Fallback: save to localStorage if IndexedDB fails
      console.warn('IndexedDB write failed, falling back to localStorage', err);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`stocksim_world_${world.snapshot.id}`, JSON.stringify(world));
          localStorage.setItem('stocksim_active_world_id', world.snapshot.id);
        } catch (lsErr) {
          console.error('localStorage fallback failed', lsErr);
        }
      }
    }

    return { byteSize, originalSize };
  }

  /**
   * Loads WorldState from IndexedDB (or fallback localStorage)
   */
  public static async loadWorldBinary(worldId?: string): Promise<WorldState | null> {
    try {
      const db = await this.getDB();

      let targetId = worldId;
      if (!targetId) {
        // Find most recently updated
        const allMeta = await this.listWorlds();
        if (allMeta.length > 0) {
          allMeta.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          targetId = allMeta[0].id;
        }
      }

      if (!targetId) return null;

      const record = await new Promise<{ id: string; data: Uint8Array } | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_WORLDS, 'readonly');
        const req = tx.objectStore(STORE_WORLDS).get(targetId!);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!record || !record.data) return null;

      // Decompress and decode binary
      const decompressed = await WorldBinaryCodec.decompress(record.data);
      return WorldBinaryCodec.decode(decompressed);
    } catch (err) {
      console.warn('IndexedDB load failed or empty, checking localStorage fallback', err);
      if (typeof localStorage !== 'undefined') {
        const targetId = worldId || localStorage.getItem('stocksim_active_world_id');
        if (targetId) {
          const raw = localStorage.getItem(`stocksim_world_${targetId}`) || localStorage.getItem('stocksim_current_world');
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }
  }

  /**
   * Lists all saved worlds metadata
   */
  public static async listWorlds(): Promise<WorldMetaRecord[]> {
    try {
      const db = await this.getDB();
      return new Promise<WorldMetaRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  /**
   * Deletes a world by ID
   */
  public static async deleteWorld(worldId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_WORLDS, STORE_META], 'readwrite');
        tx.objectStore(STORE_WORLDS).delete(worldId);
        tx.objectStore(STORE_META).delete(worldId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('Failed to delete world from IndexedDB', err);
    }
  }
}
