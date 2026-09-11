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
 * Le titulaire du compte : celui dont l'adresse ouvre la session.
 *
 * C'est `parents[0]`, et la raison n'est pas l'ordre d'affichage : la ligne du
 * titulaire est écrite à la création de la famille, et les profils ajoutés
 * ensuite arrivent après. Le nommer ici évite que chaque écran redécouvre la
 * règle — et qu'un jour l'un d'eux confonde « le premier de la liste » avec
 * « celui qui tient le téléphone ».
 */
export function titulaireDuCompte(parents: Parent[]): Parent | null {
  return parents[0] ?? null;
}

/**
 * Un profil, ou le compte.
 *
 * La différence tient au `email` — le serveur écrit `null` sur les deux
 * colonnes d'un profil, et `delete_my_account()` compte les `user_id` non nuls
 * pour décider si une famille survit à son titulaire. `user_id` n'existe pas
 * dans ce document : c'est une colonne que le client ne lit jamais, et c'est
 * volontaire. L'absence d'adresse est le même fait, vu d'ici.
 */
export function estProfilSansCompte(parent: Parent, parents: Parent[]): boolean {
  return parent.id !== titulaireDuCompte(parents)?.id;
}
