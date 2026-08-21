import * as actions from '@/domain/actions';
import { buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { isFirstRun } from '@/domain/firstRun';
import { FamilyData } from '@/domain/types';
import { balanceOf, pendingCompletions, uncelebratedCompletions } from '@/domain/ledger';
import { missionsForChild } from '@/domain/missions';
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
    const completionId = await store().completeMission(noah.id, missionId);
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

    const completionId = await store().completeMission(noah.id, missionId);
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
    const completionId = await store().completeMission(noah.id, missionId);

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
