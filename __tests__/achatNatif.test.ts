/**
 * L'achat dans l'application, sans téléphone.
 *
 * `StoreBillingService` existait depuis longtemps, avec ses essais, et
 * n'encaissait rien : la boutique qu'il attendait n'était implémentée nulle
 * part et `setNativeStore()` n'était appelé par personne. Ces essais portent
 * sur la pièce qui manquait — `ExpoIapStore` —, en lui substituant une fausse
 * boutique qui se comporte comme StoreKit et Play, y compris là où ils
 * surprennent.
 *
 * Ce qui ne peut pas être éprouvé ici, et qui reste à faire sur un vrai
 * appareil avec un compte de bac à sable : que la feuille de paiement s'ouvre.
 * Tout ce qui vient après, en revanche — la preuve rendue, la transaction
 * close, l'abandon distingué de l'échec —, se décide dans ce fichier.
 */

import { ExpoIapStore, ModuleIap, PRODUITS } from '@/services/billing/ExpoIapStore';
import { StoreBillingService } from '@/services/billing/StoreBillingService';
import { BillingService } from '@/services/billing/BillingService';
import { StorePurchase } from '@/services/billing/native';

const JETON = 'a1b2c3d4-1111-2222-3333-444455556666';

interface Journal {
  closes: string[];
  demandes: unknown[];
  connexions: number;
  restaurations: number;
}

/**
 * Une boutique en dur, aussi tordue que les vraies.
 *
 * `emet` et `echoue` laissent l'essai décider du moment où la transaction
 * arrive : c'est là qu'est toute la difficulté du vrai module, puisque
 * `requestPurchase` ne rend jamais le résultat.
 */
function fausseBoutique(options: {
  produits?: { id: string; displayPrice: string; price?: number | null; offre?: string }[];
  historique?: {
    id: string;
    productId: string;
    purchaseToken?: string | null;
    isAcknowledgedAndroid?: boolean | null;
  }[];
  /** Ce que fait la boutique quand la feuille de paiement s'ouvre. */
  surDemande?: (boutique: {
    emet: (achat: { id: string; productId: string; purchaseToken?: string | null }) => void;
    echoue: (code: string, message: string) => void;
  }) => void;
}) {
  const journal: Journal = { closes: [], demandes: [], connexions: 0, restaurations: 0 };
  const surAchat: ((achat: never) => void)[] = [];
  const surErreur: ((erreur: never) => void)[] = [];

  const emet = (achat: { id: string; productId: string; purchaseToken?: string | null }) => {
    for (const ecoute of [...surAchat]) (ecoute as (a: unknown) => void)(achat);
  };
  const echoue = (code: string, message: string) => {
    for (const ecoute of [...surErreur]) (ecoute as (e: unknown) => void)({ code, message });
  };

  const iap: ModuleIap = {
    async initConnection() {
      journal.connexions += 1;
      return true;
    },
    async fetchProducts({ skus }) {
      return (options.produits ?? [])
        .filter((p) => skus.includes(p.id))
        .map((p) => ({
          id: p.id,
          displayPrice: p.displayPrice,
          price: p.price,
          subscriptionOffers: p.offre ? [{ offerTokenAndroid: p.offre }] : null,
        }));
    },
    async requestPurchase(args) {
      journal.demandes.push(args);
      options.surDemande?.({ emet, echoue });
      return null;
    },
    async finishTransaction({ purchase }) {
      journal.closes.push(purchase.id);
      return true;
    },
    async getAvailablePurchases() {
      return (options.historique ?? []).map((a) => ({ ...a }));
    },
    async restorePurchases() {
      journal.restaurations += 1;
      return true;
    },
    purchaseUpdatedListener(ecoute) {
      surAchat.push(ecoute as never);
      return { remove: () => surAchat.splice(surAchat.indexOf(ecoute as never), 1) };
    },
    purchaseErrorListener(ecoute) {
      surErreur.push(ecoute as never);
      return { remove: () => surErreur.splice(surErreur.indexOf(ecoute as never), 1) };
    },
  };

  return { iap, journal, ecoutes: { surAchat, surErreur } };
}

const mensuel = { id: PRODUITS.monthly, displayPrice: '9,99 €', price: 9.99 };
const annuel = { id: PRODUITS.yearly, displayPrice: '79,99 €', price: 79.99 };

/* --------------------------------------------------------------- les prix */

describe('les formules viennent de la boutique', () => {
  it('rend le prix affiché par Apple, pas celui du code', async () => {
    // Le prix change avec le pays, la TVA et les paliers d'Apple. Celui du
    // dépôt sert aux CGV françaises ; celui de l'écran doit venir d'Apple.
    const { iap } = fausseBoutique({ produits: [mensuel, annuel] });
    const produits = await new ExpoIapStore('apple', async () => iap).products();

    expect(produits.map((p) => p.priceLabel)).toEqual(['9,99 €', '79,99 €']);
    expect(produits.map((p) => p.plan)).toEqual(['monthly', 'yearly']);
  });

  it('garde mensuel puis annuel quel que soit l’ordre de la boutique', async () => {
    const { iap } = fausseBoutique({ produits: [annuel, mensuel] });
    const produits = await new ExpoIapStore('apple', async () => iap).products();
    expect(produits.map((p) => p.plan)).toEqual(['monthly', 'yearly']);
  });

  it('omet une formule que la boutique ne vend pas encore', async () => {
    // Un produit en attente d'approbation n'est pas rendu par Apple. L'écran
    // ne doit alors pas le proposer plutôt que d'ouvrir une feuille qui échoue.
    const { iap } = fausseBoutique({ produits: [mensuel] });
    const produits = await new ExpoIapStore('apple', async () => iap).products();
    expect(produits).toHaveLength(1);
    expect(produits[0].plan).toBe('monthly');
  });

  it('se rabat sur le prix des CGV si la boutique ne rend qu’un libellé', async () => {
    const { iap } = fausseBoutique({
      produits: [{ ...mensuel, price: null }],
    });
    const produits = await new ExpoIapStore('apple', async () => iap).products();
    expect(produits[0].priceEur).toBe(9.9);
  });
});

/* ------------------------------------------------------------- le paiement */

describe('payer', () => {
  it('rend la preuve d’achat et clôt la transaction', async () => {
    const { iap, journal } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-1', productId: PRODUITS.monthly, purchaseToken: 'jws-signé' }),
    });

    const achat = await new ExpoIapStore('apple', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });

    expect(achat).toEqual({
      productId: PRODUITS.monthly,
      token: 'jws-signé',
      accountToken: JETON,
    });
    // Non close, Apple la rejoue à chaque lancement et Google rembourse au
    // bout de trois jours.
    expect(journal.closes).toEqual(['tx-1']);
  });

  it('refermer la feuille de paiement n’est pas une erreur', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ echoue }) => echoue('user-cancelled', 'Annulé'),
    });

    const achat = await new ExpoIapStore('apple', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });

    // `null` et non une exception : `StoreBillingService` en fait « abandonné »,
    // et personne n'affiche d'écran rouge à quelqu'un qui a seulement hésité.
    expect(achat).toBeNull();
  });

  it('lève quand la boutique refuse pour de bon', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ echoue }) => echoue('network-error', 'Pas de réseau'),
    });

    await expect(
      new ExpoIapStore('apple', async () => iap).purchase({
        productId: PRODUITS.monthly,
        accountToken: JETON,
      }),
    ).rejects.toThrow('Pas de réseau');
  });

  it('clôt une transaction rejouée sans la confondre avec la nôtre', async () => {
    // StoreKit rejoue à chaque connexion tout ce qui n'a pas été clos. Prendre
    // la première transaction venue reviendrait à confirmer un vieil achat
    // annuel au parent qui vient de payer au mois.
    const { iap, journal } = fausseBoutique({
      produits: [mensuel, annuel],
      surDemande: ({ emet }) => {
        emet({ id: 'tx-vieille', productId: PRODUITS.yearly, purchaseToken: 'vieux-jws' });
        emet({ id: 'tx-2', productId: PRODUITS.monthly, purchaseToken: 'jws-signé' });
      },
    });

    const achat = await new ExpoIapStore('apple', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });

    expect(achat?.productId).toBe(PRODUITS.monthly);
    expect(achat?.token).toBe('jws-signé');
    // L'intruse est close elle aussi, sans quoi elle reviendrait sans fin.
    expect(journal.closes).toEqual(['tx-vieille', 'tx-2']);
  });

  it('n’envoie pas à Apple un jeton de compte qui n’est pas un UUID', async () => {
    // `storeAccountToken()` se rabat sur l'identifiant de famille quand elle ne
    // peut pas lire celui de la base. StoreKit rejette tout ce qui n'est pas un
    // UUID : envoyer `fam-abc` ferait échouer le paiement au lieu de le rendre
    // seulement plus difficile à rattacher.
    const { iap, journal } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-3', productId: PRODUITS.monthly, purchaseToken: 'jws' }),
    });

    const achat = await new ExpoIapStore('apple', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: 'fam-abc',
    });

    const demande = journal.demandes[0] as { request: { apple: { appAccountToken: unknown } } };
    expect(demande.request.apple.appAccountToken).toBeNull();
    expect(achat?.accountToken).toBeNull();
  });

  it('joint le jeton d’offre exigé par Play', async () => {
    // Sans lui, Google refuse la demande d'abonnement — l'erreur est une des
    // plus opaques de Play Billing.
    const { iap, journal } = fausseBoutique({
      produits: [{ ...mensuel, offre: 'offre-plan-base' }],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-4', productId: PRODUITS.monthly, purchaseToken: 'jeton-play' }),
    });

    await new ExpoIapStore('google', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });

    const demande = journal.demandes[0] as {
      request: { google: { subscriptionOffers: { offerToken: string }[] } };
    };
    expect(demande.request.google.subscriptionOffers).toEqual([
      { sku: PRODUITS.monthly, offerToken: 'offre-plan-base' },
    ]);
  });
});

/* ------------------------------------------------------------- la liaison */

describe('la liaison avec la boutique', () => {
  it('ne s’ouvre qu’une fois, même sur plusieurs appels', async () => {
    const { iap, journal } = fausseBoutique({ produits: [mensuel] });
    const boutique = new ExpoIapStore('apple', async () => iap);

    await Promise.all([boutique.products(), boutique.products(), boutique.products()]);
    expect(journal.connexions).toBe(1);
  });

  it('oublie une liaison ratée pour que le second essai reparte', async () => {
    // Gardée en mémoire, une liaison ratée fermerait la boutique jusqu'au
    // redémarrage de l'application — pour une coupure de réseau de dix
    // secondes.
    let tentatives = 0;
    const { iap } = fausseBoutique({ produits: [mensuel] });
    const boutique = new ExpoIapStore('apple', async () => {
      tentatives += 1;
      if (tentatives === 1) throw new Error('StoreKit indisponible');
      return iap;
    });

    await expect(boutique.products()).rejects.toThrow('StoreKit indisponible');
    await expect(boutique.products()).resolves.toHaveLength(1);
    expect(tentatives).toBe(2);
  });

  it('acquitte à l’ouverture ce que Google rembourserait dans trois jours', async () => {
    // Le cas : l'application est tuée entre le paiement et l'acquittement. Le
    // parent a payé, le serveur a accordé l'abonnement par la notification
    // serveur à serveur, et Google rembourse quand même le surlendemain.
    const { iap, journal } = fausseBoutique({
      produits: [mensuel],
      historique: [
        { id: 'tx-oubliée', productId: PRODUITS.monthly, isAcknowledgedAndroid: false },
        { id: 'tx-déjà-vue', productId: PRODUITS.yearly, isAcknowledgedAndroid: true },
      ],
    });

    await new ExpoIapStore('google', async () => iap).products();
    expect(journal.closes).toEqual(['tx-oubliée']);
  });
});

/* ----------------------------------------------------------- la restauration */

describe('restaurer', () => {
  it('rend les preuves de l’historique, sans jeton de compte', async () => {
    const { iap, journal } = fausseBoutique({
      historique: [
        { id: 'tx-5', productId: PRODUITS.yearly, purchaseToken: 'jws-annuel' },
        // Sans preuve, il n'y a rien à faire vérifier au serveur.
        { id: 'tx-6', productId: PRODUITS.monthly, purchaseToken: null },
      ],
    });

    const preuves = await new ExpoIapStore('apple', async () => iap).restore();

    expect(journal.restaurations).toBe(1);
    expect(preuves).toEqual([
      { productId: PRODUITS.yearly, token: 'jws-annuel', accountToken: null },
    ]);
  });
});

/* ------------------------------------- la boutique branchée sur le service */

describe('branchée sur StoreBillingService', () => {
  const serveur = {
    name: 'faux',
    capability: 'stripe-web',
    getSubscription: async () => null,
    startCheckout: async () => ({ kind: 'failed' as const, reason: 'jamais' }),
    openPortal: async () => ({ url: '' }),
    listReferrals: async () => [],
    redeemReferralCode: async () => ({ ok: false }),
  } as unknown as BillingService;

  it('paie la bonne formule et transmet la preuve au serveur', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel, annuel],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-7', productId: PRODUITS.yearly, purchaseToken: 'jws-annuel' }),
    });

    const recues: unknown[] = [];
    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async (input) => {
        recues.push(input);
        return null;
      },
      async () => JETON,
    );

    const issue = await service.startCheckout({ familyId: 'fam-1', plan: 'yearly' });

    expect(issue).toEqual({ kind: 'done' });
    expect(recues).toEqual([
      { familyId: 'fam-1', platform: 'apple', token: 'jws-annuel', productId: PRODUITS.yearly },
    ]);
  });

  it('traduit l’abandon sans écran d’erreur', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ echoue }) => echoue('user-cancelled', 'Annulé'),
    });

    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async () => null,
      async () => JETON,
    );

    expect(await service.startCheckout({ familyId: 'fam-1', plan: 'monthly' })).toEqual({
      kind: 'abandoned',
    });
  });

  it('renvoie vers les réglages du téléphone pour résilier', async () => {
    const { iap } = fausseBoutique({});
    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async () => null,
      async () => JETON,
    );

    // Ni Apple ni Google n'exposent d'API d'annulation : un bouton « résilier »
    // dans l'application serait un bouton qui ment. Le contrat le prévoit —
    // `cancel` y est facultatif —, et TypeScript sait déjà qu'il est absent
    // ici ; on le vérifie tout de même à l'exécution, puisque c'est la seule
    // chose qui protège l'écran d'abonnement.
    const vu = service as BillingService;
    expect(vu.cancel).toBeUndefined();
    expect((await vu.openPortal('fam-1')).url).toContain('apple.com');
  });

  it('restaure et fait revérifier chaque preuve', async () => {
    const { iap } = fausseBoutique({
      historique: [{ id: 'tx-8', productId: PRODUITS.monthly, purchaseToken: 'jws-mensuel' }],
    });

    const recues: { token: string }[] = [];
    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async (input) => {
        recues.push(input);
        return null;
      },
      async () => JETON,
    );

    expect(await service.restore('fam-1')).toEqual({ kind: 'done' });
    expect(recues.map((r) => r.token)).toEqual(['jws-mensuel']);
  });

  it('dit franchement qu’il n’y a rien à restaurer', async () => {
    const { iap } = fausseBoutique({ historique: [] });
    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async () => null,
      async () => JETON,
    );

    const issue = await service.restore('fam-1');
    expect(issue).toEqual({ kind: 'failed', reason: 'Aucun achat à restaurer sur ce compte.' });
  });
});

/* ------------------------------------------------------------- le contrat */

describe('ce que la boutique ne fait jamais', () => {
  it('ne rend aucun état d’abonnement', async () => {
    // La tentation, et l'erreur, serait de croire le téléphone sur parole : un
    // client qui peut s'accorder un abonnement est un client à qui on
    // demandera de le faire. Rien de ce que rend cette classe ne dit « abonné ».
    const { iap } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-9', productId: PRODUITS.monthly, purchaseToken: 'jws' }),
    });

    const achat: StorePurchase | null = await new ExpoIapStore('apple', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });

    expect(Object.keys(achat ?? {}).sort()).toEqual(['accountToken', 'productId', 'token']);
  });

  it('garde dans les identifiants les mots dont le serveur déduit la formule', () => {
    // `planOfProduct` cherche `month` et `yearly`/`annual` dans l'identifiant.
    // Les renommer donnerait un abonnement sans formule, et une facture qu'on
    // ne sait plus rattacher.
    expect(PRODUITS.monthly).toContain('month');
    expect(PRODUITS.yearly).toMatch(/yearly|annual/);
  });
});
