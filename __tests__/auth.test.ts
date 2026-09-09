import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildDemoFamily, buildEmptyFamily } from '@/data/demo';
import { LocalAuthService, SupabaseAuthService, setAuthService } from '@/services/auth';
import { useMinoStore } from '@/store/useMinoStore';

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

/**
 * Le fondateur anonyme, et pourquoi il ne doit pas être pris pour une tablette.
 *
 * Le nouveau parcours d'inscription (`docs/ops/parcours-inscription.md`) fait
 * créer la famille et le premier enfant AVANT de demander son adresse au
 * parent : il commence donc sur une session anonyme, exactement comme la
 * tablette d'un enfant.
 *
 * La règle d'avant — « une adresse, donc un parent » — en aurait fait un
 * appareil d'enfant. Conséquence concrète : `app/parent-pin.tsx` lui aurait
 * refusé le choix de son propre code parent, parce que cet écran protège
 * justement un enfant de ce choix-là. Le parent aurait été enfermé dehors par
 * une protection écrite contre son enfant.
 *
 * C'est donc la base qui tranche, avec la fonction dont elle se sert elle-même
 * à chaque politique.
 */
describe('parent ou appareil, tranché par la base', () => {
  const avec = (estParent: unknown, rpcError: unknown = null, email: string | null = null) =>
    new SupabaseAuthService({
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'u-1', email } } } }),
        getUser: async () => ({ data: { user: { id: 'u-1', email } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      rpc: async () => ({ data: estParent, error: rpcError }),
    } as never);

  it('reconnaît le fondateur anonyme comme un parent', async () => {
    const s = await avec(true).session();
    expect(s.kind).toBe('parent');
    // Il n'a pas encore d'adresse, et ce n'est pas ce qui le définit.
    expect(s.email).toBeNull();
  });

  it('laisse la tablette d’un enfant être un appareil', async () => {
    const s = await avec(false).session();
    expect(s.kind).toBe('device');
  });

  it('retombe sur l’adresse quand le réseau ne répond pas', async () => {
    // Refuser une session parce que le réseau manque serait bien pire que de
    // la décrire approximativement : l'ancien raccourci reste vrai pour tous
    // les comptes déjà constitués.
    const s = await avec(null, { message: 'Failed to fetch' }, 'claire@exemple.fr').session();
    expect(s.kind).toBe('parent');
  });

  it('et une session anonyme reste un appareil quand le réseau manque', async () => {
    const s = await avec(null, { message: 'Failed to fetch' }).session();
    expect(s.kind).toBe('device');
  });
});

/**
 * Le défaut qui ferait disparaître une famille entière.
 *
 * Au troisième écran du nouveau parcours, le parent a déjà créé sa famille,
 * son premier enfant et sa première mission — sur une session anonyme. Il
 * donne alors son adresse.
 *
 * Appeler `signUp` à ce moment-là ouvre un SECOND utilisateur Supabase et
 * abandonne le premier. Tout ce que le parent vient de faire reste attaché à
 * une identité que plus personne ne porte : il se retrouve devant une
 * application vide, et rien à l'écran ne dit où c'est passé. C'est le pire des
 * défauts possibles à cet endroit, parce qu'il frappe exactement au moment où
 * l'on vient de gagner la confiance de quelqu'un.
 *
 * `createAccount` ne distinguait que « parent » et « le reste », parce qu'au
 * moment où il a été écrit « le reste » ne pouvait être qu'une absence de
 * session.
 */
describe('donner son adresse sans perdre sa famille', () => {
  const espion = (kind: 'parent' | 'device' | 'none') => {
    const appels: string[] = [];
    setAuthService({
      name: 'espion',
      remote: true,
      session: async () => ({ kind, userId: kind === 'none' ? null : 'u-1', email: null }),
      onChange: () => () => undefined,
      signUp: async () => {
        appels.push('signUp');
        return { ok: true };
      },
      linkEmail: async () => {
        appels.push('linkEmail');
        return { ok: true };
      },
      signIn: async () => ({ ok: true }),
      signOut: async () => undefined,
      signInAsDevice: async () => undefined,
      resumeFromLink: async () => ({ ok: true }),
      setParentPin: async () => ({ ok: true }),
      verifyParentPin: async () => ({ ok: true }),
      setPassword: async () => ({ ok: true }),
      sendPasswordLink: async () => ({ ok: true }),
      changeEmail: async () => ({ ok: true }),
      deleteAccount: async () => ({ ok: true }),
    } as never);
    return appels;
  };

  afterEach(() => setAuthService(null));

  it('habille la session anonyme, au lieu d’en ouvrir une seconde', async () => {
    const appels = espion('device');

    await useMinoStore.getState().createAccount({
      parentName: 'Julie',
      email: 'julie@exemple.fr',
      password: 'Un-Mot-De-Passe-2026',
      consentAt: new Date().toISOString(),
    });

    expect(appels).toContain('linkEmail');
    // Celui-là aurait coûté la famille.
    expect(appels).not.toContain('signUp');
  });

  it('inscrit normalement quand il n’y a aucune session', async () => {
    const appels = espion('none');

    await useMinoStore.getState().createAccount({
      parentName: 'Julie',
      email: 'julie@exemple.fr',
      password: 'Un-Mot-De-Passe-2026',
      consentAt: new Date().toISOString(),
    });

    expect(appels).toContain('signUp');
    expect(appels).not.toContain('linkEmail');
  });

  it('ne redemande rien à un parent déjà identifié', async () => {
    const appels = espion('parent');

    await useMinoStore.getState().createAccount({
      parentName: 'Julie',
      email: 'julie@exemple.fr',
      consentAt: new Date().toISOString(),
    });

    expect(appels).toEqual([]);
  });
});

/**
 * Fonder une famille avant de savoir qui est le parent.
 *
 * Le premier écran du parcours demande le prénom de l'enfant, et rien d'autre.
 * Pour l'écrire il faut pourtant une identité — chaque ligne que la base
 * accepte est cadrée par elle — d'où la session anonyme.
 *
 * Ce que ces cas gardent, c'est l'ordre : famille, enfant, mission, PUIS
 * compte. Le remettre à l'endroit d'avant ne casserait rien de visible, et
 * ferait simplement replonger la conversion là où elle était.
 */
describe('fonder une famille avant de se présenter', () => {
  const service = () => {
    const appels: string[] = [];
    setAuthService({
      name: 'anonyme',
      remote: true,
      session: async () => ({ kind: 'device', userId: 'u-anon', email: null }),
      onChange: () => () => undefined,
      signUp: async () => ({ ok: true }),
      linkEmail: async () => {
        appels.push('linkEmail');
        return { ok: true };
      },
      signIn: async () => ({ ok: true }),
      signOut: async () => undefined,
      signInAsDevice: async () => {
        appels.push('signInAsDevice');
      },
      resumeFromLink: async () => ({ ok: true }),
      setParentPin: async () => ({ ok: true }),
      verifyParentPin: async () => ({ ok: true }),
      setPassword: async () => ({ ok: true }),
      sendPasswordLink: async () => ({ ok: true }),
      changeEmail: async () => ({ ok: true }),
      deleteAccount: async () => ({ ok: true }),
    } as never);
    return appels;
  };

  // Le magasin est un singleton : sans ce nettoyage, une famille laissée par
  // le bloc précédent ferait sortir `fonderFamille` par sa porte
  // d'idempotence, et le test mesurerait le silence au lieu du travail.
  beforeEach(() => useMinoStore.setState({ data: null }));
  afterEach(() => setAuthService(null));

  it('ouvre une session anonyme et une famille sans nom ni adresse', async () => {
    const appels = service();
    const store = useMinoStore.getState();

    const out = await store.fonderFamille({ consentAt: '2026-09-09T12:00:00.000Z' });

    expect(out.ok).toBe(true);
    expect(appels).toContain('signInAsDevice');

    const parent = useMinoStore.getState().data!.parents[0];
    expect(parent.displayName).toBeNull();
    expect(parent.email).toBeNull();
    // Le consentement est daté ici, avant que le profil de l'enfant n'existe :
    // c'est ce que le dossier déposé chez Apple affirme.
    expect(parent.consentAt).toBe('2026-09-09T12:00:00.000Z');
  });

  it('ne refonde pas une famille déjà là', async () => {
    service();
    await useMinoStore.getState().fonderFamille({ consentAt: '2026-09-09T12:00:00.000Z' });
    const premiere = useMinoStore.getState().data!.family.id;

    // Rouvrir l'application au milieu de l'inscription ne doit pas effacer
    // l'enfant qu'on vient de créer.
    await useMinoStore.getState().fonderFamille({ consentAt: '2026-09-09T13:00:00.000Z' });

    expect(useMinoStore.getState().data!.family.id).toBe(premiere);
  });

  it('complète la famille au lieu de la reconstruire quand le compte arrive', async () => {
    const appels = service();
    await useMinoStore.getState().fonderFamille({ consentAt: '2026-09-09T12:00:00.000Z' });
    const fondee = useMinoStore.getState().data!.family.id;
    const enfant = await useMinoStore.getState().addChild({
      firstName: 'Lou',
      age: 7,
      avatarKey: 'fox',
    } as never);

    await useMinoStore.getState().createAccount({
      parentName: 'Julie',
      email: 'julie@exemple.fr',
      password: 'Un-Mot-De-Passe-2026',
      consentAt: new Date().toISOString(),
    });

    const data = useMinoStore.getState().data!;
    // La même famille, et l'enfant toujours là : c'est tout l'enjeu.
    expect(data.family.id).toBe(fondee);
    expect(data.children.map((c) => c.id)).toContain(enfant);
    expect(data.parents[0].displayName).toBe('Julie');
    expect(data.parents[0].email).toBe('julie@exemple.fr');
    expect(appels).toContain('linkEmail');
  });
});
