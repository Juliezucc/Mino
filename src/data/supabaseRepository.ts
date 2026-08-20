import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
  Child,
  FamilyData,
  Family,
  Mission,
  MissionAssignment,
  MissionCompletion,
  Parent,
  ScreenTimeSession,
  ScreenTimeTransaction,
} from '@/domain/types';

import { Device } from '@/domain/devices';

import { ChangeEvent, MinoRepository } from './repository';

/**
 * Supabase-backed repository.
 *
 * It is enabled only when both public env vars are present, so the app always
 * runs (demo + local mode) without a backend. Row-level security in
 * `supabase/schema.sql` is what actually isolates one family from another —
 * this client never filters by family id for security, only for efficiency.
 */

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(URL && ANON_KEY);

const TABLES = {
  families: 'families',
  parents: 'parents',
  children: 'children',
  missions: 'missions',
  assignments: 'mission_assignments',
  completions: 'mission_completions',
  transactions: 'screen_time_transactions',
  sessions: 'screen_time_sessions',
  devices: 'devices',
} as const;

/* ----------------------------------------------------------------- mapping */

const rowToFamily = (r: any): Family => ({
  id: r.id,
  name: r.name,
  code: r.code,
  referralCode: r.referral_code,
  createdAt: r.created_at,
});
const familyToRow = (f: Family) => ({
  id: f.id,
  name: f.name,
  code: f.code,
  referral_code: f.referralCode,
  created_at: f.createdAt,
});

const rowToParent = (r: any): Parent => ({
  id: r.id,
  familyId: r.family_id,
  displayName: r.display_name,
  email: r.email,
  createdAt: r.created_at,
});
const parentToRow = (p: Parent) => ({
  id: p.id,
  family_id: p.familyId,
  display_name: p.displayName,
  email: p.email,
  created_at: p.createdAt,
});

const rowToChild = (r: any): Child => ({
  id: r.id,
  familyId: r.family_id,
  firstName: r.first_name,
  age: r.age,
  avatarKey: r.avatar_key,
  requireApproval: r.require_approval ?? undefined,
  pin: r.pin ?? undefined,
  createdAt: r.created_at,
});
const childToRow = (c: Child) => ({
  id: c.id,
  family_id: c.familyId,
  first_name: c.firstName,
  age: c.age,
  avatar_key: c.avatarKey,
  require_approval: c.requireApproval ?? false,
  pin: c.pin ?? null,
  created_at: c.createdAt,
});

const rowToMission = (r: any): Mission => ({
  id: r.id,
  familyId: r.family_id,
  title: r.title,
  icon: r.icon,
  minutes: r.minutes,
  repeat: r.repeat,
  createdBy: r.created_by,
  archived: r.archived,
  createdAt: r.created_at,
});
const missionToRow = (m: Mission) => ({
  id: m.id,
  family_id: m.familyId,
  title: m.title,
  icon: m.icon,
  minutes: m.minutes,
  repeat: m.repeat,
  created_by: m.createdBy,
  archived: m.archived,
  created_at: m.createdAt,
});

const rowToAssignment = (r: any): MissionAssignment => ({
  id: r.id,
  missionId: r.mission_id,
  childId: r.child_id,
  active: r.active,
  createdAt: r.created_at,
});
const assignmentToRow = (a: MissionAssignment) => ({
  id: a.id,
  mission_id: a.missionId,
  child_id: a.childId,
  active: a.active,
  created_at: a.createdAt,
});

const rowToCompletion = (r: any): MissionCompletion => ({
  id: r.id,
  familyId: r.family_id,
  assignmentId: r.assignment_id,
  missionId: r.mission_id,
  childId: r.child_id,
  status: r.status,
  minutesRequested: r.minutes_requested,
  minutesAwarded: r.minutes_awarded,
  completedAt: r.completed_at,
  reviewedAt: r.reviewed_at ?? undefined,
  reviewedBy: r.reviewed_by ?? undefined,
  celebratedAt: r.celebrated_at ?? undefined,
});
const completionToRow = (c: MissionCompletion) => ({
  id: c.id,
  family_id: c.familyId,
  assignment_id: c.assignmentId,
  mission_id: c.missionId,
  child_id: c.childId,
  status: c.status,
  minutes_requested: c.minutesRequested,
  minutes_awarded: c.minutesAwarded,
  completed_at: c.completedAt,
  reviewed_at: c.reviewedAt ?? null,
  reviewed_by: c.reviewedBy ?? null,
  celebrated_at: c.celebratedAt ?? null,
});

const rowToTransaction = (r: any): ScreenTimeTransaction => ({
  id: r.id,
  familyId: r.family_id,
  childId: r.child_id,
  delta: r.delta,
  kind: r.kind,
  reason: r.reason,
  refId: r.ref_id ?? undefined,
  createdAt: r.created_at,
});
const transactionToRow = (t: ScreenTimeTransaction) => ({
  id: t.id,
  family_id: t.familyId,
  child_id: t.childId,
  delta: t.delta,
  kind: t.kind,
  reason: t.reason,
  ref_id: t.refId ?? null,
  created_at: t.createdAt,
});

const rowToSession = (r: any): ScreenTimeSession => ({
  id: r.id,
  familyId: r.family_id,
  childId: r.child_id,
  requestedMinutes: r.requested_minutes,
  deviceId: r.device_id ?? undefined,
  startedAt: r.started_at,
  endsAt: r.ends_at,
  status: r.status,
  requestedAt: r.requested_at ?? undefined,
  endedAt: r.ended_at ?? undefined,
  consumedMinutes: r.consumed_minutes ?? undefined,
});
const sessionToRow = (s: ScreenTimeSession) => ({
  id: s.id,
  family_id: s.familyId,
  child_id: s.childId,
  requested_minutes: s.requestedMinutes,
  device_id: s.deviceId ?? null,
  started_at: s.startedAt,
  ends_at: s.endsAt,
  status: s.status,
  requested_at: s.requestedAt ?? null,
  ended_at: s.endedAt ?? null,
  consumed_minutes: s.consumedMinutes ?? null,
});

const rowToDevice = (r: any): Device => ({
  id: r.id,
  familyId: r.family_id,
  label: r.label,
  kind: r.kind,
  createdAt: r.created_at,
  archived: r.archived ?? undefined,
});
const deviceToRow = (d: Device) => ({
  id: d.id,
  family_id: d.familyId,
  label: d.label,
  kind: d.kind,
  created_at: d.createdAt,
  archived: d.archived ?? false,
});

/* -------------------------------------------------------------- repository */

class SupabaseRepository implements MinoRepository {
  readonly name = 'supabase';

  constructor(private readonly client: SupabaseClient) {}

  async load(): Promise<FamilyData | null> {
    // RLS returns only the family the signed-in parent belongs to.
    const { data: families, error } = await this.client.from(TABLES.families).select('*').limit(1);
    if (error) throw error;
    if (!families || families.length === 0) return null;

    const family = rowToFamily(families[0]);
    const fetch = async (table: string) => {
      const res = await this.client.from(table).select('*');
      if (res.error) throw res.error;
      return res.data ?? [];
    };

    const [parents, children, missions, assignments, completions, transactions, sessions, devices] =
      await Promise.all([
        fetch(TABLES.parents),
        fetch(TABLES.children),
        fetch(TABLES.missions),
        fetch(TABLES.assignments),
        fetch(TABLES.completions),
        fetch(TABLES.transactions),
        fetch(TABLES.sessions),
        fetch(TABLES.devices),
      ]);

    return {
      family,
      parents: parents.map(rowToParent),
      children: children.map(rowToChild),
      missions: missions.map(rowToMission),
      assignments: assignments.map(rowToAssignment),
      completions: completions.map(rowToCompletion),
      transactions: transactions.map(rowToTransaction),
      sessions: sessions.map(rowToSession),
      devices: devices.map(rowToDevice),
    };
  }

  async persist(data: FamilyData, change: ChangeEvent): Promise<void> {
    if (change.kind === 'bootstrap') {
      await this.upsertAll(data);
      return;
    }

    if (change.deleteChildId) {
      // Cascades are declared in the schema, so one delete is enough.
      const res = await this.client.from(TABLES.children).delete().eq('id', change.deleteChildId);
      if (res.error) throw res.error;
    }

    const touched = change.upsert;
    if (!touched) return;

    await this.upsertAll({ ...emptyPartial, ...touched } as Partial<FamilyData>);
  }

  private async upsertAll(data: Partial<FamilyData>): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    const push = (table: string, rows: unknown[]) => {
      if (rows.length === 0) return;
      jobs.push(
        (async () => {
          const res = await this.client.from(table).upsert(rows as never);
          if (res.error) throw res.error;
        })(),
      );
    };

    if (data.family) push(TABLES.families, [familyToRow(data.family)]);
    push(TABLES.parents, (data.parents ?? []).map(parentToRow));
    push(TABLES.children, (data.children ?? []).map(childToRow));
    push(TABLES.missions, (data.missions ?? []).map(missionToRow));
    push(TABLES.assignments, (data.assignments ?? []).map(assignmentToRow));
    push(TABLES.completions, (data.completions ?? []).map(completionToRow));
    push(TABLES.transactions, (data.transactions ?? []).map(transactionToRow));
    push(TABLES.sessions, (data.sessions ?? []).map(sessionToRow));
    push(TABLES.devices, (data.devices ?? []).map(deviceToRow));

    await Promise.all(jobs);
  }

  async clear(): Promise<void> {
    await this.client.auth.signOut();
  }

  /**
   * Joining is a server decision, not a client one.
   *
   * Row-level security deliberately hides a family from anyone outside it, so
   * the client cannot look one up to check a code. `join_family` is a
   * SECURITY DEFINER function (see schema.sql): it validates the code, rate
   * limits attempts, attaches the caller, and only then does RLS start
   * returning the family's rows.
   */
  async joinFamily(input: { code: string }): Promise<FamilyData | null> {
    // `auth.uid()` has to exist before the function can attach anything, and a
    // child never signs in: the device gets an anonymous session of its own.
    const { data: session } = await this.client.auth.getSession();
    if (!session.session) {
      const { error: signInError } = await this.client.auth.signInAnonymously();
      if (signInError) return null;
    }

    const { data, error } = await this.client.rpc('join_family', {
      p_code: input.code.trim().toUpperCase(),
    });
    if (error || !data) return null;
    return this.load();
  }

  /**
   * Realtime: a parent validating on their phone must update the child's tablet
   * without a refresh. Any change in the family reloads the document.
   */
  subscribe(onRemoteChange: (data: FamilyData) => void): () => void {
    const channel = this.client
      .channel('mino-family')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        this.load()
          .then((data) => {
            if (data) onRemoteChange(data);
          })
          .catch(() => undefined);
      })
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }
}

const emptyPartial: Partial<FamilyData> = {
  parents: [],
  children: [],
  missions: [],
  assignments: [],
  completions: [],
  transactions: [],
  sessions: [],
};

let cached: SupabaseRepository | null = null;
let client: SupabaseClient | null = null;

/**
 * The one Supabase client. Shared with the billing service, which needs the
 * parent's access token to authenticate against the Edge Functions.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(URL!, ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

/** The parent's access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Returns null when Supabase is not configured — the app then runs locally. */
export function createSupabaseRepository(): MinoRepository | null {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  if (!cached) cached = new SupabaseRepository(supabase);
  return cached;
}
