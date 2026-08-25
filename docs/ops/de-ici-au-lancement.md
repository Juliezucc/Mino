# D'ici au lancement

**Dix-sept étapes, dans l'ordre où on les fait.** Chacune dit qui la fait,
combien elle prend, et ce qu'elle débloque.

Une seule règle explique cet ordre : **ce qui dépend d'un tiers se lance en
premier**, parce que c'est le seul temps qu'on ne peut pas rattraper en
travaillant plus. Les étapes 1 à 5 se font donc le même jour, même si les
étapes 6 et suivantes semblent plus urgentes.

> Les autres documents restent la référence de leur sujet :
> `mise-en-route.md` pour brancher Supabase, `capacite.md` pour les chiffres
> mesurés, `paiements.md` pour les rails de facturation,
> `apple-family-controls.md` pour le dossier Apple. Celui-ci les ordonne, il ne
> les remplace pas.

---

## Aujourd'hui — les cinq démarches qui commandent tout

### 1. Enregistrer `minoapp.fr`, et y mettre un vrai site · vous · 15 min + 1 jour

**À faire en premier, avant même la demande Apple**, pour trois raisons qui
convergent toutes vers ce domaine.

**a) L'identifiant de l'application en dérive** (`fr.minoapp.mino`), et la
demande Family Controls se dépose **par identifiant** : déposer avec le mauvais
oblige à tout redéposer.

**b) Les adresses légales.** `mino.app` appartient à un tiers, et la politique
de confidentialité comme les CGV y renvoyaient : ces adresses n'auraient jamais
reçu un seul message, alors qu'elles sont légalement obligatoires. C'est
corrigé dans le dépôt, mais le domaine doit exister pour que ce soit vrai.
Ouvrez-y `contact@` et `privacy@`.

**c) Apple l'exige deux fois pour l'inscription société**, et c'est le point
qui se découvre trop tard :

> « A work email address: Your work email address needs to be associated with
> your organization's domain name. »
>
> « A website: Your organization's website must be publicly available and
> functional, and its domain name must be associated with your organization.
> Links to social media webpages or websites that contain minimal content or
> display a message from a domain registrar won't be accepted. »
>
> — [Apple, *Program enrollment*](https://developer.apple.com/help/account/membership/program-enrollment/)

Autrement dit : **une page « domaine réservé » ou un lien Instagram sont
explicitement refusés.** Il faut un site publiquement accessible, avec du
contenu, sur le domaine de la société. Une page de présentation de Mino avec la
politique de confidentialité et les CGV suffit — et cette politique doit de
toute façon être en ligne pour l'étape 17.

Enregistrez le domaine au nom d'**Agence Wheb**, pas à titre personnel.

### 2. Déposer la demande Family Controls · vous · 1 h → réponse en semaines

**https://developer.apple.com/contact/request/family-controls-distribution**

C'est **le seul point du projet où un « non » venu de l'extérieur coûte le
produit tel qu'il est décrit.** D'où sa place ici : le délai n'est pas garanti,
et certains développeurs attendent des mois.

**Deux demandes, pas une** — l'entitlement se demande par bundle, et l'extension
en est un à part entière :

| Cible | Bundle |
|---|---|
| L'application | `fr.minoapp.mino` |
| L'extension de surveillance | `fr.minoapp.mino.MinoShieldMonitor` |

Déposer la première et oublier la seconde donne une application qui passe la
revue et dont le bouclier ne se repose **jamais** à l'échéance.

Le texte du dossier est prêt dans `docs/apple-family-controls.md` : il suffit de
l'adapter. Ce qu'Apple juge, en une phrase : *est-ce un vrai produit de contrôle
parental, ou un moyen détourné de surveiller quelqu'un ?*

> L'entitlement de **développement**, lui, se coche seul dans le portail, sans
> demande. On peut donc compiler et tester tout de suite. C'est celui de
> **distribution** — TestFlight et App Store — qui passe par ce dossier.

### 3. Demander le numéro D-U-N-S · vous · 30 min → 1 à 2 semaines

Il identifie Agence Wheb auprès d'Apple. Il est **gratuit** : ne payez jamais
pour l'obtenir. Sans lui, pas de compte développeur société, donc pas de contrat
bancaire, donc pas de produits d'abonnement.

### 4. Ouvrir les comptes développeurs · vous · 1 h

**Il n'y a pas de « compte Apple Developer » séparé** : on *inscrit* un compte
Apple existant au programme. Mais n'inscrivez pas le vôtre.

Créez un compte Apple dédié sur une adresse du domaine — `apple@minoapp.fr`
par exemple — avec l'**authentification à deux facteurs** activée, et
inscrivez celui-là. Trois raisons :

- Apple **exige** que l'adresse soit sur le domaine de la société (étape 1).
- Ce compte devient le **titulaire** : c'est lui qui signe les accords
  bancaires et fiscaux. Le transférer plus tard est long et pénible.
- Votre compte Apple personnel porte votre iCloud, vos photos, et le partage
  familial de vos propres enfants. Mélanger cela avec l'entreprise — et avec un
  produit de contrôle parental que vous allez tester sur ces mêmes appareils —
  est une source d'ennuis dont aucun n'est intéressant.

Il faut aussi avoir **l'autorité légale d'engager la société**. Comme
présidente d'Agence Wheb, vous l'avez.

- **Apple Developer Program** — 99 $/an, inscription *Organization*.
- **Google Play Console** — 25 $ une fois.

### 5. Signer l'accord *Paid Apps* · vous · 30 min, dès le D-U-N-S reçu

Dans App Store Connect : *Agreements, Tax, and Banking*. Coordonnées bancaires
et informations fiscales. Même chose côté Google avec le profil de paiement.

> **C'est ce qui bloque tout le commercial** : sans cet accord actif, vous ne
> pouvez même pas *créer* les produits d'abonnement. Donc pas de test d'achat,
> donc pas de soumission.

---

## Pendant l'attente — mettre le serveur en état

Rien ici ne dépend d'Apple. À faire dans les jours qui suivent.

### 6. Créer le projet Supabase et poser le schéma · vous · 30 min

`mise-en-route.md`, partie B, de B1 à B6. Trois points à ne pas rater :

- **Région Europe** (Paris ou Francfort). Seul choix irréversible.
- Les deux réglages d'authentification de **B4** : « Confirm email » et les deux
  *Redirect URLs*. Ils ne se voient pas tant qu'on ne s'en sert pas.
- La clé `service_role` n'entre **jamais** dans l'application ni dans le dépôt.

### 7. Passer au plan Pro · vous · 10 min · 25 $/mois

**Pas pour un quota — pour les sauvegardes.** Le plan gratuit n'en a aucune.
Faire tourner de vraies familles là-dessus n'est pas un risque technique, c'est
un risque d'entreprise. Trois familles payantes couvrent l'abonnement.

### 8. Restaurer une sauvegarde, en vrai, une fois · vous · 1 h

L'étape que tout le monde saute, et la seule qui prouve quelque chose :

1. Créez une famille de test avec des enfants et des missions.
2. Notez ce qu'elle contient.
3. Restaurez la sauvegarde de la veille.
4. Vérifiez qu'elle est revenue **exactement** comme notée.

Une sauvegarde jamais restaurée est une hypothèse, pas un filet.

### 9. Activer les travaux de nuit · vous · 20 min

`mise-en-route.md` **B8**.

> **Après les étapes 7 et 8, jamais avant.** Deux de ces quatre travaux
> **suppriment** des lignes, et on ne lance pas une suppression automatique sur
> une base qu'on ne sait pas restaurer.

### 10. Brancher un vrai serveur d'e-mails, puis réactiver la confirmation · vous · 1 h

Le service intégré de Supabase est bridé à quelques envois par heure. Prenez un
expéditeur européen — Scaleway, Brevo, OVH — dans *Project Settings → Auth →
SMTP Settings*, puis **réactivez « Confirm email »**.

> Tant que la confirmation est désactivée, n'importe qui peut créer un compte
> avec l'adresse de quelqu'un d'autre. Acceptable entre vous et vos enfants ;
> plus du tout à la première famille inconnue. **Cette étape doit être faite
> avant la première famille extérieure**, pas avant la soumission.

### 11. Poser une surveillance qui réveille · vous · 20 min

UptimeRobot ou équivalent, qui **envoie un message** quand la base ne répond
plus. Un tableau de bord qu'il faut penser à consulter ne sert à rien à 3 h du
matin, et vous êtes seule à gérer.

---

## Quand l'entitlement de développement est en place — compiler

### 12. Installer Xcode · vous · une demi-journée

Xcode 15+, depuis le Mac App Store. C'est long à télécharger : lancez-le la
veille.

### 13. Faire la première *development build* · moi, puis vous · 1 à 2 jours

```bash
npx expo prebuild
npx eas build --profile development --platform ios
```

Le blocage n'est pas du JavaScript : **Expo Go ne peut pas le charger, par
construction.**

> **Aucune ligne de Swift ni de Kotlin de ce dossier n'a jamais été compilée.**
> La première compilation trouvera des choses : une signature qui a bougé, un
> import manquant, une API dépréciée. C'est normal et rapide — ce qui prend du
> temps, c'est l'architecture, et elle est là.

### 14. Créer la cible d'extension dans Xcode · moi avec vous · 2 h

`MinoShieldMonitor.swift` **ne fait pas partie de l'application** : il doit
vivre dans une cible *Device Activity Monitor Extension*, avec son propre bundle
et son propre profil. Il faut aussi activer le groupe d'applications
`group.fr.minoapp.mino` sur l'application **et** sur l'extension : c'est leur
seule mémoire commune.

> Sans cette cible, **un enfant qui ferme Mino garde son écran ouvert
> indéfiniment**, et le produit ne tient pas sa seule promesse.

### 15. Éprouver le blocage sur un vrai appareil · vous · 1 h

Quatre choses que seul un téléphone peut dire :

1. Le bouclier se pose et se lève.
2. **Fermer Mino ne rouvre pas les écrans** — c'est l'extension qui répond.
3. **Redémarrer le téléphone ne supprime pas le bouclier.**
4. Sur Android, **reculer l'horloge** ne rallonge pas la session et ne fait pas
   facturer zéro minute.

Les trois dernières sont des défauts corrigés sans avoir pu les vérifier
autrement que par le raisonnement et les tests JavaScript.

---

## Quand l'accord Paid Apps est actif — le paiement

**Le paiement se branche ici, avant la soumission.** Apple ouvre la page
Abonnement pendant la revue et appuie sur le bouton : si la feuille de paiement
ne s'ouvre pas, c'est un refus. C'est pour cela que ces trois étapes viennent
avant l'étape 17, et non après.

### 16. Créer les produits, brancher le module, tester en bac à sable

**a) Les produits · vous · 1 h.** App Store Connect → Abonnements → un groupe,
deux produits : mensuel 9,90 € et annuel 79 €. Les mêmes dans Play Console. Les
identifiants doivent correspondre à ce que le code attend — je vous les donne au
moment de brancher.

**b) Le module d'achat · moi · 2 à 3 jours.** RevenueCat ou `expo-iap`, derrière
le contrat déjà écrit. Tout le reste existe : les fonctions serveur qui
vérifient les reçus, le webhook Stripe, le jeton qui relie un achat à une
famille. Seul `setNativeStore()` attend une implémentation.

**c) `EXPO_PUBLIC_BILLING_API_URL` · vous · 2 min.**
`https://<référence>.supabase.co/functions/v1`. Sans elle, le rail boutique ne
s'active pas **même une fois le module branché**.

**d) Le test en bac à sable · vous · 1 h.** Les trois chemins, pas seulement le
premier : l'achat aboutit ; **restaurer** sur un deuxième appareil retrouve
l'abonnement ; un achat **annulé en cours de route** ne laisse rien d'actif.

---

## Quand l'entitlement de distribution est accordé — publier

### 17. Préparer la fiche et soumettre · vous · 1 jour → 1 à 7 jours de revue

- Captures d'écran — `npm run captures` en produit un jeu à jour.
- Description, mots-clés, catégorie.
- **Politique de confidentialité** accessible publiquement en ligne.
- Le questionnaire de confidentialité — répondez-y avec la politique sous les
  yeux : les deux doivent dire la même chose.
- Un **compte de démonstration** avec des données dedans. Un examinateur qui
  tombe sur un écran vide refuse.

Deux points qui font refuser, et qui se préparent :

**Apple, règle 5.1.1(v)** — la suppression du compte depuis l'application. Elle
existe (*Réglages → Gérer mon compte*), mais l'examinateur doit la trouver :
indiquez-lui le chemin dans les notes de revue.

**Google, autorisations restreintes** — `PACKAGE_USAGE_STATS` et
`SYSTEM_ALERT_WINDOW` demandent une déclaration écrite. Le refus de la fiche est
un **risque réel, pas théorique**. La justification doit dire précisément que
Mino est un outil de contrôle parental installé par le parent sur l'appareil de
son enfant, et pourquoi ces deux autorisations sont indispensables.

---

## Le total honnête

| | Votre temps | Attente externe |
|---|---|---|
| Étapes 1-5 — démarches | 3 h | **2 à 6 semaines** |
| Étapes 6-11 — serveur | ½ journée | — |
| Étapes 12-15 — compilation | 1 journée | quelques heures |
| Étape 16 — paiement | 2 h | — |
| Étape 17 — soumission | 1 journée | **1 à 7 jours de revue** |

**Mon travail** : 4 à 6 jours, essentiellement le module d'achat et
l'accompagnement de la première compilation.

**Le chemin critique n'est pas le code.** Ce sont les étapes 2, 3 et 5 — d'où
l'insistance à les lancer aujourd'hui, avant tout le reste.

---

## Après le lancement — les seuils à surveiller

Ces chiffres sont **mesurés**, pas estimés (`capacite.md`).

| Ce qui cède en premier | Vers |
|---|---|
| **Connexions temps réel simultanées** (500 au Pro) | 1 500 – 3 500 familles |
| Taille de la base (8 Go au Pro) | ~16 000 familles |
| Puissance de la machine (*Micro* incluse) | quelques milliers |

**Les connexions simultanées cèdent les premières, et de loin.** C'est le
premier chiffre à regarder dans le tableau de bord, dès les premières centaines
de familles : c'est la seule grandeur qu'on n'ait pas pu mesurer d'avance, parce
qu'elle dépend de combien d'appareils ont l'application ouverte *au même
instant*. Le remède est un réglage — des connexions supplémentaires (20 à
30 $/mois) et une instance *Small* ou *Medium* (15 à 60 $ de plus).

À 10 000 familles : **60 à 115 $ par mois** de serveur contre 99 000 € de
chiffre d'affaires. Environ **un dixième de pour cent du revenu**. Ce n'est pas
là qu'est le risque.

### Ce qui reste à construire, sans bloquer le lancement

- Régénérer le code famille, retirer un appareil appairé.
- `app_config` — un interrupteur distant pour éteindre une fonctionnalité sans
  publier une version.
- `expo-updates` — corriger un défaut JavaScript sans repasser par la revue.
- Le compagnon éteint par défaut, ou l'accord de traitement signé.
- La cinquième tâche de nuit : `purge_companion_messages()`.
