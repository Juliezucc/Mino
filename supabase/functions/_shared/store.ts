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
 * On ne vérifie plus la signature d'Apple : **on demande à Apple.**
 *
 * La bibliothèque officielle validait la chaîne de certificats hors ligne.
 * Elle ne peut pas tourner ici : les fonctions Supabase s'exécutent sur Deno,
 * dont le `X509Certificate` est une coquille — ni `toString()`, ni `raw`, donc
 * aucun accès aux octets du certificat. Deux erreurs successives l'ont montré
 * en bac à sable, et il n'y avait pas de troisième correctif à tenter.
 *
 * Alors on renverse la charge : la fonction lit la transaction que le
 * téléphone annonce **sans la croire**, en tire l'identifiant, et interroge
 * l'API serveur d'Apple avec une clé qui n'appartient qu'à nous. Ce qu'Apple
 * répond fait foi. La confiance ne vient plus d'un calcul de notre côté mais
 * d'un appel authentifié à la source.
 *
 * **C'est plus sûr, pas moins.** Une signature qu'on valide soi-même est une
 * signature qu'on peut valider de travers, et une chaîne mal vérifiée accepte
 * n'importe quoi. Ici, un jeton inventé ne désigne aucune transaction chez
 * Apple, et un jeton volé à un tiers désigne une transaction dont le jeton de
 * compte ne correspond pas à la famille appelante — `store-purchase` le
 * refuse, et c'est le contrôle qui a toujours compté.
 *
 * C'est aussi exactement ce que fait déjà le rail Google, quelques lignes plus
 * bas : signer un jeton, demander à la boutique, croire sa réponse.
 */

const apiApple = () =>
  Deno.env.get('APPLE_ENVIRONMENT') === 'sandbox'
    ? 'https://api.storekit-sandbox.itunes.apple.com'
    : 'https://api.storekit.itunes.apple.com';

const base64url = (octets: Uint8Array): string =>
  btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const base64urlTexte = (texte: string): string =>
  base64url(new TextEncoder().encode(texte));

/**
 * La charge utile d'un JWS, lue **sans vérifier la signature**.
 *
 * Employé à deux endroits, et jamais pour décider quoi que ce soit :
 * y prendre l'identifiant de transaction à demander à Apple, et relire ce
 * qu'Apple vient de nous répondre — une réponse arrivée par TLS depuis les
 * serveurs d'Apple, pour un appel signé de notre clé.
 */
function chargeJws(jws: string): Record<string, unknown> {
  const partie = jws.split('.')[1];
  if (!partie) throw new Error('Jeton Apple illisible.');

  const b64 = partie.replace(/-/g, '+').replace(/_/g, '/');
  const octets = Uint8Array.from(
    atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')),
    (c) => c.charCodeAt(0),
  );
  return JSON.parse(new TextDecoder().decode(octets)) as Record<string, unknown>;
}

/** La clé privée d'App Store Connect, importée une fois par instance. */
let cleApple: Promise<CryptoKey> | null = null;

function chargerCleApple(): Promise<CryptoKey> {
  if (cleApple) return cleApple;

  cleApple = (async () => {
    const pem = env('APPLE_PRIVATE_KEY')
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');

    return await crypto.subtle.importKey(
      'pkcs8',
      Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  })().catch((erreur) => {
    // Ne pas garder une promesse rejetée en mémoire : la fonction survit à
    // plusieurs requêtes, et un secret corrigé entre-temps doit pouvoir
    // reprendre sans redéploiement.
    cleApple = null;
    throw erreur;
  });

  return cleApple;
}

/** Le jeton qui nous identifie auprès d'Apple, signé ES256. */
async function jetonApple(): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);

  const entete = { alg: 'ES256', kid: env('APPLE_KEY_ID'), typ: 'JWT' };
  const charge = {
    iss: env('APPLE_ISSUER_ID'),
    iat: maintenant,
    // Apple refuse au-delà d'une heure. Dix minutes suffisent largement et
    // bornent ce qu'un jeton intercepté permettrait.
    exp: maintenant + 600,
    aud: 'appstoreconnect-v1',
    bid: env('APPLE_BUNDLE_ID'),
  };

  const nonSigne = `${base64urlTexte(JSON.stringify(entete))}.${base64urlTexte(JSON.stringify(charge))}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await chargerCleApple(),
    new TextEncoder().encode(nonSigne),
  );

  return `${nonSigne}.${base64url(new Uint8Array(signature))}`;
}

interface LigneApple {
  originalTransactionId?: string;
  signedTransactionInfo?: string;
  signedRenewalInfo?: string;
}

/**
 * L'état d'un abonnement, tel qu'Apple le décrit maintenant.
 *
 * On interroge l'environnement configuré, puis l'autre en cas de 404. Ce n'est
 * pas de la complaisance : une transaction de bac à sable est introuvable en
 * production et réciproquement, et le jour où `APPLE_ENVIRONMENT` passera à
 * `production` il restera des transactions de test dans la base. Sans ce
 * rattrapage, elles deviendraient toutes des erreurs illisibles.
 */
async function etatApple(originalTransactionId: string): Promise<StoreState> {
  const hotes = [apiApple()];
  const autre =
    apiApple() === 'https://api.storekit-sandbox.itunes.apple.com'
      ? 'https://api.storekit.itunes.apple.com'
      : 'https://api.storekit-sandbox.itunes.apple.com';
  hotes.push(autre);

  let dernier = '';

  for (const hote of hotes) {
    const reponse = await fetch(
      `${hote}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`,
      { headers: { Authorization: `Bearer ${await jetonApple()}` } },
    );

    if (reponse.status === 404) {
      dernier = 'Apple ne connaît pas cette transaction.';
      continue;
    }

    if (!reponse.ok) {
      const corps = await reponse.text().catch(() => '');
      throw new Error(`Apple a refusé la vérification (${reponse.status}) ${corps}`.trim());
    }

    const data = (await reponse.json()) as { data?: { lastTransactions?: LigneApple[] }[] };
    const lignes = (data.data ?? []).flatMap((groupe) => groupe.lastTransactions ?? []);
    const ligne =
      lignes.find((l) => l.originalTransactionId === originalTransactionId) ?? lignes[0];

    if (!ligne?.signedTransactionInfo) {
      dernier = 'Apple ne rend aucune transaction pour cet abonnement.';
      continue;
    }

    return appleToState(
      chargeJws(ligne.signedTransactionInfo),
      ligne.signedRenewalInfo ? chargeJws(ligne.signedRenewalInfo) : null,
    );
  }

  throw new Error(dernier || 'Vérification Apple impossible.');
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

  /**
   * L'essai gratuit d'Apple, qui n'existait pas quand ce code a été écrit.
   *
   * Le parcours d'inscription enregistre désormais la carte à l'entrée, avec
   * une offre d'introduction « Gratuit · 1 mois » chez Apple : la quasi-totalité
   * des abonnements iPhone naîtront donc en essai, et pas en abonnement payé.
   *
   * Sans cette lecture, ils arrivaient tous en `active`, et l'application
   * annonçait « Abonnement actif · prochain paiement le 9 octobre » à quelqu'un
   * qui n'a rien payé du tout. C'est le défaut exactement symétrique de celui
   * corrigé sur Stripe le 9 septembre 2026 — le même écran, l'autre rail.
   *
   * `offerType` est le champ moderne (1 = offre d'introduction) ; `isTrialPeriod`
   * celui des reçus plus anciens. On lit les deux : une transaction vérifiée
   * aujourd'hui peut porter l'un ou l'autre selon sa date d'origine.
   */
  const enEssai =
    Number(transaction.offerType ?? 0) === 1 ||
    transaction.isTrialPeriod === true ||
    transaction.isTrialPeriod === 'true';

  return {
    platform: 'apple',
    accountToken: (transaction.appAccountToken as string) ?? null,
    productId,
    transactionId: String(transaction.originalTransactionId ?? transaction.transactionId ?? ''),
    status: revoked || expired
      ? 'canceled'
      : inBillingRetry
        ? 'past_due'
        : enEssai
          ? 'trialing'
          : 'active',
    plan: planOfProduct(productId),
    expiresAt: expiresMs > 0 ? new Date(expiresMs).toISOString() : null,
    cancelAtPeriodEnd: !willRenew,
    amountCents: typeof transaction.price === 'number' ? Math.round(transaction.price / 10) : null,
  };
}

/**
 * Une notification d'Apple : on lit ce qu'elle annonce, et on demande la vérité.
 *
 * **Le contenu de la notification ne décide de rien.** N'importe qui peut en
 * poster une à cette adresse — elle est publique par nécessité, Apple ne
 * présente aucun jeton. On n'y prend donc qu'un identifiant de transaction,
 * puis on interroge Apple pour connaître l'état réel de cet abonnement.
 *
 * Une notification inventée désigne une transaction qui n'existe pas, et la
 * fonction s'arrête. Une notification recopiée depuis une vraie ne fait que
 * provoquer une relecture de l'état véritable — c'est-à-dire rien de
 * nuisible, puisque c'est exactement ce que la notification légitime aurait
 * fait.
 */
export async function verifyAppleNotification(signedPayload: string): Promise<{
  kind: string;
  state: StoreState | null;
  raw: unknown;
}> {
  const notification = chargeJws(signedPayload);
  const donnees = (notification.data ?? {}) as { signedTransactionInfo?: string };

  const annonce = donnees.signedTransactionInfo
    ? chargeJws(donnees.signedTransactionInfo)
    : null;
  const original = annonce
    ? String(annonce.originalTransactionId ?? annonce.transactionId ?? '')
    : '';

  return {
    kind: `${notification.notificationType}${notification.subtype ? `.${notification.subtype}` : ''}`,
    state: original ? await etatApple(original) : null,
    raw: notification,
  };
}

/**
 * Une transaction précise, au retour d'un achat dans l'application.
 *
 * Le téléphone annonce une preuve ; on ne la croit pas. On y lit l'identifiant
 * de la transaction d'origine et on demande à Apple ce qu'il en est.
 */
export async function verifyAppleTransaction(signedTransaction: string): Promise<StoreState> {
  const annonce = chargeJws(signedTransaction);
  const original = String(annonce.originalTransactionId ?? annonce.transactionId ?? '');
  if (!original) throw new Error('Transaction Apple illisible.');
  return await etatApple(original);
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

/**
 * L'étiquette qui, dans la Play Console, désigne l'offre d'essai gratuit.
 *
 * Google ne dit pas « ceci est un essai » : contrairement à Apple et son
 * `offerType`, l'API v2 ne rend aucun champ qui distingue une période gratuite
 * d'une période payée. Ce qu'elle rend, ce sont les **étiquettes** posées sur
 * l'offre au moment de sa création — et c'est le mécanisme que Google
 * documente pour qu'un serveur sache quelle offre s'applique.
 *
 * Il faut donc que l'offre « 30 jours offerts » porte l'étiquette `essai` dans
 * la Play Console. Si elle change de nom un jour, cette variable
 * d'environnement évite d'avoir à redéployer du code.
 */
const ETIQUETTE_ESSAI = (Deno.env.get('GOOGLE_TRIAL_OFFER_TAG') ?? 'essai').toLowerCase();

/**
 * Traduit un abonnement Play vérifié en état d'abonnement.
 *
 * Séparé de l'appel réseau pour la même raison qu'`appleToState` : c'est ici
 * que sont les décisions, et une décision se relit.
 */
export function googleToState(
  purchase: Record<string, any>,
  purchaseToken: string,
): StoreState {
  const line = purchase.lineItems?.[0] ?? {};
  const state = String(purchase.subscriptionState ?? '');
  const productId = String(line.productId ?? '');

  /**
   * L'essai gratuit, qui arrivait en « abonnement payé ».
   *
   * Le parcours d'inscription enregistre le moyen de paiement à l'entrée : la
   * quasi-totalité des abonnements Android naîtront donc en essai. Sans cette
   * lecture, ils étaient tous écrits `active` — et un abonnement `active` sans
   * `trial_ends_at` fait dire à l'application « prochain paiement le … » à
   * quelqu'un qui n'a rien payé.
   *
   * Pire, et c'est ce qui a été corrigé côté Apple le 9 septembre 2026 : c'est
   * `trial_ends_at` qui porte l'accès pendant l'essai. L'oublier enfermait le
   * parent dehors à la seconde même de son achat.
   */
  const etiquettes: string[] = Array.isArray(line.offerDetails?.offerTags)
    ? line.offerDetails.offerTags.map((t: unknown) => String(t).toLowerCase())
    : [];
  const enEssai =
    etiquettes.includes(ETIQUETTE_ESSAI) ||
    /essai|trial|free/i.test(String(line.offerDetails?.offerId ?? ''));

  /**
   * « Résilié » chez Google ne veut pas dire « terminé ».
   *
   * `SUBSCRIPTION_STATE_CANCELED` désigne un abonnement que le parent a résilié
   * et **qui court encore jusqu'à sa date d'expiration** — Google réserve
   * `EXPIRED` à celui qui est vraiment fini. Le traiter comme `canceled`
   * retirait l'accès à l'instant du clic, alors que la période est payée.
   * L'écran des réglages promet exactement l'inverse : « Résilié · actif
   * jusqu'à la fin de la période ». La loi française aussi.
   *
   * Écrit en `active` avec sa date de fin, `accessOf` fait le reste tout seul :
   * l'accès tombe le jour venu, sans qu'aucune tâche n'ait à passer.
   */
  const encoreDu =
    state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_CANCELED';

  return {
    platform: 'google',
    accountToken: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    productId,
    transactionId: String(purchase.latestOrderId ?? purchaseToken),
    status: encoreDu
      ? enEssai
        ? 'trialing'
        : 'active'
      : // Le paiement est en échec et Google réessaie. On garde l'accès, comme
        // sur le rail Stripe : couper pendant une nouvelle tentative punit une
        // carte expirée avant même que son porteur ne l'apprenne.
        state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' || state === 'SUBSCRIPTION_STATE_ON_HOLD'
        ? 'past_due'
        : 'canceled',
    plan: planOfProduct(productId),
    expiresAt: line.expiryTime ?? null,
    // Google dit « ne se renouvellera pas » plutôt que « annulé ».
    cancelAtPeriodEnd:
      line.autoRenewingPlan?.autoRenewEnabled === false ||
      state === 'SUBSCRIPTION_STATE_CANCELED',
    amountCents: null,
  };
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
  return googleToState(await response.json(), purchaseToken);
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

  const { error } = await db.from('subscriptions').upsert({
    family_id: familyId,
    status: state.status,
    plan: state.plan,
    current_period_end: state.expiresAt,
    /**
     * **Sans cette ligne, un abonné en essai serait enfermé dehors.**
     *
     * `accessOf` calcule l'accès d'un abonnement `trialing` à partir de
     * `trial_ends_at` — et une date absente vaut zéro jour restant, donc
     * « expiré ». Un parent qui vient d'enregistrer sa carte chez Apple aurait
     * donc perdu l'accès à la seconde même de son achat, sans qu'aucune erreur
     * n'apparaisse nulle part : la transaction est valide, la ligne est
     * écrite, et le verrou tombe quand même.
     *
     * Chez Apple, la fin de l'essai gratuit EST la date d'expiration de la
     * transaction : tant que l'offre d'introduction court, `expiresDate`
     * désigne le jour du premier prélèvement.
     *
     * On n'écrit rien quand ce n'est pas un essai : effacer la date d'essai
     * d'une famille qui en avait un reviendrait à lui retirer le sien.
     */
    ...(state.status === 'trialing' ? { trial_ends_at: state.expiresAt } : {}),
    cancel_at_period_end: state.cancelAtPeriodEnd,
    source: state.platform,
    store_product_id: state.productId,
    store_transaction_id: state.transactionId,
    updated_at: new Date().toISOString(),
  });

  /**
   * L'erreur était jetée, comme elle l'était côté Stripe.
   *
   * C'est la seule écriture qui donne l'accès à une famille qui vient de
   * payer. Sans lecture de l'erreur, Apple recevait un accusé de réception, la
   * table restait en l'état, et le parent gardait un écran d'abonnement qui ne
   * savait rien de son achat — silencieux des deux côtés, sur le chemin de
   * l'argent. On lève : l'appelant répond alors une erreur, et la notification
   * serveur d'Apple est rejouée.
   */
  if (error) {
    console.error('achat non enregistré', familyId, state.transactionId, error.message);
    throw new Error(`subscriptions upsert (${familyId}) : ${error.message}`);
  }

  return familyId;
}
