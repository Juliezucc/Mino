import { FAQ, FaqCategory, FaqEntry } from '@/content/faq';

/**
 * La recherche de la base de connaissance, et la réponse automatique.
 *
 * L'objectif n'est pas de faire une belle recherche : c'est de ne pas recevoir
 * le message. Un parent qui tape « ça bloque pas » à 21 h doit lire la réponse
 * tout de suite, pas attendre le lendemain. Chaque question à laquelle la
 * recherche répond est un message qui n'arrive jamais.
 *
 * D'où deux partis pris.
 *
 * La saisie est traitée comme elle arrive : sans accents, au pluriel, avec des
 * fautes. « telephone », « téléphones » et « telefone » ne doivent pas donner
 * trois résultats différents — et surtout pas zéro.
 *
 * Et quand une entrée gagne largement, elle est affichée **comme la réponse**
 * plutôt que dans une liste de résultats. Une liste de sept liens dont un est
 * bon est une liste que personne ne lit.
 */

/** Mots trop fréquents pour discriminer quoi que ce soit. */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'mon', 'ma', 'mes', 'son',
  'sa', 'ses', 'ce', 'cet', 'cette', 'que', 'qui', 'quoi', 'est', 'sont', 'pas',
  'ne', 'plus', 'pour', 'avec', 'dans', 'sur', 'par', 'en', 'y', 'me', 'se', 'ca',
  'comment', 'pourquoi', 'faire', 'fait', 'puis', 'peut', 'peux', 'veux', 'quand',
  // Ceux-ci apparaissent dans les mots-clés eux-mêmes (« sans téléphone »,
  // « pas de téléphone ») : sans eux, « sans rapport » remonterait une réponse.
  'sans', 'tout', 'toute', 'chose', 'quelque', 'autre', 'notre', 'votre', 'etre',
  'avoir', 'aussi', 'meme', 'tres', 'bien', 'chez', 'donc', 'alors',
]);

/**
 * Ramène un texte à sa forme comparable : sans accents, sans ponctuation,
 * sans majuscules. C'est la seule étape qui compte vraiment — tout le reste de
 * la recherche s'écroule si « écran » et « ecran » ne sont pas le même mot.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Coupe une phrase en mots utiles.
 *
 * Le pluriel est retiré grossièrement — pas de vraie racinisation, qui
 * demanderait une bibliothèque pour un gain nul sur cinquante entrées.
 */
export function tokenize(input: string): string[] {
  return normalize(input)
    .split(' ')
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 4 && /(s|x)$/.test(word) ? word.slice(0, -1) : word));
}

export interface FaqMatch {
  entry: FaqEntry;
  score: number;
}

const POINTS = {
  /** La question entière retrouvée telle quelle : il n'y a plus de doute. */
  phrase: 12,
  /** Les mots-clés sont écrits à la main pour être trouvés. Ils pèsent le plus. */
  keyword: 5,
  question: 3,
  answer: 1,
};

/**
 * Deux mots sont-ils le même mot ?
 *
 * Une conjugaison ne doit pas faire échouer une recherche : quelqu'un qui écrit
 * « vous localisez » cherche « localiser ». Cinq caractères de préfixe commun
 * suffisent à les rapprocher sans confondre « téléphone » et « télévision »,
 * qui n'en partagent que quatre.
 */
const MIN_PREFIX = 5;

function alike(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < MIN_PREFIX || b.length < MIN_PREFIX) return false;

  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1;
  return shared >= MIN_PREFIX;
}

/**
 * L'index, construit une fois.
 *
 * Les mots-clés sont comparés mot à mot et non comme des morceaux de texte :
 * le mot-clé « sans téléphone » ne doit répondre qu'à « téléphone ».
 */
interface Indexed {
  entry: FaqEntry;
  keywords: string[];
  question: string[];
  answer: string[];
  phrase: string;
}

function buildIndex(entries: FaqEntry[]): Indexed[] {
  return entries.map((entry) => ({
    entry,
    keywords: entry.keywords.flatMap((k) => tokenize(k)),
    question: tokenize(entry.question),
    answer: tokenize(entry.answer),
    phrase: normalize(entry.question),
  }));
}

const DEFAULT_INDEX = buildIndex(FAQ);

function scoreEntry(indexed: Indexed, query: string, tokens: string[]): number {
  let score = 0;
  if (query.length >= 6 && indexed.phrase.includes(query)) score += POINTS.phrase;

  for (const token of tokens) {
    if (indexed.keywords.some((k) => alike(k, token))) score += POINTS.keyword;
    if (indexed.question.some((w) => alike(w, token))) score += POINTS.question;
    if (indexed.answer.some((w) => alike(w, token))) score += POINTS.answer;
  }

  return score;
}

/** Les entrées qui répondent, la meilleure d'abord. */
export function searchFaq(query: string, entries: FaqEntry[] = FAQ, limit = 6): FaqMatch[] {
  const normalized = normalize(query);
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const index = entries === FAQ ? DEFAULT_INDEX : buildIndex(entries);

  return index
    .map((indexed) => ({ entry: indexed.entry, score: scoreEntry(indexed, normalized, tokens) }))
    // En dessous d'un mot-clé touché, ce n'est plus une réponse, c'est un hasard.
    .filter((match) => match.score >= POINTS.keyword)
    .sort((a, b) => b.score - a.score || a.entry.question.localeCompare(b.entry.question))
    .slice(0, limit);
}

export interface AutoAnswer {
  entry: FaqEntry;
  /**
   * `sure` : affichée comme LA réponse.
   * `maybe` : proposée parmi d'autres.
   */
  confidence: 'sure' | 'maybe';
}

/**
 * La réponse automatique.
 *
 * Une entrée n'est donnée comme certaine que si elle devance nettement la
 * suivante. Deux réponses proches valent mieux affichées côte à côte : se
 * tromper avec assurance sur « mon enfant ne voit pas sa mission » coûte plus
 * cher que d'avoir proposé deux pistes.
 */
export function answerFor(query: string, entries: FaqEntry[] = FAQ): AutoAnswer | null {
  const matches = searchFaq(query, entries, 2);
  if (matches.length === 0) return null;

  const [best, second] = matches;
  const decisive = !second || best.score >= second.score * 1.6;

  return { entry: best.entry, confidence: decisive ? 'sure' : 'maybe' };
}

export function faqByCategory(category: FaqCategory, entries: FaqEntry[] = FAQ): FaqEntry[] {
  return entries.filter((entry) => entry.category === category);
}
