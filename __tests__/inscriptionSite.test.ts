import { accessOf } from '@/domain/billing';
import { inscriptionInachevee, isFirstRun } from '@/domain/firstRun';
import { ROUTINES, convientA } from '@/domain/missionLibrary';
import { missionsForChild } from '@/domain/missions';
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
 * douze ne tournent pas tous les jours : quatre du lundi au vendredi, et « Ma
 * part à la maison » seulement le mercredi et le samedi. Une famille qui
 * s'inscrit le samedi — le jour où l'on s'occupe de ce genre de choses — paie,
 * installe l'application, tend la tablette à son enfant, et l'enfant voit
 * **« Aucune mission pour aujourd'hui »**.
 *
 * Rien n'est cassé, et c'est ce qui rend le défaut coûteux : le produit
 * fonctionne exactement comme prévu, et la première impression est celle d'une
 * application vide. Personne ne reste pour vérifier lundi.
 *
 * Le pire cas n'est pas le week-end : « Ma part à la maison » proposée un jeudi
 * ne montre rien avant le samedi. Deux jours entiers.
 *
 * Ces essais constatent l'état actuel — ils ne le corrigent pas. La correction
 * appartient au produit : soit le tunnel ne propose que des routines
 * quotidiennes, soit l'écran de l'enfant dit quand la première mission arrive
 * au lieu de dire qu'il n'y a rien.
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
