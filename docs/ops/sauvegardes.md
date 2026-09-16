# Les sauvegardes

Mino a **deux** jeux de sauvegardes, et ils ne protègent pas de la même chose.
Confondre les deux, c'est croire qu'on est couvert alors qu'on ne l'est que
d'un côté.

| | Où | Contre quoi | Combien de temps |
|---|---|---|---|
| **Supabase Pro** | chez Supabase | une bêtise de notre côté : migration ratée, `delete` trop large, travail de nuit qui déraille | 7 jours |
| **Copie hors-Supabase** | Cloudflare R2, chiffrée | un problème **de leur côté** : compte suspendu, facture qui passe mal, incident, disparition | 30 jours |

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
> vous.** Sans cette clé, les fichiers déposés sur R2 sont du bruit.
> Aucune sauvegarde n'est récupérable sans elle, ni par Supabase, ni par
> Cloudflare, ni par nous. C'est le prix du chiffrement asymétrique, et c'est
> aussi ce qui fait qu'une intrusion sur GitHub **et** sur Cloudflare ne donne
> accès à rien.

Le fichier `~/mino-sauvegarde.key` doit être en `chmod 600` et n'entre jamais
dans le dépôt — `.gitignore` ne le couvre pas puisqu'il vit dans le dossier
personnel, ce qui est justement le but.

---

## Pourquoi Cloudflare R2, et pas o2switch

C'était le premier choix : l'hébergement était déjà payé, et il est français.
Il a fallu y renoncer, et la raison mérite d'être écrite pour que personne ne
réessaie.

**Le pare-feu d'o2switch bloque SSH par défaut** et ne l'ouvre qu'à des
adresses IP nommément autorisées, sur demande au support. Les runners GitHub
tournent sur des milliers de plages Azure qui changent sans préavis : il n'y a
aucune adresse fixe à faire autoriser. Le journal l'a dit sans ambiguïté —
`Connection timed out` depuis le runner, alors que la même clé ouvrait la
session depuis le Mac une minute plus tôt. Ce n'était pas un réglage à
trouver, c'était une impasse.

R2 est joignable de partout, parle le protocole S3 — donc l'outil `aws` déjà
présent sur le runner suffit, sans confier la sauvegarde à une action tierce
qu'on n'a pas lue — et ses 10 Go gratuits couvrent très large : un dump fait
274 Ko, trente jours pèsent 8 Mo. Même à 30 000 familles (~1,5 Go par copie,
~45 Go au total), le dépassement coûterait moins d'un dollar par mois.

---

## Les cinq secrets GitHub

`Settings → Secrets and variables → Actions → New repository secret`.

| Secret | Ce que c'est |
|---|---|
| `SUPABASE_DB_URL` | l'URI de connexion, **« Session pooler »** — pas « Transaction pooler » |
| `R2_ENDPOINT` | l'adresse affichée par Cloudflare à la création du jeton, telle quelle |
| `R2_BUCKET` | le nom du seau, par exemple `mino-sauvegardes` |
| `R2_ACCESS_KEY_ID` | jeton d'API R2, partie publique |
| `R2_SECRET_ACCESS_KEY` | jeton d'API R2, partie secrète — **montrée une seule fois** |

**Le « Transaction pooler » (port 6543) ne sait pas faire de `pg_dump`.** Il ne
tient pas les transactions longues qu'exige une copie cohérente. C'est le
« Session pooler » (port 5432) ou la connexion directe qu'il faut, et l'erreur
renvoyée quand on se trompe ne le dit pas clairement.

**Le jeton R2 ne doit pouvoir qu'écrire et lire ce seau-là.** Cloudflare
propose de restreindre un jeton à un seul seau : il n'y a aucune raison de
s'en priver. Un jeton volé sur GitHub ne donnerait alors accès qu'à des
fichiers chiffrés dont la clé n'est pas là.

**Le seau se crée en juridiction « European Union », et ce n'est pas un
détail de confort.** La politique de confidentialité annoncera que les
sauvegardes restent dans l'Union européenne ; R2 laisse ce choix à la création
et **il ne se change plus ensuite**. Un seau créé par défaut, c'est une phrase
publiée qui devient fausse — la famille de défauts la plus coûteuse de ce
projet, et celle contre laquelle tout le reste de ce document est écrit.

Attention à ne pas confondre les deux réglages que R2 propose. Un **« location
hint »** n'est qu'une indication de performance, sans garantie de résidence.
C'est la **juridiction** qui engage, et elle seule autorise la phrase de la
politique. Elle change aussi l'adresse du point d'accès, qui devient
`https://<compte>.eu.r2.cloudflarestorage.com` — raison pour laquelle le
secret `R2_ENDPOINT` prend l'adresse affichée par Cloudflare plutôt que de la
recomposer.

---

## Restaurer

**Éprouvé le 16 septembre 2026, sur la première sauvegarde produite.** Ce n'est
plus une procédure espérée : le fichier a été retéléchargé depuis l'interface
de Cloudflare, déchiffré, restauré dans une base jetable, et les lignes
comptées — 5 familles, 6 enfants, 15 missions, 5 abonnements, 21 missions
accomplies, 17 comptes dans `auth.users`, et 0 conversation, ce qui est le
résultat voulu.

Ce qui reste non éprouvé, et il faut le dire : la restauration **dans un projet
Supabase neuf**. Ce qui est prouvé, c'est que l'archive est complète et se
recharge entièrement ; ce qui ne l'est pas, c'est la manière de composer avec
le schéma `auth` d'un projet Supabase qui n'est jamais vide. Le jour venu,
réécrire ici ce qu'il aura fallu taper.

`pg_restore` vient de **Postgres.app** — ce Mac n'a pas Homebrew. À garder
installée : le jour d'un incident n'est pas le moment de découvrir qu'il manque
un outil.

```bash
# 1. Récupérer le fichier depuis R2 (aws configure une fois, region « auto »)
aws s3 cp "s3://<seau>/mino-AAAA-MM-JJTHHMM.dump.age" . \
  --endpoint-url "<la valeur du secret R2_ENDPOINT>"

# 2. Déchiffrer
age --decrypt -i ~/mino-sauvegarde.key \
  -o mino.dump mino-AAAA-MM-JJTHHMM.dump.age

# 3. Restaurer dans un projet Supabase NEUF, jamais dans celui qui tourne
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "<URI du nouveau projet>" mino.dump
```

### Éprouver l'archive sans toucher à Supabase

Avant d'écraser quoi que ce soit de vivant, on peut la recharger dans un
PostgreSQL jetable. C'est ce qui a été fait le 16 septembre, et c'est
reproductible en cinq minutes :

```bash
D=/tmp/pgjetable; P=55433
initdb -D "$D/data" -U postgres --auth=trust
pg_ctl -D "$D/data" -o "-h 127.0.0.1 -p $P -c unix_socket_directories=''" \
  -l "$D/serveur.log" start
createdb -h 127.0.0.1 -p $P -U postgres essai
pg_restore -h 127.0.0.1 -p $P -U postgres -d essai \
  --no-owner --no-privileges mino.dump
psql -h 127.0.0.1 -p $P -U postgres -d essai -Atc "select count(*) from families"
pg_ctl -D "$D/data" stop && rm -rf "$D"
```

**Écouter en TCP, pas sur une socket.** Un chemin de socket Unix ne peut pas
dépasser 103 octets, et un dossier temporaire un peu profond suffit à le
dépasser — le serveur refuse alors de démarrer avec un message qui n'a rien à
voir avec la sauvegarde.

**Trois erreurs sont normales.** `pg_restore` signale des rôles et extensions
propres à Supabase qui n'existent pas sur une base locale. Elles n'affectent
aucune donnée. Ce qu'il faut regarder, ce sont les comptages.

Puis, avant de croire que c'est fait :

1. Les comptes sont-ils là ? (`auth.users` — c'est lui qui permet de se
   connecter, et c'est ce qu'une copie du seul schéma `public` perdrait)
2. Un appareil rattaché retrouve-t-il sa famille ? (`family_devices.user_id`)
3. Le solde de minutes d'un enfant est-il le bon ?
4. Les conversations sont-elles vides ? **C'est le résultat attendu**, pas un
   défaut.

---

## Ce qu'il reste à dire aux parents

La politique de confidentialité promet un effacement « immédiat et définitif »
à la suppression d'un compte. Une sauvegarde le contredit pendant 30 jours.
C'est admis et pratiqué partout, à une condition : que ce soit écrit.

Ligne à ajouter à [`privacy.ts`](../../src/content/privacy.ts), section
Conservation :

> **Sauvegardes** — Des copies chiffrées de la base sont conservées 30 jours
> au maximum, chez notre hébergeur et chez un second prestataire, au sein de
> l'Union européenne. Une suppression de compte y est répercutée à leur
> expiration. Les conversations de votre enfant avec Mino n'y figurent pas.

Non écrite, c'est une divergence de plus entre ce que Mino publie et ce que
Mino fait — la famille de défauts la plus coûteuse de ce projet.
