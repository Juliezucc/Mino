# La première compilation

Aucune ligne de Swift ni de Kotlin de `modules/mino-screen-time/` n'a jamais
été compilée. Ce document conduit la première fois, dans l'ordre, avec les
pièges à leur place plutôt qu'en note de bas de page.

**Attendez-vous à des erreurs, et ne les prenez pas pour un échec.** Une
signature qui a bougé, un import manquant, une API dépréciée : c'est ce que
produit toujours une première compilation. Ce qui coûte cher, c'est
l'architecture — elle est là et elle a été pensée. Le reste se règle.

---

## Deux voies, et il faut choisir la première

**Sans Mac — EAS compile dans le nuage.** C'est la voie recommandée, et elle
n'existait pas quand ce document a été écrit : la cible d'extension devait alors
être créée à la main dans Xcode, ce qu'EAS ne peut évidemment pas faire.
Maintenant qu'elle est décrite dans `targets/`, EAS produit un binaire
**complet**, bouclier compris.

**Avec un Mac et Xcode 16+**, si vous en avez un. C'est plus rapide en boucle
courte, et c'est le seul moyen de lire une erreur de compilation Swift dans son
contexte. Rien n'oblige à commencer par là.

Dans les deux cas :

| | |
|---|---|
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
- le podspec ne compile **que** `MinoScreenTimeModule.swift` : ce qui repose le
  bouclier vit dans `targets/MinoShieldMonitor/`, parce que c'est une extension
  et pas l'application. Compilé dans l'application, il ne serait jamais réveillé
  par le système, et le bouclier ne reviendrait jamais seul ;
- **la cible d'extension est décrite**, dans
  `targets/MinoShieldMonitor/expo-target.config.js` — plus rien à créer à la
  main ;
- `expo-iap` porte son propre plugin, qui ajoute le pod StoreKit et
  l'autorisation de facturation Android ;
- `expo-dev-client` est une dépendance du projet. Le profil `development`
  d'`eas.json` le suppose depuis toujours ; il n'était installé nulle part, et
  EAS proposait de l'ajouter lui-même en cours de compilation — c'est-à-dire de
  réécrire `package-lock.json` sur la machine, ce qui relance le cycle des
  `git pull` bloqués. Mieux vaut qu'il entre par le verrou.

> **Le `prebuild` de ce document a déjà été joué à blanc**, sur Linux, et le
> projet produit a été relu ligne à ligne. Ce qui a été vérifié, et qu'il n'y a
> donc pas lieu de redouter :
>
> - deux cibles, `com.apple.product-type.application` et
>   `com.apple.product-type.app-extension` ;
> - les identifiants `fr.minoapp.mino` et `fr.minoapp.mino.MinoShieldMonitor`,
>   ceux-là mêmes qui sont déclarés chez Apple ;
> - l'`.appex` embarqué dans la phase *Embed Foundation Extensions* — sans
>   quoi l'extension ne partirait pas avec l'application ;
> - `com.apple.developer.family-controls` et le groupe d'applications sur les
>   **deux** cibles ;
> - 16.4 partout, et le pod d'`expo-iap` ajouté.
>
> Le dossier `ios/` a ensuite été supprimé : il est jetable, et se régénère.

---

## Le piège qui n'existe plus

> Ce paragraphe décrivait jusqu'ici le danger principal du projet. Il est
> conservé parce qu'il explique pourquoi les choses sont disposées ainsi.

`npx expo prebuild` **régénère `ios/` de zéro**. La cible d'extension devait
être créée à la main dans Xcode, et elle vivait là : un `prebuild` la
détruisait, silencieusement, l'application continuait de compiler sans elle, le
bouclier ne se reposait plus à l'échéance et rien ne le disait. Il fallait
choisir entre versionner `ios/` — donc quitter le flux managé — et écrire un
plugin, estimé à plusieurs jours.

**Aucun des deux n'est nécessaire.** La cible est décrite dans
`targets/MinoShieldMonitor/expo-target.config.js` et reconstruite à chaque
prebuild par `@bacons/apple-targets`, qui connaît le type
`device-activity-monitor`. Ce qui en découle est plus important que le confort :

- `prebuild` peut être relancé autant qu'on veut, `ios/` reste jetable ;
- **il n'y a plus besoin de Mac pour obtenir un binaire complet.** EAS compile
  sur du matériel Apple, dans le nuage, extension comprise. C'est la voie
  décrite plus bas, et c'est désormais la voie recommandée.

Deux choses ne sont pas libres, et se paient cher si on y touche sans savoir :

| | |
|---|---|
| Le nom de la classe | `DeviceActivityMonitorExtension`. L'`Info.plist` de l'extension désigne sa classe principale par `$(PRODUCT_MODULE_NAME).DeviceActivityMonitorExtension`. La renommer donne une extension que le système installe, planifie et réveille — et qui ne trouve rien à exécuter. |
| Le groupe d'applications | Repris de `app.json` par le fichier de configuration, à dessein. C'est la **seule mémoire commune** de l'application et de l'extension : la sélection d'applications et l'échéance y transitent. Désaccordés, l'extension se réveille à l'heure et ne trouve rien à reposer. |

---

## iOS sans Mac — la voie recommandée

### 1. Ouvrir un compte EAS et se connecter

```bash
cd ~/Mino
npx eas-cli@latest login
```

Le compte est gratuit. La file d'attente gratuite est lente aux heures pleines —
comptez de vingt minutes à une heure par compilation.

### 2. Rattacher le dépôt à un projet EAS

```bash
npx eas-cli@latest init
```

Il demande à quel compte rattacher le projet, puis écrit deux valeurs dans
`app.json` : `owner` et `extra.eas.projectId`. **Ce sont des modifications à
committer** — sans elles, chaque machine repartirait sur un projet EAS
différent.

> **Une commande à la fois.** Les commandes qui suivent posent des questions, et
> un terminal où l'on a collé plusieurs lignes d'un coup donne les lignes
> suivantes comme réponses aux questions. Le résultat est illisible et il faut
> tout reprendre.

### 3. Donner à EAS l'adresse du serveur

**L'étape qu'on oublie, et qui produit une application qui s'installe et ne
fonctionne pas.** `.env` n'est pas versionné — c'est délibéré — et EAS ne
téléverse pas ce que `.gitignore` exclut. Sans ces deux valeurs, le binaire part
sans savoir où joindre Supabase : il s'ouvre, et rien ne se charge.

Elles ne sont pas secrètes : la clé `anon` est faite pour vivre dans le
téléphone, et c'est la RLS qui protège les données, pas elle. Elles sont
simplement rangées chez EAS plutôt que dans le dépôt.

```bash
npx eas-cli@latest env:set --environment development \
  --name EXPO_PUBLIC_SUPABASE_URL --value "https://<référence>.supabase.co" --visibility plaintext

npx eas-cli@latest env:set --environment development \
  --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<la clé anon>" --visibility plaintext
```

Les deux valeurs sont dans votre `.env`, et dans le tableau de bord Supabase
sous *Project settings → API*.

> **Jamais la clé `service_role`.** Ni ici, ni dans le dépôt, ni dans
> l'application. Elle contourne toutes les règles de sécurité.

> **La clé doit être exactement celle de `.env`.** Supabase en propose
> aujourd'hui deux formes pour le même projet — l'ancienne, un JWT qui commence
> par `eyJ`, et la nouvelle, qui commence par `sb_publishable_`. Les deux
> peuvent marcher, jusqu'au jour où l'ancienne est révoquée du côté de Supabase
> et où le binaire déjà publié cesse de joindre le serveur. Reprendre celle qui
> fonctionne aujourd'hui sur la machine est la seule règle sûre.

Plus tard, pour un binaire d'App Store, refaire les deux commandes avec
`--environment production` — et y ajouter `EXPO_PUBLIC_BILLING_API_URL`, sans
quoi le rail boutique ne s'active pas.

### 4. Lancer la première compilation

```bash
npx eas-cli@latest build --profile development --platform ios
```

> **`npx` plutôt qu'une installation globale.** `npm install -g eas-cli` échoue
> sur un macOS où `/usr/local/lib/node_modules` n'appartient pas à
> l'utilisateur — c'est le cas par défaut. On pourrait passer par `sudo` ;
> `npx` évite la question, et prend toujours la dernière version.

EAS demandera de se connecter à votre compte Apple pour créer les certificats et
les profils. **Laissez-le faire** : il lui faut des profils pour les *deux*
identifiants, et les fabriquer à la main est long et sans intérêt.

Ce qu'il produit est un **build de développement** : l'application complète,
extension comprise, installable sur votre iPhone par le lien ou le QR code
qu'EAS affiche à la fin. Ce n'est pas Expo Go — c'est le vrai binaire, avec le
vrai module de blocage.

> **Ce que ce build n'a pas** : le rechargement à chaud d'Expo Go n'existe que
> si vous lancez `npx expo start --dev-client` à côté. Faites-le : le JavaScript
> se recharge alors sans recompiler, et vous ne repassez par EAS que lorsque le
> code natif change.

### 5. Faire confiance au développeur

Au premier lancement, l'iPhone demande d'autoriser un développeur inconnu :
*Réglages → Général → VPN et gestion de l'appareil → faire confiance*.

---

## iOS avec un Mac — plus rapide en boucle courte

### 1. Générer le projet natif

```bash
cd ~/Mino
npx expo prebuild --platform ios
```

Un dossier `ios/` apparaît, **avec la cible d'extension déjà dedans** : c'est
tout l'objet de `targets/MinoShieldMonitor/`. Il est jetable et se régénère.

### 2. Ouvrir le bon fichier

```bash
open ios/Mino.xcworkspace
```

**Le `.xcworkspace`, pas le `.xcodeproj`.** Ouvrir le second compile sans les
CocoaPods et produit une cascade d'erreurs incompréhensibles.

### 3. Signer les deux cibles

Cibles **Mino** *et* **MinoShieldMonitor** → onglet **Signing & Capabilities** :

- *Team* : **Agence Wheb**
- *Automatically manage signing* : coché

Les habilitations, elles, sont déjà là — Family Controls et le groupe
`group.fr.minoapp.mino` sur les deux cibles. Elles viennent d'`app.json` et de
`expo-target.config.js` ; il n'y a rien à cocher.

### 4. Modifier le Swift au bon endroit

Dans Xcode, l'extension apparaît sous un dossier `MinoShieldMonitor`. **Les
fichiers qu'on y édite sont ceux de `targets/MinoShieldMonitor/`**, hors de
`ios/` : ils survivent donc au prochain `prebuild`. C'est exactement ce qu'on
veut, et c'est l'inverse de ce que faisait ce document avant.

### 5. Lancer sur un vrai iPhone

Branchez le téléphone, choisissez-le comme destination, **⌘R**.

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
6. **recommencez avec une séance de cinq minutes.** C'est un chemin différent
   dans le code, et c'est celui qui était cassé.

Le point 5 est le produit. Les quatre premiers peuvent marcher sans lui, et
donneraient une application qui tient sa promesse tant que l'enfant ne pense pas
à fermer l'application.

### Pourquoi le point 6 est séparé du point 5

`DeviceActivity` **refuse tout intervalle de moins de quinze minutes**
(`MonitoringError.intervalTooShort`). Mino vend des séances de cinq — c'est même
le cœur du produit : un enfant qui a sept minos doit pouvoir en dépenser sept.

Le module programmait donc un intervalle trop court, le système le refusait, un
`try?` avalait l'erreur, et le bouclier était déjà à terre. L'enfant obtenait un
téléphone ouvert **pour toujours**, pendant que l'application affichait son
minuteur comme si de rien n'était. Une longue séance, elle, fonctionnait très
bien — d'où l'importance d'essayer les deux.

Ce qui a été corrigé, et qu'il faut savoir avant de lire le code : l'intervalle
dure désormais le plancher de quinze minutes, et c'est l'`warningTime` qui tombe
à l'heure réelle — le remède qu'Apple indique lui-même dans la suggestion
attachée à cette erreur. L'extension repose le bouclier sur
`intervalWillEndWarning`, et `intervalDidEnd` le repose de toute façon un peu
plus tard, en filet.

Et surtout : **on programme le retour avant de lever**, jamais l'inverse. Si le
système refuse, rien n'est levé et l'application le dit — l'enfant lit
« impossible de démarrer » et sa séance est refermée sans qu'aucune minute ne
lui soit débitée.

Concrètement, au point 6, deux choses à regarder à cinq minutes d'intervalle :
le bouclier revient bien, et le solde de l'enfant a bien baissé de cinq.

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

## Ce qui a changé, et pourquoi ce document a été refait

Ce document disait, jusqu'à peu : *« EAS ne remplace pas Xcode ici, il le
précède »* — parce qu'EAS compile ce que produit `prebuild`, et que `prebuild`
ne pouvait pas connaître une cible créée à la main dans Xcode. Un build EAS
donnait donc l'application **sans le bouclier qui se repose seul** : utile pour
essayer le reste du produit, inutile pour valider le blocage.

C'était vrai, et ce ne l'est plus. `@bacons/apple-targets` sait décrire une
cible `device-activity-monitor`, `targets/MinoShieldMonitor/` la décrit, et
`prebuild` la reconstruit à chaque fois. EAS compile donc maintenant un binaire
complet. **Le Mac n'est plus un prérequis, seulement un confort.**

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
