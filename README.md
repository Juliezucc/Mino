# mino

**Chaque minute se gagne.**

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

Noah démarre donc exactement à 35 minutes avec la mission à +15 disponible : le
parcours prioritaire est testable en quelques secondes, sans rien configurer.

Autres scripts :

```bash
npm test           # tests du domaine et du parcours complet
npm run typecheck  # TypeScript strict
```

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
`supabase/schema.sql` : il crée les tables, les index, la vue de solde, les règles
RLS et la publication realtime (le parent valide sur son téléphone, la tablette de
l'enfant se met à jour sans rafraîchissement).

---

## Sécurité et données

L'application concerne des enfants, la minimisation des données est donc une règle
de conception, pas une option :

- aucun compte, aucun e-mail, aucun mot de passe pour l'enfant ;
- pas de géolocalisation, pas de publicité, pas de tracking marketing ;
- pas de chat, pas de contenu public, pas de profil public ;
- les enfants d'une famille ne sont jamais visibles par une autre famille — c'est
  garanti par les policies RLS, pas seulement par le code client ;
- l'espace parent est protégé par un code à 4 chiffres.

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

`src/components/mascot/` contient une mascotte **vectorielle** qui couvre déjà les
huit expressions de la charte (heureux, fier, motivé, surpris, ravi, inquiet, déçu,
fatigué) et les situations produit (mission terminée, minutes gagnées, presque plus
de temps, bravo…).

Pour passer aux rendus 3D définitifs : déposer un PNG par expression dans
`assets/mascot/` et décommenter la ligne correspondante dans
`src/components/mascot/mascotAssets.ts`. `<Mascot />` préfère l'image dès qu'elle
existe et retombe sur le vecteur sinon — la migration peut donc se faire expression
par expression, sans jamais casser l'application.

---

## Ce qui n'est volontairement pas dans le MVP

Pas de monnaie virtuelle, pas de niveaux, pas de boutique, pas de nourriture pour la
mascotte, pas de monde virtuel, pas de mini-jeux, pas de RPG. La récompense est le
temps d'écran, et rien d'autre.
