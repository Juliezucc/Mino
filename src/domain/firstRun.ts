import { FamilyData } from './types';

/**
 * La boucle du produit n'a-t-elle jamais tourné, pas même à moitié ?
 *
 * Trouvé en conduisant la vraie première ouverture, sans la démo : après avoir
 * créé son compte, son enfant et sa première mission, un parent arrivait sur
 * un tableau de bord qui lui disait **trois fois** qu'il n'y avait rien — «
 * Tout est à jour », « Aucune demande en attente », « Rien pour l'instant » —
 * et nulle part ce qu'il devait faire ensuite. C'est le moment exact où
 * quelqu'un referme une application pour de bon : il a fait tout le travail
 * d'installation et n'a rien vu se produire.
 *
 * La règle regarde **les trois journaux à la fois**, et il faut les trois.
 *
 * Une première version ne regardait que le registre des minutes. Elle était
 * fausse, et dangereusement : quand l'enfant appuyait sur « J'ai terminé », il
 * n'écrivait qu'une complétion en attente — aucune minute — donc la famille
 * restait « débutante », donc l'écran gardait l'invite « à lui de jouer » et
 * masquait la section des demandes. **La toute première mission de la toute
 * première famille devenait impossible à confirmer.** Le compteur ne bougeait
 * jamais, et rien n'expliquait pourquoi.
 *
 * Découvert en conduisant le parcours, pas en le relisant : l'en-tête disait
 * bien « 1 demande vous attend », juste au-dessus d'un écran où elle n'était
 * nulle part.
 *
 * Ce qu'on ne prend pas comme signal : ni « compte créé récemment », qui
 * vieillit mal — un parent qui installe le samedi et s'y met le mercredi a
 * toujours besoin de la même phrase — ni un drapeau « guide vu », qui se
 * désynchronise entre les appareils de la famille. Ce qui compte, c'est qu'il
 * ne se soit rien passé, et cela se lit dans les données.
 */
export function isFirstRun(data: FamilyData): boolean {
  return (
    data.children.length > 0 &&
    data.transactions.length === 0 &&
    data.completions.length === 0 &&
    data.sessions.length === 0
  );
}
