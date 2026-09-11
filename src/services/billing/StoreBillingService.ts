import {
  PRODUITS,
  Plan,
  Referral,
  Subscription,
  isStore,
  manageSubscriptionUrl,
} from '@/domain/billing';
import { estDefinitif } from '@/data/erreurFonction';
import { ID } from '@/domain/types';
import { OffreApple } from '@/domain/offrePromo';

import { BillingService, CheckoutOutcome } from './BillingService';
import { NativeStore } from './native';

/**
 * L'achat dans l'application : App Store et Play Store.
 *
 * Ce service ne remplace pas le serveur, il s'ajoute devant lui. Tout ce qui
 * relève de l'état — l'abonnement, les parrainages, les crédits — continue de
 * venir de notre backend, par les mêmes appels que sur le web. Seul l'acte de
 * payer change, et c'est précisément ce qu'il fallait déplacer : une maman qui
 * découvre Mino sur Instagram passe de « publicité → boutique →
 * téléchargement → Face ID » à la place de « application → navigateur →
 * carte bancaire → retour ». Chaque étape retirée est de la conversion gagnée.
 *
 * Deux règles qui ne se contournent pas :
 *
 * 1. **Ce que renvoie un achat n'est pas une vérité, c'est une preuve.** Elle
 *    part au serveur, qui la vérifie auprès d'Apple ou de Google. Le
 *    téléphone ne décide jamais qu'il est abonné.
 *
 * 2. **On ne résilie pas ici.** `cancel` est volontairement absent : la
 *    résiliation d'un abonnement de boutique se fait dans les réglages du
 *    téléphone, et nulle part ailleurs.
 */
export class StoreBillingService implements BillingService {
  readonly name: string;
  readonly capability = 'store' as const;

  constructor(
    /** Le serveur, pour tout ce qui n'est pas l'acte de payer. */
    private readonly api: BillingService,
    private readonly store: NativeStore,
    /** Transmet la preuve d'achat au serveur, qui la fait vérifier. */
    private readonly confirm: (input: {
      familyId: ID;
      platform: 'apple' | 'google';
      token: string;
      productId: string;
    }) => Promise<Subscription | null>,
    /** Le jeton qui relie l'achat à la famille — voir `native.ts`. */
    private readonly accountToken: (familyId: ID) => Promise<string>,
    /**
     * L'offre promotionnelle signée par le serveur, quand la famille a un mois
     * à récupérer. Elle ne peut pas être signée ici : la clé d'App Store
     * Connect ne quitte jamais Supabase.
     */
    // Optionnel : une fausse boutique d'essai n'a pas de mois à récupérer, et
    // devoir en fournir un pour construire l'objet obligerait chaque test à
    // décrire une mécanique qu'il n'exerce pas.
    private readonly offreParrainage: () => Promise<{ offre: OffreApple; plan: Plan } | null> =
      async () => null,
  ) {
    this.name = `store-${store.platform}`;
  }

  /**
   * -------------------------------------------------- rattraper l'achat perdu
   *
   * **Le défaut, tel qu'il a été vécu.** Un parent paie sur Android, reçoit le
   * courriel de Google Play, revient dans Mino — et l'application lui annonce
   * toujours « essai gratuit ». Il ne peut donc pas non plus résilier : pour
   * Mino, il n'y a rien à résilier. Sur iPhone, le même parcours fonctionnait.
   *
   * **Pourquoi c'est arrivé, et pourquoi ça ne se voyait pas.** L'achat remonte
   * au serveur par `store-purchase`, dont l'échec était avalé — délibérément,
   * et c'était défendable : la notification serveur à serveur d'Apple ou de
   * Google réémet pendant des jours, et annoncer un échec au parent lui ferait
   * payer deux fois. Sauf que ce filet-là n'existe que s'il est tendu : côté
   * Play, il demande un sujet Pub/Sub déclaré dans la Play Console. Tant qu'il
   * ne l'est pas, il n'y a plus de second chemin — et le premier échoue en
   * silence. Deux filets qui se reposent l'un sur l'autre ne font pas un filet.
   *
   * **Ce qu'on ajoute.** Un troisième chemin, qui ne dépend d'aucune console :
   * la boutique du téléphone connaît les achats actifs de ce compte, et elle,
   * on peut la lire à tout moment. Quand le serveur ne nous donne pas un
   * abonnement payant alors que la boutique en tient un, on lui repasse la
   * preuve. C'est exactement ce que fait « Restaurer mes achats », mais sans
   * demander au parent de deviner qu'il doit y toucher.
   *
   * **Une seule fois par lancement**, et seulement quand le serveur ne connaît
   * pas déjà un abonnement payant : c'est un rattrapage, pas une source de
   * vérité, et interroger la boutique à chaque lecture ne ferait que ralentir
   * les familles dont tout va bien.
   */
  private rattrapage: Promise<boolean> | null = null;

  async getSubscription(familyId: ID): Promise<Subscription | null> {
    const connu = await this.api.getSubscription(familyId);

    // `offert` compris : une famille en accès offert n'a rien acheté à la
    // boutique, et il n'y a donc rien à y retrouver.
    const paye =
      connu?.status === 'active' || connu?.status === 'canceled' || connu?.status === 'offert';
    if (paye) return connu;

    if (!this.rattrapage) this.rattrapage = this.reconcilier(familyId);
    // Attendu, et c'est le point : rendre l'état périmé ferait afficher « essai
    // gratuit » à un parent qui vient de payer, et il faudrait qu'il relance
    // l'application pour voir la vérité. C'est exactement le défaut qu'on
    // répare. La lecture de la boutique est locale au téléphone.
    const retrouve = await this.rattrapage.catch(() => false);

    return retrouve ? await this.api.getSubscription(familyId).catch(() => connu) : connu;
  }

  /**
   * Repasser au serveur les preuves d'achat que la boutique détient.
   *
   * Rend `true` dès qu'une a été acceptée — c'est ce qui justifie de relire
   * l'abonnement. Silencieux par construction : un rattrapage qui échoue laisse
   * simplement les choses dans l'état où il les a trouvées, et le parent garde
   * « Restaurer mes achats », qui dit, lui, ce qui s'est passé.
   */
  private async reconcilier(familyId: ID): Promise<boolean> {
    /**
     * `achatsConnus` et **surtout pas** `restore` : celui-là commence par
     * demander à StoreKit de resynchroniser, ce qui peut faire surgir une
     * demande de mot de passe Apple. Acceptable derrière un bouton que le
     * parent a touché ; inacceptable au lancement de l'application.
     */
    const lire = this.store.achatsConnus?.bind(this.store);
    if (!lire) return false;
    const achats = await lire().catch(() => []);
    let repris = false;
    for (const achat of achats) {
      const abonnement = await this.confirm({
        familyId,
        platform: this.store.platform,
        token: achat.token,
        productId: achat.productId,
      }).catch(() => null);
      if (abonnement) repris = true;
    }
    return repris;
  }

  /**
   * Voir `BillingService.trialAvailable`. On répond `null` — « on ne sait
   * pas » — dès qu'un seul produit ne se prononce pas : sur iOS, la boutique ne
   * dit rien de l'offre d'introduction, et affirmer une absence qu'on n'a pas
   * constatée serait exactement la même faute, à l'envers.
   */
  async trialAvailable(): Promise<boolean | null> {
    const produits = await this.store.products().catch(() => []);
    if (produits.length === 0) return null;
    if (produits.some((p) => p.essaiOffert === undefined)) return null;
    return produits.some((p) => p.essaiOffert === true);
  }

  async startCheckout(input: { familyId: ID; plan: Plan }): Promise<CheckoutOutcome> {
    /**
     * La liste des formules, demandée hors de tout `catch`.
     *
     * **Le défaut, et il sortait du cadre par le haut.** Cet appel est le tout
     * premier du paiement, et c'est le plus fragile : il parle à StoreKit ou à
     * Play Billing, qui ne répondent pas dans un simulateur, pas sans compte de
     * test, pas dans un avion. L'exception remontait alors telle quelle,
     * jusqu'à l'écran, en anglais — la seule chose que ce dépôt refuse
     * partout ailleurs, et la seule que le parent voyait ici.
     *
     * Rendu comme un échec ordinaire, donc, avec la phrase de la boutique
     * quand elle en donne une : un parent qui nous la recopie nous donne le
     * diagnostic, là où « indisponible » ne donne rien.
     */
    let products;
    try {
      products = await this.store.products();
    } catch (erreur) {
      const dit = erreur instanceof Error ? erreur.message.trim() : '';
      return {
        kind: 'failed',
        reason: dit || 'La boutique n’a pas répondu. Réessayez dans un instant.',
      };
    }

    const product = products.find((p) => p.plan === input.plan);
    if (!product) return { kind: 'failed', reason: 'Cette formule n’est pas disponible ici.' };

    const accountToken = await this.accountToken(input.familyId);

    let purchase;
    try {
      purchase = await this.store.purchase({ productId: product.id, accountToken });
    } catch (erreur) {
      /**
       * Dire ce que la boutique a dit.
       *
       * Ce `catch` remplaçait toute erreur par « Le paiement n'a pas abouti »,
       * une phrase qui décrit le symptôme et rien d'autre. Or la boutique est
       * précise : elle distingue une preuve d'achat absente, un refus, un
       * produit indisponible, un compte non éligible. Tout cela arrivait ici et
       * repartait sous le même mot.
       *
       * Le premier achat en bac à sable a échoué exactement comme ça : la
       * feuille de paiement d'Apple s'était ouverte, l'achat avait été
       * confirmé, et l'écran n'a su dire que « n'a pas abouti ». Il a fallu
       * lire le code pour savoir quelles causes étaient seulement possibles.
       *
       * Le message d'une boutique n'est pas toujours joli, mais un parent qui
       * nous écrit en le recopiant nous donne le diagnostic ; « n'a pas abouti »
       * ne donne rien, et il faudra le lui demander.
       */
      const dit = erreur instanceof Error ? erreur.message.trim() : '';
      return { kind: 'failed', reason: dit || 'Le paiement n’a pas abouti.' };
    }

    // Refermer la feuille de paiement n'est pas un échec : c'est un choix, et
    // afficher une erreur rouge à quelqu'un qui a simplement hésité est le
    // meilleur moyen qu'il ne revienne pas.
    if (!purchase) return { kind: 'abandoned' };

    /**
     * Un refus sans appel ne s'annonce pas comme une réussite.
     *
     * **Le défaut, trouvé en recette, et il touchait tout le monde.** Le refus
     * du serveur repartait dans un `.catch(() => null)`, et l'écran suivant
     * s'ouvrait comme après un achat réussi. En face, aucun abonnement : ni
     * chez nous, ni chez Apple. Un parent croyait s'être abonné et découvrait
     * à la fin de son essai qu'il n'avait rien — c'est un remboursement et un
     * avis à une étoile.
     *
     * **Pourquoi ce n'était pas une négligence, et ce qu'on garde.** Quand la
     * confirmation échoue sur un réseau coupé ou un 502, l'achat, lui, a bien
     * eu lieu : la notification serveur à serveur arrivera, le rattrapage la
     * double, et crier à l'échec ferait payer une seconde fois. Cette
     * prudence-là reste, à la lettre.
     *
     * Ce qui change, c'est qu'on distingue enfin les deux. Un 4xx — « cet
     * achat appartient à un autre compte », une preuve refusée — dira la même
     * chose dans un mois : le parent doit l'apprendre maintenant, et savoir
     * quoi faire.
     */
    let refus: Error | null = null;
    const abonnement = await this.confirm({
      familyId: input.familyId,
      platform: this.store.platform,
      token: purchase.token,
      productId: purchase.productId,
    }).catch((erreur: unknown) => {
      if (estDefinitif(erreur)) refus = erreur as Error;
      return null;
    });

    if (refus) return { kind: 'failed', reason: (refus as Error).message };

    /**
     * Rouvrir la porte du rattrapage, et c'est indispensable ici.
     *
     * `getSubscription` ne tente le rattrapage qu'une fois par lancement — le
     * paywall l'a donc déjà consommé, quelques secondes plus tôt, à un moment
     * où il n'y avait effectivement rien à retrouver. Sans cette ligne, le
     * parent qui vient de payer et dont la confirmation a échoué resterait
     * devant « essai gratuit » jusqu'au prochain démarrage de l'application.
     */
    if (!abonnement) this.rattrapage = null;

    // Même si la confirmation a échoué, l'achat a bien eu lieu : la
    // notification serveur à serveur d'Apple ou de Google arrivera de toute
    // façon quand elle est configurée, et le rattrapage ci-dessus la double.
    // Annoncer un échec ici ferait payer deux fois.
    return { kind: 'done' };
  }

  /**
   * Restaurer, et distinguer les deux échecs qui n'ont rien à voir.
   *
   * **Le défaut que cela répare.** Cette méthode rendait `done` dès qu'un achat
   * était trouvé, même si TOUTES les vérifications avaient échoué. À l'écran,
   * cela donnait exactement la même chose qu'un succès : rien. Le parent
   * touche « Restaurer mes achats », il ne se passe rien, et il ne peut ni
   * savoir ni raconter pourquoi.
   *
   * Or les deux causes appellent des gestes opposés :
   *
   *   — **rien à restaurer** : la boutique ne connaît aucun achat sur ce
   *     compte. C'est au parent de vérifier avec quel identifiant il a payé.
   *   — **trouvé mais pas vérifié** : la preuve existe, c'est notre serveur qui
   *     l'a refusée. Le parent n'y peut rien, et c'est à nous de le savoir.
   *
   * À la différence d'un achat neuf, on ne peut pas se reposer ici sur la
   * notification serveur à serveur : Apple ne la réémet pas pour une
   * transaction ancienne qu'on redemande. Un échec silencieux laisserait donc
   * le parent sans abonnement et sans explication, indéfiniment.
   */
  async restore(familyId: ID): Promise<CheckoutOutcome> {
    const purchases = await this.store.restore().catch(() => []);
    if (purchases.length === 0) {
      return { kind: 'failed', reason: 'Aucun achat à restaurer sur ce compte.' };
    }

    let confirmes = 0;
    let dit = '';

    for (const purchase of purchases) {
      try {
        const abonnement = await this.confirm({
          familyId,
          platform: this.store.platform,
          token: purchase.token,
          productId: purchase.productId,
        });
        if (abonnement) confirmes += 1;
      } catch (erreur) {
        if (erreur instanceof Error && erreur.message.trim()) dit = erreur.message.trim();
      }
    }

    if (confirmes === 0) {
      return {
        kind: 'failed',
        reason:
          dit ||
          'Votre achat a bien été retrouvé, mais il n’a pas pu être vérifié. Réessayez dans un instant.',
      };
    }

    return { kind: 'done' };
  }

  /** Les réglages du téléphone : le seul endroit où la résiliation existe. */
  /**
   * Ouvrir la feuille de paiement avec l'offre du parrainage.
   *
   * Le serveur vérifie qu'il y a bien un mois dû avant de signer quoi que ce
   * soit : rien de ce qui décide n'est calculé ici. Et rien n'est décompté au
   * clic — c'est la notification d'Apple, une fois l'offre réellement
   * appliquée, qui retire le mois de l'ardoise. Un parent qui referme la
   * feuille ne perd rien.
   */
  async redeemReferralMonth(familyId: ID): Promise<CheckoutOutcome> {
    if (this.store.platform !== 'apple') {
      return { kind: 'failed', reason: 'Disponible seulement sur iPhone et iPad pour l’instant.' };
    }

    const signee = await this.offreParrainage().catch(() => null);
    if (!signee) return { kind: 'failed', reason: 'Aucun mois offert à récupérer.' };

    // La signature vaut pour UN produit : celui de la formule en cours, que le
    // serveur nomme avec l'offre. En choisir un autre ici invaliderait la
    // signature, et Apple ouvrirait la feuille au plein tarif sans rien dire.
    const cible = PRODUITS[signee.plan];

    const accountToken = await this.accountToken(familyId);

    let purchase;
    try {
      purchase = await this.store.purchase({ productId: cible, accountToken, offre: signee.offre });
    } catch (erreur) {
      const dit = erreur instanceof Error ? erreur.message.trim() : '';
      return { kind: 'failed', reason: dit || 'L’offre n’a pas pu être appliquée.' };
    }

    if (!purchase) return { kind: 'abandoned' };

    await this.confirm({
      familyId,
      platform: this.store.platform,
      token: purchase.token,
      productId: purchase.productId,
    }).catch(() => null);

    return { kind: 'done' };
  }

  /**
   * ------------------------------------------------ gérer, selon le rail réel
   *
   * **Le défaut, et le tunnel du site allait le rendre ordinaire.** Ces trois
   * méthodes étaient absentes, avec une bonne raison écrite juste ici : Apple
   * et Google n'exposent aucune API pour résilier ou changer de formule. Sauf
   * que l'absence était décidée sur **la plateforme** — on est dans
   * l'application, donc c'est une boutique — alors que ce qui compte est le
   * rail par lequel l'abonnement a été payé.
   *
   * Un parent qui s'abonne par Stripe sur minoapp.fr, puis installe
   * l'application, a un abonnement de source `stripe` dans un service qui se
   * croit forcément en boutique. `canCancelInApp()` rend alors `true` — il lit
   * la source, et il a raison — l'écran affiche donc le vrai bouton
   * « Résilier », le parent confirme… et `cancelSubscription()` du magasin
   * trouve `cancel` indéfini et **retourne sans rien faire**. Pas d'erreur, pas
   * d'indicateur : le parent croit avoir résilié, et se fait prélever le mois
   * suivant. C'est exactement le scénario que le commentaire d'origine
   * annonçait vouloir éviter, retourné.
   *
   * Il était atteignable avant le tunnel — il fallait payer sur le web puis
   * installer l'application. Le tunnel SEA en fait le chemin principal.
   *
   * On délègue donc au serveur quand la source n'est pas une boutique, et on
   * refuse bruyamment quand elle en est une. Un `throw` plutôt qu'un retour
   * silencieux : l'écran affiche le message sous les boutons.
   */
  private async railBoutique(familyId: ID): Promise<boolean> {
    const connu = await this.api.getSubscription(familyId).catch(() => null);
    // Rien de connu : on suppose la boutique, qui est le cas de cette classe.
    return connu ? isStore(connu.source) : true;
  }

  private static readonly VERS_LES_REGLAGES =
    'Cet abonnement a été souscrit dans une boutique. La gestion se fait dans les réglages de votre téléphone.';

  async openPortal(familyId: ID): Promise<{ url: string }> {
    if (!(await this.railBoutique(familyId))) return this.api.openPortal(familyId);
    return { url: manageSubscriptionUrl(this.store.platform === 'apple' ? 'apple' : 'google')! };
  }

  async cancel(familyId: ID): Promise<Subscription> {
    if (await this.railBoutique(familyId)) throw new Error(StoreBillingService.VERS_LES_REGLAGES);
    if (!this.api.cancel) throw new Error(StoreBillingService.VERS_LES_REGLAGES);
    return this.api.cancel(familyId);
  }

  async resume(familyId: ID): Promise<Subscription> {
    if (await this.railBoutique(familyId)) throw new Error(StoreBillingService.VERS_LES_REGLAGES);
    if (!this.api.resume) throw new Error(StoreBillingService.VERS_LES_REGLAGES);
    return this.api.resume(familyId);
  }

  /**
   * Changer de formule, et surtout pas en ouvrir une seconde.
   *
   * Même raisonnement, avec une conséquence plus chère si on la rate : sur un
   * rail Stripe, `startCheckout` créerait un second abonnement par-dessus celui
   * qui court, et la famille serait prélevée deux fois.
   */
  async changePlan(input: { familyId: ID; plan: Plan }): Promise<Subscription> {
    if (await this.railBoutique(input.familyId)) {
      throw new Error(StoreBillingService.VERS_LES_REGLAGES);
    }
    if (!this.api.changePlan) throw new Error(StoreBillingService.VERS_LES_REGLAGES);
    return this.api.changePlan(input);
  }

  listReferrals(familyId: ID): Promise<Referral[]> {
    return this.api.listReferrals(familyId);
  }

  redeemReferralCode(input: { familyId: ID; code: string }) {
    return this.api.redeemReferralCode(input);
  }
}
