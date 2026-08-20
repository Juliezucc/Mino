# Lancement

Le plan des trois mois qui entourent la sortie. Calé sur une **rentrée de
septembre** : c'est le pic de l'année pour ce sujet, et le seul moment où un
parent cherche activement à remettre des règles en place.

---

## Ce qui doit être vrai avant de lancer quoi que ce soit

Cette liste n'est pas une checklist de confort. Chaque ligne manquante coûte
soit des clients, soit une sanction.

- [ ] **Habilitation Apple Family Controls obtenue.** Sans elle, l'application
      compte le temps sans rien bloquer. Le délai ne dépend pas de nous et se
      compte en semaines : c'est le chemin critique, à demander en premier.
- [ ] **Le module natif de blocage fonctionne** sur un iPhone et un Android
      réels, testé par quelqu'un qui n'est pas son auteur.
- [ ] **CGV et politique de confidentialité relues par un avocat.**
- [ ] **Médiateur de la consommation souscrit** — obligatoire, et actuellement
      manquant dans les CGV.
- [ ] `scale.sql`, `support.sql` et `analytics.sql` appliqués, et vérifiés sur
      un projet de test.
- [ ] **Le journal de facturation écrit vraiment** : un paiement de test doit
      créer une ligne dans `billing_events`. Sans lui, tout l'historique du
      lancement est perdu, définitivement.
- [ ] Sauvegardes quotidiennes activées.
- [ ] Fiches boutiques prêtes ([`aso.md`](aso.md)).
- [ ] Page web avec l'essai, les CGV, la confidentialité et la FAQ publiée
      (`npm run faq` produit `docs/support/faq.md`).
- [ ] Une adresse de contact relevée quotidiennement.

---

## J-60 : la bêta fermée

**30 à 50 familles.** Recrutées à la main : entourage, associations de parents,
un ou deux professionnels de l'enfance.

L'objectif n'est pas de valider le produit — c'est de découvrir **où les gens
abandonnent l'installation**. Chez une application de contrôle parental, entre
30 et 50 % des installations échouent à la configuration du blocage. C'est là
que se joue la conversion, et c'est le seul moment où on peut encore corriger le
parcours avant que le volume n'arrive.

Ce qu'on mesure, et rien d'autre :

1. Combien vont jusqu'au blocage réellement actif ?
2. Combien de temps entre l'installation et la première mission validée ?
3. Combien sont encore actives à J+14 ?

Ce qu'on demande à chacune, par téléphone et pas par formulaire : *« Racontez-moi
ce que vous avez fait, écran par écran, la première fois. »* Une seule question,
et elle révèle plus que trente réponses à un questionnaire.

**Critère pour continuer : 70 % arrivent au blocage actif.** En dessous, on
corrige le parcours et on refait une bêta. Lancer avec un parcours
d'installation cassé, c'est acheter des essais qui ne convertiront pas.

---

## J-30 : la bêta ouverte

**300 à 500 familles**, recrutées par les relais de confiance et les groupes de
parents. Essai de 60 jours au lieu de 30 : ces familles-là méritent d'être
traitées comme des parrains.

Ce qu'on installe à ce moment :

- La file des signalements consultée **tous les matins** (`support_queue`).
- Le premier chiffre de conversion essai → payant. C'est lui qui dira si le
  budget d'acquisition tient.
- Les premiers avis dans les boutiques — à solliciter explicitement auprès des
  familles contentes, au moment où elles le sont.

---

## Semaine 0 : la sortie

**Fin août, une semaine avant la rentrée scolaire.**

Dans l'ordre, sur trois jours :

1. **Les bêta-testeurs d'abord.** Un e-mail personnel : le produit est sorti,
   voici votre code de parrainage. Ce sont eux qui feront les premiers relais,
   et ils ont gagné le droit d'être prévenus avant les journalistes.
2. **Les relais de confiance** — associations, professionnels — avec un compte
   offert et de quoi en parler.
3. **La presse**, le lendemain. Une seule chose à raconter, et ce n'est pas la
   liste des fonctionnalités : *une application où le temps d'écran se gagne au
   lieu de se négocier.*

**Pas de publicité payante la première semaine.** Elle amplifierait un parcours
qu'on n'a pas encore vu tenir sous charge, et le budget vaudra bien plus cher
une fois les taux stabilisés.

---

## Semaines 1 à 4 : tenir

Le travail n'est plus l'acquisition, c'est de regarder ce qui casse.

- Signalements dépouillés chaque matin, sans exception.
- Chaque avis à une ou deux étoiles reçoit une réponse. Publiquement, sans
  défensive, avec une correction quand elle est méritée. Un avis négatif bien
  traité vaut mieux qu'un avis négatif de moins.
- Le premier chiffre de churn à J+30 : il décide de tout ce qui suit.

**Le déclencheur pour ouvrir la publicité** : churn sous 8 %, conversion
au-dessus de 25 %, installation qui aboutit dans 70 % des cas. Les trois, pas
deux sur trois.

---

## Mois 2 et 3 : la rentrée

C'est maintenant qu'on dépense, et seulement si les trois seuils sont tenus.

- Publicité Meta, budget croissant par paliers, **CAC surveillé chaque semaine**
  et coupure immédiate au-dessus de 66 €.
- Deux ou trois opérations avec des créateurs de contenu parentalité, chacune
  avec son code de parrainage pour être mesurable.
- Les articles de fond publiés — ils ne rapporteront rien avant six mois, ce qui
  est exactement la raison de les publier maintenant.

---

## Ce qui ferait échouer ce plan

Trois choses, par ordre de probabilité :

1. **L'habilitation Apple qui tarde ou qui est refusée.** Tout le reste en
   dépend. Plan de repli : sortir d'abord sur Android, où le blocage ne demande
   pas d'habilitation, et faire d'iOS une seconde vague.
2. **Un parcours d'installation qui perd la moitié des familles.** Détectable
   dès la bêta fermée, réparable à ce moment-là seulement — après, le volume
   masque le problème derrière une moyenne.
3. **Dépenser avant que le churn ne soit tenu.** L'erreur la plus fréquente,
   parce qu'elle ressemble à de la croissance pendant trois mois avant de
   ressembler à ce qu'elle est.
