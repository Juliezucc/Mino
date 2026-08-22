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

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
