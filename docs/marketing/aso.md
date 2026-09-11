# Fiches App Store et Play Store

> Les **questionnaires** — confidentialité, classification par âge, catégorie,
> notes à l'examinateur — sont dans `docs/ops/fiche-app-store.md`. Ce
> document-ci ne couvre que les textes qui se lisent.

Le trafic le mieux qualifié qui existe, et il est gratuit : un parent qui tape
« temps d'écran enfant » est déjà convaincu du problème.

À préparer **avant** le lancement. Les premières semaines de classement pèsent
durablement, et une fiche améliorée trois mois trop tard ne rattrape pas ce
qu'elle a laissé passer.

---

## Ce que cherchent les parents, en français

Par intention, de la plus fréquente à la plus précise :

| Intention | Ce qui est tapé |
|---|---|
| Limiter | « contrôle parental », « temps d'écran enfant », « limiter écran enfant » |
| Bloquer | « bloquer applications enfant », « limiter youtube enfant » |
| Organiser | « tâches enfants », « routine enfant », « responsabilités enfants » |
| Récompenser | « récompense enfant », « motiver enfant tâches » |

Mino se situe à l'intersection des deux premières familles et des deux
dernières, ce qui est à la fois sa force et sa difficulté : personne ne cherche
« gagner du temps d'écran en faisant des missions », parce que personne ne sait
que ça existe. **On se référence sur « contrôle parental », et on convainc sur
le reste.**

---

## App Store

**Nom** (30 caractères) — **réservé le 31/08/2026** :
`Mino : une mission à la fois`

> Ce document proposait `Mino — Temps d'écran gagné`. Deux choses l'ont écarté.
> D'abord « Mino » seul était déjà pris sur l'App Store, ce qu'on n'apprend
> qu'au moment de créer la fiche. Ensuite Julie a préféré la seconde moitié du
> slogan, et c'est son produit.
>
> Le coût est réel et vaut d'être écrit : le nom est le champ le plus
> lourdement indexé, et celui-ci dépense ses 28 caractères en marque plutôt
> qu'en mots-clés. Le sous-titre le compense. À rejuger sur les chiffres après
> trois mois — un nom se change à chaque version.

**Sous-titre** (30 caractères) :
`Contrôle parental et écrans`

Le sous-titre est indexé au même titre que le nom : y placer des mots, pas un
slogan. Le nom portant désormais le slogan, c'est ici que doivent tenir les
termes qu'un parent tape réellement.

**Mots-clés** (100 caractères, séparés par des virgules, sans espaces, sans
répéter ceux du nom) :

```
temps,ecran,enfant,famille,taches,routine,recompense,limiter,bloquer,ado,devoirs
```

« controle » et « parental » sont sortis de la liste : ils sont maintenant dans
le sous-titre, et Apple interdit de répéter dans les mots-clés ce qui figure
déjà dans le nom ou le sous-titre — la place gagnée sert à d'autres termes.

**Texte promotionnel** (170 caractères, modifiable sans nouvelle version — à
utiliser pour la saison) :

> Fini la négociation du soir. Votre enfant fait ses missions, gagne des
> minutes, et profite de ses écrans. Vous confirmez, c'est tout.

---

## Play Store

**Titre** (30) : `Mino : une mission à la fois`

**Description courte** (80) :
> Votre enfant gagne son temps d'écran en faisant ses missions du quotidien.

Le référencement Play s'appuie sur le texte complet plutôt que sur une liste de
mots-clés : les termes doivent apparaître **naturellement dans les phrases**,
sans entassement — qui est pénalisé.

---

## La description longue

Structure qui fonctionne pour ce public : le problème d'abord, la mécanique
ensuite, la preuve après, le prix à la fin.

> **Le temps d'écran se gagne, il ne se négocie plus.**
>
> Chaque soir, la même discussion. Mino la remplace par une règle simple, que
> les enfants comprennent tout de suite :
>
> **Je fais mes missions → je gagne du temps → je profite de mes écrans.**
>
> **Comment ça marche**
> Vous créez de petites responsabilités quotidiennes : ranger sa chambre, mettre
> la table, lire dix minutes. Chacune vaut des minutes d'écran. Votre enfant
> appuie sur « J'ai terminé », vous confirmez, les minutes arrivent aussitôt.
> Des routines toutes prêtes — matin, coucher, devoirs — créent la première
> série en une touche.
>
> **Vous décidez mission par mission**
> Certaines méritent votre œil, d'autres non. Chaque mission peut se compter
> toute seule ou passer par vous, et ça se change quand vous voulez.
>
> **Un vrai blocage, pas un simple compteur**
> Quand le temps est écoulé, les applications que vous avez choisies se
> referment. Mino, lui, reste toujours ouvert : votre enfant peut voir ses
> missions et en gagner d'autres.
>
> **Des plages libres quand vous voulez**
> Le mercredi après-midi, les vacances, le trajet du dimanche : déclarez un
> créneau et tout s'ouvre, sans qu'une minute soit décomptée. Le blocage
> revient tout seul à la fin.
>
> **Pour les grands aussi**
> À partir de treize ans, Mino change de langage : des minutes plutôt que des
> minos, des missions qui parlent d'autonomie, de travail et d'équilibre.
>
> **Les autres écrans comptent aussi**
> Console, télévision, ordinateur familial : déclarez-les, et ils entrent dans
> le même système.
>
> **À deux parents, sans partager de mot de passe**
> L'autre parent installe Mino, saisit le code famille et se choisit dans la
> liste : il voit, crée et confirme comme vous, sans compte ni adresse e-mail à
> donner.
>
> **Ce que Mino ne fait pas**
> Aucune publicité. Aucune revente de données. Aucune géolocalisation. Aucun
> profil public, aucune messagerie entre personnes. Votre enfant n'a ni compte,
> ni adresse e-mail : un prénom, un âge et un avatar illustré suffisent.
>
> **Essai de 30 jours**, puis 9,99 €/mois ou 79,99 €/an pour toute la famille,
> autant d'enfants et d'appareils que vous voulez. Annulation en deux touches.

> **Deux phrases ont été retirées le 11 septembre 2026, et il ne faut pas les
> remettre.**
>
> « Le téléphone, les messages et les appels d'urgence restent toujours
> accessibles » : Mino ne tient cette promesse sur aucun des deux systèmes.
> `applyShield` (`modules/mino-screen-time/ios/MinoScreenTimeModule.swift`) pose
> le bouclier sur exactement ce que le parent a coché, sans exception, et les
> jetons d'Apple sont opaques — l'application ne PEUT pas reconnaître Téléphone.
> Seul Android écarte le composeur par défaut, et c'est notre code qui le fait,
> pas une garantie du système. Les CGV disent désormais l'inverse de cette
> phrase : une description qui les contredit est un motif de refus, et un
> mensonge sur le seul point dont l'inexactitude peut coûter un dommage
> corporel.
>
> « Nous collectons son prénom, son âge et son avatar — rien d'autre » : faux
> dès que le compagnon est activé. Les conversations de l'enfant sont
> conservées trente jours (`supabase/companion.sql`), et son message est
> transmis à un prestataire pour générer la réponse. Le questionnaire App
> Privacy le déclare ; une description qui dit le contraire est exactement la
> divergence qu'un examinateur recoupe en premier.

> Les prix ci-dessus doivent toujours valoir `MONTHLY_PRICE_EUR` et
> `ANNUAL_PRICE_EUR` (`src/domain/billing.ts`). Ils y ont été portés à 9,99 et
> 79,99 parce que la grille d'Apple ne comporte ni 9,90 ni 79 — et une
> description qui annonce un prix que la boutique ne pratique pas est un motif
> de refus, pas une coquille.

---

## Les captures d'écran

Elles sont vues **avant** la description, et souvent à la place. Chacune porte
une phrase en haut, lisible sans zoomer.

**Elles sont générées** : `node scripts/capture-store.mjs`, légendes dans
`scripts/store-screens.json`. Contraintes de format, pièges de conformité et
justification de chaque légende : `docs/ops/captures-stores.md`.

L'ordre retenu ci-dessous est celui d'origine ; celui qui est réellement produit
compte huit visuels et figure dans le fichier de légendes.

1. **« Le temps d'écran se gagne. »** — l'écran enfant, compteur bien visible.
2. **« Vous confirmez, les minutes arrivent. »** — la demande côté parent.
   « Valider » a été abandonné partout : le mot juge la mission — on ne
   « valide » pas une chambre rangée — alors que ce qu'un parent confirme,
   c'est que son enfant l'a bien faite.
3. **« Un vrai blocage, pas un compteur. »** — le moment où le temps se termine.
   ⚠️ **À ne pas employer tant que le blocage n'est pas dans le binaire soumis.**
   Le service par défaut est `timer-only` : promettre un blocage qu'il ne fait
   pas est le motif de retrait le plus direct (Apple 2.3.1). Voir
   `docs/ops/captures-stores.md`.
4. **« Console, télé, ordinateur : tout compte. »** — l'écran Appareils.
5. **« Aucune pub. Aucune donnée revendue. »** — la promesse de confidentialité.

La cinquième compte plus qu'il n'y paraît : c'est la première inquiétude d'un
parent devant une application destinée à son enfant, et presque aucun
concurrent n'y répond frontalement.

---

## Les avis, qui pèsent autant que tout le reste

En dessous de 4,0, le classement décroche et le taux d'installation s'effondre.

**Quand demander** : après une mission confirmée, pas au premier lancement. Un
parent à qui on demande un avis avant que le produit n'ait servi met deux
étoiles, et il a raison.

**Répondre à tous les avis négatifs**, sans exception et sans défensive. La
réponse est lue par les futurs installeurs bien plus que par son destinataire :
c'est de la fiche produit, pas du service après-vente.

Beaucoup d'avis à une étoile sur ce type d'application disent la même chose :
« ça ne bloque rien ». C'est presque toujours l'autorisation système qui n'a pas
été accordée. La réponse tient en deux phrases et se trouve déjà dans la FAQ
(`applis-ne-se-bloquent-pas`) — c'est aussi pourquoi le parcours d'installation
mérite tout le soin qu'on lui donne.

---

## Le rythme

Une révision par trimestre : mots-clés selon ce qui remonte, texte promotionnel
selon la saison (rentrée en août, résolutions en janvier), captures à chaque
changement visuel notable.
