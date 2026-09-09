import { Plan, Referral, Subscription } from '@/domain/billing';
import { ID } from '@/domain/types';

import { BillingService, CheckoutOutcome } from './BillingService';

/**
 * Talks to our own backend, which talks to Stripe.
 *
 * The client deliberately knows nothing about Stripe beyond "open this URL".
 * Prices, referral credits and subscription state are decided server-side from
 * Stripe's webhooks — a client that could grant itself a free month is a client
 * that will be asked to.
 *
 * Expected endpoints, all authenticated as the parent:
 *   GET  /billing/subscription?familyId=…   → Subscription | null
 *   POST /billing/checkout                  → { url }
 *   POST /billing/portal                    → { url }
 *   POST /billing/cancel                    → Subscription
 *   POST /billing/resume                    → Subscription
 */
export class StripeWebBillingService implements BillingService {
  readonly name = 'stripe-web';
  readonly capability = 'stripe-web' as const;

  constructor(
    private readonly baseUrl: string,
    /** Supplies the parent's access token; the backend authorises from it. */
    private readonly getToken: () => Promise<string | null>,
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      /**
       * Lire la cause avant de la remplacer par un numéro.
       *
       * Le serveur renvoie `{ error: "..." }` sur chacun de ses refus — clé
       * Stripe absente, tarif inconnu, abonnement introuvable, message de
       * Stripe lui-même. Tout cela partait à la poubelle, et l'écran affichait
       * « Facturation indisponible (500) » : un numéro qui ne dit ni quoi, ni
       * où, ni comment réparer. On lisait alors les journaux du serveur pour
       * apprendre ce que la réponse contenait déjà.
       *
       * Le numéro reste, en fin de phrase : il distingue un refus (400) d'une
       * panne (500) d'une session expirée (401), ce que le texte seul ne dit
       * pas toujours.
       */
      const dit = await response
        .json()
        .then((corps: { error?: unknown }) =>
          typeof corps?.error === 'string' ? corps.error : null,
        )
        .catch(() => null);
      throw new Error(dit ? `${dit} (${response.status})` : `Facturation indisponible (${response.status}).`);
    }
    return (await response.json()) as T;
  }

  getSubscription(familyId: ID): Promise<Subscription | null> {
    return this.call<Subscription | null>(
      `/billing/subscription?familyId=${encodeURIComponent(familyId)}`,
    );
  }

  async startCheckout(input: {
    familyId: ID;
    plan: Plan;
    referralCode?: string;
  }): Promise<CheckoutOutcome> {
    const { url } = await this.call<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    // Rien n'est payé tant que le navigateur n'a pas été jusqu'au bout.
    return { kind: 'url', url };
  }

  openPortal(familyId: ID) {
    return this.call<{ url: string }>('/billing/portal', {
      method: 'POST',
      body: JSON.stringify({ familyId }),
    });
  }

  cancel(familyId: ID) {
    return this.call<Subscription>('/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({ familyId }),
    });
  }

  resume(familyId: ID) {
    return this.call<Subscription>('/billing/resume', {
      method: 'POST',
      body: JSON.stringify({ familyId }),
    });
  }

  changePlan(input: { familyId: ID; plan: Plan }) {
    return this.call<Subscription>('/billing/plan', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listReferrals(familyId: ID) {
    return this.call<Referral[]>(`/billing/referrals?familyId=${encodeURIComponent(familyId)}`);
  }

  redeemReferralCode(input: { familyId: ID; code: string }) {
    return this.call<{ ok: boolean; reason?: string; subscription?: Subscription }>(
      '/billing/referrals/redeem',
      { method: 'POST', body: JSON.stringify(input) },
    );
  }
}
