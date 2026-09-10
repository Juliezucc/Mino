import { Platform } from 'react-native';

import { ANNUAL_PRICE_EUR, MONTHLY_PRICE_EUR, PRODUITS, Plan } from '@/domain/billing';
import { buildReport } from '@/domain/diagnostics';
import { OffreApple } from '@/domain/offrePromo';
import { deviceContext, getDiagnosticsService } from '@/services/diagnostics';

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

/**
 * L'étiquette posée sur l'offre d'essai dans la Play Console.
 *
 * La même chaîne que celle que le serveur cherche pour reconnaître un essai
 * (`ETIQUETTE_ESSAI`, dans `supabase/functions/_shared/store.ts`) : les deux
 * bouts lisent la même marque, ce qui évite qu'ils divergent le jour où l'un
 * des deux est modifié sans l'autre.
 */
const ETIQUETTE_ESSAI = 'essai';

/** Cette offre-ci porte-t-elle l'étiquette de l'essai ? */
function estLEssai(offre: { offerTags?: string[] | null }): boolean {
  return (offre.offerTags ?? []).some((t) => String(t).toLowerCase() === ETIQUETTE_ESSAI);
}

/** Le compte a-t-il encore droit à l'essai sur ce produit ? Voir `estLEssai`. */
function aUnEssai(produit: ProduitBoutique): boolean {
  return (produit.subscriptionOffers ?? []).filter(Boolean).some(estLEssai);
}

/* ------------------------------------------ ce que la boutique dit, en français */

/**
 * Refermer la feuille de paiement n'est pas une erreur — encore faut-il le
 * reconnaître.
 *
 * Le code de l'annulation n'était cherché que sous une seule forme,
 * `user-cancelled`. Selon la plateforme et la version de la liaison, il arrive
 * en `E_USER_CANCELLED`, `user_cancelled`, ou `USER_CANCELED` — et l'annulation
 * devenait alors une erreur rouge affichée à quelqu'un qui a simplement changé
 * d'avis. C'est le meilleur moyen qu'il ne revienne pas.
 */
function estUneAnnulation(erreur: ErreurBoutique): boolean {
  const brut = `${erreur.code ?? ''} ${erreur.message ?? ''}`.toLowerCase();
  return /cancel/.test(brut) || /annul/.test(brut);
}

/**
 * ------------------------------------------- « Failed to request purchase »
 *
 * **Le défaut : la boutique parle anglais, et le parent lisait l'anglais.**
 * Le message brut d'`expo-iap` était affiché tel quel, faute de mieux. Sur
 * l'écran d'un parent français qui vient d'engager 9,99 €, « Failed to request
 * purchase » ne dit rien, n'indique rien à faire, et donne surtout le
 * sentiment que quelque chose s'est cassé.
 *
 * **Ce qui avait motivé l'affichage brut, et comment on le garde.** Une
 * version antérieure remplaçait toute erreur par « Le paiement n'a pas
 * abouti » — une phrase qui décrit le symptôme et rien d'autre, alors que la
 * boutique est précise. On a donc besoin des deux : une phrase française pour
 * le parent, et le texte d'origine pour qui devra diagnostiquer. Le premier va
 * à l'écran, le second dans la console.
 *
 * Les causes traduites ici sont celles qu'un parent peut rencontrer et sur
 * lesquelles il peut agir. Le reste tombe dans une phrase qui ne ment pas :
 * on ne sait pas, et on dit quoi faire ensuite.
 */
function messageBoutique(erreur: ErreurBoutique): string {
  const brut = `${erreur.code ?? ''} ${erreur.message ?? ''}`;
  console.warn('[boutique]', brut.trim());

  /**
   * Le texte brut de la boutique doit sortir de l'appareil.
   *
   * **Ce qui manquait, constaté sur un vrai paiement.** Un achat a échoué sur
   * un iPhone en TestFlight avec le message de repli — celui qui dit « rien
   * n'a été prélevé » parce qu'on ne sait pas. La deuxième tentative est
   * passée. Impossible ensuite de savoir ce qu'Apple avait répondu la première
   * fois : le seul endroit où il était écrit est `console.warn`, c'est-à-dire
   * la console d'un Mac branché en USB. Un défaut qu'on ne peut pas lire est
   * un défaut qu'on ne corrigera pas.
   *
   * Un échec de paiement est le pire endroit où perdre une trace : c'est le
   * seul écran où un parent qui voulait payer renonce.
   *
   * Ce qui part est le code et le message de la boutique — du texte technique
   * d'Apple ou de Google, jamais une donnée de la famille — dans la même table
   * que les autres signalements. Et jamais attendu : un envoi qui échoue ne
   * doit pas ajouter une panne à une panne.
   */
  void getDiagnosticsService()
    .send(
      buildReport({
        kind: 'crash',
        message: 'achat refusé par la boutique',
        stack: brut.trim(),
        context: deviceContext({ route: 'paywall' }),
      }),
    )
    .catch(() => undefined);

  const dit = brut.toLowerCase();

  if (/network|connect|timeout|réseau/.test(dit)) {
    return 'La boutique n’a pas répondu. Vérifiez votre connexion et réessayez.';
  }
  if (/already own|already purchas|déjà/.test(dit)) {
    return 'Cet abonnement est déjà actif sur ce compte. Touchez « Restaurer mes achats ».';
  }
  if (/not allowed|restrict|not authorized|unauthorized/.test(dit)) {
    return 'Les achats sont bloqués sur cet appareil, sans doute par un contrôle parental ou une restriction du compte.';
  }
  if (/deferred|pending|approval/.test(dit)) {
    return 'L’achat attend l’accord du titulaire du compte. Il se terminera dès qu’il aura été approuvé.';
  }
  if (/unavailable|not found|invalid product|item_unavailable/.test(dit)) {
    return 'Cette formule n’est pas disponible sur ce compte pour le moment. Réessayez dans quelques minutes.';
  }
  if (/not initialized|connection|billing unavailable/.test(dit)) {
    return 'La boutique n’est pas joignable sur cet appareil. Vérifiez que vous êtes connecté à votre compte, puis réessayez.';
  }

  return 'Le paiement n’a pas pu être lancé. Réessayez dans un instant — rien n’a été prélevé.';
}

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
  productId?: string | null;
  /**
   * Android : la même chose au pluriel.
   *
   * Un achat Play peut couvrir plusieurs références, et selon la version de la
   * liaison, c'est ce champ-ci qui est rempli — `productId` restant vide. Voir
   * `normaliser` : lire un seul des deux noms revient à ne rien lire du tout un
   * jour sur deux.
   */
  productIds?: string[] | null;
  /** Le JWS sur iOS, le jeton d'achat sur Android. C'est la preuve. */
  purchaseToken?: string | null;
  /** Le même, sous le nom que la liaison lui a donné selon les versions. */
  purchaseTokenAndroid?: string | null;
  /** Et son nom historique, encore rendu par certaines versions. */
  transactionReceipt?: string | null;
  /** Android : `false` tant que l'achat n'a pas été acquitté. */
  isAcknowledgedAndroid?: boolean | null;
  /** Le même, sans le suffixe. */
  isAcknowledged?: boolean | null;
}

/**
 * ------------------------------------- lire un achat sous tous ses noms
 *
 * **Le défaut que cela répare, et il perdait des paiements.** Ce fichier
 * documente déjà le piège pour le jeton d'offre : « la liaison l'a appelé
 * `offerToken` puis `offerTokenAndroid` selon les versions, et une lecture qui
 * se trompe de nom rend `undefined` — donc un achat au plein tarif, sans la
 * moindre erreur ». Le même piège existait sur l'objet d'achat lui-même, et il
 * coûtait plus cher : `productId` et `purchaseToken` y étaient lus sous un
 * seul nom chacun.
 *
 * Quand `productId` ne se lit pas, l'achat était pris pour celui d'un AUTRE
 * produit — la ligne qui suit clôt alors la transaction et l'abandonne. Le
 * parent a payé, Google a encaissé, la transaction est acquittée, et notre
 * serveur n'en entend jamais parler : l'application continue d'afficher
 * « essai gratuit », et il n'y a même plus rien à retrouver. Quand c'est
 * `purchaseToken` qui manque, l'achat repart avec « la boutique n'a pas rendu
 * de preuve ».
 *
 * On lit donc les trois noms de la preuve et les deux du produit. C'est laid,
 * et c'est exactement le prix d'une dépendance qui renomme ses champs entre
 * deux versions mineures.
 */
function normaliser(achat: AchatBoutique): { productId: string | null; preuve: string | null } {
  return {
    productId: achat.productId ?? achat.productIds?.[0] ?? null,
    preuve: achat.purchaseToken ?? achat.purchaseTokenAndroid ?? achat.transactionReceipt ?? null,
  };
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
        /**
         * Ce que Google appliquera vraiment — pas ce que nous annonçons.
         *
         * Sur Android, les offres rendues par la boutique sont celles auxquelles
         * CE compte a droit, aujourd'hui. Si aucune ne porte l'étiquette
         * `essai`, il n'y aura pas d'essai : la feuille de paiement prélèvera
         * immédiatement. C'est arrivé sur un vrai téléphone, avec « 0 € pendant
         * 30 jours » écrit juste au-dessus du bouton.
         *
         * `undefined` sur iOS, où l'offre d'introduction se règle dans App
         * Store Connect et ne se lit pas ici : l'écran garde alors sa
         * formulation habituelle plutôt que d'affirmer une absence qu'il ne
         * constate pas.
         */
        essaiOffert: this.platform === 'google' ? aUnEssai(brut) : undefined,
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
        const { productId, preuve: lue } = normaliser(achat);

        /**
         * StoreKit rejoue les transactions non closes à chaque connexion.
         * Celle-ci concerne un autre produit : on la clôt pour qu'elle cesse de
         * revenir, et on continue d'attendre la nôtre.
         *
         * **`productId !== null` d'abord, et c'est tout le correctif.** Un achat
         * dont on n'arrive pas à lire la référence n'est pas l'achat de
         * quelqu'un d'autre : c'est un achat qu'on ne sait pas lire. Le jeter
         * ici, c'est acquitter chez Google une transaction que notre serveur ne
         * verra jamais — le parent a payé, et il n'y a plus rien à retrouver.
         * Dans le doute, on le garde : nous sommes au milieu d'un achat que
         * nous venons nous-mêmes de déclencher.
         */
        if (productId !== null && productId !== input.productId) {
          await iap
            .finishTransaction({ purchase: achat, isConsumable: false })
            .catch(() => undefined);
          return;
        }

        const preuve = lue ?? '';

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

        // `input.productId` en dernier recours : c'est celui qu'on a demandé, et
        // la boutique vient de confirmer un achat dans CE flux-là.
        termine({ productId: productId ?? input.productId, token: preuve, accountToken: jeton });
      };

      abonnements.push(
        iap.purchaseUpdatedListener((achat) => {
          void encaisser(achat);
        }),
        iap.purchaseErrorListener((erreur) => {
          // `null` sans erreur = « abandonné ». Refermer la feuille est un
          // choix, pas une panne, et un écran rouge à quelqu'un qui a hésité
          // est le meilleur moyen qu'il ne revienne pas.
          if (estUneAnnulation(erreur)) termine(null);
          else termine(null, new Error(messageBoutique(erreur)));
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
            // Un objet qui porte une preuve est un achat, même si sa référence
            // se lit sous un nom qu'on n'attendait pas. Exiger `productId`
            // écartait en silence l'achat rendu par la liaison Android.
            if (achat && normaliser(achat).preuve) void encaisser(achat);
          }
        })
        /**
         * Ce chemin-ci laissait passer le message d'origine tel quel : c'est
         * lui qui affichait « Failed to request purchase » à un parent
         * français. Une annulation y arrive aussi parfois, selon la
         * plateforme — auquel cas ce n'est pas une erreur du tout.
         */
        .catch((erreur: unknown) => {
          const dit = erreur instanceof Error ? erreur.message : String(erreur ?? '');
          const code = (erreur as { code?: string } | null)?.code;
          const boutique: ErreurBoutique = { code: code ?? '', message: dit };

          if (estUneAnnulation(boutique)) return termine(null);
          termine(null, new Error(messageBoutique(boutique)));
        });
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
    return jetonDe(offres.find(estLEssai) ?? offres[0] ?? {});
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
    return this.lire(iap);
  }

  /**
   * Ce que la boutique tient déjà, sans resynchronisation ni mot de passe.
   *
   * Voir `NativeStore.achatsConnus`. La différence avec `restore()` tient en
   * une ligne — l'absence de `restorePurchases()` — et c'est elle qui rend
   * l'appel utilisable au lancement de l'application.
   */
  async achatsConnus(): Promise<StorePurchase[]> {
    return this.lire(await this.connexion());
  }

  private async lire(iap: ModuleIap): Promise<StorePurchase[]> {
    const achats = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    const preuves: StorePurchase[] = [];

    for (const achat of achats) {
      const { productId, preuve } = normaliser(achat);

      // Sous ses deux noms, ici aussi : un achat Play jamais acquitté est
      // remboursé au bout de trois jours, et c'est un remboursement que
      // personne n'a demandé.
      if (achat.isAcknowledgedAndroid === false || achat.isAcknowledged === false) {
        await iap.finishTransaction({ purchase: achat, isConsumable: false }).catch(() => undefined);
      }
      if (preuve && productId) {
        preuves.push({
          productId,
          token: preuve,
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
