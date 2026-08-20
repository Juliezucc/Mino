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
        title: 'Ajoutez vos enfants',
        body: [
          'Espace parent → Enfants → Ajouter un enfant. Un prénom, un âge, un personnage. C’est tout ce que Mino sait d’eux, et c’est volontaire.',
          'L’âge sert à filtrer les missions proposées : on ne suggère pas « passer l’aspirateur » à un enfant de 5 ans.',
        ],
        where: 'Espace parent → Enfants',
        screen: 'parentEnfants',
      },
      {
        title: 'Choisissez un code parent que votre enfant ne devinera pas',
        body: [
          'Ce code à 4 chiffres protège l’espace parent. C’est lui qui empêche votre enfant de valider ses propres missions.',
        ],
        tip: 'Évitez sa date de naissance, celle de son frère ou de sa sœur, et 1234. Un enfant de 8 ans essaie ces trois-là en premier.',
      },
      {
        title: 'Installez Mino sur l’appareil de l’enfant',
        body: [
          'Sur sa tablette ou son téléphone, téléchargez Mino depuis l’App Store ou le Play Store. Ne vous connectez pas avec votre compte : il n’y en a pas besoin.',
          'Si l’appareil est partagé entre plusieurs enfants, une seule installation suffit — chacun choisira son profil au lancement.',
        ],
        outside: true,
      },
      {
        title: 'Reliez l’appareil à votre famille',
        body: [
          'Sur l’appareil de l’enfant, choisissez « Rejoindre une famille » et saisissez le code famille.',
          'Vous le trouvez dans Réglages, sur votre propre téléphone. Il ressemble à MINO-6BVJ.',
        ],
        where: 'Espace parent → Réglages → Code famille',
        screen: 'parentReglages',
        tip: 'Le code famille et le code de parrainage sont deux choses différentes. Le premier fait entrer un appareil chez vous, le second se partage sans risque.',
      },
      {
        title: 'Laissez l’enfant choisir son profil',
        body: [
          'L’appareil affiche « Qui utilise Mino ? ». Votre enfant touche son personnage, et il est chez lui. Aucun mot de passe, aucune adresse e-mail : à cet âge, tout ce qui se tape est un obstacle.',
          'S’ils sont plusieurs sur le même appareil, chacun retrouve son profil à cet écran.',
        ],
        screen: 'qui',
      },
      {
        title: 'Vérifiez que l’espace parent est bien protégé',
        body: [
          'Depuis l’appareil de l’enfant, essayez d’entrer dans « Espace parent ». Le code doit vous être demandé.',
          'Vérifiez aussi qu’il voit bien son compteur et ses missions à lui, et pas ceux de son frère ou de sa sœur.',
        ],
        screen: 'enfantAccueil',
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
    summary: 'Ce qui se passe entre le moment où il range sa chambre et celui où il allume la télé.',
    duration: '3 minutes',
    steps: [
      {
        title: 'L’enfant voit ce qui lui reste à faire',
        body: [
          'Sa liste ne montre que les missions en cours. Les missions déjà validées disparaissent : à cet âge, une colonne de coches grises enterre la réponse à la seule question qui compte — qu’est-ce que je fais maintenant ?',
        ],
        screen: 'enfantMissions',
      },
      {
        title: 'Il appuie sur « J’ai terminé »',
        body: [
          'Un seul bouton, vert, impossible à rater. La mission passe en attente et vous recevez la demande.',
        ],
        screen: 'enfantMission',
      },
      {
        title: 'Vous validez, ou vous refusez',
        body: [
          'Les demandes apparaissent sur votre accueil. Validez, et les minutes arrivent instantanément sur son compteur.',
          'Si ce n’est pas fait, refusez : la mission repasse simplement en « à faire », sans pénalité. Expliquez-lui de vive voix — c’est plus efficace que n’importe quel message dans une application.',
        ],
        where: 'Espace parent → Accueil',
        screen: 'parentAccueil',
        tip: 'Validez vite. Un enfant de 6 ans qui attend son temps jusqu’au lendemain ne fait plus le lien entre l’effort et la récompense.',
      },
      {
        title: 'Il voit sa récompense arriver',
        body: [
          'Mino le félicite, le compteur monte sous ses yeux. C’est le moment qui fait revenir l’enfant le lendemain — c’est pour lui que tout le reste existe.',
        ],
        screen: 'enfantCelebration',
      },
      {
        title: 'Il choisit quand en profiter',
        body: [
          'Dans « Mon temps », il décide combien de minos utiliser et lance une session. Seul le temps réellement écoulé est décompté : s’il arrête au bout de 10 minutes sur 20, les 10 autres lui restent.',
        ],
        screen: 'enfantTemps',
      },
    ],
  },

  {
    id: 'blocage',
    title: 'Faire respecter le temps gagné',
    icon: '🔒',
    summary: 'Mino compte le temps ; le système de l’appareil le fait respecter.',
    duration: '5 minutes',
    steps: [
      {
        title: 'Qui fait quoi',
        body: [
          'Mino, installé sur l’appareil de votre enfant, tient le compte des minos gagnés et les décompte pendant chaque session.',
          'Empêcher une application de s’ouvrir est en revanche un pouvoir que seuls iOS et Android accordent, et seulement à travers leur contrôle parental. Pour l’instant, c’est donc lui qui applique la limite que Mino a calculée.',
          'La bonne façon de le voir : Mino décide combien de temps est accordé et pourquoi, le système fait respecter ce total.',
        ],
        tip: 'Sans ce réglage, rien n’empêche votre enfant d’ouvrir YouTube sans passer par Mino. C’est cinq minutes, une seule fois, et tout tient ensuite.',
      },
      {
        title: 'Sur iPhone et iPad',
        body: [
          'Réglages → Temps d’écran → Limites d’app. Ajoutez une limite quotidienne sur les applications concernées, à la hauteur de ce que votre enfant peut raisonnablement gagner dans la journée.',
          'Activez ensuite « Utiliser un code pour le Temps d’écran », avec un code différent de celui qui déverrouille l’appareil — sinon votre enfant lèvera la limite lui-même.',
          'Excluez Mino de la limite, pour qu’il puisse toujours ouvrir ses missions.',
        ],
        outside: true,
      },
      {
        title: 'Sur Android',
        body: [
          'Application Family Link → votre enfant → Contrôles → Limites de temps par application.',
          'Family Link demande un compte Google pour l’enfant. Si vous préférez ne pas en créer, les mêmes limites existent directement sur l’appareil, dans Bien-être numérique et contrôle parental.',
        ],
        outside: true,
      },
      {
        title: 'Ce qui change bientôt',
        body: [
          'Ce réglage manuel est une étape, pas la destination. Mino est construit pour prendre la main lui-même : verrouiller les applications par défaut, et lever le verrou exactement le temps que votre enfant a gagné — plus de limite quotidienne à estimer à l’avance.',
          'Sur iPhone, cela passe par les autorisations de contrôle parental d’Apple, qui doivent nous être accordées ; sur Android, par les permissions équivalentes. Vous n’aurez rien à refaire : la configuration ci-dessus reste valable en attendant.',
        ],
      },
    ],
  },

  {
    id: 'doser',
    title: 'Bien doser les minos',
    icon: '⚖️',
    summary: 'Combien vaut une mission, et quoi faire quand il en gagne trop.',
    duration: '3 minutes',
    steps: [
      {
        title: 'Les minos, c’est des minutes',
        body: [
          'Votre enfant ne voit pas « minutes » mais « minos ». C’est le même chiffre : un mino vaut exactement une minute de temps d’écran, toujours.',
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
        tip: 'Le total d’une journée doit correspondre à ce que vous accepteriez de toute façon. Additionnez vos missions avant de valider la liste.',
      },
      {
        title: 'S’il en gagne trop',
        body: [
          'Baissez les valeurs des missions, ou retirez-en. Ne refusez pas une mission réellement accomplie pour freiner le compteur : c’est la façon la plus rapide de casser la confiance dans le système, et il n’y reviendra pas.',
        ],
        where: 'Espace parent → Missions',
      },
      {
        title: 'En cas d’erreur',
        body: [
          'Vous avez validé trop vite ? Ajustez le compteur depuis la fiche de l’enfant. L’opération apparaît dans son historique : rien n’est effacé, tout se lit.',
        ],
        where: 'Espace parent → Enfants → l’enfant',
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
          `Partagez votre code : la famille que vous parrainez démarre avec ${REFERRAL.refereeTrialDays} jours d’essai au lieu de ${TRIAL_DAYS}.`,
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
