import { SupabaseAuthService } from '@/services/auth';

/**
 * Le lien de réinitialisation, là où il se casse en silence.
 *
 * Trois choses devaient être vraies pour qu'un parent puisse reprendre la main
 * sur son compte, et aucune ne l'était :
 *
 *   1. le lien devait revenir dans l'application — il partait sans `redirectTo`
 *      et menait à `http://localhost:3000` ;
 *   2. un écran devait exister au bout — il n'y en avait pas ;
 *   3. quelqu'un devait consommer le jeton — le client est créé avec
 *      `detectSessionInUrl: false`, donc personne.
 *
 * Ce test tient la troisième, qui est la plus facile à casser sans s'en
 * apercevoir : les jetons voyagent dans le FRAGMENT (`#access_token=…`), et un
 * parseur qui ne lirait que la requête (`?…`) rendrait exactement la même chose
 * qu'un lien expiré — c'est-à-dire rien, sans erreur.
 */

/** Un client Supabase réduit à ce que le service touche vraiment. */
function client() {
  const appels: { access_token: string; refresh_token: string }[] = [];
  return {
    appels,
    auth: {
      setSession: async (jetons: { access_token: string; refresh_token: string }) => {
        appels.push(jetons);
        return { error: null };
      },
    },
  };
}

describe('le lien de réinitialisation', () => {
  it('lit les jetons dans le fragment, là où Supabase les met', async () => {
    const faux = client();
    const service = new SupabaseAuthService(faux as never);

    const resultat = await service.resumeFromLink(
      'mino://mot-de-passe#access_token=abc123&refresh_token=def456&type=recovery',
    );

    expect(resultat.ok).toBe(true);
    expect(faux.appels).toEqual([{ access_token: 'abc123', refresh_token: 'def456' }]);
  });

  it('accepte aussi la forme en requête, au cas où elle changerait', async () => {
    const faux = client();
    const service = new SupabaseAuthService(faux as never);

    const resultat = await service.resumeFromLink(
      'mino://mot-de-passe?access_token=abc123&refresh_token=def456',
    );

    expect(resultat.ok).toBe(true);
    expect(faux.appels[0].access_token).toBe('abc123');
  });

  it('refuse un lien sans jeton, plutôt que d’ouvrir un écran sans pouvoir', async () => {
    const faux = client();
    const service = new SupabaseAuthService(faux as never);

    const resultat = await service.resumeFromLink('mino://mot-de-passe');

    expect(resultat.ok).toBe(false);
    expect(faux.appels).toHaveLength(0);
  });

  it('dit qu’un lien refusé a expiré, sans en dire plus', async () => {
    const service = new SupabaseAuthService({
      auth: { setSession: async () => ({ error: { message: 'invalid' } }) },
    } as never);

    const resultat = await service.resumeFromLink(
      'mino://mot-de-passe#access_token=vieux&refresh_token=vieux',
    );

    expect(resultat.ok).toBe(false);
    // Un lien de récupération est une clé : ce qu'on dit d'un échec doit être
    // aussi avare que ce qu'on dit d'une clé.
    expect(resultat.reason).toMatch(/n’est plus valable/);
  });
});
