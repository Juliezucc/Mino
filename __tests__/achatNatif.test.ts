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

import { MONTHLY_PRICE_EUR, Subscription } from '@/domain/billing';
import { ExpoIapStore, ModuleIap, PRODUITS } from '@/services/billing/ExpoIapStore';
import { StoreBillingService } from '@/services/billing/StoreBillingService';
import { BillingService } from '@/services/billing/BillingService';
import { StorePurchase } from '@/services/billing/native';

const JETON = 'a1b2c3d4-1111-2222-3333-444455556666';

/** Ce que le serveur rend quand il a bien vérifié une preuve. */
const ABONNEMENT: Subscription = {
  familyId: 'fam-1',
  status: 'active',
  plan: 'monthly',
  trialEndsAt: null,
  currentPeriodEnd: '2026-10-08T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  creditMonths: 0,
};

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
 * arrive : c'est là qu'est toute la difficulté du vrai module. Et `surDemande`
 * peut aussi rendre l'achat — les vraies liaisons font parfois l'un, parfois
 * l'autre, et croire que seul l'écouteur parle est ce qui a produit un bouton
 * qui tourne sans fin sur un vrai iPhone.
 */
function fausseBoutique(options: {
  produits?: {
    id: string;
    displayPrice: string;
    price?: number | null;
    offre?: string;
    /** Plusieurs offres, comme Play en rend quand un essai est configuré. */
    offres?: { offerTokenAndroid?: string; offerToken?: string; offerTags?: string[] }[];
  }[];
  historique?: {
    id: string;
    productId: string;
    purchaseToken?: string | null;
    isAcknowledgedAndroid?: boolean | null;
  }[];
  /**
   * Ce que fait la boutique quand la feuille de paiement s'ouvre, et ce que
   * `requestPurchase` rend en plus de ce qu'il émet. Les vraies
   * liaisons font parfois l'un, parfois l'autre, parfois les deux — et rendre
   * l'achat sans jamais l'émettre est précisément le cas qui laissait le bouton
   * tourner sans fin.
   */
  surDemande?: (boutique: {
    emet: (achat: { id: string; productId: string; purchaseToken?: string | null }) => void;
    echoue: (code: string, message: string) => void;
  }) => unknown;
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
          subscriptionOffers: p.offres ?? (p.offre ? [{ offerTokenAndroid: p.offre }] : null),
        }));
    },
    async requestPurchase(args) {
      journal.demandes.push(args);
      return options.surDemande?.({ emet, echoue }) ?? null;
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
    expect(produits[0].priceEur).toBe(MONTHLY_PRICE_EUR);
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


  /**
   * Ce que la boutique dit doit arriver jusqu'à l'écran.
   *
   * Toute erreur repartait sous « Le paiement n'a pas abouti », qui décrit le
   * symptôme et rien d'autre. Le premier achat en bac à sable a échoué
   * exactement comme ça : feuille de paiement ouverte, achat confirmé, et pas
   * un mot sur la cause. Il a fallu lire le code pour savoir quelles causes
   * étaient seulement possibles.
   */
  it('remonte la raison donnée par la boutique, pas une phrase passe-partout', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ echoue }) => echoue('unknown', 'Ce compte n’est pas éligible.'),
    });

    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async () => null,
      async () => JETON,
    );

    expect(await service.startCheckout({ familyId: 'fam-1', plan: 'monthly' })).toEqual({
      kind: 'failed',
      reason: 'Ce compte n’est pas éligible.',
    });
  });

  /**
   * Quand la boutique ne dit rien, quelqu'un doit parler quand même.
   *
   * Et ce n'est pas `startCheckout` : `ExpoIapStore` a déjà substitué une
   * phrase en français au moment où la boutique a rendu un message vide. Le
   * repli du dessus existe toujours, mais il ne sert que si l'erreur remonte
   * sans message du tout — d'où ce test, qui dit lequel des deux répond.
   */
  it('laisse la couche boutique fournir la phrase quand le magasin se tait', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel],
      surDemande: ({ echoue }) => echoue('unknown', ''),
    });

    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async () => null,
      async () => JETON,
    );

    expect(await service.startCheckout({ familyId: 'fam-1', plan: 'monthly' })).toEqual({
      kind: 'failed',
      reason: 'La boutique a refusé le paiement.',
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
        return ABONNEMENT;
      },
      async () => JETON,
    );

    expect(await service.restore('fam-1')).toEqual({ kind: 'done' });
    expect(recues.map((r) => r.token)).toEqual(['jws-mensuel']);
  });

  /**
   * Trouvé mais pas vérifié : l'échec qui ressemblait à un succès.
   *
   * `restore` rendait `done` dès qu'un achat était trouvé, même si toutes les
   * vérifications avaient échoué — à l'écran, exactement la même chose qu'une
   * réussite : rien. Et à la différence d'un achat neuf, on ne peut pas se
   * reposer sur la notification serveur à serveur, qu'Apple ne réémet pas pour
   * une transaction ancienne.
   */
  it('dit que l’achat a été retrouvé mais pas vérifié', async () => {
    const { iap } = fausseBoutique({
      historique: [{ id: 'tx-9', productId: PRODUITS.monthly, purchaseToken: 'jws-mensuel' }],
    });

    const service = new StoreBillingService(
      serveur,
      new ExpoIapStore('apple', async () => iap),
      async () => null,
      async () => JETON,
    );

    const issue = await service.restore('fam-1');
    expect(issue.kind).toBe('failed');
    expect((issue as { reason: string }).reason).toContain('retrouvé');
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

/**
 * Le bouton qui tourne sans fin — la panne rapportée depuis TestFlight.
 *
 * « Si on clique sur souscrire la formule mensuelle : ça mouline, il se passe
 * rien. » Rien dans `ExpoIapStore` ne garantissait qu'une promesse finisse par
 * se dénouer : la feuille de paiement n'était refermée que par un écouteur, et
 * la liaison n'avait aucun délai. Une boutique muette laissait l'écran tourner
 * jusqu'à ce que le parent tue l'application — sans un mot, sans une trace,
 * sans rien à raconter au support.
 *
 * Ces essais couvrent les trois silences possibles. Ils manquaient, et c'est
 * pour cela que le défaut est allé jusqu'à un vrai iPhone.
 */
describe('la boutique qui ne répond pas', () => {
  /**
   * Le cas exact du bouton qui tourne : la liaison rend l'achat au lieu de
   * l'émettre. C'est un comportement réel de StoreKit selon les versions, et
   * il ne finissait nulle part.
   */
  it('encaisse l’achat quand `requestPurchase` le rend au lieu de l’émettre', async () => {
    const { iap, journal } = fausseBoutique({
      produits: [mensuel],
      // Rendu, jamais émis : aucun écouteur ne dira quoi que ce soit.
      surDemande: () => ({ id: 'tx-1', productId: PRODUITS.monthly, purchaseToken: 'jws-rendu' }),
    });

    const achat = await new ExpoIapStore('apple', async () => iap, {
      feuille: 500,
    }).purchase({ productId: PRODUITS.monthly, accountToken: JETON });

    expect(achat?.token).toBe('jws-rendu');
    // La transaction est close, sans quoi Google rembourse au bout de trois jours.
    expect(journal.closes).toContain('tx-1');
  });

  it('rend la main plutôt que d’attendre pour toujours', async () => {
    const { iap } = fausseBoutique({
      produits: [mensuel],
      // Le silence complet : ni émission, ni erreur, ni valeur rendue.
      surDemande: () => undefined,
    });

    const boutique = new ExpoIapStore('apple', async () => iap, { feuille: 50 });

    await expect(
      boutique.purchase({ productId: PRODUITS.monthly, accountToken: JETON }),
    ).rejects.toThrow(/Restaurer mes achats/);
  });

  /**
   * Et le message doit remonter jusqu'à l'écran, pas mourir dans le service :
   * c'est ce qui distingue un bouton mort d'une panne qu'on peut rapporter.
   */
  it('remonte la cause à l’écran au lieu d’un bouton mort', async () => {
    const { iap } = fausseBoutique({ produits: [mensuel], surDemande: () => undefined });

    const service = new StoreBillingService(
      {} as BillingService,
      new ExpoIapStore('apple', async () => iap, { feuille: 50 }),
      async () => ABONNEMENT,
      async () => JETON,
    );

    const issue = await service.startCheckout({ familyId: 'fam-1', plan: 'monthly' });
    expect(issue.kind).toBe('failed');
    expect(issue.kind === 'failed' && issue.reason).toMatch(/Restaurer mes achats/);
  });

  it('cesse d’attendre une liaison qui ne s’ouvre jamais', async () => {
    const jamais = new Promise<never>(() => undefined);
    const boutique = new ExpoIapStore(
      'apple',
      () => jamais as unknown as Promise<ModuleIap>,
      { liaison: 50 },
    );

    await expect(boutique.products()).rejects.toThrow(/n’a pas répondu/);
  });
});

/**
 * Le prix affiché doit rester celui d'Apple même quand tout le reste va mal :
 * un délai posé au mauvais endroit couperait la lecture des formules et
 * l'écran d'abonnement n'afficherait plus aucun tarif.
 */
it('les délais ne gênent pas le cas normal', async () => {
  const { iap } = fausseBoutique({ produits: [mensuel, annuel] });
  const produits = await new ExpoIapStore('apple', async () => iap).products();
  expect(produits.map((p) => p.priceLabel)).toEqual(['9,99 €', '79,99 €']);
});

/**
 * Ce qui ne concerne qu'Android, et qui n'était éprouvé nulle part.
 *
 * Play Billing **exige** un jeton d'offre pour tout abonnement. Sa lecture se
 * faisait hors du garde-fou de délai — donc une liaison muette rendait, sur
 * Android seulement, exactement le bouton qui tourne sans fin qu'on venait de
 * corriger ailleurs. Et son absence partait quand même chez Google, qui
 * refusait avec un message dont la cause est chez nous : un produit dont
 * l'offre de base n'est pas configurée dans la Play Console.
 */
describe('le rail Google', () => {
  it('dit que l’offre manque au lieu de laisser Play refuser', async () => {
    // Un produit vendable, mais sans offre de base configurée.
    const { iap, journal } = fausseBoutique({
      produits: [{ ...mensuel, offre: undefined }],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-1', productId: PRODUITS.monthly, purchaseToken: 'jeton' }),
    });

    const boutique = new ExpoIapStore('google', async () => iap, { feuille: 200 });

    await expect(
      boutique.purchase({ productId: PRODUITS.monthly, accountToken: JETON }),
    ).rejects.toThrow(/Google Play/);

    // Et surtout : rien n'a été demandé à la boutique.
    expect(journal.demandes).toHaveLength(0);
  });

  it('cesse d’attendre un jeton d’offre qui n’arrive jamais', async () => {
    const { iap } = fausseBoutique({ produits: [{ ...mensuel, offre: 'jeton-offre' }] });
    // La lecture des offres reste muette : sans délai, Android tournait sans fin.
    iap.fetchProducts = () => new Promise<never>(() => undefined);

    const boutique = new ExpoIapStore('google', async () => iap, { liaison: 50, feuille: 200 });

    await expect(
      boutique.purchase({ productId: PRODUITS.monthly, accountToken: JETON }),
    ).rejects.toThrow(/n’a pas répondu/);
  });

  it('joint le jeton d’offre à la demande d’achat', async () => {
    const { iap, journal } = fausseBoutique({
      produits: [{ ...mensuel, offre: 'jeton-offre' }],
      surDemande: ({ emet }) =>
        emet({ id: 'tx-2', productId: PRODUITS.monthly, purchaseToken: 'jeton' }),
    });

    await new ExpoIapStore('google', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });

    const demande = journal.demandes[0] as {
      request: { google: { subscriptionOffers: { offerToken: string }[] } };
    };
    expect(demande.request.google.subscriptionOffers).toEqual([
      { sku: PRODUITS.monthly, offerToken: 'jeton-offre' },
    ]);
  });
});

/**
 * Choisir la bonne offre Play, et non la première venue.
 *
 * Google rend toutes les offres auxquelles le compte a droit : le forfait de
 * base, et l'essai gratuit quand il y en a un. Le code prenait
 * `subscriptionOffers[0]` — arbitraire, écrit quand Mino n'en déclarait qu'une.
 * Le jour où l'essai a été ajouté dans la Play Console, un parent sur deux
 * payait immédiatement une offre annoncée gratuite, selon l'ordre où Google
 * avait rangé sa liste. C'est ce qui s'est vu au premier achat sur un vrai
 * Android : « débit aujourd'hui », sans mention d'essai.
 */
describe('l’offre d’essai de Play', () => {
  const base = { offerTokenAndroid: 'jeton-base', offerTags: [] };
  const essai = { offerTokenAndroid: 'jeton-essai', offerTags: ['essai'] };

  const jetonEnvoye = (journal: Journal) =>
    (journal.demandes[0] as { request: { google: { subscriptionOffers: { offerToken: string }[] } } })
      .request.google.subscriptionOffers[0].offerToken;

  const acheter = async (offres: typeof base[]) => {
    const { iap, journal } = fausseBoutique({
      produits: [{ ...mensuel, offres }],
      surDemande: ({ emet }) =>
        emet({ id: 'tx', productId: PRODUITS.monthly, purchaseToken: 'jeton' }),
    });
    await new ExpoIapStore('google', async () => iap).purchase({
      productId: PRODUITS.monthly,
      accountToken: JETON,
    });
    return journal;
  };

  it('prend l’essai quel que soit son rang dans la liste', async () => {
    expect(jetonEnvoye(await acheter([base, essai]))).toBe('jeton-essai');
    // Et dans l'autre sens : ce n'est pas le hasard de l'ordre qui décide.
    expect(jetonEnvoye(await acheter([essai, base]))).toBe('jeton-essai');
  });

  it('se rabat sur le forfait de base quand la famille n’a plus droit à l’essai', async () => {
    // Google ne rend que les offres auxquelles CE compte a droit : une famille
    // qui a déjà eu son mois ne voit plus l'offre d'essai. Elle doit pouvoir
    // s'abonner quand même.
    expect(jetonEnvoye(await acheter([base]))).toBe('jeton-base');
  });

  it('lit le jeton sous ses deux noms', async () => {
    // La liaison l'a appelé `offerToken` puis `offerTokenAndroid` selon les
    // versions. Se tromper de nom rend `undefined` — donc un achat au plein
    // tarif, sans la moindre erreur.
    const journal = await acheter([{ offerToken: 'ancien-nom', offerTags: ['essai'] } as never]);
    expect(jetonEnvoye(journal)).toBe('ancien-nom');
  });
});
