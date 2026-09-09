import { Plan } from './billing';

/**
 * L'offre promotionnelle Apple qui délivre le mois du parrainage.
 *
 * **Pourquoi une offre, et pas simplement une date repoussée.** Chez Stripe on
 * recule la fin d'essai ou l'on porte un avoir au solde du client. Apple n'a ni
 * l'un ni l'autre : on ne lui demande pas de sauter un prélèvement. Le seul
 * dispositif prévu est l'offre promotionnelle — une période gratuite accordée à
 * un abonné existant, signée par notre serveur et acceptée par lui.
 *
 * **Pourquoi les deux identifiants ne se ressemblent pas.** App Store Connect
 * impose qu'un identifiant d'offre soit unique dans tout le **groupe**
 * d'abonnements, pas seulement sur un produit — et il reste réservé même après
 * suppression. `parrainage` a été posé sur le mensuel ; l'annuel a donc dû
 * prendre `parrainage_annuel`. Les tirets sont refusés par la console, d'où le
 * tiret bas.
 *
 * C'est laid, c'est sans conséquence — le serveur choisit d'après la formule —
 * et c'est écrit ici parce que personne ne le devinera dans six mois.
 */
export const OFFRE_PARRAINAGE: Record<Plan, string> = {
  monthly: 'parrainage',
  yearly: 'parrainage_annuel',
};

/**
 * Le séparateur qu'Apple impose entre les champs signés : U+2063, « invisible
 * separator ». Il ne se voit pas, ne se copie pas toujours, et une signature
 * assemblée avec autre chose est refusée sans explication.
 */
export const SEPARATEUR = '⁣';

export interface ChampsOffre {
  bundleId: string;
  keyId: string;
  productId: string;
  offerId: string;
  /** Le jeton de compte transmis à l'achat — le même que celui de la famille. */
  appAccountToken: string;
  nonce: string;
  /** En millisecondes, et Apple refuse au-delà de quelques minutes d'écart. */
  timestampMs: number;
}

/**
 * La charge à signer, dans l'ordre exact qu'Apple attend.
 *
 * L'ordre n'est pas négociable et ne produit aucun message d'erreur lisible
 * s'il est faux : la feuille de paiement s'ouvre au plein tarif, comme si
 * l'offre n'existait pas. C'est pour cela que cette fonction est pure et
 * couverte par des tests — c'est la seule partie de la chaîne qu'on puisse
 * vérifier sans un iPhone et un abonné.
 *
 * Le jeton de compte et le nonce sont **minuscules** : Apple compare la chaîne
 * signée à celle qu'il reconstruit, et il la reconstruit en minuscules.
 */
export function chargeOffre(champs: ChampsOffre): string {
  return [
    champs.bundleId,
    champs.keyId,
    champs.productId,
    champs.offerId,
    champs.appAccountToken.toLowerCase(),
    champs.nonce.toLowerCase(),
    String(champs.timestampMs),
  ].join(SEPARATEUR);
}

/**
 * Ce que StoreKit attend pour appliquer l'offre, et que seul le serveur peut
 * produire — la signature vient de la clé d'App Store Connect, qui ne quitte
 * jamais Supabase.
 */
export interface OffreApple {
  identifier: string;
  keyIdentifier: string;
  nonce: string;
  signature: string;
  timestamp: number;
}
