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
      concerne(f, childId) &&
      ceJourLa(f, maintenant) &&
      minute >= f.startMinute &&
      minute < f.endMinute,
  );
  if (ouvertes.length === 0) return null;
  return ouvertes.reduce((a, b) => (b.endMinute > a.endMinute ? b : a));
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
