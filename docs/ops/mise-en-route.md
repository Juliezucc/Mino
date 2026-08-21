# Mise en route

Deux choses, dans cet ordre : **essayer Mino sur un téléphone**, puis **brancher
le vrai serveur**. La première ne demande rien à créer et prend un quart
d'heure. La seconde demande un compte Supabase et en prend une vingtaine.

On peut très bien s'arrêter après la première : l'application tourne
entièrement sur le téléphone, et c'est déjà le produit.

---

## A. Essayer sur un iPhone

### A1. Ce qu'il faut sur l'ordinateur

Ouvrir le Terminal et taper :

```bash
node -v
```

S'il répond un numéro qui commence par `v20`, `v22` ou plus, tout va bien. S'il
répond « command not found », installer Node depuis **nodejs.org**, version
**LTS**, puis rouvrir le Terminal et recommencer.

### A2. Récupérer le code

Si le dossier `Mino` n'existe pas encore :

```bash
git clone https://github.com/Juliezucc/Mino.git
cd Mino
git checkout claude/mino-app-mvp-4xj0g8
```

S'il existe déjà :

```bash
cd Mino
git checkout claude/mino-app-mvp-4xj0g8
git pull
```

### A3. Installer et lancer

```bash
npm install     # deux à trois minutes, une seule fois
npm start
```

Le Terminal affiche un **QR code**. Il faut le laisser tourner : c'est lui qui
sert l'application au téléphone.

### A4. Sur le téléphone

1. Installer **Expo Go** depuis l'App Store (gratuit).
2. Vérifier que **le téléphone et l'ordinateur sont sur le même Wi-Fi**. C'est
   la cause numéro un des « ça ne marche pas ».
3. Ouvrir l'appareil photo de l'iPhone, viser le QR code, toucher la
   notification qui apparaît.

Mino se charge — la première fois prend une trentaine de secondes.

> **Si rien ne se passe** : arrêter avec `Ctrl+C` et relancer avec
> `npx expo start --tunnel`. C'est plus lent, mais ça traverse les réseaux
> d'entreprise et les Wi-Fi qui isolent les appareils entre eux.

### A5. Par où commencer

L'écran d'accueil propose quatre choses. Pour la première fois, prendre
**« Découvrir avec la démo »** : la famille de démonstration est créée
instantanément.

| Profil  | Ce qui l'attend                                                 |
| ------- | --------------------------------------------------------------- |
| Julie   | parente, code **1234**                                            |
| Noah    | 8 ans, **35 minutes**, « Ranger ma chambre +15 » encore à faire   |
| Elliott | 6 ans, 20 minutes, une demande déjà en attente                    |
| Léa     | 14 ans, 0 minute — c'est là que Mino reste et discute             |

**Le parcours à faire en premier**, celui qui est le produit :

1. Choisir **Noah** → sa mission « Ranger ma chambre » → **J'AI TERMINÉ**.
2. Revenir à l'accueil, choisir **Julie**, code **1234**.
3. La demande de Noah attend. Appuyer sur **CONFIRMER**.
4. Retourner chez Noah : le compteur est passé de **35 à 50**.

C'est cela qu'il faut juger. Le reste est du décor autour.

### A6. Ce qui ne marchera pas, et qui n'est pas un défaut

Quatre choses ne peuvent pas fonctionner dans ce mode, pour des raisons de
plateforme et non de code :

- **Le blocage réel des écrans.** Le minuteur descend honnêtement, mais ne
  verrouille aucune application : le module natif iOS (Family Controls) reste à
  écrire. Voir `docs/apple-family-controls.md`.
- **Le deuxième appareil.** Sans serveur, il n'y a qu'un téléphone : pas de code
  famille, pas de synchronisation entre le téléphone du parent et la tablette de
  l'enfant. C'est l'objet de la partie B.
- **Les notifications à distance.** Expo Go ne les fait plus. Les rappels locaux,
  eux, fonctionnent.
- **L'abonnement.** L'achat intégré n'est pas encore branché ; l'application se
  comporte comme si l'essai était en cours.

### A7. Pendant le test

- Une modification du code se recharge toute seule. Sinon, **secouer le
  téléphone** ouvre le menu Expo, où « Reload » relance.
- Pour repartir de zéro : dans le menu Expo, « Clear data », ou désinstaller
  Expo Go.
- Pour tout arrêter : `Ctrl+C` dans le Terminal.

---

## B. Brancher le vrai serveur (Supabase)

À partir d'ici, Mino cesse d'être une application solitaire : plusieurs
appareils, une vraie famille, la synchronisation en direct.

### B1. Créer le projet

Sur **supabase.com**, créer un compte, puis **New project**.

| Champ | Quoi mettre |
| --- | --- |
| Name | `mino` |
| Database password | **Générer** et le ranger dans un gestionnaire de mots de passe. Il ne se retrouve pas. |
| Region | **Europe** — Frankfurt ou Paris |
| Plan | Free pour commencer |

> **La région ne se change plus après.** Elle doit être en Europe : pour la
> latence, et parce que les données de familles françaises n'ont pas à quitter
> l'Union européenne. C'est le seul choix irréversible de toute cette page.

La création prend une minute ou deux.

### B2. Poser le schéma

Tout le schéma tient dans un seul fichier, fabriqué à partir des sept fichiers
d'origine :

```bash
npm run db:bundle
```

Il écrit `supabase/tout.sql` (~90 Ko). L'ouvrir, **tout sélectionner, tout
copier**.

Puis dans Supabase : **SQL Editor** → **New query** → coller → **Run**.

Ce qu'il faut voir : **« Success. No rows returned »**.

Trois choses à savoir :

- L'éditeur exécute l'ensemble **dans une seule transaction** : soit tout passe,
  soit rien ne passe. Il n'y a pas d'état intermédiaire à rattraper.
- Le fichier est **rejouable** : le relancer plus tard ne casse rien.
- S'il affiche une erreur, **ne rien tenter d'autre** : me l'envoyer telle
  quelle. Une erreur ici veut dire que la base n'a rien reçu.

### B3. Les deux clés

Dans Supabase : **Project Settings** → **API** (appelé « Data API » sur les
projets récents). Deux valeurs à relever :

- **Project URL** — quelque chose comme `https://abcdefgh.supabase.co`
- **anon / public** (ou « publishable ») — une longue chaîne

> ⚠️ La clé **`service_role`** (ou « secret ») est juste à côté. Elle ne doit
> **jamais** entrer dans l'application ni dans le dépôt : elle passe outre
> toutes les règles de sécurité et donnerait accès aux enfants de toutes les
> familles. On n'en a besoin nulle part ici.

Sur l'ordinateur, à la racine du dossier `Mino` :

```bash
cp .env.example .env
```

Ouvrir `.env` et coller les deux valeurs :

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Ce fichier est ignoré par git : il ne partira jamais dans le dépôt.

### B4. Relancer

```bash
npm start -c
```

Le `-c` vide le cache — sans lui, l'application continuerait de tourner avec
l'ancienne configuration et on chercherait longtemps pourquoi.

**Comment savoir que ça a marché** : sur l'écran d'accueil, « Créer mon compte
parent » demande maintenant une vraie adresse e-mail et crée un compte qui
survit à la désinstallation. En mode local, il n'y avait rien à créer.

### B5. Le deuxième appareil

C'est le moment que la partie A ne permettait pas :

1. Sur **votre** téléphone : créer le compte parent, créer un enfant, créer une
   mission.
2. Dans l'application, relever le **code famille** (`MINO-XXXXXX`).
3. Sur un **deuxième** appareil — la tablette d'un enfant, un autre téléphone —
   ouvrir Mino et choisir **« J'ai un code famille »**, saisir le code.
4. Faire la mission depuis le deuxième appareil, confirmer depuis le premier :
   **le compteur doit bouger sans que personne ne rafraîchisse quoi que ce soit.**

Si le compteur ne bouge pas tout seul, c'est le temps réel qu'il faut regarder,
et il faut me le dire.

### B6. Les quatre travaux de nuit

Ils ne sont pas indispensables au premier jour, mais ils évitent qu'une base
grossisse pour rien. Dans Supabase : **Database** → **Extensions**, activer
**`pg_cron`**. Puis dans le SQL Editor, une seule fois :

```sql
select cron.schedule('mino-purge-join-attempts', '0 4 * * *',
                     $$select purge_join_attempts()$$);
select cron.schedule('mino-purge-orphan-devices', '30 4 * * *',
                     $$select purge_orphan_devices()$$);
select cron.schedule('mino-compact-ledger', '0 3 * * *',
                     $$select compact_ledger()$$);
select cron.schedule('mino-purge-history', '15 3 * * *',
                     $$select purge_history()$$);
```

À ne lancer **qu'une fois** : une planification créée deux fois s'exécute deux
fois. Pour vérifier ce qui est en place : `select * from cron.job;`

### B7. Sauvegardes

Dès que de vraies familles arrivent — disons au-delà de la centaine — activer
les sauvegardes quotidiennes et la restauration à l'instant (PITR) dans les
réglages du projet. Une base de familles sans sauvegarde n'est pas un risque
technique, c'est un risque d'entreprise.

---

## C. Mino qui parle (facultatif, plus tard)

Le compagnon a besoin d'une fonction serveur et d'une clé Anthropic. Sans elles,
Mino répond des phrases préécrites — ce qui suffit largement pour juger le reste
de l'application. Le détail est dans `docs/ops/compagnon.md`.

---

## Si quelque chose casse

Dans l'ordre :

1. **Copier le message d'erreur en entier** — c'est presque toujours suffisant
   pour trouver la cause.
2. Dire à quelle étape exactement (« B2 », « A4 »).
3. Ne pas essayer de réparer la base à la main : le schéma se réapplique sans
   dommage, et une réparation manuelle est ce qui rend un problème difficile.

Pour vérifier que le dépôt lui-même est sain, sur l'ordinateur :

```bash
npm test          # 210 tests
npm run test:sql  # 113 vérifications de sécurité et de schéma
```

Si ces deux commandes passent, le problème est dans la configuration, pas dans
le code.
