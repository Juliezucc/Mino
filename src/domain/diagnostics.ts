/**
 * Ce qu'un signalement contient, et surtout ce qu'il ne contient pas.
 *
 * Un rapport de bug est le seul endroit de Mino où du texte écrit par un parent
 * quitte son téléphone pour arriver chez nous. C'est donc le seul endroit où la
 * règle du projet — ne rien collecter d'inutile sur un enfant — peut être
 * enfreinte par accident, en toute bonne foi, par un parent qui écrit
 * « Camille ne voit pas sa mission ».
 *
 * D'où le choix : la rédaction n'est pas un réglage, c'est une étape obligatoire
 * du chemin. On ne peut pas construire un rapport sans passer par elle.
 *
 * Ce qui part : la version, la plateforme, l'écran, des compteurs, et le texte
 * du parent une fois nettoyé.
 * Ce qui ne part jamais : un prénom d'enfant, une adresse e-mail, le code
 * famille, le code parent, l'historique, les intitulés de missions.
 */

export type ReportKind = 'manual' | 'crash';

export interface ReportContext {
  /** Version de l'application, telle qu'affichée dans les réglages. */
  appVersion: string;
  platform: string;
  osVersion?: string;
  /** L'écran d'où part le signalement — la première question du support. */
  route?: string;
  /** `local` ou `supabase` : dit tout de suite si le compte est synchronisé. */
  repository?: string;
  /** Volumétrie, pas contenu : trois enfants, douze missions, rien de plus. */
  counts?: { children: number; missions: number; devices: number };
}

export interface BugReport {
  kind: ReportKind;
  /** Le texte du parent, nettoyé. Vide pour un plantage. */
  message: string;
  /** La pile d'appels, nettoyée elle aussi. */
  stack?: string;
  context: ReportContext;
  /** Regroupe les occurrences d'un même problème. */
  fingerprint: string;
  createdAt: string;
}

/* --------------------------------------------------------------- rédaction */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** Quatre chiffres ou plus : code parent, code famille, numéro de téléphone. */
const LONG_DIGITS = /\b\d{4,}\b/g;
/** Un code famille : six caractères en majuscules, chiffres et lettres mêlés. */
const FAMILY_CODE = /\b(?=[A-Z0-9]{6}\b)(?=.*\d)[A-Z0-9]{6}\b/g;

/** Échappe ce qui a du sens dans une expression régulière. */
const escape = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Retire d'un texte tout ce qui identifie quelqu'un.
 *
 * Les prénoms sont passés en paramètre plutôt que devinés : deviner un prénom
 * dans une phrase française est un problème sans solution fiable, alors que
 * l'application connaît exactement la liste des prénoms qu'elle a enregistrés.
 * Le remplacement respecte les frontières de mots — « Léa » ne doit pas
 * transformer « Léa » en « [enfant] » à l'intérieur de « Léandre », ni laisser
 * passer « léa » en minuscules.
 */
export function redact(text: string, firstNames: string[] = []): string {
  let out = text;

  for (const name of firstNames) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    out = out.replace(new RegExp(`\\b${escape(trimmed)}\\b`, 'gi'), '[enfant]');
  }

  return out
    .replace(EMAIL, '[email]')
    .replace(FAMILY_CODE, '[code]')
    .replace(LONG_DIGITS, '[code]')
    .trim();
}

/**
 * Une pile d'appels sans les chemins de la machine.
 *
 * Sur un appareil réel, une pile contient le chemin du paquet et parfois le nom
 * de session de l'utilisateur. Rien de tout cela ne sert à corriger un bug.
 */
export function redactStack(stack: string): string {
  return stack
    .split('\n')
    .slice(0, 20)
    .map((line) => line.replace(/\(?(file|https?):\/\/[^\s)]+\/([^/\s)]+)\)?/g, '($2)'))
    .join('\n')
    .trim();
}

/* ------------------------------------------------------------ regroupement */

/**
 * Une empreinte courte et stable, pour compter les occurrences.
 *
 * Sans elle, cent parents touchés par le même plantage font cent tickets. Avec
 * elle, ils font une ligne « 100 fois » — ce qui n'est pas seulement plus
 * agréable à lire, c'est ce qui dit lequel corriger en premier.
 *
 * FNV-1a : quelques lignes, aucune dépendance. Il ne s'agit pas de
 * cryptographie mais de mettre ensemble ce qui se ressemble.
 */
export function fingerprint(parts: (string | undefined)[]): string {
  const input = parts.filter(Boolean).join('|').toLowerCase();
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

/* ---------------------------------------------------------------- montage */

export interface ReportInput {
  kind: ReportKind;
  message: string;
  stack?: string;
  context: ReportContext;
  /** Les prénoms à retirer du texte. */
  firstNames?: string[];
  now?: Date;
}

export function buildReport(input: ReportInput): BugReport {
  const message = redact(input.message, input.firstNames);
  const stack = input.stack ? redactStack(input.stack) : undefined;

  return {
    kind: input.kind,
    message,
    stack,
    context: input.context,
    // Un plantage se regroupe par sa pile ; un signalement écrit se regroupe par
    // l'écran d'où il part, car deux parents ne décrivent jamais un problème
    // avec les mêmes mots.
    fingerprint: fingerprint(
      input.kind === 'crash'
        ? ['crash', stack?.split('\n')[0], input.context.appVersion]
        : ['manual', input.context.route, input.context.appVersion],
    ),
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

/**
 * La référence donnée au parent, courte assez pour être lue au téléphone.
 * Elle contient l'empreinte : le support retrouve le groupe sans rien demander.
 */
export function referenceOf(report: BugReport): string {
  return `MINO-${report.fingerprint.slice(0, 4).toUpperCase()}-${report.createdAt.slice(11, 13)}${report.createdAt.slice(14, 16)}`;
}
