import { create } from 'zustand';

import { buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { LocalRepository } from '@/data/localRepository';
import { ChangeEvent, MinoRepository } from '@/data/repository';
import { createSupabaseRepository } from '@/data/supabaseRepository';
import * as actions from '@/domain/actions';
import { Plan, Referral, Subscription } from '@/domain/billing';
import { DeviceKind } from '@/domain/devices';
import { AvatarKey, FamilyData, ID, RepeatRule } from '@/domain/types';
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

  bootstrap: () => Promise<void>;
  startDemo: () => Promise<void>;
  createAccount: (input: {
    parentName: string;
    email: string;
    pin: string;
    familyName?: string;
  }) => Promise<void>;
  /** From the child's device: attach to a family with the family code. */
  joinFamily: (input: { code: string }) => Promise<boolean>;
  resetAll: () => Promise<void>;

  selectChild: (childId: ID | null) => void;
  unlockParent: (pin: string) => boolean;
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

  return {
    status: 'loading',
    repository: createRepository(),
    data: null,
    activeChildId: null,
    parentUnlocked: false,
    lastError: null,
    subscription: null,
    referrals: [],

    async bootstrap() {
      const data = await get().repository.load();
      set({ data, status: 'ready' });
      if (data) await get().loadBilling();
    },

    async startDemo() {
      const data = buildDemoFamily();
      set({ data, status: 'ready', activeChildId: null, parentUnlocked: false });
      await get().repository.persist(data, { kind: 'bootstrap' });
      await get().loadBilling();
    },

    async createAccount({ parentName, email, pin, familyName }) {
      const data = buildEmptyFamily({
        parentName,
        email,
        pin,
        familyName: familyName?.trim() || `Famille de ${parentName}`,
      });
      set({ data, status: 'ready', activeChildId: null, parentUnlocked: true });
      await get().repository.persist(data, { kind: 'bootstrap' });
      await get().loadBilling();
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

    unlockParent(pin) {
      const parent = get().data?.parents[0];
      const ok = !!parent && parent.pin === pin;
      if (ok) set({ parentUnlocked: true, activeChildId: null });
      return ok;
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
    },

    async rejectCompletion(completionId) {
      const parentId = get().data?.parents[0]?.id ?? 'unknown';
      await commit('completion.rejected', (data) => {
        const out = actions.rejectCompletion(data, { completionId, parentId });
        return { data: out.data, upsert: { completions: [out.completion] } };
      });
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
      return id!;
    },

    async approveSession(sessionId) {
      await commit('session.started', (data) => {
        const out = actions.approveSession(data, { sessionId });
        return { data: out.data, upsert: { sessions: [out.session] } };
      });
    },

    async refuseSession(sessionId) {
      await commit('session.ended', (data) => {
        const out = actions.refuseSession(data, { sessionId });
        return { data: out.data, upsert: { sessions: [out.session] } };
      });
    },

    async endSession(sessionId, status) {
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
