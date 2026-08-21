# Tenir 10 000 familles

Ce document répond à une question précise : ce qui est construit tient-il
10 000 familles payantes ? La réponse courte est **oui, et le coût
d'infrastructure reste marginal devant le chiffre d'affaires** — mais quatre
choses ne tenaient pas et ont été corrigées.

Les durées et les volumes du §3 sont **mesurés** : `npm run test:charge` monte
un PostgreSQL, y applique le schéma réel, y écrit une année d'usage pour
10 000 familles et chronomètre les requêtes de l'application sous RLS. Les prix
Supabase et Stripe, eux, restent des **ordres de grandeur à revérifier sur les
pages tarifaires avant tout engagement.**

---

## 1. L'hypothèse de charge

| | |
|---|---|
| Familles | 10 000 |
| Enfants par famille | 2 |
| Appareils connectés par famille | 2,2 (téléphone parent + tablette/téléphone enfant) |
| Missions validées par enfant et par jour | 3 |
| Sessions de temps d'écran par enfant et par jour | 1,5 |
| Ouvertures de l'application par appareil et par jour | 3 |

Soit, pour la plateforme entière : **60 000 missions validées par jour**,
30 000 sessions, 66 000 ouvertures d'application.

C'est une charge modeste en absolu. Ce qui compte n'est pas le volume, c'est la
façon dont il est demandé.

---

## 2. Ce qui ne tenait pas

### 2.1 Le temps réel

Le code écoutait les changements ainsi :

```ts
.on('postgres_changes', { event: '*', schema: 'public' }, …)
```

Ce mécanisme fait vérifier **chaque écriture de la base contre chaque client
connecté**, un par un, dans un processus unique. Le coût est le produit des
deux termes.

À 100 familles : 600 écritures/jour × 40 connexions, invisible.
À 10 000 familles : 90 000 écritures/jour × ~3 000 connexions simultanées en
pointe, soit **270 millions d'évaluations d'autorisation par jour**, dans un
seul processus. Ce n'est pas un serveur qui ralentit, c'est un serveur qui
décroche — et il décroche bien avant 10 000, quelque part dans les premiers
milliers de connexions.

**Corrigé** : la base émet désormais sur un canal privé par famille
(`famille:<id>`), via un déclencheur. Un message ne traverse que les appareils
de cette famille-là. Le coût cesse d'être un produit : il devient linéaire, et
une famille de plus n'ajoute rien aux autres.

Le message ne transporte pas la ligne modifiée, seulement le nom de la table.
Rien de sensible ne circule sur le canal, et une validation coûte quelques
dizaines d'octets au lieu d'une ligne complète multipliée par les appareils.

Qui a le droit d'écouter est décidé par la base (politique RLS sur
`realtime.messages`), pas par l'application — même fonction
`auth_family_ids_array()` que tout le reste. Une famille ne peut pas s'abonner au canal d'une autre, même
en devinant son identifiant.

> Au passage : `subscribe()` n'était **appelé nulle part**. Le temps réel était
> du code mort — la tablette de l'enfant ne se mettait pas à jour toute seule.
> C'est branché maintenant (`watch()` dans le store).

### 2.2 L'historique téléchargé en entier

`load()` faisait `select *` sur le grand livre, sans borne. Pour une famille
de trois ans d'ancienneté, cela représente :

| Table | Lignes par famille et par an |
|---|---|
| `mission_completions` | ~2 200 |
| `screen_time_transactions` | ~3 300 |
| `screen_time_sessions` | ~1 100 |

Soit **~6 600 lignes par an**, ~20 000 après trois ans, rapatriées **à chaque
ouverture de l'application et à chaque changement**.

À 66 000 ouvertures par jour, cela ferait environ **5,4 To de trafic sortant
par mois** en troisième année — quelques centaines d'euros mensuels, et surtout
une application qui met plusieurs secondes à s'ouvrir chez les familles les plus
fidèles. La punition frappe exactement les meilleurs clients.

**Corrigé** : l'appareil ne charge que 120 jours, plafonnés à 400 lignes par
table — soit **~150 à 400 Ko par ouverture**, stable, quelle que soit
l'ancienneté de la famille. Environ **360 Go/mois** pour toute la plateforme.

Deux précautions, parce qu'une troncature naïve casserait le produit :

1. **Rien de ce qui attend quelqu'un n'est tronqué.** Une mission terminée il y
   a quatre mois et jamais relue arrive quand même, ainsi que toute session en
   cours ou demandée. Sinon une demande sans réponse disparaîtrait de l'écran du
   parent sans avoir jamais été traitée.

2. **Le solde reste exact.** La règle du projet — le solde est une somme de
   transactions, jamais un compteur que l'on modifie — n'est pas entamée. Le
   serveur renvoie le vrai total (`family_balances()`), et la différence avec ce
   que l'appareil détient devient **une seule ligne d'ouverture** datée juste
   avant la fenêtre. Après reconstitution,
   `balanceOf(lignes, enfant) === vrai solde`, quoi qu'il ait été tronqué.
   Six tests le garantissent (`__tests__/history.test.ts`).

### 2.3 Les index

Les politiques RLS filtrent sur `family_id`. Les index existants portaient sur
`child_id`. Tant que les tables sont petites, personne ne le voit ; à quelques
millions de lignes, chaque ouverture devient un parcours de table complet.

Ajoutés : `(family_id, created_at desc)` sur les transactions,
`(family_id, completed_at desc)` sur les complétions, deux index sur les
sessions, un sur `mission_assignments (mission_id)`, un sur `referrals (code)`.

**Ils ne servaient à rien.** C'est le tir de charge qui l'a montré, et c'est
l'objet du point suivant. Deux d'entre eux — celui des écrans en cours, celui
des sessions — travaillaient bien ; les deux principaux, ceux du grand livre et
des missions faites, étaient contournés par la base à chaque requête.

### 2.4 La politique qui fermait l'index

Voici le mur, le vrai, et il n'était pas là où ce document le disait.

Une politique écrite ainsi :

```sql
using (family_id in (select auth_family_ids()))
```

**est juste** — aucune famille n'a jamais pu voir une autre, les 96
vérifications de `npm run test:sql` le tiennent ligne à ligne. Mais
PostgreSQL n'en fait pas une condition d'index : il en fait un *hashed SubPlan*,
c'est-à-dire un filtre appliqué **après** avoir lu la ligne. La colonne de tête
de `idx_transactions_family` reste inutilisée, et chaque ouverture de
l'application lit le grand livre de **toutes** les familles pour n'en garder
qu'une.

Mesuré à 1 000 familles, sur la seule requête du grand livre :

| | durée | blocs lus |
|---|---|---|
| `in (select …)` | **275 ms** | 1 095 137 |
| `= any (tableau)` | **0,48 ms** | 1 330 |

Le plan le dit sans ambiguïté — `Rows Removed by Filter: 1 082 916`, pour
n'en rendre que 400.

**Corrigé** : les politiques passent par `auth_family_ids_array()`, qui rend un
`text[]`, appelée en `(select …)` pour n'être évaluée qu'une fois par requête.
La forme `family_id = any (…)` est, elle, utilisable comme condition d'index.
Même frontière, autre chemin : `supabase/test/rls.sql` vérifie la frontière,
`supabase/test/plans.sql` vérifie le chemin — il exige que `family_id`
apparaisse dans la condition d'index, et **tombe** si quelqu'un récrit une
politique sous l'ancienne forme.

`mission_assignments`, seule table sans `family_id`, passait par un `exists`
corrélé sur `children` : même problème, même remède avec
`auth_child_ids_array()`, plus un index non partiel sur `child_id`.

Deux index manquaient encore, pour une raison voisine : **un index partiel ne
sert que les requêtes qui répètent sa condition.** `idx_missions_family` est
posé `where archived = false`, alors que l'application demande toutes les
missions de sa famille — elle parcourait donc les cinquante mille missions de
la plateforme, 6 ms par ouverture. Et `parents` n'avait aucun index sur
`family_id`. Corrigés tous les deux, et gardés par le même test.

> Ce défaut n'était visible ni à la lecture, ni aux tests, ni à l'usage à trois
> familles. Il ne se voyait qu'en remplissant une base et en la chronométrant.

### 2.5 Deux tables qui ne faisaient que grossir

- `join_attempts` : gardée une heure par `join_family`, conservée pour toujours.
  Purge à 24 h (`purge_join_attempts()`).
- **Les comptes anonymes orphelins** : chaque appareil enfant qui se rattache
  crée un utilisateur anonyme. Une réinstallation en crée un second et le
  premier reste — sans famille, sans usage, mais **compté et facturé comme
  utilisateur actif**. À 10 000 familles, quelques milliers de comptes fantômes
  par an. `purge_orphan_devices()` supprime ceux qui ont plus de trente jours et
  n'ont jamais rejoint de famille.

Les deux se planifient avec `pg_cron` ; les lignes sont prêtes, en commentaire,
dans `scale.sql` (à activer une seule fois, sinon elles s'exécutent deux fois).

---

## 3. Ce que ça donne, mesuré

`npm run test:charge` monte un PostgreSQL jetable, y applique les six fichiers
SQL du projet dans l'ordre de `db:push`, y écrit l'hypothèse du §1 — une année
d'usage pour 10 000 familles, plus quelques familles de trois ans d'ancienneté
— puis rejoue vingt-cinq fois chacune des requêtes de `load()`, **sous le rôle
`authenticated`, RLS active**. Les requêtes ne sont pas des imitations : elles
sont recopiées de `src/data/supabaseRepository.ts`.

Réglage du serveur, imprimé avec les résultats parce qu'une mesure sans son
réglage ne veut rien dire : `shared_buffers=2GB`, `effective_cache_size=6GB`,
`work_mem=16MB`, `random_page_cost=1.1`. Ordre de grandeur d'une petite
instance Supabase.

### 3.1 Ce que pèse la base

10 000 familles, un an d'usage : **66,1 millions de lignes de journal, 20 Go**
index compris.

| Table | Lignes | Données | Index | Total |
|---|---|---|---|---|
| `screen_time_transactions` | 33,0 M | 4 377 Mo | 5 065 Mo | **9 443 Mo** |
| `mission_completions` | 22,1 M | 4 201 Mo | 4 340 Mo | **8 542 Mo** |
| `screen_time_sessions` | 11,0 M | 1 573 Mo | 910 Mo | **2 483 Mo** |
| tout le reste | 0,23 M | 26 Mo | 28 Mo | **54 Mo** |

Soit **~2 Mo par famille et par an**, index compris. Le document annonçait
26 Go par an ; c'est 20. Les index pèsent autant que les données — c'est le prix
du §2.4, et il est bien payé.

### 3.2 Ce que coûte une ouverture d'application

La famille observée est la plus lourde du parc : **trois ans d'ancienneté**,
9 855 lignes de grand livre.

| | Requête | p50 | p95 |
|---|---|---|---|
| 1 | la famille | 0,12 ms | 0,29 ms |
| 2 | les parents | 0,11 ms | 0,30 ms |
| 3 | les enfants | 0,11 ms | 0,30 ms |
| 4 | les missions | 0,13 ms | 0,33 ms |
| 5 | les affectations | 0,19 ms | 0,45 ms |
| 6 | les autres écrans | 0,11 ms | 0,29 ms |
| 7 | missions faites (120 j, 400 max) | 0,52 ms | 0,76 ms |
| 8 | ce qui attend le parent | 0,93 ms | 1,42 ms |
| 9 | grand livre (120 j, 400 max) | 0,81 ms | 0,99 ms |
| 10 | sessions (120 j, 400 max) | 0,48 ms | 0,61 ms |
| 11 | écrans en cours | 0,17 ms | 0,31 ms |
| 12 | **solde exact** (tout le grand livre) | **9,38 ms** | 11,73 ms |
| 13 | accorder un bonus (écriture + canal) | 1,31 ms | 1,66 ms |

**Une ouverture complète : 13,1 ms de travail de base de données**, 9,6 ms
d'attente si les deux lots partent en parallèle — ce que fait l'application.

Trois choses à retenir de ce tableau.

**La taille de la plateforme n'entre plus en ligne de compte.** La requête du
grand livre lit 1 345 blocs à 10 000 familles ; elle en lisait 1 330 à 1 000.
La base ne touche plus que les lignes de la famille qui demande, et le nombre
des autres ne se voit plus nulle part.

**Le solde est désormais le poste principal — les trois quarts du total.** Il
somme les 9 855 lignes du grand livre de la famille, et c'est la seule requête
dont le coût grandit avec l'ancienneté. Un index couvrant
(`family_id, child_id` incluant `delta`) le rendrait quasi gratuit, au prix
d'environ 1,3 Go sur la plus grosse table. **Non fait, délibérément** : 9 ms sur
une ouverture qui coûtera de toute façon des centaines de millisecondes de
réseau ne valent pas 13 % de stockage en plus. À reprendre si un jour les
familles de cinq ans sont nombreuses.

**Une écriture reste une écriture.** Accorder un bonus coûte 1,31 ms,
déclencheur compris, et émet **exactement un** message sur le canal de la
famille — vérifié, pas supposé : 25 écritures, 25 messages.

### 3.3 Et sans les index

La même chose, les quatre index de journal de `scale.sql` retirés :

| Requête | avec | sans |
|---|---|---|
| grand livre (120 j) | 0,81 ms | **4 901 ms** |
| sessions (120 j) | 0,48 ms | 1 697 ms |
| écrans en cours | 0,17 ms | 1 680 ms |
| solde exact | 9,38 ms | 2 569 ms |
| **ouverture complète** | **13,1 ms** | **10 851 ms** |

Onze secondes. C'est ce que serait devenue l'ouverture de l'application à
10 000 familles, et c'est la mesure qui rend le §2.4 lisible : **avant sa
correction, ces index étaient là et ne changeaient rien** — les retirer à
1 000 familles ne coûtait rien du tout, puisque la base ne s'en servait déjà
pas. Un index qui ne sert pas ressemble beaucoup à un index qui sert.

### 3.4 Ce que coûte une reprise de données

Utile le jour d'une migration : écrire les 66 millions de lignes prend **17
minutes**, reconstruire les index **2 min 15**, l'analyse **20 s**. Une
restauration de sauvegarde à 10 000 familles se compte donc en dizaines de
minutes, pas en heures.

---

## 4. Ce que ça coûte à 10 000 familles

### Base de données

**20 Go par an**, mesurés (§3.1) et non plus estimés — le calcul disait 26.
Après trois ans, ~60 Go. C'est le poste qui grossit, et il reste petit : chez
Supabase, le stockage au-delà du quota inclus se facture aux alentours de
0,10–0,15 €/Go/mois, soit **moins de dix euros par mois en troisième année**.

### Trafic sortant

~360 Go/mois après correction. Le quota inclus de l'offre Pro en couvre une
bonne partie ; le dépassement est de l'ordre de **10 à 20 €/mois**.

*Sans la correction 2.2, ce même poste dépassait 400 €/mois en troisième
année.*

### Utilisateurs actifs

10 000 parents + ~12 000 appareils enfants = **~22 000 utilisateurs actifs
mensuels**, largement dans le quota inclus de l'offre Pro.

### Connexions temps réel simultanées

**C'est le poste à surveiller, et le seul qui puisse imposer un changement
d'offre.** En pointe (18 h – 20 h), tabler sur 10 à 15 % du parc connecté :
**2 000 à 3 000 connexions simultanées**. Le quota inclus dans l'offre Pro est
inférieur ; il faudra soit le complément payant, soit l'offre supérieure.
À vérifier au moment venu — c'est la ligne de facture qui bougera le plus.

### Stripe

1,5 % + 0,25 € par transaction européenne. À 9,90 €/mois, cela fait **~0,40 €
par paiement**, soit ~4 % du chiffre d'affaires. C'est le premier poste de coût,
très loin devant l'infrastructure.

### Ordre de grandeur, tout compris

| Poste | Par mois à 10 000 familles |
|---|---|
| Supabase (offre + dépassements + temps réel) | 150 – 400 € |
| Stripe | ~4 000 € |
| **Total** | **~4 500 €** |
| Chiffre d'affaires correspondant | ~99 000 € |

**L'infrastructure représente moins de 0,5 % du chiffre d'affaires.** Elle
n'est pas le sujet. Le sujet, ce sont les frais de paiement et le SAV — d'où le
reste de ce dossier.

---

## 5. Ce qui reste à faire avant d'y arriver

Rien de bloquant, mais quatre points à traiter dans l'ordre :

1. **Appliquer les six fichiers SQL** sur le projet Supabase
   (`SUPABASE_DB_URL=… npm run db:push`), et activer `pg_cron` pour les deux
   purges. Sans cela, les corrections ci-dessus n'existent que dans le dépôt —
   et celle du §2.4 touche les politiques elles-mêmes, pas seulement les index :
   tant qu'elle n'est pas appliquée, c'est l'ancienne forme qui tourne.
2. **Point de bascule ~1 000 familles** : activer les sauvegardes quotidiennes
   avec restauration à l'instant (PITR), et les alertes de dépassement de quota.
   Une base sans sauvegarde à 1 000 familles est un risque d'entreprise, pas un
   risque technique.
3. **Point de bascule ~3 000 familles** : mesurer les connexions temps réel
   réelles en pointe et arbitrer l'offre. C'est là que la facture change de
   forme.
4. **Une seule région.** Le projet Supabase doit être en Europe (Francfort ou
   Paris) — pour la latence, et parce que les données de familles françaises
   n'ont pas à quitter l'UE. À vérifier : c'est un choix qui se fait à la
   création du projet et **ne se change pas ensuite**.

---

## 6. Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié** : la borne d'historique et la reconstitution du solde sont couvertes
par des tests automatisés ; l'ensemble compile et les tests passent. Le schéma
entier s'applique et se réapplique sur un PostgreSQL nu, et les 96
vérifications de `npm run test:sql` tiennent la frontière entre familles ainsi
que le chemin d'accès (`plans.sql`).

**Mesuré** : §3, sur une base réellement remplie. C'est ce qui a mis au jour le
défaut du §2.4, qu'aucune relecture n'avait vu.

**Non vérifié faute de projet Supabase actif** : le canal temps réel a été
éprouvé sur un remplaçant fidèle en forme (`supabase/test/realtime.sql`, RLS
comprise), pas sur Supabase Realtime lui-même. **Il faut appliquer `scale.sql`
sur un projet de test et vérifier qu'un message arrive bien d'un appareil à
l'autre** avant de considérer le point 2.1 comme clos. À vérifier au même
moment : la rétention de `realtime.messages`, où le déclencheur écrit une ligne
par écriture — 90 000 par jour à 10 000 familles.

**Ce que le tir de charge ne dit pas** : il mesure une base, pas une
plateforme. Le nombre de connexions temps réel simultanées, la latence réseau,
le comportement de PostgREST et la mémoire réelle de l'offre Supabase choisie
restent hors de sa portée. Les durées du §3 sont donc un plancher — la part
« base de données » de ce que ressentira une famille, pas le tout.
