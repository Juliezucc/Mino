import { DeviceManagedScreenTimeService, LocalTimerScreenTimeService } from '@/services/screenTime';
import { buildDemoFamily } from '@/data/demo';
import { startSession } from '@/domain/actions';
import { minutesRestantes, openWindowAt } from '@/domain/freeWindows';

/**
 * Une plage libre ouvre l'écran. Elle ne le fermait pas à moitié.
 *
 * **Le défaut, et c'est le plus grave trouvé avant ce build.** « Le mercredi
 * de 14 h à 16 h » refusait la séance de l'enfant avec une phrase parfaitement
 * juste — « c'est ouvert, tu n'as pas besoin de tes minos » — alors que RIEN
 * n'ouvrait quoi que ce soit. Le bouclier ne se levait qu'au démarrage d'une
 * séance, et il n'existait que deux appels à `unshield` dans tout le dépôt,
 * tous deux dans `grant`. Le mercredi après-midi, l'enfant se retrouvait donc
 * sans séance possible ET sans ses applications : la plage libre fermait les
 * deux portes au lieu d'en ouvrir une.
 *
 * Elle ne se voyait sur aucun écran relu. Il fallait faire le geste, un
 * mercredi.
 */
function fauxNatif(etat: 'approved' | 'denied' = 'approved', apps = 7) {
  const appels: string[] = [];
  let protege = true;
  let jusqua = 0;
  return {
    appels,
    protege: () => protege,
    jusqua: () => jusqua,
    async authorizationStatus() {
      return etat;
    },
    async requestAuthorization() {
      return etat;
    },
    async presentPicker() {
      return { count: apps };
    },
    async selectionCount() {
      return { count: apps };
    },
    async shield() {
      appels.push('shield');
      protege = true;
    },
    async unshield(deadline: number) {
      appels.push('unshield');
      protege = false;
      jusqua = deadline;
    },
    async remaining() {
      return Math.max(0, jusqua - Date.now());
    },
  };
}

describe('une plage libre lève vraiment le bouclier', () => {
  it('ouvre l’écran jusqu’à la fin de la plage, sans rien débiter', async () => {
    const natif = fauxNatif();
    const service = new DeviceManagedScreenTimeService(natif);
    const fin = new Date('2026-09-16T16:00:00Z');

    await service.ouvrirPlageLibre(fin);

    expect(natif.appels).toEqual(['unshield']);
    expect(natif.protege()).toBe(false);
    // L'échéance part au natif : le bouclier doit revenir même si l'enfant
    // force la fermeture de Mino — ce qu'aucun minuteur JavaScript ne couvre.
    expect(natif.jusqua()).toBe(fin.getTime());
  });

  it('ne lève rien quand l’autorisation n’a pas été accordée', async () => {
    // Lever un verrou qui n'existe pas n'a jamais ouvert une porte, et
    // prétendre le contraire ferait croire la plage active alors que le
    // contrôle parental du téléphone bloque toujours.
    const natif = fauxNatif('denied');
    await new DeviceManagedScreenTimeService(natif).ouvrirPlageLibre(new Date());
    expect(natif.appels).toEqual([]);
  });

  it('ne lève rien quand le parent n’a choisi aucune application', async () => {
    const natif = fauxNatif('approved', 0);
    await new DeviceManagedScreenTimeService(natif).ouvrirPlageLibre(new Date());
    expect(natif.appels).toEqual([]);
  });

  it('ne fait rien, et sans échouer, là où Mino ne bloque rien', async () => {
    await expect(
      new LocalTimerScreenTimeService().ouvrirPlageLibre(new Date()),
    ).resolves.toBeUndefined();
  });
});

/**
 * Et le refus de séance, lui, reste — mais il est devenu vrai.
 *
 * La phrase n'a jamais été le défaut : dépenser des minutes pour obtenir un
 * écran déjà ouvert serait un vol. Ce qui manquait, c'est que l'écran le soit.
 */
describe('le refus de séance pendant une plage', () => {
  /**
   * Mercredi 14 h 30, heure LOCALE — et c'est tout le sujet.
   *
   * Les plages libres sont des minutes dans la journée de la famille, pas des
   * instants UTC. Écrit en `Z`, cet essai passait l'hiver et tombait l'été,
   * ou l'inverse selon la machine. On le construit donc dans le fuseau où il
   * s'exécute, comme l'enfant le vit.
   */
  const MERCREDI = new Date(2026, 8, 16, 14, 30, 0);

  it('refuse de débiter, et dit jusqu’à quand c’est ouvert', () => {
    const data = buildDemoFamily(MERCREDI);
    const enfant = data.children[0];
    const plage = openWindowAt(data.freeWindows ?? [], enfant.id, MERCREDI);

    // La famille de démonstration porte bien une plage ce jour-là : sans elle,
    // cet essai passerait sans rien exercer.
    expect(plage).not.toBeNull();
    expect(minutesRestantes(plage!, MERCREDI)).toBeGreaterThan(0);

    expect(() => startSession(data, { childId: enfant.id, minutes: 10 }, MERCREDI)).toThrow(
      /ouvert/,
    );
  });
});
