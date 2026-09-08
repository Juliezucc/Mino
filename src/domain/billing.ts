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
 *
 * IMPORTANT: this file must stay free of imports. The Supabase Edge Function
 * that credits referrals imports it directly, so that the rule enforced on the
 * server is literally the same code as the rule shown in the app — and Deno
 * cannot follow the app's module aliases. The two aliases below are the reason
 * it does not import `domain/types`.
 */

/** Same as `domain/types`, redeclared so this module keeps no dependency. */
type ID = string;
type ISODate = string;

export const MONTHLY_PRICE_EUR = 9.99;
export const ANNUAL_PRICE_EUR = 79.99;
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

/**
 * Par où l'argent est passé.
 *
 * Deux rails, un seul abonnement. Dans l'application, Apple et Google
 * l'exigent : tout paiement qui débloque une fonctionnalité numérique dans
 * l'app doit passer par leur système. Sur le web, Stripe, moins cher et sans
 * intermédiaire.
 *
 * Ce n'est pas un détail comptable. La source décide de trois choses que
 * l'utilisateur voit : qui encaisse, où l'on résilie, et qui rembourse. Une
 * application qui se trompe là-dessus promet une résiliation en deux touches
 * puis affiche un bouton qui ne peut rien faire.
 */
export type BillingSource = 'stripe' | 'apple' | 'google';

/** Un achat passé par une boutique se gère dans les réglages du téléphone. */
export function isStore(source: BillingSource | undefined): boolean {
  return source === 'apple' || source === 'google';
}

/**
 * Ce que chaque rail laisse réellement.
 *
 * Les commissions des boutiques se calculent sur le prix hors taxes, la TVA
 * étant reversée par elles — elles sont vendeur officiel de l'abonnement.
 * Stripe prélève sur le montant encaissé, TVA comprise, et la TVA reste à
 * reverser.
 *
 * Ces taux sont utilisés pour comparer les rails dans les tableaux de bord,
 * jamais pour facturer quoi que ce soit.
 */
export const COMMISSION = {
  /** 1,5 % + 0,25 € pour une carte européenne. */
  stripeRate: 0.015,
  stripeFixedEur: 0.25,
  /** Programme Small Business d'Apple, et Play pour les abonnements. */
  storeReduced: 0.15,
  /** Apple hors programme, première année d'un abonné. */
  storeStandard: 0.3,
  /** TVA française, reversée par la boutique ou par nous selon le rail. */
  vatRate: 0.2,
} as const;

/**
 * Ce qui reste vraiment, hors taxes, pour un paiement donné.
 *
 * Le seul calcul qui permette de comparer les deux rails : un encaissement
 * Stripe et un versement Apple ne portent pas sur la même assiette, et les
 * comparer bruts donne une réponse fausse d'environ un cinquième.
 */
export function netOf(
  amountEur: number,
  source: BillingSource,
  { reduced = true }: { reduced?: boolean } = {},
): number {
  const excludingVat = amountEur / (1 + COMMISSION.vatRate);

  if (source === 'stripe') {
    const fees = amountEur * COMMISSION.stripeRate + COMMISSION.stripeFixedEur;
    return excludingVat - fees;
  }

  const rate = reduced ? COMMISSION.storeReduced : COMMISSION.storeStandard;
  return excludingVat * (1 - rate);
}

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
  /**
   * Par où le paiement passe. Absent tant que rien n'a été acheté : la période
   * d'essai n'appartient à aucun rail, elle est accordée par nous.
   */
  source?: BillingSource;
  /** Ids at the payment provider. Absent until the first checkout. */
  customerId?: string;
  subscriptionId?: string;
}

/* -------------------------------------------------- résilier, selon le rail */

/**
 * Peut-on résilier sans quitter l'application ?
 *
 * Non, dès que l'achat est passé par une boutique : Apple et Google ne
 * fournissent aucune API pour annuler un abonnement, c'est une décision qui
 * appartient au compte du client. Prétendre le contraire produit un bouton qui
 * échoue silencieusement — et une promesse de « résiliation en deux touches »
 * qui devient fausse.
 */
export function canCancelInApp(sub: Subscription | null): boolean {
  return !!sub && !isStore(sub.source);
}

/** Où envoyer quelqu'un qui veut résilier, selon d'où vient son abonnement. */
export function manageSubscriptionUrl(source: BillingSource | undefined): string | null {
  if (source === 'apple') return 'https://apps.apple.com/account/subscriptions';
  if (source === 'google') return 'https://play.google.com/store/account/subscriptions';
  return null;
}

/** Qui encaisse, et donc qui rembourse. À dire, pas à cacher. */
export function sellerOf(source: BillingSource | undefined): string {
  if (source === 'apple') return 'Apple';
  if (source === 'google') return 'Google';
  return 'Agence Wheb';
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

/** "9,99 € / mois" — the way it is shown on the plan cards. */
export function describePlan(plan: Plan): string {
  return plan === 'yearly'
    ? `${formatPrice(ANNUAL_PRICE_EUR)} / an`
    : `${formatPrice(MONTHLY_PRICE_EUR)} / mois`;
}

/** How much the annual plan saves, as a percentage of twelve monthly payments. */
export function annualSavingPercent(): number {
  return Math.round((1 - ANNUAL_PRICE_EUR / (MONTHLY_PRICE_EUR * 12)) * 100);
}

/**
 * Combien de mois l'abonnement annuel fait économiser, en mois de mensuel.
 *
 * Existe parce que la FAQ annonçait « deux mois offerts » quand la remise en
 * vaut quatre : 9,99 × 12 − 79,99 = 39,89 €. Se tromper à son propre désavantage
 * reste se tromper — et un chiffre écrit à la main dans un texte commercial
 * finit toujours par ne plus correspondre au prix. Celui-ci se recalcule.
 */
export function freeMonthsOnAnnual(): number {
  return Math.round((MONTHLY_PRICE_EUR * 12 - ANNUAL_PRICE_EUR) / MONTHLY_PRICE_EUR);
}
