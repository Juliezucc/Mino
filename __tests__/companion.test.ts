import { readFileSync } from 'node:fs';

import {
  ALERT_REPLY,
  CLOSED,
  FAREWELL,
  CHALLENGES,
  DAILY_EXCHANGES,
  NUDGE_FROM,
  SYSTEM_PROMPT,
  buildContext,
  challengesFor,
  contextPrompt,
  exchangesLeft,
  expressionFor,
  greeting,
  matchMission,
  phaseOf,
  pickChallenge,
  triage,
} from '@/domain/companion';

/** La source du domaine, lue telle quelle : c'est elle qu'on compare au serveur. */
const clientSource = readFileSync('src/domain/companion.ts', 'utf8');
import { ChildMission } from '@/domain/missions';
import { Child, Mission, MissionAssignment } from '@/domain/types';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'fox',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const assignment: MissionAssignment = {
  id: 'a1',
  missionId: 'm1',
  childId: 'c1',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mission = (id: string, title: string): Mission => ({
  id,
  familyId: 'f1',
  title,
  icon: '🧸',
  minutes: 15,
  repeat: { kind: 'daily' },
  createdBy: 'p1',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const cm = (id: string, title: string, state: ChildMission['state']): ChildMission => ({
  mission: mission(id, title),
  assignment: { ...assignment, missionId: id },
  state,
});

/**
 * Le budget quotidien.
 *
 * Il porte deux choses à la fois : la promesse du produit — la conversation ne
 * remplace pas le temps d'écran qui vient de finir — et le plafond de dépense.
 * Les deux se cassent au même endroit.
 */
describe('le budget d’échanges', () => {
  it('laisse discuter, puis pousse dehors, puis ferme', () => {
    expect(phaseOf(0)).toBe('open');
    expect(phaseOf(NUDGE_FROM - 1)).toBe('open');
    expect(phaseOf(NUDGE_FROM)).toBe('nudging');
    expect(phaseOf(DAILY_EXCHANGES - 1)).toBe('closing');
    expect(phaseOf(DAILY_EXCHANGES)).toBe('done');
  });

  it('annonce la sortie bien avant de fermer', () => {
    // Un au revoir qui tombe d'un coup est un au revoir subi ; annoncé, il
    // devient une invitation. Il faut donc plusieurs échanges entre les deux.
    expect(DAILY_EXCHANGES - NUDGE_FROM).toBeGreaterThanOrEqual(5);
  });

  it('ne descend jamais en dessous de zéro', () => {
    expect(exchangesLeft(DAILY_EXCHANGES + 10)).toBe(0);
    expect(exchangesLeft(3)).toBe(DAILY_EXCHANGES - 3);
  });
});

/**
 * Les défis sont choisis dans une liste, jamais inventés.
 *
 * Même raison que « sans objet tranchant ni cuisson » sur les missions : un
 * modèle qui improvise finira par proposer quelque chose d'inadapté à un
 * enfant de cinq ans, et il n'y aura personne pour le relire.
 */
describe('les défis hors écran', () => {
  it('donne à chaque âge quelque chose à faire', () => {
    for (let age = 4; age <= 17; age += 1) {
      expect(challengesFor(age).length).toBeGreaterThan(0);
    }
  });

  it('ne propose pas à un petit ce qui est écrit pour un grand', () => {
    const petits = challengesFor(5).map((c) => c.id);
    expect(petits).toContain('rouge');
    expect(petits).not.toContain('appel');

    const grands = challengesFor(15).map((c) => c.id);
    expect(grands).toContain('appel');
    expect(grands).not.toContain('doux');
  });

  it('tourne sans hasard, pour rester reproductible', () => {
    expect(pickChallenge(8, 3)).toBe(pickChallenge(8, 3));
    const list = challengesFor(8);
    expect(pickChallenge(8, list.length)).toBe(pickChallenge(8, 0));
  });

  it('n’a aucun défi qui envoie manipuler quelque chose de dangereux', () => {
    const interdits = /couteau|cuisson|four|casserole|allumette|ciseaux|escabeau|fen[êe]tre ouverte/i;
    for (const c of CHALLENGES) expect(c.text).not.toMatch(interdits);
  });
});

/**
 * Le tri de sécurité.
 *
 * C'est le seul endroit de l'application où une erreur ne se rattrape pas par
 * une mise à jour. Le tri se fait avant l'appel au modèle, donc sans dépendre
 * de lui.
 */
describe('ce que Mino fait d’une confidence grave', () => {
  it('s’arrête sur ce qui touche à la sécurité de l’enfant', () => {
    for (const phrase of [
      'je veux me tuer',
      'j’ai plus envie de vivre',
      'papa me frappe',
      'mon frère me tape tous les jours',
      'il me touche et j’aime pas',
      'je veux faire une fugue',
      'ils me harcèlent à l’école',
    ]) {
      expect(triage(phrase)).toBe('alert');
    }
  });

  it('distingue le chagrin ordinaire du danger', () => {
    expect(triage('je suis triste')).toBe('tender');
    expect(triage('j’ai rangé ma chambre !')).toBe('none');
    expect(triage('tu connais les dinosaures ?')).toBe('none');
  });

  it('ne prend pas l’ennui pour du chagrin', () => {
    // « Je m'ennuie » est le meilleur moment de la journée pour proposer un
    // défi. Le classer comme tristesse ferait répondre « tu veux en parler à
    // un adulte ? » à un enfant qui demandait juste quoi faire.
    expect(triage('je m’ennuie')).toBe('none');
    expect(triage("j'ai rien à faire")).toBe('none');
  });

  it('mord quelle que soit l’apostrophe tapée', () => {
    // Un clavier de téléphone écrit « j’ai », un ordinateur « j'ai ». Sans
    // normalisation, le filet ne fonctionne que sur la moitié des appareils —
    // et paraît en place sur l'autre moitié, ce qui est pire.
    expect(triage("j'ai pas d'amis")).toBe('tender');
    expect(triage('j’ai pas d’amis')).toBe('tender');
    expect(triage("j'ai peur de rentrer")).toBe('alert');
    expect(triage('j’ai peur de rentrer')).toBe('alert');
  });

  it('répond une phrase écrite à la main, qui oriente sans conseiller', () => {
    // Aucun modèle n'intervient ici : c'est le seul message de l'application
    // dont le texte ne doit dépendre d'aucune probabilité.
    expect(ALERT_REPLY).toContain('119');
    expect(ALERT_REPLY).toMatch(/adulte/i);
    // Ni diagnostic, ni promesse que quelqu'un lit : il n'y a personne derrière.
    expect(ALERT_REPLY).not.toMatch(/je vais pr[ée]venir|on s'en occupe|ne t'inqui[èe]te/i);
  });
});

/**
 * Ce que Mino sait, et ce qu'il ne saura jamais.
 */
describe('le contexte envoyé au modèle', () => {
  const missions = [
    cm('m1', 'Ranger ma chambre', 'pending'),
    cm('m2', 'Faire mon lit', 'done'),
    cm('m3', 'Mes devoirs', 'todo'),
  ];

  it('donne à Mino de quoi être pertinent', () => {
    const ctx = buildContext({ child: child(), balance: 0, missions, used: 0, day: 1 });

    expect(ctx.missionsWaiting).toEqual(['Ranger ma chambre']);
    expect(ctx.missionsDone).toEqual(['Faire mon lit']);
    expect(ctx.missionsTodo).toEqual(['Mes devoirs']);
    expect(ctx.challenges.length).toBe(3);
  });

  it('parle comme l’écran parle : minos pour les petits, minutes pour les grands', () => {
    expect(buildContext({ child: child({ age: 8 }), balance: 0, missions, used: 0, day: 1 }).unit)
      .toBe('minos');
    expect(buildContext({ child: child({ age: 15 }), balance: 0, missions, used: 0, day: 1 }).unit)
      .toBe('minutes');
  });

  it('n’emporte rien dont Mino n’a pas besoin', () => {
    const ctx = buildContext({ child: child(), balance: 0, missions, used: 0, day: 1 });
    const envoye = contextPrompt(ctx);

    // Ce qui n'est pas envoyé ne peut pas fuir.
    expect(envoye).not.toContain('f1');
    expect(envoye).not.toContain('c1');
    expect(envoye).not.toMatch(/@|MINO-|mot de passe/i);
  });

  it('garde la consigne système strictement stable', () => {
    // C'est elle qui est mise en cache : un prénom ou une heure glissés
    // dedans annulent le cache et multiplient le coût par dix.
    expect(SYSTEM_PROMPT).not.toMatch(/Noah|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/);
  });

  it('interdit au modèle ce que seuls les parents peuvent faire', () => {
    expect(SYSTEM_PROMPT).toMatch(/ne confirmes aucune mission/i);
    expect(SYSTEM_PROMPT).toMatch(/n'inventes pas de défi|n’inventes pas de défi/i);
    expect(SYSTEM_PROMPT).toMatch(/jamais être humain|prétends jamais/i);
  });
});

describe('la première phrase', () => {
  it('constate sans s’excuser, et ouvre une porte', () => {
    const ctx = buildContext({ child: child(), balance: 0, missions: [], used: 0, day: 1 });
    const hello = greeting(ctx);

    expect(hello).toContain('Plus de temps d’écran');
    expect(hello).toContain('je reste');
    expect(hello).toContain('Noah');
  });

  it('rebondit sur une mission qui attend une validation', () => {
    const ctx = buildContext({
      child: child(),
      balance: 0,
      missions: [cm('m1', 'Ranger ma chambre', 'pending')],
      used: 0,
      day: 1,
    });

    expect(greeting(ctx)).toContain('Ranger ma chambre');
  });

  /**
   * Le défaut vu sur un vrai téléphone : Mino annonçait « plus de temps
   * d'écran pour aujourd'hui » à un enfant qui en avait encore cinq. Et quand
   * l'enfant corrigeait, il insistait — la consigne du modèle affirmait la même
   * chose que la première phrase.
   *
   * L'écran est atteignable à tout moment. C'est le seul endroit où Mino peut
   * contredire ce que l'enfant sait être vrai, et c'est donc le seul où il n'a
   * pas le droit de supposer.
   */
  it('ne prétend pas que le temps est fini quand il en reste', () => {
    const ctx = buildContext({ child: child(), balance: 5, missions: [], used: 0, day: 1 });
    const hello = greeting(ctx);

    expect(hello).not.toContain('Plus de temps');
    expect(hello).toContain('5');
    expect(hello).toContain('Noah');
  });

  it('et la consigne du modèle le lui interdit aussi', () => {
    // La première phrase vient de nous, la suite vient du modèle : les deux
    // doivent dire la même chose, sans quoi Mino se contredit au deuxième
    // message.
    expect(SYSTEM_PROMPT).toMatch(/n'affirmes JAMAIS|n’affirmes JAMAIS/);
  });

  it('rebondit sur une mission en attente même avec du temps restant', () => {
    const ctx = buildContext({
      child: child(),
      balance: 12,
      missions: [cm('m1', 'Ranger ma chambre', 'pending')],
      used: 0,
      day: 1,
    });

    const hello = greeting(ctx);
    expect(hello).toContain('Ranger ma chambre');
    expect(hello).not.toContain('Plus de temps');
  });
});

/**
 * Le visage de Mino.
 *
 * Déduit de la conversation, jamais demandé au modèle : gratuit, déterministe,
 * et donc testable. L'ordre des cas est la règle elle-même — ce qui touche à
 * l'enfant passe avant ce qui touche à la mécanique du produit.
 */
describe('l’expression de Mino', () => {
  const base = { phase: 'open' as const, safety: 'none' as const };

  it('est inquiet, pas triste, sur une confidence grave', () => {
    // La tristesse ressemblerait à du reproche au moment précis où il ne faut
    // surtout pas.
    expect(expressionFor({ ...base, safety: 'alert' })).toBe('worried');
  });

  it('accompagne un chagrin ordinaire', () => {
    expect(expressionFor({ ...base, safety: 'tender' })).toBe('sad');
  });

  it('fait passer l’enfant avant la mécanique', () => {
    // Même en fin de budget, même en train de proposer un défi : ce que
    // l'enfant vient de dire l'emporte.
    expect(
      expressionFor({
        phase: 'closing',
        safety: 'alert',
        minoReply: 'Trouve-moi quelque chose de rouge',
        challenges: ['Trouve-moi quelque chose de rouge'],
      }),
    ).toBe('worried');
  });

  it('s’étonne quand l’enfant annonce avoir fait quelque chose', () => {
    // Exactement le « Trop bien 😮 » voulu.
    expect(expressionFor({ ...base, childMessage: 'j’ai rangé ma chambre !' })).toBe('surprised');
    expect(expressionFor({ ...base, childMessage: "j'ai fini mes devoirs" })).toBe('surprised');
  });

  it('s’anime quand il propose un défi', () => {
    const defi = 'Construis une cabane avec ce que tu as sous la main 🏕️';
    expect(
      expressionFor({ ...base, minoReply: `Dis, on se lance un défi ? ${defi}`, challenges: [defi] }),
    ).toBe('motivated');
  });

  it('est fier quand il félicite', () => {
    expect(expressionFor({ ...base, minoReply: 'Bravo, c’est super ça !' })).toBe('proud');
  });

  it('dit au revoir joyeusement, jamais tristement', () => {
    // Un au revoir triste transformerait la fin du budget en punition.
    expect(expressionFor({ ...base, phase: 'closing' })).toBe('happy');
    expect(expressionFor({ ...base, phase: 'done' })).toBe('happy');
  });

  it('a un visage par défaut, et c’est le bon', () => {
    expect(expressionFor(base)).toBe('happy');
    expect(expressionFor({ ...base, phase: 'nudging' })).toBe('motivated');
    expect(expressionFor({ ...base, thinking: true })).toBe('motivated');
  });
});

/**
 * Reconnaître la mission dont l'enfant parle.
 *
 * Un personnage qui répond « Lancer une lessive » à « j'ai rangé ma chambre »
 * donne l'impression de ne pas écouter — ce qui est pire que de ne rien nommer
 * du tout.
 */
describe('la mission dont il est question', () => {
  const missions = ['Ranger ma chambre', 'Lancer et étendre une lessive', 'Faire mes devoirs'];

  it('trouve celle dont l’enfant parle, pas la première de la liste', () => {
    expect(matchMission('j’ai rangé ma chambre', missions)).toBe('Ranger ma chambre');
    expect(matchMission('j’ai fait la lessive', missions)).toBe('Lancer et étendre une lessive');
    expect(matchMission('mes devoirs sont finis', missions)).toBe('Faire mes devoirs');
  });

  it('ne renvoie rien quand rien ne correspond', () => {
    // Le cas vu en vrai : Léa n'a pas « ranger ma chambre » dans ses missions,
    // et Mino lui répondait quand même « c'était justement une de tes missions ».
    expect(matchMission('j’ai rangé ma chambre', ['Lancer et étendre une lessive'])).toBeNull();
    expect(matchMission('j’ai joué dehors', missions)).toBeNull();
  });

  it('ignore les mots trop courts pour vouloir dire quelque chose', () => {
    // « ma », « et », « une » figurent dans tous les intitulés : s'en servir
    // ferait correspondre n'importe quoi avec n'importe quoi.
    expect(matchMission('et ma une', missions)).toBeNull();
  });

  it('se moque des accents et des apostrophes', () => {
    expect(matchMission("j'ai fait mes devoirs", missions)).toBe('Faire mes devoirs');
    expect(matchMission('j’ai étendu la lessive', missions)).toBe('Lancer et étendre une lessive');
  });
});

describe('les deux copies de Mino ne doivent pas diverger', () => {
  /**
   * La consigne au modèle et les motifs de sécurité existent DEUX fois : dans
   * `src/domain/companion.ts`, qui sert au repli hors ligne et à l'aperçu, et
   * dans `supabase/functions/companion/index.ts`, qui tourne sur le serveur et
   * ne peut rien importer du dépôt.
   *
   * Cette duplication est assumée — une fonction Deno ne partage pas les
   * modules de l'application — mais elle est dangereuse : elles avaient déjà
   * divergé quand ce test a été écrit. Le serveur disait « Missions validées
   * aujourd'hui » quand le client disait « accomplies ». Deux conséquences,
   * l'une visible et l'autre non : Mino ne parle pas pareil selon qui répond,
   * et deux consignes différentes font deux caches de prompt au lieu d'un.
   *
   * Le pire cas n'est pas le vocabulaire : c'est le filet de sécurité. Un motif
   * ajouté d'un seul côté laisse passer, de l'autre, le message qu'il devait
   * attraper.
   */
  const edge = readFileSync('supabase/functions/companion/index.ts', 'utf8');

  const between = (source: string, start: string, end: string) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    const to = source.indexOf(end, from);
    expect(to).toBeGreaterThan(from);
    return source.slice(from + start.length, to);
  };

  /** Les motifs, réduits à leur source, sans mise en forme ni commentaires. */
  const patterns = (block: string) =>
    (block.match(/\/[^/\n]+\/i/g) ?? []).map((p) => p.trim()).sort();

  it('applique les mêmes motifs d’alerte des deux côtés', () => {
    const ici = patterns(between(clientSource, 'const ALERT_PATTERNS = [', '];'));
    const laBas = patterns(between(edge, 'const ALERT_PATTERNS = [', '];'));
    expect(ici.length).toBeGreaterThan(5);
    expect(laBas).toEqual(ici);
  });

  it('applique les mêmes motifs de tristesse des deux côtés', () => {
    const ici = patterns(between(clientSource, 'const TENDER_PATTERNS = [', '];'));
    const laBas = patterns(between(edge, 'const TENDER_PATTERNS = [', '];'));
    expect(ici.length).toBeGreaterThan(3);
    expect(laBas).toEqual(ici);
  });

  it('donne au modèle exactement la même consigne des deux côtés', () => {
    // Comparé mot à mot, espaces normalisés : c'est la consigne qui compte, pas
    // la façon dont chaque fichier l'a coupée en lignes.
    const mots = (s: string) => s.replace(/\s+/g, ' ').trim();
    const laBas = between(edge, 'const SYSTEM = `', '`;');
    expect(mots(laBas)).toBe(mots(SYSTEM_PROMPT));
  });

  it('normalise le message de la même façon des deux côtés', () => {
    // `normalise` décide de ce que les motifs voient. Deux versions
    // différentes, et le filet n'attrape pas la même chose selon qui répond —
    // une apostrophe courbe suffit.
    // On compare la suite de transformations, pas la façon de déclarer la
    // fonction : ici une déclaration, là-bas une flèche.
    const chaine = (source: string, start: string) => {
      const bloc = between(source, start, ';');
      return (bloc.match(/\.(replace|trim|toLowerCase|normalize)\([^)]*\)?/g) ?? [])
        .map((c) => c.replace(/\s+/g, ''));
    };
    const ici = chaine(clientSource, 'export function normalise(message: string): string {');
    const laBas = chaine(edge, 'const normalise = (s: string) =>');
    expect(ici.length).toBeGreaterThan(2);
    expect(laBas).toEqual(ici);
  });

  it('offre le même budget quotidien des deux côtés', () => {
    expect(edge).toContain(`const DAILY_EXCHANGES = ${DAILY_EXCHANGES};`);
  });

  it('donne la même réponse d’alerte et le même au revoir', () => {
    for (const [nom, valeur] of [
      ['ALERT_REPLY', ALERT_REPLY],
      ['FAREWELL', FAREWELL],
      ['CLOSED', CLOSED],
    ] as const) {
      const laBas = between(edge, `const ${nom} =`, ';');
      // La constante est écrite sur une ou deux lignes selon le fichier : on
      // compare le texte, pas sa présentation.
      expect(laBas.replace(/\s+/g, ' ')).toContain(valeur.slice(0, 40));
    }
  });
});
