# Les chiffres à regarder

Où ils sont, comment les lire, et ce qu'il faut décider quand ils bougent.

Tout est dans Supabase, en SQL. **Aucun outil d'analytics tiers, aucun traceur
dans l'application** — c'est une contrainte du projet (pas de tracking marketing
côté enfant) et cela tombe bien : les seuls chiffres qui décident quoi que ce
soit ici sont des chiffres d'argent, et ils viennent de Stripe.

À appliquer une fois : `supabase/analytics.sql`.

---

## Le problème qui a été réglé au passage

`subscriptions` est un **miroir** : il dit ce que Stripe raconte aujourd'hui, et
chaque changement l'écrase. Une famille qui a essayé, payé quatre mois puis
résilié n'y laisse qu'une ligne `canceled`.

Conséquence : sans journal, le churn, les cohortes, la LTV et le MRR des mois
passés ne sont pas difficiles à calculer, ils sont **impossibles** — le fait n'a
jamais été écrit nulle part. Et c'est irrattrapable : on ne reconstitue pas
après coup un historique qu'on n'a pas conservé.

D'où `billing_events`, un journal en ajout seul alimenté par le webhook Stripe.
C'est exactement la règle déjà appliquée au temps d'écran — jamais un compteur
qu'on modifie, toujours une somme d'événements — appliquée à l'argent.

**C'est la chose la plus urgente de tout ce dossier.** Chaque mois de retard est
un mois d'historique définitivement perdu.

---

## Les huit vues

| Vue | Répond à |
|---|---|
| `metrics_mrr` | Combien je gagne, ce mois-ci et depuis le début |
| `metrics_churn` | Combien j'en perds, et combien de temps ils restent |
| `metrics_cohortes` | Est-ce que ça s'améliore avec les nouveaux arrivants ? |
| `metrics_ltv` | Combien rapporte une famille sur toute sa vie |
| `metrics_cac` | Combien coûte une famille, et est-ce rentable |
| `metrics_entonnoir` | Où je perds les gens, de l'installation au paiement |
| `metrics_parrainage` | Le parrainage rapporte-t-il plus qu'il ne coûte |
| `metrics_famille_mois` | La brique des autres — rarement utile seule |

```sql
select * from metrics_mrr order by mois desc limit 12;
```

---

## Comment les lire

### MRR

Le revenu récurrent mensuel, hors taxes. L'annuel y est ramené au mois
(79 € / 12 = 6,58 €) : sinon un mois de ventes annuelles fait un pic magnifique
suivi de onze mois de trou, et la courbe ne veut plus rien dire.

**Objectif 10 000 familles : 99 000 € de MRR.** Repères de passage :
100 familles = 990 €, 1 000 = 9 900 €.

### Churn

Le pourcentage de clients payants perdus d'un mois sur l'autre — et son inverse,
`duree_de_vie_mois`, qui est le chiffre le plus utile de toute la liste.

- **En dessous de 5 %/mois** : bon pour une application familiale. Vingt mois
  de durée de vie.
- **5 à 8 %** : normal au démarrage, à surveiller.
- **Au-dessus de 10 %** : le produit ne tient pas ses clients. Inutile de
  dépenser en acquisition tant que ce n'est pas réglé — on remplirait un seau
  percé, et plus vite on le remplit, plus vite on perd de l'argent.

Le churn est saisonnier chez les familles : attendez-vous à une pointe en juin
et en septembre. Comparez toujours à l'année précédente, jamais au mois
précédent seul.

### Cohortes

Une ligne par mois d'arrivée, une colonne par mois écoulé depuis. Ce qu'on y
cherche n'est pas le niveau mais **la pente entre les lignes** : si la cohorte
de mars retient mieux que celle de janvier au même âge, le produit s'améliore.
C'est la seule vue qui permette de le savoir.

Ancrées sur la création du compte, pas sur le premier paiement — sinon on ne
regarde que ceux qui ont converti, et la conversion de l'essai devient invisible.

### LTV

Deux colonnes, et il faut les deux.

`revenu_encaisse_par_famille` est un **fait** : ce que la cohorte a réellement
rapporté à ce jour. Il sous-estime toujours les cohortes récentes, qui n'ont pas
fini de payer.

`ltv_projetee` est une **estimation** : 9,90 ÷ taux de churn. C'est elle qu'on
compare au CAC, mais elle ne vaut que ce que vaut le churn — donc pas grand-chose
avant six mois d'historique. À 5 % de churn : ~198 € par famille.

### CAC et le seul ratio qui décide

`metrics_cac` a besoin d'une chose que Stripe ne saura jamais : ce que la
publicité a coûté. Une ligne par mois et par canal dans `marketing_spend`,
saisie à la main :

```sql
insert into marketing_spend (month, channel, amount_eur, installs, note)
values ('2026-09-01', 'meta', 1200.00, 3400, 'campagne rentrée');
```

Cinq minutes par mois. Sans elles, le CAC est nul et `ltv_sur_cac` aussi.

**`ltv_sur_cac` est le chiffre qui décide s'il faut dépenser plus ou moins.**

- **Au-dessus de 3** : dépensez davantage, tout de suite.
- **Entre 1 et 3** : ça marche, sans marge de manœuvre.
- **En dessous de 1** : chaque client acquis coûte plus qu'il ne rapporte.
  Dépenser plus aggrave la situation au lieu de l'améliorer — c'est le piège le
  plus courant à ce stade, parce qu'il ressemble exactement à de la croissance.

Comptez aussi que Stripe prend ~0,40 € par paiement mensuel, soit ~4 % du
revenu, à déduire avant de conclure.

### Entonnoir

`installs → comptes créés → essais → payants`. Les installations viennent d'App
Store Connect et de la Play Console, qui ne se branchent pas sur la base : elles
se saisissent dans la même table que la dépense.

Le taux à surveiller est `essai_vers_payant_pct`. En dessous de 30 %, le
problème n'est presque jamais le prix : c'est que la famille n'a pas réussi à
faire fonctionner le blocage d'écran pendant l'essai. C'est le lien direct entre
ce tableau et le guide d'installation.

### Parrainage

Un mois offert vaut 9,90 € de revenu abandonné. Tant que le filleul reste plus
d'un mois, l'opération est gagnante — `gain_net` le dit mois par mois. Si elle
devient négative, c'est que le parrainage attire des gens qui partent vite, et
il faut regarder qui parraine.

---

## Le rythme

**Chaque lundi, cinq minutes** : `metrics_mrr` et la file des signalements
(`support_queue`, dans `supabase/support.sql`). Deux requêtes, une tendance.

**Le 5 de chaque mois, une demi-heure** : saisir `marketing_spend` du mois
écoulé, puis lire `metrics_cac`, `metrics_churn` et `metrics_entonnoir` dans cet
ordre. Une décision à en tirer, écrite quelque part.

**Chaque trimestre, deux heures** : `metrics_cohortes`. C'est la seule vue qui
dise si le produit s'améliore, et elle ne dit rien à moins de trois mois d'écart.

---

## Ce qui n'est pas mesuré, et c'est volontaire

Rien de ce que fait un enfant ne remonte. Pas d'événement « mission terminée »,
pas de temps passé, pas de parcours. Ce n'est pas un oubli : c'est la règle du
projet, et elle vaut plus qu'un tableau de bord.

Ce qui manque vraiment, et qu'il faudra un jour : **savoir pourquoi les gens
partent**. La donnée n'existe nulle part dans les chiffres. Le moyen honnête est
une question unique au moment de l'annulation, avec quatre réponses possibles et
un champ libre — à ajouter dans l'écran d'abonnement quand il y aura assez de
départs pour que les réponses veuillent dire quelque chose (à partir d'une
cinquantaine).
