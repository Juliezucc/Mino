import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthResult, AuthService, NO_SESSION, Session } from './AuthService';

const SESSION_KEY = 'mino.auth.session.v1';
const PIN_KEY = 'mino.auth.pin.v1';
const ATTEMPTS_KEY = 'mino.auth.pin.attempts.v1';

/** Same shape as the server's limit, so the UI behaves identically either way. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

/**
 * No backend: one device, one family, and the parent is whoever holds it.
 *
 * The rate limit is kept even here. Not because a local attacker is a threat
 * model worth much, but because it is the behaviour the parent will meet in
 * production, and a lock that appears only on some builds is a lock nobody
 * trusts.
 */
export class LocalAuthService implements AuthService {
  readonly name = 'local';
  readonly remote = false;

  private listeners = new Set<(session: Session) => void>();

  async session(): Promise<Session> {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return NO_SESSION;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return NO_SESSION;
    }
  }

  onChange(listener: (session: Session) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async publish(session: Session) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.listeners.forEach((l) => l(session));
  }

  async signUp({ email }: { email: string; password: string }): Promise<AuthResult> {
    // There is no server to hold a password against, and storing one on the
    // device would only pretend to protect something.
    await this.publish({ kind: 'parent', userId: 'local-parent', email: email.trim() });
    return { ok: true };
  }

  async signIn({ email }: { email: string; password: string }): Promise<AuthResult> {
    await this.publish({ kind: 'parent', userId: 'local-parent', email: email.trim() });
    return { ok: true };
  }

  /**
   * Le remplaçant local ne connaissait que « parent » : un appareil qui
   * rejoignait avec le code gardait donc une session vide, et rien à l'écran
   * ne pouvait savoir qu'il avait affaire à la tablette d'un enfant. C'est
   * exactement ce qui laissait passer le défaut du code parent. Une couture
   * locale qui ne reproduit pas la distinction que fait la vraie ne sert à
   * rien : c'est hors ligne qu'on juge les parcours.
   */
  async signInAsDevice(): Promise<void> {
    await this.publish({ kind: 'device', userId: 'local-device', email: null });
  }

  async signOut(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
    this.listeners.forEach((l) => l(NO_SESSION));
  }

  async requestPasswordReset(): Promise<AuthResult> {
    return { ok: true };
  }

  /** Hors ligne, aucun lien n'arrive : il n'y a pas de serveur pour en envoyer. */
  async resumeFromLink(): Promise<AuthResult> {
    return { ok: true };
  }

  /**
   * Hors ligne, il n'y a pas de mot de passe de compte : l'appareil EST la
   * session. On rend « fait » plutôt qu'une erreur — un écran qui échouerait
   * ici ferait croire à une panne là où il n'y a qu'une absence de compte.
   */
  async setPassword(): Promise<AuthResult> {
    return { ok: true };
  }

  async setParentPin(pin: string): Promise<AuthResult> {
    if (!/^\d{4}$/.test(pin)) return { ok: false, reason: 'Le code doit contenir 4 chiffres.' };
    await AsyncStorage.setItem(PIN_KEY, pin);
    await AsyncStorage.removeItem(ATTEMPTS_KEY);
    return { ok: true };
  }

  async hasParentPin(): Promise<boolean> {
    return (await AsyncStorage.getItem(PIN_KEY)) !== null;
  }

  async verifyParentPin(pin: string): Promise<AuthResult> {
    const locked = await this.lockedFor();
    if (locked > 0) {
      return { ok: false, reason: `Trop d’essais. Réessayez dans ${Math.ceil(locked / 60000)} min.` };
    }

    const stored = await AsyncStorage.getItem(PIN_KEY);
    if (stored !== null && stored === pin) {
      await AsyncStorage.removeItem(ATTEMPTS_KEY);
      return { ok: true };
    }

    // Told on the attempt that causes the lock, not on the next one: a parent
    // should learn they are locked out while they are still looking at it.
    const lockedNow = await this.recordFailure();
    return {
      ok: false,
      reason: lockedNow
        ? `Trop d’essais. Réessayez dans ${Math.ceil(LOCKOUT_MS / 60000)} min.`
        : 'Code incorrect.',
    };
  }

  private async lockedFor(): Promise<number> {
    const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return 0;
    const { count, at } = JSON.parse(raw) as { count: number; at: number };
    if (count < MAX_ATTEMPTS) return 0;
    return Math.max(0, at + LOCKOUT_MS - Date.now());
  }

  /** Returns true when this failure is the one that locks the PIN. */
  private async recordFailure(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(ATTEMPTS_KEY);
    const previous = raw ? (JSON.parse(raw) as { count: number; at: number }) : { count: 0, at: 0 };
    // A lockout that has expired starts the count again from zero.
    const expired = previous.at + LOCKOUT_MS < Date.now();
    const count = expired ? 1 : previous.count + 1;
    await AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count, at: Date.now() }));
    return count >= MAX_ATTEMPTS;
  }
}
