import { readFileSync } from 'node:fs';

import {
  MONTHLY_PRICE_EUR,
  TRIAL_DAYS,
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
import * as actions from '@/domain/actions';
import { isLocked } from '@/domain/access';
import { buildDemoFamily } from '@/data/demo';
import { balanceOf } from '@/domain/ledger';

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
    const nu = { plan: null, firstChargeOn: sub.trialEndsAt };
    expect(accessOf(sub, NOW)).toEqual({ kind: 'trial', daysLeft: 30, ...nu });
    expect(accessOf(sub, new Date(days(29)))).toEqual({ kind: 'trial', daysLeft: 1, ...nu });
    expect(accessOf(sub, new Date(days(31)))).toEqual({ kind: 'expired' });
  });

  /**
   * L'essai engagé, c'est-à-dire payé mais pas encore prélevé — l'état de toute
   * famille qui vient de s'abonner, puisque la session Stripe porte un
   * `trial_period_days`. L'accès est le même que pendant un essai nu ; ce qu'il
   * faut dire au parent est l'inverse, et sans `plan` rien ne les distinguait.
   */
  it('distinguishes a trial with a card on file from a bare trial', () => {
    const nu = startTrial('f1', NOW);
    const engage = { ...nu, plan: 'yearly' as const, source: 'stripe' as const };

    const a = accessOf(nu, NOW);
    const b = accessOf(engage, NOW);

    expect(a.kind).toBe('trial');
    expect(b.kind).toBe('trial');
    expect(a.kind === 'trial' && a.plan).toBe(null);
    expect(b.kind === 'trial' && b.plan).toBe('yearly');
    // Le jour du premier prélèvement est la fin de l'essai, pas autre chose.
    expect(b.kind === 'trial' && b.firstChargeOn).toBe(nu.trialEndsAt);
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

  /**
   * Un essai sans date de fin est un accès fermé — et c'est un piège.
   *
   * `accessOf` calcule les jours restants à partir de `trialEndsAt` : une date
   * absente vaut zéro jour, donc « expiré ». Tout code qui écrit `trialing`
   * sans écrire la date enferme donc dehors une famille qui vient de payer,
   * sans qu'aucune erreur n'apparaisse nulle part — la transaction est valide,
   * la ligne est écrite, et le verrou tombe quand même.
   *
   * C'est exactement le piège qu'a tendu l'arrivée des essais Apple, où la
   * fonction qui enregistre un achat de boutique n'écrivait que
   * `current_period_end`.
   */
  it('ferme l’accès d’un essai qui n’a pas de date de fin', () => {
    const sansDate = { ...startTrial('f1', NOW), trialEndsAt: null };
    expect(accessOf(sansDate, NOW)).toEqual({ kind: 'expired' });
  });

  it('treats no subscription at all as expired', () => {
    expect(accessOf(null, NOW)).toEqual({ kind: 'expired' });
  });

  /**
   * « Expiré » et « pas encore lu » se ressemblent, et les confondre coûte
   * cher aux deux bouts.
   *
   * `accessOf(null)` rend « expiré » parce qu'il faut bien rendre quelque
   * chose. Mais `null` ne dit pas « terminé », il dit « on ne sait pas
   * encore ». `isLocked` le sait depuis toujours et laisse passer dans le
   * doute — ce test l'atteste, et il explique pourquoi un parent pouvait créer
   * une mission pendant que son accueil lui annonçait la fin de son essai.
   *
   * Les écrans, eux, avaient hérité de la valeur sans la nuance : le bandeau
   * annonçait la fin d'un essai qui venait de commencer, et le paywall en
   * concluait que la famille était déjà servie — il s'effaçait, et personne ne
   * voyait jamais le prix.
   */
  it('ne verrouille pas une famille dont on ignore l’abonnement', () => {
    expect(accessOf(null, NOW)).toEqual({ kind: 'expired' });
    expect(isLocked(null, 'confirm', NOW)).toBe(false);
    expect(isLocked(null, 'mission.write', NOW)).toBe(false);
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

    /**
     * Ce qui est vérifié ici, ce sont des **rapports**, pas des montants.
     *
     * Ces trois assertions portaient 7,85 et 7,01 en dur. Le jour où la grille
     * d'Apple a imposé 9,99 au lieu de 9,90, elles ont échoué toutes les trois
     * alors que rien de ce qu'elles vérifient n'avait bougé — et recopier la
     * formule de `netOf` dans le test n'aurait rien vérifié du tout, puisque
     * c'est elle qu'on teste.
     *
     * Restent les deux faits qui décident : les deux rails laissent moins que
     * le prix hors taxes, et la boutique laisse environ un neuvième de moins
     * que Stripe. C'est ce rapport-là, et lui seul, qui a fait choisir
     * l'achat natif malgré son coût.
     */
    const horsTaxes = MONTHLY_PRICE_EUR / 1.2;
    expect(stripe).toBeLessThan(horsTaxes);
    expect(store).toBeLessThan(stripe);
    expect(store / stripe).toBeCloseTo(0.89, 2);
  });

  it('chiffre ce que coûte le passage d’Apple à 30 %', () => {
    const reduit = netOf(MONTHLY_PRICE_EUR, 'apple');
    const plein = netOf(MONTHLY_PRICE_EUR, 'apple', { reduced: false });

    expect(plein).toBeCloseTo((MONTHLY_PRICE_EUR / 1.2) * 0.7, 3);
    // Le seuil du programme Small Business vaut donc un cinquième du revenu.
    expect(plein / reduit).toBeCloseTo(0.82, 2);
  });

  it('garde la période d’essai en dehors des deux rails', () => {
    // L'essai est ouvert par nous, avant tout achat, et n'appartient donc à
    // aucun rail : c'est ce qui le rend identique quelle que soit la boutique.
    expect(startTrial('f1').source).toBeUndefined();
  });
});

describe('ce qui s’arrête quand plus personne ne paie', () => {
  const jour = 24 * 60 * 60 * 1000;
  const maintenant = new Date('2026-08-20T09:00:00.000Z');

  const essai = (joursRestants: number): Subscription => ({
    ...startTrial('fam-1', maintenant),
    trialEndsAt: new Date(maintenant.getTime() + joursRestants * jour).toISOString(),
  });

  it('ne verrouille rien pendant l’essai', () => {
    expect(isLocked(essai(3), 'confirm', maintenant)).toBe(false);
  });

  it('verrouille la main du parent une fois l’essai fini', () => {
    const fini = essai(-1);
    for (const action of ['confirm', 'mission.write', 'child.write', 'grant', 'other-screen'] as const) {
      expect(isLocked(fini, action, maintenant)).toBe(true);
    }
  });

  it('ne verrouille pas un prélèvement qui a échoué', () => {
    // Une carte expirée n'est pas une famille qui part : couper au premier
    // échec ferait perdre des familles qui voulaient rester.
    const impaye: Subscription = { ...essai(-1), status: 'past_due' };
    expect(isLocked(impaye, 'confirm', maintenant)).toBe(false);
  });

  it('ne verrouille pas quand l’abonnement est inconnu', () => {
    // `null`, c'est « la facturation n'a pas encore répondu » aussi bien que
    // « elle ne répond pas ». Verrouiller sur cette ignorance met dehors une
    // famille qui paie parce que son train est passé sous un tunnel.
    expect(isLocked(null, 'confirm', maintenant)).toBe(false);
  });

  it('laisse une mission déclarée par l’enfant attendre au lieu de se compter', () => {
    // L'enfant ne rencontre jamais de mur : la mission qui se comptait toute
    // seule redevient une mission ordinaire, et les minutes l'attendent.
    const base = buildDemoFamily(maintenant);
    const auto = base.missions.find((m) => m.autoApprove)!;
    const enfant = base.assignments.find((a) => a.missionId === auto.id)!.childId;

    const ouvert = actions.completeMission(
      base,
      { childId: enfant, missionId: auto.id, autoApproveAllowed: true },
      new Date('2026-08-21T09:00:00.000Z'),
    );
    expect(ouvert.completion.status).toBe('approved');
    expect(ouvert.transaction).toBeDefined();

    const ferme = actions.completeMission(
      base,
      { childId: enfant, missionId: auto.id, autoApproveAllowed: false },
      new Date('2026-08-21T09:00:00.000Z'),
    );
    expect(ferme.completion.status).toBe('pending');
    expect(ferme.transaction).toBeUndefined();
    expect(ferme.completion.minutesAwarded).toBe(0);
  });

  it('ne touche jamais aux minutes déjà gagnées', () => {
    const base = buildDemoFamily(maintenant);
    const noah = base.children[0];
    const avant = balanceOf(base.transactions, noah.id);
    // Rien dans le verrou n'écrit au registre : c'est une règle de lecture.
    expect(isLocked(essai(-1), 'confirm', maintenant)).toBe(true);
    expect(balanceOf(base.transactions, noah.id)).toBe(avant);
  });
});

/**
 * Les trente jours sont écrits deux fois, et doivent le rester ensemble.
 *
 * `TRIAL_DAYS` décide de ce que l'application affiche ; `supabase/essai.sql`
 * décide de ce qui est vrai. Deux nombres qui doivent être égaux et qui vivent
 * dans deux fichiers finissent toujours par diverger — et celui-là divergerait
 * en silence, puisque l'écran annoncerait une durée que la base ne tient pas.
 */
describe('l’essai, des deux côtés', () => {
  it('dure le même nombre de jours en base et dans le domaine', () => {
    const sql = readFileSync('supabase/essai.sql', 'utf8');
    expect(sql).toContain(`interval '${TRIAL_DAYS} days'`);
  });

  it('démarre à la création de la famille, et par un déclencheur', () => {
    const sql = readFileSync('supabase/essai.sql', 'utf8');
    // `security definer` : la table n'a aucune politique d'écriture, et c'est
    // la seule façon d'y écrire sans en ouvrir une.
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/after insert on families/);
    expect(sql).toContain("'trialing'");
  });
});
