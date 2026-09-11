import * as actions from '@/domain/actions';
import { buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { inscriptionInachevee, isFirstRun } from '@/domain/firstRun';
import {
  codeTropFacile,
  demandeLeCodeALInscription,
  parentGate,
  refermerEnArrierePlan,
} from '@/domain/parentGate';
import { FamilyData } from '@/domain/types';
import {
  balanceOf,
  celebrationFor,
  pendingCompletions,
  uncelebratedCompletions,
} from '@/domain/ledger';
import { childrenOfMission, missionsForChild } from '@/domain/missions';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * The reference scenario, end to end, through the real store:
 *
 *   Julie creates "Ranger ta chambre +15" for Noah
 *     → Noah sees the mission
 *     → Noah taps "J'ai terminé"
 *     → Julie sees the request
 *     → Julie taps "C’est fait · +15 min"
 *     → Noah gets a celebration and his counter goes from 35 to 50.
 */
describe('mission → validation → minutes', () => {
  const store = () => useMinoStore.getState();

  beforeEach(async () => {
    await store().startDemo();
  });

  it('takes Noah from 35 to 50 minutes', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const balance = () => {
      const data = useMinoStore.getState().data!;
      return data.transactions.reduce((sum, tx) => (tx.childId === noah.id ? sum + tx.delta : sum), 0);
    };

    // Demo starts exactly where the brief says.
    expect(balance()).toBe(35);

    // 1. Julie creates the mission.
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });

    // 2. Noah sees it, still to do.
    const visible = missionsForChild(useMinoStore.getState().data!, noah.id);
    const mine = visible.find((m) => m.mission.id === missionId);
    expect(mine).toBeDefined();
    expect(mine!.state).toBe('todo');

    // 3. Noah taps "J'ai terminé" — no minutes yet, just a request.
    const { id: completionId } = await store().completeMission(noah.id, missionId);
    expect(balance()).toBe(35);
    expect(
      missionsForChild(useMinoStore.getState().data!, noah.id).find(
        (m) => m.mission.id === missionId,
      )!.state,
    ).toBe('pending');

    // 4. Julie sees the request.
    const requests = pendingCompletions(useMinoStore.getState().data!);
    expect(requests.some((r) => r.id === completionId)).toBe(true);

    // 5. Julie validates: minutes land immediately, as one ledger entry.
    await store().approveCompletion(completionId);
    expect(balance()).toBe(50);

    const data = useMinoStore.getState().data!;
    const tx = data.transactions.filter((t) => t.refId === completionId);
    expect(tx).toHaveLength(1);
    expect(tx[0].delta).toBe(15);
    expect(tx[0].kind).toBe('mission_reward');
    expect(tx[0].reason).toBe('Ranger ta chambre');

    // 6. Noah owes himself a celebration, once.
    const toCelebrate = uncelebratedCompletions(data, noah.id);
    expect(toCelebrate.map((c) => c.id)).toEqual([completionId]);

    await store().markCelebrated(completionId);
    expect(uncelebratedCompletions(useMinoStore.getState().data!, noah.id)).toHaveLength(0);

    // The mission now reads as done for the day.
    expect(
      missionsForChild(useMinoStore.getState().data!, noah.id).find(
        (m) => m.mission.id === missionId,
      )!.state,
    ).toBe('done');
  });

  it('adds no minutes when the parent refuses', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });

    const { id: completionId } = await store().completeMission(noah.id, missionId);
    await store().rejectCompletion(completionId);

    const data = useMinoStore.getState().data!;
    expect(data.transactions.filter((t) => t.refId === completionId)).toHaveLength(0);
    expect(
      data.transactions.reduce((s, t) => (t.childId === noah.id ? s + t.delta : s), 0),
    ).toBe(35);

    // A refused mission goes back to the to-do list — the child can try again.
    expect(
      missionsForChild(data, noah.id).find((m) => m.mission.id === missionId)!.state,
    ).toBe('todo');
  });

  it('refuses to validate the same request twice', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });
    const { id: completionId } = await store().completeMission(noah.id, missionId);

    await store().approveCompletion(completionId);
    await expect(store().approveCompletion(completionId)).rejects.toThrow();

    const data = useMinoStore.getState().data!;
    expect(data.transactions.filter((t) => t.refId === completionId)).toHaveLength(1);
    expect(
      data.transactions.reduce((s, t) => (t.childId === noah.id ? s + t.delta : s), 0),
    ).toBe(50);
  });

  it('does not let a child send the same mission twice while it waits', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });

    await store().completeMission(noah.id, missionId);
    await expect(store().completeMission(noah.id, missionId)).rejects.toThrow();
  });

  it('keeps the demo waiting request visible to the parent', async () => {
    const data = useMinoStore.getState().data!;
    const requests = pendingCompletions(data);
    expect(requests).toHaveLength(1);

    const elliott = data.children.find((c) => c.firstName === 'Elliott')!;
    expect(requests[0].childId).toBe(elliott.id);

    await store().approveCompletion(requests[0].id);
    const after = useMinoStore.getState().data!;
    expect(after.transactions.reduce((s, t) => (t.childId === elliott.id ? s + t.delta : s), 0)).toBe(
      30,
    );
  });
});

/**
 * Une mission qui se compte d'elle-même.
 *
 * Le parent a décidé d'avance de faire confiance sur cette mission-là : se
 * brosser les dents ne mérite pas une confirmation quotidienne, et un parent qui
 * confirme dix fois par jour finit par confirmer sans regarder — ce qui revient
 * au même, en pire.
 *
 * La règle d'or ne bouge pas pour autant : aucune minute n'arrive sans une ligne
 * au registre, écrite dans la même opération.
 */
describe('les missions sans confirmation', () => {
  const famille = () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const noah = base.children[0];
    const { data, mission } = actions.createMission(
      base,
      {
        title: 'Me brosser les dents',
        icon: '🪥',
        minutes: 5,
        repeat: { kind: 'daily' },
        childIds: [noah.id],
        autoApprove: true,
        createdBy: base.parents[0].id,
      },
      new Date('2026-08-20T09:00:00.000Z'),
    );
    return { data, mission, noah };
  };

  it('crédite les minutes tout de suite, avec sa ligne au registre', () => {
    const { data, mission, noah } = famille();
    const avant = balanceOf(data.transactions, noah.id);

    const out = actions.completeMission(data, { childId: noah.id, missionId: mission.id });

    expect(out.completion.status).toBe('approved');
    expect(out.completion.minutesAwarded).toBe(5);
    expect(out.transaction).toBeDefined();
    expect(out.transaction!.delta).toBe(5);
    expect(out.transaction!.refId).toBe(out.completion.id);
    expect(balanceOf(out.data.transactions, noah.id)).toBe(avant + 5);
  });

  it('ne fait signer aucun parent qui n’a rien signé', () => {
    // L'historique ne doit pas laisser croire qu'un adulte a relu.
    const { data, mission, noah } = famille();
    const out = actions.completeMission(data, { childId: noah.id, missionId: mission.id });
    expect(out.completion.reviewedBy).toBeUndefined();
  });

  it('n’apparaît jamais dans les demandes du parent', () => {
    const { data, mission, noah } = famille();
    const out = actions.completeMission(data, { childId: noah.id, missionId: mission.id });
    const enAttente = out.data.completions.filter((c) => c.status === 'pending');
    expect(enAttente.some((c) => c.missionId === mission.id)).toBe(false);
  });

  it('ne se compte pas deux fois le même jour', () => {
    // Sans ce garde-fou, dix appuis valent dix fois les minutes : c'est le seul
    // vrai risque qu'ouvre la confiance accordée à une mission.
    const { data, mission, noah } = famille();
    const une = actions.completeMission(data, { childId: noah.id, missionId: mission.id });

    expect(() =>
      actions.completeMission(une.data, { childId: noah.id, missionId: mission.id }),
    ).toThrow(actions.DomainError);
  });

  it('laisse les autres missions attendre une confirmation', () => {
    // La confiance est accordée mission par mission, jamais en bloc.
    const { data, noah } = famille();
    const chambre = data.missions.find((m) => m.title === 'Ranger ma chambre')!;

    const out = actions.completeMission(data, { childId: noah.id, missionId: chambre.id });
    expect(out.completion.status).toBe('pending');
    expect(out.completion.minutesAwarded).toBe(0);
    expect(out.transaction).toBeUndefined();
  });

  it('reste facultative : une mission créée sans rien dire se confirme', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const { mission } = actions.createMission(
      base,
      {
        title: 'Sortir le chien',
        icon: '🐕',
        minutes: 10,
        repeat: { kind: 'daily' },
        childIds: [base.children[0].id],
        createdBy: base.parents[0].id,
      },
      new Date('2026-08-20T09:00:00.000Z'),
    );
    expect(mission.autoApprove).toBe(false);
  });
});

/**
 * Changer d'avis sur une mission déjà créée.
 *
 * Le réglage n'a de sens que s'il se retire : un parent découvre au bout d'une
 * semaine que confirmer « faire son lit » tous les matins ne lui apprend rien,
 * et c'est à ce moment-là qu'il doit pouvoir le changer — pas à la création,
 * où il ne sait pas encore.
 */
describe('modifier une mission', () => {
  it('accorde et retire la confiance après coup', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const lit = base.missions.find((m) => m.title === 'Faire mon lit')!;
    expect(lit.autoApprove).toBe(false);

    const ouverte = actions.updateMission(base, lit.id, { autoApprove: true });
    expect(ouverte.missions.find((m) => m.id === lit.id)!.autoApprove).toBe(true);

    const refermee = actions.updateMission(ouverte, lit.id, { autoApprove: false });
    expect(refermee.missions.find((m) => m.id === lit.id)!.autoApprove).toBe(false);
  });

  it('ne touche pas au temps déjà gagné', () => {
    // Les complétions gardent une copie du barème : rouvrir une mission ne
    // réécrit pas ce qu'un enfant a déjà obtenu.
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const noah = base.children[0];
    const avant = balanceOf(base.transactions, noah.id);

    const apres = actions.updateMission(base, base.missions[0].id, { autoApprove: true });
    expect(balanceOf(apres.transactions, noah.id)).toBe(avant);
  });

  it('refuse un nom vide', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    expect(() => actions.updateMission(base, base.missions[0].id, { title: '   ' })).toThrow(
      actions.DomainError,
    );
  });

  /**
   * Le temps gagné se change — c'était le trou.
   *
   * Une routine crée huit missions à quinze minutes ; sans cela, le parent
   * n'avait qu'un chemin pour en régler une, supprimer et recréer, et celui-là
   * efface pour de bon ce que l'enfant a déjà accompli.
   */
  it('change le temps gagné pour la suite, sans réécrire le passé', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const noah = base.children[0];
    const avant = balanceOf(base.transactions, noah.id);
    const mission = base.missions[0];

    const apres = actions.updateMission(base, mission.id, { minutes: 5 });

    expect(apres.missions.find((m) => m.id === mission.id)!.minutes).toBe(5);
    // Ce qui a déjà été gagné l'a été au tarif d'alors : chaque complétion en
    // garde sa propre copie.
    expect(balanceOf(apres.transactions, noah.id)).toBe(avant);
    for (const c of apres.completions.filter((c) => c.missionId === mission.id)) {
      const origine = base.completions.find((o) => o.id === c.id)!;
      expect(c.minutesRequested).toBe(origine.minutesRequested);
      expect(c.minutesAwarded).toBe(origine.minutesAwarded);
    }
  });

  it('refuse un temps nul et une mission sans personne', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const id = base.missions[0].id;
    expect(() => actions.updateMission(base, id, { minutes: 0 })).toThrow(actions.DomainError);
    expect(() => actions.updateMission(base, id, { childIds: [] })).toThrow(actions.DomainError);
  });

  it('change les jours de répétition', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const id = base.missions[0].id;
    const apres = actions.updateMission(base, id, { repeat: { kind: 'weekdays', days: [6, 0] } });
    expect(apres.missions.find((m) => m.id === id)!.repeat).toEqual({
      kind: 'weekdays',
      days: [6, 0],
    });
  });

  /**
   * Retirer un enfant **désactive** son affectation, sans jamais la supprimer.
   *
   * Une complétion pointe sur son affectation : effacer la ligne ferait
   * disparaître de l'historique une mission réellement accomplie. Et remettre
   * l'enfant doit retrouver la même ligne, pas en créer une deuxième.
   */
  it('retire et remet un enfant sans perdre son histoire', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const mission = base.missions[0];
    const noah = childrenOfMission(base, mission.id)[0];
    const affectations = () =>
      base.assignments.filter((a) => a.missionId === mission.id).length;
    const avant = affectations();

    const autre = base.children.find((c) => c.id !== noah)!;
    const sansNoah = actions.updateMission(base, mission.id, { childIds: [autre.id] });

    expect(childrenOfMission(sansNoah, mission.id)).toEqual([autre.id]);
    expect(sansNoah.assignments.filter((a) => a.missionId === mission.id).length)
      .toBeGreaterThanOrEqual(avant);
    // La ligne de Noah est toujours là, simplement inactive : ses complétions
    // la référencent.
    expect(
      sansNoah.assignments.some(
        (a) => a.missionId === mission.id && a.childId === noah && !a.active,
      ),
    ).toBe(true);

    const remis = actions.updateMission(sansNoah, mission.id, { childIds: [noah, autre.id] });
    expect(childrenOfMission(remis, mission.id).sort()).toEqual([noah, autre.id].sort());
    // Et pas de doublon : on réactive, on ne recrée pas.
    expect(
      remis.assignments.filter((a) => a.missionId === mission.id && a.childId === noah).length,
    ).toBe(1);
  });
});

/**
 * Une soirée de validations ne fait qu'une célébration.
 *
 * Le défaut se voyait au premier usage réel : le parent confirme les missions
 * de la journée d'un coup, l'enfant reprend son téléphone et reçoit autant
 * d'écrans de confettis qu'il y avait de missions, chacun s'ouvrant sur le
 * précédent. Le premier fait plaisir ; le troisième est un obstacle entre
 * l'enfant et son temps d'écran.
 */
describe('célébrer plusieurs missions à la fois', () => {
  const store = () => useMinoStore.getState();

  beforeEach(async () => {
    await store().startDemo();
  });

  it('marque tout le lot en une fois, et n’en laisse aucun derrière', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;

    const ids: string[] = [];
    for (const [titre, minutes] of [
      ['Ranger ta chambre', 15],
      ['Mettre la table', 10],
      ['Sortir le chien', 5],
    ] as const) {
      const missionId = await store().addMission({
        title: titre,
        icon: '⭐',
        minutes,
        repeat: { kind: 'daily' },
        childIds: [noah.id],
      });
      const { id } = await store().completeMission(noah.id, missionId);
      await store().approveCompletion(id);
      ids.push(id);
    }

    const attente = uncelebratedCompletions(useMinoStore.getState().data!, noah.id);
    expect(attente).toHaveLength(3);
    // Ce que l'écran affiche en gros : le total, pas trois fois une ligne.
    expect(attente.reduce((s, c) => s + (c.minutesAwarded ?? 0), 0)).toBe(30);

    await store().markCelebrated(attente.map((c) => c.id));

    expect(uncelebratedCompletions(useMinoStore.getState().data!, noah.id)).toHaveLength(0);
    for (const id of ids) {
      expect(
        useMinoStore.getState().data!.completions.find((c) => c.id === id)!.celebratedAt,
      ).toBeDefined();
    }
  });

  it('n’en fait qu’une, avec le total en gros', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;

    for (const minutes of [15, 10, 5]) {
      const missionId = await store().addMission({
        title: `Mission ${minutes}`,
        icon: '⭐',
        minutes,
        repeat: { kind: 'daily' },
        childIds: [noah.id],
      });
      const { id } = await store().completeMission(noah.id, missionId);
      await store().approveCompletion(id);
    }

    // C'est ce que l'écran affiche : un lot, un total. Trois célébrations à la
    // file, c'était trois fois cet appel avec une complétion chacun.
    const fete = celebrationFor(useMinoStore.getState().data!, noah.id);
    expect(fete.completions).toHaveLength(3);
    expect(fete.minutes).toBe(30);

    await store().markCelebrated(fete.completions.map((c) => c.id));

    // Et il n'y a pas de deuxième écran derrière.
    expect(celebrationFor(useMinoStore.getState().data!, noah.id).completions).toHaveLength(0);
  });

  it('ne mélange jamais deux enfants', async () => {
    const data = store().data!;
    const noah = data.children[0];
    const autre = data.children[1];

    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });
    const { id } = await store().completeMission(noah.id, missionId);
    await store().approveCompletion(id);

    // Même en désignant la complétion de Noah, l'écran de l'autre enfant ne la
    // reprend pas : la célébration appartient à celui qui l'a gagnée.
    const chezLautre = celebrationFor(useMinoStore.getState().data!, autre.id, id);
    expect(chezLautre.completions.some((c) => c.id === id)).toBe(false);
  });

  it('accepte encore un identifiant seul', async () => {
    // L'écran d'une mission qui se compte toute seule en passe un, et lui
    // seul : la forme au singulier doit continuer de marcher.
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Se brosser les dents',
      icon: '🪥',
      minutes: 5,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });
    const { id } = await store().completeMission(noah.id, missionId);
    await store().approveCompletion(id);

    await store().markCelebrated(id);
    expect(uncelebratedCompletions(useMinoStore.getState().data!, noah.id)).toHaveLength(0);
  });

  /**
   * ------------------------------------------------------------ l'écran blanc
   *
   * Relevé sur une vraie tablette : un parent valide une mission depuis
   * l'espace parent, repasse sur le profil de son enfant, et tombe sur un écran
   * entièrement blanc — pas un mot, pas un bouton. Il faut connaître le geste
   * « retour » pour en sortir, et un enfant de cinq ans ne le connaît pas.
   *
   * La cause : deux endroits décidaient de ce qu'il y avait à fêter, à deux
   * instants différents. La coquille de l'espace enfant ouvrait l'écran ;
   * l'écran refaisait le calcul à son montage, quelques images plus tard. Il
   * suffisait qu'un rafraîchissement venu du serveur passe entre les deux — et
   * il passe, justement quand le parent vient de valider depuis le même
   * appareil — pour que la liste arrive vide.
   *
   * Celui qui ouvre nomme donc ce qu'il a vu, et c'est ce que tient ce test :
   * une complétion déjà marquée comme fêtée se fête quand même si on la nomme.
   */
  it('fête ce qu’on lui nomme, même si la liste a bougé entre-temps', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Mettre la table',
      icon: '🍽️',
      minutes: 10,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });
    const { id } = await store().completeMission(noah.id, missionId);
    await store().approveCompletion(id);

    // Le rafraîchissement qui arrive entre l'ouverture et le montage.
    await store().markCelebrated(id);
    expect(uncelebratedCompletions(useMinoStore.getState().data!, noah.id)).toHaveLength(0);

    const fete = celebrationFor(useMinoStore.getState().data!, noah.id, [id]);
    expect(fete.completions.map((c) => c.id)).toEqual([id]);
    expect(fete.minutes).toBe(10);
  });

  it('ne nomme jamais deux fois la même complétion', async () => {
    // La coquille nomme ce qu'elle a vu ; l'écran y ajoute ce qui attend
    // encore. Si les deux se recoupent — le cas ordinaire — le total ne doit
    // pas doubler : c'est le chiffre que l'enfant lit en grand.
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Sortir le chien',
      icon: '🐕',
      minutes: 20,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });
    const { id } = await store().completeMission(noah.id, missionId);
    await store().approveCompletion(id);

    const fete = celebrationFor(useMinoStore.getState().data!, noah.id, [id]);
    expect(fete.completions).toHaveLength(1);
    expect(fete.minutes).toBe(20);
  });
});

describe('la toute première ouverture', () => {
  /**
   * Le trou trouvé en conduisant le vrai parcours d'inscription : un parent
   * qui vient de tout créer arrivait sur un écran qui lui disait trois fois
   * qu'il n'y avait rien, et jamais ce qu'il devait faire ensuite.
   */
  const famille = (): FamilyData => {
    const base = buildEmptyFamily(
      { familyName: 'Martin', parentName: 'Julie', email: 'julie@wheb.fr' },
      new Date('2026-08-20T09:00:00.000Z'),
    );
    return actions.createChild(base, { firstName: 'Noah', age: 8, avatarKey: 'fox' }).data;
  };

  it('se reconnaît quand la famille existe mais que rien n’a été gagné', () => {
    expect(isFirstRun(famille())).toBe(true);
  });

  it('ne se déclenche pas tant qu’aucun enfant n’existe', () => {
    // Cet écran-là a déjà sa propre invite : « Créer un profil enfant ».
    const vide = buildEmptyFamily(
      { familyName: 'Martin', parentName: 'Julie', email: 'julie@wheb.fr' },
      new Date('2026-08-20T09:00:00.000Z'),
    );
    expect(isFirstRun(vide)).toBe(false);
  });

  it('s’efface à la première minute gagnée, sans que personne ait à la fermer', () => {
    const base = famille();
    const noah = base.children[0];
    const avec = actions.adjustBalance(base, {
      childId: noah.id,
      delta: 15,
      reason: 'Bienvenue sur Mino',
    });
    expect(isFirstRun(avec)).toBe(false);
  });

  it('s’arrête dès que l’enfant a terminé une mission, avant toute minute', () => {
    // Le défaut trouvé en conduisant le parcours : « j'ai terminé » n'écrit
    // qu'une complétion en attente, aucune minute. Une règle qui ne regardait
    // que le registre laissait donc l'écran en mode « première ouverture »,
    // masquait la section des demandes, et la toute première mission de la
    // toute première famille devenait impossible à confirmer.
    const base = famille();
    const noah = base.children[0];
    const avec = actions.createMission(base, {
      title: 'Ranger mes affaires',
      icon: '🧺',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
      createdBy: base.parents[0].id,
    });
    const termine = actions.completeMission(avec.data, {
      childId: noah.id,
      missionId: avec.mission.id,
    });

    expect(balanceOf(termine.data.transactions, noah.id)).toBe(0);
    expect(pendingCompletions(termine.data).length).toBe(1);
    expect(isFirstRun(termine.data)).toBe(false);
  });

  it('ne revient pas quand le solde retombe à zéro', () => {
    // Un enfant qui a tout dépensé n'est pas un enfant qui débute : le registre
    // garde ses lignes, et c'est bien lui qu'on interroge.
    const base = famille();
    const noah = base.children[0];
    const gagne = actions.adjustBalance(base, {
      childId: noah.id,
      delta: 15,
      reason: 'Bienvenue sur Mino',
    });
    const depense = actions.adjustBalance(gagne, {
      childId: noah.id,
      delta: -15,
      reason: 'Temps d’écran utilisé',
    });
    expect(balanceOf(depense.transactions, noah.id)).toBe(0);
    expect(isFirstRun(depense)).toBe(false);
  });
});

describe('le code parent, selon l’appareil', () => {
  /**
   * La tablette d'un enfant n'a pas de code parent — il appartient au compte du
   * parent. L'écran en concluait « aucun code n'est défini » et laissait
   * l'enfant en choisir un, ce qui lui ouvrait l'espace parent chez lui.
   */
  it('laisse un parent choisir son code s’il n’en a pas', () => {
    expect(parentGate({ hasPin: false, onChildDevice: false })).toBe('create');
  });

  it('ne laisse jamais l’appareil d’un enfant choisir le code', () => {
    expect(parentGate({ hasPin: false, onChildDevice: true })).toBe('ask-a-parent');
  });

  it('demande simplement le code dès qu’il existe, où que l’on soit', () => {
    expect(parentGate({ hasPin: true, onChildDevice: true })).toBe('enter');
    expect(parentGate({ hasPin: true, onChildDevice: false })).toBe('enter');
  });
});

describe('ce que l’enfant voit quand l’abonnement est fini', () => {
  /**
   * Trouvé en conduisant : l'écran de mission décidait de fêter d'après
   * `mission.autoApprove`, c'est-à-dire d'après le réglage. Le jour où le
   * réglage et le résultat divergent — abonnement terminé, la mission redevient
   * ordinaire — un enfant a été félicité pour « +0 MINO », confettis compris.
   */
  it('rend « counted » faux quand rien n’a été crédité', () => {
    const base = buildDemoFamily(new Date('2026-08-20T09:00:00.000Z'));
    const auto = base.missions.find((m) => m.autoApprove)!;
    const enfant = base.assignments.find((a) => a.missionId === auto.id)!.childId;
    const demain = new Date('2026-08-21T09:00:00.000Z');

    const credite = actions.completeMission(
      base,
      { childId: enfant, missionId: auto.id, autoApproveAllowed: true },
      demain,
    );
    const enAttente = actions.completeMission(
      base,
      { childId: enfant, missionId: auto.id, autoApproveAllowed: false },
      demain,
    );

    // C'est exactement ce booléen que l'écran doit regarder pour fêter, et pas
    // le réglage de la mission.
    expect(!!credite.transaction).toBe(true);
    expect(!!enAttente.transaction).toBe(false);
    expect(enAttente.completion.minutesAwarded).toBe(0);
  });
});

/**
 * ---------------------------------------------------------------------------
 * L'inscription abandonnée en chemin
 * ---------------------------------------------------------------------------
 *
 * Relevé sur TestFlight, au premier essai. Un parent revient en arrière d'un
 * geste pendant son inscription — ou son téléphone sonne — et à la réouverture
 * il est DANS l'application : famille créée, paywall sauté, aucun mot de passe,
 * et le sélecteur de profil qui affiche « null · protégé par un code ».
 *
 * La cause n'est pas un accident : la famille se fonde au premier écran, celui
 * du prénom de l'enfant, parce qu'il faut une famille pour y attacher un
 * enfant. Le parent, lui, ne se présente que deux écrans plus loin. Entre les
 * deux, la famille existe et le compte n'existe pas — et `app/index.tsx`
 * voyait une famille, donc ouvrait l'application.
 *
 * Le prénom du parent est le signal le plus sûr dont on dispose : la création
 * de compte écrit le prénom, l'adresse et le mot de passe d'un seul geste. Il
 * n'existe aucun état où l'un serait là sans les autres.
 */
describe('l’inscription abandonnée', () => {
  const fonderSansParent = (): FamilyData =>
    buildEmptyFamily(
      { familyName: 'Ma famille', consentAt: new Date('2026-09-10T09:00:00.000Z').toISOString() },
      new Date('2026-09-10T09:00:00.000Z'),
    );

  it('se reconnaît à un parent sans prénom', () => {
    expect(inscriptionInachevee(fonderSansParent())).toBe(true);
  });

  it('cesse dès que le compte est créé', () => {
    const base = fonderSansParent();
    const avecParent: FamilyData = {
      ...base,
      parents: [{ ...base.parents[0], displayName: 'Julie', email: 'julie@wheb.fr' }],
    };
    expect(inscriptionInachevee(avecParent)).toBe(false);
  });

  it('ne se déclenche pas sur un prénom fait d’espaces', () => {
    // Un champ rempli puis effacé laisse une chaîne vide, pas un `null`. Elle
    // s'affiche aussi mal, et elle veut dire la même chose.
    const base = fonderSansParent();
    const vide: FamilyData = { ...base, parents: [{ ...base.parents[0], displayName: '   ' }] };
    expect(inscriptionInachevee(vide)).toBe(true);
  });

  it('laisse tranquille l’appareil d’un enfant arrivé par code famille', () => {
    // Aucune ligne parent visible : renvoyer cet appareil-là vers une
    // inscription serait absurde — il n'en a jamais commencé.
    const base = fonderSansParent();
    expect(inscriptionInachevee({ ...base, parents: [] })).toBe(false);
  });
});

/**
 * ------------------------------------------ l'espace parent sur la tablette du salon
 *
 * **Trois trous, trouvés sur un vrai iPhone en répondant « il est partagé ».**
 *
 * 1. L'inscription ne demandait **jamais** de code à quatre chiffres. La
 *    condition qui le réclame ne vaut que pour un parent déjà connecté
 *    rejoignant une famille existante — pas pour celui qui vient de la fonder.
 *
 * 2. `parentUnlocked` passe à vrai à la fin de l'inscription et rien ne le
 *    remettait à faux avant le redémarrage de l'application. Le parent choisit
 *    le profil de son enfant, lui tend la tablette, l'enfant touche « Espace
 *    parent » — et entre. Il peut s'accorder des minutes, confirmer ses propres
 *    missions, retirer le blocage.
 *
 * 3. Même après redémarrage, l'écran du code proposait à l'enfant d'en
 *    **choisir** un : la tablette du salon porte la session du parent, donc
 *    elle passait pour son téléphone personnel.
 */
describe('l’espace parent sur un appareil qu’un enfant utilise', () => {
  it('se referme dès qu’un profil d’enfant devient actif', async () => {
    const store = () => useMinoStore.getState();
    await store().startDemo();

    // Ce que fait l'inscription juste avant de tendre la tablette.
    useMinoStore.setState({ parentUnlocked: true });
    const enfant = store().data!.children[0];

    store().selectChild(enfant.id);

    expect(useMinoStore.getState().parentUnlocked).toBe(false);
  });

  it('reste ouvert quand le parent revient au sélecteur', async () => {
    // `selectChild(null)` est le retour du parent vers « Qui utilise Mino ? ».
    // Le reverrouiller ici redemanderait le code pour rien, deux fois de suite.
    const store = () => useMinoStore.getState();
    await store().startDemo();
    useMinoStore.setState({ parentUnlocked: true });

    store().selectChild(null);

    expect(useMinoStore.getState().parentUnlocked).toBe(true);
  });

  it('refuse à l’enfant de choisir le code sur un appareil déclaré partagé', () => {
    expect(parentGate({ hasPin: false, onChildDevice: false, declareALEnfant: true })).toBe(
      'ask-a-parent',
    );
  });

  /**
   * Et le revers, qui compte autant : personne ne doit se retrouver enfermé
   * dehors. Le drapeau est un signal POSITIF — il n'est vrai que si le parent
   * l'a dit. L'absence de déclaration, c'est le cas de tous les appareils déjà
   * installés et de toute famille venue du site : ceux-là gardent « create »,
   * sans quoi leur parent n'aurait aucun moyen de poser un code.
   */
  it('n’enferme pas dehors un appareil dont personne n’a rien déclaré', () => {
    expect(parentGate({ hasPin: false, onChildDevice: false })).toBe('create');
    expect(parentGate({ hasPin: false, onChildDevice: false, declareALEnfant: false })).toBe(
      'create',
    );
  });

  it('laisse toujours entrer quand le code existe, quel que soit l’appareil', () => {
    expect(parentGate({ hasPin: true, onChildDevice: true, declareALEnfant: true })).toBe('enter');
    expect(parentGate({ hasPin: true, onChildDevice: false, declareALEnfant: true })).toBe('enter');
  });
});

/**
 * Le code parent à l'inscription.
 *
 * La règle vivait dans une condition d'écran qui disait l'inverse de ce
 * qu'elle devait dire : seul un parent déjà inscrit et sans famille se voyait
 * demander un code. Une inscription ordinaire n'en posait aucun, et l'espace
 * parent restait ouvert à l'enfant sur la tablette qu'on venait de partager.
 *
 * Une condition d'écran s'inverse sans que rien ne tombe — d'où ces deux
 * essais, et la règle sortie dans le domaine.
 */
describe('le code parent à l’inscription', () => {
  it('est demandé à toute inscription, sans exception de parcours', () => {
    expect(demandeLeCodeALInscription({ codeDejaPose: false })).toBe(true);
  });

  it('n’est pas redemandé à qui vient de le choisir', () => {
    // Le redemander laisserait croire que le premier n'a pas été retenu.
    expect(demandeLeCodeALInscription({ codeDejaPose: true })).toBe(false);
  });
});

/**
 * Le code parent, quand le parent est là.
 *
 * Le défaut vu en recette, capture à l'appui : le parent répond « cet appareil
 * est à Manon », l'application écrit le drapeau, puis l'envoie poser son
 * code — et l'écran du code relit ce drapeau tout neuf pour lui répondre
 * d'aller demander à un parent. Il ne pouvait plus en poser du tout, et les
 * familles déjà dans cet état n'avaient aucune issue.
 *
 * La règle ne savait dire qu'à QUI est l'appareil, jamais QUI est devant.
 */
describe('poser le code quand le parent est présent', () => {
  it('laisse le parent poser son code sur l’appareil qu’il vient de déclarer', () => {
    expect(
      parentGate({
        hasPin: false,
        onChildDevice: false,
        declareALEnfant: true,
        poseDemandeeParLeParent: true,
      }),
    ).toBe('create');
  });

  it('refuse toujours sans ce geste : l’enfant seul reçoit la même porte close', () => {
    expect(parentGate({ hasPin: false, onChildDevice: false, declareALEnfant: true })).toBe(
      'ask-a-parent',
    );
  });

  it('ne lève jamais la règle sur la tablette venue du code famille', () => {
    // Aucun signal ne vaut ici : la base elle-même refuse le code à cette
    // session (`set_parent_pin` exige `auth_is_parent()`). Un écran qui
    // proposerait le pavé numérique mentirait à l'enfant.
    expect(
      parentGate({
        hasPin: false,
        onChildDevice: true,
        declareALEnfant: true,
        poseDemandeeParLeParent: true,
      }),
    ).toBe('ask-a-parent');
  });

  it('demande simplement le code quand il existe déjà', () => {
    expect(
      parentGate({ hasPin: true, onChildDevice: true, poseDemandeeParLeParent: true }),
    ).toBe('enter');
  });
});

/**
 * Les codes qu'on devine du premier coup.
 *
 * La règle existait à l'inscription et nulle part ailleurs. Or l'écran du
 * code — celui qu'atteignent tous les rattrapages ajoutés depuis : le bandeau
 * du tableau de bord, la connexion par mot de passe, le changement d'appareil
 * dans les réglages — appelait `setParentPin` sans rien vérifier. La porte la
 * plus empruntée était la seule sans serrure.
 */
describe('la devinabilité du code parent', () => {
  it('refuse les quatre chiffres identiques et les deux suites connues', () => {
    for (const facile of ['0000', '1111', '7777', '9999', '1234']) {
      expect(codeTropFacile(facile)).toBe(true);
    }
  });

  it('laisse passer un code ordinaire', () => {
    for (const bon of ['4821', '1023', '2907', '4321']) {
      expect(codeTropFacile(bon)).toBe(false);
    }
  });
});

/**
 * Refermer l'espace parent quand la tablette est posée.
 *
 * Trouvé en cartographiant tous les chemins : aucun écouteur d'état
 * d'application n'existait, donc un espace parent ouvert le restait des
 * heures, écran éteint. Les deux seuls gestes qui le refermaient — passer par
 * le sélecteur de profils, toucher « Verrouiller » au fond des réglages —
 * sont exactement ceux que personne ne fait avant de tendre une tablette.
 */
describe('le verrou et la mise en arrière-plan', () => {
  it('referme sur l’appareil d’un enfant et sur la tablette partagée', () => {
    expect(refermerEnArrierePlan('enfant')).toBe(true);
    expect(refermerEnArrierePlan('partage')).toBe(true);
  });

  it('ne referme jamais sur le téléphone du parent', () => {
    // Quatre chiffres retapés vingt fois par jour deviennent « 1234 », ou se
    // tapent devant l'enfant. Le remède serait pire que le mal.
    expect(refermerEnArrierePlan('parent')).toBe(false);
  });
});
