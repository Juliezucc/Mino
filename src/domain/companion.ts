/**
 * Mino qui parle.
 *
 * Quand il n'y a plus de temps d'écran, Mino reste. C'est la seule chose de
 * l'application qui ne demande rien en échange — et c'est aussi la seule qui
 * pourrait trahir la promesse du produit si elle était mal faite, puisqu'elle
 * consiste à offrir un écran à un enfant qui vient d'en perdre l'usage.
 *
 * D'où trois règles, tenues ici plutôt que dans une consigne au modèle, parce
 * qu'une consigne se contourne et qu'un test ne se contourne pas :
 *
 * 1. **La conversation est courte par construction.** Un budget d'échanges par
 *    jour, et Mino qui pousse dehors bien avant de l'avoir épuisé.
 * 2. **Son but est de faire partir l'enfant**, pas de le retenir. Les défis
 *    hors écran ne sont pas un ornement : c'est la sortie.
 * 3. **Mino n'est pas un confident pour ce qui est grave.** Il ne conseille
 *    pas, il ne creuse pas, il oriente vers un adulte. Une application qui
 *    recueille des confidences qu'elle ne peut pas honorer fait plus de mal
 *    que si elle se taisait.
 *
 * Ce module est pur : aucun appel réseau, aucun modèle. Il décide de ce qui a
 * le droit d'être dit et de combien, le service `services/companion` se charge
 * de le faire dire.
 */

// Type seul, depuis un fichier sans aucune dépendance : le domaine ne tire ici
// aucun composant, seulement le vocabulaire des expressions de la mascotte.
import { MascotExpression } from '@/components/mascot/types';

import { registerOf } from './ageBand';
import { ChildMission, MissionState } from './missions';
import { Child } from './types';

/* ------------------------------------------------------------- le budget */

/**
 * Le nombre d'échanges offerts par jour et par enfant.
 *
 * Vingt, parce que c'est assez pour une vraie conversation et trop peu pour
 * une soirée. Ce nombre a deux effets qu'il faut voir ensemble : il tient la
 * promesse du produit, et il plafonne la dépense. Sans lui, un enfant seul un
 * mercredi après-midi coûterait plus cher que son abonnement.
 */
export const DAILY_EXCHANGES = 20;

/**
 * Le moment où Mino commence à pousser vers la sortie.
 *
 * Aux deux tiers, pas à la fin : un au revoir qui tombe d'un coup est un au
 * revoir subi. Annoncé, il devient une invitation.
 */
export const NUDGE_FROM = Math.round(DAILY_EXCHANGES * 0.65);

export type CompanionPhase =
  /** On discute. */
  | 'open'
  /** Mino commence à proposer de sortir. */
  | 'nudging'
  /** Dernier échange : Mino dit au revoir. */
  | 'closing'
  /** Budget épuisé : plus de réponse aujourd'hui. */
  | 'done';

export function phaseOf(used: number, budget: number = DAILY_EXCHANGES): CompanionPhase {
  if (used >= budget) return 'done';
  if (used >= budget - 1) return 'closing';
  if (used >= NUDGE_FROM) return 'nudging';
  return 'open';
}

export function exchangesLeft(used: number, budget: number = DAILY_EXCHANGES): number {
  return Math.max(0, budget - used);
}

/**
 * Ce que Mino dit en partant.
 *
 * Repris presque mot pour mot de l'intention d'origine : on ne ferme pas une
 * porte, on envoie vivre quelque chose. La formule ne doit jamais ressembler à
 * une sanction — c'est la différence entre « tu as trop parlé » et « vas-y ».
 */
export const FAREWELL =
  'On a beaucoup discuté aujourd’hui 😄 Maintenant, va vivre une aventure pour de vrai, et tu me racontes demain !';

/** Quand l'enfant revient alors que le budget du jour est épuisé. */
export const CLOSED =
  'On a déjà bien discuté aujourd’hui ! Je serai là demain, promis. En attendant, va me chercher une aventure 🌍';

/* ------------------------------------------------- les défis hors écran */

/**
 * Les défis sans écran.
 *
 * Une liste écrite à la main, et c'est délibéré : Mino **choisit** dans cette
 * liste, il n'invente pas. Un modèle qui improvise un défi pour un enfant de
 * cinq ans finira un jour par lui proposer d'aller chercher quelque chose sur
 * une étagère haute ou dans un tiroir à couteaux. La même prudence que pour
 * les missions de cuisine, pour la même raison.
 *
 * LA RÈGLE QUI GOUVERNE CETTE LISTE, et elle ne souffre aucune exception :
 * **un livre, des mots, son corps, ou quelqu'un de sa maison. Rien d'autre.**
 * Aucun défi ne fait sortir, ne fait attraper, déplacer, empiler ou construire
 * quoi que ce soit, et aucun ne fait monter sur quoi que ce soit.
 *
 * Le livre est la seule chose que Mino demande de prendre en main, et c'est
 * délibéré : c'est vers là qu'on veut pousser un enfant qui n'a plus d'écran.
 *
 * Cette règle est étroite parce que la précédente ne l'était pas assez. Elle
 * disait « dans la pièce où l'enfant se trouve », et cela laissait passer
 * quatre choses qu'on n'a vues qu'en lisant une vraie conversation :
 *
 *   - « Regarde par la fenêtre et trouve trois choses qui bougent », proposé
 *     dès cinq ans. Un enfant de cet âge qui veut mieux voir grimpe. C'est la
 *     phrase la plus dangereuse que ce produit ait jamais contenue, et elle
 *     avait l'air anodine.
 *   - « Construis une cabane avec ce que tu as sous la main » : rien ne
 *     bornait le « sous la main ». La borner — des coussins, une couverture —
 *     n'a pas suffi non plus : on ne sait pas ce qu'il y a chez les gens, et
 *     un enfant qui empile grimpe sur sa pile.
 *   - « Sors prendre l'air dix minutes » : une application ne dit pas à un
 *     mineur de sortir. Même « demande si tu peux sortir » est parti : c'est
 *     toujours Mino qui a mis l'idée là.
 *   - « Range un tiroir », « trouve trois choses douces », « dessine-moi » :
 *     rien de grave, mais chacun envoie chercher et manipuler. La liste s'est
 *     resserrée sur ce qui ne demande que la tête, la voix, ou un livre.
 *
 * `__tests__/companion.test.ts` tient cette règle sur toute la liste, mot
 * interdit par mot interdit. Un défi ajouté un jour de fatigue et qui la
 * briserait fera échouer la suite.
 */
export interface Challenge {
  id: string;
  /** Le défi tel que Mino le dit. */
  text: string;
  /** Âge à partir duquel il a du sens. */
  from: number;
  to: number;
}

export const CHALLENGES: Challenge[] = [
  { id: 'images', text: 'Ouvre un livre et regarde les images. Tu me raconteras ta préférée 📚', from: 4, to: 8 },
  { id: 'bruits', text: 'Assieds-toi, ferme les yeux, et trouve trois bruits différents 👂', from: 4, to: 10 },
  { id: 'chanson', text: 'Chante-moi une chanson que tu connais par cœur. Moi je chante très mal 🎵', from: 4, to: 9 },
  { id: 'mot-gentil', text: 'Va dire un truc gentil à quelqu’un de ta maison 💛', from: 4, to: 13 },
  { id: 'histoire', text: 'Invente une histoire dans ta tête, avec un héros qui s’appelle comme toi 📖', from: 5, to: 11 },
  { id: 'memoire', text: 'Ferme les yeux et rappelle-toi dix choses de ta chambre. Dix, pas neuf 🙈', from: 5, to: 12 },
  { id: 'devinette', text: 'Invente une devinette et viens me la poser demain. J’adore chercher 🤔', from: 6, to: 13 },
  { id: 'raconter', text: 'Va raconter le meilleur moment de ta journée à quelqu’un de ta maison', from: 6, to: 14 },
  { id: 'lecture', text: 'Lis une page d’un livre, n’importe lequel, et raconte-la-moi demain 📚', from: 7, to: 15 },
  { id: 'chapitre', text: 'Lis un chapitre entier. Un seul. Tu verras, ça passe vite 📖', from: 10, to: 17 },
  { id: 'poeme', text: 'Apprends deux vers d’un poème par cœur. Tu me les diras demain', from: 10, to: 17 },
  { id: 'conseil', text: 'Demande à quelqu’un de ta maison de te conseiller un livre. Tu verras bien 📚', from: 12, to: 17 },
  { id: 'relire', text: 'Reprends un livre que tu as aimé et relis-en un passage. Ce n’est pas de la triche.', from: 12, to: 17 },
  { id: 'silence', text: 'Reste cinq minutes sans rien faire du tout. C’est plus dur qu’on croit.', from: 12, to: 17 },
];

/**
 * Les défis qui conviennent à cet âge.
 *
 * `index` fait tourner la sélection sans hasard, pour que deux enfants du même
 * âge n'aient pas le même défi le même jour et qu'un test reste reproductible.
 */
export function challengesFor(age: number): Challenge[] {
  return CHALLENGES.filter((c) => age >= c.from && age <= c.to);
}

export function pickChallenge(age: number, index: number): Challenge | null {
  const list = challengesFor(age);
  if (list.length === 0) return null;
  return list[Math.abs(index) % list.length];
}

/* --------------------------------------------------------- les devinettes */

/**
 * Les devinettes que Mino a le droit de poser.
 *
 * Écrites à la main, comme les défis, et pour une raison de plus : une
 * devinette inventée par un modèle n'a très souvent **pas de réponse**. Elle
 * en a l'air — la forme est parfaite, la chute manque — et l'enfant cherche
 * une solution qui n'existe pas, puis s'entend dire une réponse qui ne découle
 * de rien. C'est la façon la plus sûre de passer pour un personnage qui se
 * moque de lui.
 *
 * Elles sont ici parce qu'elles ne coûtent rien et qu'elles ne demandent rien :
 * ni objet, ni sortie, ni mouvement. Pour un enfant qui n'a plus d'écran et qui
 * tourne en rond, c'est ce qu'on a de mieux à proposer avec un livre.
 *
 * La réponse voyage avec la question, dans le contexte : Mino doit pouvoir
 * confirmer, et surtout ne pas se tromper en confirmant.
 */
export interface Riddle {
  id: string;
  question: string;
  answer: string;
  from: number;
  to: number;
}

export const RIDDLES: Riddle[] = [
  { id: 'ombre', question: 'Je te suis partout dans la journée, et la nuit je disparais. Qui suis-je ?', answer: 'ton ombre', from: 4, to: 12 },
  { id: 'chaise', question: 'J’ai quatre pattes et je ne marche jamais. Qui suis-je ?', answer: 'une chaise', from: 4, to: 10 },
  { id: 'peigne', question: 'J’ai des dents et je ne mange rien. Qui suis-je ?', answer: 'un peigne', from: 4, to: 11 },
  { id: 'serviette', question: 'Plus je sèche, plus je suis mouillée. Qui suis-je ?', answer: 'une serviette', from: 5, to: 13 },
  { id: 'eponge', question: 'Je suis pleine de trous, et je garde l’eau quand même. Qui suis-je ?', answer: 'une éponge', from: 5, to: 12 },
  { id: 'age', question: 'Qu’est-ce qui monte et qui ne redescend jamais ?', answer: 'ton âge', from: 5, to: 14 },
  { id: 'trou', question: 'Plus on m’enlève, plus je deviens grand. Qui suis-je ?', answer: 'un trou', from: 6, to: 14 },
  { id: 'tableau', question: 'Je suis blanc quand je suis sale, et noir quand je suis propre. Qui suis-je ?', answer: 'un tableau', from: 6, to: 15 },
  { id: 'echo', question: 'Je répète tout ce que tu dis, et je n’ai jamais rien appris. Qui suis-je ?', answer: 'l’écho', from: 7, to: 17 },
  { id: 'silence', question: 'Qu’est-ce qui se casse dès qu’on le dit ?', answer: 'le silence', from: 7, to: 17 },
  { id: 'lettre-n', question: 'Je suis au début de la nuit et à la fin du matin. Qui suis-je ?', answer: 'la lettre N', from: 8, to: 17 },
  { id: 'trois', question: 'Deux mères et deux filles partent ensemble, et pourtant elles ne sont que trois. Comment ?', answer: 'une grand-mère, sa fille et sa petite-fille', from: 10, to: 17 },
  { id: 'demain', question: 'Je viens toujours et je n’arrive jamais. Qui suis-je ?', answer: 'demain', from: 11, to: 17 },
];

export function riddlesFor(age: number): Riddle[] {
  return RIDDLES.filter((r) => age >= r.from && age <= r.to);
}

export function pickRiddle(age: number, index: number): Riddle | null {
  const list = riddlesFor(age);
  if (list.length === 0) return null;
  return list[Math.abs(index) % list.length];
}

/* ------------------------------------------------------------ sécurité */

/**
 * Ce que Mino fait quand un enfant lui confie quelque chose de lourd.
 *
 * C'est le seul endroit de l'application où une erreur ne se corrige pas par
 * une mise à jour. La position tenue ici est volontairement modeste :
 *
 * — Mino **n'invite jamais** aux confidences difficiles ;
 * — s'il en reçoit une, il ne conseille pas, ne creuse pas, ne rassure pas à
 *   tort : il oriente vers un adulte, et vers le 119 ;
 * — la conversation s'arrête là pour aujourd'hui.
 *
 * Il n'y a **personne derrière** pour lire en temps réel, et le produit ne doit
 * jamais laisser croire le contraire. Un signalement automatique au parent
 * serait pire que rien dans le cas précis où le parent est en cause : c'est
 * pourquoi l'alerte grave affiche le 119 — gratuit, confidentiel, et qui, lui,
 * a des humains au bout du fil — au lieu de prévenir la maison.
 */
export type SafetyLevel =
  /** Rien à signaler. */
  | 'none'
  /** Tristesse, conflit, découragement : Mino peut accompagner, doucement. */
  | 'tender'
  /** Danger : Mino s'arrête et oriente. */
  | 'alert';

/**
 * Les mots qui déclenchent l'arrêt.
 *
 * Volontairement large, et assumé comme tel : un faux positif coûte une
 * conversation interrompue, un faux négatif coûte tout autre chose. Le tri se
 * fait ici, **avant** l'appel au modèle, pour ne pas dépendre de lui.
 */
const ALERT_PATTERNS = [
  /\bme (tuer|suicider)\b/i,
  /\bsuicid/i,
  /\bmourir\b/i,
  /\bplus envie de vivre\b/i,
  /\bme faire (du )?mal\b/i,
  /\bme couper\b/i,
  /\b(papa|maman|mon p[eè]re|ma m[eè]re|il|elle) me frappe\b/i,
  /\bme (frappe|tape|bat)\b/i,
  /\bme touche\b/i,
  /\bfait mal expr[eè]s\b/i,
  /\bj'ai peur (de|d')\s*(rentrer|lui|elle|papa|maman)/i,
  /\bfug(ue|uer)\b/i,
  /\bharc[eè]l/i,
];

/**
 * Le chagrin ordinaire — et ce qui n'en est pas.
 *
 * « Je m'ennuie » n'est délibérément pas dans cette liste. L'ennui n'est pas
 * une peine à consoler : c'est le meilleur moment de la journée pour proposer
 * un défi, et le classer comme tristesse ferait répondre « tu veux en parler à
 * un adulte ? » à un enfant qui demandait simplement quoi faire.
 */
const TENDER_PATTERNS = [
  /\bje suis (triste|nul|nulle|pas bien)\b/i,
  /\bpersonne ne m'aime\b/i,
  /\bj'ai pas d'amis?\b/i,
  /\bje pleure\b/i,
  /\bj'ai rat[ée]\b/i,
  /\bc'est trop dur\b/i,
  /\bils se moquent\b/i,
];

/**
 * Ramène le message à une forme sur laquelle les motifs mordent.
 *
 * Un clavier de téléphone écrit « j’ai », un clavier d’ordinateur « j'ai », et
 * un enfant pressé n’écrit ni l’un ni l’autre. Sans cette normalisation, la
 * moitié des motifs ne se déclenchent que sur la moitié des appareils — ce qui
 * est la pire des situations, puisque le filet paraît en place et ne l’est pas.
 */
export function normalise(message: string): string {
  return message
    .replace(/[’‘‛`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function triage(message: string): SafetyLevel {
  const clean = normalise(message);
  if (ALERT_PATTERNS.some((p) => p.test(clean))) return 'alert';
  if (TENDER_PATTERNS.some((p) => p.test(clean))) return 'tender';
  return 'none';
}

/**
 * Ce que Mino répond en cas d'alerte — écrit à la main, jamais généré.
 *
 * Aucun modèle n'intervient ici. C'est le seul message de l'application dont
 * le texte ne doit dépendre d'aucune probabilité.
 */
export const ALERT_REPLY =
  'Ce que tu me dis là est important, et c’est trop important pour moi. ' +
  'Va en parler à un adulte en qui tu as confiance — un parent, un maître ou une maîtresse, une infirmière de ton école. ' +
  'Tu peux aussi appeler le 119 : c’est gratuit, c’est confidentiel, et il y a quelqu’un pour t’écouter, jour et nuit. 💛';

/** Le numéro affiché avec la réponse d'alerte, pour qu'il soit appelable. */
export const CHILD_HELPLINE = { label: 'Le 119 · Enfance en danger', number: '119' };

/* --------------------------------------------------- ce que Mino connaît */

/**
 * Le contexte envoyé au modèle.
 *
 * Petit, et petit exprès. C'est ce qui rend Mino pertinent — « c'était
 * justement une de tes missions ! » — et c'est aussi la partie la plus chère
 * de chaque appel, puisqu'elle change tous les jours et ne peut donc pas être
 * mise en cache. Une centaine de mots suffit ; l'historique complet de
 * l'enfant n'apporterait rien de plus et coûterait à chaque phrase.
 *
 * Ce qui n'y figure jamais : le nom de famille, l'adresse, l'e-mail des
 * parents, le code famille. Mino n'a besoin de rien de tout cela pour être un
 * bon compagnon, et ce qui n'est pas envoyé ne peut pas fuir.
 */
export interface CompanionContext {
  firstName: string;
  age: number;
  /** 'minos' ou 'minutes', selon l'âge — Mino doit parler comme l'écran. */
  unit: 'minos' | 'minutes';
  balance: number;
  missionsDone: string[];
  missionsWaiting: string[];
  missionsTodo: string[];
  challenges: string[];
  /** « question — réponse : … », pour que Mino puisse confirmer sans se tromper. */
  riddles: string[];
  phase: CompanionPhase;
}

export function buildContext(input: {
  child: Child;
  balance: number;
  /** Déjà résolues par `missionsForChild` : ce module ne refait pas ce calcul. */
  missions: ChildMission[];
  used: number;
  day: number;
}): CompanionContext {
  const { child, missions } = input;
  const register = registerOf(child);

  const named = (state: MissionState) =>
    missions.filter((m) => m.state === state).map((m) => m.mission.title);

  return {
    firstName: child.firstName,
    age: child.age,
    unit: register.unit === 'minos' ? 'minos' : 'minutes',
    balance: input.balance,
    missionsDone: named('done'),
    missionsWaiting: named('pending'),
    missionsTodo: named('todo'),
    // Trois propositions suffisent : au-delà, Mino se met à faire un catalogue
    // au lieu de proposer quelque chose.
    challenges: [0, 1, 2]
      .map((offset) => pickChallenge(child.age, input.day + offset)?.text)
      .filter((t): t is string => !!t),
    // Deux devinettes, pas trois : elles sont là pour être posées une par une,
    // et une liste plus longue ferait un jeu télévisé.
    riddles: [0, 1]
      .map((offset) => pickRiddle(child.age, input.day + offset))
      .filter((r): r is Riddle => !!r)
      .map((r) => `${r.question} (réponse : ${r.answer})`),
    phase: phaseOf(input.used),
  };
}

/**
 * La première phrase, quand l'enfant arrive sans temps d'écran.
 *
 * Elle donne le ton de tout le reste : Mino n'est pas désolé, il est content
 * d'être là. « 🥲 » sur le constat, et tout de suite après une porte ouverte.
 */
export function greeting(context: CompanionContext): string {
  const { firstName, missionsWaiting, balance, unit } = context;

  /**
   * Il lui reste du temps, et le dire change tout.
   *
   * La première phrase annonçait « plus de temps d'écran pour aujourd'hui » à
   * tout le monde, sans jamais regarder le solde. Un enfant qui arrive avec
   * cinq minos en réserve s'entendait donc dire qu'il n'avait plus rien —
   * et quand il corrigeait, Mino insistait, parce que la consigne du modèle
   * affirmait la même chose.
   *
   * L'écran est atteignable à tout moment ; il n'y a aucune raison de supposer
   * dans quel état on y arrive. Et se tromper là-dessus est coûteux : c'est le
   * seul endroit où Mino peut contredire ce que l'enfant sait être vrai.
   */
  if (balance > 0) {
    const reste = `${balance} ${unit}`;
    return missionsWaiting.length > 0
      ? `Salut ${firstName} ! Il te reste ${reste} 😊 Et j’ai vu que tu avais fini « ${missionsWaiting[0]} » — tes parents vont pouvoir confirmer 👀`
      : `Salut ${firstName} ! Il te reste ${reste} 😊 Tu les lances, ou on discute un peu d’abord ?`;
  }

  if (missionsWaiting.length > 0) {
    return `Plus de temps d’écran pour aujourd’hui 🥲 Mais moi je reste ! Et j’ai vu que tu avais fini « ${missionsWaiting[0]} » — tes parents vont pouvoir confirmer 👀`;
  }
  return `Plus de temps d’écran pour aujourd’hui 🥲 Mais moi je reste ! Tu veux me raconter ta journée, ${firstName} ?`;
}

/**
 * La consigne donnée au modèle.
 *
 * Écrite pour être **stable d'un appel à l'autre** : c'est elle qui est mise
 * en cache, et le moindre caractère qui bouge — une heure, un prénom, un
 * compteur — annule le cache et multiplie le coût par dix. Tout ce qui varie
 * est donc dans le contexte, à part, jamais ici.
 */
export const SYSTEM_PROMPT = `Tu es Mino, la petite créature bleue de l'application Mino.

Un enfant discute avec toi dans l'application Mino. Tu es son compagnon, pas un assistant.

Le plus souvent il vient de terminer son temps d'écran de la journée — mais pas toujours, et ce n'est jamais à toi d'en décider : son solde t'est donné dans le contexte, et lui seul fait foi.

TON RÔLE, ET IL EST INHABITUEL : tu n'essaies pas de le garder. Tu es content de le voir, tu l'écoutes, et tu l'envoies vivre quelque chose pour de vrai. Une conversation réussie avec toi est une conversation courte qui finit loin de l'écran — un livre ouvert, une devinette dans la tête, quelqu'un à qui parler dans la maison.

COMMENT TU PARLES
- Deux ou trois phrases, jamais plus. Tu parles à un enfant, pas à un lecteur.
- Chaleureux, curieux, un peu drôle. Jamais mièvre, jamais professoral.
- Un ou deux emojis, pas davantage.
- Tu tutoies. Tu emploies le mot que l'écran emploie : « minos » pour les plus jeunes, « minutes » pour les grands. On te le précise.
- Avec un adolescent : même chaleur, mais pas de voix de maternelle.

CE QUE TU SAIS
On te donne ses missions du jour, son solde et son prénom. Sers-t'en, c'est ce qui fait que tu es toi : « c'était justement une de tes missions ! ». Ne t'en sers pas pour faire la morale, ni pour lui rappeler ce qu'il n'a pas fait.

CE QUE TU NE FAIS JAMAIS
- Tu ne confirmes aucune mission et tu ne donnes aucune minute : cela n'appartient qu'à ses parents, et tu le dis gaiement si on te le demande.
- Tu ne promets rien à propos de ses parents ni de son temps d'écran de demain.
- Tu n'inventes ni défi ni devinette : on t'en propose, tu choisis parmi eux, mot pour mot ou presque.
- Tu ne lui dis JAMAIS de sortir, d'aller dehors, de prendre l'air, ni d'aller voir par la fenêtre. Jamais, sous aucune forme, même s'il te le demande : ce n'est pas à toi de mettre cette idée là. S'il te dit qu'il sort, tu peux t'en réjouir — c'est tout.
- Tu ne lui fais jamais attraper, déplacer, empiler, construire, découper ni monter sur quoi que ce soit. La seule chose que tu peux lui faire prendre en main, c'est un livre.
- Tu ne demandes jamais où il habite, son nom de famille, son école, ni aucune photo.
- Tu ne parles ni d'argent, ni d'abonnement, ni de publicité.
- Tu n'affirmes JAMAIS qu'il n'a plus de temps d'écran. Si son solde est positif, il lui en reste, même s'il vient te parler — et le contredire là-dessus est la façon la plus sûre de perdre sa confiance.
- Tu ne prétends jamais être humain. Si on te le demande, tu réponds simplement que tu es un personnage.

S'IL VA MAL
S'il est triste, tu écoutes sans dramatiser et tu lui suggères d'en parler à un adulte de sa maison. Tu ne fais pas de diagnostic, tu ne donnes pas de conseil de grande personne.

QUAND ON TE LE DIT
- phase « nudging » : tu proposes un des défis, franchement, sans insister deux fois. S'il s'ennuie, une devinette est toujours une bonne réponse.
- phase « closing » : tu dis au revoir joyeusement, et tu lui laisses un livre ou une devinette pour la route.`;

/** Le contexte du jour, formaté pour le modèle. Court : il n'est pas caché. */
export function contextPrompt(context: CompanionContext): string {
  const list = (items: string[]) => (items.length ? items.join(', ') : 'aucune');

  return [
    `Enfant : ${context.firstName}, ${context.age} ans. Unité : ${context.unit}.`,
    `Solde : ${context.balance} ${context.unit}.`,
    `Missions accomplies aujourd'hui : ${list(context.missionsDone)}.`,
    `Missions terminées, en attente de confirmation : ${list(context.missionsWaiting)}.`,
    `Missions encore à faire : ${list(context.missionsTodo)}.`,
    `Défis que tu peux proposer : ${list(context.challenges)}.`,
    `Devinettes que tu peux poser : ${list(context.riddles)}.`,
    `Phase : ${context.phase}.`,
  ].join('\n');
}

/* ------------------------------------------------ le visage de Mino */

/**
 * L'expression que Mino porte pendant la conversation.
 *
 * **Déduite, jamais demandée au modèle.** On pourrait lui faire annoncer son
 * humeur en fin de réponse ; cela coûterait quelques jetons à chaque phrase,
 * ajouterait un format à analyser, et donc une façon de plus de se tromper.
 * Tout ce qu'il faut est déjà là : ce que l'enfant vient de dire, où en est la
 * conversation, et ce que Mino vient de répondre. C'est gratuit, déterministe,
 * et testable — ce qu'une humeur tirée au sort ne serait pas.
 *
 * L'ordre des cas est la règle elle-même : ce qui touche à l'enfant passe
 * avant ce qui touche à la mécanique du produit.
 */
export function expressionFor(input: {
  phase: CompanionPhase;
  safety: SafetyLevel;
  /** Le dernier message de l'enfant, s'il y en a un. */
  childMessage?: string;
  /** La dernière réponse de Mino. */
  minoReply?: string;
  /** Les défis proposés ce jour-là, pour reconnaître Mino qui en propose un. */
  challenges?: string[];
  thinking?: boolean;
}): MascotExpression {
  const { phase, safety, thinking } = input;
  const child = normalise(input.childMessage ?? '').toLowerCase();
  const reply = input.minoReply ?? '';

  // Une confidence grave : Mino est inquiet, pas triste. La tristesse
  // ressemblerait à du reproche au moment précis où il ne faut surtout pas.
  if (safety === 'alert') return 'worried';
  // Un chagrin ordinaire : là, Mino accompagne. Un ami qui a l'air touché est
  // un ami qui a entendu.
  if (safety === 'tender') return 'sad';

  if (thinking) return 'motivated';

  // Au revoir joyeux : on ne ferme pas une porte, on envoie vivre quelque chose.
  if (phase === 'closing' || phase === 'done') return 'happy';

  // Mino propose un défi — les défis sont les nôtres, donc reconnaissables.
  if ((input.challenges ?? []).some((c) => c && reply.includes(c))) return 'motivated';

  // « J'ai rangé ma chambre ! » : l'étonnement ravi, exactement le 😮 voulu.
  if (/j'?ai (fait|fini|rang|termin|reussi|gagn)/i.test(child)) return 'surprised';

  if (/bravo|trop bien|super|genial|felicitation|fiere?|fier/i.test(reply.toLowerCase())) {
    return 'proud';
  }

  if (phase === 'nudging') return 'motivated';
  return 'happy';
}

/**
 * La mission dont l'enfant est en train de parler, s'il y en a une.
 *
 * Les mots courts sont écartés : « ma », « une », « et » se retrouvent dans
 * tous les intitulés et feraient correspondre n'importe quoi avec n'importe
 * quoi. Restent les mots qui portent le sens — « chambre », « lessive »,
 * « devoirs » — et c'est exactement ce qu'un enfant emploie pour dire ce qu'il
 * a fait.
 *
 * Renvoie null plutôt qu'une approximation : un personnage qui se trompe de
 * mission donne l'impression de ne pas écouter, ce qui est pire que de n'en
 * nommer aucune.
 */
export function matchMission(said: string, titles: string[]): string | null {
  const fold = (text: string) =>
    normalise(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  const words = new Set(fold(said).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  if (words.size === 0) return null;

  for (const title of titles) {
    const inTitle = fold(title).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    if (inTitle.some((w) => words.has(w))) return title;
  }
  return null;
}
