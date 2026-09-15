import { BillingService } from '@/services/billing/BillingService';
import { NativeStore, StorePurchase } from '@/services/billing/native';
import { StoreBillingService } from '@/services/billing/StoreBillingService';

/**
 * « Restaurer mes achats », et les quatre façons de mentir au parent.
 *
 * **Le déclencheur : Julie, sur son propre iPhone.** Elle touche le bouton et
 * lit un message d'erreur. Impossible de savoir lequel des quatre, parce que
 * trois d'entre eux se ressemblent à l'écran et qu'un seul dit la vérité.
 *
 * Ce fichier tient les quatre sorties distinctes :
 *
 *   1. la boutique tombe en panne → on le dit, on n'accuse pas son compte ;
 *   2. la boutique répond une liste vide → là, et là seulement, « aucun achat
 *      à restaurer sur ce compte » ;
 *   3. le serveur refuse pour de bon → c'est ce refus-là qu'il faut lire, même
 *      si une autre transaction a échoué après lui, plus banalement ;
 *   4. tout se passe bien → il faut le dire aussi.
 */
const SERVEUR = {
  name: 'faux',
  capability: 'stripe-web',
  getSubscription: async () => null,
  startCheckout: async () => ({ kind: 'failed' as const, reason: 'jamais' }),
  openPortal: async () => ({ url: '' }),
  listReferrals: async () => [],
  redeemReferralCode: async () => ({ ok: false }),
} as unknown as BillingService;

const ABONNEMENT = { familyId: 'fam-1', plan: 'monthly', status: 'active' } as never;

function boutique(over: Partial<NativeStore> = {}): NativeStore {
  return {
    platform: 'apple',
    products: async () => [],
    purchase: async () => null,
    restore: async () => [],
    ...over,
  } as unknown as NativeStore;
}

const achat = (id: string): StorePurchase => ({
  productId: 'mino.monthly',
  token: `jws-${id}`,
  accountToken: null,
});

/** Ce que fabrique `echecDeLaFonction` : la raison, et si elle est sans appel. */
const echec = (message: string, status: number) =>
  Object.assign(new Error(message), {
    definitif: status >= 400 && status < 500 && status !== 429,
  });

describe('restaurer ses achats', () => {
  it('ne prend pas une panne de la boutique pour un compte vide', async () => {
    /**
     * **Le défaut.** `.catch(() => [])` avalait tout : le délai de liaison de
     * vingt secondes, un module absent, un `getAvailablePurchases` qui lève.
     * Le parent lisait « Aucun achat à restaurer sur ce compte » — c'est-à-dire
     * une affirmation fausse sur son compte Apple, qui l'envoie chercher un
     * second identifiant qui n'existe pas.
     */
    const service = new StoreBillingService(
      SERVEUR,
      boutique({
        restore: async () => {
          throw new Error('La boutique n’a pas répondu (ouverture).');
        },
      }),
      async () => ABONNEMENT,
      async () => 'jeton',
    );

    const issue = await service.restore('fam-1');

    expect(issue.kind).toBe('failed');
    expect((issue as { reason: string }).reason).toBe('La boutique n’a pas répondu (ouverture).');
    expect((issue as { reason: string }).reason).not.toMatch(/Aucun achat/);
  });

  it('… mais le dit quand la boutique répond vraiment « rien »', async () => {
    const service = new StoreBillingService(
      SERVEUR,
      boutique({ restore: async () => [] }),
      async () => ABONNEMENT,
      async () => 'jeton',
    );

    expect(await service.restore('fam-1')).toEqual({
      kind: 'failed',
      reason: 'Aucun achat à restaurer sur ce compte.',
    });
  });

  it('garde le refus sans appel plutôt que l’aléa qui le suit', async () => {
    /**
     * Apple rend parfois plusieurs transactions. `dit` était réaffecté à chaque
     * tour : un 502 passager, arrivé après un 403 définitif, effaçait le seul
     * message qui apprenait quelque chose au parent — et lui disait de
     * réessayer un refus qui dira la même chose dans un mois.
     */
    const reponses = [
      echec('Cet abonnement est déjà rattaché à un compte Mino.', 403),
      echec('Vérification impossible pour le moment.', 502),
    ];
    let tour = 0;

    const service = new StoreBillingService(
      SERVEUR,
      boutique({ restore: async () => [achat('a'), achat('b')] }),
      async () => {
        throw reponses[tour++];
      },
      async () => 'jeton',
    );

    const issue = await service.restore('fam-1');
    expect((issue as { reason: string }).reason).toMatch(/déjà rattaché/);
  });

  it('et le garde aussi quand il arrive en second', async () => {
    const reponses = [
      echec('Vérification impossible pour le moment.', 502),
      echec('Cet abonnement est déjà rattaché à un compte Mino.', 403),
    ];
    let tour = 0;

    const service = new StoreBillingService(
      SERVEUR,
      boutique({ restore: async () => [achat('a'), achat('b')] }),
      async () => {
        throw reponses[tour++];
      },
      async () => 'jeton',
    );

    expect(((await service.restore('fam-1')) as { reason: string }).reason).toMatch(/déjà rattaché/);
  });

  it('dit au serveur que c’est une restauration, pas un achat', async () => {
    /**
     * Le serveur en a besoin pour ne pas promettre ce qu'il ne peut pas tenir :
     * après un achat, la notification serveur à serveur rattrape ; après une
     * restauration, Apple n'en réémet aucune.
     */
    const recues: { geste?: string }[] = [];
    const service = new StoreBillingService(
      SERVEUR,
      boutique({ restore: async () => [achat('a')] }),
      async (input) => {
        recues.push(input);
        return ABONNEMENT;
      },
      async () => 'jeton',
    );

    await service.restore('fam-1');
    expect(recues).toHaveLength(1);
    expect(recues[0].geste).toBe('restauration');
  });

  it('rend « done » quand le serveur a confirmé', async () => {
    const service = new StoreBillingService(
      SERVEUR,
      boutique({ restore: async () => [achat('a')] }),
      async () => ABONNEMENT,
      async () => 'jeton',
    );

    expect(await service.restore('fam-1')).toEqual({ kind: 'done' });
  });

  it('n’invente pas un succès quand le serveur n’a rien rendu', async () => {
    const service = new StoreBillingService(
      SERVEUR,
      boutique({ restore: async () => [achat('a')] }),
      async () => null,
      async () => 'jeton',
    );

    const issue = await service.restore('fam-1');
    expect(issue.kind).toBe('failed');
    expect((issue as { reason: string }).reason).toMatch(/retrouvé/);
  });
});
