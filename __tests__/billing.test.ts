import {
  MONTHLY_PRICE_EUR,
  REFERRAL,
  Referral,
  Subscription,
  accessOf,
  addMonths,
  annualSavingPercent,
  applyFreeMonths,
  canCancelInApp,
  canUseReferralCode,
  creditedMonthsInYear,
  hasAccess,
  manageSubscriptionUrl,
  netOf,
  qualifyReferral,
  sellerOf,
  startTrial,
} from '@/domain/billing';

const NOW = new Date('2026-08-20T10:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

const active = (over: Partial<Subscription> = {}): Subscription => ({
  familyId: 'f1',
  status: 'active',
  plan: 'monthly',
  trialEndsAt: null,
  currentPeriodEnd: days(12),
  cancelAtPeriodEnd: false,
  creditMonths: 0,
  ...over,
});

const referral = (over: Partial<Referral> = {}): Referral => ({
  id: 'r1',
  code: 'AB12CD',
  referrerFamilyId: 'f1',
  refereeFamilyId: 'f2',
  status: 'pending',
  createdAt: days(-10),
  ...over,
});

describe('access', () => {
  it('runs for the whole trial and stops at its end', () => {
    const sub = startTrial('f1', NOW);
    expect(accessOf(sub, NOW)).toEqual({ kind: 'trial', daysLeft: 30 });
    expect(accessOf(sub, new Date(days(29)))).toEqual({ kind: 'trial', daysLeft: 1 });
    expect(accessOf(sub, new Date(days(31)))).toEqual({ kind: 'expired' });
  });

  it('keeps a cancelled subscription running until the period ends', () => {
    const sub = active({ cancelAtPeriodEnd: true });
    expect(accessOf(sub, NOW)).toEqual({
      kind: 'active',
      renewsOn: sub.currentPeriodEnd,
      cancelAtPeriodEnd: true,
    });
    expect(hasAccess(sub, new Date(days(13)))).toBe(false);
  });

  it('does not cut a family off while a payment is being retried', () => {
    expect(accessOf(active({ status: 'past_due' }), NOW)).toEqual({
      kind: 'grace',
      reason: 'past_due',
    });
  });

  it('treats no subscription at all as expired', () => {
    expect(accessOf(null, NOW)).toEqual({ kind: 'expired' });
  });
});

describe('adding months', () => {
  it('clamps the day instead of spilling into the next month', () => {
    expect(addMonths('2026-01-31T00:00:00.000Z', 1).slice(0, 10)).toBe('2026-02-28');
    expect(addMonths('2028-01-31T00:00:00.000Z', 1).slice(0, 10)).toBe('2028-02-29');
    expect(addMonths('2026-08-20T00:00:00.000Z', 12).slice(0, 10)).toBe('2027-08-20');
  });

  it('extends the trial when the family is still trialing', () => {
    const sub = startTrial('f1', NOW);
    const next = applyFreeMonths(sub, 1);
    expect(next.trialEndsAt).toBe(addMonths(sub.trialEndsAt!, 1));
    expect(next.creditMonths).toBe(0);
  });

  it('pushes the next payment back when the family is paying', () => {
    const sub = active();
    const next = applyFreeMonths(sub, 2);
    expect(next.currentPeriodEnd).toBe(addMonths(sub.currentPeriodEnd!, 2));
  });

  it('banks the month when there is no period to push', () => {
    const sub = active({ status: 'canceled', currentPeriodEnd: null });
    expect(applyFreeMonths(sub, 1).creditMonths).toBe(1);
  });
});

describe('referral', () => {
  it('refuses a self-referral', () => {
    const check = canUseReferralCode([], {
      code: 'AB12CD',
      referrerFamilyId: 'f1',
      refereeFamilyId: 'f1',
    });
    expect(check.ok).toBe(false);
  });

  it('refuses an unknown code', () => {
    expect(
      canUseReferralCode([], { code: 'NOPE12', referrerFamilyId: null, refereeFamilyId: 'f2' }).ok,
    ).toBe(false);
  });

  it('refuses a family that has already been referred', () => {
    const existing = [referral({ status: 'credited' })];
    expect(
      canUseReferralCode(existing, {
        code: 'AB12CD',
        referrerFamilyId: 'f3',
        refereeFamilyId: 'f2',
      }).ok,
    ).toBe(false);
  });

  it('accepts a genuine one', () => {
    expect(
      canUseReferralCode([], { code: 'AB12CD', referrerFamilyId: 'f1', refereeFamilyId: 'f2' }).ok,
    ).toBe(true);
  });

  it('only credits the referrer once the referee pays', () => {
    const pending = [referral()];
    expect(creditedMonthsInYear(pending, 'f1', NOW)).toBe(0);

    const { referrals, creditedFamilyId } = qualifyReferral(pending, 'r1', NOW);
    expect(referrals[0].status).toBe('credited');
    expect(creditedFamilyId).toBe('f1');
    expect(creditedMonthsInYear(referrals, 'f1', NOW)).toBe(REFERRAL.referrerFreeMonths);
  });

  it('stops crediting past the yearly cap, without losing the referral', () => {
    const maxed = Array.from({ length: REFERRAL.maxFreeMonthsPerYear }, (_, i) =>
      referral({
        id: `cap${i}`,
        refereeFamilyId: `f${i + 10}`,
        status: 'credited',
        creditedAt: days(-30),
      }),
    );
    const { referrals, creditedFamilyId } = qualifyReferral([...maxed, referral()], 'r1', NOW);

    expect(creditedFamilyId).toBeNull();
    // Recorded as earned, so it can still be honoured once the year rolls over.
    expect(referrals.find((r) => r.id === 'r1')!.status).toBe('qualified');
  });

  it('forgets credits older than a year', () => {
    const old = [referral({ status: 'credited', creditedAt: days(-400) })];
    expect(creditedMonthsInYear(old, 'f1', NOW)).toBe(0);
  });

  it('does nothing to a referral that is not pending', () => {
    const done = [referral({ status: 'credited', creditedAt: days(-1) })];
    expect(qualifyReferral(done, 'r1', NOW).creditedFamilyId).toBeNull();
  });
});

describe('pricing', () => {
  it('the annual plan really is cheaper', () => {
    expect(annualSavingPercent()).toBeGreaterThan(0);
    expect(annualSavingPercent()).toBeLessThan(100);
  });
});

/**
 * Les deux rails.
 *
 * Dans l'application, Apple et Google exigent leur propre système de paiement ;
 * sur le web, Stripe. Un seul abonnement des deux côtés — mais trois choses
 * changent selon le rail, et l'utilisateur les voit toutes les trois.
 */
describe('achat natif et achat web', () => {
  it('interdit de résilier dans l’app un abonnement acheté dans une boutique', () => {
    // Apple et Google ne fournissent aucune API d'annulation : afficher le
    // bouton produirait un échec silencieux.
    const store = { ...startTrial('f1'), status: 'active' as const, source: 'apple' as const };
    const web = { ...startTrial('f1'), status: 'active' as const, source: 'stripe' as const };

    expect(canCancelInApp(store)).toBe(false);
    expect(canCancelInApp(web)).toBe(true);
  });

  it('envoie chacun là où sa résiliation existe vraiment', () => {
    expect(manageSubscriptionUrl('apple')).toContain('apple.com/account/subscriptions');
    expect(manageSubscriptionUrl('google')).toContain('play.google.com/store/account/subscriptions');
    expect(manageSubscriptionUrl('stripe')).toBeNull();
  });

  it('nomme le vendeur, qui n’est pas toujours nous', () => {
    // Ce qui décide aussi de qui rembourse — et les CGV doivent le dire.
    expect(sellerOf('apple')).toBe('Apple');
    expect(sellerOf('stripe')).toBe('Agence Wheb');
  });

  it('compare les rails sur la même assiette', () => {
    // Une commission de boutique porte sur le prix hors taxes ; les frais
    // Stripe sur le montant encaissé. Comparer les bruts se trompe d'environ
    // un cinquième, ce qui est exactement l'ordre de grandeur de la décision.
    const stripe = netOf(MONTHLY_PRICE_EUR, 'stripe');
    const store = netOf(MONTHLY_PRICE_EUR, 'apple');

    expect(stripe).toBeCloseTo(7.85, 2);
    expect(store).toBeCloseTo(7.01, 2);
  });

  it('chiffre ce que coûte le passage d’Apple à 30 %', () => {
    const reduit = netOf(MONTHLY_PRICE_EUR, 'apple');
    const plein = netOf(MONTHLY_PRICE_EUR, 'apple', { reduced: false });

    expect(plein).toBeCloseTo(5.775, 3);
    // Le seuil du programme Small Business vaut donc un cinquième du revenu.
    expect(plein / reduit).toBeCloseTo(0.82, 2);
  });

  it('garde la période d’essai en dehors des deux rails', () => {
    // L'essai est accordé par nous, pas par une boutique : c'est ce qui permet
    // aux 60 jours du parrainage d'exister sans dépendre d'Apple.
    expect(startTrial('f1').source).toBeUndefined();
  });
});
