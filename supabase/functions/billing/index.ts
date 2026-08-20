// The billing API the app talks to.
//
// Every route authenticates the caller and derives the family from their JWT.
// Nothing here decides that a subscription is paid — only Stripe's webhooks do
// (see ../stripe-webhook). This function creates checkout sessions, opens the
// customer portal, cancels, resumes, and reads.
//
// Deploy:  supabase functions deploy billing

import {
  CORS,
  admin,
  fail,
  familyOfCaller,
  json,
  rowToReferral,
  rowToSubscription,
  stripe,
  env,
} from '../_shared/mino.ts';
import {
  REFERRAL,
  TRIAL_DAYS,
  canUseReferralCode,
} from '../../../src/domain/billing.ts';

const PRICE: Record<string, string> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '',
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY') ?? '',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

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

        // A family that already had a trial does not get another one by
        // cancelling and coming back.
        const { data: referredRow } = await db
          .from('referrals')
          .select('id')
          .eq('referee_family_id', caller.familyId)
          .maybeSingle();

        const trialDays = existing?.customer_id
          ? undefined
          : referredRow
            ? REFERRAL.refereeTrialDays
            : TRIAL_DAYS;

        const session = await stripe().checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price, quantity: 1 }],
          customer: existing?.customer_id ?? undefined,
          customer_email: existing?.customer_id ? undefined : (caller.email ?? undefined),
          client_reference_id: caller.familyId,
          subscription_data: {
            trial_period_days: trialDays,
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

        // The newcomer's side of the deal: a longer trial, applied right away.
        const { data: subscription } = await db
          .from('subscriptions')
          .update({
            trial_ends_at: new Date(
              Date.now() + REFERRAL.refereeTrialDays * 24 * 60 * 60 * 1000,
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('family_id', caller.familyId)
          .eq('status', 'trialing')
          .select('*')
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
});
