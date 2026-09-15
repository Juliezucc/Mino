# BRIEF RÉSEAUX SOCIAUX — MINO

**Destinataire : un Claude qui va écrire des publications publiques pour Mino.**
**Matière arrêtée au 15 septembre 2026. Tout chiffre, tout libellé et tout état ci-dessous vaut à cette date.**
**Ce document se suffit : le lecteur n'a pas accès au dépôt. Ce qui n'y figure pas ne s'écrit pas.**

---

## 0. COMMENT SE SERVIR DE CE BRIEF

### 0.1 La règle qui prime sur toutes les autres

Tu écris de la **publicité**. Une phrase fausse ici n'est pas une coquille : c'est une promesse publique, opposable en droit français, et un motif de refus ou de retrait chez Apple comme chez Google. Apple ne compare pas une fiche à ce qu'on aimerait dire — elle la compare au binaire et à la politique de confidentialité. Google compare la fiche Play à la fiche App Store.

**Le dépôt Mino a déjà produit trois sur-affirmations, toutes corrigées après coup :**

1. **« les appels d'urgence ne sont jamais bloqués »** — affirmé depuis une connaissance générale des plateformes, pas depuis le code de Mino. Mino ne peut pas s'en porter garant.
2. **une déclaration de confidentialité annonçant une collecte qui n'existait pas.**
3. **une FAQ promettant « deux mois offerts »** quand le code en donnait quatre.

Les trois ont la même mécanique : **une phrase commerciale a survécu à la décision qui la rendait fausse.** Aucune des trois n'a été inventée — elles ont été **recopiées**. Deux venaient d'un document interne périmé, une d'une connaissance générale des plateformes. Aucune n'avait été relue contre le code.

### 0.2 Les cinq réflexes

1. **Une phrase qui n'est pas dans ce brief ne se publie pas.** Pas de reformulation « plus vendeuse » d'une phrase validée : c'est exactement ainsi que les trois erreurs sont nées.
2. **Un chiffre ne s'écrit jamais de mémoire.** Les valeurs qui font foi sont au § 6.
3. **Le message parle au parent, jamais à l'enfant.** Règle de produit, pas seulement de ciblage.
4. **Entre deux formulations, prendre la plus étroite.** Décrire moins que le contrat est un défaut ; décrire plus est une faute.
5. **Ne complète jamais depuis ta connaissance générale** des plateformes, du droit ou du marché. C'est par là que la première des trois sur-affirmations est entrée.

### 0.3 Hiérarchie des sources

| Rang | Source | Statut |
|---|---|---|
| 1 | **Le code** (`src/domain/`, `src/theme/`, `app.json`, les modules natifs) | Fait foi. Toujours. |
| 2 | **Les documents contractuels livrés** (`src/content/terms.ts`, `src/content/privacy.ts`) | Font foi, sous la réserve du § 8.5 (non relus par un avocat) |
| 3 | **La FAQ et le guide livrés** (`src/content/faq.ts`, `src/content/guide.ts`) | **Contiennent six sur-affirmations non corrigées** — voir § 7.6 |
| 4 | **Tout le dossier `docs/`** (`marketing/`, `ops/`) | **Notes de travail, pas des sources.** Au moins six formules commerciales périmées y sont encore en place |

**Règle de survie, écrite dans le dépôt :** *« aso.md, parrainage.md, acquisition.md et parcours-inscription.md sont des notes de travail, pas des sources. »*

**Corollaire, également écrit dans le dépôt :** la description, les captures, les questionnaires des boutiques, la politique de confidentialité **et les réseaux sociaux** doivent dire la même chose. *« Apple ne les compare pas à ce qu'on aimerait dire, elle les compare au binaire et à la politique de confidentialité. »* Une divergence entre deux textes du même paquet est ce qu'un examinateur repère le plus vite — **et c'est la faute que ce dépôt a commise trois fois.**

---

## 1. MINO EN UNE PHRASE, LA BOUCLE, LA PROMESSE

### 1.1 La définition canonique

> **Un parent crée des MISSIONS quotidiennes. L'enfant appuie sur J'AI TERMINÉ. Le parent confirme. Les minutes d'écran arrivent tout de suite.**

C'est la définition qui gouverne tout le dépôt. Toute autre formulation doit s'y ramener.

### 1.2 La boucle exacte, avec l'exemple du dépôt

Julie crée « Ranger ta chambre +15 min » pour Noah → Noah voit la mission → Noah appuie sur **« J'ai terminé »** (la mission passe **EN ATTENTE**) → Julie voit la demande sur son accueil, section **« En attente de vous »** → Julie appuie sur **« C'est fait · +15 min »** → une transaction de +15 est écrite → Noah voit une célébration avec la mascotte → son compteur passe de **35 à 50 minutes**.

Les prénoms Julie/Noah et les chiffres 35 → 50 sont ceux du dépôt : **ils peuvent servir tels quels en démonstration.** C'est le « parcours prioritaire » du produit, couvert par un test de bout en bout.

⚠️ **Le libellé du bouton est « C'est fait · +15 min ».** « VALIDER +15 MIN » est le libellé du README (ligne 21), pas celui de l'application. **Règle générale : tout bouton cité dans une publication se copie depuis le code, jamais depuis la FAQ ni le README.**

**Le moment à filmer, c'est le compteur qui grimpe visiblement de 35 à 50.**

### 1.3 La promesse

- **Slogan officiel, à ne pas reformuler : « Grandir, une mission à la fois. »**
  Il est déjà partout et cohérent partout : baseline du logo dans l'application, description de la fiche, pied de tous les e-mails transactionnels, description du produit Stripe, et jusque sur l'écran de blocage Android que l'enfant voit quand une application est verrouillée.
- **Description officielle d'une phrase, déjà déposée dans le manifeste de l'application :**
  > « Grandir, une mission à la fois. Les enfants gagnent leur temps d'écran en accomplissant de petites responsabilités du quotidien. »
- **La promesse du point de vue de l'enfant** — seule formulation « slogan-compatible » du dépôt :
  > « Je fais mes missions → je gagne du temps → je profite de mes écrans. »
- **Nom sur les boutiques, à employer exactement : « Mino : une mission à la fois »** (28 caractères sur 30, réservé le 31/08/2026 — « Mino » seul était déjà pris sur l'App Store).
- **Sous-titre App Store : « Contrôle parental et écrans. »** Le positionnement officiel est donc : *on se référence sur « contrôle parental », et on convainc sur le reste.*

### 1.4 Le public

**Familles avec des enfants de 5 à 17 ans.**

- Le code accepte en réalité 4 à 17 ans (`MIN_AGE = 4`, `MAX_AGE = 17`).
- **« 5 à 17 » est la formulation publique retenue**, cohérente avec le dossier Apple. Ne jamais écrire « dès 4 ans », ni **« 5-12 »** (erreur corrigée le 07/09/2026).
- L'écart d'un an à la borne basse n'est pas tranché : s'en tenir à 5-17.

**Le message parle au parent, toujours.** Mino est acheté, installé et réglé par un parent : *« son utilisateur est l'adulte, et l'enfant n'a même pas de compte. »* Catégories déclarées : Éducation (principale), Utilitaires (secondaire), classification **4+**, **catégorie « Enfants » délibérément REFUSÉE**. Sur Play, public cible déclaré : **les adultes, 18 ans et plus**.

**Nuance Google, utile pour les créations :** à la question « l'application attire-t-elle malgré tout les enfants (mascotte, couleurs vives, avatars) ? », la réponse déclarée est **oui, franchement**, et décrite. Conséquence : **les visuels peuvent être colorés et porter la mascotte, à condition que le message reste adressé au parent.**

### 1.5 Le renversement — ce qui distingue Mino d'un contrôle parental

**Différence n°1 — il n'y a pas de quota quotidien décidé à l'avance par l'adulte.** Le temps disponible est exactement celui que l'enfant a gagné. *Un contrôle parental retire du temps ; Mino en fait gagner.*

**Différence n°2 — quand l'abonnement s'arrête, c'est la main du PARENT qui s'arrête, jamais l'enfant.** Les minutes déjà gagnées ne bougent pas, l'enfant continue de déclarer ses missions, elles s'empilent en attente et sont toutes là le jour où le parent reprend. La justification est une phrase de campagne :
> « Un enfant n'a pas choisi le moyen de paiement de ses parents. »

Et l'enfant ne voit **jamais** de pancarte d'abonnement : une mission qui se comptait toute seule redevient une mission ordinaire, « ton parent confirme » — une phrase qu'il connaît déjà.

**Message exact affiché au parent en fin d'essai**, modèle de ton :
> « Votre essai est terminé. Reprenez l'abonnement pour confirmer les missions — celles déjà déclarées vous attendent, rien n'est perdu. »

*La règle d'écriture Mino en une ligne : on dit ce qui s'arrête, on rassure sur ce qui ne s'arrête pas, on ne menace pas.*

**Différence n°3 — le verrou d'abonnement ne se ferme que sur un fait connu.** Si la facturation n'a pas répondu, tout passe.
> « Quelques jours offerts par erreur coûtent moins qu'un parent qui paie et se retrouve dehors parce que son train est passé sous un tunnel. »

Un prélèvement échoué ne verrouille pas non plus : *« un prélèvement qui échoue est presque toujours une carte expirée, pas une famille qui part. »*

### 1.6 Les quatre piliers techniques — matière publicitaire de premier ordre

**Pilier 1 — Le solde n'est jamais un compteur modifiable.** C'est la somme d'un journal en ajout seul. Une erreur se corrige en ajoutant une ligne opposée, jamais en effaçant. La raison, citable telle quelle :
> « un compteur modifiable et un historique finissent toujours par se contredire, et le jour où cela arrive, c'est devant un enfant qui a perdu des minutes qu'il avait gagnées. **C'est la seule dispute que le produit ne peut pas se permettre.** »

**Pilier 2 — Confirmer une mission écrit l'approbation ET la transaction dans la même opération.** Il n'existe aucun chemin qui crédite des minutes sans laisser de trace : l'historique et le solde ne peuvent donc pas diverger. C'est ce qui permet de dire *« les minutes gagnées sont acquises »* sans mentir.

**Pilier 3 — La sécurité est dans la base de données, pas dans l'application.** Un appareil enfant peut dire « j'ai terminé » et dépenser du temps ; il ne peut ni confirmer une mission, ni ajouter des minutes — **et ce n'est pas l'interface qui l'en empêche.** C'est la réponse au parent qui demande « et s'il bidouille ? ».

**Pilier 4 — Les enfants d'une famille ne sont jamais visibles par une autre famille.** Ce n'est pas seulement que l'application ne les affiche pas : la base de données refuse de renvoyer les lignes. *« Une règle qui n'existe que dans le client n'est pas une règle. »*

**Le code parent à 4 chiffres n'est lisible nulle part.** Son empreinte vit dans une table dont la lecture est refusée même au parent ; la vérification est faite par le serveur, avec limitation des tentatives. La tablette de l'enfant ne peut donc pas le lire, **même en cherchant**.

⚠️ **Jamais de jargon en public** : ManagedSettings, Family Controls, DeviceActivity, RLS, jetons opaques, « autorisation révoquée », « timer-only ». *Dire ce qui se passe et ce qu'il y a à faire.*

---

## 2. CE QUE MINO N'EST PAS — LES REFUS, AVEC LEURS RAISONS

C'est la section qui protège la marque, et la plus riche en matière à contenu. Chaque refus est écrit dans le dépôt, avec sa raison.

### 2.1 Pas une application de récompenses

> « Pas de monnaie virtuelle, pas de niveaux, pas de boutique, pas de mascotte à nourrir, pas de mini-jeux, pas de RPG. »

**La raison, en toutes lettres : ce sont ces mécaniques que les parents fuient en installant Mino.** Ce n'est pas un manque de version 1, c'est un choix — le README en fait une section intitulée *« Ce qui n'est volontairement pas dans le MVP »*.

**Le refus est tenu jusque dans l'unité affichée :** un mino vaut toujours une minute, **et il ne s'achète jamais**. Il n'existe **aucun** taux de change, **aucun** catalogue, **rien** à acheter. C'est la preuve concrète, et non l'intention.

Formule publiable, déjà écrite : *« Une minute de temps d'écran, gagnée par une mission. Un mino vaut toujours une minute, et il ne s'achète jamais — c'est le seul mot que voient les enfants jusqu'à treize ans. »*

### 2.2 Pas un outil de surveillance

Formules de dégagement **déjà dans les documents contractuels**, à reprendre telles quelles dès qu'on touche à la sécurité :

> « Mino ne surveille pas les enfants et n'est pas un mode de garde : l'enfant reste à tout moment sous la responsabilité et la surveillance de l'adulte titulaire de l'autorité parentale. »

> « Mino est un outil d'organisation familiale. Il ne se substitue ni à votre autorité parentale, ni à un dispositif de contrôle parental système, ni à un accompagnement éducatif ou médical. Vous restez seul décisionnaire du temps d'écran accordé à votre enfant. »

> « L'application ne demande jamais la position et ne pourrait pas l'obtenir. **Ce n'est pas un outil de surveillance.** »

### 2.3 Pas une promesse de discipline

Un chapitre du guide s'appelait « Faire respecter le temps gagné » ; il a été renommé « Le temps d'écran sur son téléphone » parce que le titre *« promettait une contrainte que Mino n'exerce pas lui-même »*. **C'est LA formule de partage des rôles à utiliser** : elle est exacte et elle sonne bien.

### 2.4 Pas une messagerie, pas un ami virtuel

Le compagnon (« Mino qui parle ») n'est **pas** un chat, **pas** une messagerie, **pas** un ami virtuel. Aucun autre humain ne peut écrire à un enfant : il n'y a ni contact, ni destinataire, ni fil de discussion. Apple veut une réponse « non » sans ambiguïté à la question messagerie. Il **ne confirme jamais une mission et ne donne aucune minute**, personne ne lit les conversations en direct, et le **règlement européen sur l'IA impose de dire à l'enfant qu'il parle à une machine**.

### 2.5 Pas une application de rétention

> « Une conversation réussie avec toi est une conversation courte qui finit loin de l'écran. »
> « Ne t'en sers pas pour faire la morale, ni pour rappeler ce qui n'a pas été fait. »

Anti-argument frontal contre l'économie de l'attention — **le meilleur angle de différenciation du produit.** Les animations sont courtes et gratifiantes, jamais permanentes ; **rien ne tourne en boucle indéfiniment.**

### 2.6 Ce qui n'existe pas non plus, et qu'un parent pourrait croire

Aucune **preuve par photo** d'une mission faite · aucun **rapport d'usage détaillé** (Mino ne sait pas quelles applications l'enfant utilise) · aucun **blocage de site web** · aucun **filtrage de contenu** · aucune **limite quotidienne à estimer à l'avance** · aucune **synthèse vocale** (Mino ne parle pas à voix haute) · aucun **mode sombre** · aucune **démo sans inscription** (le bouton « Découvrir avec la démo » a été **retiré** de l'accueil ; le README le décrit encore, il est en retard) · aucun **traceur d'événements** (ni Firebase, ni Amplitude, ni aucun autre — vérifié dans les dépendances) · aucune **mesure d'attribution** (pas de pixel, pas de SDK).

C'est à la fois le différenciateur face aux contrôles parentaux classiques **et** ce qu'il ne faut pas laisser espérer.

### 2.7 Les sept choses que le ton Mino évite systématiquement

1. **La culpabilisation du parent.** *« Aucune relance culpabilisante du type "Noah n'a rien fait cette semaine". »* Règle jumelle : *« Rien à l'enfant. Jamais, sous aucune forme. »*
2. **Parler à l'enfant.** *« On ne fait pas de publicité à des enfants, ni juridiquement ni moralement. »* L'audience est l'adulte qui paie.
3. **La peur.** Un écran d'erreur qui laissait croire à un parent que sa famille avait disparu a été qualifié de *« mensonge qui fait peur »* et remplacé par un écran dont *« le ton compte autant que le bouton »*. Modèle pour toute communication d'incident.
4. **La promesse de discipline** (§ 2.3).
5. **Le jugement porté sur l'enfant.** Aucun écran ne lui montre un échec, aucune pénalité n'existe, et l'application ne fait jamais la leçon à la place du parent.
6. **Faire peser la sanction commerciale sur l'enfant** (§ 1.5).
7. **Féliciter à vide.** « Tout est fait » ne s'affiche que s'il y avait quelque chose à faire ; un jour sans mission dit « Rien de prévu aujourd'hui ». *Ne pas dépenser une formule de félicitation là où elle n'est pas méritée.*

### 2.8 La charte de voix la plus opérationnelle du dépôt

Écrite pour le compagnon, valable pour les réseaux : **deux ou trois phrases, jamais plus. « Chaleureux, curieux, un peu drôle. Jamais mièvre, jamais professoral. »** Un ou deux emojis. Tutoiement de l'enfant. *« Avec un adolescent : même chaleur, mais pas de voix de maternelle. »*

---

## 3. LES MOTS

### 3.1 Le lexique figé, à employer sans variante

`missions` · `minos` (moins de 13 ans) · `minutes` (13 ans et plus) · `capsules` (1 capsule = 5 minutes) · `espace parent` · `code parent` (4 chiffres) · `code famille` (6 caractères, ex. MINO-6BVJK4) · `code de parrainage` · `plages libres` · `Appareils de la maison` · `Blocage des applications` · `bonus` · `routines`

**Un seul nom par fonctionnalité.** Elle s'appelle le **blocage** (l'écran s'appelle « Blocage des applications »). *« Encadrement »* et *« verrouillage »* sont **interdits** dans les documents, et un test automatique le vérifie. Mais **nommer n'est pas promettre** : voir § 5.4.

**Les plages libres se décrivent en mots de famille** — « Tous les jours », « Le week-end », « En semaine » — jamais en initiales de jours.

### 3.2 Les mots interdits, et pourquoi

| Interdit | Mot juste | Raison écrite dans le dépôt |
|---|---|---|
| **corvées** | missions | « Corvée » annonce une punition déguisée |
| **quêtes** | missions | « Quête » range la maison au rayon des jeux de rôle « et promet une aventure là où il n'y a qu'une table à mettre » |
| **valider / approuver / autoriser** une mission | **confirmer** | « le mot juge la mission — on ne "valide" pas une chambre rangée — alors que ce qu'un parent confirme, c'est que son enfant l'a bien faite » |
| **VALIDÉE** (pastille) | **ACCOMPLIE** | « Valider » a été retiré de toute l'application, de la FAQ et des fiches |
| **« Mission accomplie »** sur un bouton | **« C'est fait »** | un participe passé désigne ici un *état atteint* ; il se lirait comme une étiquette de statut, pas comme une décision |
| **Refuser** (mission) | **À refaire** | « À refaire » décrit ce qui se passe sans reproche — c'est aussi le titre exact de la notification enfant : « Mission à refaire » |
| **Refuser** (demande d'écran) | **Pas maintenant** | le mot ne doit jamais porter sur l'enfant |
| **encadrement, verrouillage** | blocage | un mot par chose, et c'est le mot de l'écran |
| **points, pièces, jetons, monnaie, crédits** | minos / minutes | un mino n'est pas une monnaie |

**La version longue, meilleure pour un post :** ce sont des MISSIONS, *« un mot qui dit qu'on compte sur vous »*. **Huit mots qui expliquent le produit entier.**

Deux formules prêtes : *« Elle est à refaire, pas ratée. »* · *« Vous n'approuvez pas la mission : vous confirmez qu'elle est faite. »*

**Exception unique :** une réponse d'aide doit nommer les boutons **tels qu'ils s'appellent à l'écran**, même quand le mot est moins bon. *« C'est le seul endroit du produit où le vocabulaire doit céder à l'exactitude. »* (Le verbe « refusé » reste juste pour un paiement ou un code famille.)

### 3.3 Les deux registres d'âge — seuil unique à 13 ans

`TEEN_FROM = 13`. **Le parent, lui, voit toujours des minutes, à tout âge.**

| | Moins de 13 ans | 13 ans et plus |
|---|---|---|
| Unité affichée à l'enfant | **minos** | **minutes** |
| Célébration | confettis, célébration | **pas de confettis** |
| Boutons | très grands (64 pt) | taille ordinaire |
| Mise en page | aérée | dense |
| Ton | chaleureux, ludique | sobre |
| Missions proposées | quotidien, autonomie de base | autonomie, travail, équilibre |
| Mascotte | **présente et animée** | **présente**, plus petite, sans animation d'attente |

**La raison, écrite dans le code :** *« un adolescent à qui l'on sert des confettis et une monnaie appelée "minos" ferme l'application et ne la rouvre pas. »* À 13 ans, *« un mot inventé passe pour de l'infantilisation »*. Le défaut a réellement existé et été corrigé : *« Un adolescent de quatorze ans avait les boutons des cinq ans »* — douze écrans écrivaient la taille enfant en dur.

⚠️ **NUANCE À NE PAS RATER : la mascotte ne disparaît PAS chez l'adolescent.** Elle reste, en plus petit et sans animation au repos — *« c'est la marque, pas un camarade de jeu »*. Ce qui disparaît, ce sont les confettis, le mot « minos » et les très grands boutons. (Une note interne du dépôt laisse croire l'inverse ; **c'est le code qui fait foi.**)

**Conséquence dure pour les créations :** aucune image, aucun carrousel, aucune liste de suggestions, aucune tranche d'âge affichée ne doit **enjamber 13 ans**. Une visuelle « ado » avec des minos, ou une tranche « 8-14 ans », décrit un produit qui n'existe pas.

**Paires enfant/ado réelles, à réutiliser telles quelles** (excellent matériau pour un carrousel « le même produit, deux âges ») :

| Situation | Moins de 13 ans | 13 ans et plus |
|---|---|---|
| En attente | « Bien joué ! » | « C'est noté » |
| Célébration | « Bravo {prénom} ! » | « Ajouté à ton compteur, {prénom}. » |
| Consigne | « Quand c'est fait, appuie sur le bouton vert. » | « Marque-la terminée quand c'est fait. » |

**Réponse prête à l'objection « ça ne marchera jamais avec mon ado »** — la plus fréquente en commentaires — mot pour mot depuis la FAQ :
> « À partir de treize ans, Mino change de vocabulaire et de mise en page : on parle de minutes et non de minos, les célébrations s'effacent, les missions proposées concernent l'autonomie, le travail et l'équilibre. L'âge se règle sur sa fiche. »

### 3.4 Vouvoiement et tutoiement

- **Le parent est vouvoyé. L'enfant est tutoyé.** Partout, y compris dans les messages d'erreur, les CTA et les légendes des captures.
- Une accroche qui tutoie le parent, ou qui vouvoie l'enfant, **sort du produit**.
- **Une seule exception connue :** le message de partage du parrainage, qui tutoie — **parce qu'il est écrit *par* le parent et adressé à un ami**, pas au parent.
- Quand l'application ne sait pas encore qui tient l'appareil, elle choisit le registre d'après l'appareil : sur le téléphone d'un parent on vouvoie, partout ailleurs on s'adresse à l'enfant. *« Sous treize ans on ne dit ni "vous" ni "minutes". »*
- **Tous les messages d'erreur sont en français**, y compris ceux qui viennent d'Apple ou de Google. Un message de boutique en anglais qui atteint l'écran d'un parent est considéré comme un défaut.

### 3.5 Le genre — règle de collecte, pas de style

Mino ne connaît des enfants qu'un prénom et un âge : **il ne connaît donc pas leur genre et ne le demande jamais.** *« C'est une règle de collecte, pas une préférence de style. »* **C'est l'angle** : la neutralité découle de la minimisation des données, elle n'est pas un choix éditorial ajouté.

**Méthode :** aucune parenthèse « (e) », aucun « il/elle ». On tourne la phrase autrement — *« ce qui les raccourcit presque toujours »*. 52 textes ont été réécrits d'un coup.

**Trois procédés récurrents, avec les exemples réels du dépôt :**

| Avant | Après | Procédé |
|---|---|---|
| « Il s'en sert quand il veut » | « **Sans me demander** » | reformuler |
| « Il me demande d'abord » | « **En me demandant d'abord** » | participe |
| « Il appuie sur J'ai terminé » | « **L'enfant appuie sur J'ai terminé** » | nommer « l'enfant » |
| « Il voit sa récompense arriver » | « **La récompense arrive tout de suite** » | déplacer le sujet sur la chose |
| « Quand il aura terminé » | « **Une fois la mission terminée** » | infinitif / participe |
| « S'il en gagne trop » | « **Si le compteur monte trop vite** » | déplacer le sujet sur la chose |

**La consigne la plus explicite du dépôt** (donnée au compagnon, transposable à toute légende où un enfant est l'interlocuteur) : ni « il » ni « elle », et **aucun adjectif ni participe accordé** — pas « tu es content », pas « tu es sûr », pas « tu as l'air fatigué », jamais « prêt(e) ». On tourne autrement : « ça a l'air d'aller ? », « tu confirmes ? », « on y va ? ».

**Nuance à connaître :** la règle porte sur **l'enfant**. Le parent reste désigné au masculin générique par endroits (« Tes minos arrivent dès qu'il confirme »). **Ne pas en faire une promesse :** Mino n'écrit nulle part « sans supposer le genre de personne ».

### 3.6 Le nombre d'enfants

Même exigence : **ne jamais supposer plusieurs enfants.** « Sur son appareil à lui » → « Sur l'appareil de l'enfant » ; « C'est tout ce que Mino sait d'eux » → « C'est tout ce que Mino en sait » ; « les missions que vos enfants déclarent » → « les missions déjà déclarées ». **Beaucoup de familles n'ont qu'un enfant.**

### 3.7 Formulations déjà arbitrées — à réutiliser plutôt qu'à réinventer

**Les huit légendes des captures, déjà passées au filtre de conformité** (aucune n'emploie « bloque », « verrouille » ni « coupe ») — **le jeu d'accroches le plus sûr disponible, directement transposable en carrousel :**

1. « Le temps d'écran se gagne »
2. « C'est fait, et c'est lui qui le dit »
3. « Rien ne s'ajoute sans vous »
4. « Il s'en sert quand il veut »
5. « Vous décidez, mission par mission »
6. « Le temps gagné, sur l'écran de son choix »
7. « Plus de minutes, et Mino est là »
8. « Aucune publicité, aucune donnée revendue »

Sous-légendes réelles, également réutilisables : sous la 1 — « Noah a 35 minos, et une mission qui l'attend : ranger sa chambre, +15. » · sous la 3 — « Vous confirmez d'une touche, et les minutes arrivent sur son compteur. » · sous la 6 — « Console, télé, ordinateur : il demande, **vous** lancez le minuteur, le décompte est le même. » (le « **VOUS** lancez » est délibéré, voir § 4.6).

⚠️ **La légende « Un vrai blocage, pas un compteur » figure encore dans un document marketing mais ne fait PAS partie du jeu produit, et elle est explicitement INTERDITE aujourd'hui** (§ 5.4).

**Texte promotionnel App Store** (170 caractères, modifiable sans nouvelle version — le champ le plus proche d'une accroche sociale, déjà arbitré) :
> « Fini la négociation du soir. Votre enfant fait ses missions, gagne des minutes, et profite de ses écrans. Vous confirmez, c'est tout. »

**Description courte Play Store** (80 caractères) — dit la mécanique entière **sans promettre le blocage** :
> « Votre enfant gagne son temps d'écran en faisant ses missions du quotidien. »

**Autres accroches validées :** « Le temps d'écran se gagne, il ne se négocie plus. » · « Fini la négociation du soir. »

**Mots-clés App Store validés** (utiles pour hashtags et champ lexical) : `temps, ecran, enfant, famille, taches, routine, recompense, limiter, bloquer, ado, devoirs`. *« controle » et « parental » en sont sortis : Apple interdit de répéter dans les mots-clés ce qui figure déjà dans le nom ou le sous-titre.*

**Structure de la description longue, l'ordre qui fonctionne sur ce public :** le problème d'abord, la mécanique ensuite, la preuve après, **le prix à la fin**.

**Confiance et rôle du parent — les trois meilleures phrases du guide** (elles répondent à « mon enfant va mentir ») :
- « Vous n'approuvez pas la mission : vous confirmez qu'elle est faite. »
- « La confiance se donne mission par mission, et se retire de la même façon. »
- « Le système est conçu pour que la vérification reste humaine. »

**Dosage** — désamorce « je vais offrir trop d'écran » :
> « Le repère qui marche : une journée de missions faites doit donner à peu près le temps d'écran que vous acceptiez déjà. »
Barème exact : **5 minos** (geste rapide) / **10-15** (vraie tâche) / **20** (effort long).

**Non-punition — rare et très fort en post** (un conseil qui va contre l'intérêt court terme du parent) :
> « Ne renvoyez pas "à refaire" une mission réellement accomplie pour freiner le compteur : c'est la façon la plus rapide de casser la confiance dans le système, et cette confiance-là ne revient pas. »

**Écrans non pilotables :** « **Mino tient le compte, vous tenez la manette.** »

**Côté enfant (tutoiement — pour une capture, jamais pour une accroche adressée au public) :**
- « Quand c'est fait, appuie sur le bouton vert. Ton parent recevra la demande. »
- « Ton parent confirme · tes minos arrivent après »
- « Tes missions reprennent lundi 🌙 »
- « Plus de minos pour aujourd'hui 🥲 Mais moi je reste ! » — *« C'est le seul endroit de l'application où l'on n'est pas renvoyé à ce qu'il faut faire pour mériter quelque chose. »*

---

## 4. LES FONCTIONNALITÉS RÉELLEMENT LIVRÉES

### 4.1 Version et plateformes

Version livrée **1.1.0**, même identifiant sur les deux plateformes : **`fr.minoapp.mino`**. **iOS 16.4 minimum, Android minSdk 24, iPad pris en charge.**

**Les trois nouveautés de la 1.1.0, nommées par le commit de version lui-même — ne rien lui attribuer d'autre** (les 49 commits depuis la bascule de version mêlent nouveautés et corrections, et une partie était déjà dans le build précédent) :
1. **un second parent sur son propre téléphone** ;
2. **l'arrêt d'une plage libre pour la journée** ;
3. **un appui sur une notification qui ouvre l'écran concerné.**

### 4.2 Missions

- **Récurrence :** « Tous les jours », « Certains jours » (jours choisis), « Une seule fois ».
- **Une mission accomplie disparaît de la liste de l'enfant** — c'est voulu : *« à cet âge, une colonne de coches grises enterre la réponse à la seule question qui compte — qu'est-ce que je fais maintenant ? »*
- **Une mission peut se compter toute seule.** À la création, le parent choisit « Ça compte tout seul » ; dans l'onglet Missions, chaque mission porte l'étiquette **« ⚡ Se compte toute seule »** ou **« ✓ Vous confirmez »**, et on la touche pour basculer. Raison, citable : *« Se brosser les dents, faire son lit : vous le voyez de toute façon, et confirmer chaque matin finit par user votre attention — gardez-la pour ce qui la mérite. »*
- **Bibliothèque : 12 routines toutes faites** (Routine du matin, Routine du coucher, Vivre ensemble, Devoirs et école, À table, Ma chambre, Prendre soin de moi, Coup de main à la maison, Mon autonomie, Travail et révisions, Mon équilibre, Ma part à la maison) **et 66 suggestions**, chacune bornée par un âge. Les quatre dernières routines sont les routines ado.
- Certaines suggestions portent une **consigne de sécurité** affichée au parent : « Sans objet tranchant ni cuisson avant 12 ans » ; « Un adulte reste joignable et responsable à tout moment » pour garder son frère ou sa sœur à partir de 15 ans. Le guide en fait une étape à part entière.
- **« À refaire »** : la mission repart dans la liste, **aucune minute n'est ajoutée ni retirée**, et l'enfant ne voit nulle part un échec.

### 4.3 Bonus et ajustement

Depuis la fiche de l'enfant, **« Donner un bonus »** : montants proposés **5, 10, 15 ou 30 minutes**, avec une raison (« Coup de main spontané », « Bon bulletin », « Juste parce que »…). **Un bonus est toujours positif.** Retirer des minutes reste possible, mais ailleurs et sous son vrai nom : la section **« Ajustement »** de la fiche de l'enfant.

### 4.4 Séances de temps d'écran

- Minimum **5 minutes** (ou tout le solde s'il est inférieur), maximum le solde.
- **Seul le temps réellement écoulé est décompté** : une séance arrêtée au bout de 10 minutes sur 20 en laisse 10. *« On ne reprend jamais ce qui a été gagné »* — le parent peut arrêter à distance sans que l'enfant perde ses minutes.
- **Avertissement cinq minutes avant la fin.** C'est la seule notification qui passe pendant les heures calmes (20 h → 7 h, réglables). Une séance plus courte que l'avertissement n'en reçoit aucun.
- **Par défaut**, sur l'appareil où Mino est installé, l'enfant lance son temps **sans demander**, si son compteur n'est pas vide. Le parent peut exiger son accord pour chaque séance : fiche de l'enfant → **« En me demandant d'abord »**.
  ⚠️ **Le libellé exact est « En me demandant d'abord ».** La FAQ appelle ce réglage « Demander avant chaque session » — **ce libellé n'existe nulle part à l'écran. Ne pas le citer.**

### 4.5 Plages libres

Un créneau déclaré ouvert (le mercredi 14 h-16 h, les vacances) pendant lequel les applications se débloquent toutes seules et **l'enfant ne dépense RIEN**. À la fin, le blocage revient. Raison, citable :
> « Dans une vraie famille, tout n'est pas mérité — et une application qui l'ignorerait obligerait un parent à inventer une fausse mission "c'est mercredi". »

**Nouveau en 1.1.0 — arrêter une plage libre en cours.** Sur l'accueil parent, la plage apparaît avec les prénoms concernés, l'heure de fin et un bouton **« Arrêter »**. L'écran se referme tout de suite chez l'enfant. **L'arrêt ne vaut QUE pour aujourd'hui** : la plage revient d'elle-même la fois suivante — *« parce que l'arrêt se périme de lui-même »* (le seul geste existant, « Suspendre », éteignait tous les mercredis suivants). Tant que l'heure n'est pas passée, un bouton **« Reprendre »** permet de revenir sur l'arrêt — *« un geste d'une touche sans retour est un piège »*. **Aucun compte à rebours n'est affiché pendant une plage.**

### 4.6 Console, télé, ordinateur

Ces écrans se déclarent dans **Réglages → Appareils de la maison** et entrent dans le système de minos. L'enfant choisit l'écran et la durée, appuie sur **« Demander à mon parent »**, **le parent lance le minuteur** — et le décompte démarre **au moment où le parent lance**, pas au moment de la demande. *« Rien n'est décompté à ce moment-là. Une demande sans réponse ne coûte rien. »*

⚠️ **Sur une Switch, une PlayStation, une télé ou un ordinateur, Mino ne coupe RIEN et ne peut pas le faire.** Aucun de ces systèmes n'ouvre son temps de jeu à une application extérieure.

**La formule validée : « Mino tient le compte, vous tenez la manette. »**

**Un enfant sans téléphone est pris en charge :** le parent déclare ses écrans et confirme ses demandes depuis son propre téléphone. **Le seul écran automatique est celui où Mino est installé.**

### 4.7 Deux parents (nouveau en 1.1.0)

**Deux parents, deux téléphones, un seul compte.** L'autre parent installe Mino, saisit le **code famille**, choisit « C'est le téléphone d'un parent » et se sélectionne dans la liste. Il lui faut le **code à quatre chiffres** — **pas le mot de passe, qui n'a donc pas à être partagé.** On l'ajoute depuis Réglages → Les parents.
> « Le second parent rejoint donc avec le CODE FAMILLE, comme le reste de la maison — **un profil, pas un compte**. Pas d'adresse à donner, pas de mot de passe de plus à retenir. »

**Ce que le second parent NE PEUT PAS faire :** changer l'adresse du compte, résilier l'abonnement, supprimer la famille. **C'est le serveur qui le tient, pas une politesse d'interface.** Tout le reste lui est ouvert : créer une mission, poser une plage libre, offrir une minute, confirmer.

**S'il change de téléphone :** le même geste reprend son profil **ET révoque l'ancien appareil** — c'est fait pour le téléphone perdu ou volé.

### 4.8 Les trois codes — à ne jamais confondre

| Code | Forme | À quoi il sert |
|---|---|---|
| **Code parent** | 4 chiffres | Ouvrir l'espace parent. Appartient à la **famille**, pas au compte : le même sur tous les appareils. Jamais stocké sur l'appareil de l'enfant. Après **5 essais ratés**, l'accès se bloque **5 minutes** pour la famille entière. |
| **Code famille** | `MINO-XXXXXX` (6 caractères, sans I, O, 0 ni 1) | Rattacher un appareil à la famille. Se trouve dans Réglages. Après **10 essais ratés en une heure**, l'appareil doit attendre. |
| **Code de parrainage** | 6 caractères, alphabet de 32 signes sans I, O, 0 ni 1 | Inviter d'autres familles. **Ne rattache aucun appareil.** |

Les codes évitent I, O, 0 et 1 **parce qu'ils se lisent à voix haute et se retapent**.

⚠️ Une publication qui dit « partagez votre code Mino » **sans préciser lequel** crée un appel au support.

**À l'installation**, chaque appareil répond à « c'est l'appareil de qui ? » : « À \<prénom\> », « Partagé entre les enfants », ou « À moi » (téléphone d'un parent). Sur un appareil réservé à un enfant, passer au profil d'un frère demande le code à quatre chiffres ; sur un appareil partagé, les enfants passent librement de l'un à l'autre — *« exiger quatre chiffres à chaque fois les ferait taper devant eux »* sur la tablette du salon.

### 4.9 Notifications (nouveau en 1.1.0)

Un appui sur une notification ouvre l'écran concerné. **Deux destinations seulement** sont autorisées : l'**accueil parent** (où se confirment les missions et les demandes d'écran) et l'écran **Abonnement**. *« Le seul endroit du dépôt où une mission se confirme est l'accueil parent, section "En attente de vous" — c'est donc la cible, et ce n'est pas un repli. »*

**Une notification qui ne demande rien ne mène nulle part** : celle qui annonce une mission comptée sans confirmation informe, elle n'emmène pas. *« Une route promet qu'il y a quelque chose à faire au bout. »*

### 4.10 Le compagnon (« Mino qui parle »)

Quand le temps d'écran est terminé, le compagnon **reste et discute**. **Budget de 20 échanges par jour**, fil limité à **six tours**, réponses de deux ou trois phrases. Il connaît les missions du jour, propose des défis **sans écran**, et **ne confirme JAMAIS une mission ni ne donne de minutes.**
> « Une conversation réussie avec Mino est une conversation courte qui finit dehors. »

- **Activé par défaut. Désactivable enfant par enfant**, immédiatement : Enfants → sa fiche → « Parler à Mino » → Non. *Argument de réassurance direct pour les parents réticents à l'IA.*
- **Ce n'est pas une messagerie** (§ 2.4). Le parent peut lire **toutes** les conversations (« Lire leurs conversations »), et **l'enfant en est prévenu au bas de son écran** — *« un espace présenté comme privé et lisible en douce serait bien pire que celui-ci. »*
- **L'enfant peut dicter** : la transcription se fait **sur le téléphone**, aucun son ne quitte l'appareil, aucun son n'est conservé. Là où l'appareil ne sait pas transcrire seul, le bouton micro n'est pas proposé. *« Envoyer l'enregistrement d'une voix d'enfant à un service tiers ferait basculer Mino dans une tout autre catégorie : donnée proche du biométrique. »*
- **Mino ne parle PAS à voix haute** : aucune synthèse vocale dans le produit.
- La mascotte rétrécit de 132 à 76 px dès que l'enfant se met à écrire.
- **Le compagnon doit être déclaré et décrit, pas minimisé.** Une déclaration inexacte sur ce point est un motif de **retrait**, pas de simple refus — et le retrait arrive après publication.

**Messages graves — ce qu'on peut dire, et pas un mot de plus :**
- Le repérage a lieu **sur l'appareil, avant tout envoi**.
- Ces messages **ne sont transmis à aucun modèle** et leur texte **n'est enregistré nulle part**.
- Mino répond **une phrase écrite à l'avance, identique pour tous**, qui oriente vers un adulte de confiance et vers le **119**, numéro national gratuit et confidentiel.
- **Le parent est informé qu'un tel échange a eu lieu, avec sa date ET la réponse de Mino, mais sans les mots de l'enfant.** *(La FAQ renvoie à l'écran où cela se lit : « Vous êtes prévenu que cela a eu lieu, à la date près, dans "Lire leurs conversations". »)*
- **Les trois réserves obligatoires :** le repérage est automatique, **il n'est ni exhaustif, ni surveillé par une personne, et ne se substitue en aucun cas à la vigilance de l'adulte responsable.**

*Ces réserves ne sont pas rhétoriques : elles sont ce qui empêche la fonctionnalité de devenir une promesse de sécurité. Le site a déjà tenu deux versions contradictoires de cette réponse.* La raison de l'arbitrage, citable : *« Ne rien garder laisse le parent sans le moindre signal. Tout garder met les mots de l'enfant sous les yeux de quelqu'un qui peut être en cause — c'est précisément la raison pour laquelle le 119 est confidentiel. »*

⚠️ **Le 119, un message signalé ou un sujet grave ne doivent JAMAIS apparaître dans un visuel.** Voir § 7.4.

### 4.11 Le blocage des applications — ce que fait le produit

**Sur iPhone et iPad :** le bouclier système est posé en permanence sur les applications cochées, levé exactement le temps gagné, et **reposé par une extension système même si Mino est fermé**. Si l'enfant désinstalle Mino, **les restrictions posées par le système ne disparaissent pas** avec l'application.

**Sur Android :** aucune API officielle n'existe. Mino lit les statistiques d'usage et **pose un écran par-dessus** l'application encadrée, vérifié **une fois par seconde**. C'est ce que fait l'essentiel du marché, et **c'est contournable** : *« l'enfant s'en sert pendant la seconde qui précède, et l'application continue en arrière-plan »* ; un adolescent déterminé retire l'accès aux statistiques ou force l'arrêt de Mino. Si l'enfant désinstalle Mino, **le blocage s'arrête** — mais le parent le voit, l'écran Appareils le signale.

**Mino ne se bloque jamais lui-même** : l'enfant peut toujours voir ses missions et lancer son temps. *« Si le bouclier recouvrait Mino, l'enfant ne pourrait plus déclarer de mission, donc plus jamais gagner de temps, donc plus jamais lever le bouclier. »*

**Le parent voit l'état du blocage appareil par appareil**, avec six états : « Blocage actif », « Téléphone d'un parent », « Compteur seul, à votre demande », « Blocage désactivé sur cet appareil », « Blocage pas encore réglé », « **Sans nouvelles depuis plusieurs jours** ». Raison du dernier, honnête et forte : *« Le contournement le plus efficace ne produit jamais de "refus" — on désinstalle Mino, et la dernière nouvelle reste éternellement "approuvé". »* Passé trois jours sans nouvelles, l'appareil passe en « sans nouvelles », **pas en « protégé »**.

**Sur le web et dans tout build sans le module natif**, Mino compte le temps **sans rien verrouiller — et il le dit à l'écran** plutôt que de le laisser croire.

**⚠️ CE QUI PEUT SE DIRE ET CE QUI NE LE PEUT PAS : voir § 5.4 et § 5.5. Aucun verbe de blocage n'est publiable aujourd'hui.**

### 4.12 Changer de téléphone, structure de l'application

**Côté enfant :** ses minutes, ses missions et son historique appartiennent à son **profil**, pas à l'appareil ; sur le nouvel appareil il saisit le code famille et se choisit. **Le réglage du blocage, lui, est propre à chaque appareil et se refait** — c'est la seule chose qui ne suit pas, et l'omettre produirait un parent qui croit son enfant protégé.

**Côté titulaire :** on installe Mino et on se connecte avec son adresse et son mot de passe. Famille, enfants, historique et abonnement suivent.

**Structure :** espace parent à **quatre onglets** (Accueil, Missions, Enfants, Réglages) · espace enfant à **trois** (Missions, Temps, Profil). L'accueil parent porte tout ce qui attend : **« En attente de vous »**, « Écrans en cours », « Plage libre en cours », « Historique ».
> « "En attente de vous" et non "à valider" : ranger sa chambre n'est pas une demande qu'on approuve. **Ce qui attend ici, c'est un enfant.** »

Sur l'accueil parent, la mascotte est aussi le chemin vers « Changer de profil », avec un mot sous elle : *« sans lui, personne ne devine qu'un dessin se touche. »*

**Base de connaissance :** **67 réponses de FAQ** en 7 catégories (Installation, Temps d'écran, Missions et minos, Compte et code parent, Abonnement, Données et confidentialité, Ça ne marche pas) et **8 chapitres de guide**. *« Un seul fichier, pour une seule raison : la même réponse doit servir dans l'application, sur le site et dans l'outil de support. Trois copies d'une réponse, ce sont deux copies fausses au bout de trois mois. »*

---

## 5. LA FORME

### 5.1 Principe

Toute couleur du produit vient d'un seul fichier. **Aucun hexadécimal ne doit être inventé ailleurs.** *« Une palette qui vit à deux endroits diverge. Un graphiste qui choisit "un bleu Mino" de mémoire casse la marque. »*

### 5.2 Palette

**Couleurs vives (aplats, anneaux, pastilles, illustrations — jamais du texte) :**

| Nom | Hex |
|---|---|
| bleu | `#4EB6FF` |
| violet | `#7A7CFF` |
| menthe | `#2BC98A` |
| jaune | `#FFC85A` |
| rose | `#FF7DA0` |
| pêche | `#FFB592` |

**Versions douces (fonds) :** blueSoft `#AEE6FF` · purpleSoft `#E0E1FF` · mintSoft `#D3F5E7` · yellowSoft `#FFEFD1` · pinkSoft `#FFD9E6`

**Surfaces :** fond de l'application `#F2F6FF` (bleu très clair) · surface `#FFFFFF` · surfaceMuted `#F7F9FF` · surfaceSunken `#EDF2FE`
*L'identité demande beaucoup de blanc ; le fond n'est jamais blanc pur mais un bleu pâle, ce qui fait ressortir les cartes blanches.*

**Les « encres » — les mêmes teintes assombries, qui NE SERVENT QU'À ÉCRIRE :**

| Nom | Hex |
|---|---|
| blueInk | `#0065AC` |
| purpleInk | `#4548FF` |
| mintInk | `#1A7A54` |
| yellowInk | `#956300` |
| pinkInk | `#CC0037` |
| dangerInk | `#C00022` |

**Texte :** marine `#1A1D2E` (courant) · `#5A6180` (secondaire) · `#636D95` (le plus discret).
*Les gris d'origine ont été assombris : « un gris discret qui devenait illisible dès qu'on lui confiait autre chose qu'une décoration ».*

**Traits :** border `#E6ECFA` · borderStrong `#D4DEF5`
**Statuts :** success `#2BC98A` · warning `#FFC85A` · danger `#FF5C7A` · dangerSoft `#FFE1E8`

### 5.3 Les deux règles de charte à protéger

> **Règle de partage, à donner telle quelle à un graphiste : les couleurs vives gardent tous les aplats, anneaux, pastilles et illustrations ; les encres gardent tout le texte.**
> *La marque reste vive à l'œil, sans qu'aucune lettre ne devienne illisible.*

> **Le texte écrit SUR un aplat de marque est marine `#1A1D2E`, jamais blanc.**

C'est **mesuré, pas estimé** : blanc sur le bleu de marque = **2,2:1** ; blanc sur le menthe = **2,1:1** ; le seuil lisible est **4,5:1** (et 3:1 même en gros caractères). Le marine donne **7,5:1** sur bleu et **7,8:1** sur menthe, et il passe sur toute la palette, violet compris (4,9:1). **La palette n'a pas bougé d'un caractère — ce sont les encres qui ont été créées à côté**, décision de Julie entre trois options mesurées.

**Une seule exception :** sur la puce marine — seul aplat foncé de l'application — l'encre redevient blanche `#FFFFFF`.

**Un visuel avec du texte blanc sur le bleu Mino n'est pas à la marque : il est illisible.**

**Bon détail de post :** sur le rouge d'erreur, le projet s'impose **5:1** là où la loi demande 4,5:1 — précisément sur le texte qu'on lit le plus mal : *court, rouge sur rose, et lu par quelqu'un à qui il vient d'arriver quelque chose.*

### 5.4 Typographie

**Nunito**, cinq graisses : 400 Regular, 600 SemiBold, 700 Bold, 800 ExtraBold, 900 Black. **Google Font, libre de droits** et disponible partout — un graphiste peut la récupérer sans rien demander.

**Échelle, douze niveaux (taille / interligne, en points) :** display 56/62 · hero 34/40 · title 26/32 · section 20/26 · cardTitle 18/24 · body 16/23 · bodyStrong 16/23 · label 14/19 · caption 13/18 · overline 12/16 (interlettrage +1) · button 17/22 · buttonKid 20/26.

**Il y a deux échelles de ton, pas une** : celle de l'enfant est délibérément plus grande et plus ronde, celle du parent plus calme.

**Typographie des visuels de boutique** (réutilisable pour des visuels sociaux) : titre **Nunito 800 ExtraBold `#1A1D2E`**, sous-titre **Nunito 600 SemiBold `#5B6480`**.
*Note : `#5B6480` n'est **pas** un jeton de la palette du produit — c'est un gris propre à la composition des visuels de boutique.*

**Quatre couples de dégradés de fond alternent** pour que le défilé ne soit pas monotone : `#E8F3FF`/`#F7FAFF` · `#EAF7F1`/`#F8FCFA` · `#F1EFFF`/`#FAF9FF` · `#FFF4E8`/`#FFFBF6`.

### 5.5 Géométrie et matière

- **Espacements, base de 4 points :** xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48.
- **Rayons d'angle :** sm 12 · md 18 · lg 24 · xl 32 · `pill` 999. **Les boutons sont des pilules.**
- **Trois ombres seulement, toutes très légères :** `soft` (opacité 0,06 · flou 16 · décalage 6 px) · `lifted` (0,1 · 24 · 12 px) · `brand` (ombre bleue `#4EB6FF` à 0,35 · flou 18 · décalage 10 px). Sur Android : elevation 2, 5 et 6.
  > La phrase à donner à quiconque dessine un visuel Mino : **« Du papier posé sur du papier, jamais un tableau de bord encadré. »**
- **Contenu borné à 620 points de large, centré**, y compris sur iPad, tablette Android et navigateur.
- **Mode clair uniquement.** Il n'existe pas de mode sombre.
- **Les cartes de mission ne sont pas toutes de la même couleur :** cinq paires (fond doux + couleur pleine) tournent — bleu, violet, menthe, jaune, rose — attribuées par un hachage du titre. *C'est ce qui donne aux captures leur allure colorée sans qu'aucune couleur ne porte de sens.*

### 5.6 La mascotte

**Elle s'appelle Mino** — le même nom que l'application. **C'est le seul personnage de cet univers.** Aucun second personnage, aucun comparse, aucune famille de mascottes.

**Huit expressions, et huit seulement :** happy (heureux), proud (fier), motivated (motivé), surprised (surpris), delighted (ravi), worried (inquiet), sad (déçu), sleepy (fatigué). Livrées en rendus 3D, en carrés de 1024 px, **normalisées par un script qui recadre chaque pose sur le CORPS et non sur l'image** — sans quoi Mino changerait de taille et sauterait d'un écran à l'autre (il s'assoit quand il est endormi, écarte les bras quand il est ravi, et certaines poses portent des accessoires qui débordent). Il existe une **version vectorielle de secours**, ce qui fait qu'aucune expression ne peut casser un écran.

**Description, telle qu'elle est dessinée :** corps presque parfaitement rond, bleu clair, avec un **dégradé radial décentré** qui le fait lire comme une sphère éclairée ; **très grands yeux brillants** cerclés de blanc avec deux reflets ; **joues roses** ; **large sourire ouvert avec la langue rose** ; **petits bras en goutte partant du CÔTÉ du corps** ; **grosses baskets pêche** calées sous le corps.
→ Le détail des bras est une vraie contrainte : **plus haut, ils se lisent comme des oreilles.** La silhouette a été vérifiée de 320 px jusqu'à 32 px pour survivre à une barre d'onglets.

**Couleurs internes, pour un graphiste qui la redessine :** corps `#9FDDFF → #67C4FF → #4EB6FF → #2B8FDE` · membres `#63C1FF → #2E93E0` · chaussures `#FFC4A6 → #F5A582` (semelle `#EFA07D`) · joues `#FF8FB2` · langue `#FF7DA0` · étoile `#FFC85A` · trait/encre `#15182A`.

**L'expression n'est jamais décorative.** Huit situations du produit, huit expressions : mission faite → **proud** · en attente du parent → **motivated** · minutes gagnées → **delighted** · bientôt plus de temps → **worried** · plus de temps → **sad** · bravo → **proud** · bonne nuit → **sleepy** · le reste → **happy**.

Dans la conversation, la règle est déduite du contexte : confidence grave → **worried** (*« inquiet, pas triste : la tristesse ressemblerait à du reproche au pire moment »* — exactement le genre de détail qui fait un bon post) · chagrin ordinaire → sad · fierté de l'enfant → surprised · défi proposé → motivated · félicitation → proud · fin du budget quotidien → happy.

**Animations : rien ne tourne en boucle indéfiniment.** **Un seul clip existe réellement : `celebrate`**, 33 images à 24 i/s, **1 375 ms**, joué une fois. Quand il s'achève, Mino ne se fige pas : il revient au dessin fixe et continue de « respirer » très légèrement. Les clips `idle`, `waiting` et `outOfTime` sont décrits dans la documentation mais **ne sont PAS produits** — la table qui les liste est **une liste de souhaits, pas un inventaire**.

**Les confettis** n'existent que pour un enfant de **moins de 13 ans**, et **seulement au moment où une mission est confirmée**. Ils reprennent les cinq couleurs de marque.

**Ce que la mascotte ne fait JAMAIS :**
1. **Être nourrie, montée de niveau, habillée.** *La récompense est du temps d'écran, et rien d'autre.*
2. **Servir d'avatar d'enfant.** Les avatars sont **six animaux en emoji** : renard, panda, lapin, koala, lion, grenouille. Un jeu d'avatars illustrés a été essayé puis retiré : *« ils se lisaient comme six petits Mino, et à 40 px un enfant ne pouvait plus dire lequel était le guide et lequel était lui. »* Tout futur jeu doit rester **manifestement non-mascotte** : animaux, plats, pas de corps rond, pas de grands yeux brillants.
3. **Être posée sur un fond bleu de marque.** Mino est un personnage bleu : **il devient une tache bleue à 60 px.** Le fond de l'icône est clair (dégradé `#FFFFFF → #DCEBFF`) et le personnage occupe **62 %** du carré — pas cosmétique : Android masque l'icône en cercle, iOS en carré arrondi ; plus grand, le recadrage lui coupe une oreille.

**Tous les visuels de lancement sont générés** depuis la pose `happy` : icon.png 1024², adaptive-icon.png 1024², splash-icon.png 512² transparent, favicon.png 64², notification-icon.png 96² en silhouette blanche. **Ne jamais les retoucher à la main** — une retouche est écrasée au prochain lancement du script et fait diverger les fichiers entre eux. Idem pour les PNG de la mascotte et les 18 images du guide.

### 5.7 Accessibilité — ce qui est affirmable, et ce qui ne l'est pas

**AFFIRMABLE :**
- **Boutons enfant 64 pt minimum**, boutons parent **52 pt**, bouton « small » jamais sous **44 pt**, puce de choix **60 pt**. (Le script d'audit se donne 44 pt partout — minimum d'Apple, Google dit 48 — et **60 pt sur les écrans de l'enfant**.)
- **`hitSlop` a été explicitement refusé** comme solution : il étend la zone sensible mais **laisse le bouton minuscule à l'œil**.
- **Icône ET texte partout** : jamais de sens porté par la seule lecture, jamais par la seule couleur. Preuve concrète, les trois états d'une mission : **⭐ À FAIRE** (bleu), **⏳ EN ATTENTE** (jaune), **✓ ACCOMPLIE** (menthe). *Un parent daltonien verrait tout de suite un visuel qui coderait un état par la seule couleur.*
- **Le temps représenté trois fois** : chiffres, anneau de progression, **capsules** (1 capsule = 5 minutes/minos). → **« Un enfant qui ne lit pas encore peut agir. »** Bénéfice concret, utile pour les parents de 5-7 ans.
- Le seul écart assumé est déclaré dans le script avec sa raison et **reste compté** : la flèche « Retour » à 52 pt.
- Zones sûres iPhone et Android respectées.
- **L'accessibilité a été mesurée, pas estimée** : l'audit conduit l'application dans dix écrans réels et relève surface tactile, contraste contre le fond effectif, et absence de nom accessible.

**L'histoire racontable (à condition de la dater) :** premier passage — **44 cibles trop petites et 63 contrastes insuffisants**. Après correction — **0 cible trop petite, 0 élément sans nom accessible, 0 contraste insuffisant**, sur dix écrans. Mesure ultérieure, en préparant la fiche d'accessibilité d'Apple : **5,06:1 à 16,68:1** sur toutes les paires texte/fond, là où la barre est à 4,5:1. *« Une affirmation du cahier des charges qui n'avait jamais été vérifiée, mesurée, trouvée fausse, puis rendue vraie. »*

**NON AFFIRMABLE :**
- ✗ **« zéro problème d'accessibilité » aujourd'hui.** L'audit automatique est **cassé** : il passait par un bouton « Voir la démo » retiré depuis, **n'atteint plus qu'un écran sur onze**, et annonce donc « 0 problème » en n'ayant presque rien regardé. Les chiffres ci-dessus valent **pour la date où l'audit fonctionnait**.
- ✗ Le mot **« audité »** appliqué à toute l'application.
- ✗ **« Dynamic Type jusqu'à 200 % »**. Le composant de texte plafonne l'agrandissement à **1,6× (160 %)**. Le test à 200 % concernait la mise en page du bouton, pas l'échelle réellement appliquée. **Formulation sûre : « les libellés survivent à un texte agrandi ».**
- ✗ **« les animations se coupent si vous les avez désactivées ».** Rien dans le dépôt ne lit ce réglage système.

**Conséquence pour la copie :** un libellé de bouton trouvé dans une publicité doit tenir sur **deux lignes courtes**, pas être une phrase.

### 5.8 Les captures des boutiques — argument et logistique

**Argument publiable : aucune capture de la fiche n'est une maquette.** Le script conduit la **vraie** application dans Chromium, photographie les écrans réels, puis habille chaque capture (dégradé de marque, légende en Nunito, coins arrondis, ombre douce).

**Huit écrans × quatre formats :** iPhone 6,9" 1320×2868 PNG (jeu de référence Apple) · iPhone 6,5" 1284×2778 PNG · iPad 13" 2064×2752 PNG (obligatoire tant que la tablette est prise en charge) · Google Play 1080×1920 **JPEG**.
**Deux détails qui font refuser un envoi sans rien expliquer :** Play refuse un PNG porteur d'un canal alpha (d'où le JPEG — alors que l'icône doit au contraire être un PNG **avec** alpha), et Play refuse un rapport supérieur à 2:1 (le 1080×2400 natif de beaucoup d'Android, soit 2,22:1, est rejeté tel quel — d'où le 9:16).

**Deux partis pris réutilisables :** l'appareil **déborde volontairement en bas** du visuel — *« la fiche défile, et un écran coupé donne envie de faire glisser le doigt »* ; et **l'heure est gelée au lundi 7 septembre 2026 à 18 h** — *« un soir de semaine ordinaire, à l'heure où l'on se dispute justement pour les écrans »* (avant cela, la première capture disait le contraire de sa propre promesse un jour sur sept, sans que rien ne le signale).

**La première capture compte plus que les sept autres réunies.**

**Image mise en avant Play :** porte « Grandir, une mission à la fois. » et « Ses missions, son temps d'écran. », sur un dégradé `#E8F3FF → #F4F1FF → #FFF6EC`, avec Mino en pose `happy` à 330 px. **Ni prix, ni « gratuit », ni note, ni « Télécharger » : Google interdit tout cela.** Le **centre reste dégagé** parce que le nom de l'application vient parfois s'y superposer.

⚠️ **ATTENTION LOGISTIQUE : les 32 captures n'existent pas sur disque.** Le dossier `store/` est ignoré par git et ne contient que l'icône 512 et l'image mise en avant Play. **Ne jamais annoncer les captures comme disponibles.** Si quelqu'un demande « envoie-moi les captures », la réponse est : il faut d'abord exporter le web, lancer un serveur local et relancer le script de captures.

*Ne pas confondre avec les deux captures du paywall (preuves d'emplacement exigées par App Store Connect, pas des visuels marketing) ni avec les 18 images du guide interne.*

**Anecdote de méthode, utilisable en contenu « coulisses » :** les captures ont fait découvrir **trois défauts d'écriture invisibles à la relecture du code** — l'accueil parent disait encore « Demandes à valider » ; « Supprimer » était l'élément le plus visible de chaque ligne de mission après le titre ; deux frères qui font leur lit le même matin donnaient deux lignes d'historique strictement identiques.

---

## 6. LES CHIFFRES

### 6.1 Les prix — valeurs faisant foi au 15/09/2026

| | Valeur | Nature |
|---|---|---|
| Mensuel | **9,99 € TTC** | Constante du code |
| Annuel | **79,99 € TTC** | Constante du code |
| Équivalent mensuel de l'annuel | **6,67 €** | **Calculé** (79,99 / 12) |
| Remise annuelle | **−33 %** | **Calculé** (33,27 % arrondi) |
| Mois offerts sur l'annuel | **4 mois** (39,89 € d'économie) | **Calculé** (3,99 arrondi) |
| Essai | **30 jours**, pour tout le monde, sans exception | Constante du code |
| Parrainage | **1 mois** par filleul devenu payant, **12 maximum** par an | Constantes du code |
| Identifiants produit | `mino.premium.monthly`, `mino.premium.yearly` — mêmes prix chez Apple et Google | |

**Pourquoi 9,99 et 79,99, et pas 9,90 et 79 :** la grille tarifaire d'Apple ne comporte pas ces paliers. *« Une description qui annonce un prix que la boutique ne pratique pas est un motif de refus, pas une coquille. »* Un seul nombre a changé dans le code, et le site, la FAQ, les CGV, les écrans et Stripe ont suivi. **Bon matériau de fond : « un seul prix partout, par construction ».**
*La remise était de 34 % avant le passage de l'annuel de 79 € à 79,99 € — d'où l'intérêt de ne jamais la recopier à la main.*

**Les prix sont TTC.** La TVA appliquée est celle du pays de résidence du client dans l'UE. Une hausse de tarif suppose **un préavis d'au moins un mois** et ne s'applique qu'aux périodes postérieures.

**Formulation officielle du prix, générée depuis le code (FAQ) — les réseaux doivent s'y accorder au mot près :**
> « 9,99 € par mois, ou 79,99 € par an — soit 4 mois offerts, 33 % de moins. Toute la famille est comprise : autant d'enfants et d'appareils que vous voulez, sans supplément. »

**Formulation officielle hors FAQ — dernière ligne ÉDITORIALE de la description longue :**
> « Essai de 30 jours, puis 9,99 €/mois ou 79,99 €/an pour toute la famille, autant d'enfants et d'appareils que vous voulez. Annulation en deux touches. »

⚠️ **Ce n'est PAS la dernière ligne de la fiche publiée.** La description publiée doit encore se terminer par **le lien vers le contrat de licence** :
> « Conditions d'utilisation : https://www.apple.com/legal/internet-services/itunes/dev/stdeula/ »

Son absence a fait **refuser la 1.0 au motif 3.1.2**, par une analyse automatique, avant même qu'un examinateur n'ouvre l'application. *Renseigner le champ « Contrat de licence » dans Informations sur l'app ne suffit pas.*

### 6.2 RÈGLE DE PUBLICATION SUR « 6,67 € / MOIS »

Le montant 6,67 € est juste, et il est **calculé, jamais écrit en dur**. Mais **la hiérarchie d'affichage n'est pas la même sur les deux écrans** :

| Écran | Ce qui est en gros | Ce qui est en petit |
|---|---|---|
| **Paywall d'inscription** | **« 6,67 € / mois »** | « soit 79,99 € par an » |
| **Écran Abonnement de l'espace parent** | **« 79,99 € / an »** | « Soit 6,67 € par mois » |

Le récapitulatif de l'espace parent lit : « 79,99 € par an, soit 6,67 € par mois » — **l'annuel d'abord.** Ne pas croire que « 6,67 €/mois » est le prix d'appel officiel partout.

> **RÈGLE ABSOLUE : « 6,67 € / mois » ne peut JAMAIS paraître seul. Le montant réellement débité — 79,99 € par an — doit figurer sur la MÊME LIGNE.**

Le code le dit en ces termes :
> *« Le prix mensuel devant, le montant réellement facturé derrière et sur la même ligne : c'est la limite à ne pas franchir. Le raccourcir à "6,67 € / mois" ferait de cette phrase une publicité mensongère. »*

Un post titré « Mino, 6,67 €/mois » **est exactement la publicité mensongère que ce commentaire nomme.** Retirer le montant réellement débité est interdit — Apple le vérifie et la loi française l'impose ; **le mettre en petit est permis.**

→ ✗ « Mino, 6,67 €/mois » — ✓ « **79,99 € par an, soit 6,67 € par mois** ».

### 6.3 L'essai — la condition obligatoire à côté de tout prix

**30 jours, pour tout le monde, sans exception.**

⚠️ **Le moyen de paiement est enregistré AU MOMENT DE L'INSCRIPTION, sans être débité.** C'est ce qui permet à l'abonnement de démarrer tout seul au trentième jour si le parent ne fait rien. **Ce n'est PLUS un essai « sans carte » depuis le 9 septembre 2026.**

**Ne plus jamais écrire** « essai sans carte bancaire », « aucune carte ne vous est demandée pour commencer », « rien ne vous est demandé avant le 30e jour ».
**Dire à la place :** *« rien n'est prélevé pendant 30 jours ; la date du premier prélèvement est affichée avant que vous confirmiez. »*

*Le modèle d'avant accordait l'essai sans carte et se terminait sur un mur au trentième jour — le schéma qui convertit le moins bien. La loi française et le motif Apple 3.1.2 imposent en échange que le prix, la durée et le renouvellement automatique soient écrits sur l'écran de paiement.*

**Texte exact du paywall d'inscription — la voix officielle du produit sur l'argent :**
> « 0 € pendant 30 jours, puis 9,99 € par mois. Sans engagement, résiliable à tout moment. »
> (variante annuelle : « 0 € pendant 30 jours, puis 6,67 € / mois facturés 79,99 € par an. Sans engagement, résiliable à tout moment. »)
> Bouton : **« Commencer mes 30 jours »**

**Toute accroche publicitaire doit tenir dans ce cadre, sans le déborder.**

**Le paywall présélectionne le MENSUEL, pas l'annuel.** L'annuel reste à une touche, sous la carte, avec sa remise affichée. Décision prise après un test sur un vrai téléphone : l'annuel par défaut affichait 79,99 € à quelqu'un qui n'avait pas encore fait confiance au produit — *« ça fait peur »*. 9,99 €/mois avec trente jours offerts est un « oui » d'une autre nature. *(Un document interne montre encore une maquette avec l'annuel présélectionné : le document est en retard, pas le code.)*

**S'abonner PENDANT l'essai ne rallonge ni ne raccourcit l'essai.** *L'essai appartient à Mino, pas au rail de paiement : il finit le jour où il finit, qu'on paie le premier jour ou le vingt-neuvième.* **Ne jamais laisser entendre qu'on « gagne » du temps en s'abonnant tôt.**

⚠️ **« Exactement 30 jours, jour pour jour » est interdit sur iOS.** L'essai est désormais porté par une **offre d'introduction de la boutique**, configurée « Gratuit · 1 mois » sur les deux formules et les deux boutiques ; « 1 mois » chez Apple peut valoir 31 jours selon le mois. **Écrire « 30 jours » (ce que disent tous les écrans et les CGV) est juste ; garantir le décompte au jour près ne l'est pas.**

⚠️ **INCERTAIN, à vérifier avant toute campagne prix :** l'affichage « 0 € pendant 30 jours » est **inconditionnel** dans l'application — elle ne sait pas vérifier que l'offre d'introduction existe bien dans App Store Connect et Play Console. **Sans cette offre, la boutique prélève le plein tarif sous une promesse de gratuité affichée juste au-dessus du bouton.** Le dépôt précise que c'est **déjà arrivé sur Google Play**, et que c'est le motif 3.1.2 — celui qui a fait refuser la 1.0. La vérification est reportée à la main.

⚠️ **Aucune promesse d'e-mail d'avertissement avant la fin de l'essai.** Mino ne s'engage **plus** dans ses CGV à prévenir par e-mail : le tuyau d'envoi existe, l'envoi planifié non. *« Une clause qu'on ne tient pas vaut moins que pas de clause du tout. »* **Ce que les CGV promettent aujourd'hui :** la date du premier prélèvement est écrite à l'écran **avant confirmation**, reste consultable dans Réglages → Abonnement, et **les boutiques préviennent elles-mêmes leurs abonnés**.

### 6.4 Ce que couvre l'abonnement

**Un seul abonnement couvre toute la famille, quel que soit le nombre d'enfants et d'appareils, sans supplément.** Argument réel et vérifiable : **aucun plafond d'enfants ni d'appareils n'existe**, ni dans le code ni dans le schéma de base. **Le compte est familial, pas par enfant.**

**L'abonnement appartient au compte Mino**, pas à l'appareil ni au compte Apple/Google : payé sur iPhone, il vaut sur le téléphone de l'enfant, sur celui de l'autre parent et sur le site. *Corollaire — le piège le plus fréquent : un second compte Mino ne peut pas reprendre un abonnement acheté sur l'App Store ou Google Play.*

### 6.5 Le parrainage — mécanique exacte

| Qui | Ce qu'il reçoit |
|---|---|
| **Le filleul** | **Ses 30 jours d'essai. Ni plus, ni moins — comme tout le monde.** |
| **Le parrain** | **1 mois offert par filleul**, et seulement une fois que ce filleul est devenu abonné **PAYANT** (premier paiement réellement encaissé, jamais à l'état d'essai). |
| **Plafond** | **12 mois offerts par an et par famille**, sur une année glissante de 365 jours. Au-delà, le parrainage est enregistré « qualifié » mais non crédité — il peut être honoré plus tard. |

**Pourquoi le filleul ne reçoit rien de plus — c'est le point contre-intuitif, et c'est assumé :**
1. **Mécanique :** l'essai est porté par une offre de boutique à durée fixe — on ne peut pas demander soixante jours pour l'un et trente pour l'autre.
2. **Cohérence :** l'écran de paiement annonce « Vous avez 30 jours » ; **promettre le double à une touche d'intervalle, c'est se contredire devant quelqu'un à qui on demande sa carte.**
3. **L'argument de vente assumé :** *ce qu'on offre au filleul est déjà l'offre entière, et ce qui le décide n'est pas une remise mais le fait qu'une famille qu'il connaît utilise Mino.*

**Pourquoi la récompense n'arrive qu'au premier paiement :** *récompenser à l'inscription reviendrait à payer pour des comptes plutôt que pour des clients — c'est la faille par laquelle ce genre de programme se fait vider.*

**Les garde-fous** (utiles si un commentaire public demande « et si on triche ? ») : on ne peut pas se parrainer soi-même ; une famille ne peut être parrainée qu'une seule fois ; un code ne peut pas être utilisé par un foyer déjà client ni avec un moyen de paiement déjà associé à un autre compte. **Les deux premières sont des contraintes de base de données, pas des vérifications applicatives — elles tiennent même si quelqu'un appelle l'API directement.**

### 6.6 Comment le mois offert arrive — TROIS RAILS, PAS DEUX

| Rail | Ce qui se passe |
|---|---|
| **Web / Stripe** | **Automatique.** Si le parrain est encore en essai, son essai est repoussé d'un mois ; sinon un avoir est porté au solde client et déduit de la facture suivante. |
| **App Store** | **Le parrain doit CONFIRMER lui-même.** L'offre promotionnelle d'Apple exige l'accord de l'abonné, et elle suppose que l'offre soit configurée et signée. |
| **Play Store** | **Aucun mécanisme n'existe aujourd'hui.** Le mois est compté, mis de côté, et attendra. |

Le dépôt l'écrit : *« App Store et Play Store : aucune des deux portes n'existe. On ne peut demander ni à Apple ni à Google de sauter un prélèvement […] En attendant, le mois est mis de côté et rien n'est perdu. »*

> **À NE JAMAIS ÉCRIRE : « votre mois offert arrive automatiquement », ni aucune date, ni aucun délai.**

**La formulation sûre est celle des CGV, vraie sur les trois rails :**
> « Le parrain reçoit un mois d'abonnement offert lorsque son filleul devient abonné payant. »

**Ce que Mino peut promettre sans distinction de rail :** les mois offerts **se cumulent** — un par filleul devenu payant, jusqu'à douze par an — **le mois est acquis et compté, et rien n'est perdu.** La déduction sur la facture suivante et le report de l'essai **ne sont automatiques que pour un abonnement pris sur le site (Stripe)**.

**Les mois offerts n'ont aucune valeur monétaire : ni échangeables, ni remboursables, ni transférables.** (Clause des CGV.)

### 6.7 Le message de partage — ton validé, réutilisable tel quel

> « On utilise Mino à la maison : le temps d'écran se gagne, mission après mission. Tu as 30 jours d'essai, et avec mon code XXXXXX tu me fais gagner un mois. »

*Service rendu et transparence sur le bénéfice du parrain, sans promettre d'avantage au filleul.* **C'est la seule exception au vouvoiement** (§ 3.4) : il est écrit par le parent, pour un ami.

**L'angle qui fonctionne**, selon le dépôt : parler du **service rendu**, pas de la récompense —
> « Vous connaissez un parent qui négocie les écrans tous les soirs ? »

**Ce qui ne fonctionne pas :** ✗ « Gagnez de l'argent en parrainant » — *cela transforme une recommandation entre amis en démarchage, et les parents le sentent immédiatement.*

**Cadence :** le parrainage ne doit être montré qu'à **trois moments** — après la première mission confirmée, au trentième jour quand l'essai devient payant, et dans les réglages en permanence. *« Le mettre partout devient du bruit, puis de l'agacement, puis un motif de désinstallation. »* **Vaut aussi pour la cadence éditoriale des réseaux.**

### 6.8 Résiliation et remboursement

**« Annulation en deux touches » est vrai mais ambigu.** Pour un abonnement souscrit **dans l'application** (le cas majoritaire), la résiliation se fait **dans les réglages du téléphone** — Apple et Google ne fournissent **aucune API pour annuler**. Mino y emmène en un geste, **il n'annule pas lui-même**. Pour un abonnement pris sur le site : Réglages → Abonnement → « Résilier », dans Mino.

**Formulation sûre, celle de l'application :**
> « La résiliation se fait dans les réglages de votre téléphone, en deux touches — nous vous y emmenons. »

La résiliation est **immédiate, sans justification**, et l'accès court jusqu'à la fin de la période payée.

**Qui encaisse, et donc qui rembourse :** Apple pour un achat App Store, Google pour un achat Play, Agence Wheb pour un achat sur le site. **Un remboursement d'achat in-app se demande à Apple ou à Google, pas à Mino.** *« À dire, pas à cacher. »*

**Supprimer le compte n'annule PAS l'abonnement** : il faut résilier là où on a souscrit.

### 6.9 Les avis — vaut mot pour mot pour les commentaires sur les réseaux

En dessous de **4,0**, le classement décroche et le taux d'installation s'effondre. La consigne : demander un avis **après une mission confirmée**, jamais au premier lancement, et **répondre à TOUS les avis négatifs, sans défensive** — *la réponse est lue par les futurs installeurs bien plus que par son destinataire.*

**Orientation éditoriale utile :** la première cause de non-conversion n'est pas le prix, c'est la famille qui n'a pas réussi à faire fonctionner le blocage pendant l'essai. **Les publications les plus utiles sont celles qui aident à installer et à accorder l'autorisation système, pas celles qui vendent.** (Le chiffre qui soutient ce constat est **interne** et ne se publie pas.)

---

## 7. CE QU'ON N'A PAS LE DROIT DE DIRE, ET POURQUOI

### 7.1 Les trois sur-affirmations déjà commises — les exemples qui fondent tout le reste

**N°1 — « les appels d'urgence ne sont jamais bloqués ».**
Phrase exacte retirée de la FAQ et des CGV le **11 septembre 2026** :
> ✗ « Les appels d'urgence passent toujours, **quoi qu'il arrive** : ni iOS ni Android ne les laissent bloquer par une application. »

**Ce qui s'est passé :** l'affirmation venait d'une **connaissance générale des plateformes**, pas du code de Mino. Le commit qui l'a retirée en donne la raison : c'est *« le seul point dont l'inexactitude peut coûter un dommage corporel »*, et une communication qui contredit les CGV est un motif de refus. **Ne jamais la remettre, sous aucune reformulation.**

**N°2 — une déclaration de confidentialité annonçant une collecte qui n'existait pas.**
Le principe qu'elle a coûté : **toute affirmation de collecte ou de non-collecte doit être identique dans la communication, dans la politique de confidentialité et dans les questionnaires des boutiques.** *Apple compare la fiche au binaire et à la politique de confidentialité ; Google compare la fiche Play à la fiche App Store.*

**N°3 — « deux mois offerts » quand le code en donnait quatre.**
La FAQ annonçait deux mois là où la remise en valait quatre (9,99 × 12 − 79,99 = 39,89 €, soit 3,99 mois). Le principe : **le chiffre se recalcule, il ne se recopie pas.** *« Se tromper à son propre désavantage reste se tromper. »*

### 7.2 Le blocage — l'interdit le plus lourd

**✗ Ne jamais employer « bloque », « verrouille », « empêche », « coupe », « applique la limite » — ni la légende « Un vrai blocage, pas un compteur » — TANT QUE :**
**(a)** le module natif de blocage n'est pas dans le binaire soumis **ET**
**(b)** l'habilitation Apple **Family Controls de distribution** n'est pas obtenue.

**Motif : Apple 2.3.1, Accurate Metadata.** C'est le motif de retrait le plus direct qui existe, **et il frappe APRÈS publication, quand des familles utilisent déjà le produit.** Le service par défaut s'appelle `timer-only` : Mino compte le temps sans rien verrouiller.

**Contexte, qui ne lève pas l'interdit :** le module natif est **écrit, compilé et livré** (Swift compilé et parti dans le build iOS de production, application validée par Apple ; Kotlin compilé, boucle Android éprouvée le 9 septembre 2026 — **sur un émulateur**). **Restent à éprouver : iOS sur un appareil réel, et Android sur un vrai téléphone.** La ligne exacte : dire « le code existe, il est compilé, il a tourné » est défendable ; dire **« testé sur tous les téléphones »** ne l'est pas.

L'habilitation de distribution **se demande deux fois** (pour l'application et pour l'extension MinoShieldMonitor) et le délai constaté est **de l'ordre de trois semaines, sans garantie**. *« La date de lancement ne se décide pas à partir du moment où le produit est prêt, mais à partir du moment où cette autorisation arrive. »*

→ **Conséquence pratique : on ne vend pas le blocage, on vend la boucle** (missions → minutes → écrans). **Les huit légendes du § 3.7 ont justement été écrites sans aucun de ces verbes.**
→ **Nommer n'est pas promettre :** la fonctionnalité s'appelle « le blocage » / l'écran « Blocage des applications » (et « encadrement »/« verrouillage » restent interdits comme noms), mais **aucune phrase du type « Mino bloque X » aujourd'hui.**

**✗ Ne jamais promettre le MÊME blocage sur iOS et Android.** Le dépôt adresse lui-même cette phrase au marketing :
> « sur iOS le blocage est solide et incertain à obtenir, sur Android il est certain à obtenir et poreux. **Ce n'est pas symétrique, et la promesse commerciale devrait en tenir compte.** »

Donc : ✗ « impossible à contourner », « inviolable », « bloque pour de bon », « votre enfant ne peut pas le désactiver » — **faux sur Android**, où *« le blocage est efficace mais pas inviolable : un enfant déterminé peut forcer l'arrêt de Mino »*.

**✗ Ne jamais montrer ni nommer une application bloquée** (« YouTube est bloqué », « TikTok verrouillé ») dans une création se voulant fidèle à iOS : Apple ne remet que des jetons anonymes, **cet affichage est impossible dans le produit**.

**✗ Ne jamais affirmer que Mino bloque, démarre ou arrête une console, une télé ou un ordinateur.** Il n'en a pas le pouvoir. Formules justes, déjà écrites : *« Mino tient le compte, vous tenez la manette »* et *« il demande, VOUS lancez le minuteur »*.

**✗ Ne jamais laisser croire que Mino sait ce que l'enfant fait de son écran** : aucun rapport d'usage, aucun filtrage de contenu, aucun site bloqué.

### 7.3 LES APPELS D'URGENCE — le point dont l'inexactitude peut coûter un dommage corporel

**LA SEULE FORMULATION AUTORISÉE, mot pour mot** (FAQ, jumelle dans les CGV) :
> « Les dispositifs d'appel d'urgence propres au téléphone — l'appel depuis l'écran verrouillé, le SOS — ne passent pas par Mino et ne sont pas bloqués par lui ; mais ils appartiennent au système, pas à nous, et nous ne pouvons pas nous en porter garants. »

*Elle dit deux choses distinctes : ce que Mino fait (il ne les bloque pas) et ce dont il ne répond pas (le comportement du système).* **La seconde moitié est la partie qui protège. Ne jamais la couper.**

**Ne jamais ouvrir ce sujet spontanément.** Si on est interrogé, cette réponse et rien d'autre.

**Ce qui est vérifié dans le code et peut se dire :** sur **Android**, Mino écarte de lui-même le composeur téléphonique choisi sur l'appareil — il ne le propose pas dans la liste et refuse de le recouvrir même si son nom y arrivait par un autre chemin (**deux exclusions distinctes** : le sélecteur et le veilleur), *« parce que le sélecteur n'est pas l'endroit où le dégât se produit »*. Sur **iPhone et iPad**, Mino **ne peut pas** reconnaître Téléphone, parce qu'Apple ne lui remet que des jetons anonymes : **c'est au parent de ne cocher ni Téléphone, ni Messages, ni une catégorie qui les contiendrait.**

**PÉRIMÈTRE À NE PAS DÉBORDER :** l'exclusion automatique Android ne couvre **QUE le composeur d'appels**. Elle **ne couvre PAS** l'application Messages. **Messages n'est jamais écarté automatiquement, sur aucune des deux plateformes.**

**Également interdite :** ✗ « Le téléphone, les messages et les appels d'urgence restent toujours accessibles. »

### 7.4 Public, enfants, visuels

- ✗ **« Pour les enfants », « dès 3 ans »**, ou toute formule laissant entendre que le public principal est constitué d'enfants : réservé à la **catégorie Kids d'Apple (5.1.4)**, que Mino refuse délibérément. **Mino est une fiche pour FAMILLES, adressée au parent.**
- ✗ **Toute création conçue pour être vue ou comprise par un enfant.** Règle de produit, pas seulement de ciblage : *« On ne fait pas de publicité à des enfants, ni juridiquement ni moralement. »* **Un visuel destiné à amuser un enfant contrevient à la règle même diffusé à une audience de parents.**
- ✗ Un visuel qui ne conviendrait pas à un **classement 4+**, même si l'application est classée plus haut (Apple 2.3.8).
- ✗ **Le 119, un message signalé ou un sujet grave** dans une image, une capture ou une vidéo. Raison écrite : *« la communication deviendrait une communication sur la détresse enfantine, et le classement d'âge suivrait »*. Vaut **a fortiori** sur les réseaux, où un visuel circule sans son contexte. (Dans les captures des boutiques, la conversation avec Mino est en **septième** position, jamais dans les trois premières, et montre un échange anodin.)
- ✗ **Toute marque tierce visible** (Apple 2.3.9 : on répond des droits de tout ce qui figure dans un visuel). **Ne jamais photographier l'écran d'ajout d'appareil**, où s'affichent de vraies marques de consoles. Dans la démo, l'appareil s'appelle « **Console du salon** ».
- ✗ **Mélanger les deux registres d'âge** dans une même création · toute tranche d'âge qui **enjambe 13 ans** · « dès 4 ans » · « 5-12 ans ».
- ✗ **Laisser croire que la mascotte disparaît à 13 ans.**
- ✗ Un **second personnage**, un comparse, une « famille Mino » · **la mascotte en avatar d'enfant** · **la mascotte sur un fond bleu de marque**.
- ✗ **Texte blanc sur le bleu `#4EB6FF` ou sur le menthe `#2BC98A`** · une couleur vive de la palette employée **en texte**.
- ✗ **Coder un sens par la seule couleur ou la seule icône.**
- ✗ Montrer, **côté enfant**, des **missions déjà validées**, ou un **solde en minutes pour un moins de 13 ans** : l'application ne les affiche jamais.
- ✗ Sur l'**image mise en avant Google Play** : ni prix, ni « gratuit », ni note, ni « Télécharger ».
- ✗ **Retoucher à la main un asset généré** (mascotte, visuels de lancement, images du guide).
- ✗ **Annoncer une animation de Mino qui n'existe pas** (seul `celebrate` existe) · **promettre un mode sombre**.

### 7.5 Chiffres, preuves, statut

- ✗ **Tout chiffre de tests ou de couverture.** Le dépôt se contredit (~477, 233, 210, 216, 226, 131 selon les sources) et **aucun n'est vérifiable sans lancer la suite**.
- ✗ **« Zéro problème d'accessibilité »**, le mot **« audité »**, **« Dynamic Type jusqu'à 200 % »**, **« les animations se coupent si vous les avez désactivées »** (§ 5.7).
- ✗ **Annoncer les captures des boutiques comme disponibles** (§ 5.8).
- ✗ **Attribuer à la 1.1.0 autre chose que ses trois nouveautés nommées** (§ 4.1).
- ✗ **Faire du storytelling public sur les failles corrigées.** Les titres de commits sont spectaculaires (« Un client modifié pouvait se faire créditer 999 minutes », « L'espace parent restait ouvert sur la tablette qu'on venait de partager », « Une clé privée arrivait à un caractère du dépôt ») et racontent un dépôt rigoureux **à un lecteur technique** ; sortis de leur contexte, ils se lisent comme **l'aveu que ces portes ont été ouvertes**. Si ce registre est voulu, le faire porter sur **la méthode** — *« presque tous les défauts sérieux du projet ont été trouvés en conduisant un parcours de bout en bout, jamais en relisant un écran »* — **jamais sur l'inventaire des failles**.
- ✗ **Les chiffres internes, sous aucune forme** : objectif de 10 000 familles payantes, MRR, conversion essai→payant 30 %, churn 5 %, part du parrainage 25 %, CAC 66 €, LTV ~198 €, durée de vie 20 mois, budget d'acquisition ~500 000 €, coûts par canal (30-80 € par essai, 500-5 000 € par opération créateur), taux d'échec d'installation 30-50 %. **Ce sont des hypothèses de travail explicitement présentées comme contestables** — les publier en ferait des engagements et donnerait la stratégie d'acquisition à la concurrence. *(Certaines sont en outre arithmétiquement périmées : le MRR et la LTV sont calculés sur l'ancien prix de 9,90 €.)*
- ✗ **Tout appel au téléchargement, lien de boutique, annonce de disponibilité ou date de sortie** — voir § 9.3.

### 7.6 LES PIÈGES VIVANTS — phrases FAUSSES encore livrées dans le produit

> **Lire cette section avant chaque session d'écriture. Une phrase issue du produit n'est PAS une garantie d'exactitude.** Ce sont les phrases qui ont survécu à la décision qui les a rendues fausses. **Six sont encore dans le code livré.**

**PIÈGE 1 — LE PLUS GRAVE : les appels d'urgence, dans le guide livré.**
Le guide de démarrage embarqué dans l'application porte encore la sur-affirmation, **dans d'autres mots que celle qui a été retirée**.
Texte exact encore présent, `src/content/guide.ts:237` :
> ✗ « Les appels d'urgence, **eux**, passent toujours : ni iOS ni Android ne les laissent bloquer par une application. »

La phrase retirée de la FAQ et des CGV le 11 septembre 2026 (commit 8361ca4) était, elle :
> ✗ « Les appels d'urgence passent toujours, **quoi qu'il arrive** : ni iOS ni Android ne les laissent bloquer par une application. »

**Deux rédactions, une seule faute.** Ne pas se servir du guide comme source sur ce point.

**Pourquoi le défaut ne se refermera pas tout seul :** le guide a été écrit le 11 septembre 2026 à **12 h 20** (commit bd5e5ac) ; la correction qui a purgé les CGV et la FAQ est passée à **13 h 29** le même jour (commit 8361ca4) et **n'a pas touché guide.ts**. Le même commit 8361ca4 a ajouté une **garde de non-régression**, `__tests__/vocabulaireDesDocuments.test.ts` — **mais sa liste `DOCUMENTS` (ligne 21) ne couvre que `terms.ts`, `privacy.ts` et `faq.ts`.** `guide.ts` n'apparaît dans **aucun fichier de test du dépôt**. Or l'un des motifs de la garde, `/ne les laissent bloquer par une application/` (ligne 81), **correspond mot pour mot à guide.ts:237** : la correction à demander tient en **deux gestes** — réécrire la ligne 237, et ajouter `src/content/guide.ts` à `DOCUMENTS`.

**PIÈGE 2 — « Rien d'autre » sur les données de l'enfant.**
`src/content/faq.ts:608-612` (entrée `donnees-enfant`) porte encore :
> ✗ « Son prénom, son âge et son avatar. **Rien d'autre** : pas d'adresse e-mail, pas de photo, pas de numéro. »

**Ne pas la recopier, même si elle vient du produit.** C'est faux dès que le compagnon est activé — **et il l'est par défaut** : le texte des conversations est conservé trente jours et le message de l'enfant est transmis à un prestataire d'IA. Le questionnaire App Privacy le déclare.

⚠️ **Ne pas citer non plus la note interne `CLAUDE.md:63`**, qui dit *« Un prénom et un âge, **rien de plus**. Pas de nom de famille, pas de date de naissance, pas d'école. »* — elle **omet l'avatar** et reproduit exactement la tournure **« rien de plus »** que le même document interdit par ailleurs. **La seule phrase qui fasse foi est celle du § 8.6.**

**PIÈGE 3 — « Mino ne voit jamais quelles applications sont installées » : DEUX endroits, DEUX formulations.**
- `src/content/faq.ts:192` (entrée `choisir-applis-bloquees`) :
  > ✗ « Le système affiche sa propre liste — c'est lui qui la fournit, Mino ne voit jamais quelles applications sont installées. »
- `src/content/faq.ts:611` (entrée `donnees-enfant`) :
  > ✗ « Mino ne sait pas quelles applications sont installées sur son appareil — le système ne les lui montre jamais. »

**Les deux sont vraies sur iPhone et iPad** (Apple ne renvoie que des jetons opaques et un nombre) **et FAUSSES sur Android**, où le sélecteur est construit en lisant la liste des applications lançables de l'appareil (`PickerActivity.kt:50-57`, rendu possible par la déclaration `<queries>` de `AndroidManifest.xml:29-34`).

**La formulation juste, vraie partout, celle des CGV (`src/content/terms.ts:60`) :**
> ✓ « Dans les deux cas, rien de tout cela n'est transmis à nos serveurs : ni les noms, ni le nombre. »

*Et le texte complet des CGV, si l'on veut le détail : « Sur iPhone et iPad, il ignore lesquelles vous avez cochées — Apple ne lui transmet que des identifiants anonymes et leur nombre. Sur Android, où ce mécanisme n'existe pas, il lit la liste des applications installées pour vous les présenter et conserve sur l'appareil, et sur lui seul, le nom de celles que vous cochez. »*

**PIÈGE 4 — les transferts hors UE.**
`src/content/faq.ts:644` (entrée `ou-sont-les-donnees`) affirme encore :
> ✗ « Dans l'Union européenne. Elles ne sont transférées à aucun pays tiers en dehors de ce que nécessite le paiement, assuré par Stripe. »

**Ne pas recopier.** C'est faux **dès que le compagnon est activé** (le message de l'enfant part chez Anthropic) et **dès qu'une notification part** (Expo reçoit le jeton et le texte, *« par exemple "Manon a terminé une mission" : un prénom d'enfant y figure donc »*). **Cela contredit la politique de confidentialité elle-même** — exactement la divergence qu'Apple recoupe en premier. Formulation juste : § 8.8.

**PIÈGE 5 — le rapport de plantage.**
`src/content/faq.ts:679` promet un signalement qui part *« avec le contexte technique nécessaire, et **sans aucune donnée sur vos enfants** »*.
✗ **Ne pas reprendre cette formule.** Le rapport emporte **des compteurs, dont le nombre d'enfants**.
✓ **La formulation juste, celle de la politique :** un rapport de plantage part automatiquement, y compris depuis l'appareil d'un enfant ; **les prénoms de vos enfants et toute adresse citée dans le texte sont retirés avant l'envoi.**

**PIÈGE 6 — un libellé de réglage qui n'existe pas.**
`src/content/faq.ts:294` appelle un réglage **« Demander avant chaque session »** — **ce libellé n'existe nulle part à l'écran.** Le vrai est **« En me demandant d'abord »**.
**Règle générale : tout bouton cité dans une publication se copie depuis le code, jamais depuis la FAQ ni le README.** Autre cas connu : le README écrit « VALIDER +15 MIN » ; à l'écran c'est **« C'est fait · +15 min »**.

### 7.7 Les documents périmés — à ne recopier sous aucune forme

| Document | Ce qu'il dit encore | Réalité |
|---|---|---|
| `docs/marketing/parrainage.md` **lignes 37, 41 et 88** | « Coût réel d'un filleul : 9,90 € » · « un parrainage rapporte ~198 € pour 9,90 € de coût » · « **Elle vient de décider que ça valait 9,90 €** » | Ancien prix. **TROIS occurrences**, dont la ligne 88 **en pleine section « Ce qui décide du succès »** — c'est-à-dire exactement le passage qu'on recopie en premier pour écrire sur le parrainage. |
| `docs/marketing/parrainage.md:101-102` | « Offrez-lui deux mois d'essai. S'il reste, vous avez un mois offert. » | Faux depuis le 09/09/2026. **Le même fichier dit l'inverse en ligne 12.** |
| `docs/marketing/acquisition.md:24, 30` | « ~9,90 € par famille » · « l'essai sans carte bancaire » | Deux fois faux. |
| `docs/marketing/README.md` | « 99 000 € de MRR », « ~198 € » | Calculés sur l'ancien prix. Arithmétiquement périmés — **et de toute façon chiffres internes, à ne jamais publier.** |
| `docs/ops/parcours-inscription.md:33` | « essai sans carte » | Faux. |
| `docs/ops/parcours-inscription.md:70-84` | maquette du paywall avec **l'annuel présélectionné** | Le code présélectionne le **mensuel**. |
| `docs/ops/de-ici-au-lancement.md:396` | ancien prix | Faux. |
| `docs/marketing/aso.md` | légende « Un vrai blocage, pas un compteur » | **Interdite** tant que § 7.2 n'est pas levé. |
| `docs/ARCHITECTURE.md:204` | « Le module natif de blocage n'existe pas encore. » | Figé au 21/08/2026. Périmé. |
| `docs/blocage-ecrans.md:6-9` | « Il n'a **jamais été compilé** » | Périmé au 07/09/2026. |
| `docs/mascot-tests/README.md:45-50` | table listant **quatre** clips de mascotte | **Liste de souhaits**, pas inventaire. Seul `celebrate` existe. |
| `README.md:66` | bouton « Découvrir avec la démo » présent sur l'accueil | **Retiré du code.** Ne pas promettre d'essai ni de démo sans inscription. |
| `README.md:21` | « VALIDER +15 MIN » | Libellé réel : « C'est fait · +15 min ». |
| `CLAUDE.md:63` | « Un prénom et un âge, rien de plus » | Note interne abrégée : omet l'avatar, reproduit une tournure interdite. |

**Les anciens chiffres sont : 9,90 € · 79 € · −34 %.** Les prix actuels sont **9,99 €/mois, 79,99 €/an, 6,67 €/mois en annuel, −33 %**. Ces documents n'ont pas été mis à jour après le changement de prix du **8 septembre 2026**. **Ne recopier aucun chiffre depuis eux.**

### 7.8 Liste rouge consolidée

**Sécurité et blocage**
- ✗ « Les appels d'urgence passent toujours » / « quoi qu'il arrive » / « , eux, passent toujours » / toute variante
- ✗ « Le téléphone, les messages et les appels d'urgence restent toujours accessibles »
- ✗ « bloque », « verrouille », « empêche », « coupe », « applique la limite », « Un vrai blocage, pas un compteur »
- ✗ « impossible à contourner », « inviolable », « votre enfant ne peut pas le désactiver »
- ✗ Promettre le même blocage sur iOS et Android · « testé sur tous les téléphones » · un blocage éprouvé sur iPhone réel
- ✗ « YouTube est bloqué », « TikTok verrouillé », toute application nommée dans une création fidèle à iOS
- ✗ Affirmer que Mino bloque, démarre ou arrête une console, une télé ou un ordinateur
- ✗ Présenter Mino comme un dispositif de sécurité, de surveillance ou de garde

**Données**
- ✗ « nous collectons son prénom, son âge et son avatar — rien d'autre » / « rien de plus »
- ✗ « Mino ne voit jamais quelles applications sont installées » (comme propriété générale)
- ✗ « aucune donnée ne quitte l'appareil » / « tout reste sur le téléphone »
- ✗ « vos données restent en Europe » / « hébergées en France » / « aucun transfert hors UE sauf le paiement »
- ✗ « sans aucune donnée sur vos enfants » à propos d'un rapport de plantage
- ✗ Toute mention de géolocalisation, de suivi ou de surveillance, **même en négatif maladroit**
- ✗ Présenter le compagnon comme un chat, une messagerie ou un ami virtuel ; laisser croire qu'il confirme, accorde des minutes, surveille en temps réel ou remplace une ligne d'écoute
- ✗ Toute affirmation de collecte ou de non-collecte qui ne serait pas **identique** dans la communication, la politique de confidentialité et les questionnaires des boutiques
- ✗ Demander l'ajout d'un pixel, d'un SDK d'attribution ou de la clé `NSUserTrackingUsageDescription`

**Argent**
- ✗ 9,90 € · 79 € · −34 % · tout prix autre que 9,99 €/mois et 79,99 €/an
- ✗ **« 6,67 € / mois » seul**, sans « 79,99 € par an » sur la même ligne
- ✗ « deux mois offerts » sur l'annuel (c'est **quatre**)
- ✗ « 60 jours d'essai », « deux mois d'essai », « le double de l'essai pour votre filleul »
- ✗ « essai sans carte bancaire » / « aucune carte ne vous est demandée » / « rien ne vous est demandé avant le 30e jour »
- ✗ « exactement 30 jours, jour pour jour »
- ✗ « votre mois de parrainage arrive automatiquement », toute date, tout délai
- ✗ « nous vous prévenons avant de vous débiter »
- ✗ « Résiliez en deux touches depuis Mino » · « Annulation en deux touches » **sans dire où**
- ✗ « remboursé sans question »
- ✗ « Gagnez de l'argent en parrainant »
- ✗ **Toute mention de prix sans ses conditions** : essai 30 jours, moyen de paiement enregistré à l'inscription sans être débité, démarrage automatique au terme, caractère TTC
- ✗ Tout chiffre commercial écrit à la main sans avoir été recalculé

**Vocabulaire et ton**
- ✗ « corvées », « quêtes », « tâches ménagères gamifiées »
- ✗ « valider », « approuver », « autoriser », « refuser » une mission · « VALIDÉE » · « Demandes à valider » · « VALIDER +15 MIN »
- ✗ « encadrement », « verrouillage » pour nommer la fonctionnalité
- ✗ points, pièces, niveaux, badges, boutique, monnaie virtuelle, mini-jeux, RPG, monde virtuel, mascotte à nourrir
- ✗ Tutoyer le parent · vouvoyer un enfant · employer « minutes » dans un texte adressé à un moins de 13 ans
- ✗ « (e) », « il/elle », tout adjectif ou participe accordé en genre au sujet de l'enfant
- ✗ « vos enfants », « ce que Mino sait d'eux »
- ✗ Jargon : ManagedSettings, Family Controls, DeviceActivity, RLS, jetons opaques, « autorisation révoquée », « timer-only »
- ✗ Toute relance ou accroche culpabilisante, registre de la peur, de la punition ou de la discipline imposée
- ✗ Nommer un bouton qui n'existe pas à l'écran

**Cadre**
- ✗ Tout appel au téléchargement, lien de boutique, annonce de disponibilité, date de sortie (§ 9.3)
- ✗ Toute URL ou adresse minoapp.fr avant confirmation (§ 8.7 et § 9.2)
- ✗ **Toute affirmation reprise d'un fichier `docs/` sans l'avoir recoupée avec le code**

---

## 8. L'ÉDITEUR ET LES MENTIONS OBLIGATOIRES

### 8.1 L'éditeur

**Agence Wheb**, société par actions simplifiée à associé unique au capital de **500 €**, siège social **47 rue Vivienne, 75002 Paris**, immatriculée sous le numéro **103 231 460 R.C.S. Paris**, TVA intracommunautaire **FR67103231460**. **Directrice de la publication : Julie Zucherman.**

*Valeurs tirées du Kbis du 3 avril 2026. L'adresse personnelle de la présidente figure au Kbis et a été **délibérément écartée** du dépôt : le siège social est la seule adresse dont une mention légale a besoin.*

⚠️ **Le numéro apparaît sous deux graphies dans le dépôt** (« SIREN 103 231 460 » et « 103 231 460 R.C.S. Paris »). **C'est le même numéro.** En communication, reprendre la forme du contrat : **« 103 231 460 R.C.S. Paris »** — c'est celle qui a été relue.

**Une biographie de compte, une page « à propos » ou une publicité doivent nommer l'éditeur exact, pas « Mino ».**

### 8.2 Le médiateur de la consommation

**CM2C — Centre de la Médiation de la Consommation de Conciliateurs de Justice**, saisine en ligne sur **www.cm2c.net**.

- **Ne jamais ajouter d'adresse postale.** L'article **R. 616-1** du Code de la consommation demande le nom du médiateur et **l'adresse de son site internet**, pas son adresse postale. Raison écrite : *« une adresse postale reproduite de mémoire et devenue obsolète serait pire qu'absente, puisqu'elle enverrait un client mécontent à un endroit qui ne le recevra pas. »*
- **Ne jamais présenter la médiation comme un premier recours.** Les CGV exigent d'abord **une réclamation écrite** à contact@minoapp.fr **restée sans solution**, puis une saisine **dans un délai d'un an** à compter de cette réclamation (**article L. 612-2** du Code de la consommation).
- La médiation est **gratuite, facultative**, et **ne prive jamais de la possibilité de saisir la justice**.

⚠️ **INCERTAIN — l'adhésion à CM2C figurait encore parmi les tâches NON FAITES au 9 septembre 2026.** Les CGV nomment CM2C comme *« le médiateur de la consommation dont nous relevons »*, ce qui suppose une **adhésion payée et en cours**. Rien dans le dépôt ne dit que c'est fait. **Vérifier auprès de Julie avant toute mention publique.**

### 8.3 Adresses et URL — ce qui est tenu par le code, et ce qui ne l'est pas

**Tenues par le code (`src/content/document.ts:86-88`), donc publiables sous la réserve du § 8.7 :**
- **contact@minoapp.fr** (contact général, rétractation, réclamations)
- **privacy@minoapp.fr** (demandes RGPD)
- L'hébergeur, texte exact : « **Supabase (hébergement et base de données, région européenne)** »

**NON tenues par le code — à faire confirmer par Julie avant publication :**
- **https://minoapp.fr** (site et assistance)
- **https://minoapp.fr/confidentialite.html** (politique de confidentialité)
- Le copyright **« 2026 Agence Wheb »**

*Ces trois valeurs ne viennent que de `docs/ops/fiche-app-store.md:183-186`, c'est-à-dire d'un fichier de `docs/` — que ce brief interdit par ailleurs de prendre pour source.*

**La politique de confidentialité doit rester accessible sans compte et sans JavaScript.**

### 8.4 Les interdictions de plateforme documentées

| Motif | Portée |
|---|---|
| **Apple 2.3.1** (Accurate Metadata) | Rien ne doit être promis que le binaire soumis ne fasse → tous les mots de blocage. **Motif de retrait, APRÈS publication.** |
| **Apple 3.1.2** | La description d'une application à abonnement doit porter le **lien vers les conditions d'utilisation dans son TEXTE**, et le prix annoncé doit être celui que la boutique pratique. **A fait refuser la 1.0.** |
| **Apple 2.5.1** | Habilitation **Family Controls de distribution** — a fait refuser la 1.0 une seconde fois. |
| **Apple 5.1.4** | « Pour les enfants », « dès 3 ans » : réservé à la catégorie Kids, que Mino refuse. |
| **Apple 2.3.8** | Aucun visuel qui ne conviendrait pas à un classement **4+**. |
| **Apple 2.3.9** | **Aucune marque tierce** dans un visuel : on répond des droits de tout ce qui y figure. |
| **Apple 5.1.1(v)** | La suppression du compte doit être possible depuis l'application. |
| **Google Play** | Ni prix, ni « gratuit », ni note, ni « Télécharger » sur l'image mise en avant. Pas de PNG avec alpha pour une capture. Pas de rapport supérieur à 2:1. Déclaration « attire les enfants » = **oui, franchement**. |

### 8.5 Réserve sur les documents contractuels

⚠️ **Les deux documents contractuels portent, dans leur propre code source, l'avertissement qu'ils n'ont pas été relus par un avocat.** L'avertissement vise expressément les clauses de **rétractation**, de **reconduction tacite**, de **médiation**, ainsi que **les durées de conservation** et **la liste des sous-traitants**.

**Une campagne qui s'appuierait sur ces textes comme s'ils étaient validés ferait porter à Mino un risque que le dépôt signale lui-même.**

Dernière mise à jour des deux documents : **11 septembre 2026**. Règle du dépôt : *« Un contrat qui change de contenu change de date. »*

### 8.6 Ce qui est PUBLIABLE TEL QUEL sur les données

**Sur l'enfant — la seule phrase qui fasse foi (`src/content/privacy.ts:58`) :**
> « **Prénom, âge et avatar illustré choisi dans une liste. Aucune adresse e-mail, aucun mot de passe, aucun nom de famille, aucune photo, aucun numéro de téléphone, aucune donnée de localisation.** »

**L'enfant n'a pas de compte** : c'est le parent qui ouvre le compte et crée les profils.

**Le chapeau de la politique de confidentialité, mot pour mot :**
> « **Aucune publicité, aucune revente de données, aucun traceur publicitaire, aucune géolocalisation, aucune messagerie entre personnes, aucun profil public. Aucun enfant n'est visible par une autre famille que la sienne.** »

**Également publiable tel quel :**
- **Aucun traceur d'événements dans l'application** : ni Firebase, ni Amplitude, ni aucun autre — **vérifié dans les dépendances**. Ce n'est pas un état de fait provisoire mais **une règle de produit écrite**. C'est ce qui permet de répondre « Aucune donnée n'est utilisée pour vous suivre » au questionnaire App Privacy, et de n'afficher **aucune invite ATT**.
- **Aucune donnée sensible au sens du RGPD** : ni origine, ni opinions, ni santé, ni biométrie. **Aucun enregistrement de la voix d'un enfant n'est conservé**, même lorsqu'il dicte : la reconnaissance vocale est faite par l'appareil, seul le texte est envoyé. **Le nom de famille de l'enfant n'est jamais demandé.**
- **Aucun profilage, aucune décision automatisée produisant des effets juridiques, aucune prospection commerciale ciblant les enfants. Aucune publicité, aucune mesure d'audience marketing et aucun traceur tiers dans l'expérience enfant.**
  ⚠️ *Noter le périmètre exact du second membre : « **dans l'expérience enfant** ». Le dépôt n'affirme nulle part l'absence totale de mesure côté parent ou site web. La seule affirmation absolue vérifiée concerne l'application elle-même, sans traceur.*
- **L'historique est effacé à 90 jours.** Passé ce délai, le détail disparaît — quelle mission, quel jour, quel écran — et il ne reste que **la somme exacte**. **Le compteur reste exact, aucun solde ne bouge d'une minute.** C'est de la **minimisation choisie, pas subie**, et la raison est une phrase de marque : *« trois ans du détail des journées d'un enfant sont exactement le dossier que Mino promet de ne pas constituer, et aucun écran ne les affiche »* · *« un enfant n'a pas à traîner un dossier derrière lui. »*
- **Suppression du compte** depuis l'application (**Réglages → « Gérer mon compte »**, tout en bas), **sans écrire à personne** : effacement **immédiat et définitif** des profils, missions, historique et minutes. On peut aussi supprimer le profil d'un seul enfant. **Réserves à dire :** elle est réservée au **parent titulaire** ; elle **n'annule pas** un abonnement souscrit par l'App Store ou Google Play ; les factures déjà émises subsistent pour la durée légale et **ne contiennent aucune donnée d'enfant**.

### 8.7 Ce que Mino collecte réellement — liste exhaustive

Sept catégories, présentées comme exhaustives par la politique de confidentialité :

1. **Compte parent** : e-mail, mot de passe chiffré, prénom, code famille, code PIN
2. **Profil enfant** : prénom, âge, avatar
3. **Usage** : missions, minutes, séances, plages libres
4. **Appareils** : prénom réservataire, nom donné au téléphone, état du blocage, dernier contact, jeton de notification
5. **Abonnement** : statut, dates, codes de parrainage
6. **Signalements et rapports de plantage**
7. **Conversations avec Mino**

**Deux points contre-intuitifs :** le **jeton de notification** est un identifiant d'appareil qui se déclare ; et **un rapport de plantage part automatiquement, y compris depuis l'appareil d'un enfant** — voir le PIÈGE 5 du § 7.6.

**Durées de conservation — engagements chiffrés, à ne pas arrondir :**

| Donnée | Durée |
|---|---|
| Compte, enfants, missions | pendant l'abonnement, puis **3 ans** après la dernière activité |
| Historique détaillé | **90 jours** |
| Conversations avec Mino | **30 jours** |
| Signalements et rapports d'incident | **12 mois** |
| Journaux techniques | **12 mois** au maximum |
| Factures | **10 ans** (obligation comptable) |

**Sous-traitants, à citer si la question est posée :**

| Sous-traitant | Rôle |
|---|---|
| **Supabase** | Base de données et authentification, **région européenne** |
| **Stripe** | Paiements — responsable de traitement pour les données bancaires, **que Mino ne voit jamais** |
| **Anthropic** | Génération des réponses du compagnon (modèle claude-haiku-4-5) — **données non utilisées pour entraîner un modèle**, transfert encadré par les clauses contractuelles types |
| **Expo** | Acheminement des notifications — **reçoit le jeton et le texte, où figure donc un prénom d'enfant** |
| L'hébergeur de courrier | Envoi des e-mails transactionnels |

⚠️ **Expo est celui qu'on oublie, et il contredirait un « aucune donnée d'enfant ne sort ».** Le texte du produit l'assume explicitement, exemple à l'appui : *« par exemple "Manon a terminé une mission" : un prénom d'enfant y figure donc. »*

### 8.8 L'hébergement et les transferts hors UE — formulation obligatoire

✗ **Ne jamais écrire** « vos données restent en Europe », « vos données sont hébergées en France », ni « aucun transfert hors UE sauf le paiement ».

✓ **La formulation sûre :**
> Les données sont hébergées dans l'Union européenne (**Supabase, région européenne**) ; lorsqu'un transfert hors UE est inévitable — **les réponses du compagnon, l'acheminement des notifications, le paiement** — il est encadré par **les clauses contractuelles types de la Commission européenne**.

⚠️ **Précision à connaître, et à faire arbitrer :** la politique de confidentialité livrée est encore un cran plus prudente que cette phrase. Son texte exact est :
> « **Nous privilégions** un hébergement dans l'Union européenne. Lorsqu'un transfert hors UE est inévitable, il est encadré par les clauses contractuelles types de la Commission européenne. »

« Nous privilégions » n'est pas « les données sont hébergées ». L'hébergeur déclaré (`document.ts:88`) dit bien « région européenne », donc le fait est soutenu — mais **la communication ne doit jamais être plus affirmative que la politique**. En cas de doute, reprendre les mots de la politique. **À faire trancher par Julie et par le relecteur juridique (§ 9.8).**

---

## 9. NEUF EXEMPLES — TROIS JUSTES, TROIS FAUSSES, ET LES POINTS À TRANCHER

### 9.1 Trois formulations JUSTES, et pourquoi

**✓ 1. « Fini la négociation du soir. Votre enfant fait ses missions, gagne des minutes, et profite de ses écrans. Vous confirmez, c'est tout. »**
*Pourquoi elle est juste :* c'est le texte promotionnel App Store, **déjà arbitré pour la conformité**. Elle décrit la boucle entière **sans employer un seul verbe de blocage** (§ 7.2), elle **vouvoie le parent** et ne s'adresse jamais à l'enfant, elle emploie « missions » et « confirmez » — les deux mots du produit — et elle ne promet **aucun** résultat éducatif.

**✓ 2. « Votre essai est terminé. Reprenez l'abonnement pour confirmer les missions — celles déjà déclarées vous attendent, rien n'est perdu. »**
*Pourquoi elle est juste :* c'est le message réel du produit. Elle montre la règle d'écriture Mino en une ligne — **on dit ce qui s'arrête, on rassure sur ce qui ne s'arrête pas, on ne menace pas** — et elle est **exacte** : ce qui s'arrête est la main du parent, jamais l'enfant, et les missions déclarées s'empilent réellement en attente.

**✓ 3. « 79,99 € par an, soit 6,67 € par mois. Essai de 30 jours ; le moyen de paiement est enregistré à l'inscription sans être débité, et l'abonnement démarre au terme si vous ne faites rien. Prix TTC. »**
*Pourquoi elle est juste :* le **montant réellement débité figure sur la même ligne** que l'équivalent mensuel (§ 6.2), et **les quatre conditions obligatoires** accompagnent le prix (§ 6.3). C'est une phrase qu'un examinateur d'Apple peut recouper mot à mot avec le paywall.

### 9.2 Trois formulations FAUSSES, et pourquoi

**✗ 1. « Mino, 6,67 €/mois. Et les appels d'urgence passent toujours. »**
*Deux fautes en une phrase.* **« 6,67 €/mois » seul est une publicité mensongère** — le code lui-même emploie ce mot : *« Le raccourcir à "6,67 € / mois" ferait de cette phrase une publicité mensongère. »* Le montant réellement débité, **79,99 € par an**, doit figurer sur la même ligne. Et la seconde moitié est **la sur-affirmation n°1 déjà payée par ce dépôt**, sur le seul point *« dont l'inexactitude peut coûter un dommage corporel »* : Mino ne peut pas s'en porter garant. Seule formulation autorisée : § 7.3.

**✗ 2. « Mino bloque vraiment les applications, sur iPhone comme sur Android — et il ne collecte que le prénom, l'âge et l'avatar de votre enfant, rien d'autre. »**
*Trois fautes.* **(a)** Tout verbe de blocage est interdit tant que le module natif n'est pas dans le binaire soumis **et** que l'habilitation Apple Family Controls de distribution n'est pas obtenue — **Apple 2.3.1, motif de retrait après publication**. **(b)** « sur iPhone comme sur Android » gomme l'asymétrie que le dépôt adresse lui-même au marketing : *« sur iOS le blocage est solide et incertain à obtenir, sur Android il est certain à obtenir et poreux. »* **(c)** « rien d'autre » est **la sur-affirmation n°2** : faux dès que le compagnon est activé — **et il l'est par défaut**. C'est la divergence qu'un examinateur recoupe en premier.

**✗ 3. « Parrainez un ami : il reçoit deux mois d'essai, vous recevez automatiquement un mois offert, déduit de votre prochaine facture. »**
*Trois fautes.* **(a)** Le filleul reçoit **30 jours, comme tout le monde** — « deux mois » est la formule périmée qui traîne encore dans un document interne, et le même fichier dit l'inverse dix lignes plus haut. **(b)** **« automatiquement » est faux sur deux rails sur trois** : sur l'App Store le parrain doit confirmer lui-même, sur Play **aucun mécanisme n'existe** aujourd'hui. **(c)** **« déduit de votre prochaine facture » n'est automatique que sur Stripe.** La formulation sûre, celle des CGV : *« Le parrain reçoit un mois d'abonnement offert lorsque son filleul devient abonné payant. »*

### 9.3 Zone à trancher avant toute publication — le statut de disponibilité

**La matière disponible se contredit sur ce point, et la contradiction n'est pas tranchée. Ne pas choisir un camp.**

| Ce que dit une lecture | Ce que dit l'autre |
|---|---|
| La **1.0.5 est en ligne sur les deux boutiques depuis le 14 septembre 2026** ; la 1.1.0 a été préparée le 15 (git log bbfa06d). *« La 1.0.5 était publiée sur les deux boutiques depuis la veille ; App Store Connect refuse un nouveau build sous une version déjà en ligne. »* | **Mino n'est PAS encore publié.** La 1.0 a été refusée **deux fois** : motif **3.1.2** (lien vers le contrat de licence absent du texte de la description) et motif **2.5.1** (habilitation Apple Family Controls de **distribution** non accordée). Les 32 captures des boutiques n'existent pas sur disque, et **« Apple refuse une version sans au moins un jeu iPhone, c'est le poste bloquant. »** |

**RÈGLE DE SÉCURITÉ, à appliquer tant que Julie n'a pas tranché par écrit :**
> ✗ **Aucun appel au téléchargement. Aucun lien de boutique. Aucune annonce de disponibilité. Aucune date de sortie.**

**Faits stables quel que soit l'arbitrage :** version en cours **1.1.0**, identifiant `fr.minoapp.mino`, **iOS 16.4 minimum**, **Android minSdk 24**, **iPad pris en charge**.

---

## 10. RÉPONSES PRÊTES AUX COMMENTAIRES

**Consigne de fond, applicable telle quelle :** répondre à **TOUS** les commentaires négatifs, **sans défensive** — *la réponse est lue par les futurs installeurs bien plus que par son destinataire.*

| Objection | Réponse (matière validée) |
|---|---|
| « Ça ne marchera jamais avec mon ado » | § 3.3 : à partir de 13 ans, minutes et non minos, célébrations effacées, missions d'autonomie/travail/équilibre, l'âge se règle sur sa fiche. *« Un adolescent à qui l'on sert des confettis ferme l'application et ne la rouvre pas. »* **Ne pas laisser croire que la mascotte disparaît.** |
| « Mon enfant va mentir » | « Vous n'approuvez pas la mission : vous confirmez qu'elle est faite. » · « La confiance se donne mission par mission, et se retire de la même façon. » · « Le système est conçu pour que la vérification reste humaine. » |
| « Et s'il bidouille l'appli ? » | La sécurité est dans la base, pas dans l'application : un appareil enfant peut déclarer et dépenser, il ne peut **ni confirmer ni ajouter des minutes** — et ce n'est pas l'interface qui l'en empêche. |
| « Je vais lui offrir trop d'écran » | « Une journée de missions faites doit donner à peu près le temps d'écran que vous acceptiez déjà. » + barème 5 / 10-15 / 20. |
| « Encore une appli qui gamifie tout » | Pas de monnaie virtuelle, pas de niveaux, pas de boutique, pas de mascotte à nourrir, pas de mini-jeux. **Un mino vaut une minute et ne s'achète jamais.** *« Ce sont ces mécaniques que les parents fuient en installant Mino. »* |
| « Mon enfant n'a pas de téléphone » | Console, télé, ordinateur se déclarent dans « Appareils de la maison ». Le parent confirme depuis son propre téléphone. **« Mino tient le compte, vous tenez la manette. »** |
| « Vous surveillez mon enfant ? » | « Ce n'est pas un outil de surveillance. » Aucune géolocalisation — l'application ne demande jamais la position et **ne pourrait pas l'obtenir**. Aucun rapport d'usage. + les formules de dégagement du § 2.2. |
| « Et si j'arrête de payer ? » | § 1.5 en entier. *« Un enfant n'a pas choisi le moyen de paiement de ses parents. »* |
| « Ça marche sur Android ? » | Répondre par **la mécanique** (missions → minutes), **jamais** par une promesse de blocage (§ 7.2). Ne jamais promettre le même comportement des deux côtés. |
| « Et les appels d'urgence ? » | **Ne jamais ouvrir ce sujet spontanément.** Si interrogé : la formulation exacte du § 7.3, **seconde moitié comprise, elle ne se coupe jamais**. |
| « Et les Messages ? » | **Ne jamais écrire « les messages restent toujours accessibles ».** L'exclusion automatique ne couvre que le composeur d'appels, et seulement sur Android. |
| « Vos données sont où ? » | § 8.8, formulation nuancée obligatoire. |
| « Comment j'annule ? » | « La résiliation se fait dans les réglages de votre téléphone, en deux touches — nous vous y emmenons. » |
| « Et si on triche sur le parrainage ? » | § 6.5, garde-fous — **contraintes de base de données, pas vérifications d'interface** : elles tiennent même si quelqu'un appelle l'API directement. |

---

## 11. DOUZE ANGLES DE CONTENU, AVEC LE PIÈGE DE CHACUN

1. **« Le renversement »** — un contrôle parental retire du temps, Mino en fait gagner. *Piège : ne pas décrire le mécanisme par un verbe de blocage.*
2. **« Le mot qu'on a refusé »** — pourquoi « missions » et pas « corvées » ni « quêtes ». Un post entier sur le choix d'un mot, justifié comme une décision de produit. *Piège : ne jamais écrire les deux mots interdits, même en jeu de mots, même comme repoussoir dans un titre.*
3. **« Ce que Mino refuse d'être »** — § 2.1. *Piège : ne pas illustrer par une image de ce qu'on refuse (pièces, badges, coffres) — un visuel circule sans son texte.*
4. **« Les minutes gagnées sont acquises »** — le journal en ajout seul, § 1.6, pilier 1. *Piège : ne pas dériver vers le jargon technique.*
5. **« Et s'il triche ? »** — § 1.6, piliers 3 et 4. *Piège majeur : ne jamais faire de storytelling public sur les failles corrigées (§ 7.5).*
6. **« Mon ado ne voudra jamais »** — § 3.3 + les paires enfant/ado. *Piège : ne pas laisser croire que la mascotte disparaît.*
7. **« Un enfant qui ne lit pas encore peut s'en servir »** — 64 pt, icône ET texte, le temps représenté trois fois, les capsules. *Piège : jamais « audité » ni « zéro problème d'accessibilité ».*
8. **« Quand l'abonnement s'arrête »** — § 1.5. Un des meilleurs angles de confiance disponibles.
9. **« Tout n'est pas mérité dans une vraie famille »** — les plages libres, § 4.5. *Piège : ne pas décrire l'arrêt d'une plage comme une punition.*
10. **« L'enfant sans téléphone »** — § 4.6. *Piège : ne jamais laisser entendre que Mino démarre ou arrête une console.*
11. **« Deux parents, deux téléphones, un seul compte »** — § 4.7. *Piège : ne pas présenter ça comme un « second compte » — c'est un profil.*
12. **« Aider à installer plutôt que vendre »** — § 6.9. *Piège : un tutoriel d'installation est exactement l'endroit où l'on glisse un verbe de blocage sans y penser.*

**Angle « coulisses » — utilisable, avec une limite nette.** Utilisable : **la méthode**. *« Presque tous les défauts sérieux du projet ont été trouvés en conduisant un parcours de bout en bout, jamais en relisant un écran. »* Bon exemple concret : les trois défauts d'écriture découverts par les captures (§ 5.8). **Interdit : l'inventaire des failles corrigées** (§ 7.5).

**Angle « compagnon » — à manier avec des pincettes.** § 4.10. *Pièges : jamais un chat, un ami virtuel ou une messagerie ; jamais laisser croire qu'il surveille, confirme ou accorde quoi que ce soit ; **jamais le 119, un message signalé ou un sujet grave**.*

**Mesure de campagne — conséquence directe :** il n'existe **aucune** mesure d'attribution dans l'application. Pas de pixel, pas de SDK, **donc pas de conversion remontée dans un gestionnaire de publicités**. Ce n'est pas un manque mais un choix, et il se paie en méthode : **exiger un lien traçable et un code de parrainage dédié de tout créateur de contenu**. ⚠️ **Toute demande d'une régie d'« activer le suivi pour mieux mesurer » remet la clé `NSUserTrackingUsageDescription` et casse, le jour même, la déclaration « aucune donnée n'est utilisée pour vous suivre ».** Elle a déjà figuré avec pour valeur « Mino ne suit personne » : *un Info.plist ne se lit pas comme une profession de foi mais comme une **déclaration de capacité**.*

---

## 12. CHECKLIST AVANT DE PUBLIER UN POST

**Les mots**
- [ ] Aucun « corvée », « quête », « valider », « approuver », « refuser une mission », « VALIDÉE », « encadrement », « verrouillage ».
- [ ] Aucune monnaie, point, niveau, badge, boutique, mascotte à nourrir, mini-jeu.
- [ ] Le parent est vouvoyé, l'enfant tutoyé. Aucun « minutes » adressé à un moins de 13 ans.
- [ ] Aucun « (e) », aucun « il/elle », aucun participe accordé au sujet de l'enfant. Aucun « vos enfants ».
- [ ] Tout libellé de bouton cité a été copié depuis le code, pas depuis la FAQ ni le README.
- [ ] Aucun jargon technique.

**Les promesses**
- [ ] Aucun verbe de blocage, sauf si Julie a confirmé que le module natif est dans le binaire soumis **et** que l'habilitation Apple est obtenue.
- [ ] Aucune promesse identique sur iOS et Android.
- [ ] Sur les appels d'urgence : la formulation exacte du § 7.3, seconde moitié comprise, ou rien.
- [ ] Aucune promesse d'action sur une console, une télé ou un ordinateur.
- [ ] Aucune promesse que Mino sait ce que l'enfant utilise, ni qu'il ne voit jamais les applications installées.
- [ ] Aucune promesse de surveillance, de sécurité ou de garde. Aucune promesse de résultat éducatif (§ 13.7).

**L'argent**
- [ ] 9,99 € / 79,99 € / 30 jours / 4 mois / −33 % / 1 mois par filleul / 12 max — rien d'autre.
- [ ] Si « 6,67 € » apparaît, « 79,99 € par an » est **sur la même ligne**.
- [ ] Tout prix est accompagné de : essai 30 jours, moyen de paiement enregistré à l'inscription sans être débité, démarrage automatique au terme, TTC.
- [ ] Aucun « sans carte bancaire », aucun « deux mois », aucun « 60 jours », aucun « automatiquement » sur le parrainage, aucun « jour pour jour ».
- [ ] Aucune « annulation en deux touches » sans « dans les réglages de votre téléphone ».
- [ ] Aucun chiffre interne.

**Les données**
- [ ] Aucun « rien d'autre », aucun « vos données restent en Europe », aucun « sans aucune donnée sur vos enfants », aucun « rien ne quitte l'appareil ».
- [ ] Si le compagnon est mentionné : conversations 30 jours, message transmis à un prestataire, activé par défaut, désactivable enfant par enfant, ce n'est pas une messagerie.
- [ ] La phrase est **identique** à ce que dit la politique de confidentialité.

**Le visuel**
- [ ] Aucun texte blanc sur `#4EB6FF` ni sur `#2BC98A`. Le texte sur aplat est marine `#1A1D2E`.
- [ ] Pour écrire, ce sont les encres (`#0065AC`, `#4548FF`, `#1A7A54`, `#956300`, `#CC0037`), jamais les couleurs vives.
- [ ] Un seul registre d'âge. Aucune tranche qui enjambe 13 ans.
- [ ] Icône **ET** texte : aucun sens codé par la seule couleur ni la seule icône.
- [ ] Aucune marque tierce, aucun 119, aucun sujet grave, aucune mission déjà validée côté enfant, aucun solde en minutes pour un moins de 13 ans.
- [ ] La mascotte n'est ni un avatar, ni nourrie, ni sur un fond bleu de marque, ni accompagnée d'un second personnage. Aucune animation autre que `celebrate`.
- [ ] Le visuel conviendrait à un classement 4+ et n'est pas conçu pour amuser un enfant.

**Le cadre**
- [ ] Aucun appel au téléchargement, aucun lien de boutique, aucune date — tant que le § 9.3 n'est pas tranché.
- [ ] Aucune adresse ni URL minoapp.fr — tant que le § 13.2 n'est pas tranché.
- [ ] Aucun compte ouvert au nom de Mino tant que le § 13.1 (marque) n'est pas tranché.
- [ ] Si CM2C est mentionné : adhésion confirmée, pas d'adresse postale, réclamation écrite préalable rappelée.
- [ ] Aucune affirmation reprise d'un fichier `docs/` sans recoupement avec le code.
- [ ] Aucune comparaison nommant un concurrent, aucune promesse de résultat.

**La dernière question, la plus utile :**
- [ ] **Cette phrase serait-elle encore vraie si un examinateur d'Apple ouvrait l'application aujourd'hui, et si un parent la citait dans un an ?**

---

## 13. CE QUI RESTE À VÉRIFIER PAR JULIE

**Rien de ce qui suit ne se publie avant sa réponse écrite.** Ce sont les points dont l'exactitude ne dépend pas du code, mais d'elle.

### 13.1 La marque « Mino » — À TRANCHER AVANT D'OUVRIR LE MOINDRE COMPTE

La marque **n'est pas déposée à l'INPI** et **aucune recherche d'antériorité n'a été faite**. La case correspondante est encore décochée (`docs/ops/propriete-et-acces.md:76-81`, classes **9** logiciels et **42** services informatiques). Le dépôt écrit :
> « Faire une recherche d'antériorité d'abord : "Mino" est un mot court et courant, et le risque qu'il soit déjà pris dans ces classes est réel. **À faire avant la communication publique, pas après — déposer une marque qu'on utilise déjà et qui appartient à un autre est la pire séquence.** »

**Ouvrir des comptes sociaux au nom de Mino EST le début de cette communication publique.** Le nom réservé sur les boutiques, « Mino : une mission à la fois » (31/08/2026), est une réservation de nom de fiche : **cela ne vaut pas dépôt de marque.**

**Question à Julie :** la recherche d'antériorité a-t-elle été faite, et le dépôt est-il engagé ?

### 13.2 Le domaine minoapp.fr et les adresses e-mail

Le dépôt **ne dit nulle part** que le domaine est enregistré ni que les boîtes sont ouvertes, et il dit plutôt l'inverse. `docs/ops/avant-de-lancer.md:90-93`, section **« Ce qui reste à faire, et qui ne peut pas attendre »** :
> « enregistrer minoapp.fr au nom d'Agence Wheb, puis y ouvrir contact@ et privacy@. **Tant que le domaine n'est pas à vous, les documents légaux promettent une adresse qui n'existe pas.** »

Les deux cases correspondantes de `docs/ops/propriete-et-acces.md:107-108` (« Registrar (domaine) → minoapp.fr », « Boîte e-mail → contact@, privacy@ ») sont **vides**.

*Une bio de réseau social qui affiche une adresse morte est exactement le défaut déjà corrigé une fois dans ce dépôt (commit 8052476, « Une adresse d'expéditeur inventée, qui n'existait nulle part ailleurs »).*

**Questions à Julie :** le domaine est-il enregistré au nom d'Agence Wheb ? contact@ et privacy@ sont-elles ouvertes et relevées ? **Aucune URL, aucune adresse dans une bio, un lien ou un visuel avant sa réponse.**

### 13.3 Le copyright et l'URL de la politique de confidentialité

**https://minoapp.fr**, **https://minoapp.fr/confidentialite.html** et le copyright **« 2026 Agence Wheb »** ne sont **tenus par aucun code** : ils ne viennent que de `docs/ops/fiche-app-store.md:183-186`, un fichier de `docs/`. **À faire confirmer.**

### 13.4 Le statut de publication sur les boutiques, et l'habilitation Apple

Le dépôt se contredit (§ 9.3). **Question à Julie, par écrit :**
- Mino est-il en ligne sur l'App Store et sur Google Play aujourd'hui ?
- **L'habilitation Apple Family Controls de DISTRIBUTION est-elle obtenue**, pour l'application **et** pour l'extension MinoShieldMonitor ?
- Le module natif de blocage est-il dans le binaire **soumis** ?

**Tant que ces trois réponses ne sont pas « oui » : aucun lien de boutique, aucune date, et aucun verbe de blocage.**

### 13.5 L'adhésion à CM2C

Elle figurait encore parmi les tâches **non faites** au 9 septembre 2026, alors que les CGV nomment CM2C comme *« le médiateur de la consommation dont nous relevons »* — ce qui suppose une adhésion payée et en cours. **Vérifier avant toute mention publique.**

### 13.6 L'offre d'introduction dans les boutiques

L'affichage « 0 € pendant 30 jours » est **inconditionnel** dans l'application. **Question à Julie : l'offre « Gratuit · 1 mois » est-elle bien configurée dans App Store Connect ET dans Play Console, sur les deux formules ?** Sans elle, la boutique prélève le plein tarif sous une promesse de gratuité affichée juste au-dessus du bouton — **c'est déjà arrivé sur Google Play**, et c'est le motif 3.1.2, celui qui a fait refuser la 1.0. **À vérifier avant toute campagne prix.**

### 13.7 Ce que le dépôt ne couvre PAS — à trancher ailleurs

**ABSENT DU DÉPÔT : aucune règle écrite sur les comparaisons nommant un concurrent, ni sur les promesses de résultat.** Le dépôt ne mentionne aucun concurrent par son nom dans un contexte publicitaire et ne contient aucun garde-fou sur ce point.
*(Les seuls voisins du sujet : l'interdiction des marques tierces dans les captures ; une observation d'usage sur « une app concurrente » dans un message de commit technique ; et la mention de Temps d'écran / Family Link dans le guide, qui est **une aide au parent, pas une comparaison**.)*

**Ne pas présenter d'éventuelle règle comme une règle Mino existante.** En l'absence de règle, la prudence commande :
- **aucune comparaison nommant un concurrent** sans arbitrage préalable de Julie ;
- **aucune promesse de résultat** (« votre enfant fera ses devoirs », « moins de disputes en deux semaines ») — Mino ne promet nulle part un résultat éducatif, et ses propres CGV disent qu'*« il ne se substitue ni à l'autorité parentale, ni à un accompagnement éducatif ou médical »*.

### 13.8 Les arbitrages internes en suspens

| Sujet | État | En attendant |
|---|---|---|
| **4 ans / 5 ans** à la borne basse | Le code accepte 4, la communication dit 5 | **S'en tenir à 5-17** |
| **200 % / 160 %** sur l'agrandissement du texte | Les deux valeurs coexistent dans le dépôt | Écrire « **les libellés survivent à un texte agrandi** » |
| **Hébergement UE** | La politique dit « nous privilégions », l'hébergeur déclaré dit « région européenne » | Reprendre **les mots de la politique** (§ 8.8) |
| **Relecture des documents contractuels par un avocat** | Non faite, signalée dans les deux fichiers | Ne pas s'appuyer sur ces textes comme s'ils étaient validés (§ 8.5) |

### 13.9 Les corrections à demander à l'équipe technique (indépendamment de toute publication)

1. **`src/content/guide.ts:237`** — réécrire la phrase sur les appels d'urgence, **et ajouter `src/content/guide.ts` à la liste `DOCUMENTS`** de `__tests__/vocabulaireDesDocuments.test.ts` (ligne 21). Le motif `/ne les laissent bloquer par une application/` (ligne 81) **attraperait déjà la phrase** si le fichier figurait dans la liste. **Deux gestes.**
2. **`src/content/faq.ts`** — cinq entrées à corriger : **192** et **611** (applications installées, deux formulations distinctes), **608-612** (« Rien d'autre »), **644** (transferts hors UE), **679** (« sans aucune donnée sur vos enfants »), **294** (libellé « Demander avant chaque session », qui n'existe pas à l'écran).
3. **`docs/marketing/parrainage.md`** — trois occurrences de l'ancien prix (**lignes 37, 41, 88**) et le message type périmé (**lignes 101-102**), qui contredit le tableau du même fichier dix lignes plus haut.
4. **`CLAUDE.md:63`** — « Un prénom et un âge, rien de plus » : omet l'avatar et reproduit une tournure que le même document interdit.

---

### RAPPEL FINAL

> Les trois sur-affirmations déjà payées par ce projet **n'ont pas été inventées : elles ont été recopiées.** Deux venaient d'un document interne périmé, une d'une connaissance générale des plateformes. **Aucune n'avait été relue contre le code.**
>
> **Ce qui n'est pas dans ce brief n'entre pas dans un post. Ce qui y est marqué INCERTAIN se demande à Julie avant, pas après.**