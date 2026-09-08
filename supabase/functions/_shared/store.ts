// Vérification des achats App Store et Play Store.
//
// Le principe est le même que pour Stripe, et il ne se négocie pas : **le
// téléphone ne décide jamais qu'il est abonné.** Il transmet une preuve, ce
// fichier la fait vérifier par Apple ou par Google, et seul le résultat de
// cette vérification est écrit dans la base.
//
// Un reçu lu et interprété côté application est un reçu qu'une application
// modifiée peut fabriquer. C'est la faille classique de l'achat in-app, et
// elle se referme ici ou nulle part.

import { X509Certificate } from 'node:crypto';

import { admin, env } from './mino.ts';

export type StorePlatform = 'apple' | 'google';

/** Ce qu'on retient d'un abonnement, quelle que soit la boutique. */
export interface StoreState {
  platform: StorePlatform;
  accountToken: string | null;
  productId: string;
  transactionId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
  /** Résilié, mais la période payée court encore. */
  cancelAtPeriodEnd: boolean;
  /** Prix payé en centimes, hors taxes quand la boutique le donne. */
  amountCents: number | null;
}

/** 15 % (Small Business / abonnements Play) ou 30 % (Apple, première année). */
const commission = () => Number(Deno.env.get('STORE_COMMISSION_RATE') ?? '0.15');

/**
 * Ce qui reste après commission.
 *
 * Écrit dans le journal à côté du montant brut, faute de quoi le MRR mélange
 * des euros qui ne valent pas la même chose selon le rail — l'écart est
 * d'environ un cinquième.
 */
export function netCents(amountCents: number | null): number | null {
  if (amountCents === null) return null;
  return Math.round(amountCents * (1 - commission()));
}

/* ------------------------------------------------------------------- Apple */

/**
 * Ce que Deno n'implémente pas, et qu'Apple appelle quand même.
 *
 * **Le premier achat en bac à sable a échoué exactement ici.** La
 * bibliothèque d'Apple vérifie la chaîne de certificats en appelant
 * `toString()` sur chaque certificat, et Deno — sur lequel tournent les
 * fonctions Supabase — répond `ERR_NOT_IMPLEMENTED: Not implemented:
 * crypto.X509Certificate.prototype.toString`. Ni notre faute ni un réglage :
 * une incompatibilité entre le code d'Apple et le moteur.
 *
 * Node documente exactement ce que rend cette méthode : le certificat encodé
 * en PEM. On le reconstruit depuis `raw`, qui est le DER et que Deno, lui,
 * fournit. Ce n'est pas une approximation — c'est la même chaîne, produite
 * autrement.
 *
 * On ne remplace la méthode que si elle manque : le jour où Deno
 * l'implémentera, la sienne l'emportera.
 */
function poserToStringDesCertificats() {
  const proto = X509Certificate.prototype as unknown as {
    toString?: () => string;
    raw: Uint8Array;
  };

  try {
    // Un certificat quelconque suffit à savoir si la méthode répond : celui
    // d'Apple est déjà là, et il ne coûte rien à relire.
    const essai = new X509Certificate(racinesApple()[0]);
    essai.toString();
    return;
  } catch {
    // Elle manque, ou elle lève : dans les deux cas on la fournit.
  }

  proto.toString = function pem(this: { raw: Uint8Array }) {
    const b64 = btoa(String.fromCharCode(...this.raw));
    const lignes = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
    return `-----BEGIN CERTIFICATE-----\n${lignes}\n-----END CERTIFICATE-----\n`;
  };
}

/** La racine Apple, au format DER, fournie en base64 dans la configuration. */
function racinesApple(): Uint8Array[] {
  return env('APPLE_ROOT_CA_G3_BASE64')
    .split(',')
    .map((b64) => Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0)));
}

/**
 * Apple signe tout ce qu'il envoie (JWS). La vérification comprend la
 * validation de la chaîne de certificats jusqu'à la racine Apple — c'est
 * précisément ce que fait la bibliothèque officielle, et c'est la raison de ne
 * pas la réécrire : une chaîne mal validée accepte n'importe quelle signature.
 */
async function appleVerifier() {
  const { SignedDataVerifier, Environment } = await import(
    'npm:@apple/app-store-server-library@1'
  );

  poserToStringDesCertificats();

  return new SignedDataVerifier(
    racinesApple(),
    /**
     * Les vérifications en ligne, désactivées — et c'est un arbitrage, pas un
     * oubli.
     *
     * Ce drapeau ajoute une interrogation OCSP : à chaque achat, la fonction
     * appelle les serveurs d'Apple pour demander si un certificat de la chaîne
     * a été révoqué. Dans une fonction de bord démarrée à froid, cela s'est
     * mesuré en dizaines de secondes — les quarante-cinq secondes d'attente
     * observées au premier essai.
     *
     * Ce qu'on perd : la détection d'un certificat de signature révoqué par
     * Apple. Ce qu'on garde : la signature elle-même, et la chaîne validée
     * jusqu'à la racine embarquée ici. Un attaquant devrait donc obtenir un
     * certificat émis par Apple **puis** attendre sa révocation pour que la
     * différence compte — et la notification serveur à serveur, qui fait foi,
     * repasserait derrière.
     */
    false,
    Deno.env.get('APPLE_ENVIRONMENT') === 'sandbox' ? Environment.SANDBOX : Environment.PRODUCTION,
    env('APPLE_BUNDLE_ID'),
    Number(env('APPLE_APP_APPLE_ID')),
  );
}

const planOfProduct = (productId: string): 'monthly' | 'yearly' | null => {
  if (productId.includes('annual') || productId.includes('yearly')) return 'yearly';
  if (productId.includes('month')) return 'monthly';
  return null;
};

/**
 * Traduit une transaction Apple vérifiée en état d'abonnement.
 *
 * `revocationDate` d'abord : un remboursement doit couper l'accès, et le
 * traiter après l'expiration reviendrait à laisser un abonnement remboursé
 * actif jusqu'à sa date de fin.
 */
export function appleToState(
  transaction: Record<string, unknown>,
  renewal: Record<string, unknown> | null,
): StoreState {
  const productId = String(transaction.productId ?? '');
  const expiresMs = Number(transaction.expiresDate ?? 0);
  const revoked = transaction.revocationDate !== undefined;
  const expired = expiresMs > 0 && expiresMs < Date.now();

  // 1 = renouvellement actif, 0 = désactivé par le client.
  const willRenew = renewal ? Number(renewal.autoRenewStatus ?? 1) === 1 : true;
  // 1 = en cours de nouvelle tentative de paiement.
  const inBillingRetry = renewal ? Number(renewal.isInBillingRetry ?? 0) === 1 : false;

  return {
    platform: 'apple',
    accountToken: (transaction.appAccountToken as string) ?? null,
    productId,
    transactionId: String(transaction.originalTransactionId ?? transaction.transactionId ?? ''),
    status: revoked || expired ? 'canceled' : inBillingRetry ? 'past_due' : 'active',
    plan: planOfProduct(productId),
    expiresAt: expiresMs > 0 ? new Date(expiresMs).toISOString() : null,
    cancelAtPeriodEnd: !willRenew,
    amountCents: typeof transaction.price === 'number' ? Math.round(transaction.price / 10) : null,
  };
}

/** Vérifie une notification signée d'Apple et en tire l'état. */
export async function verifyAppleNotification(signedPayload: string): Promise<{
  kind: string;
  state: StoreState | null;
  raw: unknown;
}> {
  const verifier = await appleVerifier();
  const payload = await verifier.verifyAndDecodeNotification(signedPayload);

  const signedTransaction = payload?.data?.signedTransactionInfo;
  const signedRenewal = payload?.data?.signedRenewalInfo;

  const transaction = signedTransaction
    ? await verifier.verifyAndDecodeTransaction(signedTransaction)
    : null;
  const renewal = signedRenewal ? await verifier.verifyAndDecodeRenewalInfo(signedRenewal) : null;

  return {
    kind: `${payload.notificationType}${payload.subtype ? `.${payload.subtype}` : ''}`,
    state: transaction ? appleToState(transaction as never, renewal as never) : null,
    raw: payload,
  };
}

/** Vérifie une transaction précise, au retour d'un achat dans l'application. */
export async function verifyAppleTransaction(signedTransaction: string): Promise<StoreState> {
  const verifier = await appleVerifier();
  const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
  return appleToState(transaction as never, null);
}

/* ------------------------------------------------------------------ Google */

/**
 * Google ne signe pas l'état : il signale qu'il a changé.
 *
 * La notification ne contient qu'un jeton d'achat. Il faut ensuite interroger
 * l'API Play pour connaître l'état réel — ce qui est en fait plus sûr, puisque
 * la réponse vient directement de Google et ne transite par personne.
 */
async function googleAccessToken(): Promise<string> {
  const account = JSON.parse(env('GOOGLE_SERVICE_ACCOUNT_JSON'));
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${b64(header)}.${b64(claims)}`;

  const pem = account.private_key
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  );
  const signed = `${unsigned}.${btoa(String.fromCharCode(...signature))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signed,
    }),
  });

  const body = await response.json();
  if (!body.access_token) throw new Error('Jeton Google refusé.');
  return body.access_token as string;
}

/** L'état réel d'un abonnement Play, demandé à Google. */
export async function verifyGooglePurchase(purchaseToken: string): Promise<StoreState> {
  const token = await googleAccessToken();
  const packageName = env('ANDROID_PACKAGE_NAME');

  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) throw new Error(`Play a refusé la vérification (${response.status}).`);
  const purchase = await response.json();

  const line = purchase.lineItems?.[0] ?? {};
  const state = String(purchase.subscriptionState ?? '');

  return {
    platform: 'google',
    accountToken: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    productId: String(line.productId ?? ''),
    transactionId: String(purchase.latestOrderId ?? purchaseToken),
    status:
      state === 'SUBSCRIPTION_STATE_ACTIVE'
        ? 'active'
        : state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' || state === 'SUBSCRIPTION_STATE_ON_HOLD'
          ? 'past_due'
          : 'canceled',
    plan: planOfProduct(String(line.productId ?? '')),
    expiresAt: line.expiryTime ?? null,
    // Google dit « ne se renouvellera pas » plutôt que « annulé ».
    cancelAtPeriodEnd: line.autoRenewingPlan?.autoRenewEnabled === false,
    amountCents: null,
  };
}

/* ------------------------------------------------------------- application */

/**
 * Écrit un état vérifié dans la base — le seul chemin par lequel un achat de
 * boutique devient un abonnement.
 *
 * La famille est retrouvée par le jeton de compte transmis à l'achat. Sans lui
 * il n'y a rien à faire : la notification est conservée telle quelle, non
 * appliquée, et signalée. Mieux vaut un abonnement en attente qu'un abonnement
 * attribué à la mauvaise famille.
 */
export async function applyStoreState(
  state: StoreState,
  hint?: { familyId?: string },
): Promise<string | null> {
  const db = admin();

  let familyId = hint?.familyId ?? null;
  if (!familyId && state.accountToken) {
    const { data } = await db
      .from('families')
      .select('id')
      .eq('store_account_token', state.accountToken)
      .maybeSingle();
    familyId = (data?.id as string) ?? null;
  }

  if (!familyId) {
    console.error('achat sans famille identifiable', state.transactionId);
    return null;
  }

  await db.from('subscriptions').upsert({
    family_id: familyId,
    status: state.status,
    plan: state.plan,
    current_period_end: state.expiresAt,
    cancel_at_period_end: state.cancelAtPeriodEnd,
    source: state.platform,
    store_product_id: state.productId,
    store_transaction_id: state.transactionId,
    updated_at: new Date().toISOString(),
  });

  return familyId;
}
