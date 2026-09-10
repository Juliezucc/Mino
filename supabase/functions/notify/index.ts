// Prévenir l'autre bout de la boucle.
//
// Deux notifications, et deux seulement — celles que Julie a nommées :
//
//   • « <enfant> a terminé une mission » → aux appareils des PARENTS, quand la
//     mission demande une confirmation ;
//   • « tu as reçu des minos » → à l'appareil de l'ENFANT concerné, quand le
//     parent a validé.
//
// Elles partent de l'appareil qui vient d'agir, et non d'un déclencheur de base
// de données. C'est un choix, et il a un défaut assumé : si l'appareil qui agit
// perd le réseau au mauvais moment, la notification ne part pas. En échange, le
// chemin est le même que celui de toutes les autres écritures — un client, une
// fonction, un jeton d'authentification vérifié — au lieu d'un second mécanisme
// à surveiller. La donnée, elle, est déjà écrite : c'est le rappel qu'on perd,
// pas le mino.
//
// CE QUE CETTE FONCTION NE CROIT JAMAIS : la famille annoncée par l'appelant.
// Elle vient du jeton, comme partout ailleurs. Un client qui pourrait nommer la
// famille qu'il notifie est un client qui peut écrire aux enfants des autres.
//
// Déploiement :  supabase functions deploy notify

import { admin, appelant, fail, json, servir } from '../_shared/mino.ts';

/** Le service d'Expo, qui détient la clé APNs et parle à Apple pour nous. */
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

interface Corps {
  audience?: 'parents' | 'child';
  childId?: string | null;
  title?: string;
  body?: string;
  route?: string | null;
}

Deno.serve(servir(async (request) => {

  const qui = await appelant(request);
  if (!qui) return fail('Non autorisé.', 401);

  let corps: Corps;
  try {
    corps = await request.json();
  } catch {
    return fail('Requête illisible.', 400);
  }

  const { audience, title, body } = corps;
  if (!title || !body || (audience !== 'parents' && audience !== 'child')) {
    return fail('Notification incomplète.', 400);
  }

  const db = admin();

  // Tous les jetons de la famille — celle du jeton d'authentification.
  const { data: jetons } = await db
    .from('push_tokens')
    .select('user_id, token, usage')
    .eq('family_id', qui.familyId);

  if (!jetons || jetons.length === 0) return json({ envoyes: 0 });

  // Qui est quoi, dans cette famille. Deux requêtes, et pas de rôle stocké en
  // double : `parents` et `family_devices` sont déjà la vérité là-dessus.
  const [{ data: parents }, { data: appareils }] = await Promise.all([
    db.from('parents').select('user_id').eq('family_id', qui.familyId),
    db.from('family_devices').select('user_id, child_id').eq('family_id', qui.familyId),
  ]);

  const comptesParents = new Set((parents ?? []).map((p) => p.user_id as string));
  const enfantParAppareil = new Map(
    (appareils ?? []).map((d) => [d.user_id as string, (d.child_id as string | null) ?? null]),
  );

  /**
   * La famille possède-t-elle un vrai téléphone de parent ?
   *
   * Calculé une fois pour tout l'envoi, et sur les jetons de la famille
   * entière — y compris celui de l'appareil qui agit, qui compte pour savoir
   * ce qui existe même s'il ne recevra rien. Voir la règle ci-dessous.
   */
  const unTelephoneDeParent = jetons.some(
    (j) => j.usage === 'parent' && comptesParents.has(j.user_id as string),
  );

  const destinataires = jetons.filter((j) => {
    const compte = j.user_id as string;

    // JAMAIS À SOI-MÊME. L'appareil qui agit a déjà affiché la notification
    // localement ; la recevoir une seconde fois par le réseau donne le doublon
    // que tout le monde reconnaît, et qui apprend à couper les notifications.
    if (compte === qui.userId) return false;

    if (audience === 'parents') {
      if (!comptesParents.has(compte)) return false;

      /**
       * ------------------------ « Raphaël a terminé sa mission », sur l'écran de Raphaël
       *
       * **Le défaut, relevé sur une vraie tablette.** Un parent valide une
       * mission, et l'annonce s'affiche sur la tablette que l'enfant tient.
       * Le serveur avait raison sur le compte — la famille est née sur cet
       * appareil, c'est donc un compte parent — et tort sur la situation.
       * L'inscription pose pourtant la question, et la réponse restait dans le
       * téléphone. Elle remonte désormais dans `push_tokens.usage`.
       *
       * La règle vit ici ET dans `src/domain/notifications.ts`
       * (`recoitLesNotificationsParent`), qui est la version éprouvée par les
       * essais : une fonction Edge ne peut pas importer un module React
       * Native. Les deux doivent dire la même chose — c'est ce que vérifie
       * `__tests__/notifications.test.ts`, qui lit ce fichier-ci.
       *
       *   • `enfant`  — jamais. « Confirmez la mission de Raphaël » n'a rien à
       *     faire sur le téléphone de Raphaël : au mieux c'est inutile, au pire
       *     cela lui apprend qu'un écran de validation existe.
       *
       *   • `partage` — seulement si la famille n'a pas mieux. Quand un vrai
       *     téléphone de parent existe, il reçoit déjà ; doubler sur la
       *     tablette du salon ne prévient personne de plus et met l'annonce
       *     sous les yeux de l'enfant. Sans téléphone de parent, en revanche,
       *     la tablette est le seul chemin — la couper laisserait le parent
       *     sans nouvelles, ce qui est bien pire.
       *
       *   • tout le reste, `null` compris — reçoit. C'est ce que portent les
       *     installations pas encore mises à jour, et retirer des
       *     notifications à quelqu'un sur la foi d'une information qu'on n'a
       *     pas serait exactement la faute qu'on corrige ici.
       */
      const genre = (j.usage as string | null) ?? 'inconnu';
      if (genre === 'enfant') return false;
      if (genre === 'partage') return !unTelephoneDeParent;
      return true;
    }

    // Pour l'enfant : son appareil, et lui seul. Un appareil partagé — qui
    // n'affiche aucun enfant en particulier — reçoit aussi, sans quoi la
    // tablette du salon ne dirait jamais rien.
    if (!enfantParAppareil.has(compte)) return false;
    const affiche = enfantParAppareil.get(compte);
    return !corps.childId || affiche === null || affiche === corps.childId;
  });

  if (destinataires.length === 0) return json({ envoyes: 0 });

  const messages = destinataires.map((j) => ({
    to: j.token,
    title,
    body,
    sound: 'default',
    // Ce que l'application relit quand on touche la notification.
    data: { route: corps.route ?? null, childId: corps.childId ?? null },
  }));

  try {
    const reponse = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!reponse.ok) {
      console.error('expo push', reponse.status, await reponse.text());
      return fail('Notification non transmise.', 502);
    }

    /**
     * Nettoyer les jetons morts, sinon ils s'accumulent pour toujours.
     *
     * Expo répond `DeviceNotRegistered` pour un appareil dont l'application a
     * été désinstallée. Le garder, c'est envoyer dans le vide à chaque mission,
     * pour chaque famille, indéfiniment — et se retrouver un jour limité par
     * Expo pour un trafic entièrement fantôme.
     */
    const resultat = await reponse.json();
    const tickets: { status?: string; details?: { error?: string } }[] = resultat?.data ?? [];
    const morts = destinataires
      .filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered')
      .map((j) => j.user_id as string);

    if (morts.length > 0) await db.from('push_tokens').delete().in('user_id', morts);

    return json({ envoyes: destinataires.length - morts.length });
  } catch (error) {
    console.error('notify', error);
    // Une notification perdue ne doit jamais faire échouer ce qui l'a
    // provoquée : la mission est déjà validée, les minos déjà crédités.
    return fail('Notification non transmise.', 502);
  }
}));
