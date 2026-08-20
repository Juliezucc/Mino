import { Plan, Referral, Subscription } from '@/domain/billing';
import { ID } from '@/domain/types';

import { BillingService } from './BillingService';

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
      throw new Error(`Facturation indisponible (${response.status}).`);
    }
    return (await response.json()) as T;
  }

  getSubscription(familyId: ID): Promise<Subscription | null> {
    return this.call<Subscription | null>(
      `/billing/subscription?familyId=${encodeURIComponent(familyId)}`,
    );
  }

  startCheckout(input: { familyId: ID; plan: Plan; referralCode?: string }) {
    return this.call<{ url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(input),
    });
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
