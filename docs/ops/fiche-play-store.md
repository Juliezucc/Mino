# La fiche Play Store, formulaire par formulaire

`aso.md` écrit les textes qui se lisent. Ce document-ci répond au **Contenu de
l'application** — la douzaine de déclarations que Google exige avant toute
publication, et qui bloquent la fiche tant qu'elles ne sont pas toutes vertes.

Son équivalent Apple est `fiche-app-store.md`, et **les deux doivent dire la
même chose**. Ce ne sont pas deux dossiers indépendants : c'est un seul produit
décrit deux fois, et une divergence entre les deux est ce qui se remarque le
plus vite le jour où quelqu'un les compare.

---

## Sécurité des données

Le formulaire le plus long, et le seul qui engage juridiquement. Google demande,
pour chaque type de donnée, quatre réponses : **collectée**, **partagée**,
**traitée de façon éphémère**, **obligatoire ou facultative** — puis les
finalités.

> **« Collectée » veut dire « transmise hors de l'appareil ».** C'est la
> définition de Google, et elle décide de tout ce qui suit. Une donnée qui reste
> dans les préférences locales n'est pas collectée, même si l'application la lit.
> Voir plus bas la liste des applications encadrées, qui est exactement ce cas.

### Ce que Mino collecte

Tout est **collecté**, jamais **partagé**, jamais **éphémère**, et la finalité
est toujours **Fonctionnalité de l'application**. Aucune donnée ne sert à la
publicité, au marketing, ni à la personnalisation.

| Catégorie Google | Type | Ce que c'est chez Mino | Obligatoire ? |
|---|---|---|---|
| Informations personnelles | **Nom** | le prénom du parent, le prénom de l'enfant | oui |
| Informations personnelles | **Adresse e-mail** | celle du parent, qui ouvre le compte | oui |
| Informations personnelles | **Identifiants utilisateur** | l'identifiant du compte et celui de la famille | oui |
| Informations personnelles | **Autres informations** | l'âge de l'enfant, son avatar illustré | oui |
| Informations financières | **Historique des achats** | l'état de l'abonnement et ses dates | oui |
| Activité dans l'application | **Autre contenu généré par l'utilisateur** | les missions, les minutes, le grand livre, et le texte des signalements de problème | oui |
| Applications : infos et performances | **Journaux de plantage** | la pile d'appels envoyée par `ErrorBoundary` (`support_reports.stack`) | oui |
| Applications : infos et performances | **Diagnostics** | version, plateforme, système, écran d'où part le rapport, compteurs | oui |
| ID de l'appareil ou autres identifiants | **ID de l'appareil** | le jeton de notification (`push_tokens`, `supabase/notifications.sql:20`) | oui |

Neuf entrées, contre dix chez Apple : Google range les signalements écrits par
le parent avec le reste du contenu utilisateur, là où Apple leur donne une
catégorie « Assistance client » à part. Même donnée, découpage différent.

### Ce qu'il ne faut PAS déclarer

| Catégorie | Pourquoi non |
|---|---|
| Position | jamais demandée, jamais lue : aucune trace de `expo-location`, `NSLocation` ni `ACCESS_FINE_LOCATION` dans le projet |
| Informations personnelles → Adresse, Téléphone, Orientation, Origine, Convictions | jamais demandées |
| Informations financières → autres que l'historique des achats | aucune coordonnée bancaire ne traverse Mino ; Apple et Google encaissent |
| Santé et fitness | rien |
| Messages | aucune communication entre personnes, par conception |
| Photos et vidéos | l'avatar est une illustration choisie dans une liste |
| Fichiers, documents, agenda, contacts | rien |
| Enregistrements audio | la voix n'est ni enregistrée ni transmise |
| Activité → **Applications installées** | **le cas à comprendre.** Le sélecteur lit bien la liste des applications lançables — c'est le seul moyen de laisser le parent choisir ce qu'il encadre. Mais elle ne quitte jamais l'appareil : elle est écrite dans les préférences locales du module et n'entre dans aucune requête. Elle n'est donc pas « collectée » au sens de Google. Voir `PickerActivity` et la déclaration `<queries>` du manifeste. |
| Activité → Recherche dans l'application, Historique de navigation | Mino n'en conserve aucun |
| Activité → Interactions avec l'application | aucun traceur d'événements dans le binaire : ni Firebase, ni Amplitude, ni aucun autre |

### Les trois questions de fin

| Question | Réponse | Pourquoi |
|---|---|---|
| Les données sont-elles chiffrées en transit ? | **Oui** | tout passe par HTTPS, sans exception |
| Fournissez-vous un moyen de demander la suppression des données ? | **Oui** | Réglages → « Gérer mon compte » → suppression immédiate et définitive. Voir `deleteAccount` et la réponse `supprimer-compte` de la FAQ |
| Les données sont-elles collectées auprès d'enfants ? | voir ci-dessous | ce n'est pas une case à cocher à la légère |

---

## Public cible et contenu

**Tranche d'âge visée : les adultes (18 ans et plus).** Mino est acheté,
installé et réglé par un parent ; l'enfant n'a même pas de compte. C'est le même
raisonnement qui fait refuser la catégorie « Enfants » chez Apple.

Google demande ensuite si l'application **attire malgré tout les enfants**
(« unintentionally appealing to children ») : mascotte, couleurs vives, avatars.
Répondre **franchement oui** et le décrire. Une déclaration inexacte ici fait
entrer l'application dans le programme *Familles* par la mauvaise porte — avec
une suspension à la clé plutôt qu'un simple refus.

**Publicité : non.** Aucune, jamais. C'est une règle du produit, pas un état de
fait provisoire.

---

## Autorisations sensibles à justifier

Trois autorisations demandent une justification écrite, et Google la lit.

| Autorisation | Ce qu'elle sert | Ce qu'on écrit |
|---|---|---|
| `PACKAGE_USAGE_STATS` | savoir quelle application est au premier plan | c'est la seule façon, sur Android, de savoir quand poser le bouclier. Aucune application consultée n'est transmise ni conservée. |
| `SYSTEM_ALERT_WINDOW` | afficher l'écran Mino par-dessus | l'écran ne recouvre que les applications que le parent a lui-même choisies, et jamais le composeur téléphonique. |
| `FOREGROUND_SERVICE_SPECIAL_USE` | maintenir le veilleur en vie | Android tue un service d'arrière-plan, et un bouclier qui s'éteint tout seul ne bloque rien. La notification permanente est visible du parent comme de l'enfant. |

Le manifeste porte déjà la justification du service spécial dans
`PROPERTY_SPECIAL_USE_FGS_SUBTYPE`. Elle doit rester d'accord avec ce qui est
écrit ici.

**`QUERY_ALL_PACKAGES` n'est pas demandée, et ne doit pas l'être.** Le manifeste
déclare une intention `<queries>` qui donne accès aux seules applications
lançables — tout ce dont le sélecteur a besoin. L'autorisation large est
restreinte par Google, exige une justification à chaque mise à jour, et
n'apporterait rien de plus.

---

## L'ordre

1. Envoyer un bundle en **test interne** — sans lui, Play ne laisse rien créer.
2. Les deux abonnements : `mino.premium.monthly`, `mino.premium.yearly`, mêmes
   identifiants et mêmes prix que chez Apple.
3. Le **Contenu de l'application**, formulaire par formulaire.
4. Les textes et les visuels : `store/android/`, `store/play/`.
5. La version de production, en dernier.
