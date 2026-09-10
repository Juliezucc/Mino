// =====================================================================
// Mino — inscription-web
//
// Fonder une famille depuis le site : le tunnel de minoapp.fr pose quelques
// questions, propose une routine, demande une adresse, et **tout est écrit
// ici, au moment où le parent valide son adresse** — avant le paiement.
//
// **Pourquoi avant le paiement, et pas après.** Un tunnel qui n'enregistre
// qu'au retour de Stripe perd tout ce que le parent a fait dès qu'il ferme
// l'onglet, change de téléphone, ou que le retour se passe mal. Le parent, lui,
// a répondu au questionnaire et donné son adresse : de son point de vue il
// s'est inscrit. La famille doit donc exister à cet instant, avec son code, ses
// missions et son enfant, pour qu'une connexion depuis n'importe quel appareil
// la retrouve intacte. L'essai de trente jours démarre de toute façon tout seul
// (`essai.sql`), donc une famille non payée n'est pas une famille servie
// gratuitement : c'est une famille en essai, comme toutes les autres.
//
// **Ce que le client ne décide pas.** Ni l'identifiant de la famille, ni son
// code, ni le titre, l'icône ou les minutes d'une mission. Le corps de la
// requête ne porte que des choix — quelle routine, lesquelles de ses
// suggestions — et le serveur va chercher le reste dans `missionLibrary.ts`.
// Sans cela, n'importe qui s'offrirait une mission à dix mille minutes.
//
// **Ce qu'on ne collecte pas.** Un prénom et un âge pour l'enfant, rien
// d'autre. Pas de nom de famille, pas de date de naissance, pas d'école.
// =====================================================================

import {
  ROUTINES,
  SIBLING_FALLBACK,
  convientA,
} from '../../../src/domain/missionLibrary.ts';
import {
  fabriquerCodeFamille,
  fabriquerCodeParrainage,
  fabriquerId,
} from '../../../src/domain/identifiants.ts';
import { MAX_AGE, MIN_AGE } from '../../../src/domain/ageBand.ts';
import { admin, env, fail, json, servir } from '../_shared/mino.ts';

import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Le hasard, côté Deno. `id.ts` passe celui d'`expo-crypto` aux mêmes règles. */
const octetsDeDeno = (taille: number): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(taille));

/**
 * L'avatar de départ.
 *
 * Le tunnel ne le demande pas — une question de plus avant l'inscription est
 * une inscription de moins — et le parent le change d'un geste sur la fiche de
 * l'enfant. La colonne est `not null` : il en faut un.
 */
const AVATAR_PAR_DEFAUT = 'fox';

interface Corps {
  /** Le prénom de l'enfant. La seule chose qu'on sache de lui, avec son âge. */
  prenom?: unknown;
  /** L'âge annoncé par le parent dans le questionnaire. Approximatif, corrigeable. */
  ageEstime?: unknown;
  /** La routine proposée à l'issue du questionnaire. */
  routineId?: unknown;
  /** Les suggestions retenues. Absentes : toute la routine, filtrée par l'âge. */
  missionIds?: unknown;
  /**
   * Le prénom du parent, et il est obligatoire.
   *
   * Le tunnel demande déjà une adresse ; un champ de plus au même écran ne
   * coûte rien, et son absence coûte cher. `inscriptionInachevee()` lit
   * précisément « un parent présent et sans prénom » comme la signature d'une
   * inscription abandonnée dans l'application, et renvoie vers l'écran de
   * création de compte. Une famille venue du site, complète et payée, s'y
   * ferait renvoyer à la première ouverture — pour recréer un compte avec une
   * adresse déjà prise. Aucun écran de l'application ne permet par ailleurs
   * de renseigner ce prénom après coup.
   */
  prenomParent?: unknown;
  /** La case « j'accepte les CGV et je suis titulaire de l'autorité parentale ». */
  consentement?: unknown;
}

function texte(valeur: unknown, maximum: number): string | null {
  if (typeof valeur !== 'string') return null;
  // Les caractères de contrôle n'ont rien à faire dans un prénom, et un prénom
  // est affiché sur l'écran d'un enfant.
  const propre = valeur.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!propre || propre.length > maximum) return null;
  return propre;
}

Deno.serve(servir(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return fail('Méthode non autorisée.', 405);

  /* ------------------------------------------------------------ l'appelant */

  const entete = request.headers.get('Authorization');
  if (!entete?.startsWith('Bearer ')) {
    return fail('Vous devez être connecté pour créer une famille.', 401);
  }

  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: entete } },
    auth: { persistSession: false },
  });
  const { data: auth } = await anon.auth.getUser();
  if (!auth.user) return fail('Session expirée. Reconnectez-vous.', 401);

  const db = admin();

  /**
   * ------------------------------------------------------- déjà une famille ?
   *
   * Et c'est le cœur de la promesse faite au parent : rien n'est perdu.
   *
   * Le bouton peut être touché deux fois, la page rechargée, le tunnel repris
   * depuis un autre onglet ; et surtout, quelqu'un qui a déjà un compte Mino
   * peut très bien retraverser le tunnel depuis une publicité. Dans tous ces
   * cas on rend la famille existante, telle quelle, sans rien créer et sans
   * rien écraser. Une deuxième famille pour le même compte serait pire qu'une
   * erreur : `auth_family_ids()` en choisirait une des deux, et l'autre
   * deviendrait invisible avec ses enfants dedans.
   */
  const { data: dejaLa } = await db
    .from('parents')
    .select('id, family_id, families ( code )')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (dejaLa) {
    const famille = dejaLa.family_id as string;
    const [{ data: enfant }, { count }] = await Promise.all([
      db
        .from('children')
        .select('id')
        .eq('family_id', famille)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from('missions')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', famille)
        .eq('archived', false),
    ]);

    return json({
      dejaCree: true,
      familyId: famille,
      familyCode: (dejaLa.families as { code: string } | null)?.code ?? null,
      parentId: dejaLa.id,
      childId: enfant?.id ?? null,
      missions: count ?? 0,
    });
  }

  /* -------------------------------------------------------------- le corps */

  let corps: Corps;
  try {
    corps = (await request.json()) as Corps;
  } catch {
    return fail('Requête illisible.', 400);
  }

  if (corps.consentement !== true) {
    return fail(
      'Vous devez accepter les conditions et déclarer être titulaire de l’autorité parentale.',
      400,
    );
  }

  const prenom = texte(corps.prenom, 30);
  if (!prenom) return fail('Le prénom de l’enfant est manquant ou trop long.', 400);

  const age = typeof corps.ageEstime === 'number' ? Math.round(corps.ageEstime) : NaN;
  if (!Number.isFinite(age) || age < MIN_AGE || age > MAX_AGE) {
    return fail(`L’âge doit être compris entre ${MIN_AGE} et ${MAX_AGE} ans.`, 400);
  }

  const prenomParent = texte(corps.prenomParent, 30);
  if (!prenomParent) return fail('Votre prénom est manquant ou trop long.', 400);

  /* ------------------------------------------------------- les missions */

  /**
   * Les missions sortent de la bibliothèque, jamais de la requête.
   *
   * Le client nomme une routine et des suggestions ; leur titre, leur icône,
   * leurs minutes et leur récurrence viennent d'ici. Et le filtre d'âge est
   * réappliqué côté serveur : `convientA` est la même règle que celle de
   * l'application, et elle protège d'autre chose qu'une incohérence
   * d'affichage — certaines suggestions portent un avertissement de sécurité
   * parce qu'elles supposent un adolescent.
   */
  const routine = ROUTINES.find((r) => r.id === corps.routineId);
  if (corps.routineId !== undefined && !routine) {
    return fail('Routine inconnue.', 400);
  }

  const demandees =
    Array.isArray(corps.missionIds) && corps.missionIds.length > 0
      ? new Set(corps.missionIds.filter((id): id is string => typeof id === 'string'))
      : null;

  const retenues = (routine?.suggestions ?? [])
    .filter((s) => (demandees ? demandees.has(s.id) : true))
    // Pas de fratrie connue à l'inscription : le tunnel ne crée qu'un enfant.
    .filter((s) => convientA(s, age, false))
    .map((s) => ({
      ...s,
      // `resolveTitle` sans fratrie rendrait « mon frère ou ma sœur », mais
      // `convientA` a déjà écarté ces suggestions. La substitution reste, pour
      // qu'aucun `{enfant}` ne puisse atteindre l'écran d'un enfant.
      titre: s.title.replace('{enfant}', SIBLING_FALLBACK),
    }));

  /* ------------------------------------------------------------- l'écriture */

  const maintenant = new Date().toISOString();
  const familyId = fabriquerId('fam');
  const parentId = fabriquerId('parent');
  const childId = fabriquerId('child');

  /**
   * Le code famille est unique en base. Une collision est improbable — 32⁶
   * combinaisons — mais « improbable » et « impossible » ne sont pas le même
   * mot quand l'échec se traduit par une inscription qui ne passe pas.
   */
  let derniereErreur: string | null = null;
  let familleCreee: { code: string } | null = null;

  for (let essai = 0; essai < 5 && !familleCreee; essai += 1) {
    const code = fabriquerCodeFamille(octetsDeDeno);
    const { error } = await db.from('families').insert({
      id: familyId,
      name: `Famille de ${prenom}`,
      code,
      referral_code: fabriquerCodeParrainage(octetsDeDeno),
      created_at: maintenant,
    });
    if (!error) {
      familleCreee = { code };
      break;
    }
    derniereErreur = error.message;
    // 23505 : violation d'unicité. Tout le reste est définitif, on s'arrête.
    if (error.code !== '23505') break;
  }

  if (!familleCreee) {
    console.error('inscription-web : famille refusée', derniereErreur);
    return fail('La création de la famille a échoué. Réessayez dans un instant.', 500);
  }

  /**
   * À partir d'ici, la famille existe. Si l'une des écritures suivantes échoue,
   * on la supprime : `on delete cascade` emporte le parent, l'enfant et les
   * missions avec elle. Une famille à moitié écrite serait pire que pas de
   * famille du tout — le parent réessaierait et tomberait sur la branche
   * « déjà une famille » ci-dessus, qui lui rendrait la coquille.
   */
  const abandonner = async (quoi: string, detail: string | undefined): Promise<Response> => {
    console.error(`inscription-web : ${quoi} refusé`, detail);
    await db.from('families').delete().eq('id', familyId);
    return fail('La création de la famille a échoué. Réessayez dans un instant.', 500);
  };

  /**
   * Le parent, seul et tout de suite : c'est cette ligne, et elle seule, qui
   * rattache le compte authentifié à la famille. Sans elle, l'appelant ne voit
   * pas la famille qu'il vient de créer.
   *
   * `display_name` peut rester nul — le tunnel ne demande pas forcément le
   * prénom du parent. La colonne l'accepte depuis le parcours d'inscription de
   * l'application, qui fonde la famille avant que le parent ne se présente.
   */
  const { error: erreurParent } = await db.from('parents').insert({
    id: parentId,
    family_id: familyId,
    user_id: auth.user.id,
    display_name: prenomParent,
    email: auth.user.email ?? null,
    consent_at: maintenant,
    created_at: maintenant,
  });
  if (erreurParent) return abandonner('parent', erreurParent.message);

  const { error: erreurEnfant } = await db.from('children').insert({
    id: childId,
    family_id: familyId,
    first_name: prenom,
    age,
    avatar_key: AVATAR_PAR_DEFAUT,
    require_approval: false,
    created_at: maintenant,
  });
  if (erreurEnfant) return abandonner('enfant', erreurEnfant.message);

  if (retenues.length > 0) {
    const missions = retenues.map((s) => ({
      id: fabriquerId('mission'),
      family_id: familyId,
      title: s.titre,
      icon: s.icon,
      minutes: s.minutes,
      repeat: routine!.repeat,
      auto_approve: false,
      created_by: parentId,
      archived: false,
      created_at: maintenant,
    }));

    const { error: erreurMissions } = await db.from('missions').insert(missions);
    if (erreurMissions) return abandonner('missions', erreurMissions.message);

    const { error: erreurLiens } = await db.from('mission_assignments').insert(
      missions.map((m) => ({
        id: fabriquerId('assign'),
        mission_id: m.id,
        child_id: childId,
        active: true,
        created_at: maintenant,
      })),
    );
    if (erreurLiens) return abandonner('attributions', erreurLiens.message);
  }

  /**
   * Le code famille est rendu tout de suite : c'est ce que le parent tapera sur
   * la tablette de l'enfant, et le site peut donc le lui montrer sans attendre
   * le paiement.
   */
  return json({
    dejaCree: false,
    familyId,
    familyCode: familleCreee.code,
    parentId,
    childId,
    missions: retenues.length,
  });
}));
