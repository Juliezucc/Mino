# D'ici au lancement

Le chemin complet, dans l'ordre où il se parcourt. Chaque étape dit **qui la
fait** — vous ou moi — et **combien de temps elle prend en vrai**, délai
d'attente compris.

Une seule règle d'ordre, et tout le document en découle : **ce qui dépend d'un
tiers se lance en premier**, parce que c'est le seul temps qu'on ne peut pas
rattraper en travaillant plus.

> Les autres documents restent la référence de leur sujet :
> `mise-en-route.md` pour brancher Supabase, `capacite.md` pour les chiffres
> mesurés, `paiements.md` pour les rails de facturation,
> `modules/mino-screen-time/README.md` pour le blocage natif. Celui-ci les
> ordonne, il ne les remplace pas.

---

## Phase 0 — Aujourd'hui, avant tout le reste

Deux démarches dont le délai ne dépend **pas** de nous. Tant qu'elles ne sont
pas déposées, tout le reste attend derrière.

### 0.1 La demande Family Controls · vous · 1 h, puis plusieurs semaines

C'est **le seul point du projet où un « non » venu de l'extérieur coûte le
produit tel qu'il est décrit.** Apple accorde l'habilitation
`com.apple.developer.family-controls` à sa discrétion, sur dossier, sans délai
garanti. Sans elle, Mino compte le temps mais ne ferme rien.

Le dossier se dépose depuis le compte développeur Apple (formulaire de demande
d'habilitation). Ce qu'il faut dire, et ne pas broder :

- Mino est un outil de **contrôle parental**, installé par le parent, sur
  l'appareil de son enfant, avec l'autorisation du parent.
- L'habilitation sert à **poser et lever un bouclier** sur les applications que
  le parent a lui-même choisies dans le sélecteur du système.
- Mino ne voit **jamais** quelles applications l'enfant a installées : la
  sélection ne contient que des jetons opaques, chiffrés par iOS.
- Pas de publicité, pas de géolocalisation, pas de collecte à des fins
  marketing côté enfant.

Voir `docs/apple-family-controls.md` pour le détail.

> **À faire même si vous hésitez encore sur le reste.** C'est gratuit, ça ne
> vous engage à rien, et ça tourne pendant que vous travaillez.

### 0.2 Le numéro D-U-N-S et les contrats · vous · 1 h, puis 2 à 5 semaines

Le D-U-N-S identifie l'entreprise auprès d'Apple. Il est **gratuit** — ne payez
jamais pour l'obtenir — et se demande sur le site de Dun & Bradstreet. Comptez
une à deux semaines, parfois plus.

Ensuite, et **seulement ensuite** :

- **Apple** : Apple Developer Program (99 $/an), puis dans App Store Connect,
  l'accord **Paid Apps** — coordonnées bancaires et informations fiscales.
- **Google** : compte développeur Play (25 $ une fois), puis le profil de
  paiement.

**Pourquoi ça bloque tout le commercial** : sans l'accord Paid Apps signé, vous
ne pouvez même pas **créer** les produits d'abonnement dans App Store Connect.
Donc pas de test d'achat, donc pas de soumission.

---

## Phase 1 — Mettre Supabase en état de production

Pendant que les démarches tournent. Rien ici ne dépend d'Apple.

### 1.1 Le projet et le schéma · vous · 30 min

Suivez `mise-en-route.md`, partie B, de B1 à B6. Trois points à ne pas rater :

- **Région Europe** (Francfort ou Paris). C'est le seul choix irréversible.
- Les deux réglages d'authentification de **B4** — « Confirm email » et les
  deux *Redirect URLs*. Ils ne se voient pas tant qu'on ne s'en sert pas.
- La clé `service_role` ne doit **jamais** entrer dans l'application ni dans le
  dépôt.

### 1.2 Passer au plan Pro · vous · 10 min · 25 $/mois

**Pas pour un quota — pour les sauvegardes.** Le plan gratuit n'en a aucune.
Pas une. Faire tourner de vraies familles là-dessus n'est pas un risque
technique, c'est un risque d'entreprise.

À 25 $ le mois contre 9,90 € l'abonnement, **trois familles payantes le
couvrent**.

### 1.3 Faire une restauration en vrai, une fois · vous · 1 h

L'étape que tout le monde saute, et la seule qui prouve quelque chose.

1. Créez une famille de test avec quelques enfants et missions.
2. Notez ce qu'elle contient.
3. Restaurez la sauvegarde de la veille depuis le tableau de bord.
4. Vérifiez que la famille est revenue **exactement** comme vous l'aviez notée.

Une sauvegarde qu'on n'a jamais restaurée est une hypothèse, pas un filet.

### 1.4 Les travaux de nuit · vous · 20 min

`mise-en-route.md` **B8**. À faire **après** 1.2 et 1.3, jamais avant : deux de
ces quatre travaux **suppriment** des lignes, et on ne lance pas une
suppression automatique sur une base qu'on ne sait pas restaurer.

### 1.5 Un vrai serveur d'envoi d'e-mails · vous · 1 h

Le service intégré de Supabase est bridé à quelques envois par heure et n'est
**pas fait pour la production**. Prenez un expéditeur européen — Scaleway,
Brevo, OVH — et renseignez-le dans **Project Settings → Auth → SMTP Settings**.

Puis **réactivez « Confirm email »**. Tant qu'il est désactivé, n'importe qui
peut créer un compte avec l'adresse de quelqu'un d'autre. Acceptable entre
vous et vos enfants ; plus du tout à la première famille inconnue.

### 1.6 Une surveillance qui réveille · vous · 20 min

Un tableau de bord qu'il faut penser à consulter ne sert à rien à 3 h du matin.
UptimeRobot ou équivalent, qui **envoie un message** quand la base ne répond
plus. Vous êtes seule à gérer : c'est la différence entre apprendre une panne
et l'apprendre par un client.

---

## Phase 2 — La première compilation native

Là, il faut votre Mac. Rien de ce qui suit ne se fait ailleurs.

### 2.1 Ce qu'il faut · vous · une demi-journée

- **Xcode 15+**, depuis le Mac App Store. C'est long à télécharger, lancez-le
  la veille.
- L'habilitation de 0.1 **accordée**. Sans elle le module se charge et
  l'autorisation est refusée à l'exécution.

### 2.2 La *development build* · moi, puis vous · 1 à 2 jours

Le blocage n'est pas du JavaScript : **Expo Go ne peut pas le charger, par
construction**. Il faut une build de développement.

```bash
npx expo prebuild
npx eas build --profile development --platform ios
```

**Ce que la première compilation trouvera** : une signature qui a bougé, un
import manquant, une API dépréciée. C'est normal et c'est rapide — ce qui prend
du temps, c'est l'architecture, et elle est là. **Aucune ligne de Swift ni de
Kotlin de ce dossier n'a jamais été compilée**, et il faut l'aborder en le
sachant.

### 2.3 La cible d'extension, à créer à la main · moi avec vous · 2 h

`ios/MinoShieldMonitor.swift` **ne fait pas partie de l'application** : il doit
vivre dans une cible *Device Activity Monitor Extension* nommée
`MinoShieldMonitor`, créée dans Xcode.

C'est elle que le système réveille à l'échéance pour reposer le bouclier. Sans
elle, **un enfant qui ferme Mino garde son écran ouvert indéfiniment**, et le
produit ne tient pas sa seule promesse.

Il faut aussi activer le groupe d'applications `group.fr.minoapp.mino` sur
l'application **et** sur l'extension : c'est leur seule mémoire commune.

### 2.4 Ce qu'il faut éprouver sur l'appareil · vous · 1 h

Quatre choses que seul un vrai téléphone peut dire :

1. Le bouclier se pose et se lève.
2. **Fermer Mino ne rouvre pas les écrans** — c'est l'extension qui répond.
3. **Redémarrer le téléphone ne supprime pas le bouclier.**
4. Sur Android, **reculer l'horloge ne rallonge pas la session** et ne fait pas
   facturer zéro minute.

Les trois dernières sont des défauts que j'ai corrigés sans pouvoir les
vérifier autrement que par le raisonnement et les tests JavaScript.

---

## Phase 3 — Brancher le paiement

**Avant la soumission, jamais après.** Apple ouvre la page Abonnement pendant
la revue et appuie sur le bouton. Si la feuille de paiement ne s'ouvre pas,
c'est un refus.

### 3.1 Ce qui existe déjà

| | |
|---|---|
| Le contrat avec la boutique (`native.ts`) | ✅ |
| Les fonctions serveur qui vérifient les reçus | ✅ |
| Le webhook Stripe pour le web | ✅ |
| Le jeton qui relie un achat à une famille | ✅ |
| **Le module d'achat natif** | ❌ à écrire |

`setNativeStore()` existe et n'est appelé nulle part : toute la plomberie
attend une implémentation.

### 3.2 Créer les produits · vous · 1 h

Une fois l'accord Paid Apps signé (0.2) :

- **App Store Connect** → Abonnements → un groupe, deux produits : mensuel
  9,90 € et annuel 79 €.
- **Play Console** → Abonnements → les deux mêmes.
- Les identifiants doivent correspondre à ceux que le code attend — je vous les
  donnerai au moment de brancher.

### 3.3 Le module d'achat · moi · 2 à 3 jours

RevenueCat ou `expo-iap`, derrière le contrat déjà défini. Rien du reste de
l'application ne saura lequel.

Deux choses qu'Apple exige explicitement, et qui sont déjà prévues dans le
contrat : le bouton **« Restaurer mes achats »** (un client qui change de
téléphone doit retrouver son abonnement sans repayer), et le fait que
**l'annulation ne se fasse pas dans l'app** — c'est une décision qui appartient
aux réglages du téléphone.

### 3.4 `EXPO_PUBLIC_BILLING_API_URL` · vous · 2 min

L'adresse des fonctions Edge du projet :
`https://<référence>.supabase.co/functions/v1`.

Sans elle, le rail boutique ne s'active pas **même une fois le module branché**
— et on conclurait à tort que le paiement ne marche pas.

### 3.5 Tester l'achat en bac à sable · vous · 1 h

Avec un compte de test Sandbox. Vérifiez les trois chemins, pas seulement le
premier :

1. L'achat aboutit et l'abonnement devient actif.
2. **Restaurer** sur un deuxième appareil retrouve l'abonnement.
3. Un achat **annulé en cours de route** ne laisse rien d'actif.

---

## Phase 4 — Soumettre

### 4.1 Ce que les deux boutiques demandent · vous · 1 jour

- Captures d'écran (`npm run captures` en produit un jeu à jour).
- Description, mots-clés, catégorie.
- **Politique de confidentialité** accessible publiquement en ligne.
- Le questionnaire de confidentialité — répondez-y avec la politique sous les
  yeux, les deux doivent dire la même chose.
- Un **compte de démonstration** pour l'examinateur, avec des données déjà
  dedans. Un examinateur qui tombe sur un écran vide refuse.

### 4.2 Les deux points qui font refuser · à préparer

**Apple, règle 5.1.1(v)** — suppression du compte depuis l'application. C'est
fait (**Réglages → Gérer mon compte**), mais l'examinateur doit pouvoir la
trouver : indiquez-lui le chemin dans les notes de revue.

**Google, autorisations restreintes** — `PACKAGE_USAGE_STATS` et
`SYSTEM_ALERT_WINDOW` demandent une déclaration écrite. Le refus de la fiche
est un **risque réel, pas théorique**. La justification doit dire précisément
que Mino est un outil de contrôle parental installé par le parent sur
l'appareil de son enfant, et pourquoi ces deux autorisations sont
indispensables à cette fonction. Voir
`modules/mino-screen-time/README.md`.

---

## Phase 5 — Quand les abonnements arrivent

Les chiffres qui suivent sont **mesurés**, pas estimés : voir `capacite.md`.

### Les seuils à surveiller

| Ce qui cède en premier | Vers |
|---|---|
| **Connexions temps réel simultanées** (500 au Pro) | 1 500 à 3 500 familles |
| Taille de la base (8 Go au Pro) | ~16 000 familles |
| Puissance de la machine (*Micro* incluse) | quelques milliers |

**Les connexions simultanées cèdent les premières, et de loin.** C'est le
premier chiffre à regarder dans le tableau de bord Supabase, dès les premières
centaines de familles — c'est la seule grandeur qu'on n'ait pas pu mesurer
d'avance, parce qu'elle dépend de combien d'appareils ont l'application ouverte
**au même instant**.

Le remède est un réglage, pas une réécriture : on achète des connexions
supplémentaires (20 à 30 $/mois) et on passe l'instance de *Micro* à *Small* ou
*Medium* (15 à 60 $ de plus).

### Ce que ça coûte, en proportion

À 10 000 familles : **60 à 115 $ par mois de serveur**, contre 99 000 € de
chiffre d'affaires mensuel. Le serveur pèse **environ un dixième de pour cent
du revenu**. Ce n'est pas là qu'est le risque.

### Ce qui reste à construire quand ça grossira

Aucun de ces points ne bloque le lancement, tous deviennent utiles vers quelques
centaines de familles :

- **Régénérer le code famille** et retirer un appareil appairé.
- **`app_config`** : un interrupteur distant pour éteindre une fonctionnalité
  sans publier une nouvelle version.
- **`expo-updates`** : corriger un défaut JavaScript sans repasser par la revue.
- Le compagnon éteint par défaut, ou l'accord de traitement signé.
- La cinquième tâche de nuit : `purge_companion_messages()`.

---

## Le total honnête

| | Votre temps | Attente externe |
|---|---|---|
| Phase 0 — démarches | 2 h | **2 à 6 semaines** |
| Phase 1 — Supabase | ½ journée | — |
| Phase 2 — build native | 1 journée | quelques heures de compilation |
| Phase 3 — paiement | 2 h | — |
| Phase 4 — soumission | 1 journée | **1 à 7 jours de revue** |

**Mon travail** : 4 à 6 jours, essentiellement le module d'achat et
l'accompagnement de la première compilation.

**Le chemin critique n'est pas le code.** C'est le D-U-N-S, les contrats
bancaires et l'habilitation Family Controls — d'où la Phase 0, et d'où
l'insistance à la lancer aujourd'hui.

---

## Ce qu'il ne faut pas faire

- **Soumettre sans le paiement.** Refus immédiat.
- **Ouvrir au public avec « Confirm email » désactivé.** N'importe qui créerait
  un compte avec l'adresse d'un autre.
- **Lancer les travaux de nuit avant d'avoir restauré une sauvegarde.** Deux
  d'entre eux suppriment des lignes.
- **Attendre l'habilitation Family Controls pour commencer le reste.** Elle
  tourne toute seule.
- **Payer pour un numéro D-U-N-S.** Il est gratuit.
