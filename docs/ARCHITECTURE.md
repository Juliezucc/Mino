# Architecture

Ce document existe pour une raison précise : qu'un développeur qui n'a jamais vu
Mino puisse être utile en une journée, et qu'il ne casse pas les trois ou quatre
choses qui ne doivent pas être cassées.

---

## Les six règles

Elles ne sont pas des préférences de style. Chacune protège quelque chose, et
chacune est vérifiée par des tests.

### 1. Le solde est une somme, jamais un compteur

`screen_time_transactions` est un journal en ajout seul. Le solde d'un enfant
est `sum(delta)`. On ne modifie ni ne supprime jamais une ligne : une erreur se
corrige en **ajoutant** une ligne opposée.

Pourquoi : un compteur modifiable et un historique finissent toujours par se
contredire, et le jour où cela arrive, c'est devant un enfant qui a perdu des
minutes qu'il avait gagnées. C'est la seule dispute que le produit ne peut pas se
permettre.

Deuxième corollaire : rien de ce qui relève de l'affichage ne s'écrit dans le
registre. La célébration d'un bonus, par exemple, ne pose pas de marque « déjà
fêté » sur la transaction — elle se souvient sur l'appareil (`data/seenBonus`),
parce que fêter est un événement d'écran et non un fait comptable.

Corollaire pratique : l'appareil ne télécharge que 120 jours d'historique, et le
reste est replié en **une ligne d'ouverture** calculée à partir du vrai total
renvoyé par le serveur. Après repliement, la somme des lignes détenues égale
toujours le vrai solde (`__tests__/history.test.ts`).

### 2. Le domaine est pur

`src/domain/` ne contient que des fonctions `(données, entrée) → nouvelles
données`. Aucun appel réseau, aucun accès au stockage, aucun composant. C'est ce
qui rend les règles testables sans lancer l'application — 210 tests en 3
secondes.

Le store appelle une fonction pure, persiste le résultat, publie le nouvel état.
Les écrans n'écrivent jamais eux-mêmes dans les données.

### 3. La sécurité est dans la base, pas dans l'application

Aucun écran ne filtre par famille pour des raisons de sécurité. C'est la
politique RLS qui refuse de renvoyer les lignes d'une autre famille — même à un
client modifié, même à quelqu'un qui connaîtrait un identifiant.

Deux niveaux : `auth_family_ids()` dit à quelle famille on appartient,
`auth_is_parent()` distingue le téléphone du parent de la tablette de l'enfant.
Un appareil enfant peut dire « j'ai terminé » et dépenser du temps ; il ne peut
ni confirmer une mission, ni ajouter des minutes. Ce n'est pas l'interface qui
l'empêche, c'est le `with check` de la politique.

Une seule exception, et elle est verrouillée de trois façons : sur une mission
que le parent a explicitement ouverte (`auto_approve`, une colonne qu'aucun
appareil enfant ne peut écrire), l'enfant peut inscrire sa propre complétion et
la transaction qui va avec — mais seulement pour cette mission-là, seulement
pour le montant exact qu'elle vaut, et seulement une fois par jour. La politique
lit ces trois faits dans des lignes que le client ne contrôle pas.

Le code parent, lui, n'est nulle part lisible : `parent_secrets` a RLS activé et
**aucune politique**, ce qui refuse toute lecture, y compris au parent. Seules
deux fonctions serveur y touchent.

### 4. Tout ce qui est extérieur passe par une couture

Sept services, chacun avec une implémentation locale et une réelle, choisies
dans un `index.ts`. La facturation en a deux réelles, et ce n'est pas un choix :
Apple et Google exigent leur propre système dès qu'un paiement débloque une
fonctionnalité dans l'application.

| Couture | Local | Réel |
|---|---|---|
| `services/auth` | mémoire + AsyncStorage | Supabase Auth |
| `services/billing` | simulation | Stripe sur le web, App Store / Play Store dans l'app |
| `services/screenTime` | minuteur | FamilyControls / UsageStats |
| `services/notifications` | rien | expo-notifications |
| `services/diagnostics` | file locale | table `support_reports` |
| `services/companion` | réponses écrites | Claude Haiku 4.5 (fonction serveur) |
| `services/speech` | rien | reconnaissance vocale du système, **sur l'appareil** |

Conséquence utile : l'application tourne entièrement sans backend, ce qui permet
de la faire essayer sans rien installer, et de tester le parcours complet sans
compte Stripe.

### 5. La pression tombe sur l'adulte, jamais sur l'enfant

Quand l'abonnement se termine, ce qui s'arrête est **la main du parent** :
confirmer, créer une mission, offrir des minutes, lancer un autre écran.
C'est-à-dire exactement ce pour quoi il paie.

Ce qui ne s'arrête jamais : les minutes déjà gagnées, que l'enfant continue de
dépenser, et sa capacité à déclarer ses missions — elles s'empilent en attente,
et le jour où le parent reprend, elles sont toutes là. Une mission qui se
comptait toute seule redevient simplement une mission ordinaire : l'enfant voit
« ton parent confirme », une phrase qu'il connaît déjà, pas une pancarte
d'abonnement. Un enfant n'a pas choisi le moyen de paiement de ses parents.

Le verrou ne se ferme que sur un **fait connu** : un abonnement inconnu — la
facturation n'a pas répondu, ou pas encore — laisse tout passer. Quelques jours
offerts par erreur coûtent moins qu'un parent qui paie et se retrouve dehors
parce que son train est passé sous un tunnel. Voir `domain/access`.

### 6. Le temps de l'enfant ne se voit pas en minutes

Jusqu'à 13 ans, l'unité affichée est le **mino** — une minute, toujours, jamais
achetable. Au-delà, ce sont des minutes. Tout passe par `formatTime(minutes,
unit)` et `registerOf(age)` : aucun écran ne décide seul de son vocabulaire.

---

## Les dossiers

```
app/                  écrans (expo-router : un fichier = une route)
  child/              l'espace enfant     — Missions | Temps | Profil
  parent/             l'espace parent     — Accueil | Missions | Enfants | Réglages
  guide/, legal/      guide et documents
src/
  domain/             les règles, pures et testées
  data/               repository : AsyncStorage ou Supabase
  services/           les cinq coutures ci-dessus
  store/              zustand : un seul état, un seul chemin d'écriture
  components/         interface (ui/, mascot/, icons/)
  content/            textes : guide, FAQ, CGV, confidentialité
  theme/              couleurs, espacements, typographie
supabase/
  schema.sql          tables, RLS, fonctions           ← appliquer en 1er
  scale.sql           index, temps réel, purges        ← puis celui-ci
  support.sql         signalements                     ← puis celui-ci
  analytics.sql       journal facturation et vues      ← puis celui-ci
  store.sql           achats App Store et Play Store   ← puis celui-ci
  companion.sql       budget et conversations de Mino  ← et enfin celui-ci
  test/               un PostgreSQL jetable qui attaque la RLS
  functions/          fonctions serveur (Deno) : billing, stripe-webhook,
                      store-purchase, store-notifications
docs/                 ce dossier
scripts/              génération : visuels, guide, FAQ, licences
__tests__/            210 tests
```

---

## Le chemin d'une confirmation, de bout en bout

C'est le parcours prioritaire du produit, et il traverse toutes les couches :

```
L'enfant appuie sur « J'AI TERMINÉ »
  → app/child/mission/[id].tsx appelle store.completeMission()
  → domain/actions.completeMission() renvoie de nouvelles données (pure)
  → store publie l'état, puis repository.persist()
  → RLS accepte : status 'pending', minutes_awarded 0 — le maximum
    qu'un appareil enfant ait le droit d'écrire
  → le déclencheur émet sur le canal privé « famille:<id> »

Le téléphone du parent reçoit le signal
  → recharge, affiche la demande
  → « C’EST FAIT · +15 MIN » → domain/actions.approveCompletion()
  → écrit DEUX lignes : la complétion approuvée ET la transaction +15
  → RLS n'accepte cette écriture que d'un parent (auth_is_parent())

La tablette de l'enfant reçoit le signal
  → le compteur passe de 35 à 50, la célébration se déclenche
```

Couvert de bout en bout par `__tests__/journey.test.ts`.

Une mission que le parent a ouverte (`auto_approve`) saute l'attente : la
complétion est écrite directement approuvée, avec la transaction, en une seule
opération. Ce raccourci est **le seul endroit où un appareil d'enfant écrit des
minutes**, et il tient à quatre garde-fous côté base, tous vérifiés par
`npm run test:sql` :

1. la mission doit porter `auto_approve` — colonne qu'aucun appareil ne peut
   écrire ;
2. le montant doit être exactement celui de la mission ;
3. une assignation active doit relier cette mission à cet enfant — sans quoi un
   enfant se compterait la mission de son frère ;
4. une complétion ne paie qu'une fois, et une mission ne se compte qu'une fois
   par jour (`uniq_reward_per_completion`, `uniq_completion_approved_per_day`).

---

## Ce qui n'est pas fait, et qu'il faut savoir avant de commencer

- **Le module natif de blocage n'existe pas encore.** `DeviceManagedScreenTime`
  appelle un contrat (`services/screenTime/native.ts`) qui n'a pas
  d'implémentation Swift ni Kotlin. Il faut Xcode, un appareil réel, et
  l'habilitation Apple. Voir `docs/apple-family-controls.md`.
- **Les fichiers SQL s'appliquent, mais sur un PostgreSQL nu.** `npm run
  test:sql` les joue tous les six dans l'ordre, sur une base jetable, et
  attaque la RLS depuis une session d'appareil — 86 vérifications, dont le
  budget du compagnon, le secret des conversations et le canal temps réel.
  Ce qui reste hors de portée : le **transport** temps réel de Supabase
  (`realtime.send` est ici une doublure qui écrit dans une table, donc le
  déclencheur et la politique du canal sont éprouvés, pas la diffusion), et
  les déclencheurs branchés sur de vrais webhooks de facturation.
- **L'achat natif n'a pas de module natif branché.** `services/billing/native.ts`
  décrit le contrat ; il reste à choisir la bibliothèque et à faire un achat de
  test en bac à sable. Voir `docs/ops/paiements.md`.
- **Aucun tir de charge n'a été fait.** Les chiffres de `capacite.md` sont des
  calculs.

---

## Vérifier avant de livrer

```bash
npm run typecheck   # TypeScript strict, zéro erreur attendue
npm test            # 210 tests
npm run test:sql    # applique le schéma sur un PostgreSQL jetable et l'attaque
npm run audit:a11y  # mesure surfaces tactiles et contrastes sur le rendu réel
npm run licences    # aucune licence contaminante embarquée
npm run faq         # régénère docs/support/ si la FAQ a changé
```

`test:sql` mérite un mot. Le schéma n'avait jamais été exécuté : la première
tentative a buté sur un index déclaré avant sa table, puis sur une expression
d'index mal parenthésée. `supabase db push` aurait échoué, et l'index qui
tient la validation automatique n'aurait jamais existé. Rien de tout cela
n'était visible à la relecture. La suite applique donc les six fichiers pour de
vrai, **puis les réapplique** sur la base déjà en place — c'est le cas réel, une
base vide n'arrive qu'une fois dans la vie du produit — et joue enfin
soixante-dix-huit tentatives depuis une session d'appareil : se compter la
mission d'un frère, rejouer une récompense, se signer du nom d'un parent, lire
les conversations de sa sœur, se rembourser un échange, supprimer des comptes.

Cette dernière série a livré un piège qui vaut d'être connu : **`revoke ... from
public` ne suffit pas chez Supabase.** Les privilèges par défaut y accordent
explicitement l'exécution à `anon` et `authenticated` sur toute fonction créée
dans `public` ; révoquer à `public` ne défait que le droit implicite de
PostgreSQL, et laisse la fonction ouverte à n'importe quel appareil connecté.
Cinq fonctions étaient dans ce cas, dont celle qui décompte le budget du
compagnon — donc la facture — et celle qui supprime les comptes orphelins.

`audit:a11y` mérite le même mot. « Gros boutons atteignables par un enfant de
5 ans, icône + texte, contraste suffisant » était affirmé depuis le début et
jamais mesuré. Premier passage : **44 cibles trop petites et 63 contrastes
insuffisants** — le bleu de marque écrit sur du blanc donne 2,22:1 quand le
seuil lisible est 4,5:1. La palette n'a pas changé pour autant : des encres de
la même teinte portent le texte, et les couleurs vives gardent tous les aplats.
Sur les aplats, c'est le marine qui écrit (7,5:1), décision prise entre trois
options mesurées. Le seul écart assumé — la flèche de retour à 52 px — est
déclaré dans le script avec sa raison et reste affiché : un audit dont on
baisse le seuil jusqu'à ce qu'il passe ne mesure plus rien.

Et surtout : **rejouer le parcours 35 → 50 minutes dans l'application**, et de
temps en temps **la vraie première ouverture**, sans la démo — créer un compte,
un enfant, une mission, et aller jusqu'aux minutes gagnées. Les défauts les plus
graves trouvés jusqu'ici — un bouclier d'écran qui ne se levait pas, un code
parent lisible depuis la tablette de l'enfant, un verrouillage définitif de
l'espace parent à la mise à jour, et une toute première mission impossible à
confirmer — ont tous été trouvés en se servant de l'application, aucun en
relisant le code.

---

## Appliquer le SQL

```bash
npm run db:push -- --dry-run          # ce qui serait appliqué, et dans quel ordre
SUPABASE_DB_URL='postgresql://…' npm run db:push
```

L'URL vient du tableau de bord Supabase (Project settings → Database →
Connection string → URI) et ne doit jamais entrer dans le dépôt. Un fichier par
transaction : il passe entièrement ou pas du tout. L'ordre est celui de
`supabase/order.mjs`, lu aussi par `test:sql` — deux listes auraient divergé, et
la divergence se serait vue en production.

