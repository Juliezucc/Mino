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

/**
 * Appends one line to the billing ledger.
 *
 * `subscriptions` is a mirror: every change overwrites it. A family that tried,
 * paid four months and left leaves a single "canceled" row there — which is why
 * churn, cohorts and past MRR cannot be recovered from it afterwards. They are
 * not hard to compute without this: they are impossible, because the fact was
 * never written down. Same rule as the screen-time ledger, applied to money.
 *
 * `stripe_event_id` is unique, and Stripe replays its webhooks — so a duplicate
 * is dropped rather than counted twice.
 */
async function record(input: {
  familyId: string;
  kind: string;
  eventId: string;
  status?: string | null;
  plan?: string | null;
  amountCents?: number | null;
  occurredAt?: string;
}) {
  const { error } = await admin()
    .from('billing_events')
    .upsert(
      {
        family_id: input.familyId,
        kind: input.kind,
        status: input.status ?? null,
        plan: input.plan ?? null,
        amount_cents: input.amountCents ?? null,
        stripe_event_id: input.eventId,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
      },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true },
    );

  // A missing ledger line must never fail the webhook: Stripe would retry, and
  // the mirror — which is what the app actually reads — is already correct.
  if (error) console.error('journal facturation', input.kind, error);
}

/**
 * Mirrors a Stripe subscription into our table.
 *
 * **L'écriture dont l'échec était jeté, et c'était la seule qui compte.**
 * Cette ligne est ce qui donne l'accès à une famille qui vient de payer. Son
 * erreur n'était pas lue : `subscriptions.family_id` référence `families(id)`,
 * donc un identifiant qui n'existe pas dans la base fait échouer l'insertion —
 * et la fonction répondait quand même `200 OK`. Stripe affichait une livraison
 * réussie, la table restait vide, le parent gardait « Essai gratuit » après
 * avoir donné sa carte, et rien nulle part ne disait qu'il s'était passé
 * quelque chose. C'est le mode de panne le plus cher qu'un produit payant
 * puisse avoir : silencieux des deux côtés.
 *
 * On lève donc, ce qui fait répondre 500, ce qui fait réessayer Stripe — le
 * comportement voulu, et déjà décrit plus bas : ces gestionnaires sont écrits
 * pour être rejoués sans dégât.
 */
async function sync(subscription: Stripe.Subscription) {
  const familyId =
    (subscription.metadata?.family_id as string | undefined) ??
    (typeof subscription.customer === 'string'
      ? ((await stripe().customers.retrieve(subscription.customer)) as Stripe.Customer).metadata
          ?.family_id
      : undefined);

  if (!familyId) {
    // Réessayer n'y changerait rien : cet abonnement n'a jamais porté de
    // famille. On le dit fort, et on rend la main.
    console.error('abonnement sans family_id', subscription.id);
    return null;
  }

  const { error } = await admin()
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

  if (error) {
    console.error('abonnement non enregistré', familyId, subscription.id, error.message);
    throw new Error(`subscriptions upsert (${familyId}) : ${error.message}`);
  }

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
async function settleReferral(refereeFamilyId: string, eventId: string) {
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

  if (creditedFamilyId) {
    await rewardReferrer(creditedFamilyId);
    // Un mois offert est un revenu abandonné : il doit apparaître dans les
    // comptes du parrain, sans quoi le parrainage semble gratuit.
    await record({
      familyId: creditedFamilyId,
      kind: 'parrainage_credite',
      eventId: `${eventId}:parrainage`,
      amountCents: -Math.round(MONTHLY_PRICE_EUR * 100) * REFERRAL.referrerFreeMonths,
    });
  }
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
        const subscription = event.data.object as Stripe.Subscription;
        const familyId = await sync(subscription);
        if (!familyId) break;

        const common = {
          familyId,
          eventId: event.id,
          status: statusOf(subscription),
          plan: planOf(subscription),
        };

        if (event.type === 'customer.subscription.deleted') {
          await record({ ...common, kind: 'resiliation_effective' });
        } else if (event.type === 'customer.subscription.created') {
          await record({
            ...common,
            kind: subscription.trial_end ? 'essai_commence' : 'abonnement_commence',
          });
        } else if (subscription.cancel_at_period_end) {
          // Le moment qui compte pour comprendre pourquoi on perd des clients :
          // la décision, pas la fin de période qui suit un mois plus tard.
          await record({ ...common, kind: 'resiliation_demandee' });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // A 0 € invoice is the trial starting, not a paying customer.
        if ((invoice.amount_paid ?? 0) <= 0) break;

        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
        if (typeof subscriptionId !== 'string') break;

        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        const familyId = await sync(subscription);
        if (!familyId) break;

        const common = {
          familyId,
          status: statusOf(subscription),
          plan: planOf(subscription),
          // Hors taxes : c'est le revenu, pas l'encaissement. La TVA n'est pas
          // à nous et n'a rien à faire dans un MRR.
          amountCents: (invoice.total_excluding_tax ?? invoice.amount_paid) ?? null,
        };

        // Premier vrai paiement de cette famille ? On ne peut le savoir qu'ici,
        // et c'est cette date qui ancre les cohortes de conversion.
        const { count } = await admin()
          .from('billing_events')
          .select('id', { count: 'exact', head: true })
          .eq('family_id', familyId)
          .eq('kind', 'paiement');

        if ((count ?? 0) === 0) {
          await record({ ...common, kind: 'abonnement_commence', eventId: `${event.id}:debut` });
        }

        await record({ ...common, kind: 'paiement', eventId: event.id });
        await settleReferral(familyId, event.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
        if (typeof subscriptionId !== 'string') break;

        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        const familyId = await sync(subscription);
        if (familyId) {
          await record({
            familyId,
            kind: 'paiement_echoue',
            eventId: event.id,
            status: statusOf(subscription),
            plan: planOf(subscription),
            amountCents: invoice.amount_due ?? null,
          });
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
