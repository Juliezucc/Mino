# Parrainage

Le canal d'acquisition le moins cher, parce qu'il est le seul qu'on ne paie
qu'**après** avoir gagné le client.

---

## Le mécanisme

| | |
|---|---|
| Le filleul reçoit | **ses 30 jours d'essai**, comme tout le monde — rien de plus |
| Le parrain reçoit | **1 mois offert**, une fois que le filleul est devenu payant |
| Plafond | **12 mois offerts par an** et par famille |

> **Le filleul recevait soixante jours, et cette ligne a changé le 9 septembre
> 2026.** Deux raisons, et la première est mécanique : le parcours d'inscription
> enregistre désormais la carte à l'entrée, et l'essai est porté par la boutique
> — une offre d'introduction Apple a une durée **fixe**, la même pour tout le
> monde. L'essai long ne survivait donc que sur le rail Stripe, c'est-à-dire
> pour une minorité de plus en plus petite. La seconde est plus simple : l'écran
> de paiement annonce « Vous avez 30 jours », et promettre le double à une
> touche d'intervalle, c'est se contredire devant quelqu'un à qui on demande sa
> carte.

Les trois règles sont dans `src/domain/billing.ts`, couvertes par des tests, et
appliquées par le webhook Stripe — pas par une note de service.

**Le parrain n'est crédité que sur une facture réellement payée.** Récompenser à
l'inscription reviendrait à payer pour des comptes, pas pour des clients : c'est
la faille par laquelle ce genre de programme se fait vider.

---

## Pourquoi ces chiffres

**Coût réel d'un filleul : 9,90 €.** À comparer aux 30 à 80 € d'un essai acheté
en publicité. Le rapport est de 1 à 5, au minimum.

**Rentable dès que le filleul reste plus d'un mois.** À 20 mois de durée de vie
moyenne, un parrainage rapporte ~198 € pour 9,90 € de coût. La vue
`metrics_parrainage` suit ce calcul mois par mois, `gain_net` en dernière
colonne.

**Le plafond de 12 par an** n'est pas une méfiance envers les parents : c'est ce
qui empêche qu'une seule famille rende l'abonnement gratuit à vie en recrutant
industriellement. Douze filleuls dans l'année, c'est déjà beaucoup de familles
convaincues — personne d'honnête ne heurtera ce plafond.

**Un mois offert plutôt qu'une réduction** : ce qui manque à une famille, ce
n'est pas 5 € — c'est le temps d'installer, de convaincre l'autre parent, et de
voir si ça tient au-delà de la nouveauté. Un mois entier répond exactement à ça.
Une réduction, non.

**Et pourquoi le filleul ne reçoit rien.** C'est contre-intuitif, et c'est
assumé : ce qu'on lui offre est déjà l'offre entière — trente jours, sans
condition, comme n'importe qui. L'argument qui le décide n'est pas une remise,
c'est qu'une famille qu'il connaît utilise Mino et le lui dit. Le programme
récompense donc celui qui a fait quelque chose.

---

## Les garde-fous, et pourquoi ils tiennent

| Risque | Ce qui l'empêche | Où |
|---|---|---|
| Se parrainer soi-même | Contrainte `referrals_no_self` | base |
| Être parrainé deux fois | Contrainte `referrals_one_per_referee` | base |
| Recrutement industriel | Plafond de 12 par an | domaine + webhook |
| Récompense sans paiement | Crédit sur `invoice.paid` uniquement | webhook |

Les deux premières sont des contraintes de base de données, pas des
vérifications applicatives : elles tiennent même si quelqu'un appelle l'API
directement.

---

## Ce qui décide du succès : où on le montre

Le montant n'est presque jamais le problème. La visibilité, si.

Trois moments, et ce sont les seuls qui comptent :

1. **Après la première mission validée.** Le parent vient de voir le produit
   marcher, pour de vrai, sur son propre enfant. C'est le moment de la
   conviction — pas l'écran d'accueil, où il ne s'est encore rien passé.
2. **Au trentième jour**, quand l'essai devient payant et que la famille reste.
   Elle vient de décider que ça valait 9,90 €.
3. **Dans les réglages**, en permanence, pour ceux qui le cherchent.

Ce qu'il ne faut pas faire : le mettre partout. Un programme de parrainage
proposé sur chaque écran devient du bruit, puis de l'agacement, puis un motif de
désinstallation.

---

## Le message

Ce qui fonctionne entre parents, c'est le service rendu, pas la récompense :

> **« Vous connaissez un parent qui négocie les écrans tous les soirs ? »**
> Offrez-lui deux mois d'essai. S'il reste, vous avez un mois offert.

Ce qui ne fonctionne pas : « Gagnez de l'argent en parrainant ». Cela transforme
une recommandation entre amis en démarchage, et les parents le sentent
immédiatement.

---

## Les chiffres à suivre

```sql
select * from metrics_parrainage order by mois desc;
```

| Indicateur | Objectif à un an | Si c'est en dessous |
|---|---|---|
| Part des nouveaux venus du parrainage | 20–30 % | Problème de visibilité |
| Filleuls devenus payants | ≥ la conversion moyenne | Problème de qualité du recrutement |
| `gain_net` | positif | Les filleuls partent trop vite |

Sous 10 % après six mois : ce n'est pas le montant, c'est qu'on ne le montre pas
au bon moment. Recommencer par le point 1 ci-dessus.

Si `gain_net` devient négatif, regarder **qui** parraine : quelques familles qui
recrutent beaucoup et dont les filleuls partent aussitôt sont le signe qu'on est
en train de payer pour des inscriptions plutôt que pour des clients.
