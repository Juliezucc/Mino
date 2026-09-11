import { ID, Parent } from './types';

/**
 * Le parent à qui appartient un appareil.
 *
 * **Ce que le repli protège.** Sur le téléphone du titulaire du compte,
 * `parentId` n'a jamais été posé — il n'y avait qu'un parent au moment où ce
 * téléphone a été installé, et rien ne le posera rétroactivement. Rendre
 * `null` là ferait disparaître le prénom des salutations d'un parent qui n'a
 * rien changé à son installation.
 *
 * **Et ce qu'il rattrape.** Un profil de parent peut être retiré depuis un
 * autre appareil ; celui qui le portait garde un identifiant qui ne désigne
 * plus personne. On préfère saluer le mauvais prénom qu'afficher un vide, ou
 * pire, le mot « null ».
 */
export function parentDeLAppareil(parents: Parent[], parentId: ID | null): Parent | null {
  const nomme = parentId ? parents.find((p) => p.id === parentId) : undefined;
  return nomme ?? parents[0] ?? null;
}

/**
 * Le titulaire du compte : celui dont l'ADRESSE permet de revenir.
 *
 * **Ce n'était pas ça, et c'était fragile.** La règle écrite partout était
 * « c'est `parents[0]` », au motif que sa ligne est créée en premier. Mais elle
 * arrive d'un `select` sans `order by` : PostgreSQL ne promet alors aucun
 * ordre, et il peut changer d'un chargement à l'autre — après une mise à jour
 * de ligne, un `VACUUM`, un plan différent. Le jour où il s'inverse, l'écran du
 * compte propose l'adresse de l'un et le mot de passe de l'autre.
 *
 * Le vrai critère n'a jamais été l'ordre : c'est l'adresse. Elle est ce qui
 * permet de se reconnecter depuis un autre téléphone, donc ce qui distingue le
 * compte d'un parent dont l'identité vit dans l'application installée sur SON
 * appareil. `delete_my_account()` compte exactement la même chose, et les deux
 * doivent dire la même chose ou la famille se perd.
 *
 * Le repli sur le premier reste, pour l'instant de l'inscription où l'adresse
 * n'est pas encore posée : la famille n'a alors qu'un parent, et c'est lui.
 */
export function titulaireDuCompte(parents: Parent[]): Parent | null {
  return parents.find((p) => !!p.email?.trim()) ?? parents[0] ?? null;
}

/**
 * Un second parent, ou le titulaire du compte.
 *
 * La différence tient à l'ADRESSE, et à rien d'autre. Les deux sont de vrais
 * parents aux yeux de la base — le second porte le `user_id` de son appareil,
 * c'est ce qui lui permet de créer une mission et pas seulement de la
 * regarder. Ce qui les sépare, c'est de pouvoir revenir : une adresse et un
 * mot de passe ouvrent la famille depuis n'importe quel téléphone, l'identité
 * d'un appareil ne survit pas à sa perte.
 *
 * C'est la raison pour laquelle un second parent ne peut ni changer l'adresse,
 * ni résilier l'abonnement, ni supprimer la famille — et `delete_my_account()`
 * compte la même chose, ou la famille se perdrait.
 */
export function estSecondParent(parent: Parent, parents: Parent[]): boolean {
  return parent.id !== titulaireDuCompte(parents)?.id;
}
