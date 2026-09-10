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

/**
 * ---------------------------------------------------------------- l'inscription abandonnée
 *
 * **Le défaut, tel qu'il a été vécu.** Un parent commence son inscription,
 * revient en arrière d'un geste — ou son téléphone sonne, ou l'application est
 * fermée — et à la réouverture il est dans l'espace parent. Pas au paywall :
 * DANS l'application, avec une famille qui existe, sans avoir rien payé, sans
 * avoir donné son prénom. L'écran de choix de profil affiche « null · protégé
 * par un code », parce que c'est littéralement ce qui a été enregistré.
 *
 * **D'où ça vient, et ce n'est pas un accident.** La famille se fonde au
 * PREMIER écran, celui du prénom de l'enfant : il faut une famille pour avoir
 * un enfant à qui l'attacher. Le parent, lui, ne se présente que deux écrans
 * plus loin. Entre les deux, la famille existe et le compte n'existe pas.
 *
 * À partir de cet instant, `app/index.tsx` voyait une famille et faisait ce
 * qu'il fait toujours : il ouvrait l'application. Le paywall, l'adresse
 * e-mail et le mot de passe étaient sautés — non par une faille, mais parce
 * que plus rien ne les réclamait. La famille était utilisable et
 * irrécupérable : sans identifiants, une déconnexion la perdait pour de bon.
 *
 * **Ce qu'on lit ici.** Un parent sans prénom est un parent qui n'a jamais
 * atteint l'écran de compte. C'est le signal le plus sûr dont on dispose :
 * `createAccount` écrit le prénom, l'adresse et le mot de passe d'un seul
 * geste — il n'y a pas d'état où l'un existerait sans les autres.
 *
 * **Ce qu'on ne prend pas pour un abandon.** L'absence totale de ligne parent :
 * c'est ce que voit l'appareil d'un enfant arrivé par code famille, et le
 * renvoyer vers une inscription serait absurde. On n'agit que sur un parent
 * présent ET sans nom.
 */
export function inscriptionInachevee(data: FamilyData): boolean {
  const parent = data.parents[0];
  if (!parent) return false;
  return !parent.displayName?.trim();
}
