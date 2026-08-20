// Shared helpers for the Mino Edge Functions (Deno).
//
// These run on Supabase, next to the database, and are the ONLY place allowed
// to write billing state. The app can read its own subscription row and nothing
// more — see the RLS policies in schema.sql.

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export { Stripe };

export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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
