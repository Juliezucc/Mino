// Stripe's webhooks — the only writer of truth for what a family has paid.
//
// Everything the app shows about subscriptions ultimately comes from here. In
// particular, a referral month is credited only on a real paid invoice: reward
// at sign-up and you are paying for accounts, not for customers.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// (Stripe cannot present a Supabase JWT; the signature is the authentication.)

import { Stripe, admin, env, fail, stripe } from '../_shared/mino.ts';
// `record`, `settleReferral` et `rewardReferrer` vivaient ici. Ils sont partis
// dans `_shared/parrainage.ts` le jour où un filleul a pu payer ailleurs que
// chez Stripe : le règlement du parrainage n'a rien de propre à un rail.
import { record, settleReferral } from '../_shared/parrainage.ts';
import { MONTHLY_PRICE_EUR } from '../../../src/domain/billing.ts';

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
/**
 * Donner enfin les mois de parrainage mis de côté.
 *
 * **Le trou que cela bouche.** `rewardReferrer` sait récompenser un parrain
 * déjà client — il recule sa fin d'essai, ou lui porte un avoir. Mais un
 * parrain encore en essai, sans client de facturation chez Stripe, ne pouvait
 * recevoir ni l'un ni l'autre : son mois partait dans `credit_months`, « en
 * attendant ». Et rien, nulle part, ne le dépensait ensuite. Le compte était
 * tenu et jamais soldé — l'écran de parrainage affichait « Mois offert ✓ »
 * pour un mois que personne n'allait jamais donner.
 *
 * Le moment juste est celui-ci : le parrain vient de s'abonner, il a donc
 * maintenant un client chez Stripe. L'avoir est porté à son solde, et Stripe le
 * déduit de la première facture réelle — la fin d'essai reste à sa date, ce qui
 * évite d'annoncer un prélèvement à un jour et de le passer à un autre.
 *
 * **Rejouable.** Le verrou est la ligne de journal, dont la clé est unique :
 * Stripe rejoue ses notifications, et la seconde ne dépense rien.
 */
async function depenserMoisOfferts(
  familyId: string,
  subscription: Stripe.Subscription,
  eventId: string,
): Promise<void> {
  if (typeof subscription.customer !== 'string') return;

  const { data } = await admin()
    .from('subscriptions')
    .select('credit_months')
    .eq('family_id', familyId)
    .maybeSingle();

  const mois = Number(data?.credit_months ?? 0);
  if (mois < 1) return;

  const neuf = await record({
    familyId,
    kind: 'parrainage_consomme',
    eventId: `${eventId}:credit`,
    amountCents: -Math.round(MONTHLY_PRICE_EUR * 100) * mois,
  }).catch(() => false);
  if (!neuf) return;

  await stripe().customers.createBalanceTransaction(subscription.customer, {
    amount: -Math.round(MONTHLY_PRICE_EUR * 100) * mois,
    currency: 'eur',
    description: `Parrainage Mino — ${mois} mois offert${mois > 1 ? 's' : ''}`,
  });

  await admin().from('subscriptions').update({ credit_months: 0 }).eq('family_id', familyId);
}

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

        if (event.type === 'customer.subscription.created') {
          await depenserMoisOfferts(familyId, subscription, event.id);
        }

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
