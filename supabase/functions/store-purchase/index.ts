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

import { CORS, admin, fail, familyOfCaller, json, rowToSubscription } from '../_shared/mino.ts';
import {
  applyStoreState,
  netCents,
  verifyAppleTransaction,
  verifyGooglePurchase,
} from '../_shared/store.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

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

    if (state.accountToken && family?.store_account_token !== state.accountToken) {
      console.error('jeton de compte étranger', caller.familyId, state.transactionId);
      return fail('Cet achat appartient à un autre compte.', 403);
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
});
