import { LegalDocument, OPERATOR } from './document';

/**
 * Privacy policy — GDPR, French/EU context.
 *
 * Mino's position is unusually simple to describe, and that is the point: the
 * parent holds the account, the child has no account of their own, and nothing
 * leaves the family. Everything below is a description of what the code
 * actually does — if the product changes, this file changes with it.
 *
 * NOT LEGAL ADVICE. Have a lawyer review this before selling, in particular the
 * retention periods and the subprocessor list.
 */
export const PRIVACY: LegalDocument = {
  title: 'Politique de confidentialité',
  subtitle: 'Ce que Mino sait de votre famille, et ce qu’il n’en fait pas',
  updatedAt: '11 septembre 2026',
  intro: [
    {
      kind: 'p',
      text: 'Mino est une application familiale utilisée par des enfants. Nous avons construit le produit autour d’un principe simple : ne collecter que ce qui est strictement nécessaire pour qu’il fonctionne, et rien d’autre.',
    },
    {
      kind: 'note',
      text: 'Pas de publicité. Pas de revente de données. Pas de traceur publicitaire. Pas de géolocalisation. Pas de messagerie entre personnes. Pas de profil public. Aucun enfant n’est visible par une autre famille que la sienne.',
    },
  ],
  sections: [
    {
      title: '1. Qui est responsable de vos données',
      blocks: [
        {
          kind: 'p',
          text: `Le responsable du traitement est ${OPERATOR.legalName}, ${OPERATOR.legalForm}, dont le siège social est situé ${OPERATOR.address}, immatriculée au registre du commerce et des sociétés sous le numéro ${OPERATOR.rcs}.`,
        },
        {
          kind: 'p',
          text: `Pour toute question relative à vos données personnelles, écrivez à ${OPERATOR.privacyEmail}.`,
        },
      ],
    },
    {
      title: '2. Les données que nous collectons',
      blocks: [
        {
          kind: 'p',
          text: 'Elles se répartissent en six catégories, et la liste ci-dessous est exhaustive.',
        },
        {
          kind: 'rows',
          rows: [
            {
              label: 'Compte parent',
              value: 'Adresse e-mail, mot de passe (stocké sous forme chiffrée, jamais en clair), prénom ou nom d’affichage, code famille, code PIN de l’espace parent.',
            },
            {
              label: 'Profil enfant',
              value: 'Prénom, âge et avatar illustré choisi dans une liste. Aucune adresse e-mail, aucun mot de passe, aucun nom de famille, aucune photo, aucun numéro de téléphone, aucune donnée de localisation.',
            },
            {
              label: 'Utilisation',
              value: 'Les missions créées, les missions déclarées et en attente de confirmation, les minutes gagnées et utilisées, les sessions de temps d’écran, et les plages horaires pendant lesquelles vous ouvrez l’écran sans rien décompter. Ces données existent parce qu’elles sont l’application elle-même.',
            },
            {
              label: 'Appareils de la famille',
              value: 'Pour chaque appareil rattaché : le prénom de l’enfant auquel il est réservé s’il y en a un, le nom que son propriétaire a donné à son téléphone, l’état du verrouillage et la date du dernier contact, ainsi qu’un jeton de notification. Le NOMBRE d’applications que vous avez choisi de verrouiller, et lui seul : le système d’exploitation ne nous transmet jamais lesquelles, et nous ne pouvons donc pas savoir ce que votre enfant a installé ni ce qu’il utilise.',
            },
            {
              label: 'Abonnement',
              value: 'Statut de l’abonnement, dates, codes de parrainage. Les coordonnées bancaires ne transitent jamais par Mino : elles sont saisies et conservées directement par notre prestataire de paiement.',
            },
            {
              label: 'Conversations avec Mino',
              value: 'Le texte des messages échangés entre l’enfant et le personnage, lorsque cette fonctionnalité est activée. Aucun enregistrement sonore, même lorsque l’enfant dicte son message. Voir les sections 5 et 6.',
            },
          ],
        },
        {
          kind: 'note',
          text: 'Nous ne collectons aucune donnée sensible au sens du RGPD : ni origine, ni opinions, ni santé, ni biométrie. Nous ne conservons aucun enregistrement de la voix d’un enfant, et nous ne demandons jamais son nom de famille.',
        },
      ],
    },
    {
      title: '3. Pourquoi nous les collectons, et sur quelle base légale',
      blocks: [
        {
          kind: 'rows',
          rows: [
            {
              label: 'Fournir le service',
              value: 'Créer la famille, gérer les missions, tenir le compteur de temps. Base légale : exécution du contrat (art. 6.1.b du RGPD).',
            },
            {
              label: 'Gérer l’abonnement',
              value: 'Encaisser, facturer, appliquer le parrainage. Base légale : exécution du contrat, et obligation légale pour la conservation des factures (art. 6.1.b et 6.1.c).',
            },
            {
              label: 'Sécurité',
              value: 'Protéger les comptes et empêcher l’abus du parrainage. Base légale : intérêt légitime (art. 6.1.f).',
            },
            {
              label: 'Support',
              value: 'Répondre à vos messages. Base légale : exécution du contrat et intérêt légitime.',
            },
            {
              label: 'Conversations avec Mino',
              value: 'Faire fonctionner le personnage et repérer les messages qui appellent l’attention d’un adulte. Base légale : exécution du contrat, sur autorisation du titulaire de l’autorité parentale, qui peut désactiver la fonctionnalité à tout moment.',
            },
          ],
        },
        {
          kind: 'p',
          text: 'Nous ne réalisons aucun profilage, aucune décision automatisée produisant des effets juridiques, et aucune prospection commerciale ciblant les enfants.',
        },
      ],
    },
    {
      title: '4. Les données des enfants',
      blocks: [
        {
          kind: 'p',
          text: 'Mino est conçu pour que l’enfant n’ait jamais de compte à lui. C’est le parent, titulaire de l’autorité parentale, qui ouvre le compte, crée les profils et décide de ce qui y figure. Le traitement des données de l’enfant repose sur le contrat conclu avec ce parent et sur son autorisation.',
        },
        {
          kind: 'p',
          text: 'En France, le consentement d’un mineur au traitement de ses données n’est valable qu’à partir de 15 ans ; en deçà, l’autorisation du titulaire de l’autorité parentale est requise. C’est la raison pour laquelle l’espace parent est protégé par un code et que l’enfant ne peut ni créer un compte, ni modifier les réglages, ni communiquer avec l’extérieur.',
        },
        {
          kind: 'note',
          text: 'Mino ne surveille pas les enfants et n’est pas un mode de garde : l’enfant reste à tout moment sous la responsabilité et la surveillance de l’adulte titulaire de l’autorité parentale.',
        },
        {
          kind: 'bullets',
          items: [
            'Un enfant ne peut être contacté par personne depuis l’application : il n’y a ni messagerie, ni commentaire, ni partage. Les seuls échanges possibles sont ceux avec Mino, décrits à la section 5, et ils ne mettent en relation avec aucune autre personne.',
            'Un profil enfant n’est visible que par les membres de sa propre famille. Les règles de sécurité de notre base de données l’empêchent techniquement, pas seulement contractuellement.',
            'Aucune publicité, aucune mesure d’audience marketing et aucun traceur tiers ne sont présents dans l’expérience enfant.',
            'Le parent peut supprimer un profil enfant à tout moment ; ses données sont alors effacées.',
            'Les conversations avec le personnage Mino et l’usage du microphone font l’objet des sections 5 et 6 : elles se désactivent séparément, enfant par enfant.',
          ],
        },
      ],
    },
    {
      title: '5. Les conversations avec Mino',
      blocks: [
        {
          kind: 'p',
          text: 'Lorsque son temps d’écran est terminé, votre enfant peut discuter avec Mino, le personnage de l’application. Cette fonctionnalité est activée par défaut et se désactive à tout moment, enfant par enfant, depuis sa fiche dans l’espace parent.',
        },
        {
          kind: 'note',
          text: 'Mino est un personnage animé par un programme, et non une personne. Il n’est ni un service d’écoute, ni un soutien psychologique. Aucune personne ne lit ces conversations en temps réel.',
        },
        {
          kind: 'p',
          text: 'Pour que Mino puisse répondre, le message de l’enfant est transmis à notre prestataire d’intelligence artificielle, accompagné du strict minimum de contexte : son prénom, son âge, son solde de temps et l’intitulé de ses missions du jour. Ni son nom de famille, ni l’adresse de la famille, ni l’adresse e-mail du parent, ni le code famille ne sont transmis.',
        },
        {
          kind: 'rows',
          rows: [
            {
              label: 'Prestataire',
              value: 'Anthropic, pour la génération des réponses du personnage. Les données transmises ne sont pas utilisées pour entraîner de modèle, et le transfert est encadré par les clauses contractuelles types de la Commission européenne.',
            },
            {
              label: 'Conservation',
              value: '30 jours, puis effacement automatique. Les conversations sont lisibles à tout moment par le parent depuis la fiche de l’enfant.',
            },
          ],
        },
        {
          kind: 'p',
          text: 'L’enfant est informé, sous chaque conversation, que Mino est un personnage et que ses parents peuvent lire ces échanges. Nous ne présentons jamais cet espace comme privé.',
        },
        {
          kind: 'p',
          text: 'Certains messages sont repérés automatiquement lorsqu’ils évoquent une situation grave pour l’enfant. Le repérage a lieu sur l’appareil lui-même, avant tout envoi : ces messages-là ne sont transmis à aucun modèle, et leur texte n’est enregistré nulle part. Mino répond alors une phrase écrite à l’avance, identique pour tous, qui oriente l’enfant vers un adulte de confiance et vers le 119, numéro national gratuit et confidentiel. Le parent est informé qu’un tel échange a eu lieu, avec sa date et la réponse de Mino, mais sans les mots de l’enfant : c’est la condition pour qu’un enfant ose parler, y compris lorsque ce qu’il a à dire concerne son entourage. Ce repérage est automatique : il n’est ni exhaustif, ni surveillé par une personne, et ne se substitue en aucun cas à la vigilance de l’adulte responsable.',
        },
      ],
    },
    {
      title: '6. Le microphone',
      blocks: [
        {
          kind: 'p',
          text: 'Un enfant qui écrit encore lentement peut dicter son message à Mino plutôt que de le taper. Cette possibilité n’est offerte que si vous y avez consenti au moment où le système vous le demande, et elle reste facultative : le clavier fonctionne toujours.',
        },
        {
          kind: 'note',
          text: 'Aucun enregistrement sonore n’est transmis à Mino ni conservé par nous. La reconnaissance vocale est effectuée par l’appareil lui-même ; seul le texte obtenu est envoyé, exactement comme s’il avait été tapé.',
        },
        {
          kind: 'p',
          text: 'Si l’appareil ne sait pas transcrire la parole sans passer par un service en ligne, la dictée n’est pas proposée : l’enfant utilise alors le microphone de son clavier, qui relève des conditions d’Apple ou de Google et non des nôtres. Le microphone n’est jamais actif en dehors des instants où votre enfant appuie volontairement sur le bouton, et un témoin visible indique qu’il écoute.',
        },
      ],
    },
    {
      title: '7. Qui a accès à vos données',
      blocks: [
        {
          kind: 'p',
          text: 'Vos données ne sont ni vendues, ni louées, ni transmises à des tiers à des fins commerciales. Elles sont accessibles à notre équipe, dans la stricte limite de ce que le support exige, et à un petit nombre de sous-traitants techniques :',
        },
        {
          kind: 'rows',
          rows: [
            { label: 'Supabase', value: 'Hébergement de la base de données et authentification, en région européenne.' },
            { label: 'Stripe', value: 'Traitement des paiements et facturation. Stripe est responsable de traitement pour les données bancaires, que nous ne voyons jamais.' },
            { label: 'Anthropic', value: 'Génération des réponses du personnage Mino, lorsque cette fonctionnalité est activée. Voir la section 5.' },
          ],
        },
        {
          kind: 'p',
          text: 'Nous privilégions un hébergement dans l’Union européenne. Lorsqu’un transfert hors UE est inévitable, il est encadré par les clauses contractuelles types de la Commission européenne.',
        },
      ],
    },
    {
      title: '8. Combien de temps nous les gardons',
      blocks: [
        {
          kind: 'rows',
          rows: [
            { label: 'Compte, enfants, missions', value: 'Pendant toute la durée de l’abonnement, puis 3 ans après la dernière activité — ou immédiatement, si vous demandez la suppression.' },
            { label: 'Historique détaillé (missions faites, minutes dépensées)', value: '90 jours. Au-delà, le détail est effacé et seul le total des minutes est conservé : le compteur de votre enfant reste juste, mais nous ne gardons pas la trace de ce qui a été fait il y a six mois.' },
            { label: 'Factures', value: '10 ans, conformément aux obligations comptables françaises.' },
            { label: 'Conversations avec Mino', value: '30 jours, puis effacement automatique.' },
            { label: 'Journaux techniques', value: '12 mois au maximum.' },
          ],
        },
        {
          kind: 'p',
          text: 'La suppression de votre compte se fait depuis l’application — Réglages, « Gérer mon compte » — et n’exige de nous écrire à personne. Elle entraîne l’effacement immédiat et définitif des profils enfants, des missions, de l’historique de temps et des minutes gagnées. Seules les factures déjà émises subsistent, pour la durée légale rappelée ci-dessus ; elles ne contiennent aucune donnée d’enfant.',
        },
      ],
    },
    {
      title: '9. Vos droits',
      blocks: [
        {
          kind: 'p',
          text: 'Le RGPD vous donne, sur vos données et sur celles de vos enfants mineurs, les droits suivants :',
        },
        {
          kind: 'bullets',
          items: [
            'Accéder à vos données et en obtenir une copie.',
            'Les faire rectifier si elles sont inexactes.',
            'Les faire effacer.',
            'Limiter ou vous opposer à leur traitement.',
            'Les récupérer dans un format réutilisable (portabilité).',
            'Définir des directives sur leur sort après votre décès.',
          ],
        },
        {
          kind: 'p',
          text: `Le droit à l’effacement s’exerce directement dans l’application, sans passer par nous : Réglages, « Gérer mon compte ». Pour les autres droits, écrivez à ${OPERATOR.privacyEmail}. Nous répondons sous un mois. Si notre réponse ne vous satisfait pas, vous pouvez saisir la CNIL — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou cnil.fr.`,
        },
      ],
    },
    {
      title: '10. Sécurité',
      blocks: [
        {
          kind: 'bullets',
          items: [
            'Les échanges entre l’application et nos serveurs sont chiffrés (HTTPS).',
            'Les mots de passe sont stockés sous forme de condensats, jamais en clair.',
            'Chaque famille est isolée par des règles de sécurité appliquées au niveau de la base de données : une requête ne peut pas atteindre les données d’une autre famille, même en cas de faille applicative.',
            'L’espace parent est protégé par un code, distinct du mot de passe du compte.',
          ],
        },
      ],
    },
    {
      title: '11. Cookies',
      blocks: [
        {
          kind: 'p',
          text: 'L’application mobile n’utilise aucun cookie publicitaire ni traceur tiers. Notre site web n’utilise que les cookies strictement nécessaires à son fonctionnement et au paiement, qui ne requièrent pas de consentement préalable. Nous n’utilisons pas de régie publicitaire.',
        },
      ],
    },
    {
      title: '12. Modification de cette politique',
      blocks: [
        {
          kind: 'p',
          text: 'Toute évolution substantielle vous sera signalée dans l’application et par e-mail avant son entrée en vigueur. La date de dernière mise à jour figure en haut de cette page.',
        },
      ],
    },
  ],
};
