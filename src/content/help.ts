import { LegalDocument } from './document';

import { MINUTES_PER_CAPSULE } from '@/domain/ledger';

/**
 * The help section.
 *
 * Written for a parent who has just installed the app and wants to know what to
 * do tonight — not a feature list. The section on what Mino does *not* do sits
 * near the top on purpose: a parent who believes the app blocks YouTube and
 * discovers otherwise at bedtime is a parent who stops trusting it.
 */
export const HELP: LegalDocument = {
  title: 'Aide',
  subtitle: 'Comment faire fonctionner Mino chez vous',
  updatedAt: '20 août 2026',
  intro: [
    {
      kind: 'p',
      text: 'Mino repose sur une seule boucle : l’enfant fait ses missions, il gagne du temps, il en profite. Tout le reste n’est que du confort autour de ça.',
    },
  ],
  sections: [
    {
      title: 'Le principe en une minute',
      blocks: [
        {
          kind: 'bullets',
          items: [
            'Vous créez des missions : de petites responsabilités du quotidien, avec le temps qu’elles font gagner.',
            'Votre enfant les voit dans son espace et appuie sur J’AI TERMINÉ quand c’est fait.',
            'Vous recevez la demande, vous validez ou vous refusez.',
            'Dès que vous validez, les minutes arrivent sur son compteur. Il peut les utiliser.',
          ],
        },
        {
          kind: 'note',
          text: 'Rien n’est jamais retiré à l’enfant en punition. Mino ne sert qu’à donner, jamais à sanctionner : c’est ce qui fait qu’il continue d’y venir.',
        },
      ],
    },
    {
      title: 'Ce que Mino fait, et ce qu’il ne fait pas',
      blocks: [
        {
          kind: 'p',
          text: 'Mino tient le compte du temps gagné et le décompte pendant les sessions. Dans sa version actuelle, il ne bloque pas lui-même l’accès aux autres applications de l’appareil.',
        },
        {
          kind: 'p',
          text: 'Pour un blocage réel, associez Mino au contrôle parental de votre système. Les deux se complètent très bien : Mino décide combien de temps est accordé, le système le fait respecter.',
        },
        {
          kind: 'rows',
          rows: [
            {
              label: 'Sur iPhone et iPad',
              value: 'Réglages → Temps d’écran → Limites d’apps. Fixez une limite quotidienne sur les applications concernées, et gardez le code pour vous.',
            },
            {
              label: 'Sur Android',
              value: 'Application Family Link → votre enfant → Contrôles → Limites de temps par application.',
            },
          ],
        },
      ],
    },
    {
      title: 'Créer vos premières missions',
      blocks: [
        {
          kind: 'p',
          text: 'Le plus rapide est de partir d’une routine : Missions → Routines prêtes à l’emploi. Choisissez un thème — le matin, le coucher, les devoirs — désignez l’enfant, décochez ce qui ne vous correspond pas, et tout est créé d’un coup.',
        },
        {
          kind: 'p',
          text: 'Les suggestions s’adaptent : à l’âge de l’enfant, et à la présence de frères et sœurs. Vous pouvez évidemment tout modifier ensuite, ou créer une mission entièrement à vous.',
        },
        {
          kind: 'note',
          text: 'Commencez petit : trois à cinq missions par enfant. Une liste trop longue décourage, et l’enfant finit par ne plus la regarder.',
        },
      ],
    },
    {
      title: 'Combien de minutes par mission ?',
      blocks: [
        {
          kind: 'p',
          text: 'Il n’y a pas de barème universel, mais un repère utile : le temps gagné doit rester proportionné à l’effort, et le total d’une journée doit correspondre à ce que vous accepteriez de toute façon.',
        },
        {
          kind: 'rows',
          rows: [
            { label: 'Un geste rapide', value: '5 minutes — faire son lit, mettre son linge au panier.' },
            { label: 'Une vraie tâche', value: '10 à 15 minutes — ranger sa chambre, débarrasser la table.' },
            { label: 'Un effort long', value: '20 minutes — les devoirs, une aide en cuisine.' },
          ],
        },
        {
          kind: 'p',
          text: 'Si votre enfant accumule beaucoup plus de temps que ce que vous souhaitez lui accorder, baissez les valeurs plutôt que de refuser des missions accomplies : refuser ce qui a été fait casse la confiance dans le système.',
        },
      ],
    },
    {
      title: 'Les minos',
      blocks: [
        {
          kind: 'p',
          text: 'Côté enfant, les minutes s’appellent des minos. C’est le même chiffre : un mino vaut exactement une minute de temps d’écran, toujours. Ce n’est pas une monnaie — les minos ne s’achètent pas, ne se vendent pas, et ne servent à rien d’autre qu’au temps qu’ils désignent.',
        },
        {
          kind: 'p',
          text: `Les plus jeunes, qui ne lisent pas encore les chiffres, peuvent compter les capsules : une capsule vaut ${MINUTES_PER_CAPSULE} minos.`,
        },
      ],
    },
    {
      title: 'Valider une demande',
      blocks: [
        {
          kind: 'p',
          text: 'Les demandes en attente apparaissent sur l’accueil de l’espace parent. Validez, et les minutes sont ajoutées immédiatement — votre enfant voit une célébration et son compteur monter.',
        },
        {
          kind: 'p',
          text: 'Si la mission n’a pas été faite, refusez : elle repasse simplement en « à faire », sans pénalité. Expliquez-lui de vive voix, c’est plus efficace que n’importe quel message dans une application.',
        },
      ],
    },
    {
      title: 'Utiliser son temps',
      blocks: [
        {
          kind: 'p',
          text: 'Dans l’onglet Mon temps, l’enfant choisit combien de minos il veut utiliser et lance une session. Un minuteur se déclenche, et seul le temps réellement écoulé est décompté : s’il arrête au bout de 10 minutes sur 20, les 10 autres lui restent.',
        },
      ],
    },
    {
      title: 'Plusieurs enfants',
      blocks: [
        {
          kind: 'p',
          text: 'Chaque enfant a son profil, son compteur et ses missions. Une même mission peut être attribuée à plusieurs enfants d’un coup.',
        },
        {
          kind: 'p',
          text: 'La routine « Vivre ensemble » n’apparaît que dans les familles de plusieurs enfants, et nomme le frère ou la sœur concerné quand il n’y en a qu’un.',
        },
      ],
    },
    {
      title: 'Protéger l’espace parent',
      blocks: [
        {
          kind: 'p',
          text: 'L’espace parent est protégé par un code à 4 chiffres, indépendant du mot de passe de votre compte. Choisissez-en un que votre enfant ne devinera pas — évitez sa date de naissance.',
        },
        {
          kind: 'p',
          text: 'Le code famille, lui, sert uniquement à connecter l’appareil d’un enfant à votre famille. Il est différent de votre code de parrainage, que vous pouvez partager sans risque.',
        },
      ],
    },
    {
      title: 'Abonnement et parrainage',
      blocks: [
        {
          kind: 'p',
          text: 'Tout se gère dans Réglages → Abonnement : changer de formule, mettre à jour la carte, et résilier en quelques secondes. La résiliation prend effet à la fin de la période déjà payée, et vous gardez l’accès jusque-là.',
        },
        {
          kind: 'p',
          text: 'Votre code de parrainage se trouve dans Réglages → Parrainage. Chaque famille qui s’abonne grâce à vous vous offre un mois, et démarre elle-même avec un essai plus long.',
        },
      ],
    },
    {
      title: 'Un problème ?',
      blocks: [
        {
          kind: 'rows',
          rows: [
            {
              label: 'Mon enfant ne voit pas sa mission',
              value: 'Vérifiez sa récurrence : une mission « certains jours » n’apparaît que les jours choisis.',
            },
            {
              label: 'Le compteur ne bouge pas',
              value: 'Les minutes n’arrivent qu’après votre validation. Regardez les demandes en attente sur l’accueil parent.',
            },
            {
              label: 'J’ai validé par erreur',
              value: 'Ajustez le compteur de l’enfant depuis sa fiche : l’opération est tracée dans l’historique, rien n’est effacé.',
            },
          ],
        },
        {
          kind: 'p',
          text: 'Pour tout le reste, écrivez-nous depuis Réglages : nous répondons à chaque message.',
        },
      ],
    },
  ],
};
