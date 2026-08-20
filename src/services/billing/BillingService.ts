import { Plan, Referral, Subscription } from '@/domain/billing';
import { ID } from '@/domain/types';

/**
 * Tout ce que l'application attend de qui encaisse.
 *
 * Deux rails derrière cette interface, et ce n'est pas un choix : Apple et
 * Google exigent leur propre système dès qu'un paiement débloque une
 * fonctionnalité numérique **dans** l'application. Sur le web, Stripe, moins
 * cher et sans intermédiaire. Le même abonnement des deux côtés, parce que la
 * vérité est côté serveur et non côté rail.
 *
 * Ce que l'application ne fait jamais, quel que soit le rail : décider qu'un
 * abonnement est valide. Elle transmet une preuve, le serveur la vérifie —
 * webhook Stripe d'un côté, notification serveur à serveur d'Apple ou de
 * Google de l'autre. Un client qui pourrait s'accorder un abonnement est un
 * client à qui on demandera de le faire.
 */

/**
 * Ce qui se passe quand quelqu'un choisit une formule.
 *
 * Un seul type pour les deux rails, parce que l'écran ne doit pas avoir à
 * savoir lequel est branché : sur le web on ouvre une adresse, dans
 * l'application la feuille de paiement du système s'ouvre et se referme sur
 * place.
 */
export type CheckoutOutcome =
  /** Web : à ouvrir dans le navigateur, rien n'est encore payé. */
  | { kind: 'url'; url: string }
  /** Boutique : payé, et le serveur en a été prévenu. */
  | { kind: 'done' }
  /** L'utilisateur a refermé la feuille de paiement. Ce n'est pas une erreur. */
  | { kind: 'abandoned' }
  | { kind: 'failed'; reason: string };

export interface BillingService {
  readonly name: string;
  /**
   * `none` means nothing can be charged — the local stand-in used in
   * development and in the demo. The UI uses this to say so honestly rather
   * than pretending a checkout happened.
   */
  readonly capability: 'none' | 'stripe-web' | 'store';

  getSubscription(familyId: ID): Promise<Subscription | null>;

  /** Web : renvoie l'adresse à ouvrir. Boutique : achète sur place. */
  startCheckout(input: {
    familyId: ID;
    plan: Plan;
    /** Applied by the backend, never trusted from the client alone. */
    referralCode?: string;
  }): Promise<CheckoutOutcome>;

  /**
   * Rétablir un achat déjà payé.
   *
   * Absent sur le web, où l'abonnement suit le compte et non l'appareil.
   * Obligatoire sur les boutiques : Apple refuse à la revue toute application
   * qui vend un abonnement sans ce bouton, et un client qui change de
   * téléphone doit retrouver le sien sans repayer.
   */
  restore?(familyId: ID): Promise<CheckoutOutcome>;

  /**
   * Où l'on gère son abonnement : changer de formule, mettre à jour sa carte,
   * résilier. Cela doit rester atteignable en trois clics — c'est une
   * obligation légale en France, pas une politesse.
   *
   * Sur les boutiques, cette adresse est celle des réglages du téléphone :
   * c'est le seul endroit où la résiliation existe réellement.
   */
  openPortal(familyId: ID): Promise<{ url: string }>;

  /**
   * Résilier sans quitter l'application.
   *
   * Absent sur les boutiques, et cette absence est le sujet : ni Apple ni
   * Google n'exposent d'API d'annulation. Une implémentation ici serait une
   * méthode qui échoue en silence sous un bouton qui promet le contraire —
   * l'écran doit donc renvoyer vers `openPortal`, pas appeler ceci.
   */
  cancel?(familyId: ID): Promise<Subscription>;

  /** Undo a pending cancellation, while the period is still running. */
  resume?(familyId: ID): Promise<Subscription>;

  /** The families this one has brought in, and where each of them stands. */
  listReferrals(familyId: ID): Promise<Referral[]>;

  /**
   * Enter someone else's code. The reward is a longer trial for the newcomer;
   * the referrer's free month is only earned once this family actually pays,
   * which is a decision the backend makes, not the app.
   */
  redeemReferralCode(input: {
    familyId: ID;
    code: string;
  }): Promise<{ ok: boolean; reason?: string; subscription?: Subscription }>;
}
