# DIX POSTS DE LANCEMENT — INSTAGRAM & TIKTOK

*Écrits contre `docs/marketing/brief-reseaux-sociaux.md` (matière au 15/09/2026).*
*Chaque post a été passé à la checklist du § 12. Les renvois « § » pointent vers le brief.*

---

## ⛔ AVANT D'OUVRIR LE MOINDRE COMPTE — DEUX POINTS BLOQUANTS

**1. La marque « Mino » n'est pas déposée et aucune recherche d'antériorité n'a été faite (§ 13.1).**
Le dépôt écrit : *« À faire avant la communication publique, pas après — déposer une marque qu'on utilise déjà et qui appartient à un autre est la pire séquence. »*
**Ouvrir @mino sur Instagram et TikTok EST le début de cette communication publique.** La réservation du nom de fiche sur les boutiques (31/08/2026) ne vaut pas dépôt de marque.
→ **Rien de ce qui suit ne se publie tant que cette case n'est pas cochée.** Les textes, eux, sont prêts.

**2. La page `minoapp.fr/telecharger` annonce encore « Android : la version arrive ».**
C'est la cible unique de tout ce qui invite à installer Mino (vos mémoires). Elle devient fausse le jour où Play publie la 1.1.0.
→ **À corriger avant que le premier post n'envoie du trafic vers le lien de bio.**

**Rappel de contexte (vos mémoires, 15/09/2026) :** la 1.1.0 soumise embarque quatre phrases fausses, corrigées dans le dépôt depuis `1acf6a6` mais absentes du binaire. **Aucun post ci-dessous ne reprend ces quatre phrases** — ni les transferts hors UE, ni le rapport d'incident, ni la liste des applications, ni les appels d'urgence.

---

## 📸 AUDIT DES VISUELS DISPONIBLES

Les 32 captures de boutique **n'existent pas sur disque** (§ 5.8) — `store/` ne contient que `icon-512.png` et `feature-graphic-1024x500.jpg`. La seule matière image réelle est le **guide interne** (`assets/guide/`, 18 fichiers `.webp`) et la **mascotte** (`assets/mascot/`, 8 poses en 1024²).

⚠️ **Les 18 images du guide datent du 25 août 2026 — avant le changement de prix du 8 septembre.** Je les ai toutes ouvertes. Cinq sont inutilisables et une est risquée.

### ✅ Utilisables telles quelles

| Fichier | Ce qu'on y voit | Pour quel post |
|---|---|---|
| `enfant-mission.webp` | « Ranger ma chambre », TU GAGNES +15 MINOS, bouton vert **J'AI TERMINÉ ✓** | 1, 2, 3 |
| `enfant-attente.webp` | Pastille ⏳ EN ATTENTE, « Bien joué ! Demande envoyée à ton parent. » | 2, 12 |
| `parent-accueil.webp` | « Bonjour Julie », Noah 35:00, section **En attente de vous** | 1, 2, 12 |
| `enfant-accueil.webp` | Anneau, **35 minos disponibles**, capsules | 2, 9 |
| `enfant-missions.webp` | Carte de mission, +15 minos, ⭐ À FAIRE | 3, 9 |
| `enfant-temps.webp` | Capsules, « 1 capsule = 5 minos », écrans **Console du salon / Télé du salon** | 7, 9 |
| `parent-missions.webp` | Les routines prêtes à l'emploi | 3, 4 |
| `parent-nouvelle-mission.webp` | Les suggestions, « Un nom, un temps gagné, un enfant. C'est tout. » | 3, 4 |
| `parent-routine.webp` | Routine du coucher, 5 missions, barème 5/10/15 | 8, 9 |
| `parent-enfants.webp` | Noah 8 ans / Elliott 6 ans / Léa 14 ans, tous **en minutes** | 5, 10, 11 |
| `rejoindre.webp` | Code famille `MINO-7K2QX9`, « Tu n'as ni compte, ni mot de passe » | 11 |
| `assets/mascot/*.png` | 8 poses, 1024², fonds transparents | partout |
| `store/play/feature-graphic-1024x500.jpg` | « Grandir, une mission à la fois. » + Mino `happy` | bannière / couverture |

### ❌ À ne pas publier

| Fichier | Pourquoi |
|---|---|
| `parent-appareils.webp` | **Nintendo Switch et PlayStation lisibles** → Apple 2.3.9, marques tierces (§ 7.4). Le brief interdit nommément de photographier cet écran. |
| `parent-abonnement.webp` | Affiche **9,90 € / 79 € / −34 % / 6,58 €** — les quatre chiffres périmés de la liste rouge (§ 7.8). Plus un bandeau de développement (« Aucun prestataire de paiement n'est configuré »). |
| `parent-parrainage.webp` | « La famille que vous parrainez démarre avec **60 jours d'essai au lieu de 30** » et « chaque mois offert est **déduit de votre prochaine facture** ». Deux interdits frontaux (§ 6.5, § 6.6). |
| `accueil.webp` | Bouton **« Découvrir avec la démo »**, retiré du code (§ 2.6). Le publier promettrait une démo sans inscription qui n'existe plus. |
| `parent-reglages.webp` | Adresse **julie@mino.app** (domaine qui n'est pas le nôtre) + bandeau d'aperçu. |
| `qui.webp` ⚠️ | Affiche « 35 **minos** », « 20 **minos** » et « 0 **min** » **dans la même image** : les deux registres d'âge dans une seule création (§ 7.4). À éviter, même si l'écran est juste. |

**Conséquence :** aucun post ci-dessous ne montre de prix en capture, de parrainage en capture, ni d'écran d'appareils.

---

## 🎨 GABARIT GRAPHIQUE (à donner tel quel à un graphiste)

- **Police :** Nunito. Titre **800 ExtraBold**, sous-titre **600 SemiBold**.
- **Texte :** marine `#1A1D2E`. Secondaire `#5B6480`.
- **Fonds :** les quatre couples de dégradés qui alternent —
  `#E8F3FF`/`#F7FAFF` · `#EAF7F1`/`#F8FCFA` · `#F1EFFF`/`#FAF9FF` · `#FFF4E8`/`#FFFBF6`.
- **Règle de partage :** les couleurs vives (`#4EB6FF` `#7A7CFF` `#2BC98A` `#FFC85A` `#FF7DA0`) gardent les aplats, anneaux et pastilles ; **les encres** (`#0065AC` `#4548FF` `#1A7A54` `#956300` `#CC0037`) gardent **tout le texte**.
- **Interdit :** texte blanc sur `#4EB6FF` ou sur `#2BC98A` (2,2:1 et 2,1:1 — illisible). Sur un aplat de marque, le texte est **marine**.
- **Angles :** 24 à 32 px. Boutons en pilule. Ombres très légères.
- **La phrase à donner au graphiste :** *« Du papier posé sur du papier, jamais un tableau de bord encadré. »*
- **Mascotte :** jamais sur un fond bleu de marque (elle devient une tache), jamais en avatar, jamais accompagnée d'un second personnage, jamais retouchée à la main.

---

# LES DIX POSTS

---

## POST 1 — « Un contrôle parental retire du temps. Mino en fait gagner. »

**Le post d'ouverture.** C'est le meilleur angle de différenciation du produit (§ 1.5).

**Format :** carrousel 4 vues (Instagram) · Reel 15 s (TikTok)
**Visuels :** ① typographie sur dégradé `#E8F3FF`/`#F7FAFF`, Mino pose `happy` en bas à droite — ② `parent-accueil.webp` — ③ `enfant-mission.webp` — ④ signature.

**Vue 1 :** « Un contrôle parental retire du temps. »
**Vue 2 :** « Mino en fait gagner. »
**Vue 3 :** « Il n'y a pas de quota décidé le matin. »
**Vue 4 :** « Grandir, une mission à la fois. »

**Légende :**
> Il n'y a pas de quota décidé à l'avance. Le temps disponible est exactement celui que votre enfant a gagné.
>
> Vous créez les missions du quotidien. L'enfant appuie sur « J'ai terminé ». Vous confirmez. Les minutes arrivent tout de suite.
>
> C'est tout le produit. Il n'y a rien derrière.
>
> Grandir, une mission à la fois.

**Alt :** « L'accueil de Mino côté parent : Noah, 35 minutes disponibles, et une mission qui attend d'être confirmée. »

**Hashtags :** #tempsdécran #parentalité #famille #enfants #routine #organisationfamiliale #viedeparent #écrans #contrôleparental

**Vérifié :** aucun verbe de blocage · parent vouvoyé · « missions » et « confirmez » · aucune promesse de résultat éducatif · visuels conformes.

---

## POST 2 — La boucle, filmée : 35 → 50

**Le post le plus important de la série.** Le brief le dit mot pour mot : *« Le moment à filmer, c'est le compteur qui grimpe visiblement de 35 à 50. »*

**Format :** Reel / TikTok, 20-25 s, tourné dans la vraie application (parcours Julie/Noah, qui est celui du dépôt).

**Découpage :**
| Temps | Image | Texte à l'écran |
|---|---|---|
| 0-3 s | `enfant-missions.webp` — « Ranger ma chambre · +15 minos » | « Une mission. » |
| 3-7 s | Le pouce appuie sur **J'AI TERMINÉ ✓** (bouton vert) | « L'enfant déclare. » |
| 7-11 s | Pastille ⏳ **EN ATTENTE** | « Il ne s'ajoute rien tout seul. » |
| 11-16 s | Accueil parent, **En attente de vous** → appui sur **C'est fait · +15 min** | « Vous confirmez. » |
| 16-22 s | **Le compteur passe de 35 à 50.** Célébration, mascotte `delighted` | « Les minutes arrivent tout de suite. » |

⚠️ **Le libellé du bouton est « C'est fait · +15 min »** — copié depuis le code. Jamais « VALIDER +15 MIN » (c'est le README, il est en retard).
⚠️ **Voix off : vouvoiement.** On raconte à un parent, on ne s'adresse jamais à l'enfant.
⚠️ **Aucune animation ajoutée au montage** : `celebrate` est la seule qui existe (1 375 ms, jouée une fois).

**Légende :**
> Quinze secondes, du début à la fin.
>
> Une mission faite, un bouton vert, votre confirmation — et le compteur monte. Rien ne s'ajoute sans vous, et rien n'attend le lendemain.
>
> Les minutes gagnées sont acquises : une fois créditées, elles ne se reprennent pas.

**Hashtags :** #tempsdécran #routine #parentalité #famille #enfants #devoirs

---

## POST 3 — Le mot qu'on a refusé

**Un post entier sur le choix d'un mot, justifié comme une décision de produit (§ 11, angle 2).**

⚠️ **Piège de cet angle :** les deux mots écartés ne s'écrivent nulle part, **même en repoussoir, même dans un titre.** Le post tient sans les nommer.

**Format :** carrousel 5 vues, typographie seule sur les quatre premières · `parent-nouvelle-mission.webp` en cinquième.

**Vue 1 :** « Il fallait un mot pour nommer ce qu'un enfant fait à la maison. »
**Vue 2 :** « Deux mots se présentaient. L'un annonçait une punition déguisée. »
**Vue 3 :** « L'autre promettait une aventure là où il n'y a qu'une table à mettre. »
**Vue 4 :** « On a gardé : **missions**. Un mot qui dit qu'on compte sur vous. »
**Vue 5 :** capture — « Un nom, un temps gagné, un enfant. C'est tout. »

**Légende :**
> Huit mots pour expliquer le produit entier : ce sont des missions, un mot qui dit qu'on compte sur vous.
>
> Le vocabulaire n'est pas décoratif chez nous. Un parent ne *valide* pas une chambre rangée — le mot jugerait le travail. Ce qu'il **confirme**, c'est que son enfant l'a bien faite.
>
> Et quand ce n'est pas fait : c'est **à refaire**, pas raté. Aucune minute retirée, aucun échec affiché.

**Hashtags :** #parentalité #éducation #famille #motsdenfants #routine #enfants

**Vérifié :** les deux mots interdits n'apparaissent pas · « valider » n'est employé qu'en négatif explicite, dans la phrase déjà arbitrée du dépôt · « à refaire » est le libellé réel.

---

## POST 4 — Ce que Mino refuse d'être

**Format :** post unique, typographie seule, dégradé `#F1EFFF`/`#FAF9FF`.

⚠️ **Piège :** ne rien illustrer de ce qu'on refuse — pas de pièces, pas de badges, pas de coffres. **Un visuel circule sans son texte.** Typographie et rien d'autre.

**Visuel :** liste en encre violette `#4548FF` sur fond doux, titre marine.

> **Ce qu'il n'y a pas dans Mino**
> Pas de monnaie virtuelle.
> Pas de niveaux.
> Pas de boutique.
> Pas de mascotte à nourrir.
> Pas de mini-jeux.

**Légende :**
> Ce n'est pas un manque de première version. C'est un choix, et il est écrit noir sur blanc dans le projet depuis le début : **ce sont ces mécaniques que les parents fuient en installant Mino.**
>
> Le refus tient jusque dans l'unité affichée. Un mino vaut toujours une minute, et il ne s'achète jamais. Il n'existe aucun taux de change, aucun catalogue, rien à acheter.
>
> La récompense est du temps d'écran. Rien d'autre.

**Hashtags :** #parentalité #écrans #famille #enfants #éducation #tempsdécran

---

## POST 5 — « Ça ne marchera jamais avec mon ado »

**L'objection n°1 en commentaires (§ 10).** Le brief encourage explicitement ce carrousel : *« le même produit, deux âges »*.

**Format :** carrousel 4 vues.
⚠️ **Un seul registre d'âge par vue.** Jamais « minos » et « minutes » dans la même image, jamais une tranche qui enjambe 13 ans.

**Vue 1** (fond `#E8F3FF`) — **Moins de 13 ans**
> « Bravo Noah ! »
> minos · célébration · très grands boutons

**Vue 2** (fond `#F1EFFF`) — **13 ans et plus**
> « Ajouté à ton compteur. »
> minutes · pas de célébration · mise en page sobre

**Vue 3** — les deux consignes, toujours séparées :
> Sous 13 ans : « Quand c'est fait, appuie sur le bouton vert. »
> Dès 13 ans : « Marque-la terminée quand c'est fait. »

**Vue 4** — `parent-enfants.webp` (côté parent : des minutes à tout âge).

**Légende :**
> À treize ans, Mino change de vocabulaire et de mise en page. On parle de minutes et non de minos, les célébrations s'effacent, les missions proposées concernent l'autonomie, le travail et l'équilibre. L'âge se règle sur sa fiche.
>
> La raison est simple : un adolescent à qui l'on sert des confettis et une monnaie appelée « minos » ferme l'application et ne la rouvre pas.
>
> Ce qui ne change pas : la mascotte reste. Plus petite, plus calme — c'est la marque, pas un camarade de jeu.

**Hashtags :** #ado #adolescent #parentalité #tempsdécran #famille #autonomie

**Vérifié :** aucune tranche d'âge n'enjambe 13 · la mascotte n'est pas annoncée disparaissante (erreur fréquente, § 3.3) · réponse reprise de la FAQ.

---

## POST 6 — Quand l'abonnement s'arrête

**Un des meilleurs angles de confiance disponibles (§ 11, angle 8).** Rare : une marque qui explique ce qui se passe quand on cesse de la payer.

**Format :** post unique, typographie + Mino pose `motivated`, fond `#EAF7F1`/`#F8FCFA`.

**Visuel :** la phrase en grand, marine, centrée.
> « Un enfant n'a pas choisi le moyen de paiement de ses parents. »

**Légende :**
> Quand un abonnement s'arrête, c'est votre main qui s'arrête. Jamais l'enfant.
>
> Les minutes déjà gagnées ne bougent pas. L'enfant continue de déclarer ses missions, elles s'empilent en attente, et elles sont toutes là le jour où vous reprenez. Il ne voit jamais de pancarte d'abonnement : une mission qui se comptait toute seule redevient une mission ordinaire, « ton parent confirme » — une phrase qu'il connaît déjà.
>
> Le message que vous voyez, vous, à la fin de l'essai :
> « Votre essai est terminé. Reprenez l'abonnement pour confirmer les missions — celles déjà déclarées vous attendent, rien n'est perdu. »
>
> On dit ce qui s'arrête, on rassure sur ce qui ne s'arrête pas, on ne menace pas.

**Hashtags :** #parentalité #famille #confiance #abonnement #enfants #tempsdécran

---

## POST 7 — L'enfant qui n'a pas de téléphone

**Format :** carrousel 3 vues · `enfant-temps.webp` en vue 2.
⚠️ **Ne jamais utiliser `parent-appareils.webp`** : marques de consoles visibles. Dans `enfant-temps.webp`, les écrans s'appellent « Console du salon » et « Télé du salon » — c'est la bonne image.

**Vue 1 :** « Votre enfant n'a pas de téléphone ? »
**Vue 2 :** capture — les trois écrans au choix.
**Vue 3 :** **« Mino tient le compte, vous tenez la manette. »**

**Légende :**
> La console, la télé et l'ordinateur se déclarent dans « Appareils de la maison » et entrent dans le système de minutes comme le reste.
>
> L'enfant choisit l'écran et la durée, appuie sur « Demander à mon parent », et **c'est vous qui lancez le minuteur**. Le décompte démarre à ce moment-là, pas à la demande : une demande sans réponse ne coûte rien.
>
> Soyons précis sur ce que Mino ne fait pas. Sur une console, une télé ou un ordinateur, il **ne démarre ni n'arrête rien** — aucun de ces systèmes n'ouvre son temps de jeu à une application extérieure. Il tient le compte, et c'est déjà ce qui met fin à la discussion.
>
> Un enfant sans téléphone est donc pris en charge : vous déclarez ses écrans et vous confirmez ses demandes depuis le vôtre.

**Hashtags :** #famille #tempsdécran #parentalité #enfants #jeuxvidéo #organisationfamiliale

**Vérifié :** aucune marque tierce · aucune promesse d'action sur une console · le « VOUS lancez » est délibéré (§ 3.7).

---

## POST 8 — « Dans une vraie famille, tout n'est pas mérité »

**Format :** post unique ou Reel court · `parent-routine.webp` en fond flouté, ou typographie seule sur `#FFF4E8`/`#FFFBF6`.

**Visuel :** la citation en grand, marine.

**Légende :**
> C'est écrit dans le projet, presque mot pour mot : dans une vraie famille, tout n'est pas mérité — et une application qui l'ignorerait obligerait un parent à inventer une fausse mission « c'est mercredi ».
>
> D'où les **plages libres**. Vous déclarez un créneau ouvert — le mercredi après-midi, les vacances — et pendant ce temps-là votre enfant ne dépense rien. Aucun compte à rebours ne s'affiche. C'est du temps qui n'est pas compté, et qui n'a pas à l'être.
>
> Si la journée tourne autrement, vous pouvez arrêter la plage en cours depuis votre accueil. **L'arrêt ne vaut que pour aujourd'hui** : la plage revient d'elle-même la fois suivante. Et tant que l'heure n'est pas passée, « Reprendre » revient dessus — un geste d'une touche sans retour est un piège.

**Hashtags :** #parentalité #famille #mercredi #vacances #enfants #tempsdécran

**Vérifié :** l'arrêt d'une plage n'est pas décrit comme une punition (piège de l'angle 9) · nouveauté 1.1.0 correctement attribuée (§ 4.1).

---

## POST 9 — « Un enfant qui ne lit pas encore peut s'en servir »

**Format :** carrousel 3 vues · `enfant-accueil.webp` et `enfant-temps.webp`.

⚠️ **Piège de cet angle :** jamais « audité », jamais « zéro problème d'accessibilité » — l'audit automatique est cassé et ne visite plus qu'un écran sur onze.

**Vue 1 :** « Le temps est représenté trois fois. »
**Vue 2 :** capture — le chiffre, l'anneau, les capsules. Légende : « 1 capsule = 5 minos ».
**Vue 3 :** « Un enfant qui ne lit pas encore peut agir. »

**Légende :**
> Le même nombre, dit de trois façons : en chiffres, par un anneau qui se remplit, et en capsules — une capsule vaut cinq minutes.
>
> C'est ce qui permet à un enfant de cinq ans de savoir où il en est sans qu'on le lui lise.
>
> Deux autres règles tenues partout : les boutons de l'enfant font au minimum 64 points, et **aucun sens n'est porté par la seule couleur** — chaque état d'une mission a son icône et son mot. ⭐ À FAIRE, ⏳ EN ATTENTE, ✓ ACCOMPLIE.
>
> Les contrastes ont été mesurés, pas estimés.

**Hashtags :** #accessibilité #parentalité #enfants #design #famille #éducation

**Vérifié :** « mesurés, pas estimés » est la formule du dépôt · aucun chiffre d'audit cité (ils ne valent qu'à la date où l'audit fonctionnait) · aucun « audité ».

---

## POST 10 — Le prix, en entier

**Format :** post unique, typographie seule, fond `#F7FAFF`.
⚠️ **Aucune capture** : `parent-abonnement.webp` affiche les prix périmés.

**Visuel :**
> **9,99 € par mois**
> **ou 79,99 € par an, soit 6,67 € par mois**
> Essai de 30 jours.

⚠️ **« 6,67 € » ne paraît jamais seul.** Le montant réellement débité — 79,99 € par an — est sur la même ligne. Le raccourcir en ferait une publicité mensongère, et le code du produit emploie ce mot-là.

**Légende :**
> 9,99 € par mois, ou 79,99 € par an — soit 4 mois offerts, 33 % de moins. Toute la famille est comprise : autant d'enfants et d'appareils que vous voulez, sans supplément.
>
> Les conditions, en entier et sans petits caractères :
> • Essai de **30 jours**, pour tout le monde, sans exception.
> • Le moyen de paiement est **enregistré à l'inscription, sans être débité**.
> • L'abonnement **démarre au terme** si vous ne faites rien. La date du premier prélèvement est affichée avant que vous confirmiez, et reste consultable dans les réglages.
> • Prix **TTC**.
> • Sans engagement. La résiliation se fait dans les réglages de votre téléphone, en deux touches — nous vous y emmenons.
>
> Un seul abonnement pour toute la maison. Il n'y a pas de plafond d'enfants, et pas de supplément par appareil.

**Hashtags :** #famille #parentalité #abonnement #tempsdécran #enfants

**Vérifié :** les quatre conditions obligatoires accompagnent le prix (§ 6.3) · « 6,67 » et « 79,99 » sur la même ligne (§ 6.2) · « deux touches » précise **où** (§ 6.8) · aucune promesse d'e-mail d'avertissement · aucun « sans carte bancaire ».

⚠️ **À vérifier avant de publier ce post-là (§ 13.6) :** l'offre d'introduction « Gratuit · 1 mois » est-elle bien configurée dans App Store Connect **et** dans Play Console, sur les deux formules ? Sans elle, la boutique prélève le plein tarif sous une promesse de gratuité — c'est déjà arrivé sur Google Play, et c'est le motif qui a fait refuser la 1.0.

---

# DEUX POSTS EN RÉSERVE

## POST 11 — Deux parents, deux téléphones, un seul compte

**Nouveauté 1.1.0.** Format : carrousel 3 vues · `rejoindre.webp`, `parent-enfants.webp`.
⚠️ Ne jamais présenter ça comme un « second compte ». **C'est un profil.**

**Légende :**
> L'autre parent installe Mino, saisit le code famille, choisit « C'est le téléphone d'un parent » et se sélectionne dans la liste.
>
> **Pas d'adresse à donner, pas de mot de passe de plus à retenir.** Le second parent rejoint avec le code famille, comme le reste de la maison — un profil, pas un compte. Il crée des missions, pose une plage libre, offre une minute, confirme.
>
> Ce qu'il ne peut pas faire : changer l'adresse du compte, résilier l'abonnement, supprimer la famille. Et ce n'est pas une politesse d'interface — c'est le serveur qui le tient.
>
> S'il change de téléphone, le même geste reprend son profil et révoque l'ancien appareil. C'est fait pour le téléphone perdu.

⚠️ **Attention aux trois codes** (§ 4.8) : ici c'est le **code famille** (`MINO-XXXXXX`), pas le code parent à 4 chiffres, pas le code de parrainage. Un post qui dit « partagez votre code Mino » sans préciser lequel crée un appel au support.

---

## POST 12 — « Mon enfant va mentir »

**L'objection n°2 en commentaires.** Format : post unique, typographie · `enfant-attente.webp` en second.

**Légende :**
> C'est la question qui revient le plus, et la réponse tient en une phrase : **vous n'approuvez pas la mission, vous confirmez qu'elle est faite.**
>
> La confiance se donne mission par mission, et se retire de la même façon. Le système est conçu pour que la vérification reste humaine.
>
> Un conseil qui va contre votre intérêt immédiat, et qu'on donne quand même : **ne renvoyez pas « à refaire » une mission réellement accomplie pour freiner le compteur.** C'est la façon la plus rapide de casser la confiance dans le système, et cette confiance-là ne revient pas.
>
> Et si vous vous demandez ce qui se passe s'il bidouille l'application : un appareil enfant peut déclarer une mission et dépenser son temps. Il ne peut **ni confirmer une mission, ni ajouter des minutes** — et ce n'est pas l'interface qui l'arrête, c'est la base de données elle-même. Une règle qui n'existe que dans l'écran n'est pas une règle.

**Vérifié :** aucun jargon technique · aucun storytelling sur les failles corrigées (§ 7.5) · le dosage est celui du dépôt · la formule du § 1.6 est reprise sans le verbe « empêche », qui figure sur la liste rouge même employé à bon escient.

---

# 📋 LES À-CÔTÉS

## Bio Instagram (150 caractères)

> Le temps d'écran se gagne, il ne se négocie plus.
> Missions du quotidien → minutes d'écran. 5-17 ans.
> Édité par Agence Wheb

**Lien de bio :** `minoapp.fr/telecharger` — **et jamais un lien de boutique direct.** L'appareil qu'on ouvre est souvent celui de l'enfant, et il peut être Android ; la page aiguille toute seule.
⚠️ À n'activer qu'une fois la mention « Android : la version arrive » corrigée.

## Bio TikTok (80 caractères)

> Le temps d'écran se gagne. Missions → minutes. 5-17 ans. Agence Wheb

## Ordre de publication suggéré

| Semaine | Lun | Mer | Ven |
|---|---|---|---|
| 1 | **1** — Le renversement | **2** — La boucle filmée | **4** — Ce que Mino refuse d'être |
| 2 | **5** — « Ça ne marchera jamais avec mon ado » | **7** — L'enfant sans téléphone | **3** — Le mot qu'on a refusé |
| 3 | **6** — Quand l'abonnement s'arrête | **9** — Un enfant qui ne lit pas encore | **8** — Tout n'est pas mérité |
| 4 | **12** — « Il va mentir » | **11** — Deux parents | **10** — Le prix, en entier |

**Le prix en dernier.** C'est l'ordre qui fonctionne sur ce public : le problème d'abord, la mécanique ensuite, la preuve après, **le prix à la fin** (§ 3.7).

**Le parrainage ne figure dans aucun post.** Le dépôt limite son apparition à trois moments, et « le mettre partout devient du bruit, puis de l'agacement » (§ 6.7). À garder pour plus tard, en story.

## Répondre aux commentaires

**Consigne de fond : répondre à TOUS les commentaires négatifs, sans défensive.** La réponse est lue par les futurs installeurs bien plus que par son destinataire. Le § 10 du brief porte les réponses prêtes, à reprendre telles quelles.

**Trois réflexes qui ne se négocient pas :**
1. **Les appels d'urgence : ne jamais ouvrir le sujet.** Si on est interrogé, la formulation exacte du § 7.3, **seconde moitié comprise — elle ne se coupe jamais.** C'est le seul point dont l'inexactitude peut coûter un dommage corporel.
2. **« Ça marche sur Android ? »** → répondre par la mécanique (missions → minutes), jamais par une promesse. Le comportement n'est pas le même des deux côtés, et le dépôt le dit lui-même au marketing.
3. **« Vos données sont où ? »** → la formulation nuancée du § 8.8, jamais « vos données restent en Europe ».

---

# 🔒 CE QUI N'EST DANS AUCUN DE CES POSTS — ET POURQUOI

| Absent | Raison |
|---|---|
| **Tout verbe de blocage** (« bloque », « verrouille », « empêche », « coupe ») | Apple 2.3.1 — motif de **retrait**, qui frappe après publication, quand des familles utilisent déjà le produit. Levé seulement quand le module natif est dans le binaire soumis **et** que l'habilitation Family Controls de distribution est obtenue (§ 13.4). Les dix posts vendent **la boucle**, pas le blocage. |
| **Tout appel au téléchargement, lien de boutique, date** | § 9.3, non tranché par écrit. Le lien vit dans la bio, pas dans les légendes. |
| **Les appels d'urgence, les messages, le 119** | Jamais spontanément, jamais dans un visuel. |
| **Le compagnon (« Mino qui parle »)** | Angle à manier avec des pincettes. Utilisable plus tard, mais il exige cinq mentions obligatoires dans le même post (conversations 30 jours, message transmis à un prestataire, activé par défaut, désactivable enfant par enfant, ce n'est pas une messagerie) — ça ne tient pas dans une légende de lancement. |
| **Tout chiffre de tests, de couverture, ou interne** | Le dépôt se contredit sur les premiers ; les seconds donneraient la stratégie d'acquisition. |
| **Toute comparaison nommant un concurrent** | Aucune règle n'existe dans le dépôt sur ce point (§ 13.7). Prudence jusqu'à votre arbitrage. |
| **Toute promesse de résultat** (« moins de disputes », « il fera ses devoirs ») | Mino ne promet nulle part un résultat éducatif, et ses propres CGV disent qu'il ne se substitue ni à l'autorité parentale, ni à un accompagnement éducatif. |

---

**La dernière question, avant chaque publication :**
> Cette phrase serait-elle encore vraie si un examinateur d'Apple ouvrait l'application aujourd'hui, et si un parent la citait dans un an ?
