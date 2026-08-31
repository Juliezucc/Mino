# La fiche App Store, champ par champ

`aso.md` écrit les textes qui se lisent — nom, description, mots-clés. Ce
document-ci répond aux **questionnaires**, qui ne se lisent pas et qui font
refuser : confidentialité, classification par âge, catégorie, notes à
l'examinateur.

Ils ont un point commun : Apple ne les compare pas à ce qu'on aimerait dire,
elle les compare **au binaire et à la politique de confidentialité**. Trois
sources qui doivent dire la même chose, et une seule qui fasse foi — le code.

---

## Identité

| Champ | Valeur | Limite |
|---|---|---|
| **Nom** | `Mino : une mission à la fois` | 30 · **réservé le 31/08/2026** |
| **Sous-titre** | `Contrôle parental et écrans` | 30 |
| **Nom de l'éditeur** | `Agence Wheb` | — |

> « Mino » seul était déjà pris. Le nom retenu dépense ses 28 caractères en
> marque plutôt qu'en mots-clés, ce qui a un coût réel : le nom est le champ le
> plus lourdement indexé de l'App Store. Le sous-titre le compense — il est
> indexé au même titre, et il porte donc les mots que tape un parent, pas un
> slogan. C'est un arbitrage, pas une évidence : il se rejuge sur les chiffres
> après trois mois, et le nom se change à chaque version.

**Mots-clés** (100 caractères, virgules, sans espaces, sans répéter le nom ni
le sous-titre) :

```
temps,ecran,enfant,famille,taches,routine,recompense,limiter,bloquer,ado,devoirs
```

---

## Catégorie

| | |
|---|---|
| Principale | **Éducation** |
| Secondaire | **Utilitaires** |

Éducation en premier parce que c'est là qu'un parent parcourt les applications
pour ses enfants ; Utilitaires en second parce que c'est là que se rangent les
produits de contrôle parental. Le référencement se joue de toute façon à la
recherche bien plus qu'au classement par catégorie — cet arbitrage se change
sans conséquence.

### Ne pas demander la catégorie « Enfants »

Elle paraît faite pour Mino, et elle ne l'est pas.

La catégorie *Kids* désigne les applications **destinées aux enfants**. Mino
est acheté, installé et réglé par un parent : son utilisateur est l'adulte, et
l'enfant n'a même pas de compte. La demander attirerait un examen bien plus
sévère — vérification COPPA, interdiction de tout lien sortant sans barrière
parentale, contraintes sur les achats — pour un rangement qui ne correspond pas
au produit.

---

## Classification par âge : 4+

Les réponses au questionnaire, toutes négatives sauf mention :

| Question | Réponse |
|---|---|
| Violence, réaliste ou de dessin animé | Aucune |
| Contenu sexuel ou nudité | Aucun |
| Grossièreté ou humour vulgaire | Aucun |
| Alcool, tabac, drogues | Aucun |
| Thèmes horrifiques | Aucun |
| Jeux d'argent, simulés ou réels | **Aucun** |
| Concours | Aucun |
| Accès web sans restriction | **Non** |
| Localisation de l'utilisateur | **Non** |

### Les deux questions à traiter avec soin

**La messagerie.** Répondre **non** : Mino ne comporte aucune communication
entre personnes. C'est un choix de conception, écrit dans la politique de
confidentialité et vérifiable dans le binaire — il n'existe ni fil de
discussion, ni contact, ni destinataire.

**Le compagnon.** Il existe, et il faut le déclarer. Mino embarque un
personnage qui répond à l'enfant par génération de texte. Ce n'est pas une
messagerie — l'enfant ne parle à personne — mais Apple pose désormais des
questions distinctes sur les fonctions d'IA conversationnelle, et leur libellé
change au fil des révisions du questionnaire.

**Répondre franchement, quel que soit le libellé rencontré**, et le décrire
dans les notes à l'examinateur : réponses encadrées par des règles, budget
quotidien limité, aucune donnée d'enfant transmise en clair, désactivable par
le parent enfant par enfant. Une déclaration inexacte sur ce point est un motif
de retrait, pas de simple refus — et le retrait arrive après publication,
quand des familles utilisent déjà le produit.

---

## Confidentialité — le questionnaire *App Privacy*

**À remplir avec `src/content/privacy.ts` ouvert à côté.** Les deux textes sont
lus par des personnes différentes, mais ils décrivent le même produit : une
divergence entre eux est ce qu'un examinateur repère le plus vite.

**Aucune donnée n'est utilisée pour vous suivre** — Mino ne comporte ni
publicité, ni traceur, ni mesure d'audience marketing. Il n'y a donc **aucune
invite ATT** à afficher.

### Données collectées

Toutes **liées à l'identité**, toutes pour la seule finalité *Fonctionnalité de
l'app*, aucune pour la publicité ni pour l'analyse marketing.

| Catégorie Apple | Ce que c'est chez Mino |
|---|---|
| **Coordonnées → Adresse e-mail** | celle du parent, qui ouvre le compte |
| **Coordonnées → Nom** | le prénom du parent ; le **prénom** de l'enfant |
| **Identifiants → ID utilisateur** | l'identifiant du compte et celui de la famille |
| **Achats → Historique des achats** | l'état de l'abonnement, ses dates |
| **Contenu utilisateur → Autre contenu** | les missions écrites par le parent, les missions déclarées, le grand livre des minutes |
| **Contenu utilisateur → Assistance client** | les signalements de problème envoyés depuis l'app |
| **Autres données** | l'**âge** de l'enfant, et son avatar illustré |

### Ce qu'il ne faut PAS déclarer

| Catégorie | Pourquoi non |
|---|---|
| Localisation | jamais demandée, jamais lue |
| Contacts | jamais lus |
| Photos, vidéos | l'avatar est une illustration choisie dans une liste |
| Données audio | la voix n'est ni enregistrée ni transmise |
| Historique de navigation ou de recherche | Mino n'en collecte aucun, et c'est le sens du refus de « Family Controls App and Website Usage » |
| Données d'utilisation | aucun traceur d'événements dans le binaire |
| Diagnostics | aucun outil de rapport de plantage |
| Informations financières | les coordonnées bancaires ne traversent jamais Mino |
| Données sensibles | ni origine, ni santé, ni biométrie, ni opinions |

### Le sous-traitant à ne pas oublier

Le compagnon fait appel à un service tiers pour générer ses réponses. Les
données transmises ne servent pas à entraîner de modèle et le transfert est
encadré par les clauses contractuelles types européennes — c'est écrit dans la
politique de confidentialité, et le questionnaire doit rester cohérent avec
elle.

---

## Les URL de la fiche

| Champ | Valeur |
|---|---|
| Politique de confidentialité | `https://minoapp.fr/confidentialite.html` |
| URL d'assistance | `https://minoapp.fr` |
| URL marketing | `https://minoapp.fr` |

La politique de confidentialité doit être **accessible sans compte et sans
JavaScript** : un examinateur qui tombe sur une page vide refuse, et il a
raison de le faire.

---

## Les notes à l'examinateur

C'est le champ qu'on remplit à la va-vite et qui coûte une semaine. Un
examinateur dispose d'**un seul appareil**, de quelques minutes, et d'aucune
connaissance du produit. S'il ne trouve pas comment voir ce que fait Mino, il
refuse — et le motif qu'il écrit ne dit jamais vraiment pourquoi.

**Compte de démonstration** : un vrai compte parent, avec une famille remplie —
deux enfants, des missions créées, des missions en attente de confirmation, des
minutes déjà gagnées. Un compte vide donne un écran vide, et un écran vide se
refuse.

Texte à coller, en anglais (l'examinateur ne lit pas nécessairement le
français) :

```
Mino is a parental control app. A parent creates small daily
responsibilities; when the child completes one and the parent confirms it,
the child earns screen time. Earned time is then enforced by the system:
apps the parent selected are shielded until the child starts a session.

HOW TO REVIEW ON A SINGLE DEVICE
1. Sign in with the demo account below. You land in the parent area.
2. Tap "Passer à <child>" to switch to the child profile — no second device
   is needed. Returning to the parent area asks for the parent code, given
   below.
3. From the child profile, tap "J'AI TERMINÉ" on a mission.
4. Switch back to the parent area: the mission is waiting for confirmation.
   Confirm it, and the minutes are credited immediately.

ABOUT FAMILY CONTROLS
Screen time is enforced with FamilyControls, ManagedSettings and
DeviceActivity. The parent grants the authorization once, on the child's
device, from the Blocking screen. If the authorization is declined, the app
still works and says so plainly: only automatic enforcement is disabled.
A DeviceActivityMonitor extension re-applies the shield at the deadline,
which is why the app keeps its promise when it is closed.

CHILDREN'S PRIVACY
The child has no account. We store a first name, an age and an illustrated
avatar chosen from a list — no email, no last name, no photo, no phone
number, no location. There is no advertising, no marketing tracking, no
person-to-person messaging, no public content and no public profile. Family
data is isolated at the database level, not merely by application code.

AI COMPANION
The app includes an in-app character that answers the child with generated
text. It is not messaging: the child communicates with no one. Answers are
rule-bounded, capped by a daily budget, and the parent can disable it per
child in Settings.

DEMO ACCOUNT
Email:        <à créer>
Password:     <à créer>
Parent code:  <4 chiffres>
```

> **À ne pas écrire tant que ce n'est pas vrai.** Le paragraphe *About Family
> Controls* décrit un blocage réel. Tant que le binaire soumis tombe sur le
> minuteur honnête, ce paragraphe est un mensonge — et c'est le motif de retrait
> le plus direct qui existe (Apple 2.3.1, *Accurate Metadata*). Même règle pour
> la troisième capture d'écran : voir `captures-stores.md`.

---

## L'ordre, parce qu'il compte

1. Le compte de démonstration, **créé et rempli** — c'est ce qui prend le plus
   de temps et qu'on découvre en dernier.
2. Les captures : `npm run captures`.
3. Les textes de `aso.md`.
4. Les questionnaires ci-dessus.
5. Le binaire, en dernier — parce qu'il expire, et que le reste ne bouge plus.
