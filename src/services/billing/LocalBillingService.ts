import { REFERRAL, Plan, Referral, Subscription, addMonths, startTrial } from '@/domain/billing';
import { ID } from '@/domain/types';

import { BillingService } from './BillingService';

/**
 * A stand-in that charges nothing.
 *
 * It exists so the whole subscription experience — trial countdown, plan
 * choice, cancellation, referral months — can be built, tested and demoed
 * before a single euro moves. It reports `capability: 'none'`, and the UI says
 * plainly that no payment is taken.
 */
export class LocalBillingService implements BillingService {
  readonly name = 'local';
  readonly capability = 'none' as const;

  private readonly subscriptions = new Map<ID, Subscription>();
  private readonly referrals: Referral[] = [];

  /** Seeds a family's state, for the demo and for tests. */
  set(sub: Subscription) {
    this.subscriptions.set(sub.familyId, sub);
  }

  async getSubscription(familyId: ID): Promise<Subscription | null> {
    if (!this.subscriptions.has(familyId)) this.subscriptions.set(familyId, startTrial(familyId));
    return this.subscriptions.get(familyId) ?? null;
  }

  async startCheckout({ familyId, plan }: { familyId: ID; plan: Plan }): Promise<{ url: string }> {
    // No provider: pretend the checkout succeeded so the rest of the flow is
    // exercisable. A real service returns a provider URL and changes nothing
    // until the webhook lands.
    const current = (await this.getSubscription(familyId)) ?? startTrial(familyId);
    const now = new Date().toISOString();
    this.subscriptions.set(familyId, {
      ...current,
      status: 'active',
      plan,
      currentPeriodEnd: addMonths(now, plan === 'yearly' ? 12 : 1 + current.creditMonths),
      creditMonths: 0,
      cancelAtPeriodEnd: false,
    });
    return { url: '' };
  }

  async openPortal(): Promise<{ url: string }> {
    return { url: '' };
  }

  async cancel(familyId: ID): Promise<Subscription> {
    const current = (await this.getSubscription(familyId))!;
    const next = { ...current, cancelAtPeriodEnd: true };
    this.subscriptions.set(familyId, next);
    return next;
  }

  async resume(familyId: ID): Promise<Subscription> {
    const current = (await this.getSubscription(familyId))!;
    const next = { ...current, cancelAtPeriodEnd: false };
    this.subscriptions.set(familyId, next);
    return next;
  }

  async listReferrals(familyId: ID): Promise<Referral[]> {
    return this.referrals.filter((r) => r.referrerFamilyId === familyId);
  }

  async redeemReferralCode({ familyId, code }: { familyId: ID; code: string }) {
    // With no backend there is no directory of families to look the code up in,
    // so this only checks the shape and grants the newcomer's side of the deal:
    // the longer trial. The referrer's month is a server decision.
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) return { ok: false, reason: 'Ce code n\u2019existe pas.' };

    const current = (await this.getSubscription(familyId))!;
    if (current.status !== 'trialing') {
      return { ok: false, reason: 'Un code de parrainage ne s\u2019utilise qu\u2019\u00e0 l\u2019inscription.' };
    }

    const next: Subscription = {
      ...current,
      trialEndsAt: new Date(
        Date.now() + REFERRAL.refereeTrialDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    this.subscriptions.set(familyId, next);
    return { ok: true, subscription: next };
  }
}
