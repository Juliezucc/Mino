import { SupabaseAuthService } from '@/services/auth';

/**
 * Quitter Mino, et les deux façons de rater ça.
 *
 * La suppression de compte est le seul geste du produit qui ne se rattrape
 * pas. Elle peut échouer dans deux directions opposées, et l'une comme l'autre
 * passe inaperçue si personne ne la tient :
 *
 *   - trop peu — l'écran annonce la disparition, le serveur n'a rien effacé,
 *     et personne ne le vérifie jamais ;
 *   - trop tôt — on ferme la session AVANT d'appeler la base, il n'y a plus
 *     d'`auth.uid()`, la fonction refuse, et on retombe sur le premier cas.
 *
 * Le second est le plus insidieux parce qu'il ressemble à de la prudence.
 * C'est pour lui que le test sur l'ORDRE existe.
 *
 * Ce que la base fait ensuite — effacer la famille, épargner celle d'un autre
 * parent, refuser un appareil enfant — est tenu ailleurs, dans
 * `supabase/test/compte.sql`, là où il y a un vrai PostgreSQL pour en juger.
 */

/** Un client Supabase réduit à ce que `deleteAccount` touche, et qui note l'ordre. */
function client(options: { rpcEchoue?: boolean } = {}) {
  const journal: string[] = [];
  return {
    journal,
    rpc: async (nom: string) => {
      journal.push(`rpc:${nom}`);
      return options.rpcEchoue ? { data: null, error: { message: 'refus' } } : { data: 1, error: null };
    },
    auth: {
      signOut: async () => {
        journal.push('signOut');
        return { error: null };
      },
      updateUser: async (attrs: { email?: string; password?: string }) => {
        journal.push(`updateUser:${Object.keys(attrs).join(',')}`);
        return { data: {}, error: null };
      },
    },
  };
}

describe('supprimer son compte', () => {
  it('appelle la base AVANT de fermer la session', async () => {
    const faux = client();
    const service = new SupabaseAuthService(faux as never);

    const resultat = await service.deleteAccount();

    expect(resultat.ok).toBe(true);
    // L'ordre est la seule chose qui compte ici. En sens inverse, il n'y a
    // plus d'`auth.uid()` au moment de l'appel : `delete_my_account()` refuse,
    // et le compte reste entier derrière un écran qui vient d'annoncer le
    // contraire.
    expect(faux.journal).toEqual(['rpc:delete_my_account', 'signOut']);
  });

  it('ne ferme pas la session quand la base a refusé', async () => {
    const faux = client({ rpcEchoue: true });
    const service = new SupabaseAuthService(faux as never);

    const resultat = await service.deleteAccount();

    expect(resultat.ok).toBe(false);
    // Déconnecter après un échec laisserait le parent dehors, avec un compte
    // intact et aucun moyen de comprendre lequel des deux s'est produit.
    expect(faux.journal).toEqual(['rpc:delete_my_account']);
  });

  it('dit que rien n’a été effacé, plutôt que rien du tout', async () => {
    const service = new SupabaseAuthService(client({ rpcEchoue: true }) as never);
    const resultat = await service.deleteAccount();

    expect(resultat.reason).toMatch(/Rien n’a été effacé/);
  });
});

describe('changer d’adresse', () => {
  it('passe par updateUser, qui exige une confirmation sur la nouvelle boîte', async () => {
    const faux = client();
    const service = new SupabaseAuthService(faux as never);

    await service.changeEmail('  NOUVELLE@Exemple.FR  ');

    // Le point n'est pas la casse : c'est que l'adresse ne devient la sienne
    // qu'après confirmation. Un téléphone laissé déverrouillé cinq minutes ne
    // suffit donc pas à emmener le compte ailleurs.
    expect(faux.journal).toEqual(['updateUser:email']);
  });
});
