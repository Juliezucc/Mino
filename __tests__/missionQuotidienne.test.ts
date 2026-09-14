import { buildDemoFamily } from '@/data/demo';
import { missionsForChild } from '@/domain/missions';
import type { FamilyData, MissionCompletion } from '@/domain/types';

/**
 * « Se brosser les dents » revient-elle demain ?
 *
 * **La question de Julie, posée après une semaine dans sa propre famille.** La
 * règle du domaine est juste — `isScheduledOn` rend vrai tous les jours pour
 * une mission quotidienne, et une complétion d'hier ne compte pas pour
 * aujourd'hui. Ces essais le gravent, parce que deux défauts INDÉPENDANTS
 * cassaient la répétition sans jamais toucher à cette règle :
 *
 *   1. la base réécrivait `completed_at` à chaque confirmation du parent — la
 *      déclaration d'hier prenait la date du jour, et la mission restait faite.
 *      Corrigé par `trg_freeze_completed_at`.
 *   2. la liste de l'enfant était mémorisée avec un « maintenant » figé.
 *      Corrigé par `useJourCivil`.
 *
 * Le premier ne se voit qu'en SQL, le second qu'à l'écran. Ce fichier tient la
 * règle entre les deux : quelle que soit la façon dont on abîme le tour de la
 * maison, une mission quotidienne faite hier est à refaire aujourd'hui.
 */
const HIER = new Date('2026-09-13T20:00:00.000Z');
const AUJOURDHUI = new Date('2026-09-14T08:00:00.000Z');

function familleAvecQuotidienne(): { data: FamilyData; childId: string; missionId: string } {
  const data = buildDemoFamily(HIER);
  const child = data.children[0];
  const mission = data.missions.find((m) => m.repeat.kind === 'daily');
  if (!mission) throw new Error('la famille de démonstration doit porter une mission quotidienne');
  return { data, childId: child.id, missionId: mission.id };
}

function avecCompletion(
  data: FamilyData,
  over: Partial<MissionCompletion> & Pick<MissionCompletion, 'missionId' | 'childId'>,
): FamilyData {
  const assignment = data.assignments.find(
    (a) => a.missionId === over.missionId && a.childId === over.childId,
  );
  if (!assignment) throw new Error('mission non attribuée à cet enfant');
  return {
    ...data,
    completions: [
      ...data.completions.filter((c) => c.missionId !== over.missionId || c.childId !== over.childId),
      {
        id: 'cmp_test',
        familyId: data.family.id,
        assignmentId: assignment.id,
        status: 'approved',
        minutesRequested: 10,
        minutesAwarded: 10,
        completedAt: HIER.toISOString(),
        ...over,
      } as MissionCompletion,
    ],
  };
}

describe('une mission quotidienne revient le lendemain', () => {
  it('est À FAIRE aujourd’hui quand elle a été faite et validée hier', () => {
    const { data, childId, missionId } = familleAvecQuotidienne();
    const avec = avecCompletion(data, { missionId, childId, status: 'approved' });

    const aujourdhui = missionsForChild(avec, childId, AUJOURDHUI).find(
      (m) => m.mission.id === missionId,
    );
    expect(aujourdhui?.state).toBe('todo');
  });

  it('reste FAITE le jour même — on ne la fait pas deux fois', () => {
    const { data, childId, missionId } = familleAvecQuotidienne();
    const avec = avecCompletion(data, {
      missionId,
      childId,
      status: 'approved',
      completedAt: AUJOURDHUI.toISOString(),
    });

    const aujourdhui = missionsForChild(avec, childId, AUJOURDHUI).find(
      (m) => m.mission.id === missionId,
    );
    expect(aujourdhui?.state).toBe('done');
  });

  it('revient même si le parent a validé le LENDEMAIN', () => {
    // Le cas qui cassait : la confirmation tardive réécrivait `completedAt`.
    // Le domaine ne regarde que `completedAt`, jamais `reviewedAt` — c'est
    // exactement pour cela que geler la colonne côté base suffit.
    const { data, childId, missionId } = familleAvecQuotidienne();
    const avec = avecCompletion(data, {
      missionId,
      childId,
      status: 'approved',
      completedAt: HIER.toISOString(),
      reviewedAt: AUJOURDHUI.toISOString(),
    });

    const aujourdhui = missionsForChild(avec, childId, AUJOURDHUI).find(
      (m) => m.mission.id === missionId,
    );
    expect(aujourdhui?.state).toBe('todo');
  });

  it('et une mission SANS répétition, elle, reste faite pour toujours', () => {
    const { data, childId } = familleAvecQuotidienne();
    const unique = data.missions.find((m) => m.repeat.kind === 'never');
    if (!unique) return; // la démo n'en porte pas toujours
    const avec = avecCompletion(data, { missionId: unique.id, childId, status: 'approved' });

    const aujourdhui = missionsForChild(avec, childId, AUJOURDHUI).find(
      (m) => m.mission.id === unique.id,
    );
    expect(aujourdhui?.state).toBe('done');
  });
});
