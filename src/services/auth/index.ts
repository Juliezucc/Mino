import { getSupabaseClient } from '@/data/supabaseRepository';

import { AuthService } from './AuthService';
import { LocalAuthService } from './LocalAuthService';
import { SupabaseAuthService } from './SupabaseAuthService';

export * from './AuthService';
export { LocalAuthService, SupabaseAuthService };

let instance: AuthService | null = null;

/**
 * Real accounts as soon as Supabase is configured, and a single-device
 * stand-in otherwise — so the app always runs, and every screen is written
 * against one interface.
 */
export function getAuthService(): AuthService {
  if (!instance) {
    const client = getSupabaseClient();
    instance = client ? new SupabaseAuthService(client) : new LocalAuthService();
  }
  return instance;
}

/** Test hook. */
export function setAuthService(service: AuthService | null) {
  instance = service;
}
