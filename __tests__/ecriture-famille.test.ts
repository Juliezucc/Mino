import { buildEmptyFamily } from '@/data/demo';
import { SupabaseRepository } from '@/data/supabaseRepository';
import type { Child, FamilyData } from '@/domain/types';

/**
 * L'ordre dans lequel une famille s'écrit.
 *
 * `parents`, `children` et `missions` référencent `families` ; `completions`
 * référence `assignments`. Une ligne fille arrivée avant sa mère est refusée
 * par la base pour clé étrangère absente.
 *
 * L'ancienne version envoyait les dix tables dans un seul `Promise.all`.
 * L'ordre d'arrivée dépendait donc du réseau : ça passait sur une connexion
 * rapide, et la création de famille échouait ailleurs — sur « Impossible de
 * créer la famille », qui envoyait chercher une panne de réseau là où il n'y
 * en avait aucune.
 *
 * Le client factice ci-dessous retarde volontairement l'écriture de la famille
 * et note l'ordre des ARRIVÉES, pas celui des départs. C'est ce qui rend ce
 * test capable de voir la course : à départs simultanés, la famille arrive
 * dernière.
 */
function clientFactice(retardDeLaFamille = 5) {
  const arrivees: string[] = [];
  const client = {
    from(table: string) {
      return {
        async upsert() {
          if (table === 'families') {
            await new Promise((r) => setTimeout(r, retardDeLaFamille));
          }
          arrivees.push(table);
          return { error: null };
        },
      };
    },
  };
  return { arrivees, client: client as never };
}

describe('écrire une famille', () => {
  const famille = (): FamilyData => {
    const data = buildEmptyFamily({
      familyName: 'Zucherman',
      parentName: 'Lynda',
      email: 'lynda@exemple.fr',
    });
    return {
      ...data,
      children: [
        {
          id: 'enf-1',
          familyId: data.family.id,
          firstName: 'Jules',
          age: 7,
          avatarKey: 'fox',
          createdAt: new Date().toISOString(),
        } satisfies Child,
      ],
    };
  };

  it('écrit la famille avant tout ce qui s’y rattache', async () => {
    const { arrivees, client } = clientFactice();
    await new SupabaseRepository(client).persist(famille(), { kind: 'bootstrap' });

    const familleArrivee = arrivees.indexOf('families');
    expect(familleArrivee).toBeGreaterThanOrEqual(0);
    expect(familleArrivee).toBeLessThan(arrivees.indexOf('parents'));
    expect(familleArrivee).toBeLessThan(arrivees.indexOf('children'));
  });

  it('remonte l’erreur de la base plutôt que de l’avaler', async () => {
    const client = {
      from: () => ({ upsert: async () => ({ error: { message: 'clé étrangère absente' } }) }),
    } as never;

    await expect(
      new SupabaseRepository(client).persist(famille(), { kind: 'bootstrap' }),
    ).rejects.toMatchObject({ message: 'clé étrangère absente' });
  });
});
