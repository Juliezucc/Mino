import { SupabaseClient } from '@supabase/supabase-js';

import { AuthResult, AuthService, NO_SESSION, Session } from './AuthService';

/**
 * Real accounts, on Supabase.
 *
 * Two rules run through every method here.
 *
 * Nothing tells an attacker whether an address has an account. A sign-up on a
 * taken address and a password reset on an unknown one both answer the same
 * calm sentence, because "this e-mail is already registered" is a list of your
 * customers handed out for free.
 *
 * And the parent PIN never crosses this boundary in either direction. It is
 * checked by `verify_parent_pin`, a rate-limited server function; the hash
 * lives in a table with no read policy at all, so not even the parent's own
 * device can fetch it.
 */
export class SupabaseAuthService implements AuthService {
  readonly name = 'supabase';
  readonly remote = true;

  constructor(private readonly client: SupabaseClient) {}

  async session(): Promise<Session> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    if (!user) return NO_SESSION;
    return {
      // An anonymous user is a child's device; a real e-mail is a parent.
      kind: user.email ? 'parent' : 'device',
      userId: user.id,
      email: user.email ?? null,
    };
  }

  onChange(listener: (session: Session) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange(() => {
      this.session().then(listener).catch(() => listener(NO_SESSION));
    });
    return () => data.subscription.unsubscribe();
  }

  /**
   * Idempotent : le dépôt ouvre déjà une session anonyme au moment de
   * rejoindre, et une session existante ne doit surtout pas être remplacée —
   * ce serait déconnecter un parent en lui faisant scanner le code de sa
   * propre famille.
   */
  async signInAsDevice(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    if (data.session) return;
    await this.client.auth.signInAnonymously();
  }

  async signUp({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const { error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      // Deliberately the same message whether the address is free or taken.
      return { ok: false, reason: 'Impossible de créer le compte. Vérifiez l’adresse et réessayez.' };
    }
    return { ok: true };
  }

  async signIn({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { ok: false, reason: 'E-mail ou mot de passe incorrect.' };
    return { ok: true };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase());
    // Always the same answer: anything else says whether the account exists.
    return { ok: true };
  }

  async setParentPin(pin: string): Promise<AuthResult> {
    if (!/^\d{4}$/.test(pin)) return { ok: false, reason: 'Le code doit contenir 4 chiffres.' };
    const { error } = await this.client.rpc('set_parent_pin', { p_pin: pin });
    if (error) return { ok: false, reason: 'Impossible d’enregistrer le code.' };
    return { ok: true };
  }

  async hasParentPin(): Promise<boolean> {
    const { data } = await this.client.rpc('has_parent_pin');
    return data === true;
  }

  async verifyParentPin(pin: string): Promise<AuthResult> {
    const { data, error } = await this.client.rpc('verify_parent_pin', { p_pin: pin });
    if (error) return { ok: false, reason: 'Vérification impossible. Réessayez.' };
    if (data === true) return { ok: true };
    // The server answers false both for a wrong code and for too many tries;
    // it says which through a separate, non-secret call.
    const { data: locked } = await this.client.rpc('parent_pin_locked_seconds');
    if (typeof locked === 'number' && locked > 0) {
      return { ok: false, reason: `Trop d’essais. Réessayez dans ${Math.ceil(locked / 60)} min.` };
    }
    return { ok: false, reason: 'Code incorrect.' };
  }
}
