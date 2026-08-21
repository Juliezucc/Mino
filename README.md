# mino

**Grandir, une mission à la fois.**

Mino est une application familiale pour les enfants de 5 à 12 ans. Le principe tient
en une ligne :

> Je fais **mes missions** → je gagne **du temps** → je profite **de mes écrans**.

Les parents créent de petites responsabilités quotidiennes (des **missions**, jamais
des « corvées » ni des « quêtes »). L'enfant appuie sur **J'AI TERMINÉ**, le parent
**valide**, et les minutes arrivent immédiatement sur le compteur de l'enfant.

---

## Le parcours prioritaire

C'est le cœur du MVP, et il fonctionne de bout en bout :

```
Julie crée « Ranger ta chambre +15 min » pour Noah
  ↓  Noah voit la mission
  ↓  Noah appuie sur « J'ai terminé »        → la mission passe EN ATTENTE
  ↓  Julie voit la demande
  ↓  Julie appuie sur « VALIDER +15 MIN »    → une transaction de +15 est écrite
  ↓  Noah voit une célébration avec la mascotte
  ↓  son compteur passe de 35 à 50 minutes
```

Ce scénario est couvert par un test automatisé de bout en bout
(`__tests__/journey.test.ts`) et a été rejoué manuellement dans l'application.

---

## Démarrer

```bash
npm install
npm start          # puis « i » pour iOS, « a » pour Android, « w » pour le web
```

Au premier lancement, l'écran d'accueil propose **« Découvrir avec la démo »** :
la famille de démonstration est créée instantanément.

| Profil  | Détail                                                            |
| ------- | ----------------------------------------------------------------- |
| Julie   | parente, code PIN **1234**                                        |
| Noah    | 8 ans, **35 minutes**, « Ranger ma chambre +15 » encore à faire    |
| Elliott | 6 ans, **20 minutes**, une demande déjà en attente de validation   |
| Léa     | 14 ans, **0 minute** — c'est là que Mino reste et discute          |

Noah démarre donc exactement à 35 minutes avec la mission à +15 disponible : le
parcours prioritaire est testable en quelques secondes, sans rien configurer.

Autres scripts :

```bash
npm test           # tests du domaine et du parcours complet
npm run typecheck  # TypeScript strict
npm run faq        # régénère docs/support/ depuis src/content/faq.ts
npm run licences   # recense les licences des dépendances
npm run assets     # régénère icônes et écran de lancement
npm run captures   # régénère les visuels des fiches App Store et Play
```

---

## Documentation

| Sujet | Fichier |
| --- | --- |
| Architecture, règles à ne pas casser | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Tenir 10 000 familles, coûts | [`docs/ops/capacite.md`](docs/ops/capacite.md) |
| MRR, churn, cohortes, LTV, CAC | [`docs/ops/analytics.md`](docs/ops/analytics.md) |
| Les deux rails de paiement | [`docs/ops/paiements.md`](docs/ops/paiements.md) |
| Mino qui parle : coût, sécurité, classement d'âge | [`docs/ops/compagnon.md`](docs/ops/compagnon.md) |
| Propriété intellectuelle, comptes, accès | [`docs/ops/propriete-et-acces.md`](docs/ops/propriete-et-acces.md) |
| Captures des fiches App Store et Play | [`docs/ops/captures-stores.md`](docs/ops/captures-stores.md) |
| Process marketing | [`docs/marketing/`](docs/marketing/) |
| Blocage réel des écrans | [`docs/blocage-ecrans.md`](docs/blocage-ecrans.md) |
| Habilitation Apple | [`docs/apple-family-controls.md`](docs/apple-family-controls.md) |

---

## Architecture

```
app/                     Écrans (expo-router, routage par fichiers)
  welcome, who, parent-pin, onboarding/
  child/                 Espace enfant  — onglets Missions | Temps | Profil
  parent/                Espace parent  — onglets Accueil | Missions | Enfants | Réglages
src/
  domain/                Modèle et règles métier — 100 % pur, testable sans React
    types.ts             Family, Parent, Child, Mission, MissionAssignment,
                         MissionCompletion, ScreenTimeTransaction, ScreenTimeSession
    ledger.ts            Solde dérivé du registre, historique, capsules, formats
    missions.ts          Planification (jamais / tous les jours / certains jours), états
    actions.ts           Transitions pures : (data, input) → nouvelle data
  data/                  Persistance
    repository.ts        Interface MinoRepository
    localRepository.ts   AsyncStorage (mode hors ligne, par défaut)
    supabaseRepository.ts Supabase (activé si les variables d'env sont présentes)
    demo.ts              Famille de démonstration
  store/                 Zustand : orchestre domaine + persistance + sélecteurs
  services/screenTime/   Abstraction du temps d'écran réel
  components/            Design system (ui/), mascotte (mascot/), icônes (icons/)
  features/              Blocs réutilisables (MissionCard, RequestCard, formulaires…)
  theme/                 Palette, espacements, rayons, ombres, échelle typographique
supabase/schema.sql      Tables, index, vue de solde, RLS et realtime
```

### Le registre des minutes

Le solde d'un enfant **n'est jamais un compteur mutable**. C'est toujours la somme
de ses `ScreenTimeTransaction` :

```
+15  mission_reward      « Ranger ma chambre »
+5   mission_reward      « Faire mon lit »
−20  screen_time_used    « Temps d'écran utilisé »
```

Valider une mission écrit l'approbation **et** la transaction dans la même
opération : il n'existe aucun chemin qui crédite des minutes sans laisser de trace.
L'historique et le solde ne peuvent donc jamais diverger.

### Le seam « temps d'écran réel »

`src/services/screenTime/` isole tout ce qui touchera un jour aux APIs natives de
contrôle parental. Le MVP livre `LocalTimerScreenTimeService`, qui annonce
honnêtement `capability: 'timer-only'` : il mesure le temps, il ne bloque rien.

Pour brancher le vrai blocage (Apple FamilyControls / DeviceActivity, Android
UsageStatsManager) il suffit d'écrire une nouvelle implémentation de l'interface
`ScreenTimeService` et de la choisir dans `getScreenTimeService()`. Aucun écran,
aucun store, aucune règle métier ne change.

### Backend

L'application tourne **hors ligne par défaut** (AsyncStorage), ce qui garantit que
le parcours principal est testable sans compte ni réseau.

Pour passer sur Supabase, il suffit de définir :

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

`createRepository()` choisit alors `SupabaseRepository` automatiquement. Appliquez
les quatre fichiers SQL **dans cet ordre** :

| Fichier | Ce qu'il apporte |
| --- | --- |
| `supabase/schema.sql` | tables, RLS, code parent, rattachement d'un appareil |
| `supabase/scale.sql` | index, temps réel par famille, purges, solde serveur |
| `supabase/support.sql` | signalements et file de traitement |
| `supabase/analytics.sql` | journal de facturation et vues de pilotage |
| `supabase/store.sql` | achats App Store et Play Store, revenu net par rail |
| `supabase/companion.sql` | budget d'échanges, conversations, purge |

Le temps réel passe par un **canal privé par famille** (`famille:<id>`), alimenté
par un déclencheur : le parent valide sur son téléphone, la tablette de l'enfant
se met à jour sans rafraîchissement. Le mécanisme `postgres_changes`, qui
évaluait chaque écriture de la base contre chaque client connecté, a été
abandonné — il ne tient pas au-delà de quelques milliers de connexions
(voir [`docs/ops/capacite.md`](docs/ops/capacite.md)).

---

## Sécurité et données

L'application concerne des enfants, la minimisation des données est donc une règle
de conception, pas une option :

- aucun compte, aucun e-mail, aucun mot de passe pour l'enfant ;
- pas de géolocalisation, pas de publicité, pas de tracking marketing ;
- pas de messagerie entre personnes, pas de contenu public, pas de profil public ;
- les enfants d'une famille ne sont jamais visibles par une autre famille — c'est
  garanti par les policies RLS, pas seulement par le code client ;
- l'espace parent est protégé par un code à 4 chiffres, qui **n'est lisible nulle
  part** : son empreinte vit dans une table sans aucune politique de lecture, et
  la vérification est faite par le serveur, avec limitation des tentatives. La
  tablette de l'enfant ne peut donc pas le lire, même en cherchant ;
- un signalement de bug est nettoyé avant de partir : ni prénom d'enfant, ni
  adresse, ni code (`src/domain/diagnostics.ts`).

---

## Accessibilité

- Boutons enfant de 64 pt minimum, texte large et court.
- **Icône + texte** partout : un enfant qui ne lit pas encore peut agir.
- Le temps est représenté trois fois : chiffres, anneau de progression et capsules
  (1 capsule = 5 minutes).
- Safe areas iOS et Android, contraste élevé, `maxFontSizeMultiplier` maîtrisé.

## Animations

Courtes et gratifiantes, jamais permanentes : entrée de la mascotte, confettis à la
validation, et le compteur qui grimpe visiblement de 35 à 50.

---

## La mascotte

Les huit expressions de la charte (heureux, fier, motivé, surpris, ravi, inquiet,
déçu, fatigué) sont livrées en **rendus 3D** dans `assets/mascot/`.

Les rendus d'origine sont cadrés différemment d'une pose à l'autre — Mino s'assoit
quand il est fatigué, écarte les bras quand il est ravi, et certaines poses portent
des décors (confettis, nuage, ZZZ) qui débordent largement du personnage. Utilisés
tels quels, la mascotte changerait de taille et sauterait d'un écran à l'autre.

`scripts/normalize-mascot.mjs` règle ça : il isole le bleu du corps, y cherche le
plus grand cercle inscrit — la sphère du corps, qui veut dire la même chose dans les
huit poses — puis recadre tout le monde sur un carré de 1024 px, corps centré et de
taille identique. Pour mettre une pose à jour : remplacer le fichier dans
`assets/mascot/source/` et relancer le script.

Une mascotte **vectorielle** reste en secours dans `src/components/mascot/Mascot.tsx` :
`<Mascot />` utilise l'image dès qu'elle existe et retombe sur le vecteur sinon, donc
un jeu incomplet ne casse jamais un écran.

`MascotAnimation` enchaîne ces poses avec du mouvement (bond, écrasement à
l'atterrissage, bascule) pour produire une vraie performance — voir l'écran de
célébration.

---

## Ce qui n'est volontairement pas dans le MVP

Pas de monnaie virtuelle, pas de niveaux, pas de boutique, pas de nourriture pour la
mascotte, pas de monde virtuel, pas de mini-jeux, pas de RPG. La récompense est le
temps d'écran, et rien d'autre.
