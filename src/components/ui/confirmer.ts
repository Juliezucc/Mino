import { Alert, Platform } from 'react-native';

/**
 * Demander confirmation, sur un téléphone comme dans un navigateur.
 *
 * **Le défaut que cela répare, et il rendait l'application web à moitié
 * muette.** React Native Web n'implémente pas `Alert` : l'appel ne lève
 * aucune erreur, n'affiche rien, et le `onPress` du bouton de confirmation
 * n'est jamais atteint. Sur un téléphone, exactement le même code ouvre la
 * boîte attendue.
 *
 * Onze actions en dépendaient — se déconnecter, supprimer son compte,
 * supprimer un enfant, une mission, une plage libre, retirer un appareil,
 * résilier l'abonnement, réinitialiser. Sur `app.minoapp.fr`, toutes
 * répondaient de la même façon : rien. Pas de message d'erreur à signaler, pas
 * de trace dans la console, rien qu'un bouton qui ne fait rien — la panne la
 * plus décourageante qui soit pour qui la subit, et la plus difficile à
 * rapporter.
 *
 * `window.confirm` n'est pas joli. Il est natif, il fonctionne partout, il ne
 * demande aucun état, et il bloque le fil comme le fait la boîte du système.
 * Une belle boîte de dialogue maison serait un composant de plus à monter, à
 * placer, à fermer et à tester ; ce n'est pas ce qui manque à Mino aujourd'hui.
 *
 * Le style destructif ne se transmet pas au web — un navigateur ne colore pas
 * ses boutons. C'est la seule chose qu'on perd, et le texte porte déjà
 * l'avertissement.
 */
export function confirmer(input: {
  titre: string;
  message?: string;
  /** L'intitulé du bouton qui agit. « Supprimer », « Se déconnecter »… */
  action: string;
  /** L'intitulé du bouton qui n'agit pas. « Annuler » par défaut. */
  annuler?: string;
  destructif?: boolean;
}): Promise<boolean> {
  const annuler = input.annuler ?? 'Annuler';

  if (Platform.OS === 'web') {
    // `window` manque le temps d'un rendu hors navigateur. Refuser plutôt que
    // supposer : ces actions effacent des données.
    if (typeof window === 'undefined') return Promise.resolve(false);
    const texte = input.message ? `${input.titre}\n\n${input.message}` : input.titre;
    return Promise.resolve(window.confirm(texte));
  }

  return new Promise((repondre) => {
    Alert.alert(input.titre, input.message, [
      { text: annuler, style: 'cancel', onPress: () => repondre(false) },
      {
        text: input.action,
        style: input.destructif ? 'destructive' : 'default',
        onPress: () => repondre(true),
      },
    ]);
  });
}
