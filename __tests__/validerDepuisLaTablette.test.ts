import { buildDemoFamily } from '@/data/demo';
import { DomainError } from '@/domain/actions';
import { SupabaseRepository } from '@/data/supabaseRepository';
import type { FamilyData, MissionCompletion } from '@/domain/types';

/**
 * Confirmer une mission depuis la tablette de l'enfant.
 *
 * **Le défaut, établi en lisant les politiques.** Depuis que le code parent
 * appartient à la famille, il OUVRE l'espace parent sur la tablette de
 * l'enfant — `auth_family_ids()` unionne `family_devices`. Mais il n'y écrit
 * rien : `mission_completions_update` et `screen_time_transactions_insert`
 * exigent `auth_is_parent()`, qui ne lit que la table `parents`. Le parent
 * debout à côté de son enfant appuyait sur « Valider », l'écriture était
 * refusée, et l'application affichait « Impossible de joindre Mino » — un
 * message de réseau pour un mur permanent.
 *
 * D'où la fonction `valider-mission`, et la règle que ces essais gravent : le
 * code voyage avec le geste **uniquement** depuis une tablette, et le
 * téléphone du parent ne change pas de chemin.
 */
function clientFactice() {
  const appels: { fonction: string; corps: unknown }[] = [];
  const tables: string[] = [];
  const client = {
    from: (table: string) => ({
      insert: async () => {
        tables.push(table);
        return { error: null };
      },
      upsert: async () => {
        tables.push(table);
        return { error: null };
      },
    }),
    functions: {
      invoke: async (fonction: string, options: { body: unknown }) => {
        appels.push({ fonction, corps: options.body });
        return { data: { etat: 'approved' }, error: null };
      },
    },
  };
  return { appels, tables, client: client as never };
}

function familleAvecDemande(): { data: FamilyData; completion: MissionCompletion } {
  const data = buildDemoFamily(new Date('2026-09-11T08:00:00.000Z'));
  const completion = data.completions.find((c) => c.status === 'pending');
  if (!completion) throw new Error('la famille de démonstration doit porter une demande');
  return { data, completion };
}

describe('valider depuis la tablette de l’enfant', () => {
  it('passe par la fonction serveur quand le code accompagne le geste', async () => {
    const { appels, tables, client } = clientFactice();
    const { data, completion } = familleAvecDemande();

    await new SupabaseRepository(client).persist(data, {
      kind: 'completion.approved',
      upsert: { completions: [{ ...completion, status: 'approved' }] },
      codeParent: '4821',
    });

    expect(appels).toHaveLength(1);
    expect(appels[0].fonction).toBe('valider-mission');
    expect(appels[0].corps).toEqual({
      completionId: completion.id,
      decision: 'valider',
      code: '4821',
    });
    // Aucune écriture directe : c'est précisément celle que la base refuse.
    expect(tables).toEqual([]);
  });

  it('n’envoie ni le montant ni la famille — le serveur les relit lui-même', () => {
    // La clause décisive de toute la fonction : la clé de service contourne la
    // RLS, donc un montant qui viendrait du client serait un crédit arbitraire
    // offert à la tablette d'un enfant. Le corps ne porte que trois champs.
    const { appels, client } = clientFactice();
    const { data, completion } = familleAvecDemande();

    return new SupabaseRepository(client)
      .persist(data, {
        kind: 'completion.approved',
        upsert: { completions: [{ ...completion, status: 'approved', minutesAwarded: 999 }] },
        codeParent: '4821',
      })
      .then(() => {
        expect(Object.keys(appels[0].corps as object).sort()).toEqual([
          'code',
          'completionId',
          'decision',
        ]);
      });
  });

  it('distingue « à refaire » de « valider »', async () => {
    const { appels, client } = clientFactice();
    const { data, completion } = familleAvecDemande();

    await new SupabaseRepository(client).persist(data, {
      kind: 'completion.rejected',
      upsert: { completions: [{ ...completion, status: 'rejected' }] },
      codeParent: '4821',
    });

    expect((appels[0].corps as { decision: string }).decision).toBe('refaire');
  });

  it('ne change RIEN sur le téléphone d’un parent', async () => {
    // Sans code, l'écriture ordinaire reprend son cours : ce chemin passe déjà
    // les politiques, et le détourner ferait dépendre la validation d'une
    // fonction déployée séparément.
    const { appels, tables, client } = clientFactice();
    const { data, completion } = familleAvecDemande();

    await new SupabaseRepository(client).persist(data, {
      kind: 'completion.approved',
      upsert: { completions: [{ ...completion, status: 'approved' }] },
    });

    expect(appels).toEqual([]);
    expect(tables).toContain('mission_completions');
  });
});

/**
 * Le refus du serveur doit ARRIVER jusqu'au parent.
 *
 * Trouvé sur le téléphone du second parent : la fonction répondait, en
 * français, et l'écran affichait « Impossible de joindre Mino. Rien n'a été
 * enregistré » — une panne de réseau pour un refus nommé. La cause tenait à la
 * classe de l'erreur : `commit()` n'honore que les `DomainError`, et tout le
 * reste retombe dans le message générique. C'est le défaut corrigé un étage
 * plus bas, refabriqué un étage plus haut.
 */
describe('le refus de la fonction remonte tel quel', () => {
  it('relance une DomainError, seule classe que le magasin affiche', async () => {
    const client = {
      from: () => ({ insert: async () => ({ error: null }), upsert: async () => ({ error: null }) }),
      functions: {
        invoke: async () => ({
          data: null,
          error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
            context: {
              status: 403,
              json: async () => ({ error: 'Code parent incorrect.' }),
            },
          }),
        }),
      },
    } as never;

    const { data, completion } = familleAvecDemande();

    await expect(
      new SupabaseRepository(client).persist(data, {
        kind: 'completion.approved',
        upsert: { completions: [{ ...completion, status: 'approved' }] },
        codeParent: '4821',
      }),
    ).rejects.toThrow('Code parent incorrect.');

    // Et la classe compte autant que le texte : une `Error` ordinaire serait
    // remplacée par « Impossible de joindre Mino » avant d'atteindre l'écran.
    await new SupabaseRepository(client)
      .persist(data, {
        kind: 'completion.approved',
        upsert: { completions: [{ ...completion, status: 'approved' }] },
        codeParent: '4821',
      })
      .catch((e) => {
        expect(e).toBeInstanceOf(DomainError);
      });
  });
});
