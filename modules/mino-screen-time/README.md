# Le module de blocage

`modules/mino-screen-time/` contient le code natif qui pose et lève le bouclier
système. C'est ce qui fait de Mino un produit qui **applique** au lieu d'un
produit qui **compte**.

---

## ⚠️ Ce code n'a jamais été compilé

À écrire en gras parce que la suite en dépend : **aucune ligne de Swift ni de
Kotlin de ce dossier n'a été compilée.** Ni Xcode ni le SDK Android n'existaient
sur la machine qui l'a écrit.

Ce qui est vérifié, en revanche :

- le côté JavaScript compile (`npm run typecheck`) et ses 216 tests passent ;
- la couture bascule correctement : sans module natif, `getScreenTimeService()`
  rend le minuteur honnête, et rien d'autre dans l'application ne change ;
- l'architecture suit ce que documentent Apple et Google.

Traitez donc ce dossier comme **un point de départ solide, pas comme un
livrable fini**. La première compilation trouvera des choses : une signature qui
a bougé, un import manquant, une API dépréciée. C'est normal et c'est rapide —
ce qui prend du temps, c'est l'architecture, et elle est là.

---

## Ce qu'il faut pour le faire tourner

Dans l'ordre, et aucun ne se saute :

1. **Un Mac avec Xcode 15+.** Le blocage iOS ne se compile pas ailleurs.
2. **L'habilitation `com.apple.developer.family-controls`**, accordée par Apple
   sur dossier (`docs/apple-family-controls.md`). Sans elle, les appels
   échouent à l'exécution : le module se charge, l'autorisation est refusée.
3. **Une *development build*, pas Expo Go.** Le blocage n'est pas du
   JavaScript ; Expo Go ne peut pas le charger, par construction.

```bash
npx expo prebuild            # génère ios/ et android/
npx eas build --profile development --platform ios
```

4. **Une cible d'extension, à créer à la main dans Xcode.**
   `ios/MinoShieldMonitor.swift` **ne fait pas partie de l'application** : il
   doit vivre dans une cible *Device Activity Monitor Extension* nommée
   `MinoShieldMonitor`. C'est elle que le système réveille à l'échéance pour
   reposer le bouclier — sans elle, un enfant qui ferme Mino garde son écran
   ouvert indéfiniment, et le produit ne tient pas sa seule promesse.

5. **Un groupe d'applications** `group.fr.agencewheb.mino`, activé sur
   l'application **et** sur l'extension. C'est leur seule mémoire commune : la
   sélection d'applications et l'échéance y transitent.

---

## Deux réserves à connaître avant de s'engager

**iOS — l'habilitation peut être refusée.** Apple l'accorde à sa discrétion.
C'est le seul endroit du projet où un « non » venu de l'extérieur coûte le
produit tel qu'il est décrit. D'où la règle : déposer le dossier tôt.

**Android — l'approche est plus fragile, et Google la surveille.** Il n'existe
aucun équivalent de FamilyControls : personne ne peut empêcher une application
de s'ouvrir. Ce que fait `ShieldWatcher` — lire les statistiques d'usage et
poser un écran par-dessus — est ce que font toutes les applications de contrôle
parental, mais cela repose sur deux autorisations que Google **restreint** et
pour lesquelles il faut remplir une déclaration au moment de publier :

- `PACKAGE_USAGE_STATS` — savoir ce qui est au premier plan ;
- `SYSTEM_ALERT_WINDOW` — afficher par-dessus.

Deux conséquences à assumer, et à écrire dans la fiche plutôt qu'à découvrir :

1. **Le refus de la fiche Play est un risque réel**, pas théorique. La
   justification doit dire précisément que Mino est un outil de contrôle
   parental installé par le parent sur l'appareil de son enfant.
2. **Un adolescent déterminé contourne** en retirant l'accès aux statistiques
   d'usage. On ne peut pas l'en empêcher — seulement le rendre visible au
   parent, ce que fait `authorizationStatus` en repassant à « denied ».

Autrement dit : sur iOS le blocage est **solide et incertain à obtenir**, sur
Android il est **certain à obtenir et poreux**. Ce n'est pas symétrique, et la
promesse commerciale devrait en tenir compte.

---

## Ce que le module fait, et ne fait pas

Il ne connaît ni mission, ni minute gagnée, ni famille. Il pose un bouclier, le
lève jusqu'à une échéance, le repose. Tout le reste est décidé côté JavaScript,
où c'est testable.

`unshield` prend une **échéance** et non une durée : l'extension doit pouvoir
agir seule, sans réseau et sans l'application — c'est tout le point.

**Mino ne voit jamais quelles applications un enfant a installées sur iOS.**
`FamilyActivitySelection` ne contient que des jetons opaques, chiffrés par le
système. Sur Android, Mino voit la liste — elle ne quitte jamais l'appareil et
n'est écrite que dans les préférences locales du module.
