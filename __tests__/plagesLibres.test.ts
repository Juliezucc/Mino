import {
  FreeWindow,
  decritFenetre,
  jourLocal,
  minutesRestantes,
  openWindowAt,
  prochaineOuverture,
  valideFenetre,
} from '@/domain/freeWindows';

/**
 * Les plages libres, et les trois façons de les rater.
 *
 * La fonctionnalité paraît simple — une plage horaire, des jours — et c'est
 * exactement ce qui la rend dangereuse : trois pièges s'y cachent, et aucun ne
 * se voit à la relecture.
 *
 *   1. Le fuseau. `toISOString()` rend la veille dès 22 h à Paris. Une plage
 *      posée sur une date précise s'ouvrirait donc le mauvais jour, le soir,
 *      c'est-à-dire précisément quand un parent ne veut pas qu'elle s'ouvre.
 *   2. La borne de fin. `<=` au lieu de `<` laisse la plage ouverte une minute
 *      de trop — anodin, sauf que c'est la minute où l'écran devait se
 *      refermer.
 *   3. La plage hebdomadaire déjà passée. Chercher la prochaine ouverture sur
 *      sept jours répond « jamais » à une plage du lundi consultée un lundi
 *      soir. Il en faut huit.
 *
 * Et par-dessus tout : une plage libre n'écrit RIEN au grand livre. C'est
 * tenu ailleurs (`__tests__/screenTime.test.ts` et le domaine), mais c'est la
 * raison d'être de ce fichier.
 */

const MERCREDI_10H = new Date('2026-08-26T10:00:00');
const MERCREDI_15H = new Date('2026-08-26T15:00:00');

function fenetre(over: Partial<FreeWindow> = {}): FreeWindow {
  return {
    id: 'fw-1',
    familyId: 'f1',
    label: 'Mercredi après-midi',
    childIds: null,
    days: [3],
    startMinute: 14 * 60,
    endMinute: 16 * 60,
    enabled: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('une plage ouverte', () => {
  it('s’ouvre le bon jour, à la bonne heure', () => {
    expect(openWindowAt([fenetre()], 'c1', MERCREDI_15H)?.label).toBe('Mercredi après-midi');
    expect(openWindowAt([fenetre()], 'c1', MERCREDI_10H)).toBeNull();
  });

  it('se referme À l’heure dite, pas une minute après', () => {
    const juste = new Date('2026-08-26T16:00:00');
    expect(openWindowAt([fenetre()], 'c1', juste)).toBeNull();

    const avant = new Date('2026-08-26T15:59:00');
    expect(openWindowAt([fenetre()], 'c1', avant)).not.toBeNull();
  });

  it('ne s’ouvre pas un autre jour de la semaine', () => {
    const jeudi15h = new Date('2026-08-27T15:00:00');
    expect(openWindowAt([fenetre()], 'c1', jeudi15h)).toBeNull();
  });

  it('suspendue, elle ne s’ouvre plus — sans être supprimée', () => {
    expect(openWindowAt([fenetre({ enabled: false })], 'c1', MERCREDI_15H)).toBeNull();
  });

  it('ne concerne que les enfants qu’on lui a désignés', () => {
    const pourLea = fenetre({ childIds: ['lea'] });
    expect(openWindowAt([pourLea], 'lea', MERCREDI_15H)).not.toBeNull();
    expect(openWindowAt([pourLea], 'noah', MERCREDI_15H)).toBeNull();
  });

  it('rend celle qui se referme le plus tard quand deux se chevauchent', () => {
    // Sinon on annoncerait « jusqu'à 16 h » à un enfant dont l'écran reste
    // ouvert jusqu'à 18 h, ou l'inverse — et l'inverse est pire.
    const courte = fenetre({ id: 'a', endMinute: 16 * 60 });
    const longue = fenetre({ id: 'b', endMinute: 18 * 60, label: 'Vacances' });

    expect(openWindowAt([courte, longue], 'c1', MERCREDI_15H)?.id).toBe('b');
    expect(openWindowAt([longue, courte], 'c1', MERCREDI_15H)?.id).toBe('b');
  });

  it('dit combien de temps il reste', () => {
    expect(minutesRestantes(fenetre(), MERCREDI_15H)).toBe(60);
  });
});

describe('une plage posée sur une date', () => {
  it('AU PETIT MATIN, ELLE NE GLISSE PAS À LA VEILLE', () => {
    // Le piège du fuseau, et l'heure exacte à laquelle il se referme. Paris
    // est en UTC+2 en août : local 00 h 30 le 26 vaut 22 h 30 UTC le 25. Une
    // date lue avec `toISOString()` rendrait donc « 2026-08-25 » et la plage
    // resterait fermée, un matin de vacances, sans que rien ne l'explique.
    //
    // La suite tourne à l'heure de Paris (`npm test`), sans quoi ce test-ci
    // passerait aussi sur la version cassée : voir `jest.setup.ts`.
    const petitMatin = new Date('2026-08-26T00:30:00');
    expect(petitMatin.toISOString().slice(0, 10)).toBe('2026-08-25');
    expect(jourLocal(petitMatin)).toBe('2026-08-26');

    const vacances = fenetre({ days: [], date: '2026-08-26', startMinute: 0, endMinute: 2 * 60 });
    expect(openWindowAt([vacances], 'c1', petitMatin)).not.toBeNull();
  });

  it('n’arrive qu’une fois', () => {
    const anniv = fenetre({ days: [], date: '2026-08-26' });
    expect(openWindowAt([anniv], 'c1', MERCREDI_15H)).not.toBeNull();

    const semaineSuivante = new Date('2026-09-02T15:00:00');
    expect(openWindowAt([anniv], 'c1', semaineSuivante)).toBeNull();
  });
});

describe('la prochaine ouverture', () => {
  it('se trouve dans la journée quand elle est encore à venir', () => {
    const quand = prochaineOuverture([fenetre()], 'c1', MERCREDI_10H);
    expect(quand?.quand.getHours()).toBe(14);
    expect(quand?.quand.getDate()).toBe(26);
  });

  it('REVIENT LA SEMAINE SUIVANTE QUAND ELLE EST DÉJÀ PASSÉE', () => {
    // Le piège des sept jours : chercher sur sept répondrait « jamais » à une
    // plage hebdomadaire consultée après son passage.
    const mercrediSoir = new Date('2026-08-26T20:00:00');
    const quand = prochaineOuverture([fenetre()], 'c1', mercrediSoir);

    expect(quand).not.toBeNull();
    expect(quand?.quand.getDate()).toBe(2); // mercredi suivant, 2 septembre
  });

  it('ne promet rien quand il n’y a rien à promettre', () => {
    const passee = fenetre({ days: [], date: '2020-01-01' });
    expect(prochaineOuverture([passee], 'c1', MERCREDI_10H)).toBeNull();
  });
});

describe('ce qu’on refuse d’enregistrer', () => {
  const base = { label: 'Test', childIds: null, days: [3], startMinute: 600, endMinute: 720 };

  it('accepte une plage ordinaire', () => {
    expect(valideFenetre(base)).toBeNull();
  });

  it('refuse une plage qui traverse minuit, et dit pourquoi', () => {
    // Une fenêtre 22 h → 7 h n'est pas une permission, c'est un couvre-feu :
    // la fonctionnalité inverse. Les mélanger donnerait un réglage illisible.
    const message = valideFenetre({ ...base, startMinute: 22 * 60, endMinute: 7 * 60 });
    expect(message).toMatch(/ne traverse pas minuit/);
  });

  it('refuse une plage sans jour ni date', () => {
    expect(valideFenetre({ ...base, days: [] })).toMatch(/au moins un jour/);
  });

  it('refuse une plage qui serait à la fois répétée et ponctuelle', () => {
    expect(valideFenetre({ ...base, date: '2026-08-26' })).toMatch(/Pas les deux/);
  });

  it('refuse une plage sans nom, parce qu’une liste sans noms ne se relit pas', () => {
    expect(valideFenetre({ ...base, label: '   ' })).toMatch(/nom/);
  });

  it('refuse une liste d’enfants vide, qui n’ouvrirait rien à personne', () => {
    expect(valideFenetre({ ...base, childIds: [] })).toMatch(/au moins un enfant/);
  });
});

describe('ce que le parent lit dans sa liste', () => {
  const prenoms = new Map([['lea', 'Léa'], ['noah', 'Noah']]);

  it('dit les jours avec les mots d’une famille', () => {
    expect(decritFenetre(fenetre({ days: [1, 2, 3, 4, 5] }))).toMatch(/^En semaine/);
    expect(decritFenetre(fenetre({ days: [0, 6] }))).toMatch(/^Le week-end/);
    expect(decritFenetre(fenetre({ days: [0, 1, 2, 3, 4, 5, 6] }))).toMatch(/^Tous les jours/);
    expect(decritFenetre(fenetre({ days: [3] }))).toMatch(/^Le mercredi/);
  });

  it('nomme les enfants concernés, ou la famille entière', () => {
    expect(decritFenetre(fenetre(), prenoms)).toMatch(/toute la famille/);
    expect(decritFenetre(fenetre({ childIds: ['lea', 'noah'] }), prenoms)).toMatch(/Léa, Noah/);
  });

  it('écrit une date en toutes lettres, sans décalage', () => {
    const dit = decritFenetre(fenetre({ days: [], date: '2026-08-26' }));
    expect(dit).toMatch(/26 août/);
  });
});
