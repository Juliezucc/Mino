import { Plan, Referral, Subscription } from '@/domain/billing';
import { ID } from '@/domain/types';

/**
 * Everything the app needs from whoever takes the money.
 *
 * Mino sells on the web, so a checkout is "open a URL and come back": the app
 * never sees a card number, and the provider's webhooks are the source of truth
 * for what was actually paid. Should in-app purchase ever be added, it slots in
 * behind this same interface.
 */
export interface BillingService {
  readonly name: string;
  /**
   * `none` means nothing can be charged — the local stand-in used in
   * development and in the demo. The UI uses this to say so honestly rather
   * than pretending a checkout happened.
   */
  readonly capability: 'none' | 'stripe-web';

  getSubscription(familyId: ID): Promise<Subscription | null>;

  /** Returns the URL to open. Nothing is charged until the customer completes it. */
  startCheckout(input: {
    familyId: ID;
    plan: Plan;
    /** Applied by the backend, never trusted from the client alone. */
    referralCode?: string;
  }): Promise<{ url: string }>;

  /**
   * The customer portal: change plan, update card, and cancel. Cancelling has
   * to stay reachable in three clicks — it is a legal requirement in France,
   * not a courtesy.
   */
  openPortal(familyId: ID): Promise<{ url: string }>;

  /** Cancel at period end, without leaving the app. */
  cancel(familyId: ID): Promise<Subscription>;

  /** Undo a pending cancellation, while the period is still running. */
  resume(familyId: ID): Promise<Subscription>;

  /** The families this one has brought in, and where each of them stands. */
  listReferrals(familyId: ID): Promise<Referral[]>;

  /**
   * Enter someone else's code. The reward is a longer trial for the newcomer;
   * the referrer's free month is only earned once this family actually pays,
   * which is a decision the backend makes, not the app.
   */
  redeemReferralCode(input: {
    familyId: ID;
    code: string;
  }): Promise<{ ok: boolean; reason?: string; subscription?: Subscription }>;
}
