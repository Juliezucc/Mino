# Les sauvegardes

Mino a **deux** jeux de sauvegardes, et ils ne protègent pas de la même chose.
Confondre les deux, c'est croire qu'on est couvert alors qu'on ne l'est que
d'un côté.

| | Où | Contre quoi | Combien de temps |
|---|---|---|---|
| **Supabase Pro** | chez Supabase | une bêtise de notre côté : migration ratée, `delete` trop large, travail de nuit qui déraille | 7 jours |
| **Copie hors-Supabase** | o2switch, chiffrée | un problème **de leur côté** : compte suspendu, facture qui passe mal, incident, disparition | 30 jours |

Les sauvegardes de Supabase sont rangées au même endroit que ce qu'elles
sauvegardent. Le jour où l'on ne peut plus ouvrir le tableau de bord, elles
sont aussi inaccessibles que la base. C'est tout l'objet de la seconde
colonne, et c'est la seule raison pour laquelle ce document existe.

**Le PITR n'est pas pris, et c'est délibéré.** C'est une option payante qui
remonte à la seconde près au lieu de la veille. Ce qu'elle achète, c'est la
différence entre perdre 24 h d'activité et n'en perdre aucune — aujourd'hui,
des missions et des minutes d'une journée. À reconsidérer le jour où le volume
quotidien rend cette journée coûteuse, pas avant.

---

## Ce que la copie contient, et ce qu'elle laisse

Le fichier est un `pg_dump` des schémas **`public` et `auth`**.

**Les deux, et c'est le point qui fait échouer les restaurations mal
préparées.** `parents.user_id` et `family_devices.user_id` pointent vers
`auth.users`. Une copie du seul schéma `public` rend une base où plus personne
ne peut se connecter et où chaque appareil rattaché est orphelin — une base
qui a l'air complète et qui ne sert à rien.

**Les conversations du compagnon n'y sont pas.** `--exclude-table-data` laisse
la table dans le schéma et son contenu dehors. Ce n'est pas une économie de
place : la politique de confidentialité promet « 30 jours, puis effacement
automatique » et [`companion.sql:139`](../../supabase/companion.sql) le tient.
Une sauvegarde qui les garderait plus longtemps ferait mentir cette phrase.
Restaurer rend donc une base complète et des conversations vides, ce qui est
le comportement voulu.

**Elle est prise à 2 h 30 UTC, avant les travaux de nuit.** Ceux-ci tournent
de 3 h à 4 h 45 ([`planification.sql`](../../supabase/planification.sql)) et
suppriment des lignes. Une sauvegarde prise après eux contient déjà les dégâts
le jour où l'un d'eux se trompe.

---

## Poser les clés

À faire une fois. La clé privée ne quitte jamais cette machine.

**`age` d'abord, et il n'est pas là par défaut.** Le runner GitHub l'installe
tout seul (`apt install age`), mais cette machine-ci en a besoin aussi — pour
créer les clés, et surtout pour **déchiffrer le jour de la restauration**. Ce
Mac n'a pas Homebrew : plutôt qu'un gestionnaire de paquets entier, `age` est
un binaire statique unique, sans installateur ni mot de passe.

```bash
cd /tmp && curl -fsSL \
  https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-darwin-arm64.tar.gz \
  | tar xz && mkdir -p ~/bin && mv age/age age/age-keygen ~/bin/ && rm -rf age
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc && export PATH="$HOME/bin:$PATH"
age --version
```

(Adapter la version et `darwin-arm64` si la machine change ;
`api.github.com/repos/FiloSottile/age/releases/latest` donne la dernière.)

```bash
age-keygen -o ~/mino-sauvegarde.key
```

La commande affiche la clé **publique** (`age1…`). Elle va dans le dépôt :

```bash
echo 'age1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' > .github/sauvegarde.age.pub
```

Puis, et c'est la partie qu'on saute et qu'on regrette :

> **Imprimez `~/mino-sauvegarde.key` et rangez le papier ailleurs que chez
> vous.** Sans cette clé, les fichiers déposés sur o2switch sont du bruit.
> Aucune sauvegarde n'est récupérable sans elle, ni par Supabase, ni par
> o2switch, ni par nous. C'est le prix du chiffrement asymétrique, et c'est
> aussi ce qui fait qu'une intrusion sur GitHub **et** sur o2switch ne donne
> accès à rien.

Le fichier `~/mino-sauvegarde.key` doit être en `chmod 600` et n'entre jamais
dans le dépôt — `.gitignore` ne le couvre pas puisqu'il vit dans le dossier
personnel, ce qui est justement le but.

---

## Les six secrets GitHub

`Settings → Secrets and variables → Actions → New repository secret`.

| Secret | Ce que c'est |
|---|---|
| `SUPABASE_DB_URL` | l'URI de connexion, **« Session pooler »** — pas « Transaction pooler » |
| `O2SWITCH_HOST` | le serveur SSH du compte |
| `O2SWITCH_USER` | l'identifiant cPanel |
| `O2SWITCH_PORT` | le port SSH |
| `O2SWITCH_SSH_KEY` | la clé privée SSH dédiée à cette tâche, en entier |
| `O2SWITCH_PATH` | le dossier de dépôt, **hors de `public_html`** |

Deux pièges, tous les deux vérifiés dans la douleur ailleurs :

**Le « Transaction pooler » (port 6543) ne sait pas faire de `pg_dump`.** Il ne
tient pas les transactions longues qu'exige une copie cohérente. C'est le
« Session pooler » ou la connexion directe qu'il faut, et l'erreur renvoyée
quand on se trompe ne le dit pas clairement.

**Le dossier de dépôt ne doit jamais être sous `public_html`.** Un fichier posé
sous une racine web est téléchargeable par qui devine son nom. Le chiffrement
ne serait plus alors que la dernière ligne de défense au lieu d'être la
seconde. Quelque chose comme `/home/<utilisateur>/sauvegardes-mino` convient.

La clé SSH se génère à part, et ne sert qu'à ça :

```bash
ssh-keygen -t ed25519 -f ~/mino-o2switch -C "sauvegarde mino" -N ""
```

La **publique** (`~/mino-o2switch.pub`) se colle dans cPanel → SSH Access. La
**privée** (`~/mino-o2switch`) va dans le secret `O2SWITCH_SSH_KEY`.

---

## Restaurer

**Cette procédure est un point de départ, pas un fait.** Elle n'aura de valeur
que le jour où elle aura été jouée en vrai, et ce qu'il aura fallu taper
réellement devra être réécrit ici. C'est la règle du dépôt :
[`de-ici-au-lancement.md`](de-ici-au-lancement.md) le dit déjà — « une
sauvegarde jamais restaurée est une hypothèse, pas un filet. »

**Il manque `pg_restore` sur la machine, et c'est bloquant le jour venu.** Ce
Mac n'a ni Homebrew ni client PostgreSQL — `which pg_restore` ne rend rien.
Ça n'a aucune conséquence au quotidien (`npm run test:sql` ne tourne
réellement qu'en intégration continue, où le runner Ubuntu fournit le sien),
mais ça arrête net une restauration. Le plus simple sans gestionnaire de
paquets est **Postgres.app** — une application qu'on glisse dans le dossier
Applications et qui apporte `pg_restore` et `psql`. À installer **avant** d'en
avoir besoin : le jour d'un incident n'est pas le moment de découvrir qu'il
manque un outil.

```bash
# 1. Récupérer le fichier
scp -P <port> <user>@<host>:<chemin>/mino-AAAA-MM-JJTHHMM.dump.age .

# 2. Déchiffrer
age --decrypt -i ~/mino-sauvegarde.key \
  -o mino.dump mino-AAAA-MM-JJTHHMM.dump.age

# 3. Restaurer dans un projet Supabase NEUF, jamais dans celui qui tourne
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "<URI du nouveau projet>" mino.dump
```

Puis, avant de croire que c'est fait :

1. Une famille se connecte-t-elle ? (c'est le schéma `auth` qui répond)
2. Un appareil rattaché retrouve-t-il sa famille ? (`family_devices.user_id`)
3. Le solde de minutes d'un enfant est-il le bon ?
4. Les conversations sont-elles vides ? **C'est le résultat attendu**, pas un
   défaut.

Le schéma `auth` d'un projet neuf n'est pas vide : il faudra probablement
composer avec ce qui s'y trouve déjà. C'est précisément ce que l'essai de
restauration doit établir, et personne ne peut l'écrire d'avance sans mentir.

---

## Ce qu'il reste à dire aux parents

La politique de confidentialité promet un effacement « immédiat et définitif »
à la suppression d'un compte. Une sauvegarde le contredit pendant 30 jours.
C'est admis et pratiqué partout, à une condition : que ce soit écrit.

Ligne à ajouter à [`privacy.ts`](../../src/content/privacy.ts), section
Conservation :

> **Sauvegardes** — Des copies chiffrées de la base sont conservées 30 jours
> au maximum, chez notre hébergeur et chez un second prestataire établi en
> France. Une suppression de compte y est répercutée à leur expiration. Les
> conversations de votre enfant avec Mino n'y figurent pas.

Non écrite, c'est une divergence de plus entre ce que Mino publie et ce que
Mino fait — la famille de défauts la plus coûteuse de ce projet.
