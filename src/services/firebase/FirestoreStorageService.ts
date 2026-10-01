import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { WorldState } from '../../types/world';
import { WorldBinaryCodec } from '../storage/BinaryCodec';

export interface CloudWorldSummary {
  id: string;
  name: string;
  marketId: string;
  seed: number;
  totalAssets: number;
  lastSaved: string;
  byteSize: number;
}

export class FirestoreStorageService {
  /**
   * Save a world state to Firestore under the authenticated user's profile
   */
  public static async saveWorldToCloud(world: WorldState): Promise<{ success: boolean; byteSize: number }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be signed in to save to cloud');
    }

    // 1. Encode to compressed binary
    const uncompressed = WorldBinaryCodec.encode(world);
    const binary = await WorldBinaryCodec.compress(uncompressed);

    // 2. Convert Uint8Array to base64
    let binaryStr = '';
    const bytes = new Uint8Array(binary);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binaryStr);

    // 3. Store doc in Firestore
    const worldDocRef = doc(db, 'users', user.uid, 'savedWorlds', world.snapshot.id);
    await setDoc(worldDocRef, {
      id: world.snapshot.id,
      userId: user.uid,
      name: world.marketConfig.name || world.snapshot.id,
      marketId: world.marketConfig.id,
      seed: world.snapshot.seed,
      totalTicks: world.clock.totalTicks,
      totalAssets: world.portfolio.totalAssets,
      lastSaved: new Date().toISOString(),
      binaryData: base64Data,
    });

    return { success: true, byteSize: binary.byteLength };
  }

  /**
   * Load a world from Firestore by worldId
   */
  public static async loadWorldFromCloud(worldId: string): Promise<WorldState | null> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be signed in to load from cloud');
    }

    const worldDocRef = doc(db, 'users', user.uid, 'savedWorlds', worldId);
    const snapshot = await getDoc(worldDocRef);
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    const base64Data = data.binaryData as string;
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const uncompressed = await WorldBinaryCodec.decompress(bytes);
    return WorldBinaryCodec.decode(uncompressed);
  }

  /**
   * List all cloud saved worlds for current user
   */
  public static async listCloudWorlds(): Promise<CloudWorldSummary[]> {
    const user = auth.currentUser;
    if (!user) return [];

    const worldsCol = collection(db, 'users', user.uid, 'savedWorlds');
    const snapshot = await getDocs(worldsCol);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id,
        name: data.name,
        marketId: data.marketId,
        seed: data.seed,
        totalAssets: data.totalAssets,
        lastSaved: data.lastSaved,
        byteSize: data.binaryData ? Math.round((data.binaryData.length * 3) / 4) : 0,
      };
    });
  }

  /**
   * Delete a cloud saved world
   */
  public static async deleteCloudWorld(worldId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    const worldDocRef = doc(db, 'users', user.uid, 'savedWorlds', worldId);
    await deleteDoc(worldDocRef);
  }
}
