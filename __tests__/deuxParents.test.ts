import { ajouterParent, retirerParent } from '@/data/parents';
import { ChoixDAppareil, choixComplete, etatsPourChoix } from '@/data/deviceProfile';
import { DomainError } from '@/domain/actions';
import { estSecondParent, parentDeLAppareil, titulaireDuCompte } from '@/domain/parents';
import { Parent } from '@/domain/types';

/**
 * Deux parents, un seul compte.
 *
 * **Le défaut d'origine, trouvé avec un vrai second téléphone.** Une mère
 * installe Mino sur le téléphone de son mari, saisit le code famille, et
 * l'écran lui demande « c'est l'appareil de qui ? » sans jamais proposer
 * « à l'autre parent ». Il n'y avait pas de bonne réponse : un prénom d'enfant
 * réservait le téléphone à l'enfant, « partagé » enchaînait sur un bouclier
 * qu'il n'y a rien à poser ici, et l'espace parent saluait le père du prénom
 * de sa femme.
 *
 * Ce fichier tient les trois règles qui en sortent, et aucune n'est
 * cosmétique : ce que l'appareil retient, ce que le serveur doit accepter de
 * refuser, et qui est le titulaire du compte — cette dernière décidant si une
 * famille survit à son départ.
 */

const parent = (over: Partial<Parent> = {}): Parent => ({
  id: 'par-1',
  familyId: 'fam-1',
  displayName: 'Julie',
  email: 'julie@mino.app',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const profil = (id: string, prenom: string): Parent =>
  // Ni compte, ni adresse : c'est exactement ce que `ajouter-parent` écrit.
  parent({ id, displayName: prenom, email: null });

describe('à quel parent appartient cet appareil', () => {
  const julie = parent();
  const marc = profil('par-2', 'Marc');

  it('salue celui que l’appareil a nommé', () => {
    expect(parentDeLAppareil([julie, marc], 'par-2')?.displayName).toBe('Marc');
  });

  it('se replie sur le titulaire quand l’appareil n’a jamais répondu', () => {
    // Le téléphone du parent qui a créé la famille : `parentId` n'y a jamais
    // été posé, et rien ne le posera après coup. Rendre `null` ferait
    // disparaître son prénom d'un écran qu'il n'a pas touché.
    expect(parentDeLAppareil([julie, marc], null)?.displayName).toBe('Julie');
  });

  it('se replie aussi quand le profil désigné a été retiré depuis un autre appareil', () => {
    expect(parentDeLAppareil([julie], 'par-2')?.displayName).toBe('Julie');
  });

  it('ne fabrique personne dans une famille vide', () => {
    expect(parentDeLAppareil([], 'par-2')).toBeNull();
    expect(titulaireDuCompte([])).toBeNull();
  });

  it('distingue le second parent du titulaire — par l’ADRESSE, pas par l’ordre', () => {
    expect(estSecondParent(marc, [julie, marc])).toBe(true);
    expect(estSecondParent(julie, [julie, marc])).toBe(false);
  });

  it('retrouve le titulaire même quand la base rend les lignes à l’envers', () => {
    // `select` sans `order by` ne promet aucun ordre, et il change : après une
    // mise à jour de ligne, un VACUUM, un plan différent. Tant que la règle
    // était « c'est parents[0] », ce jour-là l'écran du compte proposait
    // l'adresse de l'un et le mot de passe de l'autre.
    expect(titulaireDuCompte([marc, julie])?.displayName).toBe('Julie');
    expect(estSecondParent(marc, [marc, julie])).toBe(true);
  });

  it('se replie sur le premier tant qu’aucune adresse n’est posée', () => {
    // L'instant de l'inscription : la famille n'a qu'un parent, et son adresse
    // n'est pas encore écrite. Rendre `null` ferait disparaître le compte de
    // son propre écran.
    const sansAdresse = parent({ email: null });
    expect(titulaireDuCompte([sansAdresse])?.id).toBe(sansAdresse.id);
  });
});

describe('ce que l’appareil retient du choix', () => {
  it('retient DE QUEL parent est ce téléphone', () => {
    const choix: ChoixDAppareil = { kind: 'parent', parentId: 'par-2' };
    expect(etatsPourChoix(choix)).toEqual({
      lockedChildId: null,
      usagePersonnel: true,
      declareALEnfant: false,
      parentId: 'par-2',
    });
  });

  it('n’attribue aucun parent à la tablette d’un enfant', () => {
    // La clause qui compte : sans elle, un appareil déclaré à un enfant
    // garderait le `parentId` d'un réglage précédent, et l'espace parent
    // saluerait un adulte sur la tablette de son fils.
    expect(etatsPourChoix({ kind: 'enfant', childId: 'enf-1' }).parentId).toBeNull();
    expect(etatsPourChoix({ kind: 'partage' }).parentId).toBeNull();
  });
});

/**
 * Le serveur seul décide, et son refus doit ARRIVER.
 *
 * `parents_insert` exige `user_id = auth.uid()` ET une famille sans parent :
 * c'est la clause qui empêche la tablette d'un enfant de se déclarer parent,
 * et il n'est pas question d'y toucher. L'ajout passe donc par une fonction
 * Edge, avec le code à quatre chiffres pour preuve — et tout ce que le client
 * peut faire de travers est de perdre la phrase du serveur en route.
 */
function clientFactice(reponse: { data?: unknown; error?: unknown } = {}) {
  const appels: { fonction: string; corps: unknown }[] = [];
  return {
    appels,
    client: {
      functions: {
        invoke: async (fonction: string, options: { body: unknown }) => {
          appels.push({ fonction, corps: options.body });
          return { data: reponse.data ?? null, error: reponse.error ?? null };
        },
      },
    },
  };
}

/** Ce que supabase-js rend d'une fonction qui a refusé : l'anglais dehors, le français dedans. */
const refus = (status: number, message: string) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: { status, json: async () => ({ error: message }) },
  });

describe('ajouter un parent', () => {
  it('présente le code, et rend l’identifiant créé', async () => {
    const { appels, client } = clientFactice({
      data: { parent: { id: 'par-9', display_name: 'Marc' } },
    });

    const cree = await ajouterParent({ prenom: 'Marc', code: '4821' }, client);

    expect(appels[0].fonction).toBe('ajouter-parent');
    expect(appels[0].corps).toEqual({ prenom: 'Marc', code: '4821' });
    expect(cree).toEqual({ id: 'par-9', prenom: 'Marc' });
  });

  it('remonte le refus du serveur dans SES mots, et en DomainError', async () => {
    // La classe compte autant que le texte : `commit()` et les écrans
    // n'honorent que les `DomainError`, et tout le reste retombe dans
    // « Impossible de joindre Mino ». C'est le défaut qui a coûté un build.
    const { client } = clientFactice({ error: refus(403, 'Code parent incorrect.') });

    await expect(ajouterParent({ prenom: 'Marc', code: '0000' }, client)).rejects.toThrow(
      'Code parent incorrect.',
    );
    await ajouterParent({ prenom: 'Marc', code: '0000' }, client).catch((e) => {
      expect(e).toBeInstanceOf(DomainError);
    });
  });

  it('n’invente pas un parent quand le serveur répond à côté', async () => {
    // Un 200 sans ligne : l'appelant s'apprêtait à écrire ce `parentId` sur
    // l'appareil. Mieux vaut l'échec ici que le repli silencieux là-bas.
    const { client } = clientFactice({ data: { parent: null } });
    await expect(ajouterParent({ prenom: 'Marc' }, client)).rejects.toBeInstanceOf(DomainError);
  });

  it('dit le nombre maximum plutôt que de refuser en silence', async () => {
    const { client } = clientFactice({
      error: refus(409, 'Une famille peut compter jusqu’à 4 parents.'),
    });
    await expect(ajouterParent({ prenom: 'Marc' }, client)).rejects.toThrow(
      'Une famille peut compter jusqu’à 4 parents.',
    );
  });
});

describe('retirer un parent', () => {
  it('n’envoie que l’identifiant et le code', async () => {
    const { appels, client } = clientFactice({ data: { retire: 'par-2' } });

    await retirerParent({ id: 'par-2', code: '4821' }, client);

    expect(appels[0].fonction).toBe('ajouter-parent');
    expect(appels[0].corps).toEqual({ retirer: 'par-2', code: '4821' });
  });

  it('relaie le refus quand la ligne visée porte un compte', async () => {
    // Le titulaire ne se retire pas d'un écran de réglages : il y a un
    // parcours entier pour cela, qui emporte la famille et demande d'écrire un
    // mot. Le serveur le tient — `.is('user_id', null)` dans la requête.
    const { client } = clientFactice({
      error: refus(409, 'Ce parent ne peut pas être retiré depuis ici.'),
    });
    await expect(retirerParent({ id: 'par-1' }, client)).rejects.toThrow(
      'Ce parent ne peut pas être retiré depuis ici.',
    );
  });
});

/**
 * « À moi », redit une seconde fois, ne doit rien effacer.
 *
 * Le chip des réglages et celui de l'inscription envoient `{ kind: 'parent' }`
 * et rien d'autre : ils n'ont pas à connaître le second parent. Le magasin
 * complète donc avec ce que l'appareil savait déjà — `undefined` veut dire
 * « ne touche pas », `null` veut dire « oublie ».
 */
describe('le prénom survit à une redéclaration', () => {
  const complete = choixComplete;

  it('garde le parent déjà nommé quand le choix ne le dit pas', () => {
    expect(etatsPourChoix(complete({ kind: 'parent' }, 'par-2')).parentId).toBe('par-2');
  });

  it('oublie quand on le lui demande explicitement', () => {
    expect(etatsPourChoix(complete({ kind: 'parent', parentId: null }, 'par-2')).parentId).toBeNull();
  });

  it('et passer l’appareil à un enfant l’oublie de toute façon', () => {
    expect(etatsPourChoix(complete({ kind: 'enfant', childId: 'enf-1' }, 'par-2')).parentId).toBeNull();
  });
});
