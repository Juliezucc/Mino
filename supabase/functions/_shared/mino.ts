// Shared helpers for the Mino Edge Functions (Deno).
//
// These run on Supabase, next to the database, and are the ONLY place allowed
// to write billing state. The app can read its own subscription row and nothing
// more — see the RLS policies in schema.sql.

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export { Stripe };

/**
 * Les adresses depuis lesquelles un navigateur a le droit de nous appeler.
 *
 * `APP_ORIGIN` en contenait une seule, et c'était un piège à deux détentes.
 * Avec `https://app.minoapp.fr`, plus rien ne fonctionne depuis `localhost` :
 * le navigateur refuse la réponse et l'application affiche « Failed to
 * fetch », sans que rien n'indique qu'il s'agit d'un réglage de serveur. Et la
 * parade évidente — remettre `localhost` le temps de développer — se paie le
 * jour où l'on oublie de la retirer.
 *
 * La variable accepte donc une liste séparée par des virgules. On ne renvoie
 * jamais la liste : on renvoie **l'adresse de l'appelant si elle y figure**,
 * ce qui est la seule forme qu'un navigateur accepte.
 */
const ORIGINES = (Deno.env.get('APP_ORIGIN') ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function origineDe(request: Request): string {
  const demandee = request.headers.get('Origin');
  if (ORIGINES.includes('*')) return demandee ?? '*';
  if (demandee && ORIGINES.includes(demandee)) return demandee;
  // Aucune correspondance : on annonce la première de la liste. Le navigateur
  // refusera, ce qui est le comportement voulu — mais la réponse reste bien
  // formée, et la trace du refus est lisible dans sa console.
  return ORIGINES[0] ?? '*';
}

function entetes(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origineDe(request),
    // Sans `Vary`, un cache intermédiaire servirait à un site la réponse
    // autorisée pour un autre.
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

/**
 * Conservé pour les corps de réponse construits sans requête sous la main.
 * `servir` réécrit l'en-tête d'origine juste avant l'envoi, donc la valeur
 * posée ici n'est qu'un gabarit.
 */
export const CORS = {
  'Access-Control-Allow-Origin': ORIGINES[0] ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Enveloppe un gestionnaire pour qu'il réponde à la bonne origine.
 *
 * Le préflight est traité ici, une fois pour toutes, et l'en-tête d'origine
 * est réécrit sur la réponse rendue — ce qui évite de faire passer la requête
 * à travers les quelque soixante-dix appels à `json()` et `fail()` que
 * comptent ces fonctions.
 *
 * Les webhooks n'en ont pas besoin : Stripe et Apple ne sont pas des
 * navigateurs et ne connaissent pas CORS.
 */
export function servir(
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: entetes(request) });
    }
    const reponse = await handler(request);
    const sortie = new Headers(reponse.headers);
    for (const [cle, valeur] of Object.entries(entetes(request))) sortie.set(cle, valeur);
    return new Response(reponse.body, {
      status: reponse.status,
      statusText: reponse.statusText,
      headers: sortie,
    });
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function stripe(): Stripe {
  return new Stripe(env('STRIPE_SECRET_KEY'), { httpClient: Stripe.createFetchHttpClient() });
}

/** Service-role client: bypasses RLS, so it never touches a user-supplied id blindly. */
export function admin(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

/**
 * Resolves the caller's family from their JWT.
 *
 * The family id is NEVER taken from the request body: a client that can name
 * the family it acts on is a client that can act on someone else's.
 */
export async function familyOfCaller(
  request: Request,
): Promise<{ familyId: string; userId: string; email: string | null } | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });

  const { data: auth } = await anon.auth.getUser();
  if (!auth.user) return null;

  const { data: parent } = await admin()
    .from('parents')
    .select('family_id, email')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!parent) return null;
  return {
    familyId: parent.family_id as string,
    userId: auth.user.id,
    email: (parent.email as string | null) ?? auth.user.email ?? null,
  };
}

/* ------------------------------------------------------------------ mapping */

export interface SubscriptionRow {
  family_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  plan: 'monthly' | 'yearly' | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  credit_months: number;
  /** Par où le paiement est passé. Absent pendant l'essai, qui n'a pas de rail. */
  source: 'stripe' | 'apple' | 'google' | null;
  customer_id: string | null;
  subscription_id: string | null;
}

/** Rows are snake_case in Postgres, camelCase in the app. One place to convert. */
export function rowToSubscription(row: SubscriptionRow) {
  return {
    familyId: row.family_id,
    status: row.status,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    creditMonths: row.credit_months,
    source: row.source ?? undefined,
    customerId: row.customer_id ?? undefined,
    subscriptionId: row.subscription_id ?? undefined,
  };
}

export function rowToReferral(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    referrerFamilyId: row.referrer_family_id,
    refereeFamilyId: row.referee_family_id,
    status: row.status,
    createdAt: row.created_at,
    qualifiedAt: row.qualified_at ?? undefined,
    creditedAt: row.credited_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
  };
}

/**
 * Qui appelle — parent OU appareil d'enfant.
 *
 * `familyOfCaller` ne reconnaît que les parents, et c'est une propriété de
 * sécurité là où elle est utilisée : seul un parent peut acheter un abonnement
 * ou faire valoir un achat. Mais la notification part des deux côtés — c'est
 * l'appareil de l'enfant qui prévient le parent qu'une mission attend — et il
 * fallait donc un second résolveur, qui dit aussi **ce qu'est** l'appelant.
 *
 * `child_id` n'a de sens que pour un appareil : c'est le profil qu'il affiche,
 * et il permet de n'écrire qu'à l'appareil de l'enfant concerné plutôt qu'à
 * toute la fratrie.
 */
export async function appelant(request: Request): Promise<{
  familyId: string;
  userId: string;
  role: 'parent' | 'device';
  childId: string | null;
} | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });

  const { data: auth } = await anon.auth.getUser();
  if (!auth.user) return null;
  const db = admin();

  const { data: parent } = await db
    .from('parents')
    .select('family_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (parent) {
    return {
      familyId: parent.family_id as string,
      userId: auth.user.id,
      role: 'parent',
      childId: null,
    };
  }

  const { data: device } = await db
    .from('family_devices')
    .select('family_id, child_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!device) return null;
  return {
    familyId: device.family_id as string,
    userId: auth.user.id,
    role: 'device',
    childId: (device.child_id as string | null) ?? null,
  };
}
