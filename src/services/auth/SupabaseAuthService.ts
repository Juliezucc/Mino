import { SupabaseClient } from '@supabase/supabase-js';

import * as Linking from 'expo-linking';

import { AuthResult, AuthService, NO_SESSION, Session } from './AuthService';

/**
 * L'adresse à laquelle un lien reçu par e-mail doit ramener.
 *
 * `mino://…` sur un téléphone, `http://localhost:8081/…` dans un navigateur —
 * et c'est `expo-linking` qui sait laquelle, pas nous. Écrire `mino://` en dur
 * marchait sur l'appareil et nulle part ailleurs : sur le web, le lien ne
 * menait à rien du tout, ce qui est exactement là où l'on mesure ces
 * choses-là.
 *
 * Chaque adresse produite ici doit être ajoutée aux « Redirect URLs » du
 * projet Supabase, sinon il refuse de rediriger.
 */
function adresseDeRetour(chemin: string): string {
  return Linking.createURL(`/${chemin}`);
}

/**
 * Les seules causes d'échec qu'on a le droit de nommer.
 *
 * La règle de la maison est de répondre la même phrase quoi qu'il arrive, pour
 * qu'on ne puisse pas apprendre, en essayant des adresses, lesquelles ont un
 * compte. Ces trois-là échappent à la règle sans l'affaiblir : aucune ne
 * dépend de l'adresse essayée. Un mot de passe ayant fuité a fui pour tout le
 * monde ; des inscriptions fermées le sont pour tout le monde ; un quota
 * d'envoi épuisé l'est pour tout le monde.
 *
 * Tout le reste — adresse libre, adresse déjà prise, adresse malformée —
 * continue de recevoir la réponse indifférenciée, et doit continuer.
 */
const MESSAGE_PAR_CODE: Record<string, { reason: string; field?: 'email' | 'password' }> = {
  weak_password: {
    field: 'password',
    reason:
      'Ce mot de passe est apparu dans une fuite connue. Choisissez-en un autre, qui ne serve nulle part ailleurs.',
  },
  signup_disabled: {
    reason: 'Les inscriptions sont fermées pour le moment. Réessayez un peu plus tard.',
  },
  over_email_send_rate_limit: {
    reason: 'Trop de messages envoyés en peu de temps. Attendez quelques minutes et réessayez.',
  },
};

/**
 * L'erreur brute ne doit jamais atteindre un parent — mais la faire
 * disparaître tout à fait rend la moindre panne indiagnosticable.
 *
 * Une clé d'API erronée, un projet en pause, des inscriptions fermées et une
 * adresse déjà prise produisent tous la même phrase à l'écran, par
 * construction. En développement, la vraie cause passe donc dans la console :
 * c'est la différence entre lire « Invalid API key » et chercher une heure du
 * côté de l'adresse, qui n'y était pour rien.
 */
function trace(ou: string, error: { message: string; code?: string } | null): void {
  if (__DEV__ && error) {
    console.warn(`[auth] ${ou} — ${error.code ?? 'sans code'} : ${error.message}`);
  }
}

/**
 * Les réponses qui signifient « ce compte n'existe plus », par opposition à
 * « je n'ai pas pu joindre le serveur ».
 *
 * La distinction est tout le sujet : la première doit fermer la session, la
 * seconde ne doit surtout pas — un parent hors réseau reste un parent.
 */
function DISPARU(error: { code?: string; status?: number }): boolean {
  const codes = ['user_not_found', 'session_not_found', 'bad_jwt', 'refresh_token_not_found'];
  return codes.includes(error.code ?? '') || error.status === 401 || error.status === 403;
}

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

  /**
   * Demander au serveur qui est là, et pas seulement au disque.
   *
   * `getSession()` ne fait que relire le jeton rangé sur l'appareil. Il ne
   * prouve rien : un jeton reste lisible et bien formé longtemps après que le
   * compte qu'il désigne a disparu — supprimé depuis un autre appareil,
   * révoqué, ou effacé de la base. L'application affirmait donc « ce parent
   * est connecté » sur la seule foi d'un fichier local.
   *
   * Le dégât ne se voit qu'ensuite, et jamais là où il est. Chaque écriture
   * part avec l'identité d'un utilisateur inexistant, et la base la refuse
   * pour clé étrangère absente. « Impossible d'enregistrer le code » : le
   * parent lit une panne de code parent là où il n'a plus de compte du tout.
   *
   * `getUser()` interroge le serveur. On ne ferme la session que sur les
   * réponses qui disent que le compte n'est plus là — jamais sur une panne de
   * réseau, sans quoi on déconnecterait un parent dans le métro.
   */
  async session(): Promise<Session> {
    const { data: local } = await this.client.auth.getSession();
    const range = local.session?.user;
    if (!range) return NO_SESSION;

    /**
     * Parent ou appareil — et c'est la base qui le dit, pas l'adresse.
     *
     * **Le raccourci que cela remplace.** La règle était « une adresse, donc un
     * parent ; pas d'adresse, donc la tablette d'un enfant ». Elle a tenu tant
     * qu'un parent avait forcément une adresse dès la première seconde. Le
     * parcours d'inscription y met fin : le parent fonde sa famille sur une
     * session anonyme et ne donne son adresse qu'au troisième écran. Entre les
     * deux, il aurait été pris pour la tablette de son enfant — et
     * `app/parent-pin.tsx` lui aurait refusé le choix de son propre code
     * parent, précisément parce qu'il protège un enfant de ce choix-là.
     *
     * `auth_is_parent()` est la fonction dont la base se sert pour trancher la
     * même question, à chaque politique. Poser la question à celui qui décide,
     * plutôt que la deviner ici, c'est aussi la seule façon que les deux
     * réponses ne divergent jamais.
     *
     * Hors ligne, on retombe sur l'ancien raccourci : il reste vrai pour tous
     * les comptes déjà constitués, et refuser une session parce que le réseau
     * manque serait bien pire que de la décrire approximativement.
     */
    const decrire = (user: { id: string; email?: string | null }, parent?: boolean): Session => ({
      kind: (parent ?? !!user.email) ? 'parent' : 'device',
      userId: user.id,
      email: user.email ?? null,
    });

    const { data, error } = await this.client.auth.getUser();
    if (!error && data.user) {
      const { data: estParent, error: rpc } = await this.client.rpc('auth_is_parent');
      if (rpc) trace('session/auth_is_parent', rpc);
      return decrire(data.user, rpc ? undefined : estParent === true);
    }

    if (error && DISPARU(error)) {
      trace('session', error);
      // Le jeton ne vaut plus rien : le garder ne ferait que rejouer la même
      // panne à chaque écran.
      await this.client.auth.signOut().catch(() => undefined);
      return NO_SESSION;
    }

    // Réseau injoignable : on s'en tient à ce que l'appareil sait.
    return decrire(range);
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

  /**
   * Créer le compte — et refuser de dire que c'est fait quand ça ne l'est pas.
   *
   * Supabase active « Confirm email » par défaut. Dans ce cas `signUp` ne rend
   * AUCUNE erreur, mais aussi aucune session : l'utilisateur existe et n'est
   * pas connecté. Le code d'avant lisait la seule erreur, répondait « c'est
   * bon », et la suite se déroulait sans session — le code parent ne pouvait
   * pas s'écrire, la famille ne pouvait pas se sauvegarder, et le parent se
   * retrouvait devant une famille vide qui n'existait nulle part.
   *
   * On lit donc la session, pas l'erreur. Voir `docs/ops/mise-en-route.md` :
   * tant qu'aucun SMTP n'est branché, la confirmation doit rester désactivée —
   * l'expéditeur intégré de Supabase est bridé à quelques envois par heure et
   * n'est pas fait pour la production.
   */
  async signUp({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      /**
       * Où le lien de confirmation ramène.
       *
       * Sans cette ligne, il retombait sur l'« URL du site » du projet
       * Supabase, c'est-à-dire l'accueil de Mino : quatre boutons dont aucun ne
       * correspondait à ce que le parent venait de faire. `mino://confirme`
       * ouvre la session portée par le lien et l'emmène droit à sa famille.
       *
       * L'adresse doit figurer dans les « Redirect URLs » du projet, comme
       * celles du mot de passe — Supabase refuse toute autre destination, et
       * c'est précisément ce qui empêche de détourner le lien.
       */
      options: { emailRedirectTo: adresseDeRetour('confirme') },
    });
    trace('signUp', error);
    if (error) {
      // Trois causes n'apprennent RIEN sur l'adresse, et se taire à leur sujet
      // ne protège donc personne — cela se contente d'envoyer le parent
      // corriger un champ intact. Le mot de passe refusé était le pire des
      // trois : il n'existe aucune façon de deviner, en regardant l'écran, que
      // c'est la protection contre les fuites qui vient de parler.
      const dit = MESSAGE_PAR_CODE[error.code ?? ''];
      if (dit) return { ok: false, ...dit };
      // Deliberately the same message whether the address is free or taken.
      return { ok: false, reason: 'Impossible de créer le compte. Vérifiez l’adresse et réessayez.' };
    }
    if (!data.session) {
      return {
        ok: false,
        pending: true,
        reason:
          'Votre compte est créé. Ouvrez le lien de confirmation envoyé à votre adresse, puis connectez-vous.',
      };
    }
    return { ok: true };
  }

  /**
   * Habiller une session anonyme d'une adresse et d'un mot de passe.
   *
   * `updateUser` et non `signUp` : c'est le même utilisateur qui continue, donc
   * la famille, l'enfant et la mission créés aux écrans précédents restent
   * attachés à lui. `signUp` en aurait ouvert un second et abandonné le
   * premier — le parent aurait retrouvé une application vide.
   *
   * **Ce qu'il faut savoir sur l'adresse, et dire au parent.** Tant que la
   * confirmation par e-mail est active, Supabase n'attache pas l'adresse
   * immédiatement : il l'envoie en attente et la valide au clic sur le lien.
   * Le mot de passe, lui, prend tout de suite. Concrètement, la famille marche
   * sans rien attendre sur CET appareil, mais se connecter ailleurs suppose
   * d'avoir cliqué. L'écran doit donc le dire, au lieu de laisser croire que
   * tout est rangé.
   */
  async linkEmail({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const { error } = await this.client.auth.updateUser(
      { email: email.trim().toLowerCase(), password },
      { emailRedirectTo: adresseDeRetour('confirme') },
    );
    trace('linkEmail', error);
    if (error) {
      const dit = MESSAGE_PAR_CODE[error.code ?? ''];
      if (dit) return { ok: false, ...dit };
      // Même règle que `signUp` : une adresse déjà prise reçoit la même
      // phrase que n'importe quelle autre, sans quoi on distribue la liste de
      // ses clients à qui veut l'essayer.
      return { ok: false, reason: 'Impossible d’enregistrer cette adresse. Vérifiez-la et réessayez.' };
    }
    return { ok: true };
  }

  async signIn({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    trace('signIn', error);
    /**
     * « E-mail ou mot de passe incorrect » était faux, et coûteux.
     *
     * Le parent venait de taper les deux correctement : il ne lui manquait que
     * le clic dans sa boîte mail. On l'envoyait donc vérifier deux champs
     * justes, puis demander un nouveau mot de passe, puis recréer un compte —
     * tout sauf la seule chose à faire.
     *
     * C'est bien la seule cause qu'on nomme ici, et elle apprend en effet
     * qu'un compte existe à cette adresse. On l'accepte : le compte n'est pas
     * ouvert pour autant — il faut toujours le mot de passe — et une porte
     * dont on ignore pourquoi elle résiste n'est pas une porte, c'est un mur.
     */
    if (error?.code === 'email_not_confirmed') {
      return {
        ok: false,
        reason:
          'Votre adresse n’est pas encore confirmée. Ouvrez le lien que nous vous avons envoyé, puis revenez.',
      };
    }
    if (error) return { ok: false, reason: 'E-mail ou mot de passe incorrect.' };
    return { ok: true };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  /**
   * Les jetons arrivent dans le FRAGMENT de l'URL (`#access_token=…`), pas dans
   * la requête : c'est la forme qu'utilise Supabase, et c'est aussi la raison
   * pour laquelle expo-router ne les rend pas dans ses paramètres — un
   * fragment ne quitte jamais le client, ce qui est précisément ce qu'on veut
   * d'un jeton.
   */
  async resumeFromLink(url: string): Promise<AuthResult> {
    const brut = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url.split('?')[1] ?? '';
    const params = new URLSearchParams(brut);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
      return { ok: false, reason: 'Ce lien est incomplet. Demandez-en un nouveau.' };
    }

    const { error } = await this.client.auth.setSession({ access_token, refresh_token });
    if (error) {
      return {
        ok: false,
        reason: 'Ce lien n’est plus valable. Demandez-en un nouveau depuis la connexion.',
      };
    }
    return { ok: true };
  }

  async setPassword(password: string): Promise<AuthResult> {
    const { error } = await this.client.auth.updateUser({ password });
    trace('setPassword', error);
    if (error) {
      // Deux causes viennent bien du mot de passe, et les confondre avec un
      // lien expiré est une impasse : le parent redemande un lien, en reçoit
      // un valable, repose le même mot de passe, et lit la même phrase. Il
      // peut recommencer indéfiniment sans jamais rien apprendre.
      if (error.code === 'weak_password') {
        return { ok: false, field: 'password', reason: MESSAGE_PAR_CODE.weak_password.reason };
      }
      if (error.code === 'same_password') {
        return { ok: false, field: 'password', reason: 'C’est déjà votre mot de passe actuel.' };
      }
      // La cause la plus fréquente n'est pas le mot de passe : c'est un lien
      // ouvert trop tard, donc une session de récupération expirée.
      return {
        ok: false,
        reason: 'Ce lien n’est plus valable. Demandez-en un nouveau depuis la connexion.',
      };
    }
    return { ok: true };
  }

  /**
   * Le lien doit revenir DANS l'application, pas dans un navigateur.
   *
   * Sans `redirectTo`, Supabase envoie vers l'« URL du site » du projet — dont
   * la valeur par défaut est `http://localhost:3000`. Le parent recevait donc
   * un lien qui ne menait nulle part, et n'avait aucun moyen de choisir un
   * nouveau mot de passe. C'était une impasse complète, et silencieuse.
   *
   * `mino://mot-de-passe` est le schéma déclaré dans `app.json`. L'URL doit
   * aussi être ajoutée aux « Redirect URLs » du projet Supabase, sinon il
   * refuse de rediriger — c'est écrit dans le guide de mise en route.
   */
  async requestPasswordReset(email: string): Promise<AuthResult> {
    await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: adresseDeRetour('mot-de-passe'),
    });
    // Always the same answer: anything else says whether the account exists.
    return { ok: true };
  }

  /**
   * `emailRedirectTo` pointe vers l'écran de connexion et non vers un écran
   * dédié : le lien de confirmation d'une nouvelle adresse ne porte pas de
   * jeton de session à consommer, il ne fait que valider le changement côté
   * serveur. Ouvrir l'application suffit. Comme pour le mot de passe, l'URL
   * doit figurer dans les « Redirect URLs » du projet.
   */
  async changeEmail(email: string): Promise<AuthResult> {
    const { error } = await this.client.auth.updateUser(
      { email: email.trim().toLowerCase() },
      { emailRedirectTo: adresseDeRetour('login') },
    );
    if (error) {
      return { ok: false, reason: 'Impossible de changer l’adresse. Vérifiez-la et réessayez.' };
    }
    return { ok: true };
  }

  /**
   * On supprime, PUIS on ferme la session — et l'ordre n'est pas indifférent.
   *
   * En sens inverse, il n'y aurait plus de `auth.uid()` au moment de l'appel :
   * la fonction refuserait, et le compte resterait entier derrière un écran
   * qui vient d'annoncer sa disparition. C'est la pire des issues possibles,
   * parce que personne ne la vérifie jamais.
   *
   * Le `signOut` qui suit ne peut plus échouer utilement — le jeton ne
   * désigne plus personne — donc son résultat n'est pas lu : c'est le vidage
   * local qui compte, et il a lieu.
   */
  async deleteAccount(): Promise<AuthResult> {
    const { error } = await this.client.rpc('delete_my_account');
    if (error) {
      return { ok: false, reason: 'La suppression n’a pas abouti. Rien n’a été effacé.' };
    }
    await this.client.auth.signOut().catch(() => undefined);
    return { ok: true };
  }

  /**
   * `set_parent_pin` répond de DEUX façons, et on n'en lisait qu'une.
   *
   * Une erreur, quand l'appel casse. Mais aussi un `false` tranquille, sans la
   * moindre erreur, quand la fonction refuse : pas de session ouverte, ou un
   * code qui n'est pas quatre chiffres. Ce `false` était jeté — on répondait
   * donc « c'est enregistré » à un parent dont le code n'existait nulle part,
   * et l'espace parent devenait inouvrable sans que rien ne l'ait annoncé.
   */
  async setParentPin(pin: string): Promise<AuthResult> {
    if (!/^\d{4}$/.test(pin)) return { ok: false, reason: 'Le code doit contenir 4 chiffres.' };
    const { data, error } = await this.client.rpc('set_parent_pin', { p_pin: pin });
    trace('setParentPin', error);
    if (error) {
      return { ok: false, reason: `Impossible d’enregistrer le code : ${error.message}` };
    }
    if (data === false) {
      return {
        ok: false,
        reason: 'Le serveur a refusé le code parent. Reconnectez-vous et réessayez.',
      };
    }
    return { ok: true };
  }

  async hasParentPin(): Promise<boolean> {
    const { data } = await this.client.rpc('has_parent_pin');
    return data === true;
  }

  async verifyParentPin(pin: string): Promise<AuthResult> {
    const { data, error } = await this.client.rpc('verify_parent_pin', { p_pin: pin });
    trace('verifyParentPin', error);
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
