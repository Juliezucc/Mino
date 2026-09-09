import AsyncStorage from '@react-native-async-storage/async-storage';

import { Plan, Referral, Subscription, addMonths, startTrial } from '@/domain/billing';
import { ID } from '@/domain/types';

const STORAGE_KEY = 'mino.billing.local.v1';

import { BillingService, CheckoutOutcome } from './BillingService';

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
  private loaded = false;

  /** Seeds a family's state, for the demo and for tests. */
  set(sub: Subscription) {
    this.subscriptions.set(sub.familyId, sub);
    void this.save();
  }

  /**
   * L'abonnement survit à la fermeture de l'application.
   *
   * Il ne survivait pas : la carte vivait en mémoire, donc l'essai repartait à
   * trente jours à chaque ouverture, et **un essai terminé était impossible à
   * voir hors ligne**. Autrement dit, le seul état où l'abonnement change
   * quelque chose était le seul qu'on ne pouvait pas éprouver — exactement le
   * genre d'angle mort qui envoie une régression en production.
   */
  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      for (const sub of JSON.parse(raw) as Subscription[]) {
        this.subscriptions.set(sub.familyId, sub);
      }
    } catch {
      /* un état corrompu ne doit pas empêcher l'application de démarrer */
    }
  }

  private async save(): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...this.subscriptions.values()]),
    ).catch(() => undefined);
  }

  async getSubscription(familyId: ID): Promise<Subscription | null> {
    await this.load();
    if (!this.subscriptions.has(familyId)) {
      this.subscriptions.set(familyId, startTrial(familyId));
      await this.save();
    }
    return this.subscriptions.get(familyId) ?? null;
  }

  async startCheckout({ familyId, plan }: { familyId: ID; plan: Plan }): Promise<CheckoutOutcome> {
    // No provider: pretend the checkout succeeded so the rest of the flow is
    // exercisable. A real service returns a provider URL and changes nothing
    // until the webhook lands.
    const current = (await this.getSubscription(familyId)) ?? startTrial(familyId);
    const now = new Date().toISOString();
    this.subscriptions.set(familyId, {
      ...current,
      status: 'active',
      plan,
      source: 'stripe',
      currentPeriodEnd: addMonths(now, plan === 'yearly' ? 12 : 1 + current.creditMonths),
      creditMonths: 0,
      cancelAtPeriodEnd: false,
    });
    await this.save();
    return { kind: 'done' };
  }

  async openPortal(): Promise<{ url: string }> {
    return { url: '' };
  }

  async cancel(familyId: ID): Promise<Subscription> {
    const current = (await this.getSubscription(familyId))!;
    const next = { ...current, cancelAtPeriodEnd: true };
    this.subscriptions.set(familyId, next);
    await this.save();
    return next;
  }

  async resume(familyId: ID): Promise<Subscription> {
    const current = (await this.getSubscription(familyId))!;
    const next = { ...current, cancelAtPeriodEnd: false };
    this.subscriptions.set(familyId, next);
    await this.save();
    return next;
  }

  /**
   * La formule change, la période en cours ne bouge pas — comme chez Stripe
   * avec `proration_behavior: 'none'`. Une doublure qui se comporterait
   * autrement laisserait passer, hors ligne, ce qui casse en ligne.
   */
  async changePlan({ familyId, plan }: { familyId: ID; plan: Plan }): Promise<Subscription> {
    const current = (await this.getSubscription(familyId))!;
    const next = { ...current, plan };
    this.subscriptions.set(familyId, next);
    await this.save();
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

    // L'essai du filleul ne bouge pas : trente jours pour tout le monde, voir
    // `REFERRAL` dans `src/domain/billing.ts`. Le code est enregistré, et c'est
    // le parrain qu'il récompense.
    return { ok: true, subscription: current };
  }
}
