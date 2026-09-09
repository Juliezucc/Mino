import { PRODUITS, Plan, Referral, Subscription, manageSubscriptionUrl } from '@/domain/billing';
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

  getSubscription(familyId: ID): Promise<Subscription | null> {
    return this.api.getSubscription(familyId);
  }

  async startCheckout(input: { familyId: ID; plan: Plan }): Promise<CheckoutOutcome> {
    const products = await this.store.products();
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

    await this.confirm({
      familyId: input.familyId,
      platform: this.store.platform,
      token: purchase.token,
      productId: purchase.productId,
    }).catch(() => null);

    // Même si la confirmation a échoué, l'achat a bien eu lieu : la
    // notification serveur à serveur d'Apple ou de Google arrivera de toute
    // façon, et c'est elle qui fait foi. Annoncer un échec ici ferait payer
    // deux fois.
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

  async openPortal(): Promise<{ url: string }> {
    return { url: manageSubscriptionUrl(this.store.platform === 'apple' ? 'apple' : 'google')! };
  }

  // `cancel` et `resume` sont absents, et c'est le sujet : Apple et Google ne
  // les exposent pas. L'écran d'abonnement le sait et renvoie vers openPortal.

  listReferrals(familyId: ID): Promise<Referral[]> {
    return this.api.listReferrals(familyId);
  }

  redeemReferralCode(input: { familyId: ID; code: string }) {
    return this.api.redeemReferralCode(input);
  }
}
