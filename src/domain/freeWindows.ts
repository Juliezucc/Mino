import { ID, ISODate } from './types';

/**
 * Les plages libres : du temps d'écran qu'on n'a pas eu à gagner.
 *
 * Le mercredi après-midi, les vacances, l'anniversaire d'un copain. Un parent
 * doit pouvoir ouvrir une fenêtre pendant laquelle les écrans sont accessibles
 * sans que rien ne se dépense — parce que dans une vraie famille, tout n'est
 * pas mérité, et prétendre le contraire ferait de Mino un comptable plutôt
 * qu'un cadre.
 *
 * TROIS RÈGLES, et elles tiennent tout le reste.
 *
 * 1. UNE PLAGE LIBRE N'ÉCRIT RIEN AU GRAND LIVRE. Ni gain, ni dépense. Le
 *    solde de l'enfant est exactement le même avant et après. C'est ce qui
 *    empêche la fonctionnalité de corrompre la seule chose que l'application
 *    promet — si une plage consommait des minutes, un enfant sortirait du
 *    mercredi après-midi appauvri sans avoir rien choisi ; si elle en
 *    créditait, le compteur cesserait de vouloir dire « ce que j'ai mérité ».
 *
 * 2. PENDANT UNE PLAGE, ON NE LANCE PAS DE SESSION. L'écran est déjà ouvert :
 *    démarrer une session dépenserait des minutes pour obtenir ce qu'on a
 *    déjà. C'est le piège le plus facile à laisser passer, parce que rien ne
 *    le signale — l'enfant appuie, le compteur descend, et personne ne
 *    comprend pourquoi le solde a fondu un mercredi.
 *
 * 3. UNE PLAGE NE TRAVERSE PAS MINUIT. Non par paresse : une fenêtre 22 h →
 *    7 h n'est pas une permission, c'est un couvre-feu, et un couvre-feu est
 *    la fonctionnalité INVERSE — une plage qui interdit au lieu d'autoriser.
 *    Les mélanger dans le même objet donnerait un réglage que personne ne sait
 *    plus lire.
 *
 * L'heure est celle de l'appareil, comme partout ailleurs dans le domaine
 * (voir `isSameDay` dans `ledger.ts`). « Mercredi 14 h », pour une famille,
 * c'est mercredi 14 h là où elle se trouve.
 */

/** Dimanche = 0, comme `Date.prototype.getDay()`. */
export const JOURS = [
  { valeur: 0, court: 'D', long: 'Dimanche' },
  { valeur: 1, court: 'L', long: 'Lundi' },
  { valeur: 2, court: 'M', long: 'Mardi' },
  { valeur: 3, court: 'M', long: 'Mercredi' },
  { valeur: 4, court: 'J', long: 'Jeudi' },
  { valeur: 5, court: 'V', long: 'Vendredi' },
  { valeur: 6, court: 'S', long: 'Samedi' },
] as const;

export interface FreeWindow {
  id: ID;
  familyId: ID;
  /** Ce que la famille en dit : « Mercredi après-midi », « Vacances ». */
  label: string;
  /**
   * À qui elle s'applique. `null` veut dire toute la fratrie — et c'est le
   * cas courant, qu'il ne faut pas obliger un parent à composer enfant par
   * enfant à chaque fois qu'il ajoute un petit frère.
   */
  childIds: ID[] | null;
  /** Jours de la semaine, pour une plage qui revient. Vide si `date` est posée. */
  days: number[];
  /** `AAAA-MM-JJ`, pour une plage qui n'arrive qu'une fois. */
  date?: string;
  /** Minutes depuis minuit, heure locale. 14 h = 840. */
  startMinute: number;
  endMinute: number;
  /** Suspendre sans supprimer : les vacances reviennent. */
  enabled: boolean;
  /**
   * Le jour où le parent a dit « pas aujourd'hui » — `AAAA-MM-JJ`, heure
   * locale.
   *
   * **Ce qui manquait, et Julie l'a dit en une phrase : « il faut que le
   * parent puisse quand même arrêter quand il veut ».** Une plage ne se
   * fermait que pour toujours (`enabled`) ou jamais. Or le mercredi où les
   * devoirs ne sont pas faits n'est pas le mercredi d'après : couper la plage
   * du mercredi pour de bon, c'est la retrouver éteinte la semaine suivante,
   * et personne ne pense à la rallumer.
   *
   * Une date plutôt qu'un booléen, pour que l'interruption se périme d'
   * elle-même : demain, la plage revient sans que personne n'ait rien à faire.
   * C'est la seule forme qui ne laisse pas de réglage derrière elle.
   */
  interruptedOn?: string | null;
  createdAt: ISODate;
}

export const MINUTES_PAR_JOUR = 24 * 60;

/* --------------------------------------------------------------- lecture */

/** L'heure locale d'un instant, en minutes depuis minuit. */
export function minuteDuJour(quand: Date): number {
  return quand.getHours() * 60 + quand.getMinutes();
}

/** `AAAA-MM-JJ` en heure LOCALE — `toISOString()` rendrait la veille le soir. */
export function jourLocal(quand: Date): string {
  const m = `${quand.getMonth() + 1}`.padStart(2, '0');
  const j = `${quand.getDate()}`.padStart(2, '0');
  return `${quand.getFullYear()}-${m}-${j}`;
}

/** Le parent a arrêté cette plage POUR AUJOURD'HUI. Demain, elle revient. */
export function estInterrompue(fenetre: FreeWindow, maintenant: Date = new Date()): boolean {
  return !!fenetre.interruptedOn && fenetre.interruptedOn === jourLocal(maintenant);
}

function concerne(fenetre: FreeWindow, childId: ID | null): boolean {
  if (fenetre.childIds === null) return true;
  if (!childId) return false;
  return fenetre.childIds.includes(childId);
}

/** Cette plage tombe-t-elle ce jour-là ? Sans regarder l'heure. */
function ceJourLa(fenetre: FreeWindow, quand: Date): boolean {
  if (fenetre.date) return fenetre.date === jourLocal(quand);
  return fenetre.days.includes(quand.getDay());
}

/**
 * La plage ouverte à cet instant pour cet enfant, s'il y en a une.
 *
 * S'il y en a plusieurs, on rend celle qui se referme le plus tard : c'est
 * celle qui décrit vraiment jusqu'à quand l'écran reste ouvert, et c'est donc
 * la seule qu'on puisse afficher sans mentir.
 */
export function openWindowAt(
  fenetres: FreeWindow[],
  childId: ID | null,
  maintenant: Date = new Date(),
): FreeWindow | null {
  const minute = minuteDuJour(maintenant);
  const ouvertes = fenetres.filter(
    (f) =>
      f.enabled &&
      !estInterrompue(f, maintenant) &&
      concerne(f, childId) &&
      ceJourLa(f, maintenant) &&
      minute >= f.startMinute &&
      minute < f.endMinute,
  );
  if (ouvertes.length === 0) return null;
  return ouvertes.reduce((a, b) => (b.endMinute > a.endMinute ? b : a));
}

/**
 * La plage tombe aujourd'hui ET l'heure y est — qu'elle soit arrêtée ou non.
 *
 * C'est ce que le parent doit voir sur son écran d'accueil : celle qu'il peut
 * arrêter, et celle qu'il vient d'arrêter et peut reprendre. `openWindowAt`,
 * lui, répond à une autre question — « l'écran est-il ouvert ? » — et doit
 * donc continuer d'ignorer les plages arrêtées.
 */
export function dansSonCreneau(fenetre: FreeWindow, maintenant: Date = new Date()): boolean {
  if (!fenetre.enabled || !ceJourLa(fenetre, maintenant)) return false;
  const minute = minuteDuJour(maintenant);
  return minute >= fenetre.startMinute && minute < fenetre.endMinute;
}

/** Combien de minutes il reste avant que la plage se referme. */
export function minutesRestantes(fenetre: FreeWindow, maintenant: Date = new Date()): number {
  return Math.max(0, fenetre.endMinute - minuteDuJour(maintenant));
}

/**
 * La prochaine ouverture, pour la dire à un enfant qui demande.
 *
 * On regarde huit jours et non sept : aujourd'hui compte deux fois — une plage
 * du lundi peut être déjà passée ce lundi-ci et revenir lundi prochain, et
 * s'arrêter à sept jours ferait répondre « jamais » à une plage hebdomadaire
 * consultée après son passage.
 */
export function prochaineOuverture(
  fenetres: FreeWindow[],
  childId: ID | null,
  maintenant: Date = new Date(),
): { fenetre: FreeWindow; quand: Date } | null {
  let meilleure: { fenetre: FreeWindow; quand: Date } | null = null;

  for (let decalage = 0; decalage < 8; decalage += 1) {
    const jour = new Date(maintenant);
    jour.setDate(jour.getDate() + decalage);

    for (const fenetre of fenetres) {
      if (!fenetre.enabled || !concerne(fenetre, childId) || !ceJourLa(fenetre, jour)) continue;
      // Arrêtée aujourd'hui : elle ne rouvre pas aujourd'hui. Annoncer « à
      // 14 h » à l'enfant que son parent vient d'arrêter serait une promesse
      // que rien ne tiendra.
      if (estInterrompue(fenetre, jour)) continue;

      const debut = new Date(jour);
      debut.setHours(Math.floor(fenetre.startMinute / 60), fenetre.startMinute % 60, 0, 0);
      if (debut.getTime() <= maintenant.getTime()) continue;

      if (!meilleure || debut.getTime() < meilleure.quand.getTime()) {
        meilleure = { fenetre, quand: debut };
      }
    }
  }

  return meilleure;
}

/* ------------------------------------------------- le geste de l'appareil */

/**
 * Ce que l'appareil de l'enfant doit faire du bouclier, à cet instant.
 *
 * Sorti du magasin exprès. La décision tient en quatre cas, dont trois se sont
 * révélés faux au premier essai — et aucun ne se voit en relisant l'écran :
 *
 *   • une plage est ouverte → lever le bouclier jusqu'à sa fin ;
 *   • la plage qu'on avait levée est finie ou arrêtée → le reposer ;
 *   • **le profil a seulement changé de mains** — le parent touche « Espace
 *     parent » sur la tablette, `childId` tombe à `null` — et la plage, elle,
 *     n'a pas bougé : ne rien faire. Sans ce cas, l'écran se refermait au
 *     milieu du mercredi après-midi ;
 *   • **une séance tourne** : son bouclier appartient à `grant`/`revoke`. Le
 *     reposer ici prendrait à l'enfant des minutes qu'il a déjà payées.
 */
export type GestePlageLibre =
  | { kind: 'ouvrir'; fenetre: FreeWindow; minutes: number }
  /** Reposer le bouclier, et oublier la plage qu'on avait levée. */
  | { kind: 'refermer' }
  /** L'oublier sans rien reposer : une séance tient l'écran ouvert. */
  | { kind: 'oublier' }
  | { kind: 'rien' };

export function gestePlageLibre(params: {
  fenetres: FreeWindow[];
  /** Le profil ouvert sur cet appareil, `null` s'il n'y en a pas. */
  childId: ID | null;
  /** La plage pour laquelle CE processus a levé le bouclier, et pour qui. */
  levee: { id: ID; childId: ID | null } | null;
  /** Les enfants dont une séance tourne en ce moment. */
  enfantsEnSeance: ID[];
  maintenant?: Date;
}): GestePlageLibre {
  const { fenetres, childId, levee, enfantsEnSeance } = params;
  const maintenant = params.maintenant ?? new Date();

  const ouverte = openWindowAt(fenetres, childId, maintenant);
  if (ouverte) {
    const minutes = minutesRestantes(ouverte, maintenant);
    return minutes > 0 ? { kind: 'ouvrir', fenetre: ouverte, minutes } : { kind: 'rien' };
  }

  if (!levee) return { kind: 'rien' };

  // Est-ce NOTRE plage qui s'est fermée, ou seulement le profil qui a changé ?
  //
  // **Cette exemption ne vaut que pour l'espace parent, et l'oublier a ouvert
  // l'appareil au frère.** Elle existe pour un cas précis : le parent touche
  // « Espace parent » au milieu du mercredi après-midi, `childId` tombe à
  // `null`, et l'écran ne doit pas se refermer sur une plage qui court
  // toujours. Écrite sans condition sur `childId`, elle couvrait aussi le cas
  // où un AUTRE ENFANT ouvre son profil.
  //
  // Le scénario, sur une tablette partagée : plage « Mercredi après-midi »
  // cochée pour Manon seule. À 14 h Manon ouvre son profil, le bouclier tombe
  // — il est global à l'appareil, iOS comme Android n'en connaissent qu'un.
  // À 14 h 30 Noah change de profil : la plage n'est pas ouverte POUR LUI,
  // mais elle l'est encore pour Manon, donc on répondait « rien » et le
  // bouclier restait à terre jusqu'à 16 h. Noah avait toutes les applications
  // que le parent avait bloquées, et son écran ne lui annonçait rien.
  //
  // Si un profil d'enfant est ouvert, la seule question qui vaille est « cet
  // écran est-il ouvert pour LUI ? » — et le haut de cette fonction y a déjà
  // répondu non. On referme donc, et le profil de Manon rouvrira en revenant.
  const profilParent = childId === null;
  const memeEnfant = childId !== null && childId === levee.childId;
  const notre = fenetres.find((f) => f.id === levee.id);
  if (
    (profilParent || memeEnfant) &&
    notre &&
    openWindowAt([notre], levee.childId, maintenant)
  ) {
    return { kind: 'rien' };
  }

  const tenuParUneSeance = levee.childId
    ? enfantsEnSeance.includes(levee.childId)
    : enfantsEnSeance.length > 0;

  return tenuParUneSeance ? { kind: 'oublier' } : { kind: 'refermer' };
}

/* ------------------------------------------------------------ écriture */

export interface FreeWindowInput {
  label: string;
  childIds: ID[] | null;
  days: number[];
  date?: string;
  startMinute: number;
  endMinute: number;
}

/**
 * Ce qui empêche d'enregistrer une plage qui ne veut rien dire.
 *
 * Rend la phrase à montrer, ou `null` si tout va bien. Les messages disent ce
 * qu'il faut faire, jamais ce qui est « invalide » : un parent n'a pas à
 * traduire.
 */
export function valideFenetre(entree: FreeWindowInput): string | null {
  if (!entree.label.trim()) return 'Donnez un nom à cette plage, pour la retrouver.';

  if (!entree.date && entree.days.length === 0) {
    return 'Choisissez au moins un jour, ou une date précise.';
  }
  if (entree.date && entree.days.length > 0) {
    return 'Une plage se répète certains jours, ou n’arrive qu’une fois. Pas les deux.';
  }
  if (entree.date && !/^\d{4}-\d{2}-\d{2}$/.test(entree.date)) {
    return 'La date doit être au format AAAA-MM-JJ.';
  }

  const bornes = [entree.startMinute, entree.endMinute];
  if (bornes.some((m) => !Number.isInteger(m) || m < 0 || m > MINUTES_PAR_JOUR)) {
    return 'Les horaires doivent tenir dans une journée.';
  }
  if (entree.endMinute <= entree.startMinute) {
    // La règle 3 du haut de fichier, dite au parent plutôt qu'au développeur.
    return 'La fin doit venir après le début. Une plage ne traverse pas minuit.';
  }
  if (entree.childIds !== null && entree.childIds.length === 0) {
    return 'Choisissez au moins un enfant, ou laissez « toute la famille ».';
  }

  return null;
}

/* ------------------------------------------------------------ affichage */

/** `840` → `14:00`. */
export function heure(minute: number): string {
  const h = `${Math.floor(minute / 60)}`.padStart(2, '0');
  const m = `${minute % 60}`.padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * La plage en une phrase, pour un parent qui relit sa liste.
 *
 * « Tous les jours », « Le week-end » et « En semaine » plutôt que sept
 * initiales : ce sont les mots qu'une famille emploie, et une liste de réglages
 * qu'on ne peut pas lire d'un coup d'œil ne se relit jamais.
 */
export function decritFenetre(fenetre: FreeWindow, prenoms?: Map<ID, string>): string {
  const quand = fenetre.date
    ? `Le ${new Date(`${fenetre.date}T12:00:00`).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      })}`
    : decritJours(fenetre.days);

  const horaire = `de ${heure(fenetre.startMinute)} à ${heure(fenetre.endMinute)}`;

  const qui =
    fenetre.childIds === null
      ? 'toute la famille'
      : fenetre.childIds
          .map((id) => prenoms?.get(id) ?? 'un enfant')
          .join(', ');

  return `${quand} ${horaire} · ${qui}`;
}

function decritJours(jours: number[]): string {
  const tries = [...new Set(jours)].sort((a, b) => a - b);
  if (tries.length === 7) return 'Tous les jours';
  if (tries.length === 2 && tries[0] === 0 && tries[1] === 6) return 'Le week-end';
  if (tries.length === 5 && tries.every((j) => j >= 1 && j <= 5)) return 'En semaine';
  if (tries.length === 1) return `Le ${JOURS[tries[0]].long.toLowerCase()}`;
  return tries.map((j) => JOURS[j].long.slice(0, 3)).join(', ');
}
