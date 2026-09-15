import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Empêcher le bouton retour d'Android de faire sortir d'un parcours.
 *
 * **Le défaut que cela répare, et il coûtait la famille entière.**
 * L'inscription enchaîne ses écrans en `replace` — c'est voulu, on ne revient
 * pas en arrière dans une inscription. Mais le bouton retour d'Android, lui,
 * ne demande la permission à personne : il dépile, et comme il ne restait que
 * l'accueil dans l'historique, le parent se retrouvait devant « Créer ma
 * famille » alors qu'il venait de la créer. Vu de sa place, il vient d'être
 * déconnecté.
 *
 * iOS n'a pas ce problème : il n'y a pas de bouton retour matériel, et le
 * balayage depuis le bord ne fonctionne que là où une pile existe.
 *
 * **Ce que ce blocage n'est pas.** Ce n'est pas une prison : les écrans qui
 * l'utilisent offrent tous une sortie explicite — « Continuer », « Plus tard »,
 * « Terminer ». On refuse le geste qui détruit, pas le droit de partir.
 *
 * `quoiFaire` permet d'en faire autre chose qu'un refus : rendre `true` dit à
 * Android qu'on s'en occupe, et l'écran peut alors reculer d'une étape pour de
 * bon plutôt que de tomber dans le vide.
 *
 * **Et il ne bloque QUE tant que l'écran est à l'écran.** `useEffect` gardait
 * le gestionnaire actif sous une page empilée par-dessus : le paywall de
 * l'inscription ouvre désormais l'écran de connexion — il fallait bien une
 * sortie pour le parent dont l'abonnement est rattaché à un autre compte —, et
 * le bouton retour d'Android y serait resté inerte, parce que le paywall,
 * invisible dessous, continuait de le refuser. On aurait déplacé l'impasse au
 * lieu de la fermer.
 *
 * `useFocusEffect` est la forme juste, et elle l'était déjà avant ce cas : un
 * écran qui n'est pas affiché n'a rien à dire du bouton retour.
 */
export function useRetourBloque(quoiFaire?: () => boolean): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const abonnement = BackHandler.addEventListener('hardwareBackPress', () =>
        // `true` = « c'est traité, ne dépile pas ». Sans valeur de retour vraie,
        // Android ferme l'écran, ce qui est exactement ce qu'on empêche.
        quoiFaire ? quoiFaire() : true,
      );

      return () => abonnement.remove();
    }, [quoiFaire]),
  );
}
