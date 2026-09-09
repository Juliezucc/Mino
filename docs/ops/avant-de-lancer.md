# Avant de lancer

Ce document répond à une question précise, posée par quelqu'un qui sera seule à
tenir le produit :

> « Je ne veux pas changer en cours de route. Si un bug impacte des milliers de
> familles et que je suis seule à gérer, c'est compliqué. »

Il ne liste donc pas les bonnes pratiques. Il liste **ce qui ne se rattrape
pas** — et, tout aussi utile, ce qui a l'air irrattrapable et ne l'est pas.

Méthode : six lectures indépendantes du dépôt sous six angles différents
(l'irréversible, la panne nocturne, les obligations d'une personne seule, ce
qui manque, le verrouillage chez Supabase, les magasins), puis deux critiques
chargées de démolir le résultat — l'une sur la complétude, l'autre sur le
réalisme pour une personne seule. Chaque point cite un fichier.

---

## 0. La décision qui commande toutes les autres

**Lance-t-on en « minuteur seul », ou attend-on le module natif ?**

Aujourd'hui, `getScreenTimeService()` rend `LocalTimerScreenTimeService` :
Mino **compte** le temps, il ne le **bloque** pas. Le module natif iOS
(Family Controls) et son équivalent Android ne sont pas écrits, et personne ne
les a chiffrés — ni ce document jusqu'ici, ni le plan de lancement.

Cette décision commande tout le reste :

| | Minuteur seul | Blocage natif |
|---|---|---|
| Délai | maintenant | plusieurs semaines de Swift/Kotlin, plus l'autorisation d'Apple |
| Promesse | « Mino compte, le contrôle parental du système applique » | « Mino bloque » |
| Textes | FAQ et fiche à réécrire | tels quels |
| Risque | aucun risque externe | Apple peut refuser l'autorisation, et un refus ne se corrige pas par du code |

Il y a une incohérence à lever d'abord, quel que soit le choix : la FAQ livrée
dans l'application (`src/content/faq.ts`) décrit le blocage comme opérationnel
et renvoie à un écran « Applications concernées » qui n'existe pas, tandis que
`app/parent/blocage.tsx` affiche honnêtement « Pas encore disponible ». Un
examinateur d'Apple qui suit la FAQ et ne trouve pas l'écran, c'est un refus.

`docs/marketing/lancement.md` pose par ailleurs une bêta fermée dont le critère
de passage est « 70 % arrivent au blocage actif » — inatteignable en minuteur
seul. Les deux documents doivent dire la même chose.

---

## 1. Deux horloges à lancer cette semaine

Elles ne dépendent pas de vous, et rien ne les accélère. Tout le reste peut
attendre ; celles-ci, non.

**Les comptes et la banque.** Chez Apple, aucun produit d'abonnement ne peut
être créé tant que le contrat « Paid Apps » n'est pas actif dans *Agreements,
Tax, and Banking* — ce qui suppose, pour un compte société, un numéro
**D-U-N-S** d'Agence Wheb, dont l'obtention se compte en jours ouvrés. Même
chose côté Google avec le profil de paiement. Le plan « créez les produits
d'abord » est donc inexécutable tant que ceci n'est pas fait.

**L'autorisation Family Controls**, si et seulement si la décision 0 va vers le
blocage natif. Apple l'accorde à sa discrétion, sur dossier
(`docs/apple-family-controls.md`). Un refus change la fiche, la promesse et le
prix — donc le produit de repli s'écrit **avant** de savoir, à froid.

> Ordre : la société et le bundle d'abord (une matinée), les comptes ensuite,
> le dossier Family Controls dans la foulée. Un dossier déposé depuis un compte
> individuel qu'on migrera ensuite est un dossier à refaire.

---

## 2. Ce qui ne se rattrape pas

Neuf points. Sept sont des décisions de quelques heures.

### 2.1 L'identifiant de bundle — tranché le 25/08/2026

**`fr.minoapp.mino`**, le reverse-DNS de `minoapp.fr`.

L'ancien `fr.mino.app` était le reverse-DNS de `app.mino.fr`, un domaine que
rien ne revendiquait. Et `mino.app` — que la politique de confidentialité et
les CGV donnaient comme adresse de contact — **appartient à quelqu'un
d'autre** : ces adresses n'auraient jamais reçu un seul message, alors qu'elles
sont légalement obligatoires.

Tout pointe désormais vers `minoapp.fr` : l'identifiant, le groupe
d'applications (`group.fr.minoapp.mino`), et les deux adresses de contact.

> **Ce qui reste à faire, et qui ne peut pas attendre** : enregistrer
> `minoapp.fr` au nom d'Agence Wheb, puis y ouvrir `contact@` et `privacy@`.
> Tant que le domaine n'est pas à vous, les documents légaux promettent une
> adresse qui n'existe pas.

### 2.2 La région Supabase, et un domaine à vous devant

La région se choisit à la création et ne se change plus. `src/content/terms.ts`
promet déjà « région européenne » au consommateur : **eu-west-3 (Paris)**.

Plus important, et personne ne l'avait vu : **l'adresse du serveur est gravée
dans le binaire**. Babel remplace `EXPO_PUBLIC_SUPABASE_URL` à la compilation.
Le jour d'un déménagement, les applications déjà installées continueraient
d'appeler `https://xxxx.supabase.co` jusqu'à ce que chaque famille mette à
jour — c'est-à-dire jamais à 100 %.

**Le remède est une journée et il rend tout le reste réversible** : faire
pointer un domaine à vous (`api.mino.app`) vers Supabase — option domaine
personnalisé du plan Pro — et n'écrire que ce domaine dans les variables. Le
jour du départ, on repointe un DNS.

### 2.3 `expo-updates` dans la première build

`package.json` ne le contient pas, et `app.json` n'a aucune section `updates`.
Sans lui, corriger une ligne de JavaScript veut dire attendre la revue d'Apple.
**Absent de la première build, il ne protégera jamais la cohorte de lancement.**

### 2.4 L'interrupteur à distance

Aucun drapeau de fonctionnalité, aucune configuration lue à distance, aucune
version minimale, aucune bannière pilotée par le serveur. Recherche faite sur
tout le dépôt.

Une table `app_config` à une seule ligne, lue au démarrage, publique en
lecture, écrite par vous seule : couper le compagnon, afficher un message,
imposer une version minimale. **Même raison que ci-dessus** : ajoutée après
coup, elle ne protège pas la cohorte qui compte.

C'est aussi votre **seul canal vers les familles** en cas d'incident : il n'y a
ni e-mail transactionnel branché, ni notification à distance, ni page d'état.

### 2.5 Les identifiants de produits d'abonnement

Un identifiant de produit ne se supprime ni ne se renomme jamais dans un compte
Apple. Et `supabase/functions/_shared/store.ts` rend `null` — donc un abonné
sans formule — si l'identifiant ne contient pas `monthly`/`yearly`. À relire
caractère par caractère, et à couvrir par un test.

### 2.6 Le comportement fiscal des prix Stripe

`tax_behavior` est **immuable** sur un Price Stripe. Créé en `exclusive`, un
parent français paierait 9,90 € + TVA = 11,88 € — c'est-à-dire autre chose que
le prix publié partout. À créer en `inclusive`.

### 2.7 Qui déclare la TVA, et où

Deux rails, deux régimes, et rien nulle part dans le dépôt :

- **Apple et Google** collectent et reversent la TVA à votre place, mais vous
  devez déclarer les commissions reçues (services intra-UE).
- **Stripe** : Agence Wheb est vendeur d'un service électronique à des
  consommateurs de l'UE — au-delà de 10 000 € de ventes transfrontalières, le
  guichet unique **OSS** devient obligatoire.

Une demi-journée avec un expert-comptable **avant le premier euro encaissé**.
Une TVA collectée sans immatriculation ne se régularise pas proprement.

### 2.8 La clé de signature Android

Le seul endroit du projet où une perte est définitive au sens strict : une
application Android signée avec une clé perdue ne peut plus être mise à jour,
jamais. Activer **Play App Signing** à la création (Google détient alors la
clé), et ranger le keystore de dépôt hors de la machine.

### 2.9 Le consentement parental, horodaté

`app/onboarding/account.tsx` demande un prénom, un e-mail, un mot de passe et
un code — et rien d'autre. Aucune case d'acceptation, aucun lien vers les CGV
ni la politique de confidentialité, aucun horodatage. Or le dossier Family
Controls affirme que le parent « déclare être titulaire de l'autorité
parentale ».

Un consentement qu'on n'a pas recueilli au moment du compte ne se recueille
jamais rétroactivement. Une case, deux liens, une colonne d'horodatage.

### 2.10 Le mois et l'année de naissance, pas un âge

`supabase/schema.sql` stocke `age int`, et **rien ne l'incrémente**. Personne
ne vieillit. Un enfant inscrit à 12 ans en aura 12 pour toujours — alors que la
bascule minos → minutes à 13 ans est une règle du produit, et que l'âge
conditionne ce que l'application montre.

Deux champs au lieu d'un. Une heure de travail, et une date de naissance ne se
demande pas rétroactivement à des milliers de familles.

---

## 3. Ce qui n'est PAS irréversible

Autant de temps gagné. Les critiques ont démoli ces points-là :

- **Le prix.** Ce qui est définitif chez Apple, c'est l'identifiant de produit,
  pas le montant. Un prix se change, et l'éditeur choisit si les abonnés
  existants le conservent.
- **Le projet EAS.** `eas init` se relance, un projet se transfère à un compte
  organisation. À faire avec la première build, pas avant.
- **Le début d'essai.** `families.created_at` existe : un `insert … select`
  rattrape tout l'historique en une requête.
- **Les identifiants texte au lieu d'`uuid`.** Cohérent avec l'écriture hors
  ligne, rien à réaligner. Ne pas y toucher.
- **Héberger PostgreSQL soi-même** pour échapper à Supabase : 55–105 €/mois à
  10 000 familles contre ~4 000 € de frais de paiement. Ce n'est pas une
  économie, c'est une astreinte permanente pour une personne seule.
- **Un plan de déménagement complet.** Inutile : trois gestes (le domaine, les
  coutures, le SQL standard) suffisent à le garder possible. Le SQL du projet
  est du PostgreSQL standard, et `supabase/test/harness.sql` le prouve en
  90 lignes — il rejoue tout le schéma sur un PostgreSQL nu.

---

## 4. Ce qui a été corrigé en écrivant ce document

Quatre défauts, tous reproduits par un test avant d'être corrigés, tous
invisibles jusqu'ici parce qu'ils n'apparaissent **qu'une fois Supabase
branché** :

1. **Sans réseau, Mino ne s'ouvrait pas.** `bootstrap()` appelait `load()` sans
   filet : l'écran de démarrage restait, pour toujours et sans un mot.
2. **Une écriture refusée faisait quand même monter le compteur**, puis les
   minutes disparaissaient à la lecture suivante.
3. **Et ne disait rien** : `lastError` restait nul.
4. **Un solde qu'on n'a pas pu obtenir était traité comme un solde nul** —
   l'enfant se retrouvait avec ses trois derniers mois, ses minutes anciennes
   effacées de son compteur, sans une trace.

`__tests__/panne.test.ts` les tient désormais, et `app/hors-ligne.tsx` dit la
vérité au parent au lieu de lui proposer de créer le compte qu'il a déjà.

---

## 5. Avant la première vraie famille

Dans l'ordre du rapport qualité/prix.

| Quoi | Effort | État |
|---|---|---|
| Un fichier GitHub Actions : `typecheck`, `test`, `test:sql` à chaque poussée | 1 h | ✅ `.github/workflows/verifications.yml` |
| Tirer le code famille avec un vrai générateur cryptographique | 10 lignes | ✅ `expo-crypto`, tirage par rejet |
| Afficher `lastError` à l'écran | ½ j | ✅ `src/features/ErrorToast.tsx` |
| Réinitialisation du mot de passe : le lien ne revenait pas dans l'application, et personne n'y consommait le jeton | 1 j | ✅ `app/mot-de-passe.tsx` |
| « Supprimer mon compte » : promis dans la FAQ et la politique, exigé par Apple | 1–2 j | ✅ `delete_my_account()` + `app/parent/compte.tsx` |
| Écran Compte : changer l'e-mail, le mot de passe, le code parent, se déconnecter | 2–3 j | ✅ `app/parent/compte.tsx` |
| Régénérer le code famille, retirer un appareil appairé | 1 j | ❌ reste à faire |
| Une surveillance qui réveille (UptimeRobot ou équivalent) plutôt qu'un tableau de bord à consulter | 20 min | ❌ |
| Passer au plan Pro **et faire une restauration en vrai, une fois** | 1 j | ❌ |
| Un SMTP européen : le service intégré de Supabase est bridé et n'est pas fait pour la production | 1 j | ❌ bloque la confirmation d'e-mail |
| Le compagnon éteint par défaut, l'accord de traitement signé — ou la phrase retirée de la politique | 1–2 j | ❌ |
| La cinquième tâche de nuit : `purge_companion_messages()`, promise à 30 jours | ½ j | ❌ |
| Une boîte contact@ vraiment relevée | 1 h pour la bêta | ❌ |
| **Lever le `robots.txt` de `public/`** — il interdit toute indexation depuis la mise en ligne anticipée d'`app.minoapp.fr` | 2 min | ❌ **le jour du lancement** |
| Vérifier que la RLS est active sur **toutes** les tables : le bundle web publie l'URL du projet et la clé publiable, ce qui n'est sûr que si la base refuse ce qu'elle doit refuser | 10 min | ❌ avant le premier vrai paiement |
| Une RC professionnelle avec extension numérique, avant la bêta ouverte | quelques centaines d'euros/an | ❌ |

### Le tirage du code famille — corrigé

`src/domain/id.ts` tirait le code famille avec `Math.random()`. Son propre
commentaire disait : « ce code est la seule chose entre un inconnu et une
famille avec des enfants dedans ». `Math.random()` n'est pas fait pour ça — ce
n'est pas un générateur cryptographique, et sa graine est prévisible. Il tire
désormais avec `expo-crypto`, par rejet, pour que l'alphabet reste uniforme.

### Ce qu'il n'existe aucune procédure pour traiter

Le tri de sécurité du compagnon écrit `safety = 'alert'` en base quand un
enfant confie quelque chose de grave. **Le seul destinataire prévu est le
parent** — c'est-à-dire précisément la mauvaise personne quand le danger vient
de la maison.

Il faut une page écrite **à froid**, avant le lancement : dans quels cas vous
regardez (jamais par routine), ce que vous faites quand vous voyez (le 119),
et ce que vous ne faites jamais. Ce n'est pas du code, c'est une décision, et
on ne la prend pas le soir où ça arrive.

---

## 6. Le total honnête

- **Décisions** (§0, §2) : une semaine et demie, dont une matinée de choix purs.
- **Développement** (§5) : six à huit jours restants, sans le module natif —
  la moitié de la liste est faite depuis la rédaction de ce document.
- **Attente externe** : D-U-N-S, contrats Apple et Google, et la demande Family
  Controls si vous allez vers le blocage natif. Plusieurs semaines, sur
  lesquelles vous n'avez aucune prise — d'où l'urgence de les lancer.
- **Vos jours à vous** : expert-comptable, assurance, adhésion CM2C, registre
  des traitements. Deux à trois jours, non délégables.

**Le verdict.** Vous pouvez lancer sans vous piéger. Ce dépôt est très au-dessus
de la moyenne sur ce qui casse d'habitude : l'isolation entre familles est
prouvée par 113 vérifications, le registre est en ajout seul, la tenue en charge
est mesurée et non calculée, il n'y a aucun traceur.

Mais le vrai risque de votre situation n'est pas un bug qui touche des milliers
de familles. C'est que **rien ne vous prévienne**, et que **vous n'ayez aucun
moyen de répondre**. D'où les deux lignes à ne jamais sacrifier : l'interrupteur
à distance et `expo-updates` embarqués **avant la première build**, et une
alerte qui sonne au lieu d'un tableau de bord qu'on consulte.
