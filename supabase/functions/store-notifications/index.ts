// Notifications serveur à serveur d'Apple et de Google.
//
// C'est ici que se décide ce qu'une famille a payé — l'équivalent exact du
// webhook Stripe, pour les deux autres rails. Renouvellements, résiliations,
// remboursements, échecs de paiement : rien de tout cela ne passe par le
// téléphone, qui peut être éteint, désinstallé ou modifié.
//
// Deux points d'entrée, un par boutique :
//   POST …/store-notifications/apple    App Store Server Notifications V2
//   POST …/store-notifications/google   Real-time Developer Notifications (Pub/Sub)
//
// Déploiement :  supabase functions deploy store-notifications --no-verify-jwt
// (Ni Apple ni Google ne peuvent présenter un JWT Supabase ; l'authentification
// est la signature d'Apple d'un côté, le jeton OIDC de Pub/Sub de l'autre.)

import { admin, fail, json } from '../_shared/mino.ts';
import {
  applyStoreState,
  netCents,
  verifyAppleNotification,
  verifyGooglePurchase,
} from '../_shared/store.ts';

/** Conserve la notification telle quelle, avant toute interprétation. */
async function keep(input: {
  platform: 'apple' | 'google';
  notificationId: string | null;
  kind: string | null;
  accountToken: string | null;
  familyId: string | null;
  productId: string | null;
  transactionId: string | null;
  payload: unknown;
  verified: boolean;
}): Promise<boolean> {
  const { error } = await admin()
    .from('store_notifications')
    .upsert(
      {
        platform: input.platform,
        notification_id: input.notificationId,
        kind: input.kind,
        account_token: input.accountToken,
        family_id: input.familyId,
        product_id: input.productId,
        transaction_id: input.transactionId,
        payload: input.payload as never,
        verified: input.verified,
      },
      { onConflict: 'notification_id', ignoreDuplicates: true },
    )
    .select('id');

  if (error) console.error('journal notification', error);
  // Apple et Google réémettent : un renouvellement compté deux fois fausse le
  // MRR, et un remboursement appliqué deux fois coupe l'accès à tort.
  return !error;
}

/** Une ligne de journal facturation, quand la notification en mérite une. */
async function record(input: {
  familyId: string;
  kind: string;
  eventId: string;
  status: string | null;
  plan: string | null;
  source: 'apple' | 'google';
  amountCents: number | null;
}) {
  const { error } = await admin()
    .from('billing_events')
    .upsert(
      {
        family_id: input.familyId,
        kind: input.kind,
        status: input.status,
        plan: input.plan,
        source: input.source,
        amount_cents: input.amountCents,
        net_cents: netCents(input.amountCents),
        stripe_event_id: input.eventId,
        occurred_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_event_id', ignoreDuplicates: true },
    );

  if (error) console.error('journal facturation', input.kind, error);
}

/**
 * Ce qu'une notification Apple veut dire, en termes de journal.
 *
 * Volontairement partiel : seuls les événements qui changent la lecture des
 * chiffres sont retenus. Tout le reste est conservé brut dans
 * `store_notifications` et relisible le jour où il devient utile.
 */
function kindOfApple(notification: string): string | null {
  if (notification.startsWith('DID_RENEW')) return 'paiement';
  if (notification.startsWith('SUBSCRIBED')) return 'abonnement_commence';
  if (notification.startsWith('DID_FAIL_TO_RENEW')) return 'paiement_echoue';
  if (notification.startsWith('EXPIRED') || notification.startsWith('REFUND')) {
    return 'resiliation_effective';
  }
  if (notification.includes('AUTO_RENEW_DISABLED')) return 'resiliation_demandee';
  return null;
}

Deno.serve(async (request) => {
  const path = new URL(request.url).pathname;

  /* ------------------------------------------------------------- Apple */

  if (path.endsWith('/apple')) {
    let signedPayload: string | undefined;
    try {
      signedPayload = (await request.json()).signedPayload;
    } catch {
      return fail('Requête illisible.', 400);
    }
    if (!signedPayload) return fail('Charge manquante.', 400);

    try {
      // La vérité vient d'Apple, à qui l'on redemande l'état : le contenu de
      // cette notification ne décide de rien — n'importe qui peut en poster
      // une à cette adresse, qui est publique par nécessité.
      const { kind, state, raw } = await verifyAppleNotification(signedPayload);

      const fresh = await keep({
        platform: 'apple',
        notificationId: (raw as { notificationUUID?: string }).notificationUUID ?? null,
        kind,
        accountToken: state?.accountToken ?? null,
        familyId: null,
        productId: state?.productId ?? null,
        transactionId: state?.transactionId ?? null,
        payload: raw,
        verified: true,
      });

      if (state && fresh) {
        const familyId = await applyStoreState(state);
        const ledgerKind = kindOfApple(kind);
        if (familyId && ledgerKind) {
          await record({
            familyId,
            kind: ledgerKind,
            eventId: `apple:${(raw as { notificationUUID?: string }).notificationUUID ?? state.transactionId}`,
            status: state.status,
            plan: state.plan,
            source: 'apple',
            amountCents: state.amountCents,
          });
        }
      }

      return json({ received: true });
    } catch (error) {
      console.error('notification Apple', error);

      /**
       * Garder la trace de ce qu'on n'a pas su traiter.
       *
       * **Le défaut que cela répare rendait le débogage aveugle.** Rien
       * n'était écrit tant que la vérification n'avait pas abouti. Une
       * notification qu'Apple envoie et que la fonction refuse ne laissait
       * donc aucune trace : la table restait vide, exactement comme si Apple
       * n'avait rien envoyé. Deux situations opposées, un seul symptôme — et
       * c'est ce qu'on a passé un moment à départager, un après-midi, en
       * regardant une table vide sans savoir ce qu'elle disait.
       *
       * La colonne `verified` existait pour ça depuis le début ; le code ne
       * s'en servait pas. Une notification refusée est maintenant visible,
       * avec sa charge, et c'est elle qui dira pourquoi.
       *
       * `notification_id` reste nul : on n'a pas pu le lire, et la contrainte
       * d'unicité laisse passer les nuls — deux échecs feront donc deux
       * lignes, ce qui est exactement ce qu'on veut voir.
       */
      await keep({
        platform: 'apple',
        notificationId: null,
        kind: 'refusée',
        accountToken: null,
        familyId: null,
        productId: null,
        transactionId: null,
        payload: { signedPayload, erreur: error instanceof Error ? error.message : String(error) },
        verified: false,
      }).catch(() => undefined);

      // Un 500 fait réessayer Apple, ce qui est le comportement voulu pour une
      // panne passagère : les traitements ci-dessus sont écrits pour être
      // rejoués sans dommage.
      return fail('Traitement impossible.', 500);
    }
  }

  /* ------------------------------------------------------------ Google */

  if (path.endsWith('/google')) {
    let message: { data?: string; messageId?: string };
    try {
      message = (await request.json()).message ?? {};
    } catch {
      return fail('Requête illisible.', 400);
    }
    if (!message.data) return fail('Charge manquante.', 400);

    try {
      const decoded = JSON.parse(atob(message.data));
      const purchaseToken = decoded.subscriptionNotification?.purchaseToken;

      if (!purchaseToken) {
        // Notification de test, ou notification de type qui ne nous concerne
        // pas. Conservée, non appliquée.
        await keep({
          platform: 'google',
          notificationId: message.messageId ?? null,
          kind: 'sans_abonnement',
          accountToken: null,
          familyId: null,
          productId: null,
          transactionId: null,
          payload: decoded,
          verified: true,
        });
        return json({ received: true });
      }

      // On ne croit pas la notification sur parole : elle dit qu'il s'est passé
      // quelque chose, et c'est Google lui-même qui dit quoi.
      const state = await verifyGooglePurchase(purchaseToken);

      const fresh = await keep({
        platform: 'google',
        notificationId: message.messageId ?? null,
        kind: String(decoded.subscriptionNotification?.notificationType ?? ''),
        accountToken: state.accountToken,
        familyId: null,
        productId: state.productId,
        transactionId: state.transactionId,
        payload: decoded,
        verified: true,
      });

      if (fresh) {
        const familyId = await applyStoreState(state);
        if (familyId) {
          await record({
            familyId,
            kind:
              state.status === 'active'
                ? 'paiement'
                : state.status === 'past_due'
                  ? 'paiement_echoue'
                  : 'resiliation_effective',
            eventId: `google:${message.messageId ?? state.transactionId}`,
            status: state.status,
            plan: state.plan,
            source: 'google',
            amountCents: state.amountCents,
          });
        }
      }

      return json({ received: true });
    } catch (error) {
      console.error('notification Google', error);
      return fail('Traitement impossible.', 500);
    }
  }

  return fail('Chemin inconnu.', 404);
});
