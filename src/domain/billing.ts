import { ID, ISODate } from './types';

/**
 * Subscription and referral rules.
 *
 * Money is not stored here and no payment is taken here: this module holds the
 * rules, and a `BillingService` (see `services/billing`) talks to whoever
 * actually charges the card. That separation is what lets the same rules be
 * checked in tests, enforced in the app, and mirrored on the server later.
 *
 * The constants below are imported by the terms of sale, so the contract and
 * the code cannot drift apart.
 */

export const MONTHLY_PRICE_EUR = 9.9;
export const ANNUAL_PRICE_EUR = 79;
export const TRIAL_DAYS = 30;

export const REFERRAL = {
  /** Months given to the referrer, once the referee actually pays. */
  referrerFreeMonths: 1,
  /** The referee's own reward: a longer trial rather than a discount. */
  refereeTrialDays: 60,
  /**
   * Cap per rolling year. Unlimited free months are an invitation to farm fake
   * accounts; twelve still rewards a genuine ambassador with a free year.
   */
  maxFreeMonthsPerYear: 12,
} as const;

export type Plan = 'monthly' | 'yearly';

export type SubscriptionStatus =
  /** Inside the free trial, nothing charged yet. */
  | 'trialing'
  /** Paid and current. */
  | 'active'
  /** A payment failed; access continues while we retry. */
  | 'past_due'
  /** Over — trial expired without payment, or the family cancelled and the paid period ended. */
  | 'canceled';

export interface Subscription {
  familyId: ID;
  status: SubscriptionStatus;
  /** Null while trialing, before a plan is picked. */
  plan: Plan | null;
  trialEndsAt: ISODate | null;
  /** End of the period currently paid for. */
  currentPeriodEnd: ISODate | null;
  /** Cancelled, but still running until the end of the paid period. */
  cancelAtPeriodEnd: boolean;
  /** Referral months won and not yet consumed. */
  creditMonths: number;
  /** Ids at the payment provider. Absent until the first checkout. */
  customerId?: string;
  subscriptionId?: string;
}

export type ReferralStatus =
  /** The referee signed up with the code but has not paid yet. */
  | 'pending'
  /** The referee paid: the referrer has earned a month. */
  | 'qualified'
  /** The month has been added to the referrer's subscription. */
  | 'credited'
  /** Refused — self-referral, duplicate household, or over the yearly cap. */
  | 'rejected';

export interface Referral {
  id: ID;
  code: string;
  referrerFamilyId: ID;
  refereeFamilyId: ID;
  status: ReferralStatus;
  createdAt: ISODate;
  qualifiedAt?: ISODate;
  creditedAt?: ISODate;
  /** Why it was rejected, for the support conversation that follows. */
  rejectionReason?: string;
}

/** What the app should let the family do right now. */
export type Access =
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'active'; renewsOn: ISODate | null; cancelAtPeriodEnd: boolean }
  | { kind: 'grace'; reason: 'past_due' }
  | { kind: 'expired' };

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/** Adds whole months, clamping the day so 31 January + 1 month is 28 February. */
export function addMonths(iso: ISODate, months: number): ISODate {
  const date = new Date(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.toISOString();
}

/** A brand-new family: trialing, no plan, no card. */
export function startTrial(familyId: ID, now: Date = new Date(), days = TRIAL_DAYS): Subscription {
  return {
    familyId,
    status: 'trialing',
    plan: null,
    trialEndsAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    creditMonths: 0,
  };
}

/**
 * What the family can do, derived from the subscription rather than stored.
 * Same rule as the time ledger: never trust a status field that a clock can
 * make stale.
 */
export function accessOf(sub: Subscription | null, now: Date = new Date()): Access {
  if (!sub) return { kind: 'expired' };

  if (sub.status === 'trialing') {
    const left = sub.trialEndsAt ? daysBetween(now, new Date(sub.trialEndsAt)) : 0;
    return left > 0 ? { kind: 'trial', daysLeft: left } : { kind: 'expired' };
  }

  if (sub.status === 'past_due') return { kind: 'grace', reason: 'past_due' };

  if (sub.status === 'active') {
    const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
    if (end && end.getTime() <= now.getTime()) return { kind: 'expired' };
    return {
      kind: 'active',
      renewsOn: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }

  return { kind: 'expired' };
}

export function hasAccess(sub: Subscription | null, now: Date = new Date()): boolean {
  return accessOf(sub, now).kind !== 'expired';
}

/** Free months already credited to this family over the last rolling year. */
export function creditedMonthsInYear(
  referrals: Referral[],
  familyId: ID,
  now: Date = new Date(),
): number {
  const since = now.getTime() - 365 * DAY_MS;
  return referrals.filter(
    (r) =>
      r.referrerFamilyId === familyId &&
      r.status === 'credited' &&
      r.creditedAt !== undefined &&
      new Date(r.creditedAt).getTime() >= since,
  ).length * REFERRAL.referrerFreeMonths;
}

export interface ReferralCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Can this family use that code? Checked before the referee's account is even
 * linked, so the refusal is explained at the moment it can still be fixed.
 */
export function canUseReferralCode(
  referrals: Referral[],
  input: { code: string; referrerFamilyId: ID | null; refereeFamilyId: ID },
): ReferralCheck {
  if (!input.referrerFamilyId) return { ok: false, reason: 'Ce code de parrainage n’existe pas.' };
  if (input.referrerFamilyId === input.refereeFamilyId) {
    return { ok: false, reason: 'On ne peut pas se parrainer soi-même.' };
  }
  const already = referrals.some((r) => r.refereeFamilyId === input.refereeFamilyId && r.status !== 'rejected');
  if (already) return { ok: false, reason: 'Cette famille a déjà été parrainée.' };
  return { ok: true };
}

/**
 * The referee paid: the referrer earns their month — unless the yearly cap is
 * already reached, in which case the referral is recorded as qualified but not
 * credited, and can be honoured later.
 */
export function qualifyReferral(
  referrals: Referral[],
  referralId: ID,
  now: Date = new Date(),
): { referrals: Referral[]; creditedFamilyId: ID | null } {
  const target = referrals.find((r) => r.id === referralId);
  if (!target || target.status !== 'pending') return { referrals, creditedFamilyId: null };

  const capped =
    creditedMonthsInYear(referrals, target.referrerFamilyId, now) + REFERRAL.referrerFreeMonths >
    REFERRAL.maxFreeMonthsPerYear;

  const updated: Referral = capped
    ? { ...target, status: 'qualified', qualifiedAt: now.toISOString() }
    : {
        ...target,
        status: 'credited',
        qualifiedAt: now.toISOString(),
        creditedAt: now.toISOString(),
      };

  return {
    referrals: referrals.map((r) => (r.id === referralId ? updated : r)),
    creditedFamilyId: capped ? null : target.referrerFamilyId,
  };
}

/**
 * Puts an earned month on the subscription. During the trial it extends the
 * trial; once paying it pushes the next charge back — either way the family
 * gets a month they do not pay for.
 */
export function applyFreeMonths(
  sub: Subscription,
  months: number = REFERRAL.referrerFreeMonths,
): Subscription {
  if (months <= 0) return sub;

  if (sub.status === 'trialing' && sub.trialEndsAt) {
    return { ...sub, trialEndsAt: addMonths(sub.trialEndsAt, months) };
  }
  if (sub.status === 'active' && sub.currentPeriodEnd) {
    return { ...sub, currentPeriodEnd: addMonths(sub.currentPeriodEnd, months) };
  }
  // No period to push yet: bank it and spend it at the next checkout.
  return { ...sub, creditMonths: sub.creditMonths + months };
}

export function priceOf(plan: Plan): number {
  return plan === 'yearly' ? ANNUAL_PRICE_EUR : MONTHLY_PRICE_EUR;
}

export function formatPrice(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',').replace(/,00$/, '')} €`;
}

/** "9,90 € / mois" — the way it is shown on the plan cards. */
export function describePlan(plan: Plan): string {
  return plan === 'yearly'
    ? `${formatPrice(ANNUAL_PRICE_EUR)} / an`
    : `${formatPrice(MONTHLY_PRICE_EUR)} / mois`;
}

/** How much the annual plan saves, as a percentage of twelve monthly payments. */
export function annualSavingPercent(): number {
  return Math.round((1 - ANNUAL_PRICE_EUR / (MONTHLY_PRICE_EUR * 12)) * 100);
}
