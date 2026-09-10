import { isSameDay } from './ledger';
import {
  FamilyData,
  ID,
  Mission,
  MissionAssignment,
  MissionCompletion,
  RepeatRule,
  Weekday,
} from './types';

export type MissionState = 'todo' | 'pending' | 'done';

export interface ChildMission {
  mission: Mission;
  assignment: MissionAssignment;
  state: MissionState;
  /** The completion driving `pending` / `done`, when there is one. */
  completion?: MissionCompletion;
}

/** Is the mission scheduled for that day? A one-shot mission is always schedulable. */
export function isScheduledOn(repeat: RepeatRule, date: Date): boolean {
  switch (repeat.kind) {
    case 'never':
      return true;
    case 'daily':
      return true;
    case 'weekdays':
      return (repeat.days ?? []).includes(date.getDay() as Weekday);
    default:
      return true;
  }
}

/**
 * A repeating mission resets every day; a one-shot mission stays done forever.
 * That is the only scheduling rule the MVP needs.
 */
function completionCountsForToday(
  completion: MissionCompletion,
  repeat: RepeatRule,
  now: Date,
): boolean {
  if (repeat.kind === 'never') return true;
  return isSameDay(completion.completedAt, now);
}

export function missionsForChild(
  data: FamilyData,
  childId: ID,
  now: Date = new Date(),
): ChildMission[] {
  const result: ChildMission[] = [];

  for (const assignment of data.assignments) {
    if (assignment.childId !== childId || !assignment.active) continue;

    const mission = data.missions.find((m) => m.id === assignment.missionId);
    if (!mission || mission.archived) continue;
    if (!isScheduledOn(mission.repeat, now)) continue;

    const relevant = data.completions
      .filter(
        (c) =>
          c.childId === childId &&
          c.missionId === mission.id &&
          c.status !== 'rejected' &&
          completionCountsForToday(c, mission.repeat, now),
      )
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

    const latest = relevant[0];
    const state: MissionState = !latest ? 'todo' : latest.status === 'pending' ? 'pending' : 'done';

    result.push({ mission, assignment, state, completion: latest });
  }

  // Missions still to do first — that is what a child needs to see.
  const order: Record<MissionState, number> = { todo: 0, pending: 1, done: 2 };
  return result.sort(
    (a, b) => order[a.state] - order[b.state] || a.mission.createdAt.localeCompare(b.mission.createdAt),
  );
}

export function missionById(data: FamilyData, missionId: ID): Mission | undefined {
  return data.missions.find((m) => m.id === missionId);
}

export function childrenOfMission(data: FamilyData, missionId: ID): ID[] {
  return data.assignments
    .filter((a) => a.missionId === missionId && a.active)
    .map((a) => a.childId);
}

export function describeRepeat(repeat: RepeatRule): string {
  const labels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  switch (repeat.kind) {
    case 'daily':
      return 'Tous les jours';
    case 'weekdays': {
      const days = (repeat.days ?? []).slice().sort();
      if (days.length === 0) return 'Certains jours';
      return days.map((d) => labels[d]).join(' · ');
    }
    default:
      return 'Une seule fois';
  }
}

/* --------------------------------------------------- le jour où ça recommence */

/**
 * Quand la prochaine mission de cet enfant arrive, et lesquelles.
 *
 * **Le défaut que cela répare, et il frappe au pire moment.** Cinq routines sur
 * douze ne tournent pas tous les jours. Une famille qui s'inscrit le samedi
 * avec « Routine du matin » — du lundi au vendredi — installe l'application,
 * tend la tablette à son enfant, et l'enfant lit « Pas encore de mission · ton
 * parent va bientôt t'en proposer une ». C'est faux : son parent en a déjà
 * proposé cinq. Elles commencent lundi.
 *
 * Rien n'est cassé, et c'est ce qui rend le défaut coûteux : le produit fait
 * exactement ce qui est écrit, et la première impression d'une famille qui
 * vient de payer est celle d'une application vide. Personne ne revient le lundi
 * pour vérifier.
 *
 * Le pire cas n'est pas le week-end : « Ma part à la maison » ne tourne que le
 * mercredi et le samedi, donc proposée un jeudi elle ne montre rien pendant
 * deux jours.
 *
 * `null` quand il n'y a vraiment rien — aucune mission attribuée, ou toutes
 * archivées. Là, « ton parent va bientôt t'en proposer une » est vrai, et c'est
 * la seule fois où il l'est.
 *
 * On ne cherche pas au-delà de sept jours : au-delà, une règle de récurrence ne
 * peut plus rien rendre qu'une semaine ne contienne déjà, et une boucle sans
 * borne sur des données que le client fournit est une boucle qu'on regrette.
 */
export function prochaineJournee(
  data: FamilyData,
  childId: ID,
  now: Date = new Date(),
): { jour: Date; missions: Mission[] } | null {
  const attribuees = data.assignments
    .filter((a) => a.childId === childId && a.active)
    .map((a) => data.missions.find((m) => m.id === a.missionId))
    .filter((m): m is Mission => !!m && !m.archived);

  if (attribuees.length === 0) return null;

  for (let dans = 1; dans <= 7; dans += 1) {
    // `new Date(a, m, j + n)` et non `now.getTime() + n * 86400000` : le
    // constructeur normalise le calendrier, donc il traverse les changements
    // d'heure sans se décaler, là où une addition de millisecondes rend la
    // veille deux fois par an. Midi plutôt que minuit ne change rien à Paris,
    // où le basculement a lieu à deux heures ; c'est une précaution pour les
    // fuseaux où minuit n'existe pas ce jour-là.
    const jour = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dans, 12);
    const missions = attribuees.filter((m) => isScheduledOn(m.repeat, jour));
    if (missions.length > 0) return { jour, missions };
  }

  return null;
}

/** « lundi », « demain » — ce qu'un enfant de six ans comprend sans lire une date. */
export function nommerLeJour(jour: Date, now: Date = new Date()): string {
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const minuitDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecart = Math.round((minuitDe(jour) - minuitDe(now)) / 86400000);
  if (ecart <= 1) return 'demain';
  return jours[jour.getDay()];
}
