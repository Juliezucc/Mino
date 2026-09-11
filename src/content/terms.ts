import { LegalDocument, OPERATOR } from './document';

import { ANNUAL_PRICE_EUR, MONTHLY_PRICE_EUR, REFERRAL, TRIAL_DAYS } from '@/domain/billing';

/**
 * Terms of sale and of use — French consumer law, EU distance selling.
 *
 * The commercial rules here are the same constants the code enforces, imported
 * rather than retyped: a price or a referral cap that drifts between the terms
 * and the billing engine is exactly the kind of discrepancy that turns into a
 * dispute.
 *
 * NOT LEGAL ADVICE. Have a lawyer review this before selling, in particular the
 * withdrawal, tacit renewal and mediation clauses.
 */
export const TERMS: LegalDocument = {
  title: 'Conditions générales',
  subtitle: 'Conditions générales de vente et d’utilisation de Mino',
  // Un contrat qui change de contenu change de date. L'article 7 vient de
  // retirer un avantage au filleul : le laisser au 21 août ferait passer une
  // modification pour un texte inchangé.
  updatedAt: '11 septembre 2026',
  intro: [
    {
      kind: 'p',
      text: 'Ces conditions régissent l’utilisation de l’application Mino et l’abonnement qui y donne accès. En créant un compte, vous les acceptez.',
    },
  ],
  sections: [
    {
      title: '1. L’éditeur',
      blocks: [
        {
          kind: 'p',
          text: `Mino est édité par ${OPERATOR.legalName}, ${OPERATOR.legalForm}, dont le siège social est situé ${OPERATOR.address}, immatriculée sous le numéro ${OPERATOR.rcs}, TVA intracommunautaire ${OPERATOR.vatNumber}. Directrice de la publication : ${OPERATOR.publisher}. Hébergement : ${OPERATOR.host}. Contact : ${OPERATOR.email}.`,
        },
      ],
    },
    {
      title: '2. Le service',
      blocks: [
        {
          kind: 'p',
          text: 'Mino permet à un parent de définir de petites responsabilités du quotidien, appelées missions, et d’accorder à son enfant du temps d’écran lorsqu’elles sont accomplies. L’enfant signale la mission comme terminée, le parent confirme ou la remet à faire, et le temps accordé s’ajoute au compteur de l’enfant. Le parent peut décider, mission par mission, que certaines se comptent sans confirmation.',
        },
        {
          kind: 'note',
          text: 'Mino bloque lui-même les applications que vous désignez sur l’appareil de votre enfant, et lève ce blocage pendant le temps qu’il a gagné. Les deux systèmes d’exploitation ne l’autorisent pas de la même façon : sur iPhone et iPad, Mino empêche réellement l’ouverture des applications désignées, par le mécanisme de contrôle parental d’Apple ; sur Android, il affiche un écran par-dessus l’application désignée dès qu’elle passe au premier plan, ce qui la rend inutilisable sans l’arrêter — cet écran apparaît en une seconde environ, et l’application reste ouverte en arrière-plan. Le retour du blocage à la fin du temps gagné intervient à la minute près sur Android, et par tranches d’un quart d’heure sur iPhone et iPad, Apple ne permettant pas mieux sans que l’application soit lancée.',
        },
        {
          kind: 'note',
          text: 'Ce blocage suppose une autorisation que le système d’exploitation vous demande d’accorder sur l’appareil de votre enfant, et que vous pouvez retirer à tout moment depuis ses réglages. Tant qu’elle n’est pas accordée, Mino vous le signale et vous propose de compter le temps sans rien bloquer ; si vous ne choisissez pas ce mode, votre enfant ne peut pas lancer de séance, afin que ses minutes ne soient pas dépensées pour un écran que rien n’ouvre. La restriction relève alors du contrôle parental du système (Temps d’écran sur iOS, Family Link ou Bien-être numérique sur Android), que le guide intégré détaille.',
        },
        {
          kind: 'note',
          text: 'Le choix des applications vous appartient entièrement : Mino n’en désigne aucune de lui-même. Sur iPhone et iPad, il ignore lesquelles vous avez cochées — Apple ne lui transmet que des identifiants anonymes et leur nombre. Sur Android, où ce mécanisme n’existe pas, il lit la liste des applications installées pour vous les présenter et conserve sur l’appareil, et sur lui seul, le nom de celles que vous cochez ; cette liste n’est jamais transmise à nos serveurs, qui n’en reçoivent que le nombre.',
        },
        {
          kind: 'note',
          text: 'Mino ne se désigne jamais lui-même, afin que votre enfant puisse toujours consulter ses missions : sur Android il s’exclut expressément, et sur iPhone et iPad le système protège l’application qui détient l’autorisation. Sur Android, Mino écarte de la même façon le composeur d’appels défini sur l’appareil. Sur iPhone et iPad, ne pouvant pas le reconnaître, il ne le peut pas : il vous appartient de ne cocher ni Téléphone, ni Messages, ni une catégorie qui les contiendrait. Les dispositifs d’appel d’urgence propres au système d’exploitation — appel depuis l’écran verrouillé, SOS — ne passent pas par Mino et ne sont pas bloqués par lui ; Mino ne s’y substitue pas et ne peut pas s’en porter garant.',
        },
        {
          kind: 'p',
          text: 'Vous pouvez également déclarer des plages horaires — un mercredi après-midi, des vacances — pendant lesquelles les applications bloquées s’ouvrent librement sans qu’aucune minute ne soit décomptée. Le blocage reprend de lui-même à la fin de la plage.',
        },
        {
          kind: 'p',
          text: 'Mino ne comporte ni monnaie virtuelle, ni publicité, ni messagerie entre personnes, ni contenu public. Les minos affichés à l’enfant sont l’unité dans laquelle le service exprime les minutes de temps d’écran : un mino vaut toujours une minute, ils ne peuvent être ni achetés, ni vendus, ni convertis. L’abonnement peut être souscrit depuis l’application, par l’intermédiaire de l’App Store ou de Google Play ; aucun autre achat n’est proposé.',
        },
      ],
    },
    {
      title: '3. Mino, le compagnon',
      blocks: [
        {
          kind: 'p',
          text: 'Lorsque son temps d’écran est épuisé, l’enfant peut échanger avec Mino, le personnage de l’application. Ces échanges sont produits par un modèle de langage et non par une personne : personne ne lit les messages en direct, et Mino ne doit jamais être considéré comme un interlocuteur de confiance pour une situation grave.',
        },
        {
          kind: 'p',
          text: 'Le nombre d’échanges est volontairement limité à une vingtaine par jour et par enfant : Mino tient compagnie, il ne remplace pas le temps d’écran qui vient de se terminer, et il encourage l’enfant à faire autre chose. Mino ne confirme aucune mission et n’accorde aucune minute — cela n’appartient qu’au parent.',
        },
        {
          kind: 'note',
          text: 'Le compagnon peut être désactivé enfant par enfant depuis l’espace parent. Le parent peut relire l’intégralité des conversations, et l’enfant en est informé sur son propre écran. Si un message évoque une situation de danger, Mino cesse la conversation et oriente vers un adulte et vers le 119, numéro national gratuit et confidentiel de l’enfance en danger.',
        },
        {
          kind: 'p',
          text: 'Le microphone n’est utilisé que si l’enfant appuie sur le bouton prévu à cet effet, pour dicter un message ; aucune écoute n’a lieu en dehors de ce geste. Les modalités de traitement figurent dans la politique de confidentialité.',
        },
      ],
    },
    {
      title: '4. Qui peut souscrire, et sous quelle responsabilité',
      blocks: [
        {
          kind: 'p',
          text: 'Le compte doit être ouvert par une personne majeure, titulaire de l’autorité parentale sur les enfants dont elle crée les profils, ou dûment autorisée par ce titulaire. En créant un profil enfant, vous déclarez disposer de cette qualité.',
        },
        {
          kind: 'p',
          text: 'Le contrat est conclu avec cette personne seule, désignée ici comme le titulaire. Elle peut inviter un second adulte à rejoindre la famille depuis son propre appareil, en lui communiquant le code famille puis le code à quatre chiffres : celui-ci accède alors aux mêmes profils, missions et historiques, et peut les modifier, sans souscrire de contrat ni ouvrir de compte. Le titulaire répond de cette invitation comme de ses propres actes, et peut y mettre fin à tout moment depuis Réglages, « Les parents » — l’appareil concerné perd immédiatement tout accès.',
        },
        {
          kind: 'note',
          text: 'La gestion du contrat demeure attachée au titulaire : lui seul peut modifier l’adresse et le mot de passe du compte, souscrire ou faire cesser l’abonnement, et supprimer la famille. Un second adulte ne le peut pas, et le service le lui refuse. Il vous appartient de garder confidentiels le code famille et le code à quatre chiffres, qui suffisent ensemble à rejoindre votre famille ; si vous pensez qu’ils ont été découverts, changez le code à quatre chiffres et retirez les profils que vous ne reconnaissez pas.',
        },
        {
          kind: 'note',
          text: 'L’enfant demeure à tout moment sous la responsabilité et la surveillance du titulaire de l’autorité parentale. Mino est un outil d’organisation familiale : il n’est ni un dispositif de surveillance, ni un mode de garde, et ne se substitue en aucun cas à la présence d’un adulte.',
        },
        {
          kind: 'p',
          text: 'Les missions que Mino propose sont des suggestions. Il vous appartient d’apprécier, pour chacune, si elle est adaptée à l’âge, à la maturité et aux capacités de votre enfant, de l’expliquer et de l’encadrer.',
        },
        {
          kind: 'bullets',
          items: [
            'Toute mission impliquant la cuisine, un appareil électroménager, un objet tranchant, une source de chaleur ou un produit d’entretien doit être réalisée en présence et sous la surveillance d’un adulte.',
            'Aucune mission ne doit conduire un enfant à sortir seul du domicile sans votre accord exprès et adapté à son âge.',
            'La garde d’un frère ou d’une sœur par un mineur ne décharge en aucun cas l’adulte de sa responsabilité : un adulte responsable doit rester joignable et disponible.',
            'Vous restez seul décisionnaire du temps d’écran accordé à votre enfant et des contenus auxquels votre enfant accède.',
          ],
        },
        {
          kind: 'p',
          text: 'Notre responsabilité ne saurait être engagée à raison de la réalisation d’une mission créée ou acceptée par vous, ni des conséquences de l’usage que votre enfant fait du temps d’écran que vous lui accordez.',
        },
      ],
    },
    {
      title: '5. Prix',
      blocks: [
        {
          kind: 'rows',
          rows: [
            { label: 'Abonnement mensuel', value: `${MONTHLY_PRICE_EUR.toFixed(2).replace('.', ',')} € TTC par mois, sans engagement.` },
            { label: 'Abonnement annuel', value: `${ANNUAL_PRICE_EUR.toFixed(2).replace('.', ',')} € TTC par an, soit une remise par rapport au tarif mensuel.` },
          ],
        },
        {
          kind: 'p',
          text: 'Un seul abonnement couvre toute la famille, quel que soit le nombre d’enfants et d’appareils. Les prix sont indiqués toutes taxes comprises ; la TVA applicable est celle du pays de résidence du client au sein de l’Union européenne. Nous pouvons faire évoluer nos tarifs, en vous en informant au moins un mois à l’avance ; le nouveau tarif ne s’applique qu’aux périodes postérieures, et vous pouvez résilier d’ici là.',
        },
      ],
    },
    {
      title: '6. La période d’essai',
      blocks: [
        {
          kind: 'p',
          // Le moyen de paiement est enregistré à l'inscription depuis le
          // 9 septembre 2026. Le taire tout en annonçant un démarrage
          // automatique laisserait le premier prélèvement arriver sans que rien
          // ne l'ait annoncé — c'est précisément ce que la loi impose d'écrire.
          text: `Tout nouveau compte bénéficie d’une période d’essai de ${TRIAL_DAYS} jours, donnant accès à l’intégralité du service. Aucun montant n’est prélevé pendant cette période. Votre moyen de paiement est enregistré au moment de l’inscription, sans être débité : il permet à l’abonnement de démarrer à l’issue de l’essai si vous n’avez pas résilié entre-temps.`,
        },
        {
          kind: 'p',
          text: 'À l’issue de l’essai, l’abonnement choisi démarre automatiquement, sauf si vous avez résilié avant son terme. Vous pouvez résilier à tout moment pendant l’essai, en quelques secondes depuis votre compte, sans avoir à vous justifier et sans qu’aucune somme ne soit due.',
        },
        {
          /**
           * Cette phrase promettait « Nous vous prévenons par e-mail avant la
           * fin de la période d'essai ». Le tuyau d'envoi existe, l'envoi
           * planifié n'existe pas : le contrat annonçait donc un courrier que
           * personne ne recevait. Une clause qu'on ne tient pas vaut moins que
           * pas de clause du tout.
           *
           * Ce qui la remplace est vrai aujourd'hui : la date est écrite avant
           * la confirmation, elle reste consultable, et les boutiques
           * préviennent d'elles-mêmes leurs abonnés avant la conversion d'un
           * essai.
           *
           * **Reste dû, et daté.** L'article L. 215-1 impose d'informer le
           * consommateur avant la reconduction tacite d'un abonnement annuel.
           * Cela ne concerne pas les abonnements pris dans une boutique — Apple
           * et Google sont vendeurs et s'en chargent — mais bien ceux pris sur
           * le site. Le premier abonnement annuel Stripe date du 9 octobre
           * 2026 : la fenêtre d'information s'ouvre en juillet 2027. Voir
           * `docs/ops/emails.md`.
           */
          kind: 'p',
          text: 'La date de votre premier prélèvement vous est indiquée à l’écran avant que vous ne confirmiez, et reste consultable à tout moment dans Réglages → Abonnement. Pour un abonnement souscrit dans l’application, l’App Store ou Google Play vous prévient également avant la fin de l’essai.',
        },
      ],
    },
    {
      title: '7. Le parrainage',
      blocks: [
        {
          kind: 'p',
          text: 'Chaque abonné dispose d’un code de parrainage personnel qu’il peut partager librement.',
        },
        {
          kind: 'bullets',
          items: [
            `La personne parrainée bénéficie de la période d’essai de ${TRIAL_DAYS} jours proposée à tout nouvel abonné. Le parrainage ne lui accorde aucun avantage supplémentaire.`,
            `Le parrain reçoit ${REFERRAL.referrerFreeMonths} mois d’abonnement offert lorsque son filleul devient abonné payant, c’est-à-dire à l’issue de son premier paiement effectif.`,
            'Chaque mois offert est déduit de votre prochaine facture. Si vous êtes encore en période d’essai, il en repousse le terme d’autant. Les mois offerts se cumulent.',
            `Un même parrain peut recevoir au maximum ${REFERRAL.maxFreeMonthsPerYear} mois offerts par période de douze mois.`,
            'Un code ne peut pas être utilisé par un foyer déjà client, ni sur un compte utilisant un moyen de paiement déjà associé à un autre compte.',
            'Les mois offerts n’ont aucune valeur monétaire : ils ne peuvent être ni échangés, ni remboursés, ni transférés.',
          ],
        },
        {
          kind: 'p',
          text: 'Nous nous réservons le droit d’annuler des mois offerts obtenus par des moyens frauduleux, notamment par la création de comptes fictifs, et de suspendre le compte concerné.',
        },
      ],
    },
    {
      title: '8. Paiement et reconduction',
      blocks: [
        {
          kind: 'p',
          text: 'L’abonnement peut être souscrit de deux façons, et cette distinction emporte des conséquences que nous précisons ci-dessous.',
        },
        {
          kind: 'p',
          text: 'Depuis notre site, le paiement est effectué en ligne par carte bancaire via notre prestataire Stripe. Agence Wheb est alors le vendeur, émet la facture et collecte la TVA. Vos coordonnées bancaires ne sont jamais conservées par Mino.',
        },
        {
          kind: 'p',
          text: 'Depuis l’application, le paiement est effectué par l’intermédiaire de l’App Store d’Apple ou du Google Play Store, conformément aux règles de ces plateformes. Apple ou Google est alors le vendeur de l’abonnement : la facturation, la collecte de la TVA, la gestion du moyen de paiement, la résiliation et les éventuels remboursements relèvent de ses conditions générales et de votre compte chez lui. Agence Wheb reste l’éditeur du service et votre interlocuteur pour tout ce qui concerne Mino lui-même.',
        },
        {
          kind: 'p',
          text: 'L’abonnement se reconduit tacitement à chaque échéance, mensuelle ou annuelle. Conformément à l’article L. 215-1 du Code de la consommation, nous vous informons par écrit, au plus tôt trois mois et au plus tard un mois avant le terme de chaque période annuelle, de la possibilité de ne pas reconduire votre abonnement.',
        },
        {
          kind: 'p',
          text: 'En cas d’échec de paiement, l’accès est suspendu après relance. Les données de la famille sont conservées le temps de régulariser la situation.',
        },
      ],
    },
    {
      title: '9. Résiliation',
      blocks: [
        {
          kind: 'note',
          text: 'Vous pouvez résilier à tout moment, sans appel, sans courrier et sans justification.',
        },
        {
          kind: 'p',
          text: 'Si vous vous êtes abonné depuis notre site, la résiliation se fait en trois clics depuis Réglages → Abonnement. Conformément à l’article L. 215-1-1 du Code de la consommation, cette fonctionnalité est accessible en permanence et directement depuis votre espace.',
        },
        {
          kind: 'p',
          text: 'Si vous vous êtes abonné depuis l’application, la résiliation s’effectue dans la rubrique Abonnements de votre compte Apple ou Google, seul endroit où ces plateformes permettent de la faire. L’écran Abonnement de Mino comporte un bouton qui vous y conduit directement, en un geste.',
        },
        {
          kind: 'p',
          text: 'Dans les deux cas, la résiliation prend effet à la fin de la période déjà payée : vous conservez l’accès jusque-là, et rien n’est prélevé ensuite.',
        },
        {
          kind: 'note',
          text: 'Supprimer votre compte ne résilie pas l’abonnement. Si vous vous êtes abonné par l’App Store ou Google Play, eux seuls peuvent y mettre fin, et le prélèvement se poursuivrait sur un compte effacé, sans que nous puissions le rattacher à quoi que ce soit. Résiliez d’abord, supprimez ensuite : l’application vous le rappelle au moment de confirmer la suppression.',
        },
        {
          kind: 'p',
          text: 'Nous pouvons de notre côté résilier un compte en cas de manquement grave à ces conditions, après vous en avoir informé.',
        },
      ],
    },
    {
      title: '10. Droit de rétractation',
      blocks: [
        {
          kind: 'p',
          text: 'Vous disposez d’un délai de quatorze jours à compter de la souscription pour vous rétracter, sans avoir à motiver votre décision, conformément aux articles L. 221-18 et suivants du Code de la consommation.',
        },
        {
          kind: 'p',
          text: `Si vous demandez que le service commence immédiatement, vous pouvez toujours vous rétracter dans ce délai ; seule la part du service effectivement fournie reste due. En pratique, la période d’essai de ${TRIAL_DAYS} jours rend cette question sans objet dans la quasi-totalité des cas : rien ne vous est prélevé avant son terme.`,
        },
        {
          kind: 'p',
          text: `Pour exercer ce droit, il suffit de nous écrire à ${OPERATOR.email}. Si votre abonnement a été souscrit depuis l’application, la demande de remboursement doit être adressée à Apple ou à Google, vendeur de cet abonnement, selon la procédure prévue par sa plateforme ; nous vous aidons volontiers à la formuler, mais nous n’avons pas la faculté de procéder nous-mêmes au remboursement.`,
        },
        {
          kind: 'p',
          text: 'Vous n’êtes pas tenu d’utiliser le formulaire ci-dessous : une déclaration dénuée d’ambiguïté suffit. Il est reproduit parce que la loi nous impose de vous le mettre à disposition.',
        },
        {
          kind: 'form',
          text: [
            'MODÈLE DE FORMULAIRE DE RÉTRACTATION',
            '(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)',
            '',
            `À l’attention de ${OPERATOR.legalName}, ${OPERATOR.address} — ${OPERATOR.email} :`,
            '',
            'Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :',
            '',
            'Commandé le (*)/reçu le (*) :',
            'Nom du (des) consommateur(s) :',
            'Adresse du (des) consommateur(s) :',
            'Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :',
            'Date :',
            '',
            '(*) Rayez la mention inutile.',
          ].join('\n'),
        },
      ],
    },
    {
      title: '11. Garantie légale de conformité',
      blocks: [
        {
          kind: 'p',
          text: 'Mino est un service numérique fourni de manière continue. À ce titre, et conformément aux articles L. 224-25-1 et suivants du Code de la consommation, nous répondons des défauts de conformité qui apparaissent pendant toute la durée de la fourniture prévue au contrat — et non pendant un délai fixe.',
        },
        {
          kind: 'p',
          text: 'Le service est conforme s’il correspond à sa description, s’il présente les qualités qu’un usage de ce type permet d’attendre, et s’il continue de les présenter, mises à jour comprises, pendant toute la durée de votre abonnement.',
        },
        {
          kind: 'p',
          text: 'En cas de défaut de conformité, vous pouvez exiger sa mise en conformité sans frais. Si nous ne pouvons pas y procéder, si nous n’y procédons pas dans un délai raisonnable, ou si le défaut réapparaît, vous pouvez obtenir une réduction du prix ou la résolution du contrat, remboursement à la clé pour la période non conforme. La résolution est de droit lorsque le défaut est grave.',
        },
        {
          kind: 'note',
          text: 'Cette garantie s’ajoute à la garantie légale contre les vices cachés du Code civil, et ne se substitue à aucune d’elles. Elle s’exerce sans frais pour vous : écrivez-nous, et nous n’exigerons ni forme particulière, ni preuve d’achat autre que votre compte. Lorsqu’une période d’indisponibilité suit votre demande, la durée de la garantie est suspendue jusqu’au rétablissement du service.',
        },
      ],
    },
    {
      title: '12. Disponibilité et responsabilité',
      blocks: [
        {
          kind: 'p',
          text: 'Nous mettons tout en œuvre pour assurer la disponibilité du service, sans pouvoir garantir une continuité absolue : des interruptions peuvent survenir pour maintenance ou pour des causes indépendantes de notre volonté.',
        },
        {
          kind: 'p',
          text: 'Mino est un outil d’organisation familiale. Il ne se substitue ni à votre autorité parentale, ni à un dispositif de contrôle parental système, ni à un accompagnement éducatif ou médical. Vous restez seul décisionnaire du temps d’écran accordé à votre enfant.',
        },
        {
          kind: 'p',
          text: 'Cela vaut en particulier pour le compagnon décrit à l’article 3 : ses réponses sont générées automatiquement, elles peuvent être imprécises, et elles ne constituent ni un avis, ni un accompagnement, ni une surveillance. Aucune personne ne lit les conversations en temps réel.',
        },
      ],
    },
    {
      title: '13. Propriété intellectuelle',
      blocks: [
        {
          kind: 'p',
          text: 'L’application, sa charte graphique, la mascotte Mino et l’ensemble de ses contenus sont protégés. Votre abonnement vous confère un droit d’usage personnel et familial, non exclusif et non cessible. Les contenus que vous créez — noms de missions, prénoms des enfants — restent les vôtres.',
        },
      ],
    },
    {
      title: '14. Données personnelles',
      blocks: [
        {
          kind: 'p',
          text: 'Le traitement de vos données est décrit dans notre politique de confidentialité, accessible depuis les réglages de l’application, qui fait partie intégrante des présentes conditions.',
        },
      ],
    },
    {
      title: '15. Réclamations et médiation',
      blocks: [
        {
          kind: 'p',
          text: `Pour toute réclamation, écrivez-nous à ${OPERATOR.email} : nous cherchons toujours une solution amiable en premier, et c'est presque toujours la voie la plus rapide.`,
        },
        {
          kind: 'p',
          text: `À défaut de règlement dans un délai raisonnable, vous pouvez recourir gratuitement au médiateur de la consommation dont nous relevons : ${OPERATOR.mediator.name}. La saisine s'effectue en ligne à l'adresse ${OPERATOR.mediator.website}.`,
        },
        {
          kind: 'p',
          text: 'Conformément à l’article L. 612-2 du Code de la consommation, le médiateur ne peut être saisi que si vous nous avez préalablement adressé une réclamation écrite restée sans solution, et dans un délai d’un an à compter de cette réclamation.',
        },
        {
          kind: 'note',
          text: 'Le recours à la médiation est gratuit pour vous, facultatif, et ne vous prive à aucun moment de la possibilité de saisir la justice.',
        },
      ],
    },
    {
      title: '16. Modification des présentes conditions',
      blocks: [
        {
          kind: 'p',
          text: 'Nous pouvons faire évoluer ces conditions, pour tenir compte d’un changement du service, d’une évolution de la loi, ou d’une clarification.',
        },
        {
          kind: 'p',
          text: 'Toute modification vous est annoncée par e-mail et dans l’application au moins un mois avant son entrée en vigueur, avec la mention de ce qui change. Elle ne s’applique qu’aux périodes d’abonnement postérieures à cette entrée en vigueur : la période déjà payée reste régie par les conditions en vigueur lorsque vous l’avez souscrite.',
        },
        {
          kind: 'note',
          text: 'Si une modification ne vous convient pas, vous pouvez résilier sans frais avant qu’elle ne prenne effet, et vous conservez l’accès jusqu’au terme de la période déjà payée. Nous ne modifions jamais le prix, la durée ni la consistance du service en cours de période sans votre accord. Chaque version porte sa date, et la version en vigueur est toujours celle affichée dans l’application.',
        },
      ],
    },
    {
      title: '17. Droit applicable',
      blocks: [
        {
          kind: 'p',
          text: 'Ces conditions sont soumises au droit français. En tant que consommateur, vous conservez le bénéfice des dispositions impératives de la loi de votre pays de résidence au sein de l’Union européenne.',
        },
      ],
    },
  ],
};
