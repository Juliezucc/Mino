import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { destinationDeLAppui } from '@/domain/aiguillageNotification';
import {
  missionCompleted,
  missionCountedItself,
  sessionRequested,
  trialEnding,
} from '@/domain/notifications';
import { Child, Mission } from '@/domain/types';

/**
 * Toucher une notification doit mener quelque part — et nulle part ailleurs.
 *
 * **La demande de Julie, après une soirée d'usage dans sa famille :** « quand
 * on clique sur une notification, ça ouvre juste l'app. Quand un parent reçoit
 * une mission qu'il doit valider, je trouverais ça bien que ça l'amène dans la
 * mission en question. »
 *
 * La route était écrite depuis toujours dans la charge utile, transmise par le
 * serveur… et jetée à l'arrivée, faute de lecteur.
 *
 * **Mais elle arrive du réseau.** La fonction `notify` recopie `route` telle
 * quelle, et l'appelant accepté inclut la session d'une tablette d'enfant. La
 * suivre aveuglément ouvrirait des portes que le dépôt a déjà refermées : c'est
 * ce fichier qui tient la table blanche, et la plupart des essais ci-dessous
 * ne vérifient pas que ça marche — ils vérifient que ça ne marche PAS.
 */
const DEFAUT = 'expo.modules.notifications.actions.DEFAULT';

const appui = (
  data: unknown,
  extra: Partial<{ usage: 'enfant' | 'partage' | 'parent' | 'inconnu'; action: string }> = {},
) =>
  destinationDeLAppui({
    data,
    actionIdentifier: extra.action ?? DEFAUT,
    actionParDefaut: DEFAUT,
    usage: extra.usage ?? 'parent',
  });

describe('où mène un appui sur une notification', () => {
  it('mène à l’accueil parent, qui est là où l’on confirme', () => {
    // Et pas à l'onglet Missions, qui est un catalogue d'édition : le parent y
    // verrait des réglages et aucun bouton pour confirmer.
    expect(appui({ route: '/parent', childId: 'enf_1' })).toBe('/parent');
  });

  it('mène à la formule pour la fin d’essai', () => {
    expect(appui({ route: '/parent/abonnement' })).toBe('/parent/abonnement');
  });

  it('ne suit pas une route qui ouvrirait le profil d’un autre enfant', () => {
    // `app/who.tsx` honore `ouvrir` au montage — `selectChild` puis
    // `replace('/child')` — sans passer par `ouvertureDeProfil`, qui est le
    // garde. Ce serait les minutes d'un frère, sans le code.
    expect(appui({ route: '/who?ouvrir=enf_noah' })).toBeNull();
    expect(appui({ route: '/who' })).toBeNull();
  });

  it('refuse une route connue affublée de paramètres', () => {
    // `/parent-pin?ensuite=…` commence par « /parent » : une comparaison de
    // préfixe transformerait le code tapé pour valider une mission en
    // ouverture du profil d'un frère.
    expect(appui({ route: '/parent?x=1' })).toBeNull();
    expect(appui({ route: '/parent-pin?ensuite=/who&ouvrir=enf_2' })).toBeNull();
    expect(appui({ route: '/parent/' })).toBeNull();
    expect(appui({ route: ' /parent' })).toBeNull();
  });

  it('ne suit pas une route qui redéclarerait l’appareil, ni ne sort de Mino', () => {
    for (const route of [
      '/onboarding/appareil',
      'https://exemple.test',
      '//exemple.test',
      'mino://who?ouvrir=x',
    ]) {
      expect(appui({ route })).toBeNull();
    }
  });

  it('ne se laisse pas prendre par une clé de prototype', () => {
    // Une `Map`, pas un objet : sinon `constructor` rendrait une fonction.
    expect(appui({ route: 'constructor' })).toBeNull();
    expect(appui({ route: '__proto__' })).toBeNull();
    expect(appui({ route: 'toString' })).toBeNull();
  });

  it('ouvre simplement l’application quand il n’y a rien à lire', () => {
    // Le serveur envoie `null` quand il n'y a pas de route ; et le paquet rend
    // un contenu SANS `data` du tout quand l'analyse JSON échoue.
    for (const d of [{ route: null }, { route: 42 }, {}, undefined, null, '/parent']) {
      expect(appui(d)).toBeNull();
    }
  });

  it('ne suit AUCUNE route d’enfant', () => {
    // `app/child/_layout` renvoie sur `/who` sans profil ouvert, et `who.tsx`
    // referme l'espace parent puis appelle `selectChild(null)` : l'enfant
    // serait arraché à son profil.
    for (const route of ['/child', '/child/missions', '/child/session']) {
      expect(appui({ route })).toBeNull();
    }
  });

  it('ne mène jamais à l’espace parent depuis l’appareil d’un enfant', () => {
    expect(appui({ route: '/parent' }, { usage: 'enfant' })).toBeNull();
    expect(appui({ route: '/parent/abonnement' }, { usage: 'enfant' })).toBeNull();
  });

  it('mène quand même à l’accueil parent depuis la tablette partagée', () => {
    // C'est le seul chemin d'une famille sans téléphone de parent : la couper
    // laisserait ces familles sans nouvelles. L'enfant qui toucherait tombe sur
    // l'écran du code — la serrure qui fonctionne, pas une porte.
    expect(appui({ route: '/parent' }, { usage: 'partage' })).toBe('/parent');
    expect(appui({ route: '/parent' }, { usage: 'inconnu' })).toBe('/parent');
  });

  it('ne bouge pas pour un bouton d’action', () => {
    // « Refuser » ne doit pas emmener là où emmène « Confirmer ».
    expect(appui({ route: '/parent' }, { action: 'refuser' })).toBeNull();
  });
});

/**
 * Le lien entre ce qui est ÉCRIT et ce qui est SUIVI.
 *
 * Rien, jusqu'ici, ne vérifiait les routes que posent les constructeurs.
 * Changer une `route:` rendrait l'appui muet en production, sans un mot — et
 * c'est précisément le genre de silence qui a fait que le champ a voyagé des
 * mois sans lecteur.
 */
describe('les annonces qui attendent le parent', () => {
  const enfant = { id: 'enf_1', firstName: 'Raphaël', age: 8 } as Child;
  const mission = { id: 'm1', title: 'Se brosser les dents', icon: '🪥', minutes: 10 } as Mission;

  it('mènent toutes les trois à l’accueil parent', () => {
    for (const charge of [
      missionCompleted(enfant, mission),
      missionCountedItself(enfant, mission),
      sessionRequested(enfant, 20, undefined, undefined),
    ]) {
      expect(appui({ route: charge.route })).toBe('/parent');
    }
  });

  it('et la fin d’essai mène à la formule', () => {
    expect(appui({ route: trialEnding(3).route })).toBe('/parent/abonnement');
  });
});

/**
 * Deux gardes de source, dans l'idiome du dépôt.
 *
 * Ce que ces deux lignes empêchent ne se voit pas à la relecture d'un écran :
 * elles disent qu'aucune chaîne venue du réseau n'atteint le routeur, et
 * qu'aucune notification ne choisit un profil d'enfant.
 */
describe('le lecteur d’appuis', () => {
  const source = readFileSync(
    join(__dirname, '..', 'src/services/notifications/appuiNotification.ts'),
    'utf8',
  );

  it('ne change jamais de profil depuis une notification', () => {
    // Choisir un profil d'après un `childId` venu du réseau contournerait
    // `ouvertureDeProfil`, qui est le garde — la faute déjà réparée ailleurs,
    // refaite par une porte neuve.
    expect(source).not.toMatch(/selectChild\(/);
    expect(source).not.toMatch(/childId/);
  });

  it('ne donne jamais au routeur une chaîne reçue', () => {
    expect(source).not.toMatch(/router\.(push|replace|navigate)\(\s*(data|route|reponse)/);
    // Ce qui part au routeur est la destination rendue par le domaine.
    expect(source).toMatch(/router\.push\(destination\)/);
  });

  it('lit le cache natif AVANT de s’abonner', () => {
    // L'appui qui a lancé l'application ne passe par aucun abonnement : il est
    // rejoué côté natif avant que le JavaScript n'existe. S'abonner d'abord,
    // c'est rater le cas le plus fréquent.
    const lecture = source.indexOf('getLastNotificationResponse()');
    const abonnement = source.indexOf('addNotificationResponseReceivedListener');
    expect(lecture).toBeGreaterThan(0);
    expect(abonnement).toBeGreaterThan(lecture);
  });

  it('ne touche à rien là où le service n’est pas disponible', () => {
    // Sur le web, la lecture LÈVE : appelée à l'évaluation d'un module importé
    // par la mise en page racine, elle ferait tomber l'application sur son
    // écran de secours.
    expect(source).toMatch(/if \(getNotificationService\(\)\.available\)/);
  });

  it('n’attend pas que le magasin soit prêt pour retenir l’appui', () => {
    // Sans cette file d'attente, une notification touchée pendant le démarrage
    // serait décidée sur une famille pas encore chargée — et `/parent`
    // afficherait « Créer mon compte parent » à quelqu'un qui en a un.
    expect(source).toMatch(/if \(!pretADecider\(\)\) \{\s*\n\s*enAttente = reponse;/);
    expect(source).toMatch(/status === 'ready' && !!etat\.data && !etat\.offline/);
  });
});

describe('l’écran d’entrée', () => {
  const source = readFileSync(join(__dirname, '..', 'app/index.tsx'), 'utf8');

  it('honore l’intention après les gardes, et avant la reprise de profil', () => {
    const horsLigne = source.indexOf('href="/hors-ligne"');
    const inscription = source.indexOf('inscriptionInachevee(data)');
    const notification = source.indexOf('if (venantDUneNotification)');
    const reprise = source.indexOf('if (resume)');

    expect(horsLigne).toBeGreaterThan(0);
    expect(notification).toBeGreaterThan(inscription);
    expect(inscription).toBeGreaterThan(horsLigne);
    expect(reprise).toBeGreaterThan(notification);
  });

  it('gèle l’intention au premier rendu', () => {
    // Lue réactivement, elle rendrait une seconde redirection à l'instant où on
    // l'efface — et c'est la seconde qui gagnerait.
    expect(source).toMatch(/useState\(\(\) => destinationEnAttente\(usage\)\)/);
  });

  it('la consomme, même quand il ne l’a pas suivie', () => {
    expect(source).toMatch(/oublierLAppui\(\)/);
  });
});
