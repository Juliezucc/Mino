# Architecture

Ce document existe pour une raison précise : qu'un développeur qui n'a jamais vu
Mino puisse être utile en une journée, et qu'il ne casse pas les trois ou quatre
choses qui ne doivent pas être cassées.

---

## Les cinq règles

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
qui rend les règles testables sans lancer l'application — 184 tests en 3
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
ni valider une mission, ni ajouter des minutes. Ce n'est pas l'interface qui
l'empêche, c'est le `with check` de la politique.

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

### 5. Le temps de l'enfant ne se voit pas en minutes

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
  functions/          fonctions serveur (Deno) : billing, stripe-webhook,
                      store-purchase, store-notifications
docs/                 ce dossier
scripts/              génération : visuels, guide, FAQ, licences
__tests__/            184 tests
```

---

## Le chemin d'une validation, de bout en bout

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
  → « VALIDER +15 MIN » → domain/actions.approveCompletion()
  → écrit DEUX lignes : la complétion approuvée ET la transaction +15
  → RLS n'accepte cette écriture que d'un parent (auth_is_parent())

La tablette de l'enfant reçoit le signal
  → le compteur passe de 35 à 50, la célébration se déclenche
```

Couvert de bout en bout par `__tests__/journey.test.ts`.

---

## Ce qui n'est pas fait, et qu'il faut savoir avant de commencer

- **Le module natif de blocage n'existe pas encore.** `DeviceManagedScreenTime`
  appelle un contrat (`services/screenTime/native.ts`) qui n'a pas
  d'implémentation Swift ni Kotlin. Il faut Xcode, un appareil réel, et
  l'habilitation Apple. Voir `docs/apple-family-controls.md`.
- **`scale.sql`, `support.sql`, `analytics.sql` et `store.sql` n'ont jamais été
  exécutés** contre une vraie base. Ils sont écrits, pas éprouvés.
- **L'achat natif n'a pas de module natif branché.** `services/billing/native.ts`
  décrit le contrat ; il reste à choisir la bibliothèque et à faire un achat de
  test en bac à sable. Voir `docs/ops/paiements.md`.
- **Aucun tir de charge n'a été fait.** Les chiffres de `capacite.md` sont des
  calculs.

---

## Vérifier avant de livrer

```bash
npm run typecheck   # TypeScript strict, zéro erreur attendue
npm test            # 184 tests
npm run licences    # aucune licence contaminante embarquée
npm run faq         # régénère docs/support/ si la FAQ a changé
```

Et surtout : **rejouer le parcours 35 → 50 minutes dans l'application**. Les
trois défauts les plus graves trouvés jusqu'ici — un bouclier d'écran qui ne se
levait pas, un code parent lisible depuis la tablette de l'enfant, et un
verrouillage définitif de l'espace parent à la mise à jour — ont tous été
trouvés en se servant de l'application, aucun en relisant le code.
