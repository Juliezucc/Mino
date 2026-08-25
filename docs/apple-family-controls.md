# Demande d'autorisation Family Controls (Apple)

Pour que Mino verrouille et déverrouille réellement les applications sur iPhone
et iPad, Apple doit nous accorder l'entitlement **`com.apple.developer.family-controls`**
en mode distribution. Il n'est pas attribué automatiquement : il se demande, et
la réponse prend du temps.

**C'est le chemin critique du projet.** Tout le reste — le module natif, le
passage en development build, la version Android — peut avancer pendant
l'instruction. Déposez la demande d'abord.

## Où déposer

**https://developer.apple.com/contact/request/family-controls-distribution**

(vérifié le 25 août 2026 ; si l'adresse a bougé, chercher « Family Controls
Distribution » depuis le compte développeur.)

### Deux entitlements, pas un

C'est le point qui se rate, et il coûte une semaine quand on le découvre tard.

| | À quoi il sert | Comment on l'obtient |
|---|---|---|
| **Development** | Compiler et tester sur son propre appareil | Se coche dans le portail, **sans demande** |
| **Distribution** | TestFlight **et** App Store | **Sur dossier**, formulaire ci-dessus |

On peut donc commencer à développer immédiatement avec le premier. Mais rien ne
part chez un testeur, ni chez Apple, sans le second.

### Une demande PAR bundle identifier

Et l'extension compte comme un bundle à part entière. Il faut donc **deux
demandes** :

| Cible | Bundle identifier |
|---|---|
| L'application | `fr.minoapp.mino` |
| L'extension de surveillance | `fr.minoapp.mino.MinoShieldMonitor` |

Déposer la première et oublier la seconde donne une application qui passe la
revue et dont le bouclier ne se repose jamais à l'échéance — c'est-à-dire le
défaut le plus grave possible, découvert après publication.

### Combien de temps

De quelques jours ouvrés à plusieurs semaines, sans délai garanti et sans accusé
de réception fiable. Des développeurs rapportent des demandes restées sans
réponse pendant des mois. **C'est la raison pour laquelle cette demande se
dépose avant tout le reste**, et non parce qu'elle serait longue à écrire.

### Ce qu'Apple refuse

Le dossier est jugé sur une seule question : *est-ce un vrai produit de contrôle
parental, ou un moyen détourné de surveiller quelqu'un ?* Sont refusées les
applications qui collectent des statistiques d'usage à des fins publicitaires,
et celles dont le contrôle parental n'est pas la fonction principale mais un
prétexte.

## Ce qu'Apple veut savoir

Trois choses, et une seule compte vraiment : **est-ce un vrai produit de
contrôle parental, ou est-ce un moyen détourné de surveiller quelqu'un ?**

1. À quoi sert l'application.
2. Pourquoi elle a besoin de bloquer des applications tierces.
3. Comment elle protège la vie privée de l'enfant.

Mino est en position confortable sur les trois. Ce qui suit est une base à
adapter, pas à copier telle quelle.

## Texte proposé

> **Nom de l'application** : Mino
> **Éditeur** : Agence Wheb, SASU, 47 rue Vivienne, 75002 Paris, France
> **Catégorie** : Contrôle parental / organisation familiale
>
> **À quoi sert Mino**
>
> Mino est une application familiale destinée aux parents d'enfants de 5 à
> 17 ans. Le parent définit de petites responsabilités du quotidien — préparer
> son cartable, mettre la table, faire ses devoirs. Lorsque l'enfant les
> accomplit et que le parent les valide, l'enfant gagne du temps d'écran.
> L'application est le lien entre l'effort et la récompense.
>
> **Pourquoi Family Controls est nécessaire**
>
> Le temps gagné n'a de sens que s'il est effectivement appliqué. Sans
> Family Controls, Mino ne peut qu'afficher un compte à rebours pendant que
> l'enfant utilise librement les applications de l'appareil, ce qui vide le
> produit de son objet et reporte sur le parent une surveillance permanente.
>
> Avec `FamilyControls`, `ManagedSettings` et `DeviceActivity`, Mino applique
> exactement la règle que le parent a définie : les applications sélectionnées
> par le parent restent protégées par le bouclier système ; lorsque l'enfant
> démarre une session correspondant au temps qu'il a gagné, le bouclier est levé
> pour cette durée précise ; une extension `DeviceActivityMonitor` le repose à
> l'échéance, y compris si l'application est fermée.
>
> C'est l'usage exact prévu par ces API : un parent, titulaire de l'autorité
> parentale, encadre l'appareil de son propre enfant mineur.
>
> **Qui donne l'autorisation**
>
> Le compte est ouvert par un adulte, qui déclare être titulaire de l'autorité
> parentale. L'espace parent est protégé par un code distinct, que l'enfant ne
> connaît pas. L'autorisation Family Controls est demandée sur l'appareil de
> l'enfant, par le parent, une seule fois. Un refus n'empêche pas d'utiliser
> l'application : seul le verrouillage automatique est désactivé.
>
> **Vie privée**
>
> Mino ne collecte de l'enfant que son prénom, son âge et un avatar illustré
> choisi dans une liste. Pas d'adresse e-mail, pas de nom de famille, pas de
> photo, pas de numéro de téléphone, pas de géolocalisation. L'enfant n'a pas de
> compte.
>
> L'application ne comporte ni publicité, ni traceur publicitaire, ni mesure
> d'audience marketing, ni messagerie entre personnes, ni contenu public, ni profil public. Les
> données d'une famille sont isolées au niveau de la base de données.
>
> Les jetons opaques renvoyés par `FamilyActivityPicker` ne sont ni interprétés,
> ni stockés hors de l'appareil, ni transmis à un serveur. Mino n'affiche à
> personne la liste des applications sélectionnées : l'interface se limite à en
> indiquer le nombre. Mino ne collecte aucune statistique d'usage applicatif et
> ne rapporte pas au parent ce que l'enfant consulte.
>
> **Modèle économique**
>
> Abonnement familial payé par le parent. Aucun achat intégré, aucune monnaie
> virtuelle, rien à acheter pour l'enfant. Le temps d'écran ne peut être obtenu
> que par des tâches validées par le parent — jamais contre de l'argent.

## Ce que la demande engage ensuite

Quelques points à ne pas découvrir après coup :

- **L'entitlement en développement suffit pour tester**, mais pas pour publier.
  Il faut la version distribution avant la soumission App Store.
- **Family Controls exige un development build** : rien de tout cela ne
  fonctionne dans Expo Go.
- **L'extension `DeviceActivityMonitor` est une cible distincte** dans le
  projet Xcode, avec son propre bundle identifier et son propre profil de
  provisioning. Prévoyez-la dans le plugin de configuration Expo.
- **Le sélecteur est une vue SwiftUI** (`familyActivityPicker`) : elle se
  présente depuis le natif, pas depuis React Native.
- **Ne demandez l'autorisation qu'au bon moment.** Un `requestAuthorization`
  déclenché au premier lancement, avant que le parent ait compris à quoi il
  sert, se solde par un refus — et un refus se rattrape mal.

## Côté Android

Pas d'équivalent : aucune API officielle ne permet à une application tierce d'en
bloquer une autre. La voie retenue est `UsageStatsManager` plus une fenêtre
superposée, avec les permissions `PACKAGE_USAGE_STATS` et `SYSTEM_ALERT_WINDOW`
accordées par le parent dans les réglages du système.

Ce qui se prépare en parallèle de la demande Apple : la **déclaration d'usage
des permissions sensibles** pour le Play Store. Le contrôle parental fait partie
des usages acceptés, mais la déclaration doit être précise et les règles de
Google évoluent — à vérifier au moment de la soumission, pas maintenant.

Voir `docs/blocage-ecrans.md` pour le plan technique complet.
