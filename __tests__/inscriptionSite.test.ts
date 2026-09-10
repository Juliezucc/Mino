import { accessOf } from '@/domain/billing';
import { inscriptionInachevee, isFirstRun } from '@/domain/firstRun';
import { ROUTINES, convientA } from '@/domain/missionLibrary';
import { missionsForChild, nommerLeJour, prochaineJournee } from '@/domain/missions';
import { parentGate } from '@/domain/parentGate';
import { FamilyData } from '@/domain/types';

/**
 * Le parcours d'une famille venue du site, une fois dans l'application.
 *
 * C'est le chemin principal de la publicité, et personne ne l'avait jamais
 * conduit : le tunnel de `minoapp.fr/creer/` fonde la famille, l'enfant et les
 * missions côté serveur, puis la famille télécharge Mino. Elle arrive donc dans
 * l'application **sans avoir traversé une seule fois l'inscription** — ni
 * l'écran du prénom, ni celui du compte, ni le paywall, ni celui du blocage.
 *
 * Ce que ces essais conduisent, ce sont les décisions que prend l'application à
 * la première ouverture, dans l'ordre où elle les prend.
 */

/** Ce que `supabase/functions/inscription-web` écrit, reproduit ici à l'identique. */
function familleDuSite(options: {
  routineId: string;
  age: number;
  creeeLe: Date;
}): FamilyData {
  const routine = ROUTINES.find((r) => r.id === options.routineId)!;
  const quand = options.creeeLe.toISOString();
  const suggestions = routine.suggestions.filter((s) => convientA(s, options.age, false));

  const missions = suggestions.map((s, i) => ({
    id: `mission-${i}`,
    familyId: 'fam-web',
    title: s.title,
    icon: s.icon,
    minutes: s.minutes,
    repeat: routine.repeat,
    autoApprove: false,
    createdBy: 'parent-web',
    archived: false,
    createdAt: quand,
  }));

  return {
    family: {
      id: 'fam-web',
      name: 'Famille de Léa',
      code: 'MINO-QU5GXD',
      referralCode: 'AB3D5F',
      createdAt: quand,
    },
    // Le prénom du parent est obligatoire côté serveur — c'est ce qui empêche
    // l'application de prendre cette famille pour une inscription abandonnée.
    parents: [
      {
        id: 'parent-web',
        familyId: 'fam-web',
        displayName: 'Julie',
        email: 'julie@exemple.fr',
        consentAt: quand,
        createdAt: quand,
      },
    ],
    children: [
      {
        id: 'enfant-web',
        familyId: 'fam-web',
        firstName: 'Léa',
        age: options.age,
        avatarKey: 'fox',
        createdAt: quand,
      },
    ],
    missions,
    assignments: missions.map((m, i) => ({
      id: `assign-${i}`,
      missionId: m.id,
      childId: 'enfant-web',
      active: true,
      createdAt: quand,
    })),
    completions: [],
    transactions: [],
    sessions: [],
    devices: [],
    freeWindows: [],
  };
}

/** L'essai que `essai.sql` ouvre par déclencheur à la création de la famille. */
const essaiDe = (creeeLe: Date) => ({
  familyId: 'fam-web',
  status: 'trialing' as const,
  plan: null,
  trialEndsAt: new Date(creeeLe.getTime() + 30 * 86400000).toISOString(),
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  creditMonths: 0,
});

describe('la première ouverture d’une famille venue du site', () => {
  const creeeLe = new Date('2026-09-14T10:00:00.000Z'); // un lundi
  const data = familleDuSite({ routineId: 'coucher', age: 9, creeeLe });

  it('n’est pas prise pour une inscription abandonnée', () => {
    // Le piège que le prénom obligatoire écarte : sans lui, l'application
    // renverrait cette famille vers l'écran de création de compte, avec une
    // adresse déjà prise — donc un mur, dès la première seconde.
    expect(inscriptionInachevee(data)).toBe(false);
  });

  it('demande au parent de créer son code, il n’en a jamais posé', () => {
    // Le tunnel ne demande pas de code à quatre chiffres. Sur son propre
    // téléphone, le parent doit pouvoir en poser un — pas se voir refuser
    // l'entrée de son espace.
    expect(parentGate({ hasPin: false, onChildDevice: false })).toBe('create');
  });

  it('reconnaît une famille qui n’a encore rien vécu', () => {
    // Ce qui déclenche l'invite « à lui de jouer » sur le tableau de bord, au
    // lieu de trois messages disant qu'il n'y a rien.
    expect(isFirstRun(data)).toBe(true);
  });

  it('ouvre sur un essai qui court, sans paywall', () => {
    const acces = accessOf(essaiDe(creeeLe), creeeLe);
    expect(acces.kind).toBe('trial');
    expect(acces.kind === 'trial' && acces.daysLeft).toBe(30);
  });

  it('donne à l’enfant des missions à faire dès le premier jour', () => {
    const missions = missionsForChild(data, 'enfant-web', creeeLe);
    expect(missions.length).toBeGreaterThan(0);
    expect(missions.every((m) => m.state === 'todo')).toBe(true);
  });

  it('n’a proposé que des missions de son âge', () => {
    for (const { mission } of missionsForChild(data, 'enfant-web', creeeLe)) {
      const source = ROUTINES.flatMap((r) => r.suggestions).find((s) => s.title === mission.title)!;
      expect(9).toBeGreaterThanOrEqual(source.ages[0]);
      expect(9).toBeLessThanOrEqual(source.ages[1]);
    }
  });

  it('ne laisse aucun « {enfant} » atteindre l’écran de l’enfant', () => {
    // La bibliothèque porte des titres à trou pour la fratrie. Le tunnel ne
    // crée qu'un enfant, donc ces suggestions sont écartées — mais un titre
    // resté brut serait affiché tel quel à un enfant de six ans.
    for (const mission of data.missions) expect(mission.title).not.toContain('{enfant}');
  });
});

/**
 * ------------------------------------------------ le jour où la famille s'inscrit
 *
 * **Le défaut, et il frappe précisément au pire moment.** Cinq routines sur
 * douze ne tournent pas tous les jours, et leurs jours ne se devinent pas :
 * seule « Routine du matin » suit le lundi-vendredi entier. « Devoirs et
 * école » et « Travail et révisions » sautent le mercredi ; « Coup de main à
 * la maison » et « Ma part à la maison » ne tournent que le mercredi et le
 * samedi. Une famille qui s'inscrit le samedi — le jour où l'on s'occupe de ce
 * genre de choses — paie, installe l'application, tend la tablette à son
 * enfant, et l'enfant voit **« Aucune mission pour aujourd'hui »**.
 *
 * Rien n'est cassé, et c'est ce qui rend le défaut coûteux : le produit
 * fonctionne exactement comme prévu, et la première impression est celle d'une
 * application vide. Personne ne reste pour vérifier lundi.
 *
 * Le pire cas n'est pas le week-end : « Devoirs et école » proposée un mardi
 * soir ne montre rien le mercredi, le jour où l'enfant est justement à la
 * maison.
 *
 * **La correction retenue** : on garde toutes les routines, et l'écran dit
 * quand les missions reprennent — voir `prochaineJournee` et le groupe
 * d'essais du même nom, plus bas. Ce groupe-ci constate ce qui reste vrai
 * après elle : les missions n'apparaissent toujours pas le samedi, et c'est
 * voulu. Ce qui change, c'est ce que l'enfant en apprend.
 */
describe('une famille qui s’inscrit le week-end', () => {
  const samedi = new Date('2026-09-12T10:00:00.000Z');

  it('compte cinq routines sur douze qui ne tournent pas tous les jours', () => {
    // Le nombre est vérifié, pas supposé : si quelqu'un rend une routine
    // quotidienne, ou en restreint une de plus, cet essai le dit.
    const restreintes = ROUTINES.filter((r) => r.repeat.kind === 'weekdays');
    expect(ROUTINES).toHaveLength(12);
    expect(restreintes.map((r) => r.id)).toEqual([
      'matin',
      'ecole',
      'maison',
      'travail',
      'maison-ado',
    ]);
  });

  it('laisse l’enfant devant un écran vide si sa routine est en semaine', () => {
    const enSemaine = ROUTINES.find((r) => r.repeat.kind === 'weekdays')!;
    const data = familleDuSite({ routineId: enSemaine.id, age: 9, creeeLe: samedi });

    // Ce que voit l'enfant le jour même de l'inscription.
    expect(missionsForChild(data, 'enfant-web', samedi)).toHaveLength(0);
    // Et ce qui existe pourtant bel et bien dans la famille.
    expect(data.missions.length).toBeGreaterThan(0);
  });

  it('les fait apparaître le lundi', () => {
    const lundi = new Date('2026-09-14T10:00:00.000Z');
    const enSemaine = ROUTINES.find((r) => r.repeat.kind === 'weekdays')!;
    const data = familleDuSite({ routineId: enSemaine.id, age: 9, creeeLe: samedi });

    expect(missionsForChild(data, 'enfant-web', lundi).length).toBeGreaterThan(0);
  });
});

/**
 * --------------------------------------------- dire quand, au lieu de dire rien
 *
 * La correction retenue : on garde toutes les routines, et l'écran annonce le
 * jour où les missions reprennent. Un enfant à qui l'on dit « tes missions
 * reprennent lundi · 5 missions t'attendent » apprend quelque chose de vrai ;
 * « ton parent va bientôt t'en proposer une » lui apprend le contraire de ce
 * qui est.
 */
describe('la prochaine journée', () => {
  const samedi = new Date('2026-09-12T10:00:00.000Z');

  it('trouve le lundi quand la routine est en semaine', () => {
    const data = familleDuSite({ routineId: 'matin', age: 9, creeeLe: samedi });
    const suite = prochaineJournee(data, 'enfant-web', samedi)!;

    expect(suite).not.toBeNull();
    expect(suite.jour.getDay()).toBe(1); // lundi
    expect(suite.missions.length).toBeGreaterThan(0);
    expect(nommerLeJour(suite.jour, samedi)).toBe('lundi');
  });

  it('dit « demain » plutôt que de nommer le jour, quand c’est demain', () => {
    // Un enfant de six ans comprend « demain » avant « dimanche ».
    const vendredi = new Date('2026-09-11T10:00:00.000Z');
    const data = familleDuSite({ routineId: 'coucher', age: 9, creeeLe: vendredi });
    const suite = prochaineJournee(data, 'enfant-web', vendredi)!;

    expect(nommerLeJour(suite.jour, vendredi)).toBe('demain');
  });

  it('rend null quand il n’y a vraiment rien — et c’est la seule fois', () => {
    // Le seul cas où « ton parent va bientôt t'en proposer une » est vrai.
    const data = familleDuSite({ routineId: 'matin', age: 9, creeeLe: samedi });
    const sansRien = { ...data, assignments: [] };

    expect(prochaineJournee(sansRien, 'enfant-web', samedi)).toBeNull();
  });

  it('ignore les missions archivées', () => {
    const data = familleDuSite({ routineId: 'matin', age: 9, creeeLe: samedi });
    const archivees = { ...data, missions: data.missions.map((m) => ({ ...m, archived: true })) };

    expect(prochaineJournee(archivees, 'enfant-web', samedi)).toBeNull();
  });

  it('ne regarde pas les missions d’un autre enfant', () => {
    const data = familleDuSite({ routineId: 'matin', age: 9, creeeLe: samedi });
    expect(prochaineJournee(data, 'quelquun-dautre', samedi)).toBeNull();
  });

  it('trouve le mercredi pour une routine du mercredi et du samedi', () => {
    // Le pire cas, et il ne tombe pas le week-end : « Ma part à la maison »
    // proposée un jeudi ne montre rien pendant deux jours.
    const jeudi = new Date('2026-09-10T10:00:00.000Z');
    const data = familleDuSite({ routineId: 'maison-ado', age: 15, creeeLe: jeudi });
    const suite = prochaineJournee(data, 'enfant-web', jeudi)!;

    expect(suite.jour.getDay()).toBe(6); // samedi
    expect(nommerLeJour(suite.jour, jeudi)).toBe('samedi');
  });

  /**
   * Le changement d'heure.
   *
   * L'écran annonce un jour de la semaine à un enfant : se tromper deux fois
   * par an suffit à rendre la phrase fausse au moment où elle compte. Les
   * essais tournent à l'heure de Paris — voir `jest.setup.ts` — donc la nuit du
   * passage à l'heure d'été est réellement traversée ici.
   *
   * Réserve honnête sur la portée de cet essai : il ne tomberait pas si l'on
   * remplaçait le constructeur `Date` par une addition de millisecondes, parce
   * que le décalage se joue à deux heures du matin et que la comparaison porte
   * sur la date. Il verrouille le comportement attendu, pas l'implémentation
   * qui le produit.
   */
  it('ne se trompe pas de jour au changement d’heure', () => {
    // Nuit du 28 au 29 mars 2026 : la France passe à l'heure d'été.
    const veille = new Date('2026-03-28T10:00:00.000Z'); // un samedi
    const data = familleDuSite({ routineId: 'coucher', age: 9, creeeLe: veille });
    const suite = prochaineJournee(data, 'enfant-web', veille)!;

    expect(suite.jour.getDay()).toBe(0); // dimanche 29, et non samedi 28
    expect(suite.jour.getDate()).toBe(29);
  });

  it('ne cherche pas au-delà d’une semaine', () => {
    // Une règle de récurrence ne peut rien rendre au-delà que la semaine ne
    // contienne déjà, et une boucle sans borne sur des données venues du client
    // est une boucle qu'on regrette.
    const data = familleDuSite({ routineId: 'matin', age: 9, creeeLe: samedi });
    const jamais = {
      ...data,
      missions: data.missions.map((m) => ({ ...m, repeat: { kind: 'weekdays' as const, days: [] } })),
    };

    expect(prochaineJournee(jamais, 'enfant-web', samedi)).toBeNull();
  });
});

/**
 * ------------------------------------------------ les jours, écrits noir sur blanc
 *
 * **Pourquoi cet essai existe.** J'ai décrit ces récurrences par « quatre
 * routines du lundi au vendredi », et c'était faux pour trois d'entre elles :
 * « Devoirs et école » et « Travail et révisions » sautent le mercredi, et
 * « Coup de main à la maison » ne tourne que le mercredi et le samedi. Le
 * calcul, lui, lit le vrai tableau et n'a jamais été faux — mais la description
 * est partie sur le site, où elle aurait pu être recopiée dans un traitement.
 *
 * Une valeur qu'on décrit de mémoire finit toujours par diverger de la valeur.
 * Celles-ci décident du jour où un enfant a quelque chose à faire, et de la
 * phrase que le site annonce à ses parents avant qu'ils ne paient.
 */
describe('les jours de chaque routine', () => {
  it('sont exactement ceux-ci, et rien d’autre', () => {
    const jours = Object.fromEntries(
      ROUTINES.map((r) => [r.id, r.repeat.kind === 'daily' ? 'tous les jours' : (r.repeat.days ?? [])]),
    );

    expect(jours).toEqual({
      matin: [1, 2, 3, 4, 5],
      coucher: 'tous les jours',
      ensemble: 'tous les jours',
      // Le mercredi manque, et ce n'est pas un oubli : c'est le jour sans
      // école de la semaine française.
      ecole: [1, 2, 4, 5],
      table: 'tous les jours',
      chambre: 'tous les jours',
      soin: 'tous les jours',
      // Mercredi et samedi : les deux jours où l'enfant est à la maison.
      maison: [3, 6],
      autonomie: 'tous les jours',
      travail: [1, 2, 4, 5],
      equilibre: 'tous les jours',
      'maison-ado': [3, 6],
    });
  });

  it('font que « Devoirs et école » ne montre rien le mercredi', () => {
    // Le cas qu'une description en « lundi-vendredi » rate, et il tombe le jour
    // où l'enfant est le plus disponible.
    const mardi = new Date('2026-09-15T18:00:00.000Z');
    const data = familleDuSite({ routineId: 'ecole', age: 9, creeeLe: mardi });
    const mercredi = new Date('2026-09-16T10:00:00.000Z');

    expect(missionsForChild(data, 'enfant-web', mercredi)).toHaveLength(0);
    expect(nommerLeJour(prochaineJournee(data, 'enfant-web', mercredi)!.jour, mercredi)).toBe(
      'demain',
    );
  });
});
