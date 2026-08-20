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
  updatedAt: '20 août 2026',
  intro: [
    {
      kind: 'p',
      text: 'Mino est une application familiale utilisée par des enfants. Nous avons construit le produit autour d’un principe simple : ne collecter que ce qui est strictement nécessaire pour qu’il fonctionne, et rien d’autre.',
    },
    {
      kind: 'note',
      text: 'Pas de publicité. Pas de revente de données. Pas de traceur publicitaire. Pas de géolocalisation. Pas de messagerie. Pas de profil public. Aucun enfant n’est visible par une autre famille que la sienne.',
    },
  ],
  sections: [
    {
      title: '1. Qui est responsable de vos données',
      blocks: [
        {
          kind: 'p',
          text: `Le responsable du traitement est ${OPERATOR.legalName}, ${OPERATOR.legalForm}, dont le siège social est situé ${OPERATOR.address}, immatriculée sous le numéro ${OPERATOR.siret}.`,
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
          text: 'Elles se répartissent en quatre catégories, et la liste ci-dessous est exhaustive.',
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
              value: 'Prénom, âge, avatar illustré choisi dans une liste, et un code PIN facultatif. Aucune adresse e-mail, aucun nom de famille, aucune photo, aucun numéro de téléphone, aucune donnée de localisation.',
            },
            {
              label: 'Utilisation',
              value: 'Les missions créées, les demandes de validation, les minutes gagnées et utilisées, les sessions de temps d’écran. Ces données existent parce qu’elles sont l’application elle-même.',
            },
            {
              label: 'Abonnement',
              value: 'Statut de l’abonnement, dates, codes de parrainage. Les coordonnées bancaires ne transitent jamais par Mino : elles sont saisies et conservées directement par notre prestataire de paiement.',
            },
          ],
        },
        {
          kind: 'note',
          text: 'Nous ne collectons aucune donnée sensible au sens du RGPD : ni origine, ni opinions, ni santé, ni biométrie. Nous ne demandons jamais le nom de famille d’un enfant.',
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
          kind: 'bullets',
          items: [
            'Un enfant ne peut pas être contacté depuis l’application : il n’y a ni messagerie, ni commentaire, ni partage.',
            'Un profil enfant n’est visible que par les membres de sa propre famille. Les règles de sécurité de notre base de données l’empêchent techniquement, pas seulement contractuellement.',
            'Aucune publicité, aucune mesure d’audience marketing et aucun traceur tiers ne sont présents dans l’expérience enfant.',
            'Le parent peut supprimer un profil enfant à tout moment ; ses données sont alors effacées.',
          ],
        },
      ],
    },
    {
      title: '5. Qui a accès à vos données',
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
          ],
        },
        {
          kind: 'p',
          text: 'Nous privilégions un hébergement dans l’Union européenne. Lorsqu’un transfert hors UE est inévitable, il est encadré par les clauses contractuelles types de la Commission européenne.',
        },
      ],
    },
    {
      title: '6. Combien de temps nous les gardons',
      blocks: [
        {
          kind: 'rows',
          rows: [
            { label: 'Compte et contenu familial', value: 'Pendant toute la durée de l’abonnement, puis 3 ans après la dernière activité — ou immédiatement, si vous demandez la suppression.' },
            { label: 'Factures', value: '10 ans, conformément aux obligations comptables françaises.' },
            { label: 'Journaux techniques', value: '12 mois au maximum.' },
          ],
        },
        {
          kind: 'p',
          text: 'La suppression de votre compte entraîne l’effacement des profils enfants, des missions et de l’historique de temps associés.',
        },
      ],
    },
    {
      title: '7. Vos droits',
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
          text: `Pour exercer ces droits, écrivez à ${OPERATOR.privacyEmail}. Nous répondons sous un mois. Si notre réponse ne vous satisfait pas, vous pouvez saisir la CNIL — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou cnil.fr.`,
        },
      ],
    },
    {
      title: '8. Sécurité',
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
      title: '9. Cookies',
      blocks: [
        {
          kind: 'p',
          text: 'L’application mobile n’utilise aucun cookie publicitaire ni traceur tiers. Notre site web n’utilise que les cookies strictement nécessaires à son fonctionnement et au paiement, qui ne requièrent pas de consentement préalable. Nous n’utilisons pas de régie publicitaire.',
        },
      ],
    },
    {
      title: '10. Modification de cette politique',
      blocks: [
        {
          kind: 'p',
          text: 'Toute évolution substantielle vous sera signalée dans l’application et par e-mail avant son entrée en vigueur. La date de dernière mise à jour figure en haut de cette page.',
        },
      ],
    },
  ],
};
