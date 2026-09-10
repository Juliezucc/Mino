import { Subscription, accessOf } from './billing';

/**
 * Ce qui s'arrête quand plus personne ne paie.
 *
 * `hasAccess` existait depuis le début et n'était appelé nulle part : une
 * famille dont les trente jours d'essai étaient écoulés gardait l'application
 * entière, indéfiniment, gratuitement. La FAQ, elle, promettait au parent qu'il
 * paierait « à la fin de l'essai ».
 *
 * Le principe qui décide de tout le reste : **la pression tombe sur l'adulte,
 * jamais sur l'enfant.** Un enfant n'a pas choisi l'abonnement de ses parents,
 * ne peut rien y faire, et n'a rien à voir avec un moyen de paiement expiré. Il
 * ne doit donc jamais rencontrer de mur.
 *
 * D'où trois règles :
 *
 * 1. **Les minutes déjà gagnées ne bougent pas.** Jamais. Le registre est en
 *    ajout seul, et un abonnement qui s'arrête n'est pas un fait comptable.
 *    L'enfant continue de dépenser ce qu'il a mérité.
 * 2. **L'enfant continue de déclarer ses missions.** Elles s'empilent en
 *    attente, et le jour où le parent reprend l'abonnement, elles sont toutes
 *    là. Rien n'est détruit, rien n'est à refaire.
 * 3. **Ce qui s'arrête, c'est la main du parent** : confirmer, créer, offrir,
 *    lancer un autre écran. C'est-à-dire exactement ce pour quoi il paie.
 *
 * Conséquence sur les missions qui se comptent toutes seules : elles
 * redeviennent des missions ordinaires, en attente de confirmation. L'enfant
 * voit « ton parent confirme », une phrase qu'il connaît déjà — pas une
 * pancarte d'abonnement.
 */
export type GatedAction =
  /** Confirmer qu'une mission a bien été faite, et créditer les minutes. */
  | 'confirm'
  /** Créer, modifier ou supprimer une mission. */
  | 'mission.write'
  /** Ajouter ou modifier un profil enfant. */
  | 'child.write'
  /** Offrir des minutes, ou corriger un compteur. */
  | 'grant'
  /** Lancer le minuteur sur la console, la télé, l'ordinateur. */
  | 'other-screen';

/**
 * Verrouille sur un fait connu, jamais sur une ignorance.
 *
 * `subscription` vaut `null` dans deux cas qui n'ont rien à voir : au démarrage,
 * le temps que la facturation réponde, et quand elle ne répond pas du tout. Or
 * `accessOf(null)` vaut « expiré ». Traiter les deux pareil, c'est mettre
 * dehors une famille qui paie parce que son train est passé sous un tunnel.
 *
 * Le choix est donc de **laisser passer dans le doute**. Ce n'est pas de la
 * générosité, c'est une comparaison de coûts : quelques jours offerts par
 * erreur d'un côté, un parent furieux et un billet de support de l'autre — pour
 * un produit dont l'argument est la sérénité familiale.
 *
 * `grace` n'est pas verrouillé non plus, et c'est tout son sens : un
 * prélèvement qui échoue est presque toujours une carte expirée, pas une
 * famille qui part. Couper au premier échec ferait perdre des familles qui
 * voulaient rester.
 */
export function isLocked(
  subscription: Subscription | null,
  _action: GatedAction,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false;
  return accessOf(subscription, now).kind === 'expired';
}

/** Ce qu'on dit au parent, une fois, à l'endroit où il vient de buter. */
export const LOCKED_MESSAGE =
  'Votre essai est terminé. Reprenez l’abonnement pour confirmer les missions — celles déjà déclarées vous attendent, rien n’est perdu.';
