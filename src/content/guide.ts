import { ScreenKey } from './guideScreens';

import { MINUTES_PER_CAPSULE } from '@/domain/ledger';
import { REFERRAL, TRIAL_DAYS } from '@/domain/billing';

/**
 * The guide.
 *
 * Not a reference manual — a walkthrough. A parent who has just installed Mino
 * has one question, "what do I do now?", and answers it best by following
 * numbered steps with a picture of the screen they are looking at. The first
 * chapter is setting up the child's device, because that is the wall everyone
 * hits first and the one that makes people give up.
 *
 * Screenshots come from `guideScreens`, generated from the real app.
 */

export interface GuideStep {
  title: string;
  body: string[];
  /** Where this happens, when it is not obvious. */
  where?: string;
  screen?: ScreenKey;
  /** The thing experience says people get wrong here. */
  tip?: string;
  /** Happens outside Mino — in the system settings, a store, real life. */
  outside?: boolean;
}

export interface GuideChapter {
  id: string;
  title: string;
  icon: string;
  summary: string;
  duration: string;
  steps: GuideStep[];
}

export const GUIDE: GuideChapter[] = [
  {
    id: 'installer',
    title: 'Configurer sur l’appareil de mon enfant',
    icon: '📲',
    summary: 'Installer Mino chez vous, puis sur l’appareil de votre enfant.',
    duration: '10 minutes',
    steps: [
      {
        title: 'Commencez par votre téléphone',
        body: [
          'Installez Mino sur votre propre appareil et créez le compte parent. C’est lui qui détient la famille : l’enfant n’aura jamais de compte à lui, ni d’adresse e-mail à donner.',
        ],
        screen: 'accueil',
      },
      {
        title: 'Ajoutez un profil par enfant',
        body: [
          'Espace parent → Enfants → Ajouter un enfant. Un prénom, un âge, un personnage. C’est tout ce que Mino en sait, et c’est volontaire.',
          'L’âge sert à deux choses. Il filtre les missions proposées — on ne suggère pas « passer l’aspirateur » à un enfant de 5 ans — et il décide du registre de l’application.',
          'Jusqu’à 12 ans, Mino parle en minos, félicite, et affiche de très gros boutons. À partir de 13 ans il passe en version ado : des minutes, un ton sobre, pas de confettis, et des missions qui ont du sens à cet âge — réviser, gérer son linge, une heure sans téléphone.',
        ],
        where: 'Espace parent → Enfants',
        screen: 'parentEnfants',
      },
      {
        title: 'Choisissez un code parent que votre enfant ne devinera pas',
        body: [
          'Ce code à 4 chiffres protège l’espace parent. C’est lui qui empêche votre enfant de confirmer ses propres missions.',
        ],
        tip: 'Évitez sa date de naissance, celle de son frère ou de sa sœur, et 1234. Un enfant de 8 ans essaie ces trois-là en premier.',
      },
      {
        title: 'Installez Mino sur l’appareil de l’enfant',
        body: [
          'Sur l’appareil de l’enfant, téléchargez Mino depuis l’App Store ou le Play Store. Ne vous connectez pas avec votre compte : il n’y en a pas besoin.',
          'Si l’appareil est partagé entre plusieurs enfants, une seule installation suffit — chacun choisira son profil au lancement.',
        ],
        outside: true,
      },
      {
        title: 'Reliez l’appareil à votre famille',
        body: [
          'Sur l’appareil de l’enfant, à l’ouverture de Mino, touchez « J’ai un code famille » et saisissez le code. C’est tout ce qui est demandé : votre enfant n’a ni compte, ni mot de passe, ni adresse e-mail à donner.',
          'Vous trouvez le code dans Réglages, sur votre propre téléphone. Il ressemble à MINO-6BVJK4.',
        ],
        where: 'Espace parent → Réglages → Code famille',
        screen: 'rejoindre',
        tip: 'Ce code est la seule chose qui protège l’accès à votre famille : ne le publiez nulle part. Il est distinct de votre code de parrainage, qui lui se partage sans risque.',
      },
      {
        title: 'Dites de qui est l’appareil',
        body: [
          'Mino demande à quel enfant appartient cet appareil, ou s’il est partagé. Un profil se choisit d’une touche : aucun mot de passe, aucune adresse e-mail pour l’enfant. À cet âge, tout ce qui se tape est un obstacle.',
          'Sur un appareil partagé, chacun retrouve son profil à l’ouverture.',
        ],
        screen: 'qui',
      },
      {
        title: 'Reprenez le téléphone pour la dernière étape',
        body: [
          'Mino demande alors de passer l’appareil à un adulte : c’est vous qui autorisez le verrouillage des applications, et personne d’autre. C’est à faire une seule fois.',
          'C’est le système lui-même qui vérifie qu’un adulte est bien là : iOS et Android demandent votre compte ou votre code parental à ce moment précis. C’est aussi pour cela que Mino n’a pas besoin de le demander plus tôt.',
          'Si vous préférez le faire plus tard, l’étape se retrouve à tout moment dans Réglages → Blocage des applications.',
        ],
        where: 'Sur l’appareil de l’enfant',
      },
      {
        title: 'Vérifiez que l’espace parent est bien protégé',
        body: [
          'Depuis l’appareil de l’enfant, essayez d’entrer dans « Espace parent ». Le code doit vous être demandé.',
          'Vérifiez aussi que le bon profil s’affiche : le compteur et les missions doivent être ceux de l’enfant qui utilise cet appareil.',
        ],
        screen: 'enfantAccueil',
        tip: 'Quoi qu’il arrive, l’appareil d’un enfant ne peut techniquement pas confirmer une mission ni s’ajouter du temps : la base de données le lui refuse.',
      },
    ],
  },

  {
    id: 'missions',
    title: 'Créer les premières missions',
    icon: '📋',
    summary: 'Partir d’une routine toute faite plutôt que d’une page blanche.',
    duration: '5 minutes',
    steps: [
      {
        title: 'Ouvrez les routines',
        body: [
          'Espace parent → Missions. Les routines répondent à la vraie question — à quoi doit ressembler le soir chez nous ? — plutôt qu’à « quelle mission créer ».',
          'Elles s’adaptent : « Vivre ensemble » n’apparaît que dans les familles de plusieurs enfants.',
        ],
        where: 'Espace parent → Missions',
        screen: 'parentMissions',
      },
      {
        title: 'Choisissez un thème, désignez l’enfant',
        body: [
          'Touchez une routine, sélectionnez l’enfant concerné, et décochez ce qui ne vous ressemble pas. Le reste est créé d’un coup, avec la bonne récurrence : le matin les jours d’école, le coucher tous les jours.',
          'Quand vous choisissez un seul enfant, les missions entre frères et sœurs prennent leur prénom : « Dire un mot gentil à Elliott ».',
        ],
        screen: 'parentRoutine',
        tip: 'Commencez par trois à cinq missions par enfant. Une liste trop longue décourage, et l’enfant finit par ne plus la regarder.',
      },
      {
        title: 'Lisez les consignes de sécurité',
        body: [
          'Les missions qui touchent à la cuisine, aux appareils ou aux produits d’entretien portent un encadré ⚠️ avant que vous ne les acceptiez : « sans objet tranchant ni cuisson », « sans les couteaux », « produits ménagers manipulés par l’adulte ».',
          'Ce sont des repères, pas des règles absolues. C’est vous qui connaissez votre enfant, et c’est à vous de juger — et d’être là.',
        ],
        tip: 'Une mission proposée par une application n’est pas une mission approuvée d’avance pour votre enfant. L’enfant reste sous votre surveillance, toujours.',
      },
      {
        title: 'Ou créez la vôtre',
        body: [
          'Missions → Créer une mission. Un nom, une icône, le temps gagné, l’enfant, la récurrence. Les suggestions du haut sont filtrées sur l’âge de l’enfant sélectionné.',
        ],
        screen: 'parentNouvelleMission',
      },
    ],
  },

  {
    id: 'quotidien',
    title: 'La journée type',
    icon: '🔁',
    summary: 'Ce qui se passe entre la chambre rangée et la télé allumée.',
    duration: '3 minutes',
    steps: [
      {
        title: 'L’enfant voit ce qui lui reste à faire',
        body: [
          'Sa liste ne montre que les missions en cours. Les missions déjà accomplies disparaissent : à cet âge, une colonne de coches grises enterre la réponse à la seule question qui compte — qu’est-ce que je fais maintenant ?',
        ],
        screen: 'enfantMissions',
      },
      {
        title: 'L’enfant appuie sur « J’ai terminé »',
        body: [
          'Un seul bouton, vert, impossible à rater. La mission passe en attente et vous recevez la demande.',
        ],
        screen: 'enfantMission',
      },
      {
        title: 'Vous confirmez, ou la mission repart',
        body: [
          'Les demandes apparaissent sur votre accueil. Vous n’approuvez pas la mission : vous confirmez qu’elle est faite. Appuyez sur « C’est fait », et les minutes arrivent instantanément sur son compteur.',
          'À la création d’une mission, vous choisissez si elle passe par vous ou si elle se compte toute seule. Se brosser les dents, faire son lit : vous le voyez de toute façon, et confirmer chaque matin finit par user votre attention — gardez-la pour ce qui la mérite. La confiance se donne mission par mission, et se retire de la même façon.',
          'Si ce n’est pas fait, appuyez sur « À refaire » : la mission repasse simplement en « à faire », sans pénalité. Expliquez-lui de vive voix — c’est plus efficace que n’importe quel message dans une application.',
        ],
        where: 'Espace parent → Accueil',
        screen: 'parentAccueil',
        tip: 'Validez vite. Un enfant de 6 ans qui attend son temps jusqu’au lendemain ne fait plus le lien entre l’effort et la récompense.',
      },
      {
        title: 'La récompense arrive tout de suite',
        body: [
          'Mino célèbre la mission, le compteur monte sous ses yeux. C’est le moment qui fait revenir l’enfant le lendemain — c’est pour ce moment-là que tout le reste existe.',
        ],
        screen: 'enfantCelebration',
      },
      {
        title: 'L’enfant choisit quand en profiter',
        body: [
          'Dans « Mon temps », l’enfant décide combien de minos utiliser et lance une session. Seul le temps réellement écoulé est décompté : une session arrêtée au bout de 10 minutes sur 20 en laisse 10 au compteur.',
        ],
        screen: 'enfantTemps',
      },
    ],
  },

  {
    id: 'blocage',
    // Aligné sur le site : le titre précédent, « Faire respecter le temps
    // gagné », promettait une contrainte que Mino n'exerce pas lui-même.
    title: 'Le temps d’écran sur son téléphone',
    icon: '🔒',
    summary: 'Mino compte le temps ; le système de l’appareil le fait respecter.',
    duration: '5 minutes',
    steps: [
      {
        title: 'Qui fait quoi',
        body: [
          'Mino, installé sur l’iPhone, l’iPad ou l’appareil Android de votre enfant, tient le compte du temps gagné — et pose lui-même le verrou sur les applications que vous choisissez.',
          'Le verrou se lève exactement le temps que votre enfant a gagné, puis revient tout seul. Il n’y a aucune limite quotidienne à estimer à l’avance, et aucun écart entre le temps mérité et le temps réellement disponible.',
          'Cela demande une autorisation du système, à accorder une seule fois sur l’appareil de l’enfant. C’est la seule étape que personne ne peut faire à votre place.',
        ],
        where: 'Espace parent → Réglages → Blocage des applications',
        tip: 'Sans cette autorisation, Mino compte le temps mais n’empêche rien : votre enfant peut ouvrir YouTube sans passer par lui.',
      },
      {
        title: 'Choisir les applications',
        body: [
          'Le système ouvre sa propre liste et vous cochez ce qui doit être verrouillé. Mino, lui, reste toujours ouvert : le système protège l’application qui détient l’autorisation, et il ne se laisse pas enfermer dehors. Votre enfant pourra donc toujours voir ses missions et lancer son temps.',
          'Le reste est verrouillé si vous le cochez, et seulement si vous le cochez. Laissez le téléphone et les messages en dehors de la liste : votre enfant doit pouvoir vous joindre à tout moment. Sur Android, Mino épargne de lui-même le composeur d’appels ; sur iPhone, il ne peut pas le reconnaître — le système ne nous donne que des jetons anonymes — et c’est donc à vous de ne pas le cocher.',
          'Le système ne nous dira jamais lesquelles vous avez cochées, seulement combien. Mino ne peut donc pas savoir ce que votre enfant utilise.',
        ],
        where: 'Espace parent → Réglages → Blocage des applications',
        tip: 'Les appels d’urgence, eux, passent toujours : ni iOS ni Android ne les laissent bloquer par une application.',
      },
      {
        title: 'Ouvrir l’écran sans rien faire dépenser',
        body: [
          'Le mercredi après-midi, les vacances, le trajet du dimanche : déclarez une plage libre et les applications se débloquent toutes seules pendant ce créneau, sans que votre enfant dépense une minute.',
          'Il n’a rien à lancer, et Mino refuse de lui prendre du temps pour un écran déjà ouvert. À la fin de la plage, le verrou revient — même si l’application a été fermée entre-temps.',
        ],
        where: 'Espace parent → Réglages → Plages libres',
        tip: 'La plage s’applique quand votre enfant ouvre Mino. S’il ne l’a pas rouvert depuis le début du créneau, une seule ouverture suffit.',
      },
      {
        title: 'Si votre appareil ne le permet pas',
        body: [
          'Sur le web, ou sur une version sans le module de blocage, Mino compte le temps sans rien verrouiller — et il le dit plutôt que de le laisser croire.',
          'Dans ce cas, posez la limite dans le contrôle parental du système : sur iPhone, Réglages → Temps d’écran → Limites d’app, avec un code différent de celui qui déverrouille l’appareil. Sur Android, Family Link, ou Bien-être numérique directement sur l’appareil.',
          'Excluez Mino de la limite, pour qu’il puisse toujours ouvrir ses missions.',
        ],
        outside: true,
      },
    ],
  },

  {
    id: 'console',
    title: 'Console, télé, ordinateur',
    icon: '🎮',
    summary: 'Échanger du temps gagné contre une Switch ou la télévision.',
    duration: '2 minutes',
    steps: [
      {
        title: 'Un seul écran est automatique',
        body: [
          'Celui où Mino est installé. Là, votre enfant lance son temps sans passer par vous et le minuteur démarre aussitôt — c’est le fonctionnement normal, celui de son appareil.',
          'Une Nintendo Switch, une PlayStation, une télévision ou l’ordinateur familial n’ouvrent leur temps de jeu à aucune application extérieure. Il n’existe aucun moyen, pour Mino, de démarrer ou d’arrêter une console. Plutôt que d’ignorer ces écrans — souvent les seuls chez les plus jeunes — Mino en fait un échange encadré.',
        ],
      },
      {
        title: 'Déclarez vos appareils',
        body: [
          'Réglages → Appareils de la maison. Une console, une télé, un ordinateur : ajoutez-les en un geste depuis les suggestions, ou nommez les vôtres — « Switch de la chambre », « Télé du salon ».',
          'Tant que vous n’avez rien déclaré, le temps gagné ne peut être utilisé que sur l’appareil où Mino est installé.',
        ],
        where: 'Espace parent → Réglages → Appareils de la maison',
        screen: 'parentAppareils',
        tip: 'Tous les appareils déclarés passent par vous, sans exception. C’est justement pour cela qu’ils sont déclarés : aucune surprise possible.',
      },
      {
        title: 'L’enfant demande',
        body: [
          'Dans « Mon temps », l’enfant choisit l’écran parmi ceux que vous avez déclarés, puis la durée, et appuie sur « Demander à mon parent ».',
          'Rien n’est décompté à ce moment-là. Une demande sans réponse ne coûte rien.',
        ],
        screen: 'enfantTemps',
      },
      {
        title: 'Vous lancez le minuteur',
        body: [
          'La demande arrive sur votre accueil, à côté des missions à confirmer. Vous lancez, ou vous répondez « Pas maintenant ».',
          'Le décompte démarre au moment où vous lancez, pas au moment où l’enfant a demandé : une demande vue une demi-heure plus tard ne lui coûte pas une demi-heure.',
        ],
        where: 'Espace parent → Accueil',
        screen: 'parentAccueil',
      },
      {
        title: 'Tout le monde voit le même chrono',
        body: [
          'Pendant la session, le temps restant s’affiche sur votre écran comme sur le sien, sous « Écrans en cours ». Quand c’est fini, vous clôturez — et seul le temps réellement écoulé est décompté.',
          'C’est là tout l’intérêt : « tu avais vingt minutes » cesse d’être une discussion sur la mémoire de chacun.',
        ],
        tip: 'La console reste sous votre contrôle : Mino tient le compte et vous prévient, il n’éteint rien tout seul.',
      },
      {
        title: 'Et si vous voulez confirmer même sur son téléphone',
        body: [
          'Par défaut, sur l’appareil où Mino est installé, votre enfant démarre son temps sans vous : le compteur lui appartient, et le temps gagné s’utilise librement.',
          'Si vous préférez que chaque session passe par vous, ouvrez sa fiche dans Enfants et choisissez « En me demandant d’abord ». Toutes ses sessions attendront alors votre accord, sur tous les écrans.',
        ],
        where: 'Espace parent → Enfants → l’enfant',
      },
    ],
  },

  {
    id: 'doser',
    title: 'Bien doser les minos',
    icon: '⚖️',
    summary: 'Combien vaut une mission, et quoi faire quand le compteur s’emballe.',
    duration: '3 minutes',
    steps: [
      {
        title: 'Les minos, c’est des minutes',
        body: [
          'Jusqu’à 12 ans, votre enfant ne voit pas « minutes » mais « minos ». C’est le même chiffre : un mino vaut exactement une minute de temps d’écran, toujours. À partir de 13 ans, Mino affiche des minutes — à cet âge, un mot inventé passe pour de l’infantilisation.',
          'Ce n’est pas une monnaie. Les minos ne s’achètent pas, ne se vendent pas, et ne servent à rien d’autre qu’au temps qu’ils désignent.',
          `Les plus jeunes, qui ne lisent pas encore les chiffres, comptent les capsules : une capsule vaut ${MINUTES_PER_CAPSULE} minos.`,
        ],
        screen: 'enfantTemps',
      },
      {
        title: 'Un repère pour fixer les valeurs',
        body: [
          'Un geste rapide — faire son lit, mettre son linge au panier : 5 minos.',
          'Une vraie tâche — ranger sa chambre, débarrasser la table : 10 à 15 minos.',
          'Un effort long — les devoirs, aider en cuisine : 20 minos.',
        ],
        tip: 'Le total d’une journée doit correspondre à ce que vous accepteriez de toute façon. Additionnez vos missions avant d’arrêter la liste.',
      },
      {
        title: 'Si le compteur monte trop vite',
        body: [
          'Baissez les valeurs des missions, ou retirez-en. Ne renvoyez pas « à refaire » une mission réellement accomplie pour freiner le compteur : c’est la façon la plus rapide de casser la confiance dans le système, et cette confiance-là ne revient pas.',
        ],
        where: 'Espace parent → Missions',
      },
      {
        title: 'En cas d’erreur',
        body: [
          'Vous avez confirmé trop vite ? Ajustez le compteur depuis la fiche de l’enfant. L’opération apparaît dans son historique : rien n’est effacé, tout se lit.',
        ],
        where: 'Espace parent → Enfants → l’enfant',
      },
    ],
  },

  {
    id: 'parents',
    title: 'L’autre parent',
    icon: '👨‍👩‍👧',
    summary: 'Le mettre sur son propre téléphone, sans partager de mot de passe.',
    duration: '3 minutes',
    steps: [
      {
        title: 'Ajoutez-le depuis chez vous',
        body: [
          'Réglages → Les parents → son prénom. C’est tout ce qu’il faut : il n’a ni adresse à donner, ni mot de passe à retenir.',
          'Vous pouvez aussi sauter cette étape : sur son téléphone, il pourra s’ajouter lui-même.',
        ],
        where: 'Espace parent → Réglages → Les parents',
        screen: 'parentReglages',
      },
      {
        title: 'Sur son téléphone',
        body: [
          'Il installe Mino, saisit le code famille, puis choisit « C’est le téléphone d’un parent » et se sélectionne dans la liste.',
          'Il lui faut ensuite le code à quatre chiffres — celui qui ouvre l’espace parent. C’est la seule preuve qu’un adulte est là : sans elle, n’importe quel enfant de la maison pourrait déclarer sa tablette « téléphone d’un parent », puisque le code famille, lui, il le connaît.',
        ],
        screen: 'rejoindre',
        tip: 'Le code à quatre chiffres n’est pas le code famille. Ne les confondez pas : le premier ouvre l’espace parent, le second sert seulement à rattacher un appareil.',
      },
      {
        title: 'Ce qu’il peut faire, et ce qui reste à vous',
        body: [
          'Il voit les mêmes enfants, crée des missions, pose des plages libres, offre des minutes et confirme, exactement comme vous.',
          'L’adresse du compte, le mot de passe, l’abonnement et la suppression de la famille restent à celui qui l’a créée. Ce n’est pas une question de confiance : ces gestes-là demandent de pouvoir revenir depuis n’importe quel téléphone, et son profil à lui vit dans l’application installée sur le sien.',
        ],
      },
      {
        title: 'S’il change de téléphone',
        body: [
          'Même chemin sur le nouvel appareil : code famille, « C’est le téléphone d’un parent », son prénom, le code à quatre chiffres.',
          'L’ancien appareil cesse aussitôt d’ouvrir l’espace parent. C’est voulu — c’est ce qu’on attend d’un téléphone perdu ou revendu.',
        ],
        tip: 'Pour retirer un parent : Réglages → Les parents → Retirer. C’est aussi la façon de révoquer un appareil ; changer le code à quatre chiffres ne suffit pas.',
      },
    ],
  },

  {
    id: 'compte',
    title: 'Abonnement et parrainage',
    icon: '🎁',
    summary: 'Essai, résiliation, et comment gagner des mois.',
    duration: '2 minutes',
    steps: [
      {
        title: 'L’essai, puis l’abonnement',
        body: [
          `Chaque compte démarre avec ${TRIAL_DAYS} jours d’essai, accès complet, rien de prélevé. La date du premier paiement est affichée en clair.`,
          'Un seul abonnement couvre toute la famille, quel que soit le nombre d’enfants et d’appareils.',
        ],
        where: 'Espace parent → Réglages → Abonnement',
        screen: 'parentAbonnement',
      },
      {
        title: 'Résilier',
        body: [
          'Réglages → Abonnement → Résilier. Deux touches, aucune justification à donner, aucun appel à passer.',
          'Vous gardez l’accès jusqu’à la fin de la période déjà payée, et rien n’est prélevé ensuite. Vos données sont conservées si vous revenez.',
        ],
      },
      {
        title: 'Parrainer',
        body: [
          `Partagez votre code : la famille que vous invitez démarre avec ses ${TRIAL_DAYS} jours d’essai, comme tout le monde.`,
          `Dès qu’elle devient abonnée, vous recevez ${REFERRAL.referrerFreeMonths} mois offert, déduit de votre facture suivante. Jusqu’à ${REFERRAL.maxFreeMonthsPerYear} mois par an.`,
        ],
        where: 'Espace parent → Réglages → Parrainage',
        screen: 'parentParrainage',
      },
    ],
  },
];

export function chapterById(id: string): GuideChapter | undefined {
  return GUIDE.find((chapter) => chapter.id === id);
}
