// The billing API the app talks to.
//
// Every route authenticates the caller and derives the family from their JWT.
// Nothing here decides that a subscription is paid — only Stripe's webhooks do
// (see ../stripe-webhook). This function creates checkout sessions, opens the
// customer portal, cancels, resumes, and reads.
//
// Deploy:  supabase functions deploy billing

import {
  admin,
  fail,
  familyOfCaller,
  json,
  rowToReferral,
  rowToSubscription,
  stripe,
  env,
  servir,
} from '../_shared/mino.ts';
import { PRODUITS, canUseReferralCode, trialEndForCheckout } from '../../../src/domain/billing.ts';
import { OFFRE_PARRAINAGE } from '../../../src/domain/offrePromo.ts';
import { signerOffre } from '../_shared/appleOffre.ts';

const PRICE: Record<string, string> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '',
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY') ?? '',
};

Deno.serve(servir(async (request) => {

  const caller = await familyOfCaller(request);
  if (!caller) return fail('Non authentifié.', 401);

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/billing\/?/, '');
  const db = admin();

  try {
    switch (route) {
      /* ------------------------------------------------------------ read */
      case 'subscription': {
        const { data } = await db
          .from('subscriptions')
          .select('*')
          .eq('family_id', caller.familyId)
          .maybeSingle();
        return json(data ? rowToSubscription(data) : null);
      }

      case 'referrals': {
        const { data } = await db
          .from('referrals')
          .select('*')
          .eq('referrer_family_id', caller.familyId)
          .order('created_at', { ascending: false });
        return json((data ?? []).map(rowToReferral));
      }

      /* -------------------------------------------------------- checkout */
      case 'checkout': {
        const { plan } = (await request.json()) as { plan: 'monthly' | 'yearly' };
        const price = PRICE[plan];
        if (!price) return fail('Formule inconnue.');

        const { data: existing } = await db
          .from('subscriptions')
          .select('*')
          .eq('family_id', caller.familyId)
          .maybeSingle();

        /**
         * L'essai qui court déjà, et surtout pas un nouveau.
         *
         * `trial_ends_at` porte la vérité, parrainage compris : les soixante
         * jours du filleul y sont écrits au moment où il saisit le code (voir
         * `referrals/redeem` plus bas). Redemander un décompte neuf ici les
         * ajoutait aux siens.
         */
        const trialEnd = trialEndForCheckout({
          trialEndsAt: existing?.trial_ends_at ?? null,
          // Une famille qui a déjà payé une fois a eu son essai. Résilier et
          // revenir ne le rouvre pas.
          hasPaidBefore: !!existing?.customer_id,
        });

        const session = await stripe().checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price, quantity: 1 }],
          customer: existing?.customer_id ?? undefined,
          // Jamais une chaîne vide : Stripe la refuse, et une adresse absente
          // n'est pas une erreur — Checkout la demandera lui-même. Le garde-fou
          // est double, ici et dans `familyOfCaller`, parce que la valeur
          // traverse deux frontières avant d'arriver là.
          customer_email:
            existing?.customer_id || !caller.email?.trim() ? undefined : caller.email.trim(),
          client_reference_id: caller.familyId,
          subscription_data: {
            trial_end: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : undefined,
            metadata: { family_id: caller.familyId },
          },
          // Stripe Tax computes the customer's own country VAT — mandatory for
          // B2C digital services sold across the EU.
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          customer_update: existing?.customer_id ? { address: 'auto', name: 'auto' } : undefined,
          allow_promotion_codes: true,
          success_url: `${env('APP_URL')}/abonnement/merci?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${env('APP_URL')}/abonnement`,
          metadata: { family_id: caller.familyId },
        });

        return json({ url: session.url });
      }

      /* ---------------------------------------------------------- portal */
      case 'portal': {
        const { data } = await db
          .from('subscriptions')
          .select('customer_id')
          .eq('family_id', caller.familyId)
          .maybeSingle();
        if (!data?.customer_id) return fail('Aucun client de facturation.', 404);

        const session = await stripe().billingPortal.sessions.create({
          customer: data.customer_id,
          return_url: `${env('APP_URL')}/abonnement`,
        });
        return json({ url: session.url });
      }

      /* --------------------------------------------------- changer de formule */
      /**
       * Remplacer la formule sur l'abonnement existant.
       *
       * **Ce que cette route empêche.** Le seul chemin qui existait vers
       * l'annuel passait par `checkout`, qui ouvre un abonnement NEUF. Une
       * famille au mensuel qui voulait l'annuel se retrouvait donc avec les
       * deux, et prélevée deux fois — sans que rien à l'écran ne le laisse
       * deviner. Le portail Stripe savait le faire correctement, mais il faut
       * quitter Mino, et l'écran de Stripe ne dit pas ce qu'on y cherche.
       *
       * `proration_behavior: 'none'` : le nouveau tarif s'applique au cycle
       * suivant, rien n'est débité aujourd'hui. C'est exactement le réglage du
       * portail — les deux chemins doivent produire le même résultat, sans
       * quoi le prix dépendrait de la porte empruntée. Et c'est le seul
       * comportement qu'on puisse promettre en une phrase à un parent.
       *
       * Pendant l'essai, cela ne change donc que le montant du 30e jour.
       */
      case 'plan': {
        const { plan } = (await request.json()) as { plan: 'monthly' | 'yearly' };
        const price = PRICE[plan];
        if (!price) return fail('Formule inconnue.');

        const { data } = await db
          .from('subscriptions')
          .select('*')
          .eq('family_id', caller.familyId)
          .maybeSingle();
        if (!data?.subscription_id) return fail('Aucun abonnement à modifier.', 404);
        if (data.plan === plan) return json(rowToSubscription(data));

        // L'abonnement ne porte qu'une ligne — un seul produit, une seule
        // quantité. On remplace son tarif ; ajouter une ligne créerait un
        // second prélèvement à côté du premier.
        const current = await stripe().subscriptions.retrieve(data.subscription_id);
        const item = current.items.data[0];
        if (!item) return fail('Abonnement illisible.', 409);

        const updated = await stripe().subscriptions.update(data.subscription_id, {
          items: [{ id: item.id, price }],
          proration_behavior: 'none',
        });

        /**
         * On écrit tout de suite, sans attendre le webhook.
         *
         * `customer.subscription.updated` arrivera et réécrira la même chose —
         * les deux écritures sont identiques et l'ordre est sans importance.
         * Mais entre le clic et le webhook il s'écoule parfois plusieurs
         * secondes, et pendant ce temps l'écran affirmerait encore l'ancienne
         * formule à quelqu'un qui vient d'en changer. Un parent qui doute
         * reclique, et c'est ce doute qui coûte de l'argent.
         */
        const { data: row } = await db
          .from('subscriptions')
          .update({
            plan,
            current_period_end: updated.items.data[0]?.current_period_end
              ? new Date(updated.items.data[0].current_period_end * 1000).toISOString()
              : data.current_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('family_id', caller.familyId)
          .select('*')
          .single();

        return json(rowToSubscription(row));
      }

      /* ------------------------------------- le mois offert, chez Apple */
      /**
       * Signer l'offre promotionnelle qui donne au parrain son mois.
       *
       * **Pourquoi une route, et pas un traitement côté serveur.** Chez Stripe,
       * le mois est donné sans que personne n'ait rien à faire : on recule la
       * date d'essai, ou on porte un avoir au solde. Apple ne connaît ni l'un
       * ni l'autre. Son seul mécanisme — l'offre promotionnelle — doit être
       * **acceptée par l'abonné** : la feuille de paiement s'ouvre, il confirme,
       * et le mois s'applique. Il faut donc un écran, et donc une route.
       *
       * La signature n'est jamais faite à l'avance : elle porte un horodatage
       * qu'Apple refuse au-delà de quelques minutes.
       */
      case 'promo': {
        const { data } = await db
          .from('subscriptions')
          .select('*')
          .eq('family_id', caller.familyId)
          .maybeSingle();

        if (!data?.plan) return fail('Aucun abonnement.', 404);
        if (data.source !== 'apple') return fail('Offre réservée aux abonnements App Store.', 409);
        if ((data.credit_months ?? 0) < 1) return fail('Aucun mois offert à récupérer.', 409);

        const { data: famille } = await db
          .from('families')
          .select('store_account_token')
          .eq('id', caller.familyId)
          .maybeSingle();

        // Sans ce jeton, l'offre ne peut être rattachée à personne — et une
        // offre qu'Apple ne sait pas rattacher est une offre qu'il refuse.
        if (!famille?.store_account_token) return fail('Achat non rattaché à la famille.', 409);

        const offre = await signerOffre({
          productId: PRODUITS[data.plan as 'monthly' | 'yearly'],
          offerId: OFFRE_PARRAINAGE[data.plan as 'monthly' | 'yearly'],
          appAccountToken: famille.store_account_token as string,
        });

        /**
         * On ne décompte rien ici, et c'est délibéré.
         *
         * Une signature n'est pas un mois consommé : le parent peut refermer la
         * feuille de paiement. Le décompte a lieu quand la notification d'Apple
         * revient avec `offerType` 2 — c'est-à-dire quand le mois a réellement
         * été accordé. Décompter au clic reviendrait à retirer un mois à
         * quelqu'un qui a hésité.
         */
        return json({ offre, plan: data.plan });
      }

      /* -------------------------------------------- cancel and come back */
      case 'cancel':
      case 'resume': {
        const cancelling = route === 'cancel';
        const { data } = await db
          .from('subscriptions')
          .select('*')
          .eq('family_id', caller.familyId)
          .maybeSingle();
        if (!data?.subscription_id) return fail('Aucun abonnement.', 404);

        // Cancel at period end, never immediately: the family paid for the
        // period it is in, and French law requires this to be one action away.
        await stripe().subscriptions.update(data.subscription_id, {
          cancel_at_period_end: cancelling,
        });

        const { data: updated } = await db
          .from('subscriptions')
          .update({ cancel_at_period_end: cancelling, updated_at: new Date().toISOString() })
          .eq('family_id', caller.familyId)
          .select('*')
          .single();

        return json(rowToSubscription(updated));
      }

      /* -------------------------------------------------------- referral */
      case 'referrals/redeem': {
        const { code } = (await request.json()) as { code: string };
        const clean = (code ?? '').trim().toUpperCase();

        const { data: referrer } = await db
          .from('families')
          .select('id')
          .eq('referral_code', clean)
          .maybeSingle();

        const { data: existing } = await db
          .from('referrals')
          .select('*')
          .or(
            `referee_family_id.eq.${caller.familyId},referrer_family_id.eq.${referrer?.id ?? 'none'}`,
          );

        const check = canUseReferralCode((existing ?? []).map(rowToReferral) as never, {
          code: clean,
          referrerFamilyId: referrer?.id ?? null,
          refereeFamilyId: caller.familyId,
        });
        if (!check.ok) return json({ ok: false, reason: check.reason });

        const { error } = await db.from('referrals').insert({
          id: `ref_${crypto.randomUUID()}`,
          code: clean,
          referrer_family_id: referrer!.id,
          referee_family_id: caller.familyId,
          status: 'pending',
        });
        // The unique constraint is the real guard; this catches the race.
        if (error) return json({ ok: false, reason: 'Cette famille a déjà été parrainée.' });

        /**
         * Le filleul ne reçoit rien de plus, et son essai n'est pas touché.
         *
         * Il était porté à soixante jours ici même. Ce n'était plus tenable dès
         * lors que l'essai est porté par la boutique — une offre d'introduction
         * Apple a une durée fixe, la même pour tout le monde — et cela
         * contredisait l'écran de paiement, qui promet trente jours à la touche
         * précédente. Voir `REFERRAL` dans `src/domain/billing.ts`.
         *
         * On rend donc l'abonnement tel qu'il est, pour que l'écran se rafraîchisse
         * sans avoir à le redemander.
         */
        const { data: subscription } = await db
          .from('subscriptions')
          .select('*')
          .eq('family_id', caller.familyId)
          .maybeSingle();

        return json({
          ok: true,
          subscription: subscription ? rowToSubscription(subscription) : undefined,
        });
      }

      default:
        return fail('Route inconnue.', 404);
    }
  } catch (error) {
    console.error('billing', route, error);
    return fail(error instanceof Error ? error.message : 'Erreur inattendue.', 500);
  }
}));
