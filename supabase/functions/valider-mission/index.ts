// Confirmer une mission depuis la tablette de l'enfant.
//
// **Le geste que le produit promet, et qu'il ne tenait pas.** L'enfant termine
// sa mission sur sa tablette, le parent est à côté de lui : il devait aller
// chercher son propre téléphone pour confirmer. Le geste qui donne sa valeur
// au système était devenu le plus pénible de la journée.
//
// Depuis que le code parent appartient à la famille, il OUVRE bien l'espace
// parent sur cette tablette — `auth_family_ids()` unionne `family_devices`.
// Mais il n'y écrit rien : `mission_completions_update` et
// `screen_time_transactions_insert` exigent `auth_is_parent()`, qui ne lit que
// la table `parents`. Le parent appuyait sur « Valider », l'écriture était
// refusée, et l'application affichait « Impossible de joindre Mino » — un
// message de réseau pour un mur permanent.
//
// **Pourquoi une fonction Edge et non une politique plus large.** Ouvrir la
// RLS à un appareil armerait une exception contre elle-même : l'insertion
// auto-approuvée de `mission_completions` tire son autorité de la ligne
// `missions`, « which no device can write ». Un client modifié poserait
// `auto_approve = true` et `minutes = 600`, puis s'auto-créditerait par une
// porte déjà ouverte. Ici l'appareil reste incapable d'écrire lui-même : il
// demande, on vérifie, et c'est la clé de service qui écrit.
//
// **La frontière est une question de présence, pas de propriété.** La base
// répond à « cette session appartient-elle à un parent ». La question du
// produit est autre : « un adulte est-il devant cet écran, maintenant ». Le
// code à quatre chiffres y répond, et son blocage — cinq essais, cinq minutes,
// compté sur la ligne de la FAMILLE — le rend tenable : il ne se contourne pas
// en changeant d'appareil.
//
// Déploiement :  supabase functions deploy valider-mission

import { admin, appelant, env, fail, json, servir } from '../_shared/mino.ts';

/**
 * Vérifier le code avec le jeton de l'appelant, et jamais avec la clé de
 * service.
 *
 * **Sans cette précaution, le blocage disparaît en silence.**
 * `verify_parent_pin` lit `auth.uid()` pour retrouver la famille. Appelée par
 * un client administrateur, `auth.uid()` est nul : la fonction rend `false`
 * sans rien compter, et les cinq essais par cinq minutes cessent d'exister —
 * un enfant pourrait alors parcourir les dix mille combinaisons.
 *
 * Avec le jeton de l'appelant, c'est la fonction SQL qui décide, avec son
 * compteur d'échecs et son verrou. On ne réimplémente rien.
 */
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

/** Postgres : violation d'unicité. */
const DEJA = '23505';

Deno.serve(
  servir(async (request) => {
    const qui = await appelant(request);
    if (!qui) return fail('Non authentifié.', 401);

    let corps: { completionId?: unknown; decision?: unknown; code?: unknown };
    try {
      corps = await request.json();
    } catch {
      return fail('Requête illisible.', 400);
    }

    const completionId = typeof corps.completionId === 'string' ? corps.completionId : '';
    const valider = corps.decision === 'valider';
    if (!completionId || (corps.decision !== 'valider' && corps.decision !== 'refaire')) {
      return fail('Demande incomplète.', 400);
    }

    /**
     * Le téléphone du parent ne change pas de chemin.
     *
     * Sa session passe déjà les politiques : lui demander le code ici
     * casserait le parent qui vient de se connecter — il est « déverrouillé »
     * sans qu'aucun code ne soit en mémoire.
     */
    if (qui.role === 'device' && !(await codeAccepte(request, corps.code))) {
      // Jamais distinguer « code faux » de « compte bloqué » dans la même
      // réponse : l'écran sait poser la seconde question séparément, et les
      // confondre dirait à un enfant patient s'il approche.
      return fail('Code parent incorrect.', 403);
    }

    const db = admin();

    // La famille vient du jeton, jamais du corps : sans cette égalité, un
    // identifiant de complétion deviné ouvrirait la famille d'à côté.
    const { data: completion } = await db
      .from('mission_completions')
      .select('id, family_id, child_id, mission_id, status, minutes_requested')
      .eq('id', completionId)
      .eq('family_id', qui.familyId)
      .maybeSingle();

    if (!completion) return fail('Demande introuvable.', 404);

    const { data: parent } = await db
      .from('parents')
      .select('id')
      .eq('family_id', qui.familyId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const reviewedBy = (parent?.id as string | undefined) ?? qui.userId;
    const quand = new Date().toISOString();

    /* ------------------------------------------------------------ refaire */
    /**
     * Renvoyer une mission n'écrit JAMAIS au registre — et cette branche n'a
     * même pas accès à l'insertion. Omettre l'écriture ne suffit pas : il faut
     * qu'aucun chemin ne puisse y mener.
     */
    if (!valider) {
      if (completion.status !== 'pending') {
        return json({ etat: completion.status, dejaTraitee: true });
      }
      const { error } = await db
        .from('mission_completions')
        .update({
          status: 'rejected',
          minutes_awarded: 0,
          reviewed_at: quand,
          reviewed_by: reviewedBy,
        })
        .eq('id', completionId)
        .eq('status', 'pending');

      if (error) {
        console.error('refus impossible', completionId, error.message);
        return fail('La demande n’a pas pu être renvoyée. Réessayez dans un instant.', 500);
      }
      return json({ etat: 'rejected' });
    }

    /* ------------------------------------------------------------ valider */
    /**
     * **La complétion d'abord, la récompense ensuite.** L'application écrit
     * dans l'ordre inverse — le registre part en quatrième vague, la
     * complétion en cinquième, deux requêtes sans transaction commune. Une
     * coupure entre les deux crédite les minutes et laisse la demande en
     * attente ; la reprise meurt alors sur `uniq_reward_per_completion` et la
     * mission ne peut plus JAMAIS être validée.
     *
     * Ici, l'ordre inverse rend chaque moitié rattrapable : une coupure après
     * la première laisse une demande approuvée sans minutes, et le simple fait
     * de réappuyer les écrit — l'étape suivante est idempotente par l'index.
     */
    if (completion.status === 'pending') {
      const { error } = await db
        .from('mission_completions')
        .update({
          status: 'approved',
          minutes_awarded: completion.minutes_requested,
          reviewed_at: quand,
          reviewed_by: reviewedBy,
        })
        .eq('id', completionId)
        .eq('status', 'pending');

      if (error) {
        // La seule collision attendue ici : une mission qui se compte seule,
        // déjà comptée aujourd'hui. C'est un refus métier, pas une panne.
        if (error.code === DEJA) {
          return fail('Cette mission a déjà été comptée aujourd’hui.', 409);
        }
        console.error('validation impossible', completionId, error.message);
        return fail('La mission n’a pas pu être confirmée. Réessayez dans un instant.', 500);
      }
    } else if (completion.status !== 'approved') {
      // Déjà renvoyée : on ne la ressuscite pas en douce.
      return json({ etat: completion.status, dejaTraitee: true });
    }

    const { data: mission } = await db
      .from('missions')
      .select('title')
      .eq('id', completion.mission_id)
      .maybeSingle();

    /**
     * Chaque valeur de cette ligne est fabriquée ICI.
     *
     * Rien ne vient du corps de la requête : ni le montant, ni le genre, ni la
     * référence. C'est la clause décisive de toute la fonction. La clé de
     * service contourne la RLS, donc la politique qui protégeait ce registre
     * ne protège plus rien ; le seul garde-fou qui survit est l'index
     * `uniq_reward_per_completion`, et il est PARTIEL — aveugle à `bonus` et à
     * `parent_adjustment`. Une fonction qui relaierait le corps du client
     * offrirait à la tablette d'un enfant un crédit positif arbitraire, sans
     * rien pour l'arrêter.
     *
     * Le montant se relit donc sur la demande, et le genre est cloué.
     */
    const { error: erreurRegistre } = await db.from('screen_time_transactions').insert({
      id: `tx_${crypto.randomUUID()}`,
      family_id: qui.familyId,
      child_id: completion.child_id,
      delta: completion.minutes_requested,
      kind: 'mission_reward',
      reason: (mission?.title as string | undefined) ?? 'Mission accomplie',
      ref_id: completion.id,
    });

    /**
     * Une seconde récompense pour la même mission est un SUCCÈS, pas une
     * erreur : c'est l'index qui vient d'absorber un double appui, une
     * application relancée, ou une réponse perdue en route. Le parent n'a rien
     * à réparer, et surtout rien à réessayer.
     */
    if (erreurRegistre && erreurRegistre.code !== DEJA) {
      console.error('registre impossible', completionId, erreurRegistre.message);
      return fail(
        'La mission est confirmée, mais les minutes n’ont pas pu être écrites. Réessayez dans un instant.',
        500,
      );
    }

    return json({ etat: 'approved', minutes: completion.minutes_requested });
  }),
);
