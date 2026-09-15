# LES POSTS DE LANCEMENT — INSTAGRAM & TIKTOK

*Quatre carrousels, dix posts fixes, un Reel.*
*Chaque post ouvre sur une scène ou sur une mission réelle. Le produit arrive en réponse, jamais en sujet.*
*La ligne qui porte la série est déjà arbitrée : **« Le temps d'écran se gagne, il ne se négocie plus. »***

- **Visuels :** `docs/marketing/visuels-lancement/` — 32 PNG en **1080 × 1350** (4:5, le format du fil Instagram). Couverture Reel / TikTok en 1080 × 1920.
- **Les vues de preuve viennent de vos captures de boutique**, recomposées : le téléphone est extrait de `store/ios-6.9/` et la légende retypographiée au format 4:5, plutôt que d'étirer un carré.
- **Page de consultation :** https://claude.ai/artifact/UGVgTQwbjEb4mEiS9eu9PR
- **Générateur :** `scripts/` hors dépôt ; palette de `src/theme/colors.ts`, Nunito de `node_modules/@expo-google-fonts/nunito`, captures de `assets/guide/`.

⛔ **Deux points bloquants.** La marque « Mino » n'est pas déposée et aucune recherche d'antériorité n'a été faite (§ 13.1) — ouvrir les comptes **est** le début de la communication publique. Et `minoapp.fr/telecharger` annonce encore « Android : la version arrive ».

---

## ⚠️ LA CAPTURE 06 DÉPASSE LES RÉSEAUX SOCIAUX

`store/*/06-autres-ecrans` montre **Nintendo Switch, PlayStation et Xbox** dans la section « Ajouter en un geste ». C'est Apple 2.3.9 — on répond des droits de tout ce qui figure dans un visuel — et le brief interdit nommément de photographier cet écran.

**Le défaut est dans les cinq dossiers** : `ios-6.9`, `ios-6.5`, `ios-ipad-13`, `android`, `carre`. Ce n'est donc pas seulement un visuel social à écarter : **c'est le jeu destiné à l'App Store et à Google Play.**

**À faire avant tout envoi :** remplacer le huitième écran dans le script de captures, ou masquer la section « Ajouter en un geste » au moment de la prise. Les sept autres captures sont bonnes, et leurs huit légendes correspondent mot pour mot à celles du brief.

---

## POST 01 — « Encore cinq minutes. »

**Carrousel 5 vues** · `post01-1` → `post01-5`
La scène que tout le monde a vécue hier soir. Le produit n'est pas nommé avant la quatrième vue.

> « Encore cinq minutes. »
>
> Puis cinq de plus. Puis la voix qui monte, des deux côtés. Et vous qui finissez par céder, ou par couper — sans être d'accord avec vous-même ni dans un cas ni dans l'autre.
>
> Ce n'est pas une question d'autorité. C'est que rien, dans la soirée, ne dit où s'arrête le temps d'écran. Alors il se discute. Tous les soirs.
>
> Mino répond à la question avant qu'elle soit posée : le temps d'écran, votre enfant le gagne en faisant ses missions du quotidien. Ce qu'il a gagné, il l'a. Ce qu'il n'a pas gagné n'est pas à débattre.
>
> Le temps d'écran se gagne, il ne se négocie plus.

`#tempsdécran #parentalité #viedeparent #famille #enfants #soirée #écrans #organisationfamiliale #contrôleparental`

✓ *La scène est décrite sans reproche au parent — la culpabilisation est le premier interdit de ton du dépôt. Aucun verbe de blocage. Aucune promesse de résultat.*

---

## POST 02 — Fini la négociation du soir

**Reel / TikTok · `post02-reel.mp4` · 21 s · 1080 × 1920 · H.264, piste muette**

La vidéo est montée. Six plans :

| Temps | Plan | Nature |
|---|---|---|
| 0 – 2,8 s | « Fini la négociation du soir. » | typographie |
| 2,8 – 6,2 s | « Une mission. » — Ranger sa chambre, +15 minos, compteur à 35 | **capture réelle** (`store/ios-6.9/01`) |
| 6,2 – 9,6 s | « Il appuie sur J'ai terminé. » | **capture réelle** (`store/ios-6.9/02`) |
| 9,6 – 13,2 s | « Vous confirmez. » — le bouton, puis +15 min qui s'envole | **graphique de marque** |
| 13,2 – 17,8 s | Le compteur passe de 35 à 50, anneau et capsules, célébration | **graphique de marque** |
| 17,8 – 21,5 s | « Le temps d'écran se gagne, il ne se négocie plus. » | typographie |

**Pourquoi deux plans sont dessinés plutôt que capturés.** Aucune capture ne montre 50 : le compteur d'arrivée n'existe nulle part en image. Et l'écran parent réel affiche la demande d'un autre enfant à +10, ce qui contredirait les +15 de la mission qu'on vient de voir. Ces deux plans sont donc **plein cadre, hors téléphone**, pour qu'ils ne se lisent pas comme des captures d'écran. Le libellé du bouton est copié depuis le code.

**La célébration est la vraie.** Les 33 images de `celebrate` — la seule animation qui existe — jouées une fois, à 24 i/s. Le fichier étant livré sur fond blanc opaque, il est détouré par propagation depuis les bords, pour ne pas percer les yeux de la mascotte.

**Muet, avec une piste audio silencieuse** pour que les plateformes l'acceptent : vous posez la musique dans l'application.

⚠️ Le libellé du bouton est **« C'est fait · +15 min »**, copié depuis le code. Voix off au **vouvoiement** : on parle au parent, jamais à l'enfant. Aucune animation ajoutée au montage — `celebrate` est la seule qui existe.

---

## POST 03 — Ranger sa chambre : +15 minutes

**Carrousel 5 vues** · `post03-1` → `post03-5`
Le troc, montré nu. C'est ce qui se comprend en une seconde et se raconte à une amie en une phrase.

> Mettre la table. Préparer son cartable. Faire ses devoirs.
>
> Chez vous, ça se réclame trois fois. Dans Mino, ça se compte.
>
> Et c’est vous qui décidez du temps que chaque mission fait gagner. Le repère qui marche : une journée de missions faites doit donner à peu près le temps d'écran que vous acceptiez déjà. Cinq minutes pour un geste rapide, dix à quinze pour une vraie tâche, vingt pour un effort long.
>
> Cinquante-quatre missions sont déjà écrites, rangées en douze routines — la routine du matin, celle du coucher, les devoirs, la chambre. Vous choisissez, vous ajustez, et c'est parti.

`#routine #parentalité #enfants #famille #tempsdécran #autonomie #routinedumatin`

---

## POST 07 — Il n'a pas de téléphone. Il a une console.

**Carrousel 3 vues** · `post07-1` → `post07-3`

> Dimanche, 15 h 40. La manette est branchée depuis quand, déjà ?
>
> La console, la télé, l'ordinateur : ces écrans-là aussi se gagnent. Votre enfant choisit l'écran et la durée, appuie sur « Demander à mon parent », et c'est vous qui lancez le minuteur. Le décompte démarre à ce moment-là, pas à la demande — une demande sans réponse ne coûte rien.
>
> Soyons clairs sur une chose, parce que personne d'autre ne vous le dira : Mino ne démarre ni n'arrête une console. Aucune ne le permet à une application extérieure. Il tient le compte — et c'est déjà ce qui met fin à la discussion.
>
> Mino tient le compte, vous tenez la manette.

`#jeuxvidéo #famille #parentalité #enfants #tempsdécran #dimanche`

⛔ **La capture de boutique `06-autres-ecrans` est écartée** : Nintendo Switch, PlayStation et Xbox y sont lisibles (Apple 2.3.9). Le visuel de preuve de ce post est `04-son-temps`, où les écrans s'appellent « Console du salon » et « Télé du salon ».

---

# DIX POSTS FIXES — UNE IMAGE CHACUN

*Pas de carrousel : une image, une mission, une idée.*
*Chaque mission vient du catalogue réel (`src/domain/missionLibrary.ts`) — titre, emoji, minutes, tranche d'âge et consigne de sécurité sont copiés, pas inventés.*

**La règle d'écriture de la série.** On dit que la mission **existe** et ce qu'elle **apprend**. On ne dit jamais ce que l'enfant fera : ce serait une promesse de résultat, que le dépôt interdit. Et le temps gagné reste une petite pastille dans la carte, comme à l'écran — jamais un prix affiché en grand.

| # | Fichier | Accroche | Mission |
|---|---|---|---|
| 1 | `tache01-lessive` | À treize ans, une machine à laver, c'est une première autonomie. | Lancer et étendre une lessive · 20 min · dès 13 ans |
| 2 | `tache02-debarrasser` | Ce n'est pas l'assiette qui compte. | Débarrasser la table · 10 min · dès 5 ans |
| 3 | `tache03-repas` | Cuisiner ensemble, c'est du temps passé côte à côte. | Aider à préparer le repas · 15 min · dès 7 ans |
| 4 | `tache04-gouter` | Préparer le goûter. Pour tout le monde, pas juste pour soi. | Préparer le goûter pour tout le monde · 15 min · dès 8 ans |
| 5 | `tache05-plantes` | La première mission des plus petits. | Arroser les plantes · 5 min · dès 5 ans |
| 6 | `tache06-garde` | La première fois qu'on vous confie quelqu'un. | Garder mon frère ou ma sœur une heure · 30 min · dès 15 ans |
| 7 | `tache07-mot-gentil` | Il existe une mission qui s'appelle « Dire un mot gentil ». | Dire un mot gentil à Elliott · 10 min · 5 à 12 ans |
| 8 | `tache08-sans-telephone` | Une heure sans téléphone fait gagner du temps d'écran. | Une heure sans téléphone · 20 min · dès 13 ans |
| 9 | `tache09-diner` | Dîner en famille sans téléphone. | Dîner en famille sans téléphone · 15 min · dès 13 ans |
| 10 | `tache10-amis` | Voir ses amis en vrai. | Voir mes amis en vrai · 20 min · dès 13 ans |

**Les quatre derniers ne sont pas des tâches ménagères, et c'est voulu.** Une application de temps d'écran qui écrit « Voir mes amis en vrai » et « Une heure sans téléphone » dans son propre catalogue dit quelque chose sur elle-même que dix arguments ne diraient pas. Ce sont les plus partageables de la série.

**Les consignes de sécurité sont dans l'image**, reprises mot pour mot du code — « Sans les couteaux : c'est l'adulte qui les range », « Un adulte reste joignable et responsable à tout moment ». Elles ne sont pas une réserve juridique : elles montrent qu'une application qui propose des tâches à des enfants sait où s'arrête ce qu'elle propose.

**Écartés de la première version, à votre demande :** les poubelles, l'aspirateur, le linge sale, l'animal et les courses. Les accroches manquaient de bienveillance ou ne se comprenaient pas.

---

# CE QUI A ÉTÉ ÉCARTÉ

**Six carrousels retirés à votre demande** (15/09) : « Ce n'est plus à vous de dire non », « À quatorze ans, il va me rire au nez », « Personne ne peut les lui reprendre », « Le mercredi, on ne compte pas », « Trois enfants, six écrans, un seul abonnement », et « 30 jours pour voir » avec sa vue de prix. Manque de bienveillance pour les quatre premiers, incompréhensible pour le cinquième, et le prix n'a pas sa place dans un post.

**Restent quatre carrousels** — 01, 02, 03 et 07 — **et les dix posts fixes.**

## Les angles écartés plus tôt

Quatre angles sont vrais, bien écrits, et ne vendent rien. Ils parlent du produit à quelqu'un qui l'a déjà adopté : ce sont des posts de deuxième trimestre, pas de lancement.

| Angle | Pourquoi il sort |
|---|---|
| **Le choix du mot « missions »** | Passionnant pour qui fabrique le produit. Un parent qui découvre la marque n'a aucune raison de s'y intéresser. |
| **Ce que Mino refuse d'être** | Un manifeste se lit quand on vous connaît déjà. Avant, c'est une liste de choses absentes. |
| **L'accessibilité** | Vrai argument, mauvais moment : il rassure un parent déjà convaincu, il n'en convainc aucun. |
| **Ce qui se passe quand l'abonnement s'arrête** | Excellent post de fidélité et de réponse en commentaire. Parler de résiliation avant l'inscription vend contre soi. |

---

# CALENDRIER

| | Lundi | Mercredi | Vendredi |
|---|---|---|---|
| **Semaine 1** | 01 · « Encore cinq minutes. » | 02 · Fini la négociation du soir | 03 · Ranger sa chambre : +15 min |
| **Semaine 2** | 04 · Ce n'est plus à vous de dire non | 05 · « Il va me rire au nez » | 07 · Il a une console |
| **Semaine 3** | 06 · Personne ne peut les reprendre | 08 · Le mercredi, on ne compte pas | 09 · Un seul abonnement |
| **Semaine 4** | 10 · 30 jours pour voir | | |

**La scène d'abord, le prix en dernier.** Les trois premiers posts doivent partir dans la même semaine : seuls, ils ne racontent rien.

**Le parrainage ne figure dans aucun post.** Le dépôt limite son apparition à trois moments, et « le mettre partout devient du bruit, puis de l'agacement ». À garder pour plus tard, en story.

---

# BIO

**Instagram** (122 caractères) :
> Le temps d'écran se gagne, il ne se négocie plus.
> Missions du quotidien → minutes d'écran. 5-17 ans.
> Édité par Agence Wheb

**TikTok** (68 caractères) :
> Le temps d'écran se gagne. Missions → minutes. 5-17 ans. Agence Wheb

**Lien de bio :** `minoapp.fr/telecharger` — et jamais un lien de boutique direct. L'appareil qu'on ouvre est souvent celui de l'enfant, et il peut être Android ; la page aiguille toute seule. **À n'activer qu'une fois la mention « Android : la version arrive » corrigée.**

---

# RÉPONDRE AUX COMMENTAIRES

Répondre à **tous** les commentaires négatifs, sans défensive : la réponse est lue par les futurs installeurs bien plus que par son destinataire. Le § 10 du brief porte les réponses prêtes.

Trois réflexes qui ne se négocient pas :

1. **Les appels d'urgence** — ne jamais ouvrir le sujet. Si on est interrogé : la formulation exacte du § 7.3, **seconde moitié comprise, elle ne se coupe jamais.**
2. **« Ça marche sur Android ? »** — répondre par la mécanique, jamais par une promesse. Le comportement n'est pas le même des deux côtés.
3. **« Vos données sont où ? »** — la formulation nuancée du § 8.8, jamais « vos données restent en Europe ».

---

# CE QUI N'EST DANS AUCUN POST

| Absent | Raison |
|---|---|
| **Tout verbe de blocage** (« bloque », « verrouille », « empêche », « coupe ») | Apple 2.3.1, motif de **retrait** après publication. Levé seulement quand le module natif est dans le binaire soumis **et** que l'habilitation Family Controls de distribution est obtenue. La série vend la boucle, pas le blocage. |
| **Tout appel au téléchargement, lien de boutique, date** | Statut de disponibilité non tranché par écrit. Le lien vit dans la bio. |
| **Les appels d'urgence, les messages, le 119** | Jamais spontanément, jamais dans un visuel. |
| **Le compagnon** | Il exige cinq mentions obligatoires dans le même post. Ne tient pas dans une légende de lancement. |
| **Tout chiffre de tests, de couverture, ou interne** | Le dépôt se contredit sur les premiers ; les seconds donneraient la stratégie d'acquisition. |
| **Toute comparaison nommant un concurrent** | Aucune règle n'existe dans le dépôt (§ 13.7). |
| **Toute promesse de résultat** | Mino ne promet nulle part un résultat éducatif, et ses CGV disent qu'il ne se substitue pas à l'autorité parentale. |

**La dernière question, avant chaque publication :**
> Cette phrase serait-elle encore vraie si un examinateur d'Apple ouvrait l'application aujourd'hui, et si un parent la citait dans un an ?
