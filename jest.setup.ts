/**
 * Les tests tournent à l'heure de Paris, et pas à celle du serveur qui les
 * lance.
 *
 * Mino est une application française dont tout le domaine raisonne en heure
 * LOCALE : « la mission d'aujourd'hui », « le mercredi de 14 h à 16 h ». Une
 * suite qui tournerait en UTC — ce que fait un serveur d'intégration par
 * défaut — laisserait passer sans un mot toute la classe de défauts du
 * décalage horaire, puisqu'en UTC il n'y a pas de décalage à commettre. Les
 * tests qui protègent du fuseau passeraient alors même sur du code cassé.
 *
 * Le fuseau se pose dans `npm test` (`TZ=Europe/Paris jest`) et non ici :
 * Node le fige au démarrage du processus, et le changer une fois les tests
 * lancés n'a aucun effet. Silencieusement — c'est-à-dire de la pire façon.
 *
 * D'où ce garde-fou, qui fait du bruit plutôt que de laisser une suite verte
 * mentir sur ce qu'elle a vérifié.
 */
{
  // Le 15 janvier : hiver, donc UTC+1 à Paris, donc -60.
  const hiver = new Date('2026-01-15T12:00:00Z').getTimezoneOffset();
  if (hiver !== -60) {
    throw new Error(
      'Les tests doivent tourner à l’heure de Paris : lancez « npm test » ' +
        '(et non « npx jest » directement). Sans cela, tous les tests qui ' +
        'protègent du décalage horaire passeraient même sur du code cassé.',
    );
  }
}

/* Global test setup: in-memory AsyncStorage + silenced native animation warnings. */
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

// Le module natif n'existe pas sous Jest. Ce qu'on vérifie ici est la FORME
// des codes — leur longueur, leur alphabet — pas la qualité de l'aléa : celle-là
// tient au système, et se vérifie sur l'appareil, pas dans un test.
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
    return out;
  },
}));

/**
 * `createURL` a besoin du manifeste d'Expo pour connaître le schéma de
 * l'application, et il n'y a pas de manifeste sous Jest. On rend ici ce qu'il
 * rendrait sur un appareil — le schéma déclaré dans `app.json`.
 */
jest.mock('expo-linking', () => ({
  createURL: (chemin: string) => `mino://${String(chemin).replace(/^\//, '')}`,
  useURL: () => null,
  // `lienEntrant` s'y abonne dès son import ; sans ces deux-là, tout fichier
  // qui le charge — directement ou par la racine de l'application — échouerait
  // au chargement plutôt qu'à l'assertion.
  addEventListener: () => ({ remove: () => undefined }),
  getInitialURL: async () => null,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
