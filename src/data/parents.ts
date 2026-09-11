import { DomainError } from '@/domain/actions';

import { raisonDeLaFonction } from './erreurFonction';
import { getSupabaseClient } from './supabaseRepository';

/**
 * Juste assez de client pour ces deux appels.
 *
 * Le dépôt prend le sien par le constructeur — `new SupabaseRepository(client)`
 * — et c'est ce qui rend ses chemins d'erreur éprouvables sans monter un
 * serveur. Ces deux fonctions-ci passaient par le client global : un essai ne
 * pouvait rien en dire. Le paramètre est optionnel, donc aucun appelant ne
 * change.
 */
export interface ClientDeFonctions {
  functions: {
    invoke: (
      nom: string,
      options: { body: unknown },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

/**
 * Ajouter un second parent à la famille.
 *
 * **Pourquoi ça ne passe pas par le dépôt ordinaire.** La politique
 * `parents_insert` n'accepte une ligne que si elle porte le compte de
 * l'appelant ET que la famille n'a encore aucun parent — c'est ce qui empêche
 * la tablette d'un enfant de se déclarer parent. Une famille qui a déjà un
 * parent ne peut donc pas en écrire un second depuis l'application. La
 * permission est remplacée par une preuve : le code à quatre chiffres, vérifié
 * par le serveur, qui dit qu'un parent est là maintenant.
 *
 * **Un profil, pas un compte.** Le second parent rejoint avec le code famille,
 * comme le reste de la maison. Pas de mot de passe supplémentaire à retenir,
 * pas d'adresse à donner — et le même code à quatre chiffres, puisqu'il
 * appartient à la famille et non au compte.
 *
 * `code` n'est requis que depuis un appareil : le titulaire du compte est déjà
 * parent aux yeux de la base, et lui redemander son code là où il vient de
 * l'utiliser n'ajouterait rien.
 */
export async function ajouterParent(
  input: { prenom: string; code?: string },
  clientDonne?: ClientDeFonctions,
): Promise<{ id: string; prenom: string }> {
  const client = clientDonne ?? (getSupabaseClient() as ClientDeFonctions | null);
  if (!client) throw new DomainError('Mino n’est pas connecté à son serveur.');

  const { data, error } = await client.functions.invoke('ajouter-parent', {
    body: { prenom: input.prenom, code: input.code },
  });

  // Une `DomainError`, jamais une `Error` : le magasin n'affiche que celles-là,
  // et tout le reste retombe dans « Impossible de joindre Mino ».
  if (error) {
    throw new DomainError(
      await raisonDeLaFonction(error, 'Ce parent n’a pas pu être ajouté.'),
    );
  }

  const parent = (data as { parent?: { id?: string; display_name?: string } } | null)?.parent;
  if (!parent?.id) throw new DomainError('Ce parent n’a pas pu être ajouté.');

  return { id: parent.id, prenom: parent.display_name ?? input.prenom };
}

/**
 * Reprendre un profil de parent sur CET appareil-ci.
 *
 * **Deux usages, un seul geste.** L'appairage ordinaire — « c'est le téléphone
 * de Marc », à l'installation — et le téléphone de remplacement, quand
 * l'ancien est cassé, perdu ou revendu. Dans les deux cas la question est la
 * même : quel appareil porte ce parent, maintenant ?
 *
 * **Et il révoque en rattachant.** Les droits d'un second parent tiennent au
 * `user_id` de son appareil ; le serveur l'écrase. L'ancien téléphone cesse
 * d'être parent à la seconde même, sans démarche séparée que personne ne
 * penserait à faire.
 *
 * Le code est exigé : sans lui, le code FAMILLE — celui que les enfants
 * connaissent, puisqu'il leur sert à s'appairer — suffirait à se déclarer
 * parent et à tout ouvrir.
 */
export async function rattacherParent(
  input: { id: string; code: string },
  clientDonne?: ClientDeFonctions,
): Promise<{ id: string; prenom: string }> {
  const client = clientDonne ?? (getSupabaseClient() as ClientDeFonctions | null);
  if (!client) throw new DomainError('Mino n’est pas connecté à son serveur.');

  const { data, error } = await client.functions.invoke('ajouter-parent', {
    body: { rattacher: input.id, code: input.code },
  });

  if (error) {
    throw new DomainError(await raisonDeLaFonction(error, 'Ce profil n’a pas pu être repris.'));
  }

  const parent = (data as { parent?: { id?: string; display_name?: string } } | null)?.parent;
  if (!parent?.id) throw new DomainError('Ce profil n’a pas pu être repris.');

  return { id: parent.id, prenom: parent.display_name ?? '' };
}

/**
 * Retirer un parent qui n'a pas de compte.
 *
 * Un prénom mal tapé serait autrement définitif : les doublons sont refusés à
 * l'ajout, et `parents_update` n'autorise chacun que sur sa propre ligne. Le
 * serveur refuse de retirer le titulaire du compte — celui-là se supprime
 * depuis son propre écran, avec tout ce que cela emporte.
 *
 * C'est aussi la seule façon de révoquer un appareil devenu parent : le code
 * à quatre chiffres ne le fait plus, puisqu'il inscrit durablement. Un geste
 * visible vaut mieux qu'un code changé en espérant.
 */
export async function retirerParent(
  input: { id: string; code?: string },
  clientDonne?: ClientDeFonctions,
): Promise<void> {
  const client = clientDonne ?? (getSupabaseClient() as ClientDeFonctions | null);
  if (!client) throw new DomainError('Mino n’est pas connecté à son serveur.');

  const { error } = await client.functions.invoke('ajouter-parent', {
    body: { retirer: input.id, code: input.code },
  });

  if (error) {
    throw new DomainError(await raisonDeLaFonction(error, 'Ce parent n’a pas pu être retiré.'));
  }
}
