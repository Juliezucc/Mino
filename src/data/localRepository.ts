import AsyncStorage from '@react-native-async-storage/async-storage';

import { FamilyData } from '@/domain/types';

import { ChangeEvent, MinoRepository } from './repository';

const STORAGE_KEY = 'mino.family.v1';
/**
 * Development stand-in for the server's family directory: the last family this
 * device saw, kept across a reset so the "join with a code" flow can be run and
 * judged without a backend. Never read once Supabase is configured.
 */
const DIRECTORY_KEY = 'mino.family.directory.v1';

async function readDirectory(): Promise<FamilyData | null> {
  const raw = await AsyncStorage.getItem(DIRECTORY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FamilyData;
  } catch {
    return null;
  }
}

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
    await AsyncStorage.setItem(DIRECTORY_KEY, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    // The directory survives on purpose — see `joinFamily`.
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Without a backend there is no directory of families to look a code up in,
   * so this device keeps the last family it saw — including across a reset.
   * That stands in for the server just well enough to run and judge the whole
   * setup flow offline; `SupabaseRepository` does the real thing.
   */
  async joinFamily(input: { code: string; parentEmail: string }): Promise<FamilyData | null> {
    const known = (await this.load()) ?? (await readDirectory());
    if (!known) return null;
    if (!matchesFamily(known, input)) return null;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(known));
    return known;
  }
}

/** Case- and spacing-insensitive, because both are typed by hand. */
export function matchesFamily(
  data: FamilyData,
  input: { code: string; parentEmail: string },
): boolean {
  const code = input.code.trim().toUpperCase().replace(/\s/g, '');
  const email = input.parentEmail.trim().toLowerCase();
  return (
    data.family.code.toUpperCase() === code &&
    data.parents.some((p) => p.email.toLowerCase() === email)
  );
}
