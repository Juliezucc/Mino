import { Plan, Referral, Subscription, manageSubscriptionUrl } from '@/domain/billing';
import { ID } from '@/domain/types';

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
    } catch {
      return { kind: 'failed', reason: 'Le paiement n’a pas abouti.' };
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

  async restore(familyId: ID): Promise<CheckoutOutcome> {
    const purchases = await this.store.restore().catch(() => []);
    if (purchases.length === 0) {
      return { kind: 'failed', reason: 'Aucun achat à restaurer sur ce compte.' };
    }

    for (const purchase of purchases) {
      await this.confirm({
        familyId,
        platform: this.store.platform,
        token: purchase.token,
        productId: purchase.productId,
      }).catch(() => null);
    }

    return { kind: 'done' };
  }

  /** Les réglages du téléphone : le seul endroit où la résiliation existe. */
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
