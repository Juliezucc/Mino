import AsyncStorage from '@react-native-async-storage/async-storage';

import { FamilyData } from '@/domain/types';

import { ChangeEvent, MinoRepository } from './repository';

const STORAGE_KEY = 'mino.family.v1';

/**
 * Offline-first storage. One family = one JSON document, which mirrors exactly
 * how the data is isolated per family on the backend.
 */
export class LocalRepository implements MinoRepository {
  readonly name = 'local';

  async load(): Promise<FamilyData | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FamilyData;
    } catch {
      // A corrupted document must never brick the app: start clean instead.
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  async persist(data: FamilyData, _change: ChangeEvent): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}
