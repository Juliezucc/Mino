import { createId } from './id';
import {
  FreeWindow,
  FreeWindowInput,
  heure,
  openWindowAt,
  valideFenetre,
} from './freeWindows';

export type { FreeWindowInput } from './freeWindows';
import { balanceOf } from './ledger';
import { missionsForChild } from './missions';
import { Device, DeviceKind } from './devices';
import {
  AvatarKey,
  Child,
  FamilyData,
  ID,
  Mission,
  MissionAssignment,
  MissionCompletion,
  RepeatRule,
  ScreenTimeSession,
  ScreenTimeTransaction,
  TransactionKind,
} from './types';

/**
 * Every state change lives here as a pure function: (data, input) -> new data.
 * The store and the repositories only persist the result, which keeps the whole
 * product logic testable without React, navigation or a network.
 */

export class DomainError extends Error {}

function iso(now: Date) {
  return now.toISOString();
}

/* ------------------------------------------------------------------ children */

export interface CreateChildInput {
  firstName: string;
  age: number;
  avatarKey: AvatarKey;
  pin?: string;
  startingMinutes?: number;
  /** Ask a parent before every session, even on the device Mino runs on. */
  requireApproval?: boolean;
  companionEnabled?: boolean;
}

export function createChild(
  data: FamilyData,
  input: CreateChildInput,
  now: Date = new Date(),
): { data: FamilyData; child: Child } {
  const child: Child = {
    id: createId('child'),
    familyId: data.family.id,
    firstName: input.firstName.trim(),
    age: input.age,
    avatarKey: input.avatarKey,
    pin: input.pin,
    requireApproval: input.requireApproval,
    companionEnabled: input.companionEnabled,
    createdAt: iso(now),
  };

  const transactions = [...data.transactions];
  if (input.startingMinutes && input.startingMinutes > 0) {
    transactions.push({
      id: createId('tx'),
      familyId: data.family.id,
      childId: child.id,
      delta: input.startingMinutes,
      kind: 'initial_balance',
      reason: 'Solde de départ',
      createdAt: iso(now),
    });
  }

  return { data: { ...data, children: [...data.children, child], transactions }, child };
}

export function updateChild(data: FamilyData, childId: ID, patch: Partial<Child>): FamilyData {
  return {
    ...data,
    children: data.children.map((c) => (c.id === childId ? { ...c, ...patch, id: c.id } : c)),
  };
}

export function removeChild(data: FamilyData, childId: ID): FamilyData {
  return {
    ...data,
    children: data.children.filter((c) => c.id !== childId),
    assignments: data.assignments.filter((a) => a.childId !== childId),
    completions: data.completions.filter((c) => c.childId !== childId),
    transactions: data.transactions.filter((t) => t.childId !== childId),
    sessions: data.sessions.filter((s) => s.childId !== childId),
  };
}

/* ------------------------------------------------------------------ missions */

export interface CreateMissionInput {
  title: string;
  icon: string;
  minutes: number;
  repeat: RepeatRule;
  childIds: ID[];
  /** La mission se compte d'elle-même. Voir `Mission.autoApprove`. */
  autoApprove?: boolean;
  createdBy: ID;
}

export function createMission(
  data: FamilyData,
  input: CreateMissionInput,
  now: Date = new Date(),
): { data: FamilyData; mission: Mission } {
  if (!input.title.trim()) throw new DomainError('Le nom de la mission est obligatoire.');
  if (input.minutes <= 0) throw new DomainError('Le temps gagné doit être supérieur à 0.');
  if (input.childIds.length === 0) throw new DomainError('Choisis au moins un enfant.');

  const mission: Mission = {
    id: createId('mission'),
    familyId: data.family.id,
    title: input.title.trim(),
    icon: input.icon,
    minutes: input.minutes,
    repeat: input.repeat,
    autoApprove: input.autoApprove ?? false,
    createdBy: input.createdBy,
    archived: false,
    createdAt: iso(now),
  };

  const assignments: MissionAssignment[] = input.childIds.map((childId) => ({
    id: createId('asg'),
    missionId: mission.id,
    childId,
    active: true,
    createdAt: iso(now),
  }));

  return {
    data: {
      ...data,
      missions: [...data.missions, mission],
      assignments: [...data.assignments, ...assignments],
    },
    mission,
  };
}

/**
 * Modifier une mission déjà créée — tout ce qui la définit, sans réécrire le
 * passé.
 *
 * **Le temps gagné se change, et il le faut.** Il était exclu d'ici au motif
 * qu'un barème modifié ne doit pas changer ce qu'un enfant a déjà obtenu. Le
 * motif était bon, la conclusion ne l'était pas : chaque complétion garde sa
 * propre copie (`minutesRequested`, puis `minutesAwarded`), donc le passé est
 * déjà protégé — y compris une complétion qui attend encore d'être confirmée,
 * qui sera payée au tarif affiché à l'enfant quand il a appuyé, et non au
 * nouveau. Interdire la modification ne protégeait donc rien ; elle obligeait
 * seulement à supprimer la mission et à la recréer, ce qui, cela, efface
 * vraiment l'historique.
 *
 * Ce trou se voyait d'un coup après une routine : elle crée huit missions à
 * quinze minutes, et le parent n'avait aucun moyen d'en passer une à cinq.
 *
 * **Les enfants concernés ne sont jamais retirés, seulement désactivés.** Une
 * complétion pointe sur son affectation (`assignmentId`) : supprimer la ligne
 * ferait disparaître de l'historique une mission réellement accomplie. Un
 * enfant qu'on retire puis qu'on remet retrouve donc son affectation d'origine.
 */
export function updateMission(
  data: FamilyData,
  missionId: ID,
  patch: {
    title?: string;
    icon?: string;
    minutes?: number;
    repeat?: RepeatRule;
    autoApprove?: boolean;
    childIds?: ID[];
  },
  now: Date = new Date(),
): FamilyData {
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new DomainError('Le nom de la mission est obligatoire.');
  }
  if (patch.minutes !== undefined && patch.minutes <= 0) {
    throw new DomainError('Le temps gagné doit être supérieur à 0.');
  }
  if (patch.childIds !== undefined && patch.childIds.length === 0) {
    throw new DomainError('Choisis au moins un enfant.');
  }

  const { childIds, ...fields } = patch;

  const missions = data.missions.map((m) =>
    m.id === missionId
      ? { ...m, ...fields, ...(fields.title ? { title: fields.title.trim() } : {}), id: m.id }
      : m,
  );

  if (!childIds) return { ...data, missions };

  const assignments = data.assignments.map((a) =>
    a.missionId === missionId ? { ...a, active: childIds.includes(a.childId) } : a,
  );

  const nouveaux: MissionAssignment[] = childIds
    .filter((childId) => !data.assignments.some((a) => a.missionId === missionId && a.childId === childId))
    .map((childId) => ({
      id: createId('asg'),
      missionId,
      childId,
      active: true,
      createdAt: iso(now),
    }));

  return { ...data, missions, assignments: [...assignments, ...nouveaux] };
}

export function archiveMission(data: FamilyData, missionId: ID): FamilyData {
  return {
    ...data,
    missions: data.missions.map((m) => (m.id === missionId ? { ...m, archived: true } : m)),
    assignments: data.assignments.map((a) =>
      a.missionId === missionId ? { ...a, active: false } : a,
    ),
  };
}

/* --------------------------------------------------------------- completions */

/**
 * L'enfant appuie sur « J'AI TERMINÉ ».
 *
 * Deux issues selon ce que le parent a décidé pour cette mission-là : la
 * demande part en attente, ou bien elle se compte immédiatement et les minutes
 * arrivent. Dans les deux cas la même règle tient — aucune minute n'est
 * créditée sans une ligne au registre écrite dans la même opération.
 */
export function completeMission(
  data: FamilyData,
  params: {
    childId: ID;
    missionId: ID;
    /**
     * À faux, une mission qui se compte d'elle-même redevient une mission
     * ordinaire, en attente de confirmation.
     *
     * C'est ce que fait l'abonnement expiré (`domain/access`) : l'enfant ne
     * rencontre pas de mur, il voit « ton parent confirme », une phrase qu'il
     * connaît déjà. Les minutes l'attendent chez son parent.
     */
    autoApproveAllowed?: boolean;
  },
  now: Date = new Date(),
): { data: FamilyData; completion: MissionCompletion; transaction?: ScreenTimeTransaction } {
  const mission = data.missions.find((m) => m.id === params.missionId);
  if (!mission) throw new DomainError('Mission introuvable.');

  const assignment = data.assignments.find(
    (a) => a.missionId === params.missionId && a.childId === params.childId && a.active,
  );
  if (!assignment) throw new DomainError("Cette mission n'est pas assignée à cet enfant.");

  /**
   * Une mission déjà faite ne se refait pas aujourd'hui.
   *
   * Le garde-fou existait pour l'attente d'une confirmation. Il ne suffit plus :
   * une mission qui se compte d'elle-même n'attend rien, et sans cette
   * vérification un enfant appuierait dix fois pour dix fois les minutes. On
   * s'appuie sur `missionsForChild`, qui sait déjà quand une mission se
   * réinitialise — une seconde règle de planification finirait par diverger de
   * la première.
   */
  const state = missionsForChild(data, params.childId, now).find(
    (m) => m.mission.id === mission.id,
  )?.state;
  if (state === 'pending') throw new DomainError('Cette mission attend déjà une confirmation.');
  if (state === 'done') throw new DomainError('Cette mission est déjà faite aujourd’hui.');

  // Sans confirmation, la mission est approuvée à l'instant où l'enfant la
  // déclare — et la transaction est écrite dans la même opération, comme pour
  // une validation par un parent. Il n'existe aucun chemin qui crédite des
  // minutes sans laisser de ligne au registre.
  const auto = mission.autoApprove === true && params.autoApproveAllowed !== false;

  const completion: MissionCompletion = {
    id: createId('cmp'),
    familyId: data.family.id,
    assignmentId: assignment.id,
    missionId: mission.id,
    childId: params.childId,
    status: auto ? 'approved' : 'pending',
    minutesRequested: mission.minutes,
    minutesAwarded: auto ? mission.minutes : 0,
    completedAt: iso(now),
    // `reviewedBy` reste vide : personne n'a relu, et l'historique ne doit pas
    // laisser croire qu'un parent l'a fait.
    ...(auto ? { reviewedAt: iso(now) } : {}),
  };

  if (!auto) {
    return { data: { ...data, completions: [...data.completions, completion] }, completion };
  }

  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: params.childId,
    delta: mission.minutes,
    kind: 'mission_reward',
    reason: mission.title,
    refId: completion.id,
    createdAt: iso(now),
  };

  return {
    data: {
      ...data,
      completions: [...data.completions, completion],
      transactions: [...data.transactions, transaction],
    },
    completion,
    transaction,
  };
}

/**
 * Parent taps "C’est fait +15 min" → the completion is approved AND a ledger entry
 * is written in the same operation. There is no path that credits minutes
 * without a transaction.
 */
export function approveCompletion(
  data: FamilyData,
  params: { completionId: ID; parentId: ID; minutes?: number },
  now: Date = new Date(),
): { data: FamilyData; completion: MissionCompletion; transaction: ScreenTimeTransaction } {
  const completion = data.completions.find((c) => c.id === params.completionId);
  if (!completion) throw new DomainError('Demande introuvable.');
  if (completion.status !== 'pending') throw new DomainError('Cette demande est déjà traitée.');

  const mission = data.missions.find((m) => m.id === completion.missionId);
  const minutes = params.minutes ?? completion.minutesRequested;

  const approved: MissionCompletion = {
    ...completion,
    status: 'approved',
    minutesAwarded: minutes,
    reviewedAt: iso(now),
    reviewedBy: params.parentId,
  };

  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: completion.childId,
    delta: minutes,
    kind: 'mission_reward',
    reason: mission?.title ?? 'Mission accomplie',
    refId: completion.id,
    createdAt: iso(now),
  };

  return {
    data: {
      ...data,
      completions: data.completions.map((c) => (c.id === approved.id ? approved : c)),
      transactions: [...data.transactions, transaction],
    },
    completion: approved,
    transaction,
  };
}

export function rejectCompletion(
  data: FamilyData,
  params: { completionId: ID; parentId: ID },
  now: Date = new Date(),
): { data: FamilyData; completion: MissionCompletion } {
  const completion = data.completions.find((c) => c.id === params.completionId);
  if (!completion) throw new DomainError('Demande introuvable.');
  if (completion.status !== 'pending') throw new DomainError('Cette demande est déjà traitée.');

  const rejected: MissionCompletion = {
    ...completion,
    status: 'rejected',
    minutesAwarded: 0,
    reviewedAt: iso(now),
    reviewedBy: params.parentId,
  };

  return {
    data: {
      ...data,
      completions: data.completions.map((c) => (c.id === rejected.id ? rejected : c)),
    },
    completion: rejected,
  };
}

/**
 * L'enfant a vu les confettis — on ne les montre pas deux fois.
 *
 * Plusieurs identifiants à la fois, et c'est le cœur du correctif : un parent
 * qui confirme huit missions d'affilée produisait huit célébrations en file, la
 * suivante s'ouvrant sur la précédente. Elles se marquent maintenant ensemble,
 * en une seule écriture, parce qu'elles sont vues ensemble.
 */
export function markCelebrated(
  data: FamilyData,
  completionIds: ID | ID[],
  now: Date = new Date(),
): FamilyData {
  const ids = new Set(Array.isArray(completionIds) ? completionIds : [completionIds]);
  return {
    ...data,
    completions: data.completions.map((c) =>
      ids.has(c.id) ? { ...c, celebratedAt: iso(now) } : c,
    ),
  };
}

/* ------------------------------------------------------------------ sessions */

/** Declares one of the family's other screens. */
export function addDevice(
  data: FamilyData,
  input: { label: string; kind: DeviceKind },
  now: Date = new Date(),
): { data: FamilyData; device: Device } {
  const label = input.label.trim();
  if (!label) throw new DomainError('Donne un nom à cet appareil.');

  const device: Device = {
    id: createId('dev'),
    familyId: data.family.id,
    label,
    kind: input.kind,
    createdAt: iso(now),
  };
  return { data: { ...data, devices: [...(data.devices ?? []), device] }, device };
}

/**
 * Archived rather than deleted: past sessions refer to it, and an old session
 * that suddenly says "un autre écran" reads as data loss.
 */
export function removeDevice(data: FamilyData, deviceId: ID): FamilyData {
  return {
    ...data,
    devices: (data.devices ?? []).map((d) => (d.id === deviceId ? { ...d, archived: true } : d)),
  };
}

/* ------------------------------------------------------- plages libres */

/**
 * Ouvrir une fenêtre pendant laquelle l'écran ne coûte rien.
 *
 * Aucune transaction n'est écrite, ni ici ni au moment où la plage s'ouvre.
 * C'est LA règle de la fonctionnalité : le solde d'un enfant est exactement le
 * même avant et après le mercredi après-midi. Voir `domain/freeWindows`.
 */
export function createFreeWindow(
  data: FamilyData,
  input: FreeWindowInput,
  now: Date = new Date(),
): { data: FamilyData; window: FreeWindow } {
  const probleme = valideFenetre(input);
  if (probleme) throw new DomainError(probleme);

  const window: FreeWindow = {
    id: createId('fw'),
    familyId: data.family.id,
    label: input.label.trim(),
    childIds: input.childIds,
    days: input.days,
    ...(input.date ? { date: input.date } : {}),
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    enabled: true,
    createdAt: iso(now),
  };
  return { data: { ...data, freeWindows: [...(data.freeWindows ?? []), window] }, window };
}

/**
 * Suspendre une plage sans la perdre.
 *
 * Les vacances reviennent : effacer « Vacances de février » pour le rouvrir en
 * avril oblige à tout ressaisir, et un réglage pénible à reposer finit par ne
 * plus être posé du tout.
 */
export function toggleFreeWindow(data: FamilyData, windowId: ID): FamilyData {
  return {
    ...data,
    freeWindows: (data.freeWindows ?? []).map((f) =>
      f.id === windowId ? { ...f, enabled: !f.enabled } : f,
    ),
  };
}

/**
 * Supprimer pour de bon — contrairement à un appareil, qu'on archive.
 *
 * Une plage passée ne raconte rien : aucune session, aucune transaction, aucun
 * historique ne la désigne. La garder archivée n'encombrerait que la liste que
 * le parent essaie de relire.
 */
export function removeFreeWindow(data: FamilyData, windowId: ID): FamilyData {
  return {
    ...data,
    freeWindows: (data.freeWindows ?? []).filter((f) => f.id !== windowId),
  };
}

export function startSession(
  data: FamilyData,
  params: { childId: ID; minutes: number; deviceId?: ID },
  now: Date = new Date(),
): { data: FamilyData; session: ScreenTimeSession } {
  /**
   * Pendant une plage libre, on ne dépense rien.
   *
   * L'écran est déjà ouvert : lancer une session ferait payer des minutes pour
   * obtenir ce qu'on a déjà. Rien ne le signalerait — l'enfant appuie, le
   * compteur descend, et personne ne comprend pourquoi le solde a fondu un
   * mercredi.
   *
   * Le contrôle vient AVANT celui du solde : « tu n'as pas assez de temps »
   * serait une réponse fausse et décourageante à un enfant dont l'écran est
   * ouvert de toute façon.
   */
  const ouverte = openWindowAt(data.freeWindows ?? [], params.childId, now);
  if (ouverte && params.deviceId === undefined) {
    throw new DomainError(
      `C'est ouvert jusqu'à ${heure(ouverte.endMinute)} — tu n'as pas besoin de tes minos.`,
    );
  }

  const available = balanceOf(data.transactions, params.childId);
  if (params.minutes <= 0) throw new DomainError('Choisis une durée.');
  if (params.minutes > available) throw new DomainError("Tu n'as pas assez de temps.");

  const busy = data.sessions.find(
    (s) => s.childId === params.childId && (s.status === 'running' || s.status === 'requested'),
  );
  if (busy) {
    throw new DomainError(
      busy.status === 'running' ? 'Une session est déjà en cours.' : 'Une demande est déjà en attente.',
    );
  }

  // Two reasons a session waits for a parent: the screen is one Mino cannot
  // drive, or the family has asked for every session to be approved. Nothing is
  // billed in the meantime — a request that is never answered must not cost the
  // child anything.
  const child = data.children.find((c) => c.id === params.childId);
  const waits = params.deviceId !== undefined || child?.requireApproval === true;

  const session: ScreenTimeSession = {
    id: createId('ses'),
    familyId: data.family.id,
    childId: params.childId,
    requestedMinutes: params.minutes,
    ...(params.deviceId ? { deviceId: params.deviceId } : {}),
    startedAt: iso(now),
    endsAt: new Date(now.getTime() + params.minutes * 60_000).toISOString(),
    status: waits ? 'requested' : 'running',
    ...(waits ? { requestedAt: iso(now) } : {}),
  };

  return { data: { ...data, sessions: [...data.sessions, session] }, session };
}

/**
 * A parent starts the requested session. The clock starts now, not when the
 * child asked — otherwise a request answered twenty minutes later would eat
 * twenty minutes the child never got to use.
 */
export function approveSession(
  data: FamilyData,
  params: { sessionId: ID },
  now: Date = new Date(),
): { data: FamilyData; session: ScreenTimeSession } {
  const session = data.sessions.find((s) => s.id === params.sessionId);
  if (!session) throw new DomainError('Demande introuvable.');
  if (session.status !== 'requested') return { data, session };

  const available = balanceOf(data.transactions, session.childId);
  const minutes = Math.min(session.requestedMinutes, available);
  if (minutes <= 0) throw new DomainError('Le compteur est vide.');

  const started: ScreenTimeSession = {
    ...session,
    requestedMinutes: minutes,
    startedAt: iso(now),
    endsAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
    status: 'running',
  };

  return {
    data: { ...data, sessions: data.sessions.map((s) => (s.id === started.id ? started : s)) },
    session: started,
  };
}

/** A parent declines. Nothing is billed — the request simply disappears. */
export function refuseSession(
  data: FamilyData,
  params: { sessionId: ID },
  now: Date = new Date(),
): { data: FamilyData; session: ScreenTimeSession } {
  const session = data.sessions.find((s) => s.id === params.sessionId);
  if (!session) throw new DomainError('Demande introuvable.');
  if (session.status !== 'requested') return { data, session };

  const refused: ScreenTimeSession = { ...session, status: 'refused', endedAt: iso(now) };
  return {
    data: { ...data, sessions: data.sessions.map((s) => (s.id === refused.id ? refused : s)) },
    session: refused,
  };
}

/**
 * Ends a session and bills the minutes actually consumed. Stopping early only
 * costs the elapsed time, which keeps the deal fair from a child's point of view.
 */
export function endSession(
  data: FamilyData,
  params: { sessionId: ID; status?: 'finished' | 'stopped' },
  now: Date = new Date(),
): { data: FamilyData; session: ScreenTimeSession; transaction?: ScreenTimeTransaction } {
  const session = data.sessions.find((s) => s.id === params.sessionId);
  if (!session) throw new DomainError('Session introuvable.');
  if (session.status !== 'running') return { data, session };

  const elapsedMs = Math.max(0, now.getTime() - new Date(session.startedAt).getTime());
  const elapsedMinutes = Math.min(session.requestedMinutes, Math.round(elapsedMs / 60_000));

  const ended: ScreenTimeSession = {
    ...session,
    status: params.status ?? 'finished',
    endedAt: iso(now),
    consumedMinutes: elapsedMinutes,
  };

  const sessions = data.sessions.map((s) => (s.id === ended.id ? ended : s));
  if (elapsedMinutes <= 0) {
    return { data: { ...data, sessions }, session: ended };
  }

  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: session.childId,
    delta: -elapsedMinutes,
    kind: 'screen_time_used',
    reason: 'Temps d’écran utilisé',
    refId: session.id,
    createdAt: iso(now),
  };

  return {
    data: { ...data, sessions, transactions: [...data.transactions, transaction] },
    session: ended,
    transaction,
  };
}

/** Manual correction by a parent (bonus or penalty) — still a ledger entry. */
export function adjustBalance(
  data: FamilyData,
  params: { childId: ID; delta: number; reason: string; kind?: TransactionKind },
  now: Date = new Date(),
): FamilyData {
  if (params.delta === 0) return data;
  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: params.childId,
    delta: params.delta,
    kind: params.kind ?? 'parent_adjustment',
    reason: params.reason,
    createdAt: iso(now),
  };
  return { ...data, transactions: [...data.transactions, transaction] };
}

/**
 * A gift, outside of any mission. Always positive: a bonus that could take time
 * away would be a punishment wearing a nicer name, and Mino never takes back.
 */
export function grantBonus(
  data: FamilyData,
  params: { childId: ID; minutes: number; reason: string },
  now: Date = new Date(),
): FamilyData {
  if (params.minutes <= 0) throw new DomainError('Un bonus est toujours positif.');
  return adjustBalance(
    data,
    { childId: params.childId, delta: params.minutes, reason: params.reason, kind: 'bonus' },
    now,
  );
}
