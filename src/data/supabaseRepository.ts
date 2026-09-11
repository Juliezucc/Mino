import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
  Child,
  FamilyData,
  Family,
  ID,
  ISODate,
  Mission,
  MissionAssignment,
  MissionCompletion,
  Parent,
  ScreenTimeSession,
  ScreenTimeTransaction,
} from '@/domain/types';
import { FreeWindow } from '@/domain/freeWindows';
import { ScreenTimeAuthorization } from '@/services/screenTime';

import { withOpeningBalances } from '@/domain/ledger';

import { DomainError } from '@/domain/actions';
import { Device } from '@/domain/devices';

import { raisonDeLaFonction } from './erreurFonction';
import { ChangeEvent, MinoRepository, PairedDevice } from './repository';

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
  freeWindows: 'free_windows',
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
  consentAt: r.consent_at ?? undefined,
  createdAt: r.created_at,
});
const parentToRow = (p: Parent) => ({
  id: p.id,
  family_id: p.familyId,
  display_name: p.displayName,
  email: p.email,
  consent_at: p.consentAt ?? null,
  created_at: p.createdAt,
});

const rowToChild = (r: any): Child => ({
  id: r.id,
  familyId: r.family_id,
  firstName: r.first_name,
  age: r.age,
  avatarKey: r.avatar_key,
  requireApproval: r.require_approval ?? undefined,
  companionEnabled: r.companion_enabled ?? undefined,
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
  companion_enabled: c.companionEnabled ?? true,
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
  autoApprove: r.auto_approve ?? false,
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
  auto_approve: m.autoApprove ?? false,
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

/**
 * `child_ids` est un tableau nullable, et `null` n'y est pas un oubli : c'est
 * « toute la fratrie ». Le confondre avec un tableau vide ouvrirait la plage à
 * personne, ce qui est exactement l'inverse de ce que le parent a demandé.
 */
const rowToFreeWindow = (r: any): FreeWindow => ({
  id: r.id,
  familyId: r.family_id,
  label: r.label,
  childIds: r.child_ids ?? null,
  days: r.days ?? [],
  date: r.on_date ?? undefined,
  startMinute: r.start_minute,
  endMinute: r.end_minute,
  enabled: r.enabled,
  createdAt: r.created_at,
});
const freeWindowToRow = (f: FreeWindow) => ({
  id: f.id,
  family_id: f.familyId,
  label: f.label,
  child_ids: f.childIds,
  days: f.days,
  on_date: f.date ?? null,
  start_minute: f.startMinute,
  end_minute: f.endMinute,
  enabled: f.enabled,
  created_at: f.createdAt,
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

/**
 * How much history a device carries.
 *
 * A family that has used Mino for three years has produced tens of thousands
 * of ledger lines. Downloading all of them at every launch is the kind of cost
 * nobody notices in the first year and nobody can undo in the third.
 *
 * What is *not* bounded: anything still waiting on someone. A mission completed
 * four months ago and never reviewed has to arrive, or it disappears from the
 * parent's screen without ever having been answered.
 *
 * Le même nombre que `mino_history_days()` dans `supabase/retention.sql` : la
 * base ne garde plus le détail au-delà, il n'y aurait donc rien à demander de
 * plus. Les deux se changent ensemble.
 */
const HISTORY_DAYS = 90;
const HISTORY_MAX = 400;

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Merges two row sets on `id`, keeping the first occurrence. */
function mergeById<T extends { id: string }>(...groups: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const group of groups) for (const row of group) if (!seen.has(row.id)) seen.set(row.id, row);
  return [...seen.values()];
}

/** Exportée pour `__tests__/ecriture-famille.test.ts`, qui la construit sur un
 *  client factice — la fabrique publique, elle, exige une vraie configuration. */
export class SupabaseRepository implements MinoRepository {
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

    const window = since(HISTORY_DAYS);

    const [parents, children, missions, assignments, devices, freeWindows] = await Promise.all([
      fetch(TABLES.parents),
      fetch(TABLES.children),
      fetch(TABLES.missions),
      fetch(TABLES.assignments),
      fetch(TABLES.devices),
      fetch(TABLES.freeWindows),
    ]);

    const [recentCompletions, pendingCompletions, recentTransactions, recentSessions, liveSessions, balances] =
      await Promise.all([
        this.rows(TABLES.completions, (q) =>
          q.gte('completed_at', window).order('completed_at', { ascending: false }).limit(HISTORY_MAX),
        ),
        // Never truncated: a request nobody answered is the one thing that must
        // not fall off the end of the list.
        this.rows(TABLES.completions, (q) => q.eq('status', 'pending')),
        this.rows(TABLES.transactions, (q) =>
          q.gte('created_at', window).order('created_at', { ascending: false }).limit(HISTORY_MAX),
        ),
        this.rows(TABLES.sessions, (q) =>
          q.gte('started_at', window).order('started_at', { ascending: false }).limit(HISTORY_MAX),
        ),
        this.rows(TABLES.sessions, (q) => q.in('status', ['running', 'requested'])),
        this.balances(),
      ]);

    const transactions = recentTransactions.map(rowToTransaction);

    return {
      family,
      parents: parents.map(rowToParent),
      children: children.map(rowToChild),
      missions: missions.map(rowToMission),
      assignments: assignments.map(rowToAssignment),
      completions: mergeById(recentCompletions, pendingCompletions).map(rowToCompletion),
      transactions: withOpeningBalances(transactions, balances, family.id, window),
      sessions: mergeById(recentSessions, liveSessions).map(rowToSession),
      devices: devices.map(rowToDevice),
      freeWindows: freeWindows.map(rowToFreeWindow),
    };
  }

  /** One filtered read, with the error handling every call site would repeat. */
  private async rows(table: string, shape: (q: any) => any): Promise<any[]> {
    const res = await shape(this.client.from(table).select('*'));
    if (res.error) throw res.error;
    return res.data ?? [];
  }

  /**
   * The true balance of every child, summed over the whole ledger by the server.
   *
   * Cette fonction NE DOIT PAS avaler son erreur, et c'est tout sauf un détail
   * de style. L'appareil ne télécharge que 90 jours ; tout ce qui précède est
   * reconstitué à partir de ce seul appel, en une ligne d'ouverture. Un
   * dictionnaire vide ne veut pas dire « tout le monde à zéro » — il veut dire
   * « je ne sais pas ». Rendu tel quel, `withOpeningBalances` n'écrit aucune
   * ligne d'ouverture et l'enfant se retrouve avec le solde de ses trois
   * derniers mois : ses minutes anciennes ont disparu de son compteur, sans un
   * message, sans une trace.
   *
   * Mieux vaut donc que l'ouverture échoue franchement — l'écran hors ligne
   * dira la vérité — que de montrer un compteur faux. C'est la seule promesse
   * que ce produit ne peut pas se permettre de casser.
   */
  private async balances(): Promise<Record<string, number>> {
    const { data, error } = await this.client.rpc('family_balances');
    if (error) throw error;
    if (!Array.isArray(data)) {
      throw new Error('family_balances n’a rien renvoyé : solde inconnu, rien ne sera affiché.');
    }
    const out: Record<string, number> = {};
    for (const row of data) out[row.child_id] = row.minutes;
    return out;
  }

  async persist(data: FamilyData, change: ChangeEvent): Promise<void> {
    if (change.kind === 'bootstrap') {
      await this.upsertAll(data, 'creation');
      return;
    }

    /**
     * Marquer la fête comme vue passe par une fonction, pas par une écriture.
     *
     * `mission_completions_update` n'autorise qu'un parent, et c'est juste : un
     * enfant ne doit jamais pouvoir toucher au statut d'une complétion ni au
     * montant crédité. Mais l'écran de fête tourne sur l'appareil de l'enfant,
     * et `celebrated_at` n'est qu'un drapeau d'affichage.
     *
     * L'écriture ordinaire était donc refusée, le magasin annulait toute
     * l'opération, et l'enfant lisait « +5 minos » et « Rien n'a été
     * enregistré » sur le même écran. Les minutes étaient pourtant bien là :
     * seule la fête ne se marquait pas.
     */
    /**
     * Un parent qui confirme depuis la tablette de son enfant.
     *
     * **Ce chemin existe parce que la base refuse l'autre.** Sur une session
     * d'appareil, `mission_completions_update` et
     * `screen_time_transactions_insert` exigent `auth_is_parent()` : l'écriture
     * ordinaire est rejetée, et le magasin annulait tout en affichant une
     * panne de réseau pour un refus de droits.
     *
     * La fonction `valider-mission` fait le travail avec la clé de service,
     * après avoir vérifié le code à quatre chiffres — et elle écrit la
     * complétion AVANT sa ligne de registre, l'ordre inverse de celui d'ici,
     * ce qui rend chaque moitié rattrapable.
     *
     * `codeParent` n'est posé que dans ce cas : sur le téléphone d'un parent,
     * il est absent et rien ne change.
     */
    if (
      change.codeParent &&
      (change.kind === 'completion.approved' || change.kind === 'completion.rejected')
    ) {
      const id = change.upsert?.completions?.[0]?.id;
      if (!id) return;
      const { error } = await this.client.functions.invoke('valider-mission', {
        body: {
          completionId: id,
          decision: change.kind === 'completion.approved' ? 'valider' : 'refaire',
          code: change.codeParent,
        },
      });
      /**
       * Une `DomainError`, et pas une `Error` — sans quoi le message se perd.
       *
       * **Le défaut, retrouvé sur l'appareil du second parent.** Je relayais
       * bien la phrase française du serveur, mais dans une `Error` ordinaire.
       * Or `commit()` n'honore que les `DomainError` : tout le reste retombe
       * dans « Impossible de joindre Mino. Rien n'a été enregistré ». Le
       * parent lisait donc une panne de réseau à la place de la vraie cause —
       * c'est-à-dire exactement le défaut qu'on venait de corriger un étage
       * plus bas, refabriqué un étage plus haut.
       */
      if (error) {
        throw new DomainError(
          await raisonDeLaFonction(error, 'La mission n’a pas pu être confirmée.'),
        );
      }
      return;
    }

    if (change.kind === 'completion.celebrated') {
      const id = change.upsert?.completions?.[0]?.id;
      if (!id) return;
      const res = await this.client.rpc('mark_celebrated', { p_completion_id: id });
      if (res.error) throw res.error;
      return;
    }

    if (change.deleteChildId) {
      // Cascades are declared in the schema, so one delete is enough.
      const res = await this.client.from(TABLES.children).delete().eq('id', change.deleteChildId);
      if (res.error) throw res.error;
    }

    if (change.deleteFreeWindowId) {
      const res = await this.client
        .from(TABLES.freeWindows)
        .delete()
        .eq('id', change.deleteFreeWindowId);
      if (res.error) throw res.error;
    }

    const touched = change.upsert;
    if (!touched) return;

    await this.upsertAll({ ...emptyPartial, ...touched } as Partial<FamilyData>);
  }

  /**
   * Écrire dans l'ordre des dépendances — et, la première fois, sans `upsert`.
   *
   * Deux règles se sont révélées ici, chacune par une panne.
   *
   * L'ORDRE. Cette méthode envoyait les dix tables en parallèle. `parents`,
   * `children` et `missions` référencent pourtant `families`, et
   * `completions` référence `assignments` : quand la ligne fille arrivait
   * avant sa mère, la base la refusait pour clé étrangère absente. C'était une
   * course, tranchée par le réseau — invisible sur une connexion rapide,
   * c'est-à-dire chez qui l'écrit.
   *
   * LA MANIÈRE, et c'est la plus retorse. `upsert` produit un
   * `INSERT ... ON CONFLICT DO UPDATE`, et PostgreSQL applique alors à la
   * ligne neuve la clause de la politique de MISE À JOUR — laquelle exige,
   * partout, d'appartenir déjà à la famille. Une famille qu'on vient
   * d'inventer n'appartient à personne : la base répondait
   * « new row violates row-level security policy », et la création d'une
   * famille sur Supabase n'a jamais pu aboutir une seule fois. Un `insert`
   * simple, lui, ne consulte que la politique d'insertion — celle qui a été
   * écrite pour ce cas, et qui l'autorise.
   *
   * D'où la séparation : `creation` insère, `mise a jour` fusionne. Et d'où
   * `parents` seul dans sa vague — c'est cette ligne-là qui fait entrer le
   * compte dans la famille, donc rien de ce qui exige d'y appartenir ne peut
   * partir avant qu'elle soit écrite.
   */
  private async upsertAll(
    data: Partial<FamilyData>,
    mode: 'creation' | 'mise a jour' = 'mise a jour',
  ): Promise<void> {
    const envoie = async (table: string, rows: unknown[]) => {
      if (rows.length === 0) return;
      const cible = this.client.from(table);
      const res =
        mode === 'creation' ? await cible.insert(rows as never) : await cible.upsert(rows as never);
      if (res.error) throw res.error;
    };

    const vagues: [string, unknown[]][][] = [
      // La famille d'abord : tout le reste s'y rattache.
      [[TABLES.families, data.family ? [familyToRow(data.family)] : []]],
      // Puis le parent, SEUL : c'est lui qui rattache le compte à la famille,
      // et donc lui qui rend possible tout ce qui suit.
      [[TABLES.parents, (data.parents ?? []).map(parentToRow)]],
      // Ce qui ne dépend que de la famille.
      [
        [TABLES.children, (data.children ?? []).map(childToRow)],
        [TABLES.missions, (data.missions ?? []).map(missionToRow)],
        [TABLES.devices, (data.devices ?? []).map(deviceToRow)],
        [TABLES.freeWindows, (data.freeWindows ?? []).map(freeWindowToRow)],
      ],
      // Ce qui dépend d'un enfant, d'une mission ou d'un appareil.
      [
        [TABLES.assignments, (data.assignments ?? []).map(assignmentToRow)],
        [TABLES.transactions, (data.transactions ?? []).map(transactionToRow)],
        [TABLES.sessions, (data.sessions ?? []).map(sessionToRow)],
      ],
      // Et ce qui dépend d'une attribution.
      [[TABLES.completions, (data.completions ?? []).map(completionToRow)]],
    ];

    for (const vague of vagues) {
      await Promise.all(vague.map(([table, rows]) => envoie(table, rows)));
    }
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
      /**
       * Échouer ici n'a rien à voir avec le code saisi, et le dire est tout
       * l'enjeu.
       *
       * `join_family()` refuse quand `auth.uid()` est nul : un appareil
       * d'enfant doit donc ouvrir une session anonyme avant de rejoindre. Or
       * Supabase désactive les connexions anonymes par défaut, et ce refus
       * remontait ici comme un `null` — c'est-à-dire, à l'écran, « ce code ne
       * correspond à aucune famille ».
       *
       * Un parent pouvait régénérer des codes indéfiniment sans jamais
       * approcher la cause, et un enfant lisait qu'il avait mal recopié. On
       * lève donc une erreur portant une phrase vraie, et la console de
       * développement reçoit le refus exact.
       */
      if (signInError) {
        if (__DEV__) {
          console.warn(
            `[join] session anonyme refusée — ${signInError.code ?? 'sans code'} : ${signInError.message}\n` +
              'Supabase → Authentication → Sign In / Providers → Anonymous Sign-Ins',
          );
        }
        throw new Error(
          'Mino n’arrive pas à joindre son serveur. Ce n’est pas ton code : montre cet écran à un parent.',
        );
      }
    }

    const { data, error } = await this.client.rpc('join_family', {
      p_code: input.code.trim().toUpperCase(),
    });
    if (error || !data) return null;
    return this.load();
  }

  /**
   * L'appareil rend compte de son bouclier. Silencieusement — c'est un
   * rapport, pas une action du parent : un échec ne doit rien casser à
   * l'écran, et le silence qui en résulte est lui-même lisible côté parent
   * grâce à `seenAt`.
   */
  async reportShield(input: {
    status: ScreenTimeAuthorization | 'compteur-seul';
    label?: string;
    childId?: ID | null;
  }): Promise<void> {
    try {
      await this.client.rpc('report_shield', {
        p_status: input.status,
        p_label: input.label ?? null,
        p_child_id: input.childId ?? null,
      });
    } catch {
      // Voir ci-dessus : un rapport qui n'arrive pas se lit dans `seenAt`.
    }
  }

  async pairedDevices(): Promise<PairedDevice[]> {
    const { data, error } = await this.client
      .from('family_devices')
      .select('id, label, child_id, shield_status, shield_seen_at, joined_at')
      .order('joined_at', { ascending: true });

    // Une liste vide et une panne de réseau ne veulent pas dire la même chose :
    // l'écran doit pouvoir dire « je ne sais pas » plutôt que « aucun appareil ».
    if (error) throw new Error('Impossible de lire les appareils de la famille.');

    return (data ?? []).map((row) => ({
      id: row.id as ID,
      label: (row.label as string | null) ?? null,
      childId: (row.child_id as ID | null) ?? null,
      status: (row.shield_status as ScreenTimeAuthorization | null) ?? null,
      seenAt: (row.shield_seen_at as ISODate | null) ?? null,
      joinedAt: row.joined_at as ISODate,
    }));
  }

  /**
   * Realtime: a parent validating on their phone must update the child's tablet
   * without a refresh.
   *
   * On a private broadcast channel, not on `postgres_changes`. The difference
   * is not a detail of implementation but of arithmetic: `postgres_changes`
   * evaluates every write in the database against every connected client, so
   * its cost is the product of the two and it stops following somewhere in the
   * low thousands. A channel named after the family is only ever reached by the
   * devices of that family — the cost stops being a product.
   *
   * Who may listen is decided by the database, not here: see the policy on
   * `realtime.messages` in scale.sql.
   */
  subscribe(familyId: ID, onRemoteChange: (data: FamilyData) => void): () => void {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<SupabaseClient['channel']> | null = null;

    // Approving a mission writes a completion and a transaction milliseconds
    // apart. Reloading twice for one gesture is one reload too many.
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.load()
          .then((data) => {
            if (data && !disposed) onRemoteChange(data);
          })
          .catch(() => undefined);
      }, 300);
    };

    (async () => {
      // A private channel is authorised with the caller's token, so it has to
      // be handed over before joining.
      await this.client.realtime.setAuth().catch(() => undefined);
      if (disposed) return;
      channel = this.client
        .channel(`famille:${familyId}`, { config: { private: true } })
        .on('broadcast', { event: 'change' }, reload)
        .subscribe();
    })();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (channel) this.client.removeChannel(channel);
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
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        /**
         * OÙ la session est enregistrée — et sans cette ligne, nulle part.
         *
         * `persistSession: true` ne dit que « garde-la » ; il ne dit pas où.
         * Faute de précision, `supabase-js` cherche `localStorage`, qui
         * n'existe pas en React Native, et se rabat sur une mémoire vive qui
         * meurt avec l'application.
         *
         * Conséquence, sur téléphone uniquement : **fermer Mino déconnectait.**
         * Le parent retrouvait l'accueil et ses quatre boutons, et l'enfant —
         * qui n'a ni adresse ni mot de passe — se retrouvait devant un écran de
         * connexion qu'il ne peut pas franchir. C'est-à-dire un produit qui
         * cesse de fonctionner à la première fermeture.
         *
         * Sur le web, `localStorage` existe : la session tenait, et le défaut
         * était rigoureusement invisible.
         */
        storage: AsyncStorage,
      },
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
