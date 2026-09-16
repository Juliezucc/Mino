import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

/**
 * Les trois pastilles des Réglages doivent survivre au lancement suivant, et
 * celle qui voyage doit voyager tout de suite.
 *
 * **Ce qu'elles faisaient : rien de durable, et rien du tout côté serveur.**
 * `setNotificationPreferences` posait l'état en mémoire et s'arrêtait là. Le
 * magasin est un zustand nu, sans `persist` : les trois revenaient à leur
 * position d'origine à chaque ouverture. Le pire des réglages est celui qui
 * semble obéir puis oublie.
 *
 * Et les heures calmes, qui elles vivent côté serveur — c'est lui qui pousse
 * aux autres appareils et qui lit `heures_calmes` sur le jeton — n'étaient
 * transmises qu'au démarrage. Un parent qui les coupait lisait aussitôt
 * « les notifications peuvent arriver à toute heure » pendant que le serveur
 * continuait de se taire jusqu'au lendemain : l'écran affirmait le contraire
 * de ce qui se passait.
 */
describe('les préférences de notification', () => {
  const magasin = lire('src/store/useMinoStore.ts');

  it('s’écrivent sur le disque quand on touche une pastille', () => {
    const i = magasin.indexOf('setNotificationPreferences(patch)');
    expect(i).toBeGreaterThan(0);
    expect(magasin.slice(i, i + 1600)).toMatch(/ecrirePreferences\(apres\)/);
  });

  it('et se relisent au démarrage, avant que le jeton ne parte', () => {
    const boot = magasin.indexOf('async bootstrap()');
    const relecture = magasin.indexOf('await lirePreferences()', boot);
    const jeton = magasin.indexOf('poserJetonPush(data.family.id', boot);
    expect(relecture).toBeGreaterThan(boot);
    expect(jeton).toBeGreaterThan(relecture);
    // Et c'est bien la valeur relue qui part, pas la valeur par défaut.
    expect(magasin.slice(jeton, jeton + 120)).toMatch(/prefs\.quietHours/);
  });

  it('reposent le jeton quand les heures calmes changent — et seulement alors', () => {
    const i = magasin.indexOf('setNotificationPreferences(patch)');
    const bloc = magasin.slice(i, i + 1600);
    expect(bloc).toMatch(/apres\.quietHours !== avant\.quietHours/);
    expect(bloc).toMatch(/poserJetonPush\(famille\.id, apres\.quietHours\)/);
  });

  /**
   * Les deux autres pastilles sont locales, et `pousserAuxAutres` l'écrit
   * depuis longtemps. Ce qui manquait, c'est que l'ÉCRAN le dise : trois
   * interrupteurs présentés à l'identique laissaient croire qu'éteindre
   * « Alertes enfant » ferait taire la tablette d'en face.
   */
  it('l’écran dit lesquelles ne valent que pour cet appareil', () => {
    const ecran = lire('app/parent/(tabs)/reglages.tsx');
    expect(ecran).toMatch(/ne valent que pour cet appareil/);
  });
});

describe('le fichier de préférences', () => {
  const fichier = lire('src/data/preferencesNotification.ts');

  it('relit champ par champ, sans étalement aveugle', () => {
    // Une clé restée d'une version précédente n'a rien à faire dans l'état.
    expect(fichier).not.toMatch(/\.\.\.lu/);
    expect(fichier).toMatch(/typeof lu\.quietHours === 'boolean'/);
  });

  it('retombe sur le réglage le plus prudent si le stockage est illisible', () => {
    // Se taire la nuit est le défaut sûr : un stockage abîmé ne doit pas
    // réveiller un enfant à 22 h.
    const i = fichier.indexOf('} catch {');
    expect(fichier.slice(i, i + 200)).toMatch(/return DEFAULT_PREFERENCES/);
  });
});
