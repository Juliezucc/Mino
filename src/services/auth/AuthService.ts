/**
 * Who is holding the phone.
 *
 * Mino has exactly one kind of account — the parent's — and two kinds of
 * device. A parent signs in with an e-mail and a password. A child's device
 * never signs in at all: it pairs with a family code and gets an anonymous
 * identity of its own, which the database treats as strictly less privileged
 * (see `auth_is_parent()` in schema.sql).
 *
 * The parent PIN is a third thing, and the one most easily got wrong. It is not
 * a password: it is a short lock on the parent area, meant to be typed in front
 * of a child. It therefore must never travel to a client that a child controls,
 * and it must never be compared in JavaScript on that client — four digits fall
 * to ten thousand guesses, so verification is rate-limited on the server.
 */

export type AuthKind = 'parent' | 'device' | 'none';

export interface Session {
  kind: AuthKind;
  userId: string | null;
  email: string | null;
}

export const NO_SESSION: Session = { kind: 'none', userId: null, email: null };

export interface AuthResult {
  ok: boolean;
  /** Ready to show to a parent: never a raw provider error. */
  reason?: string;
}

export interface AuthService {
  readonly name: string;
  /** False when there is no backend: the app then runs on this device alone. */
  readonly remote: boolean;

  session(): Promise<Session>;
  onChange(listener: (session: Session) => void): () => void;

  signUp(input: { email: string; password: string }): Promise<AuthResult>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  /**
   * L'identité d'un appareil qui vient de rejoindre une famille avec le code.
   *
   * Anonyme, et volontairement moins privilégiée qu'un parent : c'est elle que
   * `auth_is_parent()` refuse côté base. Elle sert aussi côté écran — voir
   * `app/parent-pin.tsx`, où ne pas savoir de quel genre d'appareil il
   * s'agissait laissait un enfant **choisir lui-même le code parent** sur sa
   * propre tablette.
   */
  signInAsDevice(): Promise<void>;
  /**
   * Ouvre la session portée par un lien reçu par e-mail.
   *
   * En React Native il n'y a pas de barre d'adresse : le client Supabase est
   * créé avec `detectSessionInUrl: false` et ne consomme donc RIEN tout seul.
   * Sans cette méthode, un lien de récupération ouvrait bien l'application et
   * n'ouvrait aucune session — l'écran demandait un nouveau mot de passe et
   * n'avait le droit de le poser sur personne.
   */
  resumeFromLink(url: string): Promise<AuthResult>;

  /**
   * Pose un nouveau mot de passe sur la session en cours.
   *
   * Appelé au bout du lien de récupération (`app/mot-de-passe.tsx`), là où la
   * session ouverte ne permet que cela.
   */
  setPassword(password: string): Promise<AuthResult>;

  /** Sends the reset e-mail. Always reports success, so it cannot enumerate accounts. */
  requestPasswordReset(email: string): Promise<AuthResult>;

  /**
   * Change l'adresse du compte — en deux temps, et jamais en un seul.
   *
   * L'adresse ne bouge qu'après confirmation sur la NOUVELLE boîte. C'est ce
   * qui empêche qu'un téléphone laissé déverrouillé cinq minutes serve à
   * emmener le compte ailleurs : celui qui tape l'adresse doit aussi pouvoir
   * y lire le courrier.
   */
  changeEmail(email: string): Promise<AuthResult>;

  /**
   * Supprime définitivement le compte, et la famille s'il en était le dernier
   * parent.
   *
   * Exigé par Apple (5.1.1(v)) et par le RGPD (article 17), et promis noir sur
   * blanc dans la FAQ. Rien ici ne revient : l'écran qui appelle cette méthode
   * doit demander confirmation en toutes lettres avant.
   *
   * Le travail se fait côté base, dans `delete_my_account()` — supprimer une
   * ligne de `auth.users` demande des droits que l'application n'a pas et ne
   * doit jamais avoir.
   */
  deleteAccount(): Promise<AuthResult>;

  /** Sets the parent PIN. The clear value is never stored anywhere. */
  setParentPin(pin: string): Promise<AuthResult>;
  /**
   * Whether a PIN exists at all.
   *
   * Without this the parent area can become permanently unreachable — an
   * account with no PIN would answer "wrong code" to every code there is.
   */
  hasParentPin(): Promise<boolean>;
  /**
   * Checks the PIN without the caller ever holding it or its hash.
   * Rate-limited, because four digits is ten thousand guesses.
   */
  verifyParentPin(pin: string): Promise<AuthResult>;
}
