import { UsageAppareil } from './notifications';

/**
 * Où un appui sur une notification a le droit de déposer quelqu'un.
 *
 * **Deux valeurs, et pas une de plus.** L'accueil parent EST l'endroit où l'on
 * confirme : `RequestCard` n'est rendue que sur `app/parent/(tabs)/index.tsx`,
 * dans « En attente de vous ». L'onglet Missions est un catalogue d'édition, et
 * `app/parent/mission/[id].tsx` un formulaire de réglages : y déposer un parent
 * qui vient de toucher « Raphaël a terminé une mission » lui montrerait tout
 * sauf le bouton qu'il cherche.
 *
 * Les routes d'enfant en sont absentes, et pas par oubli : `app/child/_layout`
 * renvoie sur `/who` quand aucun profil n'est ouvert, et `who.tsx` referme
 * l'espace parent puis appelle `selectChild(null)`. Y envoyer un enfant
 * l'arracherait à son profil pour une notification qui le concerne.
 */
export type DestinationDAppui = '/parent' | '/parent/abonnement';

/**
 * La table qui décide — et la raison d'être de ce fichier.
 *
 * **`route` arrive du RÉSEAU.** La fonction `notify` ne valide que le public,
 * le titre et le corps ; la route, elle, est recopiée telle quelle, et
 * l'appelant accepté inclut la session d'une tablette d'enfant. On ne la suit
 * donc pas : on la CHERCHE ici, et ce qui part au routeur est la constante
 * écrite dans l'application.
 *
 * Ce que cela ferme, concrètement, et ce n'est pas théorique :
 *
 *   • `/who?ouvrir=<identifiant du frère>` — `app/who.tsx` honore `ouvrir` au
 *     montage : `selectChild(ouvrir)` puis `replace('/child')`, SANS passer par
 *     `ouvertureDeProfil`, qui est le garde et qui ne vit que dans `openChild`.
 *     Sur la tablette réservée à Manon, ce serait le profil de son frère, et
 *     ses minutes, sans le code.
 *   • `/onboarding/appareil` — il n'y a aucun `_layout.tsx` sous `onboarding`,
 *     donc aucun garde ; y répondre « c'est mon téléphone à moi » supprime le
 *     reverrouillage en arrière-plan.
 *   • `https://…`, `//hôte`, `mino://…` — expo-router les sort de
 *     l'application par `Linking.openURL`.
 *
 * Une `Map` et non un objet : une clé `constructor` ou `__proto__` venue du
 * réseau ne doit pas rendre quelque chose par la chaîne de prototypes.
 *
 * Correspondance EXACTE, chaîne de requête comprise. Une comparaison de
 * préfixe laisserait passer `/parent-pin?ensuite=/who&ouvrir=…`, qui commence
 * bien par « /parent » : le code que le parent tape en croyant valider une
 * mission ouvrirait le profil d'un autre enfant.
 */
const DESTINATIONS = new Map<string, DestinationDAppui>([
  ['/parent', '/parent'],
  ['/parent/abonnement', '/parent/abonnement'],
]);

export interface AppuiRecu {
  /** `content.data`, tel que le paquet le rend : facultatif, et `unknown`. */
  data: unknown;
  /** Le corps de la notification, ou un bouton d'action. */
  actionIdentifier: string;
  /** `Notifications.DEFAULT_ACTION_IDENTIFIER`, passé pour rester testable. */
  actionParDefaut: string;
  /** Ce que le parent a répondu à « à qui est cet appareil ? ». */
  usage: UsageAppareil;
}

/**
 * Où va cet appui — ou nulle part, ce qui est le comportement d'aujourd'hui.
 *
 * `null` n'est pas une erreur : c'est « ouvre l'application, et rien de plus ».
 *
 * **Aucun chemin de ce fichier ne lit `childId`.** S'en servir pour choisir un
 * profil laisserait une notification décider quel enfant s'ouvre, en
 * contournant `ouvertureDeProfil` — la faute déjà réparée ailleurs, refaite
 * par une porte neuve.
 */
export function destinationDeLAppui(appui: AppuiRecu): DestinationDAppui | null {
  /**
   * Le corps de la notification, pas un bouton d'action.
   *
   * Mino n'enregistre aucune catégorie aujourd'hui, donc le cas ne se produit
   * pas encore. Mais « Confirmer » / « Refuser » depuis la notification est la
   * suite naturelle de ce qu'on branche ici, et sans cette ligne « Refuser »
   * emmènerait AUSSI dans la demande — le contraire de ce que le parent vient
   * de décider.
   */
  if (appui.actionIdentifier !== appui.actionParDefaut) return null;

  // `data` est facultatif, et il est reconstruit par une analyse JSON côté
  // JavaScript : quand elle échoue, le paquet rend le contenu SANS `data` du
  // tout. Une charge illisible ne doit rien casser.
  if (typeof appui.data !== 'object' || appui.data === null) return null;

  const route = (appui.data as Record<string, unknown>).route;
  // Le serveur envoie explicitement `null` quand il n'y a pas de route :
  // c'est une valeur réellement présente sur le fil, pas une absence.
  if (typeof route !== 'string') return null;

  const destination = DESTINATIONS.get(route);
  if (!destination) return null;

  /**
   * La seconde serrure, locale et fraîche.
   *
   * Le serveur applique déjà la règle — `recoitLesNotificationsParent` : un
   * appareil réservé à un enfant ne reçoit jamais d'annonce de parent. Mais
   * elle s'appuie sur ce que la table des jetons sait, qui peut être périmé ou
   * absent d'une version pas à jour ; et le chemin LOCAL ne la consulte pas du
   * tout, puisqu'il programme la notification sur l'appareil qui vient d'agir.
   *
   * `partage` passe, et c'est voulu : le serveur écrit délibérément à la
   * tablette du salon quand la famille n'a pas de téléphone de parent — la
   * couper laisserait ces familles sans nouvelles. L'enfant qui toucherait
   * atterrit alors sur l'écran du code, qu'il a déjà à une touche depuis son
   * onglet profil. C'est la serrure qui fonctionne, pas une porte.
   */
  if (appui.usage === 'enfant') return null;

  return destination;
}
