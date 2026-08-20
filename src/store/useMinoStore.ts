import { create } from 'zustand';

import { DEMO_PARENT_PIN, buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { LocalRepository } from '@/data/localRepository';
import { ChangeEvent, MinoRepository } from '@/data/repository';
import { createSupabaseRepository } from '@/data/supabaseRepository';
import * as actions from '@/domain/actions';
import { Plan, Referral, Subscription } from '@/domain/billing';
import { DeviceKind } from '@/domain/devices';
import { AvatarKey, FamilyData, ID, RepeatRule } from '@/domain/types';
import * as notify from '@/domain/notifications';
import { AuthResult, getAuthService } from '@/services/auth';
import { getNotificationService } from '@/services/notifications';
import { getBillingService } from '@/services/billing';

/**
 * Single source of truth for the running app.
 *
 * Screens never mutate data themselves: they call an action, the action runs the
 * pure domain function, the result is persisted through the repository, and the
 * new document is published to every screen at once.
 */

function createRepository(): MinoRepository {
  return createSupabaseRepository() ?? new LocalRepository();
}

export type Role = 'child' | 'parent';

interface MinoState {
  status: 'loading' | 'ready';
  repository: MinoRepository;
  data: FamilyData | null;
  activeChildId: ID | null;
  parentUnlocked: boolean;
  lastError: string | null;

  /**
   * Billing lives outside the family document on purpose: it belongs to the
   * payment provider, not to the family's own content, and the app only ever
   * mirrors what the provider says.
   */
  subscription: Subscription | null;
  referrals: Referral[];

  notifications: notify.NotificationPreferences;
  setNotificationPreferences: (patch: Partial<notify.NotificationPreferences>) => void;

  bootstrap: () => Promise<void>;
  startDemo: () => Promise<void>;
  createAccount: (input: {
    parentName: string;
    email: string;
    password: string;
    pin: string;
    familyName?: string;
  }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** From the child's device: attach to a family with the family code. */
  joinFamily: (input: { code: string }) => Promise<boolean>;
  resetAll: () => Promise<void>;

  selectChild: (childId: ID | null) => void;
  unlockParent: (pin: string) => Promise<AuthResult>;
  lockParent: () => void;

  addChild: (input: actions.CreateChildInput) => Promise<ID>;
  editChild: (
    childId: ID,
    patch: { firstName?: string; age?: number; avatarKey?: AvatarKey; requireApproval?: boolean },
  ) => Promise<void>;
  deleteChild: (childId: ID) => Promise<void>;

  addMission: (input: {
    title: string;
    icon: string;
    minutes: number;
    repeat: RepeatRule;
    childIds: ID[];
  }) => Promise<ID>;
  archiveMission: (missionId: ID) => Promise<void>;

  completeMission: (childId: ID, missionId: ID) => Promise<ID>;
  approveCompletion: (completionId: ID) => Promise<void>;
  rejectCompletion: (completionId: ID) => Promise<void>;
  markCelebrated: (completionId: ID) => Promise<void>;

  addDevice: (input: { label: string; kind: DeviceKind }) => Promise<ID>;
  removeDevice: (deviceId: ID) => Promise<void>;

  startSession: (childId: ID, minutes: number, deviceId?: ID) => Promise<ID>;
  approveSession: (sessionId: ID) => Promise<void>;
  refuseSession: (sessionId: ID) => Promise<void>;
  endSession: (sessionId: ID, status?: 'finished' | 'stopped') => Promise<void>;
  adjustBalance: (childId: ID, delta: number, reason: string) => Promise<void>;
  grantBonus: (childId: ID, minutes: number, reason: string) => Promise<void>;

  loadBilling: () => Promise<void>;
  choosePlan: (plan: Plan) => Promise<{ url: string }>;
  cancelSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  redeemReferral: (code: string) => Promise<{ ok: boolean; reason?: string }>;
}

/**
 * Documents written before the PIN moved out of the family carry it on the
 * parent row. Left alone, those installs answer "wrong code" to every code
 * there is and the parent area becomes unreachable for good — so the PIN is
 * moved into the auth service on the first launch, and erased from the
 * document, which is the whole point of having moved it.
 */
async function migrateLegacyPin(
  data: FamilyData | null,
  repository: MinoRepository,
): Promise<FamilyData | null> {
  if (!data) return data;

  const legacy = data.parents.find((p) => typeof (p as { pin?: string }).pin === 'string');
  if (!legacy) return data;

  const pin = (legacy as { pin?: string }).pin!;
  const cleaned: FamilyData = {
    ...data,
    parents: data.parents.map(({ ...parent }) => {
      delete (parent as { pin?: string }).pin;
      return parent;
    }),
  };

  // Only drop it from the document once it is safely somewhere else.
  const stored = await getAuthService().setParentPin(pin);
  if (!stored.ok) return data;

  await repository.persist(cleaned, { kind: 'family.updated' }).catch(() => undefined);
  return cleaned;
}

export const useMinoStore = create<MinoState>((set, get) => {
  /** Runs a pure domain transition, persists it, publishes it. */
  async function commit<T>(
    kind: ChangeEvent['kind'],
    run: (data: FamilyData) => { data: FamilyData; result?: T; upsert?: Partial<FamilyData>; deleteChildId?: ID },
  ): Promise<T | undefined> {
    const current = get().data;
    if (!current) throw new actions.DomainError('Aucune famille chargée.');

    const outcome = run(current);
    set({ data: outcome.data, lastError: null });
    await get().repository.persist(outcome.data, {
      kind,
      upsert: outcome.upsert,
      deleteChildId: outcome.deleteChildId,
    });
    return outcome.result;
  }

  /**
   * The one place a notification leaves from.
   *
   * Preferences and quiet hours are checked here, once, rather than at each
   * call site — a rule enforced in seven places is a rule that holds in six.
   * And it never throws: a notification that fails to schedule must not take
   * down the action that earned it.
   */
  async function announce(payload: notify.NotificationPayload | null) {
    if (!payload) return;
    if (!notify.shouldDeliver(payload, get().notifications)) return;
    await getNotificationService()
      .schedule(payload)
      .catch(() => null);
  }

  return {
    status: 'loading',
    repository: createRepository(),
    data: null,
    activeChildId: null,
    parentUnlocked: false,
    lastError: null,
    subscription: null,
    referrals: [],
    notifications: notify.DEFAULT_PREFERENCES,

    setNotificationPreferences(patch) {
      set({ notifications: { ...get().notifications, ...patch } });
    },

    async bootstrap() {
      const data = await migrateLegacyPin(await get().repository.load(), get().repository);
      set({ data, status: 'ready' });
      if (data) await get().loadBilling();
    },

    async startDemo() {
      const data = buildDemoFamily();
      // The demo's PIN lives where every PIN lives — in the auth service,
      // never in the family document.
      await getAuthService().setParentPin(DEMO_PARENT_PIN);
      set({ data, status: 'ready', activeChildId: null, parentUnlocked: false });
      await get().repository.persist(data, { kind: 'bootstrap' });
      await get().loadBilling();
    },

    async createAccount({ parentName, email, password, pin, familyName }) {
      // The account first: without an identity there is nothing to attach a
      // family to, and every row the backend stores is scoped by it.
      const signUp = await getAuthService().signUp({ email, password });
      if (!signUp.ok) return signUp;

      const pinSet = await getAuthService().setParentPin(pin);
      if (!pinSet.ok) return pinSet;

      const data = buildEmptyFamily({
        parentName,
        email,
        familyName: familyName?.trim() || `Famille de ${parentName}`,
      });
      set({ data, status: 'ready', activeChildId: null, parentUnlocked: true });
      await get().repository.persist(data, { kind: 'bootstrap' });
      await get().loadBilling();
      return { ok: true };
    },

    async signIn(input) {
      const result = await getAuthService().signIn(input);
      if (!result.ok) return result;
      const data = await get().repository.load();
      set({ data, status: 'ready', activeChildId: null, parentUnlocked: true });
      if (data) await get().loadBilling();
      return { ok: true };
    },

    async signOut() {
      await getAuthService().signOut();
      set({ parentUnlocked: false, activeChildId: null });
    },

    async joinFamily(input) {
      const data = await get().repository.joinFamily(input);
      if (!data) return false;
      // The child's device never lands in the parent area, whatever it holds.
      set({ data, status: 'ready', activeChildId: null, parentUnlocked: false });
      await get().loadBilling();
      return true;
    },

    async resetAll() {
      await get().repository.clear();
      set({
        data: null,
        activeChildId: null,
        parentUnlocked: false,
        status: 'ready',
        subscription: null,
        referrals: [],
      });
    },

    selectChild(childId) {
      set({ activeChildId: childId });
    },

    /**
     * Asynchronous now, and deliberately so: the PIN is checked by the auth
     * service, which rate-limits it. Four digits is ten thousand guesses, and a
     * comparison done here would be a comparison a child's device could skip.
     */
    async unlockParent(pin) {
      const result = await getAuthService().verifyParentPin(pin);
      if (result.ok) set({ parentUnlocked: true, activeChildId: null });
      return result;
    },

    lockParent() {
      set({ parentUnlocked: false });
    },

    async addChild(input) {
      const id = await commit<ID>('child.created', (data) => {
        const out = actions.createChild(data, input);
        return { data: out.data, result: out.child.id, upsert: { children: [out.child] } };
      });
      return id!;
    },

    async editChild(childId, patch) {
      await commit('child.updated', (data) => {
        const next = actions.updateChild(data, childId, patch);
        const child = next.children.find((c) => c.id === childId);
        return { data: next, upsert: child ? { children: [child] } : undefined };
      });
    },

    async deleteChild(childId) {
      await commit('child.removed', (data) => ({
        data: actions.removeChild(data, childId),
        deleteChildId: childId,
      }));
      if (get().activeChildId === childId) set({ activeChildId: null });
    },

    async addMission(input) {
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      const id = await commit<ID>('mission.created', (data) => {
        const out = actions.createMission(data, { ...input, createdBy: parentId });
        const assignments = out.data.assignments.filter((a) => a.missionId === out.mission.id);
        return {
          data: out.data,
          result: out.mission.id,
          upsert: { missions: [out.mission], assignments },
        };
      });
      return id!;
    },

    async archiveMission(missionId) {
      await commit('mission.archived', (data) => {
        const next = actions.archiveMission(data, missionId);
        const mission = next.missions.find((m) => m.id === missionId);
        return {
          data: next,
          upsert: {
            missions: mission ? [mission] : [],
            assignments: next.assignments.filter((a) => a.missionId === missionId),
          },
        };
      });
    },

    async completeMission(childId, missionId) {
      const id = await commit<ID>('completion.created', (data) => {
        const out = actions.completeMission(data, { childId, missionId });
        return {
          data: out.data,
          result: out.completion.id,
          upsert: { completions: [out.completion] },
        };
      });

      const data = get().data;
      const child = notify.childOf(data, childId);
      const mission = data?.missions.find((m) => m.id === missionId);
      if (child && mission) await announce(notify.missionCompleted(child, mission));
      return id!;
    },

    async approveCompletion(completionId) {
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      await commit('completion.approved', (data) => {
        const out = actions.approveCompletion(data, { completionId, parentId });
        return {
          data: out.data,
          upsert: { completions: [out.completion], transactions: [out.transaction] },
        };
      });

      const data = get().data;
      const completion = data?.completions.find((c) => c.id === completionId);
      const child = notify.childOf(data, completion?.childId);
      if (child && completion) {
        await announce(notify.completionApproved(child, completion.minutesAwarded));
      }
    },

    async rejectCompletion(completionId) {
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      await commit('completion.rejected', (data) => {
        const out = actions.rejectCompletion(data, { completionId, parentId });
        return { data: out.data, upsert: { completions: [out.completion] } };
      });

      const data = get().data;
      const completion = data?.completions.find((c) => c.id === completionId);
      const child = notify.childOf(data, completion?.childId);
      const mission = data?.missions.find((m) => m.id === completion?.missionId);
      if (child && mission) await announce(notify.completionRejected(child, mission));
    },

    async markCelebrated(completionId) {
      await commit('completion.celebrated', (data) => {
        const next = actions.markCelebrated(data, completionId);
        const completion = next.completions.find((c) => c.id === completionId);
        return { data: next, upsert: completion ? { completions: [completion] } : undefined };
      });
    },

    async addDevice(input) {
      const id = await commit<ID>('family.updated', (data) => {
        const out = actions.addDevice(data, input);
        return { data: out.data, result: out.device.id, upsert: { devices: [out.device] } };
      });
      return id!;
    },

    async removeDevice(deviceId) {
      await commit('family.updated', (data) => {
        const next = actions.removeDevice(data, deviceId);
        const device = next.devices.find((d) => d.id === deviceId);
        return { data: next, upsert: device ? { devices: [device] } : undefined };
      });
    },

    async startSession(childId, minutes, deviceId) {
      const id = await commit<ID>('session.started', (data) => {
        const out = actions.startSession(data, { childId, minutes, deviceId });
        return { data: out.data, result: out.session.id, upsert: { sessions: [out.session] } };
      });

      const data = get().data;
      const session = data?.sessions.find((s) => s.id === id);
      const child = notify.childOf(data, childId);
      if (!child || !session) return id!;

      if (session.status === 'requested') {
        await announce(notify.sessionRequested(child, minutes, data?.devices, deviceId));
      } else {
        await announce(notify.sessionEndingSoon(child, session.endsAt));
      }
      return id!;
    },

    async approveSession(sessionId) {
      await commit('session.started', (data) => {
        const out = actions.approveSession(data, { sessionId });
        return { data: out.data, upsert: { sessions: [out.session] } };
      });

      const data = get().data;
      const session = data?.sessions.find((s) => s.id === sessionId);
      const child = notify.childOf(data, session?.childId);
      if (child && session) await announce(notify.sessionEndingSoon(child, session.endsAt));
    },

    async refuseSession(sessionId) {
      await commit('session.ended', (data) => {
        const out = actions.refuseSession(data, { sessionId });
        return { data: out.data, upsert: { sessions: [out.session] } };
      });
    },

    async endSession(sessionId, status) {
      // The session is over, so the five-minute warning must not still be in
      // the queue — a child who stopped early does not get buzzed about it.
      await getNotificationService()
        .cancelKind('session.endingSoon')
        .catch(() => undefined);
      await commit('session.ended', (data) => {
        const out = actions.endSession(data, { sessionId, status });
        return {
          data: out.data,
          upsert: {
            sessions: [out.session],
            transactions: out.transaction ? [out.transaction] : [],
          },
        };
      });
    },

    async adjustBalance(childId, delta, reason) {
      await commit('balance.adjusted', (data) => {
        const next = actions.adjustBalance(data, { childId, delta, reason });
        return { data: next, upsert: { transactions: next.transactions.slice(-1) } };
      });
    },

    async grantBonus(childId, minutes, reason) {
      await commit('balance.adjusted', (data) => {
        const next = actions.grantBonus(data, { childId, minutes, reason });
        return { data: next, upsert: { transactions: next.transactions.slice(-1) } };
      });

      const child = notify.childOf(get().data, childId);
      if (child) await announce(notify.bonusGranted(child, minutes, reason));
    },

    /* ------------------------------------------------------------ billing */

    async loadBilling() {
      const familyId = get().data?.family.id;
      if (!familyId) return;
      const billing = getBillingService();
      // Billing must never block the app: a payment provider being down is not
      // a reason for a child to lose their missions.
      const [subscription, referrals] = await Promise.all([
        billing.getSubscription(familyId).catch(() => null),
        billing.listReferrals(familyId).catch(() => []),
      ]);
      set({ subscription, referrals });
    },

    async choosePlan(plan) {
      const familyId = get().data?.family.id;
      if (!familyId) throw new Error('Aucune famille.');
      const result = await getBillingService().startCheckout({ familyId, plan });
      await get().loadBilling();
      return result;
    },

    async cancelSubscription() {
      const familyId = get().data?.family.id;
      if (!familyId) return;
      set({ subscription: await getBillingService().cancel(familyId) });
    },

    async resumeSubscription() {
      const familyId = get().data?.family.id;
      if (!familyId) return;
      set({ subscription: await getBillingService().resume(familyId) });
    },

    async redeemReferral(code) {
      const familyId = get().data?.family.id;
      if (!familyId) return { ok: false, reason: 'Aucune famille.' };
      const result = await getBillingService().redeemReferralCode({ familyId, code });
      if (result.subscription) set({ subscription: result.subscription });
      return { ok: result.ok, reason: result.reason };
    },
  };
});
