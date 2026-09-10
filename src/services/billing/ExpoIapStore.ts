import { Platform } from 'react-native';

import { ANNUAL_PRICE_EUR, MONTHLY_PRICE_EUR, PRODUITS, Plan } from '@/domain/billing';
import { OffreApple } from '@/domain/offrePromo';

import { NativeStore, StoreProduct, StorePurchase } from './native';

/**
 * La boutique du téléphone, pour de vrai.
 *
 * `native.ts` décrit depuis longtemps ce que Mino attend d'une boutique ;
 * personne ne l'implémentait, et `setNativeStore()` n'était appelé nulle part.
 * L'application entière était donc prête à encaisser et incapable de le faire.
 * Ce fichier est la pièce qui manquait.
 *
 * **Pourquoi StoreKit et Play directement, et pas RevenueCat.** RevenueCat
 * rend un service précis : vérifier les reçus et tenir l'état de l'abonnement à
 * la place du serveur. Mino a déjà les deux — `supabase/functions/_shared/
 * store.ts` vérifie les transactions signées d'Apple et interroge l'API Play,
 * et `store-notifications` reçoit les notifications serveur à serveur. Ajouter
 * RevenueCat reviendrait à payer un intermédiaire pour refaire ce qui est
 * écrit, et à lui confier la vérité sur les abonnements — c'est-à-dire à
 * dépendre de la disponibilité d'un tiers pour savoir qui est client.
 *
 * `expo-iap` n'est pas un intermédiaire de ce genre : c'est une liaison vers
 * StoreKit 2 et Play Billing, sans serveur, sans compte à ouvrir et sans
 * commission. Elle s'arrête là où commence la vérification, qui reste chez
 * nous.
 *
 * **Ce que ce fichier ne décide jamais.** Il ne dit pas qu'une famille est
 * abonnée. Il rapporte une preuve — le JWS d'Apple, le jeton d'achat de
 * Google — et c'est le serveur qui la fait valider par la boutique. Un
 * téléphone qui déciderait de son propre abonnement est un téléphone à qui on
 * demandera de le faire.
 */

/**
 * Les identifiants des produits vivent désormais dans `domain/billing.ts` : le
 * serveur en a besoin lui aussi pour signer les offres promotionnelles, et une
 * fonction Edge ne peut pas importer un module React Native. Réexportés ici
 * pour ne pas déplacer les appels.
 */
export { PRODUITS };

/** Le prix affiché si la boutique ne rend pas de montant numérique. */
const PRIX_DE_REPLI: Record<Plan, number> = {
  monthly: MONTHLY_PRICE_EUR,
  yearly: ANNUAL_PRICE_EUR,
};

/**
 * Apple exige un UUID pour `appAccountToken` et rejette tout le reste. La base
 * en attribue un à chaque famille, mais `storeAccountToken()` se rabat sur
 * l'identifiant de famille quand elle ne peut pas le lire — et celui-là n'en
 * est pas un. Mieux vaut alors ne rien envoyer : le serveur retrouve la famille
 * par le jeton d'authentification de l'appelant, et la notification serveur à
 * serveur arrivera sans jeton de compte plutôt que sous un jeton faux.
 */
const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------ la surface d'`expo-iap` */

/**
 * Exactement ce que Mino appelle dans `expo-iap`, et rien d'autre.
 *
 * Redéclarer cette poignée de signatures plutôt que d'importer les types de la
 * bibliothèque a deux effets qui comptent : les essais peuvent lui substituer
 * une fausse boutique sans module natif, et le jour où la bibliothèque change
 * de nom ou de forme, ce qu'il faut relire tient en trente lignes.
 */
export interface AchatBoutique {
  id: string;
  productId: string;
  /** Le JWS sur iOS, le jeton d'achat sur Android. C'est la preuve. */
  purchaseToken?: string | null;
  /** Android : `false` tant que l'achat n'a pas été acquitté. */
  isAcknowledgedAndroid?: boolean | null;
}

export interface ProduitBoutique {
  id: string;
  /** Déjà formaté par la boutique, dans la devise et la langue de l'appareil. */
  displayPrice: string;
  price?: number | null;
  /**
   * Android : les offres auxquelles ce compte a droit.
   *
   * Le jeton est lu sous deux noms, et ce n'est pas de la prudence gratuite :
   * la liaison l'a appelé `offerToken` puis `offerTokenAndroid` selon les
   * versions, et une lecture qui se trompe de nom rend `undefined` — donc un
   * achat au plein tarif, sans la moindre erreur.
   */
  subscriptionOffers?:
    | {
        offerTokenAndroid?: string | null;
        offerToken?: string | null;
        /** Les étiquettes posées dans la Play Console. C'est par là qu'on reconnaît l'essai. */
        offerTags?: string[] | null;
        offerId?: string | null;
      }[]
    | null;
}

export interface ErreurBoutique {
  code: string;
  message: string;
}

interface Abonnement {
  remove(): void;
}

export interface ModuleIap {
  initConnection(): Promise<unknown>;
  fetchProducts(request: { skus: string[]; type: 'subs' }): Promise<unknown>;
  requestPurchase(args: unknown): Promise<unknown>;
  finishTransaction(args: { purchase: AchatBoutique; isConsumable: boolean }): Promise<unknown>;
  getAvailablePurchases(options?: { onlyIncludeActiveItemsIOS?: boolean }): Promise<AchatBoutique[]>;
  restorePurchases(): Promise<unknown>;
  purchaseUpdatedListener(ecoute: (achat: AchatBoutique) => void): Abonnement;
  purchaseErrorListener(ecoute: (erreur: ErreurBoutique) => void): Abonnement;
}

/* ------------------------------------------------------------ l'adaptateur */

/**
 * Les délais au-delà desquels on cesse d'attendre la boutique.
 *
 * **Aucun n'existait, et c'est ce qui a produit le bouton qui tourne sans
 * fin.** Rien dans ce fichier ne garantissait qu'une promesse finisse par se
 * dénouer : ni l'ouverture de la liaison, ni la lecture des produits, ni
 * surtout la feuille de paiement, qui n'était refermée que par un écouteur.
 * Une boutique muette — et elles le sont, en bac à sable comme en production —
 * laissait l'écran tourner jusqu'à ce que le parent tue l'application.
 *
 * Les deux valeurs ne se ressemblent pas parce qu'elles ne mesurent pas la même
 * chose : ouvrir une liaison est une affaire de secondes, tandis qu'un achat
 * peut demander Face ID, le mot de passe d'un compte Apple, et parfois
 * l'autorisation d'un autre adulte. Deux minutes est long à l'écran ; c'est
 * court au regard de ce qu'un vrai achat peut prendre, et une promesse qu'on
 * coupe trop tôt fait dire à Mino qu'un paiement a échoué alors qu'il aboutit.
 */
const DELAI_LIAISON_MS = 20_000;
const DELAI_FEUILLE_MS = 120_000;

export class ExpoIapStore implements NativeStore {
  constructor(
    readonly platform: 'apple' | 'google',
    private readonly charger: () => Promise<ModuleIap>,
    /** Raccourcis pour les essais, qui n'ont pas deux minutes à perdre. */
    private readonly delais: { liaison?: number; feuille?: number } = {},
  ) {}

  private ouverture: Promise<ModuleIap> | null = null;

  /**
   * La même promesse, mais qui finit toujours par répondre.
   *
   * Un rejet dit ce qui n'a pas abouti et à quelle étape — c'est ce qui
   * distingue « la boutique ne s'ouvre pas » de « le paiement a été refusé »,
   * deux pannes qui ne se réparent pas du tout de la même façon et qui
   * arrivaient toutes deux à l'écran sous la forme d'un bouton qui tourne.
   */
  private async avant<T>(quoi: string, ms: number, travail: Promise<T>): Promise<T> {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        travail,
        new Promise<never>((_, rejeter) => {
          minuterie = setTimeout(
            () => rejeter(new Error(`La boutique n’a pas répondu (${quoi}).`)),
            ms,
          );
        }),
      ]);
    } finally {
      if (minuterie) clearTimeout(minuterie);
    }
  }

  /**
   * Ouvre la liaison avec la boutique, une seule fois.
   *
   * Elle est ouverte à la demande plutôt qu'au démarrage : la très grande
   * majorité des lancements de Mino ne touche jamais à l'abonnement, et rien ne
   * justifie de réveiller StoreKit pour afficher les missions du jour.
   *
   * En cas d'échec la promesse est oubliée, pour qu'un second essai reparte de
   * zéro. Une liaison ratée gardée en mémoire est une boutique définitivement
   * fermée jusqu'au redémarrage de l'application.
   */
  private connexion(): Promise<ModuleIap> {
    if (!this.ouverture) {
      const ouvrir = this.avant(
        'ouverture',
        this.delais.liaison ?? DELAI_LIAISON_MS,
        (async () => {
          const iap = await this.charger();
          await iap.initConnection();
          await this.solder(iap);
          return iap;
        })(),
      );

      this.ouverture = ouvrir.catch((erreur) => {
        this.ouverture = null;
        throw erreur;
      });
    }
    return this.ouverture;
  }

  /**
   * Acquitte ce qui traîne — la protection contre un remboursement automatique.
   *
   * Google rembourse de lui-même tout achat non acquitté au bout de trois
   * jours. Le cas se produit quand l'application est tuée entre le paiement et
   * l'acquittement : le parent a payé, la notification serveur à serveur a
   * accordé l'abonnement, et Google le rembourse quand même le surlendemain.
   *
   * Acquitter ici n'accorde rien à personne — dans Mino, c'est le serveur qui
   * accorde, et lui seul. Cela dit seulement à Google que l'achat est arrivé à
   * destination.
   */
  private async solder(iap: ModuleIap): Promise<void> {
    const restants = await iap.getAvailablePurchases().catch(() => [] as AchatBoutique[]);
    for (const achat of restants) {
      if (achat.isAcknowledgedAndroid === false) {
        await iap.finishTransaction({ purchase: achat, isConsumable: false }).catch(() => undefined);
      }
    }
  }

  /**
   * Les formules réellement vendables, avec le prix de la boutique.
   *
   * L'ordre vient d'ici et non de la boutique : mensuel puis annuel, toujours,
   * pour que l'écran d'abonnement ne change pas de disposition d'un appareil à
   * l'autre. Un produit absent — pas encore approuvé, pas disponible dans le
   * pays — est simplement omis, et l'écran n'en propose pas.
   */
  async products(): Promise<StoreProduct[]> {
    const iap = await this.connexion();
    const bruts = (await this.avant(
      'formules',
      this.delais.liaison ?? DELAI_LIAISON_MS,
      iap.fetchProducts({ skus: [PRODUITS.monthly, PRODUITS.yearly], type: 'subs' }),
    )) as ProduitBoutique[] | null;

    const plans: Plan[] = ['monthly', 'yearly'];
    const produits: StoreProduct[] = [];

    for (const plan of plans) {
      const brut = (bruts ?? []).find((p) => p.id === PRODUITS[plan]);
      if (!brut) continue;
      produits.push({
        id: brut.id,
        plan,
        priceLabel: brut.displayPrice,
        priceEur: typeof brut.price === 'number' ? brut.price : PRIX_DE_REPLI[plan],
      });
    }

    return produits;
  }

  /**
   * Ouvre la feuille de paiement et attend qu'elle se referme.
   *
   * **Le résultat n'arrive pas par la valeur de retour.** `requestPurchase` ne
   * fait que déclencher le flux ; la transaction arrive par l'écouteur, parfois
   * plusieurs secondes plus tard, parfois après une authentification Face ID,
   * parfois après une demande d'autorisation parentale sur le compte Apple de
   * quelqu'un d'autre. C'est la raison de cette promesse tenue ouverte.
   *
   * Trois issues, et une seule est une erreur :
   *
   * — la transaction arrive : on la clôt et on rend la preuve ;
   * — l'utilisateur referme la feuille : `null`, ce n'est pas un échec et
   *   `StoreBillingService` le traduit par « abandonné », sans écran rouge ;
   * — la boutique refuse : on lève.
   */
  async purchase(input: {
    productId: string;
    accountToken: string;
    offre?: OffreApple;
  }): Promise<StorePurchase | null> {
    const iap = await this.connexion();

    const jeton = EST_UUID.test(input.accountToken) ? input.accountToken : null;

    /**
     * Le jeton d'offre de Play, et les deux façons dont il faisait échouer
     * l'achat en silence.
     *
     * **Il se lisait hors de tout garde-fou.** Cet appel précède la promesse
     * qui porte le délai : sur Android, une liaison muette rendait donc
     * exactement le bouton qui tourne sans fin qu'on venait de corriger
     * ailleurs. Le chemin iOS était protégé, l'autre non.
     *
     * **Et son absence n'était pas une erreur.** Play Billing **exige** un
     * jeton d'offre pour tout abonnement : sans lui, l'achat part quand même,
     * échoue chez Google, et le parent reçoit un message de la boutique qui ne
     * dit rien de la cause. Or la cause est chez nous — un produit dont
     * l'offre de base n'est pas configurée dans la Play Console — et c'est
     * exactement ce qu'il faut lire dans les journaux le jour où ça arrive.
     */
    let offre: string | null = null;
    if (this.platform === 'google') {
      offre = await this.avant(
        'offres Play',
        this.delais.liaison ?? DELAI_LIAISON_MS,
        this.offrePour(iap, input.productId),
      );
      if (!offre) {
        throw new Error(
          'Cette formule n’a pas d’offre configurée sur Google Play. Réessayez plus tard.',
        );
      }
    }

    return new Promise<StorePurchase | null>((resolve, reject) => {
      const abonnements: Abonnement[] = [];
      let close = false;

      /**
       * Le garde-fou sans lequel l'écran tournait sans fin.
       *
       * Cette promesse n'avait que trois issues, toutes déclenchées par la
       * boutique : la transaction, l'erreur, ou le refus de `requestPurchase`.
       * Il en manquait une quatrième, la seule que l'on maîtrise — le silence.
       * Une boutique qui ne dit rien laissait le bouton « CHOISIR CETTE
       * FORMULE » tourner indéfiniment, et il n'y avait aucun moyen, pour le
       * parent comme pour nous, de savoir à quelle étape ça s'était arrêté.
       *
       * Le message ne dit surtout pas que le paiement a échoué : on n'en sait
       * rien. Il dit ce qu'il faut faire si jamais il a abouti, et c'est vrai —
       * la notification serveur à serveur nous l'apprendra de toute façon.
       */
      const minuterie = setTimeout(
        () =>
          termine(
            null,
            new Error(
              'La boutique n’a pas répondu. Si le paiement a été accepté, touchez « Restaurer mes achats » : rien n’est perdu.',
            ),
          ),
        this.delais.feuille ?? DELAI_FEUILLE_MS,
      );

      const termine = (valeur: StorePurchase | null, erreur?: Error) => {
        if (close) return;
        close = true;
        clearTimeout(minuterie);
        for (const abonnement of abonnements) abonnement.remove();
        if (erreur) reject(erreur);
        else resolve(valeur);
      };

      /**
       * Encaisser une transaction, d'où qu'elle vienne.
       *
       * **Elle arrive par deux chemins, et un seul était écouté.** L'écouteur
       * est le chemin documenté, mais selon la version de StoreKit et de la
       * liaison, `requestPurchase` résout lui-même avec l'achat — et l'écouteur
       * ne dit alors jamais rien. Ce cas-là ne finissait nulle part.
       */
      const encaisser = async (achat: AchatBoutique) => {
        // StoreKit rejoue les transactions non closes à chaque connexion.
        // Celle-ci concerne un autre produit : on la clôt pour qu'elle
        // cesse de revenir, et on continue d'attendre la nôtre.
        if (achat.productId !== input.productId) {
          await iap
            .finishTransaction({ purchase: achat, isConsumable: false })
            .catch(() => undefined);
          return;
        }

        const preuve = achat.purchaseToken ?? '';

        // Clore avant de rendre la main, et non après la vérification du
        // serveur. C'est le sens inverse de l'usage, et il est délibéré :
        // ici la vérité vient de la notification serveur à serveur, qu'Apple
        // et Google réémettent pendant des jours. Attendre notre serveur
        // pour acquitter n'ajouterait donc aucune sécurité, et exposerait
        // le parent au remboursement automatique de Google.
        await iap
          .finishTransaction({ purchase: achat, isConsumable: false })
          .catch(() => undefined);

        if (!preuve) {
          termine(null, new Error('La boutique n’a pas rendu de preuve d’achat.'));
          return;
        }

        termine({ productId: achat.productId, token: preuve, accountToken: jeton });
      };

      abonnements.push(
        iap.purchaseUpdatedListener((achat) => {
          void encaisser(achat);
        }),
        iap.purchaseErrorListener((erreur) => {
          if (erreur.code === 'user-cancelled') termine(null);
          else termine(null, new Error(erreur.message || 'La boutique a refusé le paiement.'));
        }),
      );

      iap
        .requestPurchase({
          type: 'subs',
          request: {
            apple: {
              sku: input.productId,
              appAccountToken: jeton,
              /**
               * L'offre promotionnelle, quand il y en a une.
               *
               * StoreKit refuse une signature qu'il n'a pas demandée, et
               * l'applique sans un mot quand elle est juste : la feuille de
               * paiement annonce alors « 1 mois gratuit, puis … ». Une
               * signature absente ou fausse ne produit aucune erreur — le plein
               * tarif s'affiche, comme si l'offre n'existait pas.
               */
              withOffer: input.offre
                ? {
                    identifier: input.offre.identifier,
                    keyIdentifier: input.offre.keyIdentifier,
                    nonce: input.offre.nonce,
                    signature: input.offre.signature,
                    timestamp: input.offre.timestamp,
                  }
                : undefined,
            },
            google: {
              skus: [input.productId],
              obfuscatedAccountId: jeton,
              // Jamais vide : Play refuse un abonnement sans jeton d'offre, et
              // le cas est écarté plus haut avec une phrase qui dit pourquoi.
              subscriptionOffers: [{ sku: input.productId, offerToken: offre }],
            },
          },
        })
        // Le second chemin : quand la liaison rend l'achat au lieu de le
        // signaler. Un achat livré deux fois ne pose pas de problème — `close`
        // ferme la porte derrière le premier arrivé.
        .then((rendu: unknown) => {
          const achats = (Array.isArray(rendu) ? rendu : rendu ? [rendu] : []) as AchatBoutique[];
          for (const achat of achats) {
            if (achat && typeof achat.productId === 'string') void encaisser(achat);
          }
        })
        .catch((erreur: unknown) =>
          termine(null, erreur instanceof Error ? erreur : new Error('Paiement impossible.')),
        );
    });
  }

  /**
   * Le jeton d'offre exigé par Play, et pourquoi on prend le premier.
   *
   * Google ne rend que les offres auxquelles **ce compte-là** a droit, et Mino
   * n'en déclare qu'une : le plan de base, sans essai gratuit côté boutique —
   * les trente jours sont accordés par notre serveur, à la famille et non au
   * compte Google, sans quoi un parent qui change de téléphone recommencerait
   * un essai. Il n'y a donc rien à départager.
   */
  private async offrePour(iap: ModuleIap, productId: string): Promise<string | null> {
    const bruts = (await iap.fetchProducts({ skus: [productId], type: 'subs' })) as
      | ProduitBoutique[]
      | null;
    const produit = (bruts ?? []).find((p) => p.id === productId);
    const offres = (produit?.subscriptionOffers ?? []).filter(Boolean);

    const jetonDe = (o: { offerTokenAndroid?: string | null; offerToken?: string | null }) =>
      o.offerTokenAndroid ?? o.offerToken ?? null;

    /**
     * **La bonne offre, et non la première venue.**
     *
     * Google rend toutes les offres auxquelles CE compte a droit : le forfait
     * de base, et l'essai gratuit quand il y en a un. Ce code prenait
     * `subscriptionOffers[0]` — un choix arbitraire, écrit à l'époque où Mino
     * n'en déclarait qu'une seule. Le jour où l'essai a été ajouté dans la Play
     * Console, un parent sur deux s'est retrouvé à payer immédiatement une
     * offre annoncée gratuite, selon l'ordre où Google avait rangé sa liste.
     *
     * L'étiquette `essai` est celle qu'on pose sur l'offre dans la console, et
     * c'est déjà celle que le serveur cherche pour reconnaître un essai
     * (`ETIQUETTE_ESSAI`, dans `_shared/store.ts`). Les deux bouts lisent donc
     * la même marque, ce qui évite qu'ils divergent.
     *
     * Le repli sur la première offre reste : une famille qui n'a plus droit à
     * l'essai — elle l'a déjà eu — ne doit pas se voir refuser l'abonnement.
     */
    const essai = offres.find((o) =>
      (o.offerTags ?? []).some((t) => String(t).toLowerCase() === 'essai'),
    );

    return jetonDe(essai ?? offres[0] ?? {});
  }

  /**
   * Rétablir un achat déjà payé — le bouton sans lequel Apple refuse une
   * application qui vend un abonnement.
   *
   * `restorePurchases` demande à StoreKit de resynchroniser, ce qui peut
   * réclamer le mot de passe du compte Apple : c'est pour cela que cette
   * méthode n'est appelée qu'à la demande explicite du parent, jamais au
   * démarrage.
   */
  async restore(): Promise<StorePurchase[]> {
    const iap = await this.connexion();
    await iap.restorePurchases().catch(() => undefined);

    const achats = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    const preuves: StorePurchase[] = [];

    for (const achat of achats) {
      if (achat.isAcknowledgedAndroid === false) {
        await iap.finishTransaction({ purchase: achat, isConsumable: false }).catch(() => undefined);
      }
      if (achat.purchaseToken) {
        preuves.push({
          productId: achat.productId,
          token: achat.purchaseToken,
          // La boutique ne rend pas le jeton de compte avec l'historique. Ce
          // n'est pas gênant : le serveur retrouve la famille par le jeton
          // d'authentification de l'appelant.
          accountToken: null,
        });
      }
    }

    return preuves;
  }
}

/**
 * La boutique de cet appareil, ou `null` quand il n'y en a pas.
 *
 * `null` est un état prévu, pas une panne : c'est celui du web, d'Expo Go et de
 * toute build faite avant que le module natif n'y entre. `getBillingService()`
 * se rabat alors sur Stripe ou sur la doublure locale, et le dit franchement.
 *
 * L'import est **dynamique**, et c'est la seule chose à ne pas défaire : écrit
 * en haut du fichier, il ferait entrer un module natif dans le paquet web, où
 * il n'existe pas.
 */
export function boutiqueDuTelephone(): NativeStore | null {
  const charger = async (): Promise<ModuleIap> =>
    (await import('expo-iap')) as unknown as ModuleIap;

  if (Platform.OS === 'ios') return new ExpoIapStore('apple', charger);
  if (Platform.OS === 'android') return new ExpoIapStore('google', charger);
  return null;
}
