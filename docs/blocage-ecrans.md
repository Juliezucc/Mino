# Bloquer réellement les applications

**Le blocage est le produit.** Sans lui, Mino compte pendant que l'enfant ouvre
ce qu'il veut à côté — et le compteur ne veut plus rien dire.

Le module natif est écrit : `modules/mino-screen-time/`. Il n'a **jamais été
compilé** — ni Xcode ni le SDK Android n'existaient sur la machine qui l'a
écrit — et son README dit précisément ce qu'il faut pour le faire tourner, dans
quel ordre, et les deux réserves à connaître avant de s'engager.

Ce document-ci explique le *pourquoi* : pourquoi une application ne peut pas en
bloquer une autre, et pourquoi les deux plateformes n'ont presque rien en
commun.

## Pourquoi une application ne peut pas bloquer une autre application

iOS et Android isolent chaque application dans son bac à sable. Empêcher une
autre application de s'ouvrir est un privilège que le système n'accorde que
sous conditions strictes, et qui n'existe même pas de la même façon sur les deux
plateformes. Ce n'est pas un manque de Mino, c'est la règle du jeu — et c'est la
raison pour laquelle toutes les applications de contrôle parental du marché
demandent une autorisation système à l'installation.

Deux conséquences pratiques :

- **Ce sera du code natif, pas du JavaScript.** Le blocage ne peut pas être écrit
  en React Native, et donc pas non plus être testé dans Expo Go. Il faudra passer
  à un *development build* Expo, ce qui est un changement d'outillage, pas de
  produit.
- **Les deux plateformes se traitent séparément**, avec des approches qui n'ont
  presque rien en commun.

## iOS — l'API Screen Time d'Apple

C'est la bonne nouvelle : Apple a ouvert exactement ce qu'il nous faut, depuis
iOS 16, à travers trois cadres logiciels.

| Cadre | Rôle |
|---|---|
| `FamilyControls` | Demande l'autorisation au parent et laisse choisir les applications concernées, sans jamais révéler lesquelles à Mino. |
| `ManagedSettings` | Pose et lève le bouclier. C'est littéralement `store.shield.applications = …`. |
| `DeviceActivity` | Réveille une extension à une heure donnée, pour reposer le bouclier à la fin d'une session. |

Le fonctionnement visé, une fois en place :

1. À la configuration, le parent autorise Mino via `AuthorizationCenter` et
   sélectionne les applications à encadrer dans le sélecteur d'Apple.
2. Le bouclier est posé **en permanence** sur ces applications.
3. Quand l'enfant démarre une session de 20 minos, Mino lève le bouclier et
   programme un `DeviceActivitySchedule` de 20 minutes.
4. À l'échéance — ou si l'enfant appuie sur « J'arrête maintenant » — le bouclier
   est reposé.

Plus aucune limite quotidienne à estimer à l'avance : le temps disponible est
exactement celui que l'enfant a gagné.

**Les quatre choses à savoir avant de s'y engager :**

- **Un `DeviceActivitySchedule` ne peut pas durer moins de quinze minutes**
  (`MonitoringError.intervalTooShort`), et Mino vend des séances de cinq. Le
  point 3 ci-dessus est donc plus subtil qu'il n'en a l'air : pour une séance
  courte, l'intervalle programmé dure le plancher d'un quart d'heure, et c'est
  l'`warningTime` — placé à l'heure réelle — qui rappelle l'extension au bon
  moment. C'est le remède qu'Apple indique lui-même dans la suggestion attachée
  à cette erreur.

  Le corollaire vaut d'être écrit une fois : **on programme le retour du
  bouclier avant de le lever**, jamais l'inverse. Sinon un refus du système
  laisse le bouclier à terre sans que rien ne puisse le relever — et le minuteur
  de l'application continue de tourner comme si tout allait bien.

- **L'autorisation `com.apple.developer.family-controls` se demande à Apple.**
  Elle n'est pas accordée automatiquement : il faut déposer une demande décrivant
  l'usage parental. Prévoir un délai, et le faire **tôt** — c'est le seul point du
  projet qui ne dépend pas de nous.
- **Apple ne nous dit jamais quelles applications sont sélectionnées.** Le
  sélecteur renvoie des jetons opaques. C'est excellent pour la vie privée et
  parfaitement cohérent avec la politique de Mino, mais cela veut dire qu'on ne
  peut pas afficher « YouTube est bloqué » dans l'interface.
- **L'extension `DeviceActivityMonitor` est un processus séparé**, avec très peu
  de mémoire et pas d'accès au réseau. Elle doit pouvoir reposer le bouclier
  toute seule, sans appeler notre serveur.

## Android — pas d'API officielle

Android n'offre pas d'équivalent à `ManagedSettings` pour une application tierce.
Trois voies existent, et une seule est réaliste pour un produit grand public.

**1. `UsageStatsManager` + fenêtre superposée** — *la voie retenue.*
L'application surveille quelle application est au premier plan et affiche par
dessus un écran Mino quand c'est une application encadrée hors session.
Permissions `PACKAGE_USAGE_STATS` et `SYSTEM_ALERT_WINDOW`, toutes deux
accordées par le parent dans les réglages. C'est ce que fait l'essentiel du
marché. Le blocage est efficace mais pas inviolable : un enfant déterminé peut
forcer l'arrêt de Mino.

**2. Service d'accessibilité** — plus réactif, mais Google restreint fortement
cette API et exige une déclaration d'usage justifiée sur le Play Store. Le
contrôle parental fait partie des usages acceptés, mais c'est un risque de
publication à ne prendre que si la voie 1 se révèle insuffisante.

**3. `DevicePolicyManager` en propriétaire d'appareil** — le seul vrai blocage
inviolable, mais il impose de provisionner l'appareil, donc une réinitialisation
d'usine. Inenvisageable pour une famille.

**À prévoir dans tous les cas :** la déclaration d'usage des permissions
sensibles au moment de la publication Play Store. Les règles de Google sur ce
point évoluent régulièrement — à revérifier au moment de le faire, pas
maintenant.

## Ce qui est déjà prêt côté code

Rien à réécrire dans le produit. `src/services/screenTime/ScreenTimeService.ts`
est exactement le point d'insertion :

```ts
export interface ScreenTimeService {
  readonly capability: ScreenTimeCapability;   // 'timer-only' | 'device-managed'
  isAuthorized(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  grant(...): Promise<ScreenTimeGrant>;        // lève le bouclier
  revoke(sessionId): Promise<{ consumedMinutes }>;  // le repose
  status(childId): Promise<ScreenTimeStatus>;
}
```

`grant` et `revoke` veulent déjà dire « ouvre l'accès » et « referme-le ». Il
suffit d'ajouter `IosFamilyControlsScreenTimeService` et
`AndroidUsageStatsScreenTimeService`, de les choisir dans
`services/screenTime/index.ts` selon `Platform.OS` et l'autorisation obtenue, et
de basculer `capability` sur `'device-managed'`.

Trois textes de l'application lisent cette valeur et changent tout seuls : les
réglages, les CGV, et le chapitre « Le temps d’écran sur son téléphone » du guide.
Rien d'autre dans l'application ne sait comment le temps est appliqué.

## Dans quel ordre s'y prendre

1. **Déposer la demande d'autorisation Apple.** C'est le chemin critique et il ne
   dépend pas de nous — tout le reste peut avancer pendant l'attente.
2. **Passer au development build Expo** et vérifier que l'application existante
   tourne à l'identique. Étape sans risque produit, à faire tôt.
3. **iOS d'abord**, parce que l'API est officielle, documentée, et que le
   comportement obtenu est celui qu'on veut vraiment.
4. **Android ensuite**, sur la voie 1, en acceptant qu'il soit contournable et en
   le disant honnêtement au parent plutôt que de le laisser croire l'inverse.
5. **Ajouter à l'étape de configuration du guide** l'écran d'autorisation, avec
   une capture — le script `scripts/capture-guide.mjs` s'en chargera.

## En attendant

Le chapitre « Le temps d’écran sur son téléphone » du guide explique au parent
comment régler Temps d'écran ou Family Link en cinq minutes, et pourquoi.
Cette configuration restera valable après la bascule : elle ne sera simplement
plus nécessaire.
