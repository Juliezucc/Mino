import AsyncStorage from '@react-native-async-storage/async-storage';

import { ID } from '@/domain/types';

/**
 * À qui appartient cet appareil-ci.
 *
 * Volontairement **hors du document familial** : ce n'est pas une propriété de
 * la famille, c'est une propriété de ce téléphone-là. La tablette du salon et
 * le téléphone de Noah appartiennent à la même famille et ne doivent pas se
 * comporter pareil — et le réglage de l'un n'a rien à faire dans les données
 * synchronisées de l'autre.
 *
 * Deux besoins, et ils tirent dans des directions opposées :
 *
 * — **ne pas faire se reconnecter un enfant à chaque fois.** Rouvrir Mino et
 *   retomber sur « Qui utilise Mino ? » à chaque lancement est une friction
 *   quotidienne qui, sur un téléphone personnel, n'a aucune justification.
 *
 * — **empêcher un enfant de prendre le profil d'un autre.** Le risque n'est pas
 *   théorique : les minos d'un frère sont juste à côté, et il suffit d'une
 *   touche pour lancer son temps d'écran avec.
 *
 * D'où deux modes, choisis par le parent, appareil par appareil :
 *
 *   • **réservé** — « cet appareil est à Noah ». Il s'ouvre toujours sur Noah,
 *     quel que soit le dernier profil utilisé.
 *
 *   • **partagé** — la tablette de la maison. Elle rouvre sur le dernier profil
 *     utilisé.
 *
 * **Ce que ce réglage ne fait plus, et pourquoi.** Sur un appareil réservé,
 * changer de profil demandait le code parent. L'intention était bonne — les
 * minos d'un frère sont à une touche — mais à l'usage elle produisait une
 * scène absurde : le parent tapait son code pour atteindre le sélecteur, puis
 * touchait « Espace parent » et se voyait redemander le même code aussitôt (le
 * sélecteur reverrouille l'espace parent en s'ouvrant, à juste titre). Le
 * premier code n'ouvrait donc rien : il ne servait qu'à passer une porte.
 *
 * Un changement de profil n'est pas un accès aux réglages, et il ne se paie
 * plus d'un code. Ce qui est protégé, c'est l'espace parent — lui seul.
 */

const KEY = 'mino.device.profile.v1';

export interface DeviceProfile {
  /** Non nul : l'appareil est réservé à cet enfant. */
  lockedChildId: ID | null;
  /** Le dernier profil ouvert, pour rouvrir dessus. */
  lastChildId: ID | null;
}

export const NO_DEVICE_PROFILE: DeviceProfile = { lockedChildId: null, lastChildId: null };

export async function readDeviceProfile(): Promise<DeviceProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return NO_DEVICE_PROFILE;
    const parsed = JSON.parse(raw) as Partial<DeviceProfile>;
    return {
      lockedChildId: parsed.lockedChildId ?? null,
      lastChildId: parsed.lastChildId ?? null,
    };
  } catch {
    // Un réglage d'appareil illisible ne doit jamais empêcher l'application de
    // démarrer : on retombe sur le sélecteur de profil, qui marche toujours.
    return NO_DEVICE_PROFILE;
  }
}

export async function writeDeviceProfile(patch: Partial<DeviceProfile>): Promise<DeviceProfile> {
  const current = await readDeviceProfile();
  const next: DeviceProfile = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  return next;
}

/**
 * Sur quel profil ouvrir l'application, s'il y en a un.
 *
 * `children` sert à une chose : un enfant supprimé, ou un appareil rattaché à
 * une autre famille, ne doit pas laisser l'application ouvrir sur un profil qui
 * n'existe plus — elle retomberait sur un écran vide sans rien expliquer.
 */
export function profileToOpen(profile: DeviceProfile, children: { id: ID }[]): ID | null {
  const exists = (id: ID | null) => (id && children.some((c) => c.id === id) ? id : null);
  return exists(profile.lockedChildId) ?? exists(profile.lastChildId);
}
