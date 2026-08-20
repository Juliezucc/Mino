# Process marketing

Cinq documents, et une arithmétique à connaître avant de les lire.

| | |
|---|---|
| [`acquisition.md`](acquisition.md) | D'où viennent les familles, canal par canal |
| [`lancement.md`](lancement.md) | Le plan des trois mois qui entourent la sortie |
| [`parrainage.md`](parrainage.md) | Le mécanisme, ses chiffres, ses garde-fous |
| [`aso.md`](aso.md) | Fiches App Store et Play Store |
| [`cycle-de-vie.md`](cycle-de-vie.md) | Les e-mails, du premier jour à la résiliation |

---

## L'arithmétique de l'objectif

10 000 familles payantes, c'est **99 000 € de MRR**. Voici ce que cela demande,
avec les hypothèses écrites en clair pour qu'on puisse les contester.

### Ce qu'il faut faire entrer

| Hypothèse | Valeur retenue |
|---|---|
| Conversion essai → payant | 30 % |
| Churn mensuel | 5 % |
| Part du parrainage dans les nouveaux | 25 % à terme |

Pour 10 000 familles payantes, il faut environ **33 000 essais**. Sur 24 mois,
cela fait ~1 400 essais par mois en moyenne — mais la moyenne ment : il en faut
300 le premier mois et 3 000 le vingt-quatrième.

### Le chiffre qu'on oublie toujours

**À 10 000 familles et 5 % de churn, on perd 500 familles par mois.** Il faut
donc 500 nouvelles familles payantes chaque mois **rien que pour ne pas
reculer** — soit ~1 700 essais mensuels avant de gagner un seul client net.

C'est la raison pour laquelle le churn passe avant l'acquisition dans toutes les
priorités qui suivent. Faire baisser le churn de 5 % à 4 % vaut, à 10 000
familles, exactement autant que 100 nouvelles familles payantes par mois — et
coûte beaucoup moins cher.

### Ce qu'on peut dépenser

À 5 % de churn, une famille reste 20 mois et rapporte ~198 € (~190 € net des
frais Stripe).

| Ratio LTV/CAC | CAC maximum | Ce que ça veut dire |
|---|---|---|
| 3 (sain) | **66 €** | On peut dépenser plus, tout de suite |
| 2 (tendu) | 99 € | Ça marche, sans marge |
| 1 (perdant) | 198 € | Chaque client acquis coûte plus qu'il ne rapporte |

À 66 € de CAC et 30 % de conversion, **un essai vaut jusqu'à 20 € d'acquisition**.
C'est le chiffre à garder en tête devant n'importe quelle régie publicitaire.

Budget d'acquisition pour atteindre 10 000 en deux ans, si 75 % viennent de
canaux payants : ~7 500 familles × 66 € ≈ **500 000 €**. C'est l'ordre de
grandeur réel de l'objectif, et il faut le regarder en face avant de choisir les
canaux : soit on lève, soit on privilégie les canaux qui ne se paient pas en
euros mais en temps.

### Ce qui change tout

Un point de conversion essai → payant vaut ~3 % de budget d'acquisition en
moins. Et la première cause de non-conversion, pour une application comme
celle-ci, n'est pas le prix : c'est **la famille qui n'a pas réussi à faire
fonctionner le blocage d'écran pendant l'essai**. Le guide d'installation et
l'habilitation Apple ne sont pas des sujets techniques : ce sont les deux
premiers leviers marketing du produit.

---

## L'ordre des priorités

1. **Le churn avant l'acquisition.** Tant qu'il dépasse 8 %, dépenser en
   publicité revient à remplir un seau percé — et plus vite on le remplit, plus
   vite on perd de l'argent.
2. **La conversion avant le volume.** 1 000 essais à 40 % valent mieux que
   2 000 à 20 %, et coûtent deux fois moins cher.
3. **Le parrainage avant la publicité.** C'est le seul canal dont le coût est
   proportionnel au succès : on ne paie qu'une fois le filleul devenu payant.
4. **Le volume en dernier**, quand les trois premiers points sont tenus.

---

## Le rythme

**Chaque lundi** : `metrics_mrr`, `support_queue`, les avis des boutiques. Vingt
minutes.

**Le 5 du mois** : saisir `marketing_spend`, lire `metrics_cac`,
`metrics_churn`, `metrics_entonnoir`. Une décision écrite, pas une lecture.

**Chaque trimestre** : `metrics_cohortes`. La seule vue qui dise si le produit
s'améliore.

Comment lire ces vues : [`../ops/analytics.md`](../ops/analytics.md).
