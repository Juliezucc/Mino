import { OffreApple } from '@/domain/offrePromo';
import { Plan } from '@/domain/billing';

/**
 * Le contrat avec la boutique du téléphone.
 *
 * Volontairement réduit à ce dont Mino a besoin, et volontairement indépendant
 * de la bibliothèque qui l'implémentera — RevenueCat aujourd'hui, autre chose
 * demain. C'est le même procédé que pour le blocage d'écran : une interface
 * ici, une implémentation native derrière, et rien du reste de l'application
 * qui sache laquelle.
 *
 * Ce que ce contrat n'a pas, et n'aura jamais :
 *
 * — **pas d'annulation.** Ni Apple ni Google n'exposent d'API pour résilier :
 *   c'est une décision qui appartient au compte du client, dans les réglages de
 *   son téléphone. Une méthode `cancel()` ici serait une méthode qui échoue.
 *
 * — **pas de vérité sur l'abonnement.** Ce que renvoie un achat est une
 *   preuve à faire valider **par le serveur**, pas un état à croire. Un reçu
 *   lu par le téléphone est un reçu qu'un téléphone peut fabriquer ; c'est la
 *   notification serveur à serveur d'Apple et de Google qui fait foi, comme le
 *   webhook Stripe fait foi sur le web.
 */

export interface StoreProduct {
  id: string;
  plan: Plan;
  /** Déjà formaté par la boutique, dans la devise et la langue de l'appareil. */
  priceLabel: string;
  priceEur: number;
  /**
   * La boutique accordera-t-elle vraiment l'essai gratuit ?
   *
   * **Le défaut que cela répare, et il promet ce qu'on ne tient pas.** L'écran
   * d'abonnement annonce « 0 € pendant 30 jours » à partir d'une constante,
   * c'est-à-dire à partir de rien : le jour où l'offre d'essai n'existe pas
   * dans la Play Console, ou n'a pas encore été validée, la feuille de paiement
   * de Google prélève immédiatement — sans erreur, sans avertissement. C'est ce
   * qui s'est produit sur un vrai téléphone : la promesse à l'écran, le débit
   * du jour même, et le courriel de Google qui annonce la reconduction un mois
   * plus tard. Un parent qui vit ça ne revient pas, et il a raison.
   *
   * `undefined` veut dire « on ne sait pas » — le cas d'iOS, où l'offre
   * d'introduction se règle dans App Store Connect et ne se lit pas ici — et
   * l'écran garde alors sa formulation habituelle. `false` est une information,
   * pas une panne : l'écran dit le vrai prix, tout de suite.
   */
  essaiOffert?: boolean;
}

export interface StorePurchase {
  productId: string;
  /**
   * La preuve d'achat, telle que la boutique la fournit. Elle n'est pas lue
   * ici : elle est transmise au serveur, qui la vérifie auprès d'Apple ou de
   * Google.
   */
  token: string;
  /**
   * Ce qui relie l'achat à la famille. Voir `storeAccountToken` ci-dessous.
   *
   * `null` quand la boutique ne le rend pas — c'est le cas de l'historique
   * qu'on relit pour restaurer un achat. Le serveur retrouve alors la famille
   * par le jeton d'authentification de l'appelant.
   */
  accountToken: string | null;
}

export interface NativeStore {
  readonly platform: 'apple' | 'google';

  /** Les formules réellement disponibles, prix compris — ils viennent de la boutique. */
  products(): Promise<StoreProduct[]>;

  /**
   * Ouvre la feuille de paiement du système. C'est Face ID et rien d'autre :
   * aucun formulaire, aucune carte à saisir, aucune sortie de l'application.
   */
  purchase(input: {
    productId: string;
    accountToken: string;
    /**
     * L'offre promotionnelle signée par le serveur — le mois offert du
     * parrainage, chez Apple. Absente pour un achat ordinaire.
     */
    offre?: OffreApple;
  }): Promise<StorePurchase | null>;

  /**
   * Rétablit un achat déjà payé. Apple l'exige explicitement — un client qui a
   * changé de téléphone doit retrouver son abonnement sans repayer, et une
   * application sans ce bouton est refusée à la revue.
   */
  restore(): Promise<StorePurchase[]>;

  /**
   * Les achats que la boutique tient déjà pour ce compte, **sans rien demander
   * à personne**.
   *
   * Le pendant silencieux de `restore()`, et la distinction est tout sauf
   * cosmétique : `restore()` commence par `restorePurchases()`, qui demande à
   * StoreKit de resynchroniser — et StoreKit peut alors réclamer le mot de
   * passe du compte Apple. C'est acceptable derrière un bouton que le parent a
   * touché ; c'est inacceptable au lancement de l'application, où cela donne
   * une demande de mot de passe surgie de nulle part.
   *
   * Celle-ci ne fait que lire ce qui est déjà là. Elle sert au rattrapage de
   * `StoreBillingService` : un achat payé dont la confirmation n'a pas atteint
   * notre serveur se retrouve ici, et repart tout seul.
   *
   * Facultative : une fausse boutique d'essai n'a pas à l'implémenter, et le
   * rattrapage se contente alors de ne rien trouver.
   */
  achatsConnus?(): Promise<StorePurchase[]>;
}

/**
 * L'identifiant qui relie un achat à une famille.
 *
 * C'est le détail que les intégrations ratent le plus souvent, et il n'y a
 * aucun rattrapage possible : au moment où Apple prévient le serveur qu'un
 * abonnement a été renouvelé ou annulé, la seule chose qui accompagne la
 * notification est ce jeton. S'il n'a pas été envoyé à l'achat, la
 * notification arrive sans savoir de quelle famille elle parle.
 *
 * Apple impose un UUID (`appAccountToken`), Google une chaîne opaque
 * (`obfuscatedAccountId`). Nos identifiants de famille n'étant ni l'un ni
 * l'autre, la base en attribue un à chaque famille — voir `store.sql`.
 */
export type StoreAccountToken = string;

let native: NativeStore | null = null;

/**
 * Substituer une boutique — une fausse dans les essais, une autre
 * implémentation le jour où `expo-iap` ne convient plus.
 *
 * Rien ne l'appelle en fonctionnement normal : `getBillingService()` construit
 * de lui-même la boutique de l'appareil (voir `ExpoIapStore`). Ce point
 * d'entrée existait avant elle et servait de promesse ; il sert maintenant à ce
 * pour quoi il est utile.
 */
export function setNativeStore(store: NativeStore | null) {
  native = store;
}

export function getNativeStore(): NativeStore | null {
  return native;
}
