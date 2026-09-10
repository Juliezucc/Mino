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

  /**
   * Un enfant se sert de cet appareil — déclaré par le parent, à l'inscription.
   *
   * **Ce que ce drapeau ferme, et il faut un signal POSITIF pour le fermer.**
   * L'écran du code parent ne savait reconnaître qu'une tablette arrivée par le
   * code famille, où la session est celle d'un appareil. Or la tablette du
   * salon porte le plus souvent la session du parent lui-même — c'est là qu'il
   * s'est inscrit, puis il la partage. Elle passait donc pour son téléphone
   * personnel, et l'enfant qui touchait « Espace parent » se voyait offrir de
   * **choisir** le code. Quatre chiffres, et il entrait.
   *
   * On ne pouvait pas le déduire de `usagePersonnel` : faux vaut aussi bien
   * « partagé » que « la question n'a jamais été posée » — le cas de tous les
   * appareils déjà installés, et de toute famille venue du site. Le déduire
   * aurait verrouillé ces parents-là hors de leur propre espace, sans aucun
   * moyen d'y remédier. D'où un drapeau à part, qui n'est vrai que si
   * quelqu'un l'a dit.
   */
  declareALEnfant: boolean;
}

export const NO_DEVICE_PROFILE: DeviceProfile = {
  lockedChildId: null,
  lastChildId: null,
  compteurSeul: false,
  usagePersonnel: false,
  declareALEnfant: false,
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
      declareALEnfant: parsed.declareALEnfant === true,
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

/**
 * À qui est cet appareil — la réponse, et non ses conséquences.
 *
 * **Le défaut : la réponse ne se corrigeait pas.** Elle n'était posée qu'une
 * fois, à l'inscription, et une erreur y était définitive — c'est le reproche
 * numéro un de la recette. Les réglages proposaient bien de réserver
 * l'appareil à un enfant, mais ils n'écrivaient qu'un `lockedChildId` : un
 * parent qui avait répondu « c'est mon téléphone » restait `usagePersonnel`
 * pour toujours, et aucun écran ne savait le défaire.
 *
 * **Pourquoi trois champs pour une question.** Chacun sert à quelqu'un de
 * différent : `lockedChildId` décide sur quel profil l'application rouvre,
 * `usagePersonnel` décide à qui le serveur adresse ses notifications, et
 * `declareALEnfant` décide si un enfant peut se choisir un code parent. Ils se
 * déduisent tous les trois de la même réponse, mais on ne peut pas en garder
 * deux et recalculer le troisième : `usagePersonnel` faux vaut aussi bien
 * « partagé » que « on n'a jamais demandé ».
 *
 * D'où cette fonction : la réponse est écrite une fois, ici, et les deux
 * écrans qui la posent passent par elle.
 */
export type ChoixDAppareil =
  /** Le téléphone ou la tablette d'un enfant en particulier. */
  | { kind: 'enfant'; childId: ID }
  /** Partagé entre les enfants — la tablette du salon. */
  | { kind: 'partage' }
  /** Celui du parent. Rien à bloquer ici. */
  | { kind: 'parent' };

export function etatsPourChoix(
  choix: ChoixDAppareil,
): Pick<DeviceProfile, 'lockedChildId' | 'usagePersonnel' | 'declareALEnfant'> {
  return {
    lockedChildId: choix.kind === 'enfant' ? choix.childId : null,
    usagePersonnel: choix.kind === 'parent',
    // Vrai pour les deux réponses où un enfant se sert de l'appareil. C'est ce
    // que lit `parentGate` pour refuser à un enfant de CHOISIR le code.
    declareALEnfant: choix.kind !== 'parent',
  };
}

/** La réponse telle qu'elle a été enregistrée, pour cocher la bonne case. */
export function choixEnregistre(
  profil: Pick<DeviceProfile, 'lockedChildId' | 'usagePersonnel'>,
): ChoixDAppareil {
  if (profil.lockedChildId) return { kind: 'enfant', childId: profil.lockedChildId };
  return profil.usagePersonnel ? { kind: 'parent' } : { kind: 'partage' };
}
