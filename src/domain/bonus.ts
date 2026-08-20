/**
 * Le bonus, vu depuis l'enfant.
 *
 * Un parent peut offrir des minutes sans mission — un beau geste, un mercredi
 * pluvieux, un effort qui ne rentrait dans aucune case. Côté parent c'est déjà
 * fait ; côté enfant, jusqu'ici, les minutes apparaissaient sur le compteur
 * sans que rien ne dise d'où elles venaient. Un cadeau qu'on ne voit pas
 * arriver n'est pas un cadeau.
 *
 * Deux contraintes commandent tout ce qui suit.
 *
 * **Le registre ne se modifie pas.** On ne peut donc pas marquer une
 * transaction « déjà fêtée » comme on marque une mission : ce serait modifier
 * une ligne du journal, ce que rien dans Mino ne fait jamais. Le souvenir de
 * ce qui a été fêté vit donc **sur l'appareil**, pas dans les données — et
 * c'est exact, puisque fêter est un événement d'écran, pas un fait comptable.
 *
 * **Un cadeau se fête sur le moment, ou pas du tout.** Une fenêtre courte
 * évite qu'une réinstallation, ou un enfant qui n'a pas ouvert l'application
 * de la semaine, déclenche une célébration pour un bonus oublié depuis
 * longtemps.
 */

import { ScreenTimeTransaction } from './types';

/**
 * Au-delà, on ne fête plus.
 *
 * Un jour : assez pour couvrir un bonus donné le soir et découvert le
 * lendemain matin, trop peu pour ressortir un cadeau de la semaine dernière au
 * visage d'un enfant qui ne s'en souvient plus.
 */
export const BONUS_WINDOW_HOURS = 24;

/**
 * Le bonus qui mérite une célébration, s'il y en a un.
 *
 * `seenId` est le dernier bonus déjà fêté **sur cet appareil**. Renvoie null
 * quand il n'y a rien de neuf, rien d'assez récent, ou rien du tout.
 */
export function pendingBonus(
  transactions: ScreenTimeTransaction[],
  childId: string,
  seenId: string | null,
  now: Date = new Date(),
): ScreenTimeTransaction | null {
  const cutoff = now.getTime() - BONUS_WINDOW_HOURS * 60 * 60 * 1000;

  const latest = transactions
    .filter((t) => t.childId === childId && t.kind === 'bonus' && t.delta > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!latest) return null;
  if (latest.id === seenId) return null;
  if (new Date(latest.createdAt).getTime() < cutoff) return null;

  return latest;
}

/**
 * Ce que Mino dit en apportant le bonus.
 *
 * La raison écrite par le parent passe avant tout : c'est elle qui donne sa
 * valeur au geste. « Belle journée » vaut mieux que n'importe quelle formule
 * que nous pourrions inventer, et un bonus sans explication n'est qu'un
 * chiffre de plus sur un compteur.
 */
export function bonusHeadline(reason: string): string {
  const clean = reason.trim();
  return clean.length > 0 ? clean : 'Juste comme ça 💙';
}
