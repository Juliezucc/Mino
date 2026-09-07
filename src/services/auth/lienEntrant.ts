import * as Linking from 'expo-linking';

/**
 * Le dernier lien reçu par l'application, retenu dès le chargement.
 *
 * **Le défaut qu'il répare, et pourquoi il ne se voyait que sur un téléphone.**
 * Les écrans `confirme` et `mot-de-passe` lisaient le lien avec
 * `Linking.useURL()`. Ce crochet ne peut rendre que deux choses : l'adresse qui
 * a **lancé** l'application, et celles qui arrivent **après** qu'il s'est
 * abonné. Or dans le cas le plus courant — Mino est déjà ouvert, le parent
 * touche le lien dans son courriel — l'adresse arrive, la navigation l'emmène
 * sur `/confirme`, et l'écran ne s'abonne qu'ensuite : l'événement est déjà
 * passé. `getInitialURL()` rend alors l'adresse de lancement, qui dans une
 * build de développement est celle du serveur, sans jeton.
 *
 * Résultat : `url` restait `null`, l'effet ne partait jamais, et le parent
 * lisait « Un instant, nous ouvrons votre espace parent… » indéfiniment. Aucune
 * erreur, aucun journal — l'écran attendait quelque chose qui ne viendrait pas.
 *
 * Sur le web, rien de tout cela : l'adresse est dans la barre du navigateur, et
 * elle y reste. C'est pourquoi le parcours passait à l'essai et échouait à
 * l'usage.
 *
 * **Pourquoi au niveau du module et pas dans un composant.** L'abonnement se
 * fait ici, à l'import — c'est-à-dire au chargement du paquet JavaScript, avant
 * que le moindre écran ne soit monté. C'est la seule position d'où l'on ne peut
 * pas rater l'événement. Le fichier est importé par `app/_layout.tsx` pour cette
 * raison, et pour aucune autre.
 */

let dernier: string | null = null;

Linking.addEventListener('url', ({ url }) => {
  dernier = url;
});

// L'application a peut-être été lancée PAR le lien : dans ce cas l'événement
// est parti avant que le JavaScript n'existe, et seule l'adresse de lancement
// en garde la trace. On ne l'écrase jamais par-dessus un lien déjà reçu, qui
// est forcément plus récent.
Linking.getInitialURL()
  .then((url) => {
    if (url && !dernier) dernier = url;
  })
  .catch(() => undefined);

/** Le dernier lien reçu, quel qu'en soit le moment. */
export function dernierLien(): string | null {
  return dernier;
}

/**
 * À appeler une fois le lien consommé.
 *
 * Sans cela, revenir sur l'écran de confirmation rejouerait un lien déjà usé et
 * afficherait « ce lien a expiré » à quelqu'un qui n'a rien demandé.
 */
export function oublierLien(): void {
  dernier = null;
}
