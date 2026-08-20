import {
  ALERT_REPLY,
  CHALLENGES,
  DAILY_EXCHANGES,
  NUDGE_FROM,
  SYSTEM_PROMPT,
  buildContext,
  challengesFor,
  contextPrompt,
  exchangesLeft,
  greeting,
  phaseOf,
  pickChallenge,
  triage,
} from '@/domain/companion';
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
    expect(SYSTEM_PROMPT).toMatch(/ne valides aucune mission/i);
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
});
