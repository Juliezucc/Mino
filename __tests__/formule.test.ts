import { Subscription } from '@/domain/billing';
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
