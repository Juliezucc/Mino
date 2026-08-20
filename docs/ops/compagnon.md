# Mino qui parle

**Quand il n'y a plus de temps d'écran, Mino reste.** C'est la seule chose de
l'application qui ne demande rien en échange — et la seule qui pourrait trahir
la promesse du produit, puisqu'elle consiste à offrir un écran à un enfant qui
vient d'en perdre l'usage.

D'où le principe qui gouverne tout ce qui suit : **une conversation réussie
avec Mino est une conversation courte qui finit dehors.**

---

## Ce que ça coûte

Modèle : **Claude Haiku 4.5** — 1 $ le million de jetons en entrée, 5 $ en
sortie, et **10 %** du prix d'entrée pour ce qui est mis en cache.

Par échange :

| | Jetons | Coût |
|---|---|---|
| Consigne système, **mise en cache** | ~1 100 | 0,000 11 $ |
| Contexte du jour (missions, solde) | ~180 | 0,000 18 $ |
| Fil de la conversation (6 tours max) | ~300 | 0,000 30 $ |
| Réponse de Mino (2–3 phrases) | ~70 | 0,000 35 $ |
| **Total** | | **~0,000 94 $**, soit **0,09 centime** |

**Par famille et par mois :**

| | Coût |
|---|---|
| Usage réaliste (40 % des jours, 8 échanges, 1,8 enfant) | **~0,15 €** |
| Plafond absolu (chaque enfant, chaque jour, 20 échanges) | **~0,93 €** |

**À 10 000 familles : ~1 500 €/mois en usage réaliste**, contre ~69 500 € de
revenu net. Soit **2 %**. Le plafond dur, lui, est à ~9 300 €/mois — d'où
l'importance de ce qui suit.

### Les trois choses qui tiennent ce chiffre

1. **Le budget de 20 échanges par jour, compté en base.** C'est à la fois la
   promesse du produit et le plafond de dépense : les deux se cassent au même
   endroit. Il est tenu par `companion_consume()`, de façon atomique — deux
   messages simultanés ne passent pas pour un seul crédit — et l'appareil de
   l'enfant ne fait que l'afficher. Une application réinstallée, une date
   changée dans les réglages ou un stockage effacé ne rendent pas la journée
   illimitée.

2. **La consigne système ne bouge jamais d'un caractère.** C'est elle qui est
   mise en cache. Y glisser un prénom, une heure ou un compteur annulerait le
   cache à chaque message et **multiplierait la facture par dix**, sans que
   rien ne le signale. Un test le vérifie (`companion.test.ts` → « garde la
   consigne système strictement stable ») ; ne le supprimez pas.

3. **Les réponses sont courtes.** La sortie coûte cinq fois l'entrée.
   `max_tokens: 200` et une consigne qui dit « deux ou trois phrases, jamais
   plus » — ce qui se trouve être aussi la bonne façon de parler à un enfant.

Le fil est limité à **six tours** : au-delà, Mino ne devient pas meilleur, il
devient seulement plus cher, puisque l'historique est refacturé à chaque phrase.

**À surveiller :** `metrics_compagnon` donne les messages par enfant et par
mois. Si la moyenne approche du plafond, c'est que le budget est trop haut —
pas seulement pour la facture, mais parce que le produit aura échoué à faire
sortir les enfants.

---

## La sécurité, et la position qu'on tient

C'est le seul endroit de l'application où une erreur ne se corrige pas par une
mise à jour.

**Un enfant finira par confier quelque chose de grave à Mino.** Pas
« peut-être » : sur dix mille familles, certainement. La question n'est pas de
l'éviter, elle est de savoir ce qui se passe ce jour-là.

### Ce qui se passe

Le message est trié **avant tout appel au modèle**, par une liste de motifs, et
le tri est fait deux fois — sur l'appareil, pour que la phrase ne parte pas sur
le réseau, et sur le serveur, parce que le client peut être modifié.

Sur une alerte, Mino ne conseille pas, ne creuse pas, ne rassure pas à tort. Il
répond **une phrase écrite à la main** — le seul texte de l'application dont le
contenu ne dépend d'aucune probabilité — qui oriente vers un adulte de
confiance et vers le **119**, avec un bouton pour l'appeler. La conversation
s'arrête là.

### Ce qui ne se passe pas, et pourquoi

**Le parent n'est pas prévenu automatiquement.** C'est un choix, et il mérite
d'être défendu : dans le cas précis où le parent est en cause, une alerte
automatique mettrait l'enfant en danger. Le 119 a des humains au bout du fil,
gratuits et confidentiels ; nous n'en avons pas.

**Il n'y a personne derrière pour lire en temps réel**, et le produit ne doit
jamais laisser croire le contraire. Les conversations sont lisibles par les
parents, pas surveillées par nous.

Le filet est **volontairement large** : un faux positif coûte une conversation
interrompue, un faux négatif coûte tout autre chose.

### Ce que les parents contrôlent

- **Un interrupteur par enfant.** Allumé par défaut, éteint en une touche, sans
  explication à donner. Une famille peut très bien ne pas vouloir que son enfant
  parle à un personnage. Éteint, la route est fermée — pas seulement le bouton :
  un réglage qui ne tient que par l'interface n'est pas un réglage.
- **La lecture de toutes les conversations**, et l'enfant en est prévenu sous la
  sienne. Laisser croire à un enfant qu'un espace est privé alors qu'il ne l'est
  pas est un mensonge qu'il découvrira un jour.
- Les messages marqués comme alerte sont **encadrés** dans la vue parent, pour
  qu'un parent qui parcourt ne puisse pas les manquer.

**Conservation : trente jours, puis effacement** (`purge_companion_messages()`,
à planifier avec pg_cron). Le cahier des charges dit « ne collecter aucune
donnée enfant inutile » : un message d'enfant de six ans gardé deux ans n'a
aucune utilité et beaucoup d'inconvénients.

---

## Le classement d'âge, et ce qu'il faut vraiment vérifier

> **Correction.** Une version antérieure de ce document présentait le
> classement d'âge comme le danger principal, en évoquant un risque de 18+.
> C'était trop alarmiste. Le nouveau système d'Apple comporte bien une
> déclaration « Messaging and Chat », mais elle peut coexister avec un
> classement 4+ ; elle vise d'ailleurs la communication **entre utilisateurs**,
> ce qu'un dialogue enfant ↔ personnage n'est pas. Apple reconnaît par ailleurs
> explicitement le cas d'un personnage dont les dialogues sont générés par IA.
> **La présence d'un personnage IA n'entraîne donc pas un classement élevé
> automatique.**

Le sujet reste à traiter, mais il se déplace : la question n'est pas « une IA
va-t-elle nous faire classer 18+ ? », c'est **« Mino doit-il être soumis en
catégorie Enfants, et le transfert des conversations à un sous-traitant est-il
conforme ? »**

Ce qui joue en notre faveur dans le questionnaire, et qu'il faudra savoir
présenter :

- ce n'est **pas un chatbot généraliste** : le personnage a un rôle unique,
  borné par une consigne, sans navigation web, sans génération d'images, sans
  accès à autre chose que les missions de l'enfant ;
- **aucun contact humain n'est possible** — pas de salon, pas de partage, pas de
  message d'un autre utilisateur ;
- il y a **un filtre de sécurité**, une orientation vers une ligne d'écoute
  nationale, un plafond quotidien, un contrôle parental et une visibilité
  parentale complète ;
- les conversations sont **conservées trente jours**, pas indéfiniment.

**Ce qu'il faut faire, et avant la soumission :**

1. **Répondre honnêtement au questionnaire de classement** en décrivant le
   filtrage et le contrôle parental. Mentir y est le plus court chemin vers un
   retrait.

2. **Trancher la catégorie Enfants.** C'est la vraie décision. Elle impose des
   contraintes fortes sur les données personnelles, les services tiers et les
   liens externes — et les conversations d'un mineur y sont explicitement des
   données personnelles. Une application familiale hors catégorie Enfants est
   probablement plus simple à tenir, mais c'est un arbitrage commercial autant
   que réglementaire : à prendre avec quelqu'un qui connaît la revue Apple.

3. **Le point le plus concret : le transfert des conversations à Anthropic.**
   Les messages d'un enfant partent chez un sous-traitant pour être traités.
   Cela demande, au minimum : la mention explicite du sous-traitant dans la
   politique de confidentialité, un accord de traitement signé, la vérification
   que les données ne servent pas à entraîner de modèle, et une position claire
   sur le lieu de traitement. **C'est ce qui doit être vérifié avant
   publication**, plus encore que le classement lui-même.

4. **Faire valider le parcours de crise par un professionnel.** Le
   fonctionnement décrit plus haut — arrêt, orientation vers un adulte, 119 — a
   été conçu ici, sans expertise en protection de l'enfance. Le raisonnement
   tient, mais **ni le déclenchement ni les formulations ne devraient partir en
   production sans avoir été relus par quelqu'un dont c'est le métier.** Pour
   une fonctionnalité qui s'adresse à des enfants de cinq ans, c'est un
   prérequis, pas une amélioration.

5. **Faire relire le reste par l'avocat qui reprend les CGV.** Le règlement
   européen sur l'IA impose de dire à l'utilisateur qu'il parle à une machine :
   c'est écrit sous la conversation, il faut vérifier que la formulation suffit
   pour un enfant.

**Si l'un de ces points devait bloquer la sortie, la fonctionnalité peut être
désactivée sans toucher au reste** : l'interrupteur existe déjà par enfant, et
un réglage global le rendrait inerte. Rien d'autre dans l'application n'en
dépend.

---

## Comment c'est construit

```
L'enfant écrit
  → tri de sécurité SUR L'APPAREIL  (une phrase grave ne part pas sur le réseau)
  → fonction serveur `companion`
      → tri de sécurité À NOUVEAU   (le client peut être modifié)
      → companion_consume()          (atomique, avant l'appel)
      → Claude Haiku 4.5             (consigne en cache + contexte du jour)
      → companion_messages           (30 jours)
  → l'écran affiche la réponse
```

**La clé d'API n'est jamais dans l'application.** Une clé embarquée dans un
binaire mobile est une clé publique, et celle-ci se facture à l'usage : c'est
la seule raison d'être de la fonction serveur.

**Sans backend, Mino répond quand même**, depuis une liste écrite à la main
(`LocalCompanionService`). C'est ce qui tourne dans l'aperçu web et dans la
démo, et c'est aussi ce qui prend le relais si le modèle est indisponible. Un
enfant venu parler à Mino ne doit jamais tomber sur une erreur — au pire sur un
Mino moins bavard. Quand le modèle échoue après que le crédit a été pris,
`companion_refund()` le rend : un enfant ne paie pas nos pannes.

### Les défis hors écran ne sont pas générés

Ils viennent d'une **liste écrite à la main**, filtrée par âge, et Mino choisit
dedans. Même prudence que « sans objet tranchant ni cuisson » sur les missions,
et pour la même raison : un modèle qui improvise un défi pour un enfant de cinq
ans finira un jour par l'envoyer chercher quelque chose dans un tiroir à
couteaux, et personne ne le relira avant lui.

---

## Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié** — 19 tests sur les règles, et un parcours complet dans le
navigateur :

```
1. avec des minos, pas de chat        correct
2. à zéro, Mino reste                 oui
3. bouton de chat                     présent
4. première phrase                    juste
5. dit que c’est un personnage        oui
6. connaît ses missions               OUI
7. propose un défi                    oui
8. confidence grave → arrêt           OUI
9. bouton d’appel du 119              présent
```

Deux défauts réels ont été trouvés en le faisant tourner, pas en le relisant :

- **l'apostrophe.** Les motifs de sécurité utilisaient `'`, or un clavier de
  téléphone produit `’`. Le filet ne fonctionnait donc que sur la moitié des
  appareils — et paraissait en place sur l'autre moitié, ce qui est pire que
  s'il avait été absent. Corrigé par une normalisation, des deux côtés.
- **« Je m'ennuie » était classé comme chagrin**, donc Mino répondait « tu veux
  en parler à un adulte ? » à un enfant qui demandait simplement quoi faire.
  C'est l'exemple exact de l'intention d'origine, et il était cassé. L'ennui est
  désormais traité pour ce qu'il est : le meilleur moment de la journée pour
  proposer un défi.

**Non vérifié** : `companion.sql` n'a jamais été appliqué et la fonction
`companion` n'a jamais tourné — il n'y a ici ni projet Supabase actif, ni clé
d'API. **Personne n'a encore vu une seule réponse écrite par le vrai modèle.**
Le ton de Mino ne pourra être jugé qu'à ce moment-là, et il faudra presque
certainement retoucher la consigne après l'avoir lu.

---

## Ce qu'il reste à faire

1. **Déployer et lire cinquante conversations réelles.** La consigne est écrite
   d'après une intention, pas d'après des réponses observées.
2. **Faire tester par de vrais enfants de cinq, huit et quatorze ans.** Le
   registre adolescent est le plus fragile : la limite entre chaleureux et
   infantilisant ne se calcule pas.
3. **Trancher la catégorie Enfants et le transfert des conversations** avant la
   soumission, et faire valider le parcours de crise par un professionnel de la
   protection de l'enfance — voir la section ci-dessus.
4. **Planifier `purge_companion_messages()`** avec pg_cron. Une politique de
   conservation qui n'existe que dans un document n'est pas une politique de
   conservation.
5. **Compléter les CGV et la politique de confidentialité** : ce que Mino est,
   ce qu'il conserve, ce qu'il fait d'une confidence grave, et le fait qu'il
   n'est pas une ligne d'écoute.

---

## À qui appartient l'appareil

Une question posée en même temps que le compagnon, et qui touche au même
endroit : **un enfant ne doit pas pouvoir prendre le profil d'un autre.** Les
minos d'un frère sont à une touche, et il suffit de les lancer.

Le réglage vit **sur l'appareil**, pas dans le compte (`data/deviceProfile.ts`,
AsyncStorage) : la tablette du salon et le téléphone de Noah appartiennent à la
même famille et ne doivent pas se comporter pareil.

| Mode | Ouverture | Changer de profil |
|---|---|---|
| **Partagé** (défaut) | sur le dernier profil utilisé | libre |
| **Réservé à un enfant** | toujours sur lui | demande le code parent |

Dans les deux cas, **on ne repasse plus par « Qui utilise Mino ? » à chaque
lancement.** C'était une friction quotidienne sans aucune justification sur un
téléphone personnel.

Un point dit franchement dans les réglages plutôt que caché : **sur un appareil
partagé, les enfants se voient.** C'est inhérent à un appareil partagé, et le
parent le choisit en connaissance de cause.

Deux garde-fous qui n'ont l'air de rien :

- un verrou qui pointe vers un enfant supprimé **ne se rabat pas en douce** sur
  le dernier profil utilisé — le parent avait demandé un appareil réservé ;
- la croix de l'écran de code, sur un appareil réservé, **ramène à l'enfant et
  non au sélecteur** : une barrière qu'un bouton « retour » contourne n'est pas
  une barrière.

---

## Le microphone

Un enfant de huit ans écrit lentement, et l'attente entre deux phrases suffit à
faire abandonner la conversation. Parler change complètement l'usage.

**La règle, et elle ne se négocie pas : aucun son ne quitte l'appareil, aucun
son n'est conservé.** La transcription se fait sur le téléphone ; seul le texte
part, exactement comme s'il avait été tapé.

Ce n'est pas de la prudence excessive. Envoyer l'enregistrement d'une voix
d'enfant à un service tiers ferait basculer Mino dans une tout autre catégorie :
donnée proche du biométrique, dossier autrement plus lourd auprès d'Apple, et
une politique de confidentialité impossible à tenir. Le gain d'usage ne vaut pas
ce risque-là.

**Conséquence assumée :** là où l'appareil ne sait pas transcrire seul, **le
bouton n'apparaît pas**. Pas de repli en ligne, pas de « juste pour cette
fois ». L'enfant se sert alors du microphone de son clavier — qui relève des
conditions d'Apple ou de Google, pas des nôtres, et **qui fonctionne déjà
aujourd'hui sans que nous ayons rien à faire**.

| Où | Moteur | Bouton micro |
|---|---|---|
| iPhone / iPad | `requiresOnDeviceRecognition: true` | seulement si le français est transcriptible hors ligne |
| Android | `EXTRA_PREFER_OFFLINE` | seulement si le pack de langue est installé |
| Navigateur | celui de l'éditeur du navigateur | oui, **et l'écran le dit** |

La ligne « navigateur » est la seule entorse, et elle est bornée : c'est
l'aperçu web, destiné à un parent qui essaie l'application, jamais le téléphone
d'un enfant. L'écran l'annonce en toutes lettres sous la conversation.

Quatre détails d'usage qui comptent plus qu'ils n'en ont l'air :

- **la dictée ne s'envoie jamais toute seule.** Le texte arrive dans le champ,
  l'enfant relit et appuie. Sinon le moindre bruit de la pièce part chez Mino ;
- **quitter l'écran coupe le micro.** Un micro qui reste ouvert parce qu'on a
  changé d'écran est exactement ce qu'on ne veut pas dans une application pour
  enfants ;
- **envoyer coupe le micro**, sans quoi la dictée continue de remplir un champ
  qu'on vient de vider ;
- **le bouton devient rouge pendant l'écoute.** Un micro ouvert doit se voir de
  loin, y compris par le parent qui passe dans la pièce.

Un refus d'autorisation est expliqué, pas réessayé en boucle : « Mino n'a pas
le droit d'écouter. Un parent peut l'autoriser dans les réglages du téléphone. »

**Non vérifié :** l'implémentation native n'existe pas encore. Le contrat est
écrit (`services/speech/native.ts`) et attend `expo-speech-recognition` avec un
plugin de configuration — impossible à compiler ni à tester ici, faute
d'appareil. **Le point à valider en premier sur un vrai téléphone est
`isOnDeviceAvailable('fr-FR')` :** si la réponse est non sur les appareils
courants, la dictée intégrée n'existera pas et il faudra assumer le micro du
clavier comme seule voie.
