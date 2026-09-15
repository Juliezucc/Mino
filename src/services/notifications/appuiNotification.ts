import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { DestinationDAppui, destinationDeLAppui } from '@/domain/aiguillageNotification';
import { UsageAppareil, usageDeLAppareil } from '@/domain/notifications';
import { useMinoStore } from '@/store/useMinoStore';

import { getNotificationService } from './index';

/**
 * ---------------------------------------- ce qui manquait : LIRE l'appui
 *
 * Julie, après une soirée d'usage : « quand on clique sur une notification, ça
 * ouvre juste l'app. Quand un parent reçoit une mission qu'il doit valider, je
 * trouverais ça bien que ça l'amène dans la mission en question. »
 *
 * La route était écrite depuis toujours — `NotificationPayload.route`, « Where
 * tapping it should land » — et transmise par le serveur. Personne ne la
 * lisait. Le champ faisait tout le voyage pour être jeté à l'arrivée.
 *
 * **Pourquoi au niveau du module, comme `services/auth/lienEntrant.ts`.** Un
 * abonnement ne rend que ce qui arrive APRÈS lui. Quand Mino a été tué — le cas
 * le plus fréquent : le téléphone est dans la poche —, la réponse est rejouée
 * côté natif à la création du module, avant que le moindre composant React
 * n'existe, et l'événement part dans le vide : seul l'état retenu en garde la
 * trace. Un `useEffect` raterait donc exactement le cas qui compte. On lit le
 * cache À L'IMPORT, puis on s'abonne — l'ordre du crochet d'Expo lui-même.
 *
 * **Pourquoi pas `useLastNotificationResponse()`.** Il fait cette lecture dans
 * un `useLayoutEffect`, donc pendant le commit. Sur le web la lecture LÈVE (le
 * module d'émission n'y est qu'un bouchon), et l'exception remonterait dans
 * React : l'aperçu web tomberait sur son écran de secours. D'où la garde
 * `available` et le `try/catch`.
 *
 * **Pourquoi la navigation à froid ne part PAS d'ici.** `app/index.tsx` est
 * l'arbitre des destinations : hors ligne d'abord, pas de famille ensuite,
 * inscription inachevée après. Et son `<Redirect>` n'est pas un rendu, c'est un
 * `router.replace` posé dans un effet de focus, qui passe par la même file que
 * nos appels — deux ordres dans la même file, le dernier gagne, et le sien part
 * forcément puisqu'il reçoit le focus au montage. On dépose donc une intention,
 * et c'est lui qui la lit. Application déjà lancée, personne à doubler : on
 * navigue.
 */

/** L'appui déjà suivi, retenu sur le disque. Voir plus bas : le rejeu d'Android. */
const CLE_APPUI_CONSOMME = 'mino.notification.appuiConsomme';

let enAttente: Notifications.NotificationResponse | null = null;

function identifiantDe(reponse: Notifications.NotificationResponse): string {
  return reponse.notification.request.identifier;
}

/**
 * Peut-on décider maintenant ?
 *
 * Trois conditions, et la troisième est la plus facile à oublier : sans réseau,
 * le démarrage publie `data = null` et `offline = true`, et `/parent`
 * afficherait alors « Créer mon compte parent » — c'est-à-dire annoncer à un
 * parent que sa famille a disparu, le mensonge exact que l'écran hors ligne
 * existe pour éviter. On ferme le trou ICI plutôt que dans le fichier qui tient
 * la serrure : celui-là ne se touche pas un soir de fonctionnalité neuve.
 */
function pretADecider(): boolean {
  const etat = useMinoStore.getState();
  return etat.status === 'ready' && !!etat.data && !etat.offline;
}

function decider(
  reponse: Notifications.NotificationResponse,
  usage: UsageAppareil,
): DestinationDAppui | null {
  return destinationDeLAppui({
    data: reponse.notification.request.content.data,
    actionIdentifier: reponse.actionIdentifier,
    actionParDefaut: Notifications.DEFAULT_ACTION_IDENTIFIER,
    usage,
  });
}

function marquerConsomme(reponse: Notifications.NotificationResponse): void {
  void AsyncStorage.setItem(CLE_APPUI_CONSOMME, identifiantDe(reponse)).catch(() => undefined);
}

/**
 * La destination retenue au lancement, s'il y en a une. Ne consomme rien.
 *
 * `usage` est passé par l'appelant plutôt que lu ici : au moment où l'écran
 * d'entrée appelle, le démarrage a publié le profil de l'appareil EN MÊME TEMPS
 * que `status: 'ready'`, dans un seul `set`. Lire trop tôt rendrait « partagé »
 * par défaut — une garde qui passe au vert par ignorance.
 */
export function destinationEnAttente(usage: UsageAppareil): DestinationDAppui | null {
  if (!enAttente) return null;
  return decider(enAttente, usage);
}

/**
 * À appeler une fois l'intention traitée — suivie ou refusée.
 *
 * Même raison que pour le lien entrant : sans cela, un appui déjà usé
 * ressortirait au lancement suivant et déposerait quelqu'un devant le pavé de
 * code sans qu'il ait rien touché.
 */
export function oublierLAppui(): void {
  if (enAttente) marquerConsomme(enAttente);
  enAttente = null;
}

function recevoir(reponse: Notifications.NotificationResponse): void {
  // Pas encore prêt : on garde, et l'écran d'entrée décidera. Le plus récent
  // l'emporte — c'est le dernier geste de la personne qui compte.
  if (!pretADecider()) {
    enAttente = reponse;
    return;
  }

  const destination = decider(reponse, usageDeLAppareil(useMinoStore.getState().device));
  // Consommé qu'on navigue ou non : une charge qu'on refuse de suivre ne doit
  // pas être réexaminée au lancement suivant.
  enAttente = null;
  marquerConsomme(reponse);
  if (!destination) return;

  /**
   * `push`, jamais `replace`.
   *
   * Si l'espace parent est verrouillé, son layout renvoie sur l'écran du code,
   * dont la croix fait « revenir en arrière si possible, sinon aller au
   * sélecteur ». Un enfant arrivé sur `/child` y est venu par un `replace` :
   * sa pile n'a qu'un écran, il n'y a pas de retour possible, et la croix
   * l'enverrait donc sur le sélecteur — lequel referme l'espace parent et
   * désélectionne le profil ouvert. Arraché au sien pour une notification qui
   * ne le concerne pas. Avec `push`, l'écran d'où l'on vient reste dessous et
   * renoncer ne coûte rien.
   *
   * Et pas de boucle à craindre : `/` n'est jamais dans la pile, l'écran
   * d'entrée se remplace toujours lui-même.
   */
  router.push(destination);
}

if (getNotificationService().available) {
  try {
    // D'ABORD le cache natif : c'est la seule lecture qui voie l'appui ayant
    // LANCÉ l'application. La version synchrone, et non `…Async`, qui n'est
    // plus qu'une enveloppe dépréciée.
    enAttente = Notifications.getLastNotificationResponse();
    // La lecture ne vide pas le cache : il rend la même réponse autant de fois
    // qu'on l'appelle.
    Notifications.clearLastNotificationResponse();
  } catch {
    enAttente = null;
  }

  /**
   * Le rejeu d'Android, et pourquoi la mémoire ne suffit pas.
   *
   * Android relit les extras de l'activité à CHAQUE création, et la file des
   * réponses en attente n'est jamais vidée : reprendre la tâche depuis les
   * Récents rejoue donc l'appui dans un processus NEUF. Or une mémoire
   * JavaScript meurt exactement avec le processus qui provoque le rejeu. Il
   * faut du disque, ou le garde-fou ne garde rien.
   *
   * La lecture est asynchrone et le premier rendu, lui, est synchrone : la
   * course est assumée. Elle se gagne en pratique — cette lecture part à
   * l'import, et le démarrage en fait d'autres derrière, plus un aller-retour
   * réseau, avant que `status` ne passe à `ready`. Si elle se perdait, le
   * dommage se limite à retrouver le pavé de code sans l'avoir demandé.
   */
  if (enAttente) {
    const attendu = identifiantDe(enAttente);
    void AsyncStorage.getItem(CLE_APPUI_CONSOMME)
      .then((consomme) => {
        if (consomme === attendu) enAttente = null;
      })
      .catch(() => undefined);
  }

  try {
    Notifications.addNotificationResponseReceivedListener(recevoir);
  } catch {
    // Rien à faire : l'application s'ouvre comme avant.
  }
}
