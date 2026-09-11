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
  const verbes: string[] = [];
  const ecrire = (table: string, verbe: string) => async () => {
    verbes.push(verbe);
    if (table === 'families') await new Promise((r) => setTimeout(r, retardDeLaFamille));
    arrivees.push(table);
    return { error: null };
  };
  const client = {
    from: (table: string) => ({
      insert: ecrire(table, 'insert'),
      upsert: ecrire(table, 'upsert'),
    }),
  };
  return { arrivees, verbes, client: client as never };
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

  it('écrit la famille, puis le parent, puis le reste', async () => {
    const { arrivees, client } = clientFactice();
    await new SupabaseRepository(client).persist(famille(), { kind: 'bootstrap' });

    const rang = (t: string) => arrivees.indexOf(t);
    expect(rang('families')).toBeGreaterThanOrEqual(0);
    expect(rang('families')).toBeLessThan(rang('parents'));
    // La ligne parent est ce qui rattache le compte à la famille : rien de ce
    // qui exige d'y appartenir ne peut partir avant elle.
    expect(rang('parents')).toBeLessThan(rang('children'));
  });

  /**
   * LA COMPLÉTION AVANT LE GRAND LIVRE, et l'ordre est tout.
   *
   * **Le défaut, invisible tant que le réseau tient.** La ligne de registre
   * partait avant la complétion. Une coupure entre les deux — un ascenseur, un
   * tunnel, le passage du Wi-Fi à la 4G — créditait les minutes et laissait la
   * mission en attente. Le parent la revoyait dans sa liste et la confirmait à
   * nouveau : nouvelle ligne de registre, nouvel identifiant, et
   * `uniq_reward_per_completion` la refuse. Toute l'opération échouait, et la
   * mission devenait inconfirmable à jamais — avec des minutes déjà versées
   * que rien n'expliquait.
   *
   * Dans cet ordre-ci, la moitié perdue est le crédit, et elle se rattrape.
   */
  it('écrit la complétion AVANT la ligne de grand livre', async () => {
    const { arrivees, client } = clientFactice();
    const data = famille();

    await new SupabaseRepository(client).persist(data, {
      kind: 'completion.approved',
      upsert: {
        completions: [
          {
            id: 'cmp_1',
            familyId: 'f1',
            assignmentId: 'asg_1',
            childId: 'c1',
            status: 'approved',
            minutesRequested: 15,
            minutesAwarded: 15,
            completedAt: '2026-09-11T08:00:00.000Z',
          },
        ],
        transactions: [
          {
            id: 'tx_1',
            familyId: 'f1',
            childId: 'c1',
            delta: 15,
            kind: 'mission_reward',
            reason: 'Mission',
            refId: 'cmp_1',
            createdAt: '2026-09-11T08:00:00.000Z',
          },
        ],
      },
    } as never);

    const rang = (t: string) => arrivees.indexOf(t);
    expect(rang('mission_completions')).toBeGreaterThanOrEqual(0);
    expect(rang('screen_time_transactions')).toBeGreaterThanOrEqual(0);
    expect(rang('mission_completions')).toBeLessThan(rang('screen_time_transactions'));
  });

  it('crée par insertion, jamais par fusion', async () => {
    // `upsert` produit un `INSERT ... ON CONFLICT DO UPDATE`, et PostgreSQL
    // applique alors à la ligne neuve la clause de la politique de MISE À
    // JOUR — laquelle exige d'appartenir déjà à la famille. Une famille qu'on
    // vient d'inventer n'appartient à personne : la base répondait « new row
    // violates row-level security policy », et aucune famille n'a jamais pu
    // être créée sur Supabase. Voir `supabase/test/creation.sql`.
    const { verbes, client } = clientFactice(0);
    await new SupabaseRepository(client).persist(famille(), { kind: 'bootstrap' });

    expect(verbes).not.toContain('upsert');
    expect(new Set(verbes)).toEqual(new Set(['insert']));
  });

  it('mais corrige par fusion tout ce qui suit', async () => {
    // Une écriture ordinaire doit pouvoir rectifier une ligne existante sans
    // savoir si elle existe. Seule la PREMIÈRE devait changer de manière.
    const { verbes, client } = clientFactice(0);
    const data = famille();
    await new SupabaseRepository(client).persist(data, {
      kind: 'family.updated',
      upsert: { children: data.children },
    });

    expect(verbes).toEqual(['upsert']);
  });

  it('remonte l’erreur de la base plutôt que de l’avaler', async () => {
    const echoue = async () => ({ error: { message: 'clé étrangère absente' } });
    const client = { from: () => ({ insert: echoue, upsert: echoue }) } as never;

    await expect(
      new SupabaseRepository(client).persist(famille(), { kind: 'bootstrap' }),
    ).rejects.toMatchObject({ message: 'clé étrangère absente' });
  });
});
