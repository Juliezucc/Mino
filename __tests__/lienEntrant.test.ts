/**
 * Le lien de confirmation, et le moment où il arrive.
 *
 * Le défaut ne tenait pas au code d'authentification, qui était juste, mais à
 * un problème de **calendrier** : les écrans lisaient l'adresse entrante avec
 * `Linking.useURL()`, un crochet qui ne rend que l'adresse de lancement et
 * celles reçues après son abonnement. Dans le cas le plus courant — Mino déjà
 * ouvert, le parent touche le lien dans son courriel — l'adresse arrive, la
 * navigation emmène sur `/confirme`, et l'écran ne s'abonne qu'ensuite.
 * L'événement est passé.
 *
 * Le parent lisait alors « Un instant, nous ouvrons votre espace parent… »
 * indéfiniment. Pas d'erreur, pas de journal, rien à quoi se raccrocher.
 *
 * Sur le web l'adresse est dans la barre du navigateur et y reste : le parcours
 * passait à l'essai et échouait à l'usage. Ces vérifications-là portent donc
 * sur l'ordre des événements, et sur rien d'autre.
 */

type Ecoute = (e: { url: string }) => void;

/** Rejoue le cycle de vie d'`expo-linking` autour d'un import frais du module. */
function monter(options: { lancement?: string | null } = {}) {
  const ecoutes: Ecoute[] = [];

  jest.resetModules();
  jest.doMock('expo-linking', () => ({
    addEventListener: (_: string, ecoute: Ecoute) => {
      ecoutes.push(ecoute);
      return { remove: () => undefined };
    },
    getInitialURL: async () => options.lancement ?? null,
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('@/services/auth/lienEntrant') as typeof import('@/services/auth/lienEntrant');

  return {
    ...module,
    /** Ce que fait iOS quand l'application tourne déjà. */
    recevoir: (url: string) => ecoutes.forEach((e) => e({ url })),
    /** `getInitialURL` est asynchrone : on lui laisse son tour de boucle. */
    attendre: () => new Promise((r) => setImmediate(r)),
  };
}

const AVEC_JETONS = 'mino://confirme#access_token=abc&refresh_token=def';

describe('le lien entrant', () => {
  it('retient un lien arrivé avant que l’écran n’existe', async () => {
    // Le cas qui cassait : Mino est ouvert, le lien arrive, et l'écran de
    // confirmation n'est monté qu'après. Personne n'écoutait à ce moment-là.
    const lien = monter();
    lien.recevoir(AVEC_JETONS);

    expect(lien.dernierLien()).toBe(AVEC_JETONS);
  });

  it('retient aussi le lien qui a lancé l’application', async () => {
    // L'autre cas : Mino était fermé. L'événement est parti avant que le
    // JavaScript n'existe, et seule l'adresse de lancement en garde la trace.
    const lien = monter({ lancement: AVEC_JETONS });
    await lien.attendre();

    expect(lien.dernierLien()).toBe(AVEC_JETONS);
  });

  it('attend l’adresse de lancement au lieu de conclure trop vite', async () => {
    /**
     * Le défaut introduit en corrigeant le précédent, et qui était pire.
     *
     * `getInitialURL()` est asynchrone. Quand Safari lance Mino depuis le
     * courriel, l'adresse n'est pas encore là au premier rendu de l'écran —
     * et `dernierLien()` n'étant pas une valeur réactive, rien ne re-rendrait
     * l'écran à son arrivée. L'application annonçait donc « ce lien est
     * incomplet » à un parent qui venait d'en toucher un valable.
     */
    const lien = monter({ lancement: AVEC_JETONS });

    // Lu tout de suite, il n'y a encore rien : c'est exactement ce que voyait
    // l'écran.
    expect(lien.dernierLien()).toBeNull();
    // Attendu, il est là.
    await expect(lien.attendreLien()).resolves.toBe(AVEC_JETONS);
  });

  it('ne laisse pas l’adresse de lancement écraser un lien plus récent', async () => {
    /**
     * Précisément ce qui se passe dans une build de développement : l'adresse
     * de lancement est celle du serveur Metro, sans le moindre jeton. Arrivée
     * après coup, elle remplacerait le vrai lien — et le parent lirait « ce
     * lien est incomplet » alors qu'il vient d'en toucher un valable.
     */
    const lien = monter({ lancement: 'mino://expo-development-client/?url=http%3A%2F%2F192.168.1.98' });
    lien.recevoir(AVEC_JETONS);
    await lien.attendre();

    expect(lien.dernierLien()).toBe(AVEC_JETONS);
  });

  it('oublie le lien une fois consommé', () => {
    // Sans cela, revenir sur l'écran rejouerait un lien déjà usé et
    // annoncerait « ce lien a expiré » à quelqu'un qui n'a rien demandé.
    const lien = monter();
    lien.recevoir(AVEC_JETONS);
    lien.oublierLien();

    expect(lien.dernierLien()).toBeNull();
  });

  it('ne rend rien quand aucun lien n’est arrivé', async () => {
    // L'écran doit pouvoir le distinguer de l'attente, et le dire.
    const lien = monter();
    await lien.attendre();

    expect(lien.dernierLien()).toBeNull();
  });
});
