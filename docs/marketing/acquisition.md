# Acquisition

D'où viennent les familles. Classé par ce que ça coûte réellement, pas par ce
que ça rapporte en théorie.

Rappel du plafond : **66 € de CAC**, soit ~20 € par essai à 30 % de conversion.
Tout canal qui dépasse durablement se coupe, quelle que soit sa promesse.

---

## Ce qu'il faut savoir avant de choisir un canal

L'acheteur n'est pas l'utilisateur, et l'utilisateur n'est pas le bénéficiaire.
C'est un parent qui paie, un enfant qui s'en sert, et un foyer qui en bénéficie.
Trois conséquences :

1. **Le message parle au parent**, jamais à l'enfant. On ne fait pas de
   publicité à des enfants, ni juridiquement ni moralement.
2. **La douleur est réelle et quotidienne** : la négociation des écrans. C'est un
   sujet dont les parents parlent entre eux, ce qui rend le bouche-à-oreille
   inhabituellement efficace.
3. **La décision se prend souvent à deux.** Un parent seul convaincu doit pouvoir
   montrer quelque chose au second — d'où l'importance de la page web et de
   l'essai sans carte bancaire.

---

## Les canaux, du moins cher au plus cher

### 1. Le parrainage — coût : ~9,90 € par famille

Le meilleur CAC de la liste, et de loin, parce qu'on ne paie **qu'après** que le
filleul soit devenu payant. Détail dans [`parrainage.md`](parrainage.md).

Objectif réaliste : **20 à 30 % des nouvelles familles** au bout d'un an. En
dessous de 10 % après six mois, le mécanisme n'est pas assez visible dans
l'application — ce n'est presque jamais le montant qui est en cause.

### 2. Le référencement dans les boutiques — coût : du temps

Un parent qui tape « temps d'écran enfant » dans l'App Store est déjà convaincu
du problème : il ne reste qu'à le convaincre de la solution. C'est le trafic le
mieux qualifié qui existe, et il est gratuit.

Voir [`aso.md`](aso.md). À travailler avant le lancement, pas après : les
premières semaines de classement pèsent durablement.

### 3. Le contenu et le référencement web — coût : du temps, puis rien

Les parents cherchent en français des choses très précises : « combien de temps
d'écran à 8 ans », « comment limiter youtube sur iphone enfant », « mon enfant
fait une crise quand je coupe la tablette ».

Trois articles utiles valent mieux que trente articles creux. Chacun doit
répondre complètement, y compris quand la réponse n'est pas Mino — c'est ce qui
fait revenir, et c'est ce que les moteurs récompensent désormais.

Délai : **six à neuf mois avant le premier trafic sérieux.** À commencer
maintenant précisément pour cette raison.

### 4. Les relais de confiance — coût : du temps

Associations de parents d'élèves, pédiatres, orthophonistes, enseignants,
psychologues de l'enfance. Une recommandation d'un professionnel vaut cinquante
publicités, et beaucoup de ces professionnels cherchent activement des outils à
recommander sur ce sujet précis.

Approche : un compte offert, une vraie conversation, aucune contrepartie exigée.
Une recommandation achetée se voit et se retourne contre le produit.

### 5. La presse spécialisée — coût : du temps, effet ponctuel

Sites parentalité, rubriques famille de la presse généraliste. Un pic de quelques
jours, pas un flux. Utile au lancement, faible ensuite. À ne pas confondre avec
un canal.

### 6. Les créateurs de contenu parentalité — coût : 500 à 5 000 € par opération

Le meilleur rapport des canaux payants **si** on choisit des comptes petits et
engagés plutôt que gros et froids. Un compte de 20 000 abonnés qui parle
vraiment aux parents convertit mieux qu'un compte de 500 000.

Exiger un lien traçable et un code de parrainage dédié : sans mesure, ce canal
est un pari.

### 7. La publicité payante — coût : 30 à 80 € par essai selon la saison

Meta (Instagram, Facebook) touche exactement la cible. Deux réserves sérieuses :

- **Le coût monte fortement à la rentrée**, quand tout le secteur famille achète
  les mêmes audiences. Août et septembre coûtent le double de février.
- **La publicité ciblant les familles est encadrée.** Le message doit s'adresser
  aux parents et ne jamais être conçu pour être vu par des enfants.

À n'ouvrir qu'une fois le churn sous 8 % et la conversion au-dessus de 25 %.
Avant, c'est du budget brûlé sur un produit qui ne retient pas encore.

---

## La saisonnalité, qui décide du calendrier

| Période | Ce qui se passe |
|---|---|
| **Septembre** | Rentrée : le pic de l'année. Les règles se remettent en place. |
| **Janvier** | Bonnes résolutions, et les écrans offerts à Noël. Deuxième pic. |
| **Mars–mai** | Creux. Bon moment pour tester à bas coût. |
| **Juin–juillet** | Creux profond, et pointe de churn : les vacances suspendent les règles. |
| **Novembre–décembre** | Préparation des fêtes. Bon pour le contenu, mauvais pour la conversion. |

Conséquence directe : **le lancement se cale sur une rentrée**, et le budget
publicitaire se concentre sur septembre et janvier.

---

## Ce qu'il faut mesurer, et rien de plus

Un code de parrainage dédié par opération, et une ligne dans `marketing_spend`.
C'est tout, et c'est suffisant pour calculer un CAC par canal.

```sql
insert into marketing_spend (month, channel, amount_eur, installs, note)
values ('2026-09-01', 'meta', 1200.00, 3400, 'campagne rentrée');
```

Pas de traceur dans l'application : c'est une règle du produit, et elle ne
manque pas — le seul chiffre qui décide est le CAC, et il se calcule avec la
dépense d'un côté et les paiements de l'autre.
