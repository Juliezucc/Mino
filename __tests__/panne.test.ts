import { buildDemoFamily } from '@/data/demo';
import { ChangeEvent, MinoRepository } from '@/data/repository';
import { FamilyData, ID } from '@/domain/types';
import { balanceOf } from '@/domain/ledger';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * Ce que Mino fait quand le serveur ne répond pas.
 *
 * Écrit parce que rien ne l'avait jamais éprouvé : tant que l'application
 * tourne sur l'appareil (AsyncStorage), l'écriture ne peut pas échouer et la
 * lecture non plus. Le jour où Supabase est branché — c'est-à-dire maintenant
 * — les deux peuvent échouer, et pour la raison la plus banale du monde : un
 * ascenseur, un sous-sol, une voiture, un tunnel.
 *
 * Deux exigences, et elles ne sont pas négociables :
 *
 *   1. **L'application s'ouvre.** Même sans réseau. Un écran de démarrage qui
 *      ne s'en va jamais est le pire des messages d'erreur.
 *
 *   2. **Une minute annoncée est une minute acquise.** Si le serveur n'a pas
 *      pris l'écriture, l'enfant ne doit PAS voir son compteur monter. Le voir
 *      monter puis redescendre le lendemain est exactement la dispute que tout
 *      ce produit existe pour éviter.
 */

/** Un dépôt qui refuse tout, comme un serveur injoignable. */
class DepotEnPanne implements MinoRepository {
  readonly name = 'panne';
  constructor(private readonly quoi: 'lecture' | 'ecriture' = 'lecture') {}

  async load(): Promise<FamilyData | null> {
    if (this.quoi === 'lecture') throw new Error('Network request failed');
    return this.dernier;
  }

  private dernier: FamilyData | null = null;
  /** Le décor : ce que le serveur avait avant de tomber. */
  poser(data: FamilyData) {
    this.dernier = data;
  }

  async persist(_data: FamilyData, _change: ChangeEvent): Promise<void> {
    throw new Error('Network request failed');
  }

  async clear(): Promise<void> {}

  async joinFamily(_input: { code: string }): Promise<FamilyData | null> {
    throw new Error('Network request failed');
  }
}

describe('quand le serveur ne répond pas', () => {
  const store = () => useMinoStore.getState();

  afterEach(() => {
    useMinoStore.setState({ status: 'loading', data: null });
  });

  it("s'ouvre quand même : l'écran de démarrage ne reste pas figé", async () => {
    useMinoStore.setState({ repository: new DepotEnPanne('lecture'), status: 'loading', data: null });

    // Ne doit pas rejeter : `app/_layout.tsx` appelle `bootstrap()` sans filet,
    // et une promesse rejetée y laisse l'application sur son écran de départ,
    // pour toujours et sans un mot.
    await expect(store().bootstrap()).resolves.toBeUndefined();

    expect(store().status).toBe('ready');
  });

  it('ne fait pas monter un compteur que le serveur a refusé', async () => {
    const depot = new DepotEnPanne('ecriture');
    const demo = buildDemoFamily();
    depot.poser(demo);

    const noah = demo.children.find((c) => c.firstName === 'Noah')!;
    useMinoStore.setState({ repository: depot, status: 'ready', data: demo, parentUnlocked: true });

    const avant = balanceOf(store().data!.transactions, noah.id as ID);

    // Un bonus : le chemin d'écriture le plus court du produit.
    await store()
      .grantBonus(noah.id, 15, 'Coup de main')
      .catch(() => undefined);

    const apres = balanceOf(useMinoStore.getState().data!.transactions, noah.id as ID);

    // Le serveur a refusé. Le compteur ne doit pas avoir bougé — sans quoi
    // l'enfant voit quinze minutes qui n'existent nulle part, et qui
    // disparaîtront à la prochaine lecture réussie.
    expect(apres).toBe(avant);
  });

  it('dit que quelque chose a échoué, plutôt que de faire semblant', async () => {
    const depot = new DepotEnPanne('ecriture');
    const demo = buildDemoFamily();
    depot.poser(demo);
    const noah = demo.children.find((c) => c.firstName === 'Noah')!;
    useMinoStore.setState({ repository: depot, status: 'ready', data: demo, parentUnlocked: true, lastError: null });

    await store()
      .grantBonus(noah.id, 15, 'Coup de main')
      .catch(() => undefined);

    expect(useMinoStore.getState().lastError).toBeTruthy();
  });
});
