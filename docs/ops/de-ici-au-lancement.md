# D'ici au lancement

**Dix-neuf étapes, dans l'ordre où on les fait.** Chacune dit qui la fait,
combien elle prend, et ce qu'elle débloque.

Une seule règle explique cet ordre : **ce qui dépend d'un tiers se lance en
premier**, parce que c'est le seul temps qu'on ne peut pas rattraper en
travaillant plus. Les étapes 1 à 3 se font donc le même jour, même si les
suivantes semblent plus urgentes.

> Les autres documents restent la référence de leur sujet :
> `mise-en-route.md` pour brancher Supabase, `capacite.md` pour les chiffres
> mesurés, `paiements.md` pour les rails de facturation,
> `apple-family-controls.md` pour le dossier Apple. Celui-ci les ordonne, il ne
> les remplace pas.

---

## Aujourd'hui — les sept démarches qui commandent tout

**L'ordre a été corrigé le 25/08/2026.** La version précédente plaçait la
demande Family Controls en deuxième position : c'était faux. Le formulaire
exige d'être connecté à un compte développeur, qui exige l'inscription société,
qui exige le D-U-N-S, le domaine et un site en ligne. La demande arrive donc
**après**, pas avant.

### 1. Vérifier que « Mino » est libre, puis le déposer · vous · 1 h + 190 €

**Avant d'acheter le moindre domaine.** Si « Mino » est déjà déposé comme
marque pour du logiciel, tout change : le nom, le domaine, l'identifiant de
bundle, la fiche des boutiques, et tous les documents. Autant l'apprendre le
premier jour.

**La recherche est gratuite et immédiate** : base Marques de l'INPI sur
[inpi.fr](https://www.inpi.fr). Regardez surtout la **classe 9** (logiciels) et
la **classe 42** (services informatiques) — ce sont celles qui couvrent Mino.

Le dépôt coûte **190 € pour une classe, puis 40 € par classe supplémentaire**.
Comptez cinq à six mois pour le certificat, mais **la protection court depuis le
jour du dépôt** : déposer tôt protège tôt, et l'attente n'empêche rien.

> Je ne suis pas juriste. Sur le choix exact des classes et sur une recherche
> de similitudes — les marques proches, pas seulement identiques — un conseil
> en propriété industrielle facture quelques centaines d'euros et voit ce
> qu'une recherche à l'œil nu manque.

### 2. **Chercher** le numéro D-U-N-S avant d'en demander un · vous · 15 min

**https://developer.apple.com/enroll/duns-lookup/**

Le SIREN, le SIRET et le numéro de TVA sont des identifiants **français**,
attribués par l'INSEE. Apple ne les utilise pas — ni pour la France, ni pour
aucun pays. Elle n'utilise que le **D-U-N-S**, attribué par Dun & Bradstreet,
une société américaine dont la base sert d'annuaire mondial des entreprises.

Avoir un SIREN ne donne donc pas de D-U-N-S : ce sont deux registres distincts.

**Mais il y a de bonnes chances qu'il existe déjà.** D&B alimente sa base à
partir des registres publics, et attribue souvent un numéro sans que
l'entreprise l'ait demandé :

> « D&B may have already assigned your organization a free D‑U‑N‑S Number.
> Before enrolling, look up your organization to see if you have a D‑U‑N‑S
> Number. »

**Cherchez donc avant de demander.** S'il existe, le délai tombe à zéro.

Saisissez l'identité **exactement telle qu'elle figure au RCS** :
*AGENCE WHEB, 47 rue Vivienne, 75002 Paris*.

S'il n'existe pas, la demande est gratuite et Apple annonce **jusqu'à 5 jours
ouvrés** pour recevoir le numéro, puis **jusqu'à 2 jours ouvrés** pour qu'Apple
le reçoive de D&B. Sept jours ouvrés au pire, pas deux semaines.

> Agence Wheb est immatriculée depuis avril 2026. Une société récente n'est pas
> toujours encore remontée dans la base de D&B : si la recherche ne rend rien,
> ce n'est pas une anomalie, c'est le cas courant pour une jeune entreprise.
> D&B peut aussi vous appeler pour vérifier — gardez le Kbis sous la main.

Sans ce numéro : pas d'inscription société, donc pas de compte développeur,
donc ni demande Family Controls, ni contrat bancaire, ni produits d'abonnement.
C'est la première pierre de toute la chaîne Apple.

### 3. Enregistrer `minoapp.fr` et mettre le site en ligne · vous · 15 min + 1 jour

En parallèle du D-U-N-S. Trois raisons convergent vers ce domaine.

**a) L'identifiant de l'application en dérive** (`fr.minoapp.mino`), et c'est
sur lui que se coche l'entitlement Family Controls de développement — sur celui
de l'extension aussi.

**b) Les adresses légales.** `mino.app` appartient à un tiers, et la politique
de confidentialité comme les CGV y renvoyaient : ces adresses n'auraient jamais
reçu un seul message, alors qu'elles sont légalement obligatoires. Ouvrez
`contact@` et `privacy@` sur le nouveau domaine.

**c) Apple l'exige deux fois pour l'inscription société :**

> « A work email address: Your work email address needs to be associated with
> your organization's domain name. »
>
> « A website: Your organization's website must be publicly available and
> functional, and its domain name must be associated with your organization.
> Links to social media webpages or websites that contain minimal content or
> display a message from a domain registrar won't be accepted. »
>
> — [Apple, *Program enrollment*](https://developer.apple.com/help/account/membership/program-enrollment/)

Le site vitrine existe déjà — présentation, politique de confidentialité, CGV,
mentions légales, médiateur. Il doit être déployé sur `minoapp.fr`, avec ses
adresses de contact corrigées.

> **Attention à ne pas confondre les deux domaines.** L'exigence de site
> public d'Apple porte sur le site de **l'organisation qui s'inscrit** —
> Agence Wheb, donc `wheb-agence.fr`, qui existe déjà. `minoapp.fr` est le
> domaine du **produit** : il porte l'identifiant de bundle, les adresses de
> contact de l'application, et l'URL de la politique de confidentialité que
> réclameront les deux boutiques à la soumission.

Enregistrez le domaine au nom d'**Agence Wheb**, pas à titre personnel.

### 4. Créer le compte Apple de la société · vous · 30 min

**Il n'existe pas de « compte Apple Developer » séparé** : on *inscrit* un
compte Apple existant au programme. Mais n'inscrivez pas le vôtre.

**Sur le domaine de la SOCIÉTÉ, pas celui du produit.** Ce point mérite
qu'on s'y arrête, parce qu'il se trompe facilement : Apple demande une adresse
et un site associés à **l'organisation qui s'inscrit**. L'organisation est
*Agence Wheb*, pas *Minoapp*. C'est donc **`wheb-agence.fr`** qu'il faut
utiliser — et son site, déjà en ligne, satisfait du même coup l'exigence du
site public.

`minoapp.fr` garde son rôle, qui est ailleurs : l'identifiant de bundle, les
adresses de contact **de l'application**, et l'URL publique de la politique de
confidentialité pour les deux boutiques. Deux domaines, deux fonctions.

Créez donc un compte Apple dédié sur une adresse d'Agence Wheb — par exemple
`apple@wheb-agence.fr` — avec l'**authentification à deux facteurs** activée.
Deux raisons de ne pas prendre votre compte personnel :

- Ce compte devient le **titulaire** : c'est lui qui signe les accords
  bancaires et fiscaux. Le transférer plus tard est long et pénible.
- Votre compte Apple personnel porte votre iCloud, vos photos et le partage
  familial de vos propres enfants — ceux-là mêmes sur lesquels vous allez
  tester un produit de contrôle parental.

### 5. S'inscrire au programme développeur · vous · 1 h, dès le D-U-N-S reçu

- **Apple Developer Program** — 99 $/an, inscription **Organization**. Il faut
  le D-U-N-S (étape 2), l'adresse et le site sur le domaine (étape 3), et
  l'autorité légale d'engager la société — que vous avez comme présidente.
- **Google Play Console** — 25 $ une fois.

### 6. Déposer la demande Family Controls · ✅ fait le 31/08/2026, en 5 min

**https://developer.apple.com/contact/request/family-controls-distribution**

Le formulaire demande de se connecter : d'où sa place **après** l'étape 5, et
non avant. C'est la correction d'ordre annoncée en tête de section.

C'était **le seul point du projet où un « non » venu de l'extérieur coûtait le
produit tel qu'il est décrit** — et cette étape était donnée pour longue,
certains développeurs attendant des mois.

**Accordé en cinq minutes**, par e-mail automatique, sans dossier à plaider :
le formulaire ne demande que le nom, l'adresse et le Team ID, tous pré-remplis.
Le risque le plus lourd du projet est retiré. Voir `apple-family-controls.md`
pour ce qui reste vrai — le texte du dossier décrit le produit tel qu'il doit
le rester, et c'est la revue App Store qui le vérifiera.

**Une seule demande** : l'entitlement de distribution s'attache au **compte**,
pas à un identifiant. Le formulaire ne comporte aucun champ pour désigner une
application — nom, adresse et Team ID sont pré-remplis, et c'est tout.

Ce qui se fait bien **deux fois**, en revanche, c'est l'entitlement de
*développement*, à cocher identifiant par identifiant dans *Certificates,
Identifiers & Profiles* :

| Cible | Bundle |
|---|---|
| L'application | `fr.minoapp.mino` |
| L'extension de surveillance | `fr.minoapp.mino.MinoShieldMonitor` |

Cocher le premier et oublier le second donne une application qui compile et
dont le bouclier ne se repose **jamais** à l'échéance. Sur chacun, cocher
« Family Controls (Development) » et **pas** « Family Controls App and Website
Usage » : celui-là sert à rapporter ce que l'enfant consulte, ce que Mino ne
fait pas et affirme ne pas faire dans son dossier.

Le texte du dossier est prêt dans `docs/apple-family-controls.md`. Ce qu'Apple
juge, en une phrase : *est-ce un vrai produit de contrôle parental, ou un moyen
détourné de surveiller quelqu'un ?*

> L'entitlement de **développement**, lui, se coche seul dans le portail une
> fois inscrite, sans dossier. On peut donc compiler et tester sans attendre la
> réponse. C'est celui de **distribution** — TestFlight et App Store — qui
> passe par ce formulaire.

### 6 bis. Le nom sur l'App Store · ✅ fait le 31/08/2026

**« Mino » seul était déjà pris.** Les noms sont uniques sur tout l'App Store,
attribués au premier qui les réserve, et la vérification n'a lieu qu'au moment
de créer la fiche — donc après tout le reste.

Retenu : **`Mino : une mission à la fois`** (28 caractères sur 30 autorisés).
La règle d'Apple porte sur la chaîne exacte : « Mino » suivi d'un descriptif
reste disponible, et sous l'icône d'un iPhone l'utilisateur lit « Mino » de
toute façon, le nom y étant tronqué.

Rien d'autre ne bouge : bundle `fr.minoapp.mino`, domaine `minoapp.fr`, et à
l'intérieur du produit le nom reste Mino partout.

Les mots-clés de recherche n'ont pas à tenir dans le nom : l'App Store a trois
champs distincts — nom (30), sous-titre (30), mots-clés (100, invisibles). À
remplir au moment de la fiche.

> **À vérifier avant le dépôt de marque de l'étape 1** : quelle est
> l'application « Mino » déjà publiée, qui l'édite et depuis quel pays. Un
> logiciel européen du même nom est une antériorité qui peut fonder une
> opposition — 190 € et six mois valent bien cinq minutes de recherche.

### 7. Signer l'accord *Paid Apps* · vous · 30 min

Dans App Store Connect : *Agreements, Tax, and Banking*. Coordonnées bancaires
et informations fiscales. Même chose côté Google.

> **C'est ce qui bloque tout le commercial** : sans cet accord actif, vous ne
> pouvez même pas *créer* les produits d'abonnement. Donc pas de test d'achat,
> donc pas de soumission.

---

## Pendant l'attente — mettre le serveur en état

Rien ici ne dépend d'Apple. À faire dans les jours qui suivent.

### 8. Créer le projet Supabase et poser le schéma · vous · 30 min

`mise-en-route.md`, partie B, de B1 à B6. Trois points à ne pas rater :

- **Région Europe** (Paris ou Francfort). Seul choix irréversible.
- Les deux réglages d'authentification de **B4** : « Confirm email » et les deux
  *Redirect URLs*. Ils ne se voient pas tant qu'on ne s'en sert pas.
- La clé `service_role` n'entre **jamais** dans l'application ni dans le dépôt.

### 9. Passer au plan Pro · vous · 10 min · 25 $/mois

**Pas maintenant.** Le plan gratuit suffit pour le développement et vos propres
essais — c'est exactement ce pour quoi il est fait, et rien dans nos volumes ne
l'inquiète avant plusieurs centaines de familles (`capacite.md`).

**Le déclencheur est la première famille qui n'est pas la vôtre.** Pas la
première mission, pas le premier test, pas la soumission : la première famille
extérieure dont les données comptent.

Et le motif n'est pas un quota, c'est l'absence totale de sauvegarde sur le
plan gratuit. Faire tourner de vraies familles là-dessus n'est pas un risque
technique, c'est un risque d'entreprise. Trois familles payantes couvrent
l'abonnement.

> Cette étape était placée juste après la création du projet dans une version
> antérieure de ce document, ce qui revenait à faire payer un serveur de
> production pendant des semaines de développement. C'était une erreur, et elle
> contredisait `capacite.md`, qui dit depuis le début « gratuit pendant le
> développement, Pro dès la première famille qui paie ».

### 10. Restaurer une sauvegarde, en vrai, une fois · vous · 1 h

> Dépend de l'étape 9 : le plan gratuit n'a aucune sauvegarde à restaurer, et
> la première sauvegarde quotidienne n'existe que le lendemain du passage au
> Pro. À faire donc le jour où vous passez au Pro, pas avant.

L'étape que tout le monde saute, et la seule qui prouve quelque chose :

1. Créez une famille de test avec des enfants et des missions.
2. Notez ce qu'elle contient.
3. Restaurez la sauvegarde de la veille.
4. Vérifiez qu'elle est revenue **exactement** comme notée.

Une sauvegarde jamais restaurée est une hypothèse, pas un filet.

### 11. Activer les travaux de nuit · vous · 20 min

`mise-en-route.md` **B8**.

> **Après les étapes 7 et 8, jamais avant.** Deux de ces quatre travaux
> **suppriment** des lignes, et on ne lance pas une suppression automatique sur
> une base qu'on ne sait pas restaurer.

### 12. Brancher un vrai serveur d'e-mails, puis réactiver la confirmation · vous · 1 h

Le service intégré de Supabase est bridé à quelques envois par heure. Prenez un
expéditeur européen — Scaleway, Brevo, OVH — dans *Project Settings → Auth →
SMTP Settings*, puis **réactivez « Confirm email »**.

`emails.md` contient la marche à suivre complète, et surtout **les trois
modèles de messages traduits** : ceux de Supabase sont en anglais, et un parent
français qui reçoit « *Confirm your signup* » ne clique pas.

> Commencez cette étape **tôt** même si vous la finissez tard : ce qui prend du
> temps n'est pas le réglage, ce sont les enregistrements DNS et leur
> propagation. Le reste peut avancer pendant ce temps.

> Tant que la confirmation est désactivée, n'importe qui peut créer un compte
> avec l'adresse de quelqu'un d'autre. Acceptable entre vous et vos enfants ;
> plus du tout à la première famille inconnue. **Cette étape doit être faite
> avant la première famille extérieure**, pas avant la soumission.

### 13. Poser une surveillance qui réveille · vous · 20 min

UptimeRobot ou équivalent, qui **envoie un message** quand la base ne répond
plus. Un tableau de bord qu'il faut penser à consulter ne sert à rien à 3 h du
matin, et vous êtes seule à gérer.

---

## Quand l'entitlement de développement est en place — compiler

### 14. Installer Xcode · vous · une demi-journée

Xcode 15+, depuis le Mac App Store. C'est long à télécharger : lancez-le la
veille.

### 15. Faire la première *development build* · moi, puis vous · 1 à 2 jours

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

### 16. Créer la cible d'extension dans Xcode · moi avec vous · 2 h

`MinoShieldMonitor.swift` **ne fait pas partie de l'application** : il doit
vivre dans une cible *Device Activity Monitor Extension*, avec son propre bundle
et son propre profil. Il faut aussi activer le groupe d'applications
`group.fr.minoapp.mino` sur l'application **et** sur l'extension : c'est leur
seule mémoire commune.

> Sans cette cible, **un enfant qui ferme Mino garde son écran ouvert
> indéfiniment**, et le produit ne tient pas sa seule promesse.

### 17. Éprouver le blocage sur un vrai appareil · vous · 1 h

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

### 18. Créer les produits, brancher le module, tester en bac à sable

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

### 19. Préparer la fiche et soumettre · vous · 1 jour → 1 à 7 jours de revue

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
| Étapes 1-7 — démarches | 4 h | **1 à 5 semaines** |
| Étapes 8-13 — serveur | ½ journée | — |
| Étapes 14-17 — compilation | 1 journée | quelques heures |
| Étape 18 — paiement | 2 h | — |
| Étape 19 — soumission | 1 journée | **1 à 7 jours de revue** |

**Mon travail** : 4 à 6 jours, essentiellement le module d'achat et
l'accompagnement de la première compilation.

**Le chemin critique n'est pas le code.** Ce sont les étapes 1, 2 et 5 — d'où
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
