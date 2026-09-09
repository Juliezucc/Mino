// Le parrainage, et le journal de facturation qui l'accompagne.
//
// **Pourquoi ce fichier existe.** Les deux vivaient dans `stripe-webhook`, et
// c'était vrai tant que Stripe était le seul rail. Depuis que l'application
// vend par l'App Store et le Play Store, un filleul qui paie chez Apple ne
// déclenchait plus rien du tout : la ligne `referrals` restait `pending` pour
// toujours, et le parrain n'était pas même compté. Le programme entier
// dépendait d'un événement qui, pour la majorité des nouveaux abonnés,
// n'arrive jamais.
//
// Le règlement du parrainage n'a rien de propre à Stripe : un filleul paie, un
// parrain gagne un mois. Seule la *livraison* de ce mois dépend du rail, et
// c'est le seul endroit où ce fichier regarde par quelle porte l'argent est
// passé.

import { admin, stripe } from './mino.ts';
import { MONTHLY_PRICE_EUR, REFERRAL, qualifyReferral } from '../../../src/domain/billing.ts';

/**
 * Ajoute une ligne au journal de facturation.
 *
 * `subscriptions` est un miroir : chaque changement l'écrase. Une famille qui a
 * essayé, payé quatre mois et qui part n'y laisse qu'une seule ligne
 * « canceled » — d'où l'impossibilité d'en tirer après coup le churn, les
 * cohortes ou le revenu passé. Ce ne sont pas des calculs difficiles sans ce
 * journal : ils sont impossibles, parce que le fait n'a jamais été écrit.
 *
 * `stripe_event_id` est unique — le nom a vieilli, la colonne accueille aussi
 * les identifiants d'Apple et de Google — et les deux boutiques rejouent leurs
 * notifications : un doublon est ignoré plutôt que compté deux fois.
 */
export async function record(input: {
  familyId: string;
  kind: string;
  eventId: string;
  status?: string | null;
  plan?: string | null;
  amountCents?: number | null;
  occurredAt?: string;
}): Promise<boolean> {
  const { data, error } = await admin()
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
    )
    .select('stripe_event_id');

  // Une ligne de journal manquante ne doit jamais faire échouer un webhook : la
  // boutique rejouerait, et le miroir — ce que l'application lit réellement —
  // est déjà juste.
  if (error) {
    console.error('journal facturation', input.kind, error);
    return false;
  }

  /**
   * Vrai seulement si la ligne vient d'être écrite.
   *
   * L'unicité de `stripe_event_id` sert déjà à ne pas compter deux fois une
   * notification rejouée. Rendre cette information permet de s'en servir comme
   * verrou : un décompte qui ne doit avoir lieu qu'une fois s'accroche à cette
   * réponse plutôt qu'à un drapeau qu'il faudrait inventer ailleurs.
   */
  return (data ?? []).length > 0;
}

/**
 * Donner au parrain le mois promis, par la porte qui existe chez lui.
 *
 * **Stripe, en essai** : on repousse la fin de l'essai d'un mois. La date de
 * premier paiement recule vraiment.
 *
 * **Stripe, payant** : un avoir au solde du client, que Stripe déduit de la
 * facture suivante.
 *
 * **App Store et Play Store : aucune des deux portes n'existe.** On ne peut
 * demander ni à Apple ni à Google de sauter un prélèvement, et il n'y a pas de
 * solde client à créditer. Le mécanisme prévu pour cela — les offres
 * promotionnelles, signées par notre serveur — demande une clé d'abonnement et
 * une configuration dans chaque console. En attendant, **le mois est mis de
 * côté dans `credit_months` et rien n'est perdu** : le compte est tenu, et il
 * sera honoré le jour où la porte existera.
 *
 * Écrire une date à nous pendant qu'Apple prélève à la sienne serait pire que
 * de ne rien faire : l'application annoncerait un prélèvement qui n'arrive pas
 * quand il est annoncé. C'est la classe de défaut qui a coûté deux corrections
 * le 9 septembre 2026, et on ne la refait pas ici.
 */
export async function rewardReferrer(referrerFamilyId: string) {
  const db = admin();
  const { data: sub } = await db
    .from('subscriptions')
    .select('*')
    .eq('family_id', referrerFamilyId)
    .maybeSingle();

  if (!sub) return;

  const rail = (sub.source ?? null) as 'stripe' | 'apple' | 'google' | null;
  const surStripe = rail === 'stripe' || (rail === null && !!sub.customer_id);

  const mettreDeCote = () =>
    db
      .from('subscriptions')
      .update({ credit_months: (sub.credit_months ?? 0) + REFERRAL.referrerFreeMonths })
      .eq('family_id', referrerFamilyId);

  if (!surStripe) return void (await mettreDeCote());

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

  // Pas encore de client de facturation : on met de côté, et on dépensera au
  // premier paiement.
  await mettreDeCote();
}

/**
 * Le filleul vient de payer pour de bon : on règle le parrainage qui l'attend.
 *
 * **Rejouable par construction.** La ligne n'est cherchée qu'en `pending` :
 * une notification rejouée — les deux boutiques le font, Stripe aussi — ne
 * trouve plus rien et ne crédite pas deux fois.
 *
 * `eventId` sert au journal, dont la clé est unique : même en cas de course
 * entre deux notifications, la ligne de comptabilité n'existe qu'une fois.
 */
export async function settleReferral(refereeFamilyId: string, eventId: string) {
  const db = admin();

  const { data: pending } = await db
    .from('referrals')
    .select('*')
    .eq('referee_family_id', refereeFamilyId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!pending) return;

  // Tout l'historique du parrain : le plafond annuel s'en déduit.
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

  // La règle que l'application affiche et que les tests couvrent — importée,
  // pas retapée.
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
