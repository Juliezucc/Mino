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

## Le risque qu'il faut regarder en face : le classement d'âge

**C'est le vrai danger de cette fonctionnalité, et il est commercial, pas
technique.**

Apple et Google ont durci leurs règles sur les applications qui embarquent une
IA conversationnelle. Le questionnaire de classement d'âge d'Apple demande
désormais explicitement si l'application contient un « chatbot », et une IA
générative libre y pousse le classement très haut — jusqu'à 18+ dans les cas
non filtrés. **Une application pour enfants classée 18+ n'existe plus.**

Ce qui joue en notre faveur, et qu'il faudra savoir présenter :

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
2. **Décider si Mino entre dans la catégorie Enfants d'Apple.** Elle impose des
   contraintes supplémentaires, et une IA conversationnelle y est mal vue. Une
   application familiale hors catégorie Enfants est probablement plus sûre —
   c'est une décision à prendre avec quelqu'un qui connaît la revue Apple.
3. **Faire relire le tout par l'avocat qui reprend les CGV**, en même temps que
   le reste. Le règlement européen sur l'IA impose de dire à l'utilisateur qu'il
   parle à une machine : c'est écrit sous la conversation, il faut vérifier que
   la formulation suffit.

**Si le classement d'âge devait bloquer la sortie, la fonctionnalité peut être
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
3. **Trancher le classement d'âge** avec quelqu'un qui connaît la revue Apple,
   avant la soumission et non après.
4. **Planifier `purge_companion_messages()`** avec pg_cron. Une politique de
   conservation qui n'existe que dans un document n'est pas une politique de
   conservation.
5. **Compléter les CGV et la politique de confidentialité** : ce que Mino est,
   ce qu'il conserve, ce qu'il fait d'une confidence grave, et le fait qu'il
   n'est pas une ligne d'écoute.
