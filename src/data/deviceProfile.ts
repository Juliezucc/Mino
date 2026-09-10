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
  /**
   * **« Le compteur seul, sans le blocage » — dit par le parent, ici même.**
   *
   * Sans ce réglage, Mino n'avait que deux comportements possibles sur un
   * appareil où le bouclier n'est pas autorisé, et les deux étaient mauvais :
   *
   * — laisser l'enfant lancer sa séance quand même. Il paie ses minutes
   *   gagnées, le compte à rebours démarre, et aucune application ne s'ouvre ni
   *   ne se ferme, puisqu'il n'y a rien à ouvrir ni à fermer. Mino lui prend son
   *   temps mérité en échange de rien ;
   *
   * — refuser la séance. Correct pour une famille qui voulait le blocage et n'a
   *   pas fini l'installation ; insultant pour celle qui n'en veut pas et se
   *   sert de Mino comme d'un compteur de temps convenu entre eux — un usage
   *   parfaitement légitime, surtout avec un adolescent.
   *
   * Ces deux familles ne se distinguent par aucun signal technique : dans les
   * deux cas, l'autorisation manque. Seul le parent sait laquelle il est, et
   * c'est donc à lui qu'on le demande — une fois, explicitement, depuis son
   * espace. Tant qu'il n'a pas répondu, on refuse : entre prendre le temps d'un
   * enfant pour rien et faire attendre un parent, le choix est vite fait.
   *
   * Sur cet appareil-ci et pas dans la famille, pour la même raison que le
   * reste de ce fichier : le bouclier est une propriété du téléphone. La
   * tablette du salon peut être encadrée pendant que le téléphone du grand ne
   * fait que compter.
   */
  compteurSeul: boolean;

  /**
   * « C'est mon téléphone à moi » — la troisième réponse de l'inscription.
   *
   * Elle était posée, puis jetée : les trois réponses écrivaient la même chose
   * dans ce fichier (un `lockedChildId`, nul pour deux d'entre elles), si bien
   * que le téléphone du parent et la tablette du salon devenaient
   * indiscernables. Sans conséquence tant que rien ne s'appuyait dessus.
   *
   * Le bandeau du bouclier s'y appuie, lui, et le lui reprocherait : « le
   * blocage n'est pas actif, votre enfant ne peut pas lancer son temps
   * d'écran » sur un appareil où aucun enfant ne joue, et où le parent a
   * précisément répondu qu'il n'y avait rien à bloquer. Un avertissement faux
   * apprend à ignorer les vrais.
   *
   * Ce n'est pas une dispense définitive : il suffit qu'un profil enfant soit
   * ouvert ici une fois — `lastChildId` cesse alors d'être nul — pour que le
   * bandeau revienne. Un parent qui prête son téléphone n'a rien à déclarer, et
   * l'appareil s'en aperçoit tout seul.
   */
  usagePersonnel: boolean;
}

export const NO_DEVICE_PROFILE: DeviceProfile = {
  lockedChildId: null,
  lastChildId: null,
  compteurSeul: false,
  usagePersonnel: false,
};

export async function readDeviceProfile(): Promise<DeviceProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return NO_DEVICE_PROFILE;
    const parsed = JSON.parse(raw) as Partial<DeviceProfile>;
    return {
      lockedChildId: parsed.lockedChildId ?? null,
      lastChildId: parsed.lastChildId ?? null,
      compteurSeul: parsed.compteurSeul === true,
      usagePersonnel: parsed.usagePersonnel === true,
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
export function profileToOpen(
  // `Pick` et non `DeviceProfile` : cette fonction ne décide que du profil à
  // rouvrir. Lui demander le réglage du bouclier n'aurait aucun sens, et
  // l'exiger obligerait chaque appelant à le fournir pour rien.
  profile: Pick<DeviceProfile, 'lockedChildId' | 'lastChildId'>,
  children: { id: ID }[],
): ID | null {
  const exists = (id: ID | null) => (id && children.some((c) => c.id === id) ? id : null);
  return exists(profile.lockedChildId) ?? exists(profile.lastChildId);
}
