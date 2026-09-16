import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (chemin: string) => readFileSync(join(__dirname, '..', chemin), 'utf8');

/**
 * Une plage ouverte doit se voir, et l'en-tête ne doit pas la contredire.
 *
 * **Ce que les enfants de Julie ont dit, et il fallait les écouter jusqu'au
 * bout.** La plage fonctionnait sur leur téléphone — le bouclier se levait bien
 * — mais « ils n'avaient pas remarqué sur leur app ». Ce n'était donc pas une
 * panne : c'était un écran qui disait l'inverse de lui-même.
 *
 * Un enfant à zéro mino pendant une plage lisait, en 34 px et avec un Mino
 * TRISTE : « Plus de minos… fais une mission pour en gagner ! » Et en dessous,
 * en 18 px et en vert pâle : « C'est ouvert ! ». Les deux éléments les plus
 * visibles de l'écran disaient le contraire de la bonne nouvelle.
 *
 * Grossir la carte seule n'aurait pas suffi. C'est l'en-tête entier qui devait
 * cesser de la contredire.
 */
describe('l’accueil de l’enfant pendant une plage libre', () => {
  const ecran = lire('app/child/(tabs)/index.tsx');

  it('relit l’heure, au lieu de figer la plage au montage', () => {
    /**
     * Sans battement, l'écran ne dit rien à 14 h quand la plage s'ouvre — alors
     * que l'enfant a justement l'application ouverte, c'est le cas le plus
     * fréquent un mercredi — et il dit encore « c'est ouvert » à 16 h 20, quand
     * le compteur s'est remis à débiter. La seconde moitié coûte des minos.
     */
    expect(ecran).toMatch(/useMinuteCourante\(\)/);
    // La minute doit ENTRER dans le calcul, pas seulement être lue.
    expect(ecran).toMatch(/openWindowAt\([\s\S]{0,120}new Date\(minute \* 60_000\)/);
  });

  it('la mascotte se réjouit au lieu d’être triste', () => {
    const i = ecran.indexOf('const expression');
    expect(i).toBeGreaterThan(0);
    // La plage passe AVANT le solde : c'est la seule information qui compte à
    // cet instant, puisque le compteur ne bouge pas.
    expect(ecran.slice(i, i + 120)).toMatch(/plageOuverte\s*\n?\s*\?\s*'delighted'/);
  });

  it('le message d’accueil annonce la plage au lieu du solde vide', () => {
    const i = ecran.indexOf('const message');
    expect(i).toBeGreaterThan(0);
    expect(ecran.slice(i, i + 80)).toMatch(/plageOuverte/);
    // Et il dit jusqu'à quand : « c'est ouvert » sans heure de fin laisse
    // l'enfant découvrir la fermeture en se faisant débiter.
    expect(ecran.slice(i, i + 400)).toMatch(/heure\(plageOuverte\.endMinute\)/);
  });

  it('la carte est aussi grosse que le bonjour, et elle se détache', () => {
    // Sur un écran qui porte une mascotte de 96 px, un anneau de minutes et
    // deux boutons d'enfant, une ligne de 18 px ne se voit pas.
    const debut = ecran.indexOf('style={styles.plage}');
    expect(debut).toBeGreaterThan(0);
    const carte = ecran.slice(debut - 120, debut + 600);
    expect(carte).toMatch(/elevation="soft"/);
    expect(carte).toMatch(/variant="hero"/);
    expect(carte).toMatch(/C’est ouvert !/);
  });

  it('et elle respecte le contraste du vert', () => {
    // `colors.ts` le mesure : le mint sur son fond pâle donne 1,83:1. C'est
    // `mintInk` qui se lit, et c'est écrit dans le thème, pas deviné.
    const debut = ecran.indexOf('style={styles.plage}');
    expect(ecran.slice(debut, debut + 600)).toMatch(/colors\.mintInk/);
  });
});

/**
 * L'onglet Temps est l'écran où l'enfant VIENT pendant une plage.
 *
 * Il n'en parlait nulle part — zéro occurrence dans tout le fichier. Un enfant
 * qui arrive un mercredi à 14 h voyait son solde, choisissait une durée,
 * appuyait sur COMMENCER, et recevait le refus du domaine EN ROUGE, sous le
 * curseur, en caractères de légende : « C'est ouvert jusqu'à 16:00, tu n'as
 * rien à dépenser. » Une bonne nouvelle annoncée comme une erreur.
 */
describe('l’onglet Temps pendant une plage libre', () => {
  const ecran = lire('app/child/(tabs)/temps.tsx');

  it('sait qu’une plage est ouverte', () => {
    expect(ecran).toMatch(/openWindowAt\(/);
    expect(ecran).toMatch(/useMinuteCourante\(\)/);
  });

  it('remplace le lanceur au lieu de le laisser échouer', () => {
    // L'ordre compte : une demande en attente et une séance en cours passent
    // avant — une plage n'annule ni l'une ni l'autre.
    const demande = ecran.indexOf('{requested ? (');
    const enCours = ecran.indexOf(') : running ? (');
    const plage = ecran.indexOf(') : plageOuverte ? (');
    expect(demande).toBeGreaterThan(0);
    expect(enCours).toBeGreaterThan(demande);
    expect(plage).toBeGreaterThan(enCours);
  });

  /**
   * **La garde qui manquait, et qui a laissé le défaut partir en boutique.**
   *
   * L'essai ci-dessus vérifiait `requested` → `running` → `plageOuverte` et
   * s'arrêtait là. Il ne regardait pas la quatrième branche, `balance.minutes
   * <= 0`, qui était placée AVANT la plage. Un enfant à zéro mino pendant une
   * plage ouverte lisait donc « Plus de minos pour aujourd'hui » sur l'écran
   * même où il venait profiter d'un moment sans décompte.
   *
   * Le cas n'a rien d'exceptionnel : un mercredi après-midi arrive rarement
   * avec un solde intact. C'est celui que les enfants de Julie ont signalé, et
   * la version 1.1.0 l'annonçait corrigé alors qu'il ne l'était qu'à moitié —
   * sur l'accueil, pas sur l'onglet où ils vont.
   *
   * L'essai était vert, le défaut était là. Une garde qui ne regarde pas la
   * bonne branche ne garde rien.
   */
  it('et la plage passe AVANT le solde vide, parce qu’un solde vide ne coûte rien pendant une plage', () => {
    const plage = ecran.indexOf(') : plageOuverte ? (');
    const soldeVide = ecran.indexOf(') : balance.minutes <= 0 ? (');
    expect(plage).toBeGreaterThan(0);
    expect(soldeVide).toBeGreaterThan(0);
    expect(plage).toBeLessThan(soldeVide);
  });

  it('et le dit aussi grand qu’ailleurs', () => {
    /**
     * **Découper la branche, et non 900 caractères.** Cet essai prenait une
     * tranche de longueur fixe après le marqueur : ajouter un commentaire dans
     * la branche suffisait à repousser la carte hors de la fenêtre, et l'essai
     * tombait sans qu'aucun comportement ait changé. C'est arrivé le
     * 16 septembre, en documentant précisément pourquoi l'ordre des branches
     * compte.
     *
     * Un essai qui casse pour la mauvaise raison finit désactivé, puis oublié.
     * On lit maintenant jusqu'au début de la branche suivante.
     */
    const debut = ecran.indexOf(') : plageOuverte ? (');
    expect(debut).toBeGreaterThan(0);
    const suite = ecran.indexOf(') : ', debut + 10);
    const carte = suite > debut ? ecran.slice(debut, suite) : ecran.slice(debut);
    expect(carte).toMatch(/variant="hero"/);
    expect(carte).toMatch(/colors\.mintInk/);
    expect(carte).toMatch(/expression="delighted"/);
  });
});

describe('le battement d’horloge', () => {
  it('vit dans les sélecteurs, et sert aux deux écrans', () => {
    // Il était né dans l'écran du parent. L'écran de l'enfant en avait autant
    // besoin — et c'est celui-là qui l'a montré.
    expect(lire('src/store/selectors.ts')).toMatch(/export function useMinuteCourante/);
    expect(lire('src/features/parent/PlagesEnCours.tsx')).toMatch(/useMinuteCourante/);
    expect(lire('app/child/(tabs)/index.tsx')).toMatch(/useMinuteCourante/);
  });

  it('n’est plus recopié dans l’écran du parent', () => {
    const parent = lire('src/features/parent/PlagesEnCours.tsx');
    expect(parent).not.toMatch(/function useMinuteCourante/);
    expect(parent).not.toMatch(/setInterval/);
  });
});


/**
 * Le bouclier doit se lever À L'HEURE, pas au prochain geste.
 *
 * `appliquerPlageLibre()` n'était appelé qu'au démarrage et au retour de
 * l'application au premier plan. Or le cas le plus fréquent d'un mercredi est
 * l'inverse : l'enfant est déjà dans Mino à 13 h 58 et attend 14 h. Le
 * battement de minute faisait apparaître « 🎉 C'est ouvert ! » — et rien
 * d'autre. Il sortait vers YouTube, se faisait bloquer, revenait dans Mino (ce
 * qui déclenchait enfin la levée), ressortait, et ça marchait.
 *
 * Mino lui avait menti pendant une minute, sur la seule chose qu'il attendait.
 */
describe('le bouclier à l’heure pile', () => {
  const layout = lire('app/child/_layout.tsx');

  it('l’écran de l’enfant suit la plage à la minute', () => {
    expect(layout).toMatch(/useMinuteCourante\(\)/);
    expect(layout).toMatch(/openWindowAt\(fenetres \?\? \[\], activeChildId/);
  });

  it('et applique dès qu’elle change, ouverture comme fermeture', () => {
    expect(layout).toMatch(/appliquer\(\)/);
    // La mémoire de ce qui a déjà été appliqué : sans elle, l'effet
    // rappellerait le service à chaque battement, soit deux fois par minute
    // pour rien.
    expect(layout).toMatch(/derniere\.current === cle/);
  });
});
