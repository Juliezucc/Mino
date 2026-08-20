// Stripe's webhooks — the only writer of truth for what a family has paid.
//
// Everything the app shows about subscriptions ultimately comes from here. In
// particular, a referral month is credited only on a real paid invoice: reward
// at sign-up and you are paying for accounts, not for customers.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// (Stripe cannot present a Supabase JWT; the signature is the authentication.)

import { Stripe, admin, env, fail, stripe } from '../_shared/mino.ts';
import {
  MONTHLY_PRICE_EUR,
  REFERRAL,
  qualifyReferral,
} from '../../../src/domain/billing.ts';

const iso = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

/** Stripe's own statuses, narrowed to the four the product cares about. */
function statusOf(subscription: Stripe.Subscription): string {
  switch (subscription.status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    default:
      return 'canceled';
  }
}

function planOf(subscription: Stripe.Subscription): 'monthly' | 'yearly' | null {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === 'year') return 'yearly';
  if (interval === 'month') return 'monthly';
  return null;
}

/** Mirrors a Stripe subscription into our table. */
async function sync(subscription: Stripe.Subscription) {
  const familyId =
    (subscription.metadata?.family_id as string | undefined) ??
    (typeof subscription.customer === 'string'
      ? ((await stripe().customers.retrieve(subscription.customer)) as Stripe.Customer).metadata
          ?.family_id
      : undefined);

  if (!familyId) {
    console.error('abonnement sans family_id', subscription.id);
    return null;
  }

  await admin()
    .from('subscriptions')
    .upsert({
      family_id: familyId,
      status: statusOf(subscription),
      plan: planOf(subscription),
      trial_ends_at: iso(subscription.trial_end),
      current_period_end: iso(subscription.items.data[0]?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
      subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    });

  return familyId;
}

/**
 * Hands the referrer their month.
 *
 * Trialing: push the trial end back — a genuinely later payment date.
 * Paying: credit the customer balance, which Stripe deducts from the next
 * invoice. Both are "a month you do not pay for", which is what was promised.
 */
async function rewardReferrer(referrerFamilyId: string) {
  const db = admin();
  const { data: sub } = await db
    .from('subscriptions')
    .select('*')
    .eq('family_id', referrerFamilyId)
    .maybeSingle();

  if (!sub) return;

  if (sub.status === 'trialing' && sub.subscription_id && sub.trial_ends_at) {
    const extended = new Date(sub.trial_ends_at);
    extended.setMonth(extended.getMonth() + REFERRAL.referrerFreeMonths);
    await stripe().subscriptions.update(sub.subscription_id, {
      trial_end: Math.floor(extended.getTime() / 1000),
      proration_behavior: 'none',
    });
    return;
  }

  if (sub.customer_id) {
    await stripe().customers.createBalanceTransaction(sub.customer_id, {
      amount: -Math.round(MONTHLY_PRICE_EUR * 100) * REFERRAL.referrerFreeMonths,
      currency: 'eur',
      description: 'Parrainage Mino — mois offert',
    });
    return;
  }

  // No customer yet: bank it, and spend it at the first checkout.
  await db
    .from('subscriptions')
    .update({ credit_months: (sub.credit_months ?? 0) + REFERRAL.referrerFreeMonths })
    .eq('family_id', referrerFamilyId);
}

/** The referee just paid for real: settle any referral waiting on them. */
async function settleReferral(refereeFamilyId: string) {
  const db = admin();

  const { data: pending } = await db
    .from('referrals')
    .select('*')
    .eq('referee_family_id', refereeFamilyId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!pending) return;

  // Load the referrer's whole history: the yearly cap is computed from it.
  const { data: history } = await db
    .from('referrals')
    .select('*')
    .eq('referrer_family_id', pending.referrer_family_id);

  const asDomain = (row: Record<string, unknown>) => ({
    id: row.id as string,
    code: row.code as string,
    referrerFamilyId: row.referrer_family_id as string,
    refereeFamilyId: row.referee_family_id as string,
    status: row.status as 'pending' | 'qualified' | 'credited' | 'rejected',
    createdAt: row.created_at as string,
    qualifiedAt: (row.qualified_at as string) ?? undefined,
    creditedAt: (row.credited_at as string) ?? undefined,
  });

  // The same rule the app shows and the tests cover — imported, not retyped.
  const { referrals, creditedFamilyId } = qualifyReferral(
    (history ?? []).map(asDomain),
    pending.id as string,
  );

  const updated = referrals.find((r) => r.id === pending.id)!;
  await db
    .from('referrals')
    .update({
      status: updated.status,
      qualified_at: updated.qualifiedAt ?? null,
      credited_at: updated.creditedAt ?? null,
    })
    .eq('id', pending.id);

  if (creditedFamilyId) await rewardReferrer(creditedFamilyId);
}

Deno.serve(async (request) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return fail('Signature manquante.', 400);

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      body,
      signature,
      env('STRIPE_WEBHOOK_SECRET'),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error('signature invalide', error);
    return fail('Signature invalide.', 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const familyId = session.client_reference_id ?? session.metadata?.family_id;
        if (familyId && typeof session.customer === 'string') {
          // Stamp the family on the customer, so later events find their way
          // home even without the session.
          await stripe().customers.update(session.customer, {
            metadata: { family_id: familyId },
          });
        }
        if (typeof session.subscription === 'string') {
          await sync(await stripe().subscriptions.retrieve(session.subscription));
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await sync(event.data.object as Stripe.Subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // A 0 € invoice is the trial starting, not a paying customer.
        if ((invoice.amount_paid ?? 0) <= 0) break;

        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
        if (typeof subscriptionId !== 'string') break;

        const familyId = await sync(await stripe().subscriptions.retrieve(subscriptionId));
        if (familyId) await settleReferral(familyId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
        if (typeof subscriptionId === 'string') {
          await sync(await stripe().subscriptions.retrieve(subscriptionId));
        }
        break;
      }
    }
  } catch (error) {
    // Returning 500 makes Stripe retry, which is what we want for a transient
    // failure — the handlers above are written to be safe to replay.
    console.error('webhook', event.type, error);
    return fail('Traitement impossible.', 500);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
