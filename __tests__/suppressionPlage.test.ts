import { buildDemoFamily } from '@/data/demo';
import { ChangeEvent, MinoRepository } from '@/data/repository';
import { FamilyData } from '@/domain/types';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * Tout ce qu'une action rend au magasin doit atteindre le dépôt.
 *
 * **Le défaut, trouvé par Julie sur la version publiée.** Elle supprime une
 * plage libre, l'écran l'enlève, elle en ajoute une autre — et la supprimée
 * revient. `removeFreeWindow` rendait bien `deleteFreeWindowId`, mais `commit`
 * recopiait quatre champs à la main dans l'objet remis au dépôt et celui-là
 * n'en faisait pas partie. Il tombait en silence.
 *
 * La ligne restait donc en base : l'ajout suivant déclenchait un rechargement,
 * et la plage « supprimée » réapparaissait.
 *
 * **Rien ne pouvait l'attraper.** `tsc` passe à zéro : TypeScript n'applique
 * pas le contrôle des propriétés excédentaires à un littéral rendu par une
 * lambda typée par un paramètre générique. Le champ était déclaré, posé, lu —
 * et rien ne reliait les trois.
 *
 * Cet essai tient le lien. Il ne vérifie pas un geste : il vérifie que le
 * changement arrive entier.
 */
class DepotEspion implements MinoRepository {
  readonly name = 'espion';
  readonly changements: ChangeEvent[] = [];
  private dernier: FamilyData | null = null;

  poser(data: FamilyData) {
    this.dernier = data;
  }

  async load(): Promise<FamilyData | null> {
    return this.dernier;
  }

  async persist(data: FamilyData, change: ChangeEvent): Promise<void> {
    this.dernier = data;
    this.changements.push(change);
  }

  async create(data: FamilyData): Promise<void> {
    this.dernier = data;
  }

  watch(): () => void {
    return () => undefined;
  }

  async clear(): Promise<void> {
    this.dernier = null;
  }

  async joinFamily(): Promise<FamilyData | null> {
    return this.dernier;
  }
}

function magasinAvecEspion() {
  const depot = new DepotEspion();
  const demo = buildDemoFamily(new Date('2026-09-15T10:00:00'));
  depot.poser(demo);
  useMinoStore.setState({
    repository: depot,
    status: 'ready',
    data: demo,
    parentUnlocked: true,
    lastError: null,
  });
  return { depot, demo };
}

describe('supprimer une plage libre', () => {
  it('dit au dépôt LAQUELLE supprimer', async () => {
    // Le cœur du défaut : sans cet identifiant, le dépôt ne supprime rien —
    // et pour ce geste `upsert` est vide, donc il ne fait même aucun appel.
    const { depot, demo } = magasinAvecEspion();
    const id = await useMinoStore.getState().addFreeWindow({
      label: 'Mercredi après-midi',
      childIds: null,
      days: [3],
      startMinute: 840,
      endMinute: 960,
    });

    depot.changements.length = 0;
    await useMinoStore.getState().removeFreeWindow(id);

    expect(depot.changements).toHaveLength(1);
    expect(depot.changements[0].kind).toBe('freeWindow.removed');
    expect(depot.changements[0].deleteFreeWindowId).toBe(id);
    expect(demo).toBeTruthy();
  });

  it('et l’enlève aussi de l’état local', async () => {
    const { } = magasinAvecEspion();
    const id = await useMinoStore.getState().addFreeWindow({
      label: 'Vacances',
      childIds: null,
      days: [],
      date: '2026-12-24',
      startMinute: 600,
      endMinute: 1200,
    });

    expect(useMinoStore.getState().data?.freeWindows?.some((f) => f.id === id)).toBe(true);
    await useMinoStore.getState().removeFreeWindow(id);
    expect(useMinoStore.getState().data?.freeWindows?.some((f) => f.id === id)).toBe(false);
  });

  /**
   * La garde qui vaut pour tous les gestes, et pas seulement celui-ci.
   *
   * Un champ ajouté à `ChangeEvent` et oublié dans `commit` retombe dans le
   * même silence. Depuis la correction, ce que rend une action est réétalé tel
   * quel : cet essai le vérifie sur les deux suppressions qui existent.
   */
  it('la suppression d’un enfant voyage aussi', async () => {
    const { depot } = magasinAvecEspion();
    const enfant = useMinoStore.getState().data?.children[0];
    expect(enfant).toBeTruthy();

    depot.changements.length = 0;
    await useMinoStore.getState().deleteChild(enfant!.id);

    expect(depot.changements[0]?.deleteChildId).toBe(enfant!.id);
  });
});
