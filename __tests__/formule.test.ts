import { STRIPE_MIN_TRIAL_MS, Subscription, trialEndForCheckout } from '@/domain/billing';
import { LocalBillingService } from '@/services/billing/LocalBillingService';

/**
 * Changer de formule ne doit JAMAIS revenir à en acheter une seconde.
 *
 * C'est la règle que ce fichier garde, et elle a une histoire : le seul chemin
 * vers l'annuel passait par le sélecteur de formules, qui appelle
 * `startCheckout`. Or `startCheckout` ouvre un abonnement neuf — la famille
 * finissait donc avec deux abonnements courants et deux prélèvements, sans que
 * rien à l'écran ne le laisse deviner. `changePlan` remplace au lieu d'ajouter.
 *
 * La distinction se mesure sur `subscriptionId` : celui qui court doit être le
 * même avant et après.
 */

const abonne = (over: Partial<Subscription> = {}): Subscription => ({
  familyId: 'f1',
  status: 'trialing',
  plan: 'monthly',
  trialEndsAt: '2026-10-09T00:00:00.000Z',
  currentPeriodEnd: '2026-10-09T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  creditMonths: 0,
  source: 'stripe',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  ...over,
});

describe('changer de formule', () => {
  it('remplace la formule sans toucher à l’abonnement en cours', async () => {
    const service = new LocalBillingService();
    service.set(abonne());

    const apres = await service.changePlan({ familyId: 'f1', plan: 'yearly' });

    expect(apres.plan).toBe('yearly');
    // Le même abonnement, chez le même client : rien n'a été ouvert à côté.
    expect(apres.subscriptionId).toBe('sub_1');
    expect(apres.customerId).toBe('cus_1');
  });

  it('ne déplace ni la fin d’essai ni la période payée', async () => {
    const service = new LocalBillingService();
    const avant = abonne();
    service.set(avant);

    const apres = await service.changePlan({ familyId: 'f1', plan: 'yearly' });

    // Rien n'est prélevé aujourd'hui, et la date du premier prélèvement ne
    // bouge pas : seul le montant de ce jour-là change. C'est ce qu'on promet
    // au parent avant qu'il ne confirme, et ce que Stripe fait avec
    // `proration_behavior: 'none'`.
    expect(apres.trialEndsAt).toBe(avant.trialEndsAt);
    expect(apres.currentPeriodEnd).toBe(avant.currentPeriodEnd);
    expect(apres.status).toBe('trialing');
  });

  it('revient au mensuel de la même façon', async () => {
    const service = new LocalBillingService();
    service.set(abonne({ plan: 'yearly' }));

    const apres = await service.changePlan({ familyId: 'f1', plan: 'monthly' });

    expect(apres.plan).toBe('monthly');
    expect(apres.subscriptionId).toBe('sub_1');
  });
});

/**
 * L'essai appartient à Mino, pas au rail qui encaisse.
 *
 * Le paiement demandait à Stripe un décompte NEUF de trente jours, sans
 * regarder celui que la famille avait déjà entamé. S'abonner au 25ᵉ jour
 * donnait donc cinquante-cinq jours gratuits ; un filleul, qui en a déjà
 * soixante, en obtenait cent vingt. C'est le cumul que nos propres notes
 * interdisent de créer chez Apple, et que le code faisait chez Stripe.
 *
 * Rien ne pouvait le trahir à l'écran : l'application affiche la date que
 * Stripe lui renvoie, donc elle annonçait fidèlement une date fausse.
 */
describe('la fin d’essai envoyée à Stripe', () => {
  const MAINTENANT = new Date('2026-09-09T12:00:00.000Z');
  const dans = (jours: number) =>
    new Date(MAINTENANT.getTime() + jours * 24 * 60 * 60 * 1000).toISOString();

  it('reprend l’essai en cours au lieu d’en ouvrir un second', () => {
    // Un parent au 25e jour de ses trente : il lui en reste cinq, pas trente.
    const fin = trialEndForCheckout(
      { trialEndsAt: dans(5), hasPaidBefore: false },
      MAINTENANT,
    );
    expect(fin?.toISOString()).toBe(dans(5));
  });

  it('n’ajoute rien à un essai déjà long', () => {
    // La durée qui court est écrite dans `trial_ends_at` : la redemander ici
    // la doublerait. Le cas s'est produit avec les soixante jours qu'un
    // filleul recevait autrefois — cent vingt jours gratuits.
    const fin = trialEndForCheckout(
      { trialEndsAt: dans(60), hasPaidBefore: false },
      MAINTENANT,
    );
    expect(fin?.toISOString()).toBe(dans(60));
  });

  it('facture tout de suite une famille qui a déjà payé une fois', () => {
    // Résilier puis revenir ne rouvre pas un essai.
    expect(
      trialEndForCheckout({ trialEndsAt: dans(20), hasPaidBefore: true }, MAINTENANT),
    ).toBeNull();
  });

  it('facture tout de suite quand l’essai est fini', () => {
    expect(
      trialEndForCheckout({ trialEndsAt: dans(-1), hasPaidBefore: false }, MAINTENANT),
    ).toBeNull();
  });

  it('renonce à l’essai plutôt que de faire échouer le paiement sous 48 h', () => {
    // Stripe refuse une fin d'essai trop proche. Un paiement rejeté à
    // l'instant où le parent a décidé de payer coûte infiniment plus cher que
    // les quelques heures d'essai qu'on abandonne ici.
    const trop = new Date(MAINTENANT.getTime() + STRIPE_MIN_TRIAL_MS - 1000).toISOString();
    expect(trialEndForCheckout({ trialEndsAt: trop, hasPaidBefore: false }, MAINTENANT)).toBeNull();

    const juste = new Date(MAINTENANT.getTime() + STRIPE_MIN_TRIAL_MS + 1000).toISOString();
    expect(
      trialEndForCheckout({ trialEndsAt: juste, hasPaidBefore: false }, MAINTENANT),
    ).not.toBeNull();
  });

  it('facture tout de suite quand aucune date n’est connue', () => {
    expect(trialEndForCheckout({ trialEndsAt: null, hasPaidBefore: false }, MAINTENANT)).toBeNull();
  });
});
