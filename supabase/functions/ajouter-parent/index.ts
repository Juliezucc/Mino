// Ajouter un second parent à la famille.
//
// **Pourquoi une fonction, et pas une écriture ordinaire.** La politique
// `parents_insert` n'accepte une ligne que si `user_id = auth.uid()` ET que la
// famille n'a encore aucun parent. C'est ce qui empêche la tablette d'un enfant
// de se déclarer parent, et il n'est pas question d'y toucher. Une famille qui
// a déjà un parent ne peut donc pas en écrire un second depuis l'application,
// quelles que soient les bonnes intentions de qui tient l'appareil.
//
// **Ce qui remplace la permission : la preuve.** Le code à quatre chiffres
// appartient à la famille, et son blocage — cinq essais, cinq minutes, compté
// sur la ligne de la famille — le rend tenable. Un appareil qui le présente
// prouve qu'un parent est là, maintenant. C'est exactement la mécanique de
// `valider-mission`, et il n'y a aucune raison d'en inventer une autre.
//
// **Un profil, pas un compte.** La ligne créée n'a ni `user_id` ni `email` :
// le second parent rejoint avec le code famille, comme tout le monde, et n'a
// pas de mot de passe de plus à retenir. Le schéma le prévoit déjà — « un
// parent qui n'a pas encore donné son adresse n'en a pas, `null` le dit ».
//
// **Et le retirer.** Même porte, même preuve : `{ retirer: "par_..." }`. Seule
// une ligne SANS compte peut partir — le titulaire du compte se supprime depuis
// son propre écran, avec tout ce que cela emporte. Sans ce chemin, un prénom
// mal tapé serait définitif, puisque les doublons sont refusés et que
// `parents_update` n'autorise que sa propre ligne.
//
// Déploiement :  supabase functions deploy ajouter-parent

import { admin, appelant, env, fail, json, servir } from '../_shared/mino.ts';

/**
 * Combien de parents une famille peut porter.
 *
 * Deux suffisent à l'immense majorité, mais une famille recomposée en compte
 * quatre sans rien d'anormal. La borne n'est pas là pour décrire les familles :
 * elle est là pour qu'un appareil qui aurait le code ne puisse pas remplir la
 * table. Au-delà, on refuse en le disant.
 */
const MAX_PARENTS = 4;

/** Voir `valider-mission` : le code se vérifie avec le jeton de l'appelant, jamais en administrateur. */
async function codeAccepte(request: Request, code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) return false;

  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return false;

  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });

  const { data, error } = await anon.rpc('verify_parent_pin', { p_pin: code });
  return !error && data === true;
}

Deno.serve(
  servir(async (request) => {
    const qui = await appelant(request);
    if (!qui) return fail('Non authentifié.', 401);

    let corps: { prenom?: unknown; code?: unknown; retirer?: unknown };
    try {
      corps = await request.json();
    } catch {
      return fail('Requête illisible.', 400);
    }

    const retirer = typeof corps.retirer === 'string' ? corps.retirer : '';
    const prenom = typeof corps.prenom === 'string' ? corps.prenom.trim().slice(0, 30) : '';
    if (!retirer && !prenom) return fail('Indiquez le prénom du parent.', 400);

    /**
     * Le titulaire du compte n'a rien à prouver : il EST parent, la base le
     * dit. Un appareil, lui, présente le code — c'est la seule chose qui
     * distingue le parent debout devant l'écran de l'enfant qui le tient.
     */
    if (qui.role === 'device' && !(await codeAccepte(request, corps.code))) {
      return fail('Code parent incorrect.', 403);
    }

    const db = admin();

    if (retirer) {
      /**
       * `family_id` ET `user_id is null`, les deux dans la même clause.
       *
       * Le premier borne le geste à sa propre famille — la clé de service
       * ignore la RLS, et un identifiant est ce qu'il y a de plus facile à
       * deviner. Le second protège le titulaire du compte : sa ligne porte la
       * famille, l'abonnement et la seule adresse qui permette de se
       * reconnecter. On ne la retire pas d'un écran de réglages ; il y a un
       * parcours entier pour cela, avec un mot à écrire.
       */
      const { data: parti, error: erreurRetrait } = await db
        .from('parents')
        .delete()
        .eq('id', retirer)
        .eq('family_id', qui.familyId)
        .is('user_id', null)
        .select('id')
        .maybeSingle();

      if (erreurRetrait) {
        console.error('retrait de parent impossible', qui.familyId, erreurRetrait.message);
        return fail('Ce parent n’a pas pu être retiré. Réessayez dans un instant.', 500);
      }
      if (!parti) {
        return fail('Ce parent ne peut pas être retiré depuis ici.', 409);
      }
      return json({ retire: parti.id });
    }

    const { data: existants } = await db
      .from('parents')
      .select('id, display_name')
      .eq('family_id', qui.familyId);

    const parents = existants ?? [];
    if (parents.length >= MAX_PARENTS) {
      return fail(`Une famille peut compter jusqu’à ${MAX_PARENTS} parents.`, 409);
    }

    /**
     * Deux fois le même prénom n'est pas une erreur de saisie, c'est une
     * erreur d'usage : l'appareil ne saurait plus lequel il désigne, et les
     * validations s'attribueraient au hasard. On le dit plutôt que d'écrire une
     * ambiguïté que personne ne pourra défaire ensuite.
     */
    const deja = parents.some(
      (p) => (p.display_name as string | null)?.trim().toLowerCase() === prenom.toLowerCase(),
    );
    if (deja) return fail(`Il y a déjà un parent qui s’appelle ${prenom}.`, 409);

    const { data: cree, error } = await db
      .from('parents')
      .insert({
        id: `par_${crypto.randomUUID()}`,
        family_id: qui.familyId,
        display_name: prenom,
        // Ni compte, ni adresse : ce parent rejoint par le code famille. Le
        // schéma dit la même chose — l'absence d'adresse s'écrit `null`, pas
        // par une chaîne vide qui mentirait sur son contenu.
        user_id: null,
        email: null,
      })
      .select('id, display_name')
      .maybeSingle();

    if (error) {
      console.error('ajout de parent impossible', qui.familyId, error.message);
      return fail('Ce parent n’a pas pu être ajouté. Réessayez dans un instant.', 500);
    }

    return json({ parent: cree });
  }),
);
