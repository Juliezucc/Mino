# La première compilation

Aucune ligne de Swift ni de Kotlin de `modules/mino-screen-time/` n'a jamais
été compilée. Ce document conduit la première fois, dans l'ordre, avec les
pièges à leur place plutôt qu'en note de bas de page.

**Attendez-vous à des erreurs, et ne les prenez pas pour un échec.** Une
signature qui a bougé, un import manquant, une API dépréciée : c'est ce que
produit toujours une première compilation. Ce qui coûte cher, c'est
l'architecture — elle est là et elle a été pensée. Le reste se règle.

---

## Ce qu'il faut avoir

| | |
|---|---|
| Un Mac avec **Xcode 16+** | le blocage iOS ne se compile nulle part ailleurs |
| Un **iPhone physique** | FamilyControls ne fonctionne pas dans le simulateur, jamais |
| Le compte développeur | fait — Team ID `C8F2CKP8SZ` |
| L'entitlement Family Controls | fait — développement **et** distribution |
| Les deux identifiants déclarés | faits — application et extension |

### La version minimale d'iOS, et pourquoi elle est écrite quelque part

**iOS 16.4**, fixé dans `app.json` par `expo-build-properties`.

> 16.0 d'abord, refusé au premier démarrage : le SDK 57 exige au moins 16.4, et
> le plugin bloque `expo start` en entier plutôt que d'avertir. Sans
> conséquence pour la portée — 16.4 est une mise à jour de mars 2023 que tous
> les appareils capables de faire tourner 16.0 ont reçue. Ce sont les mêmes
> iPhone, à partir du 8.

Ce n'était nulle part avant, et l'oubli aurait coûté cher : le module exige
iOS 16 — c'est la version où `ManagedSettings` et `DeviceActivity` tiennent
ensemble — mais rien ne l'imposait à l'application. L'App Store aurait donc
proposé Mino à des iPhone plus anciens, où le bouclier n'aurait jamais pu
exister. Le parent aurait installé, payé, et constaté que rien ne se bloque.

Déclarer la version minimale est ce qui fait dire à l'App Store « cet appareil
n'est pas compatible » **avant** le téléchargement. C'est exactement ce que
Joon demande à ses utilisateurs quand il réclame une mise à jour d'iOS.

Android reste à l'API 24 : le module n'a besoin de rien de plus récent, et
descendre bas y coûte peu.

Ce qui est déjà préparé dans le dépôt, et qu'il n'y a donc pas à refaire :

- `app.json` porte l'habilitation `com.apple.developer.family-controls`, le
  groupe `group.fr.minoapp.mino` et la version minimale d'iOS ;
- le manifeste Android du module déclare ses cinq autorisations ;
- `MinoShieldMonitor.swift` est **exclu** du podspec, à dessein : il appartient
  à la cible d'extension, pas à l'application. Compilé dans l'application, il ne
  serait jamais réveillé par le système, et le bouclier ne reviendrait jamais
  seul ;
- `expo-iap` porte son propre plugin, qui ajoute le pod StoreKit et
  l'autorisation de facturation Android.

> **Le `prebuild` de ce document a déjà été joué à blanc**, sur Linux, pour
> vérifier que la chaîne de plugins produit un projet cohérent : l'habilitation
> Family Controls et le groupe d'applications sont bien dans
> `ios/Mino/Mino.entitlements`, la cible est bien en 16.4 partout, et le pod
> d'`expo-iap` est bien ajouté. Le dossier `ios/` a ensuite été supprimé — il
> doit naître sur votre Mac, avec CocoaPods, pas ici.

---

## Le piège à connaître AVANT de commencer

`npx expo prebuild` **régénère `ios/` de zéro**. La cible d'extension que vous
allez créer à la main dans Xcode y vit — donc un `prebuild --clean` la détruit,
silencieusement, et l'application continue de compiler sans elle. Le bouclier ne
se repose plus à l'échéance, et rien ne le dit.

Deux façons de s'en protéger, et il faut choisir maintenant :

**A — Générer une fois, puis versionner `ios/` et `android/`.** On quitte le
flux managé : `app.json` cesse d'être la source de vérité pour la configuration
native, et toute modification se fait désormais dans Xcode. C'est ce que font la
plupart des projets qui ont besoin d'une cible sur mesure.

**B — Écrire un plugin de configuration Expo** qui ajoute la cible d'extension à
chaque `prebuild`. Plus propre, et plusieurs jours de travail : manipuler un
projet Xcode par programme n'est simple pour personne.

**Recommandation : A pour la première compilation**, parce que l'objectif du
jour est de savoir si ce code fonctionne, pas de bâtir une chaîne de production.
B se justifiera le jour où l'on régénérera souvent — et à ce moment-là on saura
exactement ce que le plugin doit produire, ce qui n'est pas le cas aujourd'hui.

> Une fois `ios/` versionné, **ne relancez plus jamais `expo prebuild`** sans
> savoir ce que vous perdez. Écrivez-le dans le README si nécessaire.

---

## iOS, pas à pas

### 1. Générer le projet natif

```bash
cd ~/Mino
npx expo prebuild --platform ios
```

Un dossier `ios/` apparaît. Il contient un projet Xcode, un `Podfile` et les
dépendances installées.

### 2. Ouvrir le bon fichier

```bash
open ios/Mino.xcworkspace
```

**Le `.xcworkspace`, pas le `.xcodeproj`.** Ouvrir le second compile sans les
CocoaPods et produit une cascade d'erreurs incompréhensibles.

### 3. Signer l'application

Cible **Mino** → onglet **Signing & Capabilities** :

- *Team* : **Agence Wheb**
- *Automatically manage signing* : coché
- Vérifiez la présence de **Family Controls** et de **App Groups** avec
  `group.fr.minoapp.mino`. Ils viennent de `app.json` ; s'ils manquent,
  ajoutez-les par **+ Capability**.

### 4. Créer la cible d'extension

C'est l'étape qui n'existe pas ailleurs et qui décide de tout.

**File → New → Target… → iOS → Device Activity Monitor Extension**

| Champ | Valeur |
|---|---|
| Product Name | `MinoShieldMonitor` |
| Team | Agence Wheb |
| Bundle Identifier | `fr.minoapp.mino.MinoShieldMonitor` |
| Embed in Application | Mino |

Xcode propose d'activer le schéma : **acceptez**.

Puis :

1. **Remplacez tout le contenu** du fichier généré par celui de
   `modules/mino-screen-time/ios/MinoShieldMonitor.swift`. Le fichier du dépôt
   fait foi ; celui que Xcode génère est un squelette vide.
2. Cible `MinoShieldMonitor` → **Signing & Capabilities** → **+ Capability** →
   **App Groups** → cochez `group.fr.minoapp.mino`.
3. Cible `MinoShieldMonitor` → **General** → *Minimum Deployments* : **iOS 16.4**.

> Le groupe d'applications est leur **seule mémoire commune**. La sélection
> d'applications et l'échéance y transitent. S'il manque sur l'une des deux
> cibles, l'extension se réveille bien à l'heure et ne trouve rien à reposer.

### 5. Lancer sur un vrai iPhone

Branchez le téléphone, choisissez-le comme destination, **⌘R**.

Au premier lancement, l'iPhone demandera d'autoriser un développeur inconnu :
*Réglages → Général → VPN et gestion de l'appareil → faire confiance*.

### 6. Vérifier que le blocage vit

Dans l'application : espace parent → **Blocage** → demander l'autorisation. Une
fenêtre système apparaît, la première depuis le début du projet.

Ce que vous devez pouvoir observer, dans l'ordre :

1. l'autorisation est accordée, et l'écran du parent le dit ;
2. le sélecteur d'applications s'ouvre — c'est une vue SwiftUI présentée par le
   natif ;
3. les applications choisies deviennent inaccessibles sur l'appareil de
   l'enfant ;
4. une session démarrée les rouvre pour la durée exacte ;
5. **fermez Mino**, attendez l'échéance : le bouclier revient. C'est
   l'extension qui l'a reposé, et c'est la seule preuve qui compte.

Le point 5 est le produit. Les quatre premiers peuvent marcher sans lui, et
donneraient une application qui tient sa promesse tant que l'enfant ne pense pas
à fermer l'application.

---

## Android

Beaucoup plus court : le module porte son propre manifeste, et il n'y a pas
d'extension à créer.

```bash
npx expo prebuild --platform android
npx expo run:android
```

Les trois autorisations sensibles ne se demandent pas par boîte de dialogue :
le parent les accorde **dans les réglages du système**. L'écran de blocage doit
l'y emmener, et c'est ce qui se vérifie ici.

---

## Si vous préférez ne pas installer Xcode tout de suite

EAS compile dans le cloud. `eas.json` est prêt.

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

**Mais la cible d'extension n'existera pas.** EAS compile ce que produit
`prebuild`, et `prebuild` ne connaît pas la cible que vous n'avez pas encore
créée à la main. Un build EAS aujourd'hui donne donc l'application **sans le
bouclier qui se repose seul** — utile pour tester le reste du produit sur un
téléphone, insuffisant pour valider le blocage.

Autrement dit : EAS ne remplace pas Xcode ici, il le précède.

---

## Ce que la première compilation débloque

- Le **blocage réel** — et donc le droit d'en parler dans la fiche App Store et
  dans les notes à l'examinateur. Tant que le binaire tombe sur le minuteur,
  l'écrire est un motif de retrait (Apple 2.3.1).
- Le **module d'achat** : StoreKit ne fonctionne ni sur le web ni dans Expo Go.
  Le module est écrit (`ExpoIapStore`) et éprouvé contre une fausse boutique,
  mais **la feuille de paiement ne s'est jamais ouverte** — et c'est la seule
  chose qu'aucun test ne peut remplacer. Elle s'ouvrira ici, et nulle part
  avant.
- **TestFlight**, donc de vraies familles — l'essai de 30 jours rend Mino
  entièrement utilisable avant que l'abonnement n'existe.
