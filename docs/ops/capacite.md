# Tenir 10 000 familles

Ce document répond à une question précise : ce qui est construit tient-il
10 000 familles payantes ? La réponse courte est **oui, et le coût
d'infrastructure reste marginal devant le chiffre d'affaires** — mais deux
choses ne tenaient pas et ont été corrigées (`supabase/scale.sql`).

Les volumes ci-dessous sont calculés à partir du modèle de données du projet.
Les quotas et les prix Supabase et Stripe changent : **les montants sont des
ordres de grandeur à revérifier sur les pages tarifaires avant tout engagement.**

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

### 2.1 Le temps réel — le vrai mur

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
`realtime.messages`), pas par l'application — même fonction `auth_family_ids()`
que tout le reste. Une famille ne peut pas s'abonner au canal d'une autre, même
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

### 2.4 Deux tables qui ne faisaient que grossir

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

## 3. Ce que ça coûte à 10 000 familles

### Base de données

~26 Go par an de croissance (6 600 lignes/famille/an × 10 000, index compris).
Après trois ans, ~78 Go. C'est le poste qui grossit, et il reste petit : chez
Supabase, le stockage au-delà du quota inclus se facture aux alentours de
0,10–0,15 €/Go/mois, soit **une dizaine d'euros par mois en troisième année**.

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

## 4. Ce qui reste à faire avant d'y arriver

Rien de bloquant, mais quatre points à traiter dans l'ordre :

1. **Appliquer `scale.sql`** sur le projet Supabase, et activer `pg_cron` pour
   les deux purges. Sans cela, les corrections ci-dessus n'existent que dans le
   dépôt.
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

## 5. Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié** : la borne d'historique et la reconstitution du solde sont couvertes
par des tests automatisés ; l'ensemble compile et les tests passent.

**Non vérifié faute de projet Supabase actif** : `scale.sql` n'a pas été
exécuté contre une vraie base. Les politiques et les déclencheurs sont écrits
d'après le comportement documenté de Supabase Realtime ; **il faut les
appliquer sur un projet de test et vérifier qu'un message arrive bien d'un
appareil à l'autre** avant de considérer le point 2.1 comme clos.

**Non testé en charge** : aucun tir de charge n'a été fait. Les chiffres
ci-dessus sont des calculs, pas des mesures. Le premier vrai test grandeur
nature sera le lancement.
