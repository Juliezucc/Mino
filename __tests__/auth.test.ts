import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { LocalAuthService, SupabaseAuthService } from '@/services/auth';

/**
 * The parent PIN is the shortest secret in the product and the one a child is
 * closest to. These are the properties that keep it worth having.
 */
describe('parent PIN', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('never appears in the family document', () => {
    const data = buildDemoFamily();
    // The document is readable by every device in the family, the child's
    // tablet included. Nothing that unlocks the parent area belongs in it.
    expect(JSON.stringify(data)).not.toContain('1234');
    expect(Object.keys(data.parents[0])).not.toContain('pin');
  });

  it('accepts the right code and refuses the wrong one', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');

    expect((await auth.verifyParentPin('4821')).ok).toBe(true);
    expect((await auth.verifyParentPin('4822')).ok).toBe(false);
  });

  it('refuses anything that is not four digits', async () => {
    const auth = new LocalAuthService();
    expect((await auth.setParentPin('123')).ok).toBe(false);
    expect((await auth.setParentPin('12a4')).ok).toBe(false);
    expect((await auth.setParentPin('')).ok).toBe(false);
  });

  it('locks out after five wrong tries', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');

    for (let i = 0; i < 4; i += 1) {
      expect((await auth.verifyParentPin('0000')).reason).toBe('Code incorrect.');
    }

    // The fifth failure says so straight away, rather than letting a parent
    // discover the lock on the try after.
    const fifth = await auth.verifyParentPin('0000');
    expect(fifth.reason).toMatch(/Trop d’essais/);

    // Ten thousand combinations fall in seconds to a script; the lock is what
    // makes a four-digit code worth anything at all.
    const locked = await auth.verifyParentPin('4821');
    expect(locked.ok).toBe(false);
    expect(locked.reason).toMatch(/Trop d’essais/);
  });

  it('forgets the failures as soon as the right code is typed', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');

    for (let i = 0; i < 4; i += 1) await auth.verifyParentPin('0000');
    expect((await auth.verifyParentPin('4821')).ok).toBe(true);

    // A parent who fumbled four times and then got it right is not one try
    // away from being locked out.
    for (let i = 0; i < 4; i += 1) await auth.verifyParentPin('0000');
    expect((await auth.verifyParentPin('4821')).ok).toBe(true);
  });

  it('starts from no PIN at all, so an unset one unlocks nothing', async () => {
    const auth = new LocalAuthService();
    expect((await auth.verifyParentPin('1234')).ok).toBe(false);
    expect((await auth.verifyParentPin('')).ok).toBe(false);
  });

  it('resets the lock when a new PIN is set', async () => {
    const auth = new LocalAuthService();
    await auth.setParentPin('4821');
    for (let i = 0; i < 5; i += 1) await auth.verifyParentPin('0000');

    await auth.setParentPin('9137');
    expect((await auth.verifyParentPin('9137')).ok).toBe(true);
  });
});

describe('autorité parentale', () => {
  it('horodate la déclaration du parent, et la garde sur sa ligne', () => {
    const quand = '2026-08-22T09:30:00.000Z';
    const data = buildEmptyFamily({
      familyName: 'Durand',
      parentName: 'Claire',
      email: 'claire@exemple.fr',
      consentAt: quand,
    });
    // L'instant, pas le simple fait : c'est la date qui vaut preuve le jour où
    // on la demande.
    expect(data.parents[0].consentAt).toBe(quand);
  });

  it('laisse la date absente sur les comptes créés avant que l’écran ne demande', () => {
    const data = buildEmptyFamily({
      familyName: 'Durand',
      parentName: 'Claire',
      email: 'claire@exemple.fr',
    });
    expect(data.parents[0].consentAt).toBeUndefined();
  });
});

/**
 * Répondre la même phrase à toutes les causes protège la liste des clients —
 * et, poussé trop loin, enferme le parent : il corrige indéfiniment le champ
 * qu'on lui désigne, qui n'est pas celui qui a échoué.
 */
describe('les causes d’échec qu’on a le droit de nommer', () => {
  const service = (error: { message: string; code?: string } | null) =>
    new SupabaseAuthService({
      auth: {
        signUp: async () => ({ data: { session: null }, error }),
        updateUser: async () => ({ data: { user: null }, error }),
      },
    } as never);

  /**
   * Le service construit ici avec une session locale et une réponse serveur
   * choisie : c'est tout ce dont on a besoin pour éprouver `session()`.
   */
  const avecJeton = (reponse: { data: unknown; error: unknown }) =>
    new SupabaseAuthService({
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: 'u-1', email: 'claire@exemple.fr' } } },
        }),
        getUser: async () => reponse,
        signOut: async () => ({ error: null }),
      },
    } as never);

  it('ferme la session quand le compte a disparu du serveur', async () => {
    // Un jeton reste lisible et bien formé longtemps après que le compte qu'il
    // désigne a été supprimé. L'application le prenait pour argent comptant,
    // puis toutes ses écritures partaient avec l'identité d'un utilisateur
    // inexistant — et la base les refusait pour clé étrangère absente, très
    // loin de l'endroit où le mal avait commencé.
    const s = await avecJeton({ data: { user: null }, error: { code: 'user_not_found', status: 403 } }).session();
    expect(s.kind).toBe('none');
    expect(s.userId).toBeNull();
  });

  it('mais garde le parent connecté quand c’est le réseau qui manque', async () => {
    // La distinction est tout le sujet : déconnecter quelqu'un parce que son
    // train est passé sous un tunnel serait pire que le défaut réparé.
    const s = await avecJeton({
      data: { user: null },
      error: { message: 'Failed to fetch' },
    }).session();
    expect(s.kind).toBe('parent');
    expect(s.email).toBe('claire@exemple.fr');
  });

  it('distingue « le compte attend sa confirmation » d’un échec', async () => {
    // Supabase ne rend aucune erreur quand « Confirm email » est actif : il
    // crée le compte et n'ouvre pas de session. Sans `pending`, l'écran posait
    // cette bonne nouvelle en rouge sous l'e-mail, au-dessus d'un formulaire
    // intact — donc au-dessus d'une invitation à recommencer, seule issue qui
    // ne pouvait plus marcher puisque l'adresse venait d'être prise.
    const r = await service(null).signUp({
      email: 'claire@exemple.fr',
      password: 'Un-Mot-De-Passe-2026',
    });

    expect(r.ok).toBe(false);
    expect(r.pending).toBe(true);
    expect(r.field).toBeUndefined();
  });

  beforeEach(() => {
    // `trace()` écrit la cause réelle en développement, et jest est un
    // environnement de développement : sans cela chaque cas ci-dessous
    // salirait la sortie.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('désigne le mot de passe, et non l’adresse, quand c’est lui qui a fui', async () => {
    const r = await service({ message: 'Password is known to be weak', code: 'weak_password' })
      .signUp({ email: 'claire@exemple.fr', password: 'motdepasse' });

    expect(r.ok).toBe(false);
    // Sans ce champ, l'écran d'inscription posait l'erreur sous l'e-mail.
    expect(r.field).toBe('password');
    expect(r.reason).toMatch(/fuite/);
  });

  it('dit qu’un lien de récupération est encore valable quand c’est le mot de passe qui est refusé', async () => {
    const r = await service({ message: 'Password is known to be weak', code: 'weak_password' })
      .setPassword('motdepasse');

    // L'ancienne version répondait « ce lien n'est plus valable » : le parent
    // en redemandait un, reposait le même mot de passe, relisait la même
    // phrase, et pouvait recommencer sans fin.
    expect(r.reason).not.toMatch(/lien/);
    expect(r.field).toBe('password');
  });

  it('ne dit toujours rien de l’adresse quand elle est déjà prise', async () => {
    const r = await service({ message: 'User already registered', code: 'user_already_exists' })
      .signUp({ email: 'claire@exemple.fr', password: 'Un-Mot-De-Passe-2026' });

    // « Cette adresse a déjà un compte » est la liste des clients offerte à
    // qui essaie des adresses. Elle doit rester indiscernable d'une adresse
    // libre — c'est la règle, et elle ne bouge pas.
    expect(r.reason).toBe('Impossible de créer le compte. Vérifiez l’adresse et réessayez.');
    expect(r.field).toBeUndefined();
  });

  it('renvoie un lien expiré vers la connexion, comme avant', async () => {
    const r = await service({ message: 'Auth session missing', code: 'session_not_found' })
      .setPassword('Un-Mot-De-Passe-2026');

    expect(r.reason).toMatch(/lien/);
  });
});
