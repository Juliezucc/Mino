/**
 * La base de connaissance.
 *
 * Un seul fichier, pour une seule raison : la même réponse doit servir dans
 * l'application, sur le site et dans l'outil de support. Trois copies d'une
 * réponse, ce sont deux copies fausses au bout de trois mois.
 *
 * `scripts/export-faq.mjs` en tire le Markdown du site et le JSON à importer
 * dans l'outil de support.
 *
 * Ce que doit contenir une entrée pour être utile :
 *   — une question écrite comme un parent la pose, pas comme le produit la voit
 *     (« les applis ne se bloquent pas », jamais « configuration ManagedSettings ») ;
 *   — une réponse qui tient en trois phrases et qui dit quoi faire ;
 *   — des mots-clés qui couvrent ce que les gens tapent vraiment, fautes
 *     comprises. C'est cette liste qui fait la différence entre une recherche
 *     qui déflecte un ticket et une recherche qui en crée un.
 */

export type FaqCategory =
  | 'installation'
  | 'temps-ecran'
  | 'missions'
  | 'compte'
  | 'abonnement'
  | 'confidentialite'
  | 'problemes';

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  /** Ce que les gens tapent, y compris de travers. */
  keywords: string[];
  /** Le chapitre du guide qui montre la manipulation, s'il y en a un. */
  guide?: string;
  /** Un écran de l'application qui règle la question directement. */
  route?: string;
}

export const FAQ_CATEGORIES: { id: FaqCategory; label: string; icon: string }[] = [
  { id: 'installation', label: 'Installation', icon: '📲' },
  { id: 'temps-ecran', label: 'Temps d’écran', icon: '⏱️' },
  { id: 'missions', label: 'Missions et minos', icon: '⭐' },
  { id: 'compte', label: 'Compte et code parent', icon: '🔐' },
  { id: 'abonnement', label: 'Abonnement', icon: '💳' },
  { id: 'confidentialite', label: 'Données et confidentialité', icon: '🛡️' },
  { id: 'problemes', label: 'Ça ne marche pas', icon: '🛠️' },
];

export const FAQ: FaqEntry[] = [
  /* ------------------------------------------------------- installation */
  {
    id: 'installer-appareil-enfant',
    question: 'Comment installer Mino sur l’appareil de mon enfant ?',
    answer:
      'Installez Mino depuis l’App Store ou le Play Store sur son téléphone ou sa tablette, ouvrez l’application et choisissez « J’ai un code famille ». Votre code se trouve dans Réglages, sur votre propre téléphone. Le système vous demandera ensuite l’autorisation d’un adulte : c’est normal, c’est ce qui permet de vraiment débloquer le temps d’écran.',
    category: 'installation',
    keywords: ['installer', 'installation', 'appareil enfant', 'telephone enfant', 'tablette', 'configurer', 'demarrer', 'commencer'],
    guide: 'appareil-enfant',
  },
  {
    id: 'ou-trouver-code-famille',
    question: 'Où trouver mon code famille ?',
    answer:
      'Dans l’espace parent, onglet Réglages. C’est un code de six caractères. Attention à ne pas le confondre avec le code de parrainage, qui sert à inviter d’autres familles et ne rattache aucun appareil.',
    category: 'installation',
    keywords: ['code famille', 'code', 'six caracteres', 'rattacher', 'jumeler', 'appairer'],
    route: '/parent/(tabs)/reglages',
  },
  {
    id: 'code-famille-refuse',
    question: 'Le code famille est refusé sur l’appareil de mon enfant',
    answer:
      'Vérifiez les caractères qui se ressemblent : le zéro et la lettre O, le 1 et le I. La casse n’a pas d’importance, les espaces non plus. Après dix essais ratés en une heure, l’appareil doit attendre : c’est une protection, réessayez un peu plus tard.',
    category: 'installation',
    keywords: ['code refuse', 'code incorrect', 'code ne marche pas', 'famille introuvable', 'erreur code'],
  },
  {
    id: 'faut-il-installer-cote-parent',
    question: 'Dois-je aussi installer Mino sur mon téléphone ?',
    answer:
      'Oui. C’est depuis votre téléphone que vous créez les missions, validez les demandes et suivez le temps en cours. L’application de l’enfant ne sert qu’à lui.',
    category: 'installation',
    keywords: ['deux applications', 'telephone parent', 'mon telephone', 'cote parent'],
  },
  {
    id: 'deux-parents',
    question: 'Nous sommes deux parents, sur deux téléphones',
    answer:
      'Chacun installe Mino et se connecte au même compte. Les validations, les missions et l’historique sont partagés en direct : ce que l’un valide, l’autre le voit aussitôt.',
    category: 'installation',
    keywords: ['deux parents', 'conjoint', 'partage', 'garde alternee', 'papa maman'],
  },
  {
    id: 'enfant-sans-telephone',
    question: 'Mon enfant n’a pas de téléphone',
    answer:
      'Mino fonctionne quand même. Vous déclarez ses écrans dans Appareils — console, télévision, ordinateur familial — et vous validez ses demandes depuis votre téléphone. La différence : sur ces écrans-là, c’est vous qui ouvrez et fermez l’accès, Mino ne peut pas le faire tout seul.',
    category: 'installation',
    keywords: ['pas de telephone', 'sans telephone', 'petit', 'jeune enfant', 'console seulement'],
    guide: 'autres-ecrans',
  },
  {
    id: 'console-tv-ordinateur',
    question: 'Est-ce que ça marche avec une Switch, une PlayStation ou la télé ?',
    answer:
      'Ces écrans se déclarent dans Appareils et entrent dans le système de minos : l’enfant demande, vous validez, le temps est décompté. Mais aucun système de console ou de téléviseur ne laisse une application extérieure couper l’accès. Sur ces écrans, le blocage reste entre vos mains — Mino tient le compte, vous tenez la manette.',
    category: 'installation',
    keywords: ['switch', 'nintendo', 'playstation', 'ps5', 'xbox', 'console', 'television', 'tele', 'ordinateur', 'pc', 'mac'],
    guide: 'autres-ecrans',
    route: '/parent/appareils',
  },
  {
    id: 'enfant-deux-appareils',
    question: 'Mon enfant a un téléphone et une tablette',
    answer:
      'Installez Mino sur les deux avec le même code famille et le même profil. Le compteur de minos est unique : le temps dépensé sur l’un est décompté pour l’autre.',
    category: 'installation',
    keywords: ['deux appareils', 'tablette et telephone', 'plusieurs ecrans'],
  },
  {
    id: 'ados',
    question: 'Est-ce que c’est adapté à un adolescent ?',
    answer:
      'Oui. À partir de treize ans, Mino change de vocabulaire et de mise en page : on parle de minutes et non de minos, les célébrations s’effacent, les missions proposées concernent l’autonomie, le travail et l’équilibre. L’âge se règle sur sa fiche.',
    category: 'installation',
    keywords: ['ado', 'adolescent', 'grand', '13 ans', '15 ans', 'college', 'lycee'],
  },

  /* -------------------------------------------------------- temps d'écran */
  {
    id: 'applis-ne-se-bloquent-pas',
    question: 'Les applications ne se bloquent pas sur le téléphone de mon enfant',
    answer:
      'C’est presque toujours l’autorisation système qui manque. Sur l’appareil de l’enfant, ouvrez Mino, allez dans Réglages et relancez « Autoriser le temps d’écran » : le système demandera le compte d’un adulte. Sans cette autorisation, Mino compte le temps mais ne peut rien fermer.',
    category: 'temps-ecran',
    keywords: ['bloque pas', 'blocage', 'ne bloque rien', 'applications ouvertes', 'autorisation', 'temps ecran ne marche pas'],
    guide: 'blocage-applications',
  },
  {
    id: 'choisir-applis-bloquees',
    question: 'Comment choisir les applications à bloquer ?',
    answer:
      'Depuis l’appareil de l’enfant, dans Réglages, « Applications concernées ». Le système affiche sa propre liste — c’est lui qui la fournit, Mino ne voit jamais quelles applications sont installées. Choisissez les jeux et les réseaux, laissez de côté l’école et les outils du quotidien.',
    category: 'temps-ecran',
    keywords: ['choisir applications', 'quelles applis', 'liste', 'selection', 'youtube', 'tiktok', 'jeux'],
    guide: 'blocage-applications',
  },
  {
    id: 'appels-messages',
    question: 'Est-ce que les appels et les messages sont bloqués aussi ?',
    answer:
      'Non, sauf si vous les ajoutez vous-même à la liste. Le téléphone, les messages et les appels d’urgence restent accessibles : un enfant doit pouvoir joindre un adulte, minos ou pas.',
    category: 'temps-ecran',
    keywords: ['appels', 'telephoner', 'sms', 'messages', 'urgence', 'joindre'],
  },
  {
    id: 'temps-ecoule',
    question: 'Que se passe-t-il quand le temps est écoulé ?',
    answer:
      'L’enfant reçoit un avertissement cinq minutes avant, puis les applications choisies se referment. Rien n’est perdu : il retrouve ses minos dès qu’il en gagne de nouveaux.',
    category: 'temps-ecran',
    keywords: ['fin du temps', 'temps ecoule', 'coupure', 'ferme', 'stop', 'avertissement'],
  },
  {
    id: 'arreter-session',
    question: 'Puis-je arrêter le temps en cours à distance ?',
    answer:
      'Oui. L’accueil de l’espace parent affiche la session en cours et le temps restant ; vous pouvez l’arrêter d’un geste. Les minutes non utilisées reviennent à l’enfant — on ne lui prend pas ce qu’il a gagné.',
    category: 'temps-ecran',
    keywords: ['arreter', 'stopper', 'couper', 'a distance', 'session en cours', 'interrompre', 'diner', 'repas'],
  },
  {
    id: 'donner-bonus',
    question: 'Comment offrir du temps en plus ?',
    answer:
      'Depuis la fiche de l’enfant, « Donner un bonus ». Indiquez la raison : c’est elle qui donne sa valeur au geste, et elle apparaît dans son historique.',
    category: 'missions',
    keywords: ['bonus', 'offrir', 'cadeau', 'recompense', 'ajouter du temps', 'minutes en plus'],
  },
  {
    id: 'enfant-lance-son-temps',
    question: 'Mon enfant peut-il lancer son temps tout seul ?',
    answer:
      'Sur l’appareil où Mino est installé, oui, s’il a des minos : c’est le principe même, il dépense ce qu’il a gagné. Si vous préférez valider chaque fois, activez « Demander avant chaque session » sur sa fiche. Sur les autres écrans, votre validation est toujours requise.',
    category: 'temps-ecran',
    keywords: ['lancer seul', 'demarrer son temps', 'autonomie', 'sans demander', 'validation'],
  },
  {
    id: 'desinstalle-mino',
    question: 'Et si mon enfant désinstalle Mino ?',
    answer:
      'Les restrictions posées par le système ne disparaissent pas avec l’application : elles ont été autorisées par un adulte et se lèvent de la même façon. Vous pouvez aussi empêcher la suppression d’applications dans les réglages de son appareil — le guide explique où.',
    category: 'temps-ecran',
    keywords: ['desinstaller', 'supprimer app', 'contourner', 'triche', 'malin', 'enlever'],
    guide: 'blocage-applications',
  },
  {
    id: 'change-heure',
    question: 'Mon enfant a changé l’heure de son téléphone',
    answer:
      'Le décompte s’appuie sur l’heure du serveur, pas sur celle de l’appareil : avancer l’horloge ne donne pas une minute de plus.',
    category: 'temps-ecran',
    keywords: ['changer heure', 'horloge', 'triche heure', 'date', 'contourner'],
  },

  /* ------------------------------------------------------------ missions */
  {
    id: 'cest-quoi-un-mino',
    question: 'C’est quoi un mino ?',
    answer:
      'Une minute de temps d’écran, gagnée par une mission. Un mino vaut toujours une minute, et il ne s’achète jamais — c’est le seul mot que voient les enfants jusqu’à treize ans.',
    category: 'missions',
    keywords: ['mino', 'minos', 'monnaie', 'points', 'minutes', 'unite'],
  },
  {
    id: 'enfant-ne-voit-pas-mission',
    question: 'Mon enfant ne voit pas sa mission',
    answer:
      'Vérifiez sa récurrence : une mission « certains jours » n’apparaît que les jours choisis. Vérifiez aussi qu’elle lui est bien attribuée, et pas seulement à son frère ou à sa sœur. Une mission déjà terminée disparaît de sa liste : c’est voulu, pour qu’il ne voie que ce qui lui reste à faire.',
    category: 'missions',
    keywords: ['ne voit pas', 'mission absente', 'liste vide', 'disparu', 'invisible'],
  },
  {
    id: 'missions-ne-reviennent-pas',
    question: 'Les missions ne reviennent pas le lendemain',
    answer:
      'Une mission quotidienne réapparaît au changement de journée sur l’appareil. Si elle ne revient pas, c’est en général qu’elle a été créée comme mission unique : ouvrez-la et vérifiez sa récurrence.',
    category: 'missions',
    keywords: ['recurrence', 'lendemain', 'reset', 'reinitialisation', 'chaque jour', 'quotidienne'],
  },
  {
    id: 'valide-par-erreur',
    question: 'J’ai validé une mission par erreur',
    answer:
      'Ajustez le compteur depuis la fiche de l’enfant. La correction apparaît dans son historique : rien n’est effacé, on ajoute une ligne. C’est ce qui garantit que le compteur et l’historique ne se contredisent jamais.',
    category: 'missions',
    keywords: ['erreur', 'annuler validation', 'retirer', 'corriger', 'trop de minutes'],
  },
  {
    id: 'refuser-sans-vexer',
    question: 'Comment refuser une mission sans décourager mon enfant ?',
    answer:
      'Un refus dans Mino renvoie la mission dans sa liste, sans reproche : elle est « à refaire », pas « ratée ». Dites-lui de vive voix ce qui manque — l’application ne le dira jamais à votre place.',
    category: 'missions',
    keywords: ['refuser', 'refus', 'pas fait', 'mal fait', 'decourager', 'punir'],
  },
  {
    id: 'combien-de-minutes',
    question: 'Combien de minutes faut-il donner par mission ?',
    answer:
      'Entre 5 et 15 minutes pour un geste quotidien, jusqu’à 30 pour quelque chose de long ou de pénible. Le repère qui marche : une journée de missions faites doit donner à peu près le temps d’écran que vous acceptiez déjà.',
    category: 'missions',
    keywords: ['combien de minutes', 'valeur', 'bareme', 'trop', 'pas assez', 'equilibre'],
  },
  {
    id: 'suggestions-routines',
    question: 'Je n’ai pas d’idées de missions',
    answer:
      'À la création d’une mission, Mino propose des suggestions adaptées à l’âge, et des routines toutes faites — le coucher, le matin, les devoirs — qui créent plusieurs missions d’un coup. Vous pouvez tout modifier ensuite.',
    category: 'missions',
    keywords: ['idees', 'suggestions', 'exemples', 'routine', 'coucher', 'matin', 'devoirs'],
    route: '/parent/mission-new',
  },
  {
    id: 'enfant-ment',
    question: 'Mon enfant dit avoir fait une mission sans l’avoir faite',
    answer:
      'C’est exactement pour cela que la validation existe : rien n’arrive sur son compteur sans votre accord. Refusez, la mission revient dans sa liste. Le système est conçu pour que la vérification reste humaine.',
    category: 'missions',
    keywords: ['ment', 'mensonge', 'triche', 'pas fait', 'verifier'],
  },
  {
    id: 'fratrie',
    question: 'Comment gérer plusieurs enfants ?',
    answer:
      'Chaque enfant a son profil, ses missions et son compteur — rien n’est commun. Une même mission peut être attribuée à plusieurs enfants d’un coup, et certaines suggestions parlent explicitement du frère ou de la sœur.',
    category: 'missions',
    keywords: ['plusieurs enfants', 'fratrie', 'frere', 'soeur', 'jumeaux', 'partage'],
  },

  /* -------------------------------------------------------------- compte */
  {
    id: 'code-parent-oublie',
    question: 'J’ai oublié mon code parent',
    answer:
      'Le code parent est lié à votre compte, pas à l’appareil. Déconnectez-vous et reconnectez-vous avec votre e-mail et votre mot de passe : vous pourrez en choisir un nouveau. Après cinq essais ratés, l’accès se bloque cinq minutes.',
    category: 'compte',
    keywords: ['code parent oublie', 'pin oublie', 'code incorrect', 'bloque', 'quatre chiffres'],
  },
  {
    id: 'mot-de-passe-oublie',
    question: 'J’ai oublié mon mot de passe',
    answer:
      'Depuis l’écran de connexion, « Mot de passe oublié ». Vous recevrez un lien par e-mail. Pensez à regarder dans les indésirables.',
    category: 'compte',
    keywords: ['mot de passe', 'connexion', 'reinitialiser', 'mail non recu'],
  },
  {
    id: 'enfant-connait-code-parent',
    question: 'Mon enfant a vu mon code parent',
    answer:
      'Changez-le depuis Réglages, sur votre téléphone. Le code n’est jamais stocké sur l’appareil de l’enfant : il est vérifié par le serveur, ce qui veut dire qu’il ne peut pas être lu depuis sa tablette, même en cherchant.',
    category: 'compte',
    keywords: ['code decouvert', 'changer code', 'espionne', 'securite code'],
  },
  {
    id: 'changer-email',
    question: 'Comment changer mon adresse e-mail ?',
    answer:
      'Depuis Réglages, section Compte. Une confirmation part sur la nouvelle adresse : le changement n’est effectif qu’une fois le lien ouvert.',
    category: 'compte',
    keywords: ['changer email', 'adresse mail', 'nouvelle adresse'],
  },
  {
    id: 'supprimer-compte',
    question: 'Comment supprimer mon compte et nos données ?',
    answer:
      'Depuis Réglages, « Supprimer le compte ». Tout est effacé sous trente jours : profils des enfants, missions, historique. Les factures sont conservées dix ans, comme la loi comptable l’exige, et elles ne contiennent aucune donnée d’enfant.',
    category: 'confidentialite',
    keywords: ['supprimer compte', 'effacer', 'rgpd', 'donnees', 'partir', 'desinscription'],
    route: '/legal/confidentialite',
  },

  /* ---------------------------------------------------------- abonnement */
  {
    id: 'prix',
    question: 'Combien coûte Mino ?',
    answer:
      '9,90 € par mois, ou 79 € par an — deux mois offerts. Toute la famille est comprise : autant d’enfants et d’appareils que vous voulez, sans supplément.',
    category: 'abonnement',
    keywords: ['prix', 'tarif', 'combien', 'cout', 'payant', 'gratuit', 'abonnement'],
    route: '/parent/abonnement',
  },
  {
    id: 'essai-gratuit',
    question: 'Serai-je prélevé à la fin de l’essai ?',
    answer:
      'L’essai dure trente jours et rien n’est prélevé pendant cette période : aucune carte ne vous est demandée pour commencer. Vous ne payez qu’au moment où vous choisissez une formule, à la fin de l’essai.',
    category: 'abonnement',
    keywords: ['essai', 'gratuit', 'trente jours', '30 jours', 'preleve', 'carte bancaire'],
  },
  {
    id: 'annuler',
    question: 'Comment annuler mon abonnement ?',
    answer:
      'Cela dépend d’où vous vous êtes abonné. Depuis l’application : dans les réglages de votre téléphone, à la rubrique Abonnements — l’écran Abonnement de Mino vous y emmène directement. Depuis notre site : dans Réglages, puis Abonnement, puis « Résilier ». Dans les deux cas c’est immédiat, sans justification, et vous gardez l’accès jusqu’à la fin de la période payée.',
    category: 'abonnement',
    keywords: ['annuler', 'resilier', 'arreter', 'desabonner', 'stop'],
    route: '/parent/abonnement',
  },
  {
    id: 'paye-sur-telephone-marche-partout',
    question: 'J’ai payé sur mon iPhone : est-ce que ça marche sur le site ?',
    answer:
      'Oui. L’abonnement appartient à votre compte Mino, pas à l’appareil où vous l’avez payé. Vous êtes abonné partout : sur le téléphone de votre enfant, sur celui de l’autre parent, et sur le site.',
    category: 'abonnement',
    keywords: ['paye telephone', 'iphone', 'android', 'site', 'partout', 'plusieurs appareils'],
  },
  {
    id: 'change-de-telephone',
    question: 'J’ai changé de téléphone et je ne suis plus abonné',
    answer:
      'Reconnectez-vous d’abord avec votre e-mail : dans neuf cas sur dix, tout revient. Si l’abonnement avait été souscrit dans l’application, touchez « Restaurer mes achats » sur l’écran Abonnement, avec le même compte Apple ou Google qu’au moment de l’achat.',
    category: 'abonnement',
    keywords: ['change telephone', 'nouveau telephone', 'restaurer', 'perdu abonnement', 'restauration'],
    route: '/parent/abonnement',
  },
  {
    id: 'remboursement',
    question: 'Puis-je être remboursé ?',
    answer:
      'Si vous vous êtes abonné dans l’application, le remboursement se demande à Apple ou à Google, qui sont les vendeurs de cet abonnement — nous n’avons pas la main dessus. Si vous êtes passé par notre site, écrivez-nous. Dans les deux cas, la résiliation suffit à ne plus être prélevé.',
    category: 'abonnement',
    keywords: ['rembourser', 'remboursement', 'preleve par erreur', 'litige', 'recuperer argent'],
  },
  {
    id: 'parrainage',
    question: 'Comment fonctionne le parrainage ?',
    answer:
      'Votre filleul obtient soixante jours d’essai au lieu de trente. Dès qu’il devient payant, vous recevez un mois offert — jusqu’à douze par an. Votre code se trouve dans Réglages, section Parrainage.',
    category: 'abonnement',
    keywords: ['parrainage', 'parrain', 'filleul', 'inviter', 'code parrainage', 'offert', 'gratuit'],
    route: '/parent/parrainage',
  },
  {
    id: 'changer-formule',
    question: 'Puis-je passer du mensuel à l’annuel ?',
    answer:
      'Oui, à tout moment. Depuis l’application, le changement se fait dans les réglages de votre téléphone, à la rubrique Abonnements ; depuis le site, dans Abonnement. Ce que vous avez déjà payé est déduit.',
    category: 'abonnement',
    keywords: ['changer formule', 'annuel', 'mensuel', 'passer', 'prorata'],
  },
  {
    id: 'facture',
    question: 'Où trouver mes factures ?',
    answer:
      'Si vous vous êtes abonné dans l’application, les reçus viennent d’Apple ou de Google et se retrouvent dans l’historique d’achats de votre compte — ce sont eux qui encaissent. Si vous êtes passé par notre site, vos factures sont dans Abonnement, « Gérer mon paiement », et vous en recevez une par e-mail à chaque prélèvement.',
    category: 'abonnement',
    keywords: ['facture', 'recu', 'tva', 'comptabilite', 'justificatif'],
  },
  {
    id: 'paiement-refuse',
    question: 'Mon paiement a été refusé',
    answer:
      'Mettez à jour le moyen de paiement là où vous vous êtes abonné : dans votre compte Apple ou Google si l’abonnement vient de l’application, dans « Gérer mon paiement » s’il vient du site. L’accès reste ouvert quelques jours pendant les nouvelles tentatives : personne ne perd son compte pour une carte expirée.',
    category: 'abonnement',
    keywords: ['paiement refuse', 'carte', 'echec', 'impaye', 'expire'],
  },
  {
    id: 'reclamation-mediation',
    question: 'Je ne suis pas d’accord et vous ne me répondez pas',
    answer:
      'Écrivez-nous d’abord : c’est presque toujours plus rapide, et c’est aussi une étape obligatoire avant la suite. Si nous n’avons pas trouvé de solution, vous pouvez saisir gratuitement le médiateur de la consommation dont nous relevons, CM2C, sur www.cm2c.net. C’est gratuit, facultatif, et cela ne vous empêche jamais de saisir la justice.',
    category: 'abonnement',
    keywords: ['reclamation', 'litige', 'mediateur', 'mediation', 'pas content', 'desaccord', 'cm2c'],
  },

  {
    id: 'parler-a-mino',
    question: 'Mon enfant discute avec Mino : qu’est-ce que c’est ?',
    answer:
      'Quand son temps d’écran est terminé, Mino reste et peut discuter avec lui — une vingtaine d’échanges par jour, puis il l’envoie jouer. Mino connaît ses missions du jour, propose des défis sans écran, et ne valide jamais une mission ni ne donne de minutes : cela n’appartient qu’à vous. Vous pouvez lire toutes leurs conversations, et votre enfant en est prévenu.',
    category: 'confidentialite',
    keywords: ['discuter', 'parler', 'chat', 'ia', 'intelligence artificielle', 'compagnon', 'personnage'],
    route: '/parent/enfants',
  },
  {
    id: 'desactiver-mino-parle',
    question: 'Je ne veux pas que mon enfant discute avec Mino',
    answer:
      'Ouvrez sa fiche dans Enfants, puis « Parler à Mino » et choisissez Non. C’est immédiat, et l’écran « plus de temps » lui proposera simplement ses missions.',
    category: 'confidentialite',
    keywords: ['desactiver', 'couper', 'enlever chat', 'pas de discussion', 'interdire'],
    route: '/parent/enfants',
  },
  {
    id: 'mino-confidence-grave',
    question: 'Que se passe-t-il si mon enfant confie quelque chose de grave à Mino ?',
    answer:
      'Mino s’arrête. Il ne conseille pas et ne pose pas de questions : il invite votre enfant à en parler à un adulte de confiance et lui donne le 119, gratuit et confidentiel, avec un bouton pour appeler. Le message est signalé dans les conversations que vous pouvez lire. Mino n’est pas une ligne d’écoute et personne ne surveille ces échanges en temps réel.',
    category: 'confidentialite',
    keywords: ['grave', 'inquiet', 'danger', '119', 'confidence', 'securite enfant'],
  },

  {
    id: 'appareil-partage-profils',
    question: 'Mon enfant peut changer de profil et prendre celui de son frère',
    answer:
      'Ouvrez Réglages sur l’appareil concerné, rubrique « Cet appareil », et choisissez « À <prénom> ». Mino s’ouvrira toujours sur son profil, et il faudra votre code parent pour en changer. Laissez « Partagé » pour une tablette familiale : chacun retrouve alors le dernier profil utilisé, et peut en changer librement.',
    category: 'compte',
    keywords: ['changer de profil', 'profil', 'frere', 'soeur', 'tablette partagee', 'verrouiller', 'prendre les minos'],
    route: '/parent/(tabs)/reglages',
  },
  {
    id: 'reconnexion-a-chaque-fois',
    question: 'Mon enfant doit rechoisir son profil à chaque ouverture',
    answer:
      'Ce n’est plus le cas : Mino rouvre sur le dernier profil utilisé. Si l’appareil est celui d’un seul enfant, réservez-le-lui dans Réglages → « Cet appareil » : il ouvrira toujours directement sur lui.',
    category: 'compte',
    keywords: ['reconnexion', 'rechoisir', 'profil a chaque fois', 'se reconnecter', 'redemande'],
    route: '/parent/(tabs)/reglages',
  },

  /* ------------------------------------------------------ confidentialité */
  {
    id: 'donnees-enfant',
    question: 'Quelles données collectez-vous sur mon enfant ?',
    answer:
      'Son prénom, son âge et son avatar. Rien d’autre : pas d’adresse e-mail, pas de photo, pas de numéro. Mino ne sait pas quelles applications sont installées sur son appareil — le système ne les lui montre jamais.',
    category: 'confidentialite',
    keywords: ['donnees enfant', 'collecte', 'vie privee', 'rgpd', 'prenom', 'age'],
    route: '/legal/confidentialite',
  },
  {
    id: 'publicite-revente',
    question: 'Y a-t-il de la publicité ? Revendez-vous les données ?',
    answer:
      'Aucune publicité, aucune revente, aucun traceur marketing du côté de l’enfant. Mino est financé par l’abonnement, et par rien d’autre. C’est un choix de conception, pas une promesse : il n’y a pas de régie publicitaire dans l’application.',
    category: 'confidentialite',
    keywords: ['publicite', 'pub', 'revente', 'donnees vendues', 'tracking', 'traceur'],
  },
  {
    id: 'geolocalisation',
    question: 'Mino localise-t-il mon enfant ?',
    answer:
      'Non. L’application ne demande jamais la position et ne pourrait pas l’obtenir. Ce n’est pas un outil de surveillance.',
    category: 'confidentialite',
    keywords: ['geolocalisation', 'gps', 'position', 'localiser', 'surveiller', 'espionner'],
  },
  {
    id: 'autre-famille',
    question: 'Une autre famille peut-elle voir mon enfant ?',
    answer:
      'Non, et pas seulement parce que l’application ne l’affiche pas : la base de données elle-même refuse de renvoyer les lignes d’une famille à quelqu’un qui n’en fait pas partie. Il n’y a ni profil public, ni messagerie, ni contenu partagé entre familles.',
    category: 'confidentialite',
    keywords: ['autre famille', 'visible', 'public', 'chat', 'messagerie', 'inconnu', 'securite'],
  },
  {
    id: 'ou-sont-les-donnees',
    question: 'Où sont hébergées les données ?',
    answer:
      'Dans l’Union européenne. Elles ne sont transférées à aucun pays tiers en dehors de ce que nécessite le paiement, assuré par Stripe.',
    category: 'confidentialite',
    keywords: ['hebergement', 'serveur', 'europe', 'ue', 'rgpd', 'stockage'],
    route: '/legal/confidentialite',
  },

  /* ------------------------------------------------------------ problèmes */
  {
    id: 'compteur-ne-bouge-pas',
    question: 'Le compteur de mon enfant ne bouge pas',
    answer:
      'Les minutes n’arrivent qu’après votre validation : regardez les demandes en attente sur l’accueil de l’espace parent. Si vous avez validé et que le compteur ne suit pas, fermez et rouvrez l’application sur l’appareil de l’enfant.',
    category: 'problemes',
    keywords: ['compteur', 'bouge pas', 'minutes', 'pas de minos', 'bloque', 'zero'],
  },
  {
    id: 'pas-de-synchro',
    question: 'Les deux appareils n’affichent pas la même chose',
    answer:
      'Vérifiez que les deux sont bien en ligne, puis fermez et rouvrez l’application sur celui qui est en retard. Si l’écart persiste au-delà d’une minute, signalez-le : c’est un problème de notre côté, pas du vôtre.',
    category: 'problemes',
    keywords: ['synchronisation', 'pas a jour', 'decalage', 'differents', 'retard'],
  },
  {
    id: 'notifications-non-recues',
    question: 'Je ne reçois pas les notifications',
    answer:
      'Vérifiez qu’elles sont autorisées pour Mino dans les réglages de votre téléphone, puis dans Réglages, section Notifications. Sachez aussi que les notifications sont silencieuses entre 20 h et 7 h — sauf l’alerte de fin de temps, qui passe toujours.',
    category: 'problemes',
    keywords: ['notification', 'alerte', 'pas recu', 'silencieux', 'sonnerie'],
  },
  {
    id: 'application-plante',
    question: 'L’application se ferme toute seule',
    answer:
      'Mettez-la à jour depuis la boutique, c’est la cause la plus fréquente. Si cela recommence, envoyez-nous un signalement depuis Aide : il partira avec le contexte technique nécessaire, et sans aucune donnée sur vos enfants.',
    category: 'problemes',
    keywords: ['plante', 'crash', 'se ferme', 'bug', 'ferme toute seule', 'ecran noir'],
    route: '/probleme',
  },
];

export const faqById = (id: string): FaqEntry | undefined => FAQ.find((e) => e.id === id);
