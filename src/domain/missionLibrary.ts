import { Child, RepeatRule } from './types';

/**
 * Ready-made missions, grouped into the routines families actually run.
 *
 * A parent opening "nouvelle mission" in front of a blank field has to invent
 * their own parenting method on the spot. Routines answer the real question —
 * "what should the evening look like?" — and hand back a whole coherent set in
 * one tap. Everything stays editable afterwards: these are suggestions, not a
 * program someone else decided for the family.
 *
 * Two filters keep the list honest: the child's age, and whether they have a
 * brother or sister. Suggesting "dire un mot gentil à son frère" to an only
 * child is the kind of detail that makes an app feel written by nobody.
 */

export interface MissionSuggestion {
  id: string;
  /** `{enfant}` is replaced by the sibling's first name — see `resolveTitle`. */
  title: string;
  icon: string;
  minutes: number;
  /** Age range this reads well for, inclusive. */
  ages: [number, number];
  /** Only offered to a child who has at least one brother or sister. */
  sibling?: boolean;
}

export interface MissionRoutine {
  id: string;
  title: string;
  icon: string;
  /** One line telling the parent what this routine is for. */
  tagline: string;
  repeat: RepeatRule;
  suggestions: MissionSuggestion[];
}

/** Used when a child has several siblings, so no single name fits. */
export const SIBLING_FALLBACK = 'mon frère ou ma sœur';

export const ROUTINES: MissionRoutine[] = [
  {
    id: 'matin',
    title: 'Routine du matin',
    icon: '☀️',
    tagline: 'Partir à l’heure sans répéter dix fois',
    repeat: { kind: 'weekdays', days: [1, 2, 3, 4, 5] },
    suggestions: [
      { id: 'lever', title: 'Me lever à la première fois', icon: '⏰', minutes: 10, ages: [5, 12] },
      { id: 'habiller', title: 'M’habiller tout seul', icon: '👕', minutes: 5, ages: [5, 9] },
      { id: 'petit-dej', title: 'Prendre mon petit-déjeuner', icon: '🥣', minutes: 5, ages: [5, 12] },
      { id: 'dents-matin', title: 'Me brosser les dents', icon: '🪥', minutes: 5, ages: [5, 12] },
      { id: 'cartable', title: 'Préparer mon cartable', icon: '🎒', minutes: 10, ages: [6, 12] },
    ],
  },
  {
    id: 'coucher',
    title: 'Routine du coucher',
    icon: '🌙',
    tagline: 'Une soirée calme, dans le même ordre chaque soir',
    repeat: { kind: 'daily' },
    suggestions: [
      { id: 'ranger-soir', title: 'Ranger mes affaires du jour', icon: '🧺', minutes: 10, ages: [5, 12] },
      { id: 'pyjama', title: 'Mettre mon pyjama', icon: '🌜', minutes: 5, ages: [5, 9] },
      { id: 'dents-soir', title: 'Me brosser les dents', icon: '🪥', minutes: 5, ages: [5, 12] },
      { id: 'demain', title: 'Préparer mes affaires pour demain', icon: '👟', minutes: 10, ages: [6, 12] },
      { id: 'lecture', title: 'Lire 10 minutes', icon: '📖', minutes: 15, ages: [6, 12] },
    ],
  },
  {
    id: 'ensemble',
    title: 'Vivre ensemble',
    icon: '💛',
    tagline: 'Les petits gestes entre frères et sœurs',
    repeat: { kind: 'daily' },
    suggestions: [
      { id: 'mot-gentil', title: 'Dire un mot gentil à {enfant}', icon: '💬', minutes: 10, ages: [5, 12], sibling: true },
      { id: 'jouer', title: 'Jouer avec {enfant}', icon: '🎲', minutes: 15, ages: [5, 12], sibling: true },
      { id: 'aider-ranger', title: 'Aider {enfant} à ranger', icon: '🤝', minutes: 10, ages: [6, 12], sibling: true },
      { id: 'partager', title: 'Partager sans me disputer', icon: '🕊️', minutes: 10, ages: [5, 10], sibling: true },
      { id: 'gouter-ensemble', title: 'Préparer le goûter pour tout le monde', icon: '🍎', minutes: 15, ages: [8, 12], sibling: true },
    ],
  },
  {
    id: 'ecole',
    title: 'Devoirs et école',
    icon: '📚',
    tagline: 'Le travail du soir, sans la bataille',
    repeat: { kind: 'weekdays', days: [1, 2, 4, 5] },
    suggestions: [
      { id: 'devoirs', title: 'Faire mes devoirs', icon: '📝', minutes: 20, ages: [6, 12] },
      { id: 'lecons', title: 'Relire mes leçons', icon: '📚', minutes: 15, ages: [7, 12] },
      { id: 'bureau', title: 'Ranger mon bureau', icon: '🗂️', minutes: 5, ages: [6, 12] },
      { id: 'signer', title: 'Montrer mon cahier de liaison', icon: '📒', minutes: 5, ages: [6, 12] },
    ],
  },
  {
    id: 'table',
    title: 'À table',
    icon: '🍽️',
    tagline: 'Chacun sa part avant et après le repas',
    repeat: { kind: 'daily' },
    suggestions: [
      { id: 'mettre-table', title: 'Mettre la table', icon: '🍴', minutes: 10, ages: [5, 12] },
      { id: 'debarrasser', title: 'Débarrasser la table', icon: '🍽️', minutes: 10, ages: [5, 12] },
      { id: 'lave-vaisselle', title: 'Vider le lave-vaisselle', icon: '🧽', minutes: 15, ages: [8, 12] },
      { id: 'cuisine', title: 'Aider à préparer le repas', icon: '🥕', minutes: 15, ages: [7, 12] },
    ],
  },
  {
    id: 'chambre',
    title: 'Ma chambre',
    icon: '🧸',
    tagline: 'Son espace, sa responsabilité',
    repeat: { kind: 'daily' },
    suggestions: [
      { id: 'lit', title: 'Faire mon lit', icon: '🛏️', minutes: 5, ages: [5, 12] },
      { id: 'ranger-chambre', title: 'Ranger ma chambre', icon: '🧸', minutes: 15, ages: [5, 12] },
      { id: 'linge-sale', title: 'Mettre mon linge sale au panier', icon: '🧺', minutes: 5, ages: [5, 12] },
      { id: 'plier', title: 'Ranger mes vêtements propres', icon: '👚', minutes: 10, ages: [7, 12] },
    ],
  },
  {
    id: 'soin',
    title: 'Prendre soin de moi',
    icon: '🚿',
    tagline: 'L’autonomie du quotidien',
    repeat: { kind: 'daily' },
    suggestions: [
      { id: 'douche', title: 'Prendre ma douche tout seul', icon: '🚿', minutes: 15, ages: [6, 12] },
      { id: 'mains', title: 'Me laver les mains en rentrant', icon: '🧼', minutes: 5, ages: [5, 9] },
      { id: 'coiffer', title: 'Me coiffer', icon: '💇', minutes: 5, ages: [5, 12] },
      { id: 'bouger', title: 'Bouger 30 minutes dehors', icon: '⚽', minutes: 20, ages: [5, 12] },
    ],
  },
  {
    id: 'maison',
    title: 'Coup de main à la maison',
    icon: '🧹',
    tagline: 'Participer à la vie de la famille',
    repeat: { kind: 'weekdays', days: [3, 6] },
    suggestions: [
      { id: 'poubelles', title: 'Sortir les poubelles', icon: '🗑️', minutes: 10, ages: [8, 12] },
      { id: 'plantes', title: 'Arroser les plantes', icon: '🪴', minutes: 5, ages: [5, 12] },
      { id: 'animal', title: 'M’occuper de l’animal', icon: '🐶', minutes: 15, ages: [6, 12] },
      { id: 'aspirateur', title: 'Passer l’aspirateur dans une pièce', icon: '🧹', minutes: 15, ages: [9, 12] },
      { id: 'courses', title: 'Aider à ranger les courses', icon: '🛒', minutes: 10, ages: [6, 12] },
    ],
  },
];

/** Puts the sibling's own name into a suggestion, when there is one to use. */
export function resolveTitle(suggestion: MissionSuggestion, siblings: Child[]): string {
  if (!suggestion.title.includes('{enfant}')) return suggestion.title;
  const name = siblings.length === 1 ? siblings[0].firstName : SIBLING_FALLBACK;
  return suggestion.title.replace('{enfant}', name);
}

/** Is this suggestion a fit for that child, in that family? */
export function suits(suggestion: MissionSuggestion, child: Child, siblings: Child[]): boolean {
  if (suggestion.sibling && siblings.length === 0) return false;
  return child.age >= suggestion.ages[0] && child.age <= suggestion.ages[1];
}

/** A routine, trimmed to what fits this child. Empty routines are dropped. */
export function routinesFor(child: Child, siblings: Child[]): MissionRoutine[] {
  return ROUTINES.map((routine) => ({
    ...routine,
    suggestions: routine.suggestions.filter((s) => suits(s, child, siblings)),
  })).filter((routine) => routine.suggestions.length > 0);
}

/**
 * A flat, de-duplicated list for the "missions prêtes à l'emploi" row on the
 * creation form. Ordered as the routines are, so the morning comes first.
 */
export function suggestionsFor(child: Child | null, siblings: Child[]): MissionSuggestion[] {
  const seen = new Set<string>();
  const out: MissionSuggestion[] = [];
  for (const routine of ROUTINES) {
    for (const suggestion of routine.suggestions) {
      if (seen.has(suggestion.title)) continue;
      if (child && !suits(suggestion, child, siblings)) continue;
      if (!child && suggestion.sibling && siblings.length === 0) continue;
      seen.add(suggestion.title);
      out.push(suggestion);
    }
  }
  return out;
}
