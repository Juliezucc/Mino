// Confirmation d'un achat fait dans l'application.
//
// Appelée par le téléphone juste après la feuille de paiement. Elle n'a
// **aucune autorité** : la notification serveur à serveur d'Apple ou de Google
// arrivera de toute façon, et c'est elle qui fait foi. Cette fonction existe
// pour une seule raison — que le parent ne reste pas quelques secondes devant
// un écran qui dit encore « essai » alors qu'il vient de payer.
//
// Ce qui, en revanche, ne se raccourcit pas : la preuve est vérifiée auprès
// d'Apple ou de Google avant d'être écrite. Un jeton envoyé par un téléphone
// est un jeton qu'un téléphone peut inventer.
//
// Déploiement :  supabase functions deploy store-purchase

import { admin, fail, familyOfCaller, json, rowToSubscription, servir } from '../_shared/mino.ts';
import {
  applyStoreState,
  netCents,
  verifyAppleTransaction,
  verifyGooglePurchase,
} from '../_shared/store.ts';

Deno.serve(servir(async (request) => {

  // La famille vient du jeton d'authentification, jamais du corps de la
  // requête : un client qui peut nommer la famille sur laquelle il agit est un
  // client qui peut agir sur celle d'un autre.
  const caller = await familyOfCaller(request);
  if (!caller) return fail('Non autorisé.', 401);

  let body: { platform?: string; token?: string; productId?: string };
  try {
    body = await request.json();
  } catch {
    return fail('Requête illisible.', 400);
  }

  if (!body.token || (body.platform !== 'apple' && body.platform !== 'google')) {
    return fail('Achat incomplet.', 400);
  }

  try {
    const state =
      body.platform === 'apple'
        ? await verifyAppleTransaction(body.token)
        : await verifyGooglePurchase(body.token);

    // Le jeton de compte doit désigner cette famille-ci. S'il en désigne une
    // autre, ce n'est pas une erreur de frappe : c'est quelqu'un qui essaie de
    // faire valoir l'achat d'un tiers.
    const db = admin();
    const { data: family } = await db
      .from('families')
      .select('store_account_token')
      .eq('id', caller.familyId)
      .maybeSingle();

    /**
     * ------------------------------ l'achat qui porte le jeton d'une autre famille
     *
     * **Ce que le jeton de compte est, et ce qu'il n'est pas.** À l'achat, on
     * transmet à la boutique un identifiant qui désigne la famille. La boutique
     * le grave sur la transaction d'origine et le rend tel quel pour toujours —
     * y compris aux renouvellements, des années plus tard. Il sert à retrouver
     * la famille quand la notification serveur à serveur arrive toute seule.
     *
     * **Le refus sec créait une impasse dont personne ne sortait.** Un parent
     * qui recommence sa famille — la première tentative a échoué, il a supprimé
     * son compte, il réinstalle — garde le même compte Apple, donc le même
     * abonnement, donc la même transaction d'origine. Mais celle-ci porte le
     * jeton de son ANCIENNE famille. Il paie chez Apple, la boutique le lui
     * confirme, et Mino lui répond « cet achat appartient à un autre compte ».
     * Définitivement, sans recours, sur un abonnement qui est le sien.
     *
     * C'est exactement ce qu'ont dit les journaux au premier vrai test :
     * `jeton de compte étranger fam_… 2000001233257291`.
     *
     * **Ce qu'on garde, et c'est l'essentiel.** Le contrôle existe pour une
     * raison qui n'a pas changé : personne ne doit pouvoir faire valoir
     * l'abonnement d'un tiers. On ne le lève donc que lorsqu'il n'y a
     * personne à déposséder — quand aucune famille ne détient réellement cet
     * achat aujourd'hui. Si une famille l'a bel et bien, le refus reste, à la
     * lettre.
     *
     * La preuve, elle, n'est jamais en cause : elle vient d'être vérifiée
     * auprès d'Apple ou de Google. Ce n'est pas elle qu'on assouplit, c'est le
     * registre qu'on cesse de traiter comme un titre de propriété.
     */
    if (state.accountToken && family?.store_account_token !== state.accountToken) {
      const { data: ancienne } = await db
        .from('families')
        .select('id')
        .eq('store_account_token', state.accountToken)
        .maybeSingle();

      const { data: detenu } = ancienne
        ? await db
            .from('subscriptions')
            .select('family_id')
            .eq('family_id', ancienne.id)
            .in('source', ['apple', 'google'])
            .maybeSingle()
        : { data: null };

      if (detenu) {
        console.error('jeton de compte étranger', caller.familyId, state.transactionId);
        return fail('Cet achat appartient à un autre compte.', 403);
      }

      // Personne ne le détient : on l'adopte, et on le dit. Cette ligne est
      // celle qu'on relira le jour où quelqu'un se demandera comment un achat
      // a changé de famille.
      console.warn(
        'achat adopté',
        caller.familyId,
        state.transactionId,
        ancienne?.id ?? 'aucune famille pour ce jeton',
      );

      /**
       * **Reprendre le jeton, sinon l'adoption ne dure qu'un instant.**
       *
       * Adopter écrivait l'abonnement sur la famille appelante et s'arrêtait
       * là — le jeton, lui, restait pointé ailleurs, ou nulle part. Or c'est
       * par lui, et par lui seul, qu'Apple et Google nous retrouvent : le
       * renouvellement du mois suivant, la résiliation, l'échec de paiement
       * arrivaient donc avec un jeton qui ne désignait plus personne, et
       * `applyStoreState` les jetait sous « achat sans famille identifiable ».
       * La famille perdait son accès au premier renouvellement, sans que rien
       * ne l'annonce.
       *
       * Vu en vrai : une famille de test supprimée avait laissé son jeton
       * gravé sur un abonnement bien vivant. Dix-sept notifications d'Apple
       * enregistrées, `family_id` vide sur toutes.
       *
       * L'ancienne famille, si elle existe encore, en reçoit un neuf : la
       * colonne est unique et ne peut pas être vide.
       */
      if (ancienne) {
        await db
          .from('families')
          .update({ store_account_token: crypto.randomUUID() })
          .eq('id', ancienne.id);
      }
      await db
        .from('families')
        .update({ store_account_token: state.accountToken })
        .eq('id', caller.familyId);
    }

    await applyStoreState(state, { familyId: caller.familyId });

    /**
     * Un essai qui commence est un événement, pas un silence.
     *
     * Le journal ne s'écrivait que pour un abonnement `active`. Depuis que la
     * carte s'enregistre à l'inscription avec une offre d'introduction, la
     * quasi-totalité des abonnements iPhone naissent en essai — ils
     * disparaissaient donc entièrement des cohortes de conversion, et le
     * tableau de bord aurait affiché zéro abonné là où il y en avait.
     *
     * `essai_commence` est le genre que la vue de conversion attend
     * (`analytics.sql`), et c'est le même que celui écrit par le webhook Stripe
     * pour un abonnement à essai. Les deux rails racontent ainsi la même
     * histoire.
     */
    if (state.status === 'active' || state.status === 'trialing') {
      await db.from('billing_events').upsert(
        {
          family_id: caller.familyId,
          kind: state.status === 'trialing' ? 'essai_commence' : 'abonnement_commence',
          status: state.status,
          plan: state.plan,
          source: state.platform,
          amount_cents: state.amountCents,
          net_cents: netCents(state.amountCents),
          // Préfixé, pour ne pas entrer en collision avec l'identifiant que
          // portera la notification serveur à serveur du même achat.
          stripe_event_id: `store:${state.platform}:${state.transactionId}`,
          occurred_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_event_id', ignoreDuplicates: true },
      );
    }

    const { data: subscription } = await db
      .from('subscriptions')
      .select('*')
      .eq('family_id', caller.familyId)
      .maybeSingle();

    return json({ subscription: subscription ? rowToSubscription(subscription as never) : null });
  } catch (error) {
    console.error('vérification achat', error);
    // L'achat a bien eu lieu même si la vérification a échoué ici : la
    // notification serveur à serveur rattrapera. Ne jamais suggérer de repayer.
    return fail('Vérification impossible pour le moment. Votre achat sera pris en compte.', 502);
  }
}));
