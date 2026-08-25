# Propriété, accès, comptes

Ce que possède Agence Wheb, où c'est, et qui peut y toucher.

Un dossier de ce genre sert deux fois. La première, tous les jours : savoir où
cliquer. La seconde, une seule fois mais elle est décisive : le jour d'une
levée de fonds, d'une cession ou d'un litige, l'acheteur ou l'avocat demande
exactement ce document, et l'absence de réponse claire coûte plus cher que
tout ce qui précède.

---

## 1. Ce qui a été corrigé

**Le dépôt était publié sous licence MIT, au nom de 650 Industries (Expo).**

C'est le fichier `LICENSE` livré avec le modèle de projet Expo, jamais remplacé.
Tel quel, il déclarait que le code de Mino — le vôtre — était librement
copiable, modifiable et revendable par n'importe qui, sous le copyright d'une
autre société. Ce n'était pas une formalité manquante : c'était une licence
active, accordée par écrit, sur tout le dépôt.

Remplacé par une licence propriétaire au nom d'Agence Wheb, couvrant le code,
les maquettes, les textes, le personnage et l'identité visuelle.

> Une licence libre déjà publiée ne se révoque pas rétroactivement pour qui l'a
> reçue. Comme le dépôt est privé et n'a jamais été diffusé, la question ne se
> pose pas ici — mais elle se serait posée le lendemain d'une mise en public.

---

## 2. La société

| | |
|---|---|
| Raison sociale | Agence Wheb |
| Forme | SASU au capital de 500 € |
| Siège | 47 rue Vivienne, 75002 Paris |
| Immatriculation | 103 231 460 R.C.S. Paris |
| TVA intracommunautaire | FR67103231460 |
| Directrice de la publication | Julie Zucherman |

Ces informations sont écrites **une seule fois** dans le code, dans
`src/content/document.ts` (constante `OPERATOR`), et reprises de là par les CGV,
la politique de confidentialité et les mentions légales. Une adresse à changer
se change à un endroit.

---

## 3. Ce que possède la société

### Créé pour Mino, propriété pleine

- Le code source de l'application et des fonctions serveur.
- Le schéma de base de données et les règles de sécurité.
- Les textes : guide, FAQ, CGV, politique de confidentialité, textes de
  l'interface.
- **Le personnage Mino** et ses expressions — les rendus fournis par vous.
- L'identité visuelle : palette, logo, icônes.

### Utilisé sous licence, à ne pas confondre avec ce qui précède

- **Nunito**, la police, sous SIL Open Font License. Libre d'usage y compris
  commercial, y compris embarquée dans une application. Rien à payer, rien à
  demander ; la licence doit simplement être conservée.
- **Les bibliothèques open source** : 740 paquets, dont 458 réellement embarqués.
  Recensés dans `dependances.md`, à régénérer par `npm run licences` après
  chaque installation. Verdict actuel : aucune licence contaminante parmi les
  paquets embarqués.
- **Les émojis** utilisés comme icônes de mission sont rendus par le système
  d'exploitation, pas fournis par Mino. Rien n'est distribué, rien n'est à
  licencier.

### À sécuriser, et ce n'est pas fait

- [ ] **Marque « Mino » à l'INPI**, classes 9 (logiciels) et 42 (services
      informatiques). ~250 € pour une classe, ~50 € par classe supplémentaire.
      **Faire une recherche d'antériorité d'abord** : « Mino » est un mot court
      et courant, et le risque qu'il soit déjà pris dans ces classes est réel.
      À faire avant la communication publique, pas après — déposer une marque
      qu'on utilise déjà et qui appartient à un autre est la pire séquence.
- [ ] **Nom de domaine** : enregistrer `minoapp.fr` (`mino.app` appartient à un tiers) et vérifier qu'il est
      enregistré **au nom de la société**, jamais au nom personnel d'une
      personne physique, et avec le renouvellement automatique activé.
- [ ] **Cession de droits d'auteur pour toute contribution extérieure.** Un
      graphiste, un développeur ou un rédacteur freelance conserve ses droits
      d'auteur **par défaut** en droit français : payer une facture ne les
      transfère pas. Il faut une clause de cession écrite, précise quant aux
      droits cédés, à leur étendue et à leur durée. C'est l'omission la plus
      fréquente et la plus coûteuse à rattraper, parce qu'elle se rattrape en
      négociant avec quelqu'un qui sait alors qu'il est en position de force.

---

## 4. Les comptes, et qui les tient

À compléter au fur et à mesure des ouvertures. La colonne qui compte est la
dernière.

| Service | Rôle | Titulaire | Récupération |
|---|---|---|---|
| Apple Developer | Publication iOS | Agence Wheb (compte **organisation**, pas individuel) | |
| Google Play Console | Publication Android | Agence Wheb | |
| Supabase | Base, authentification, fonctions | | |
| Stripe | Paiements | Agence Wheb | |
| GitHub | Code source | | |
| Registrar (domaine) | minoapp.fr | | |
| Boîte e-mail | contact@, privacy@ | | |
| Expo / EAS | Compilation des applications | | |

**Trois règles, et la troisième est celle qu'on oublie :**

1. **Tous les comptes au nom de la société**, jamais d'une personne physique.
   Le compte Apple Developer en particulier : passer d'un compte individuel à
   un compte organisation après publication oblige à republier l'application
   sous une nouvelle fiche, en perdant les avis et le classement.
2. **Double authentification partout**, avec les codes de récupération imprimés
   et rangés ailleurs que dans le gestionnaire de mots de passe qu'ils sont
   censés secourir.
3. **Une seconde personne de confiance** capable d'accéder à Stripe et à
   Supabase. À 10 000 familles, une indisponibilité de la seule personne qui
   détient les accès n'est plus un désagrément, c'est un arrêt d'exploitation.

---

## 5. Les secrets

Ce qui ne doit **jamais** entrer dans le dépôt :

| Secret | Où il vit |
|---|---|
| `STRIPE_SECRET_KEY` | Variables des fonctions Supabase |
| `STRIPE_WEBHOOK_SECRET` | Variables des fonctions Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Variables des fonctions Supabase, **jamais dans l'application** |

Ce qui peut y être, et qui y est : `EXPO_PUBLIC_SUPABASE_URL` et
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. Elles sont publiques par construction —
n'importe qui peut les extraire de l'application installée. **Ce qui protège les
données n'est pas leur secret, ce sont les règles RLS** : la clé anonyme ne
donne accès à rien sans une session, et une session ne donne accès qu'à sa
propre famille.

`.env` est ignoré par git ; `.env.example` donne la liste des variables sans
valeur.

**Vérifié** : `git log --all -p -- .env` ne renvoie rien sur les 32 commits du
dépôt. Aucun fichier d'environnement n'a jamais été versionné, donc aucune clé
n'est enfouie dans l'historique. À revérifier avant toute mise en public — un
secret retiré d'un commit reste dans l'historique et doit être **révoqué**, pas
seulement effacé.

---

## 6. L'état de la documentation

| Document | Où | État |
|---|---|---|
| Architecture technique | `docs/ARCHITECTURE.md` | à jour |
| Capacité et coûts | `docs/ops/capacite.md` | à jour |
| Chiffres et pilotage | `docs/ops/analytics.md` | à jour |
| Propriété et accès | ce fichier | à compléter (comptes) |
| Licences des dépendances | `docs/ops/dependances.md` | généré |
| Blocage des écrans | `docs/blocage-ecrans.md` | à jour |
| Apple Family Controls | `docs/apple-family-controls.md` | à jour |
| Process marketing | `docs/marketing/` | à jour |
| Base de connaissance | `src/content/faq.ts` → `docs/support/` | générée |
| Guide utilisateur | `src/content/guide.ts` | dans l'application |
| CGV / confidentialité | `src/content/` | **à faire relire par un avocat** |

---

## 7. Ce qui reste ouvert, par ordre d'urgence

1. **Faire relire les CGV et la politique de confidentialité par un avocat.**
   Elles sont complètes et cohérentes, mais elles n'ont pas de valeur validée.
   Une application destinée à des enfants, en France, avec paiement récurrent :
   les trois sujets où l'erreur se paie.
2. **Recherche d'antériorité puis dépôt de la marque « Mino ».**
3. **Demande d'habilitation Apple Family Controls** — voir
   `docs/apple-family-controls.md`. C'est le chemin critique du produit : sans
   elle, le blocage réel n'existe pas, et le délai ne dépend pas de nous.
4. **Compléter le tableau des comptes** ci-dessus, avec la double
   authentification partout.
5. **Créer les produits d'abonnement** dans App Store Connect et la Play
   Console, et s'inscrire au programme Small Business d'Apple — voir
   `docs/ops/paiements.md`.
