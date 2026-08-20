import AsyncStorage from '@react-native-async-storage/async-storage';

import { ID } from '@/domain/types';

/**
 * Ce qui a déjà été fêté, sur cet appareil.
 *
 * Volontairement hors des données de la famille : le registre des minutes ne se
 * modifie jamais — c'est la première règle de Mino — donc on ne peut pas
 * marquer une transaction « déjà vue » comme on marque une mission. Et c'est
 * juste ainsi : fêter est un événement d'écran, pas un fait comptable.
 *
 * Conséquence acceptée : un enfant qui a deux appareils verra la fête deux
 * fois. C'est le bon sens de l'échange — mieux vaut un cadeau montré deux fois
 * qu'un cadeau jamais montré, et personne n'a jamais reproché à une bonne
 * nouvelle d'arriver deux fois.
 */

const KEY = 'mino.bonus.seen.v1';

type Seen = Record<ID, ID>;

async function read(): Promise<Seen> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Seen) : {};
  } catch {
    return {};
  }
}

export async function lastSeenBonus(childId: ID): Promise<ID | null> {
  return (await read())[childId] ?? null;
}

export async function rememberBonus(childId: ID, transactionId: ID): Promise<void> {
  const seen = await read();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...seen, [childId]: transactionId })).catch(
    () => undefined,
  );
}
