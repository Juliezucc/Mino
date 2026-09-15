# Mesurer une campagne sans trahir la politique

Écrit le 15 septembre 2026, quand Julie a demandé si elle pouvait suivre les
parents avec un pixel Meta pour son ciblage. La réponse est oui sur le site,
non dans l'application — et il y avait une phrase à changer avant, que la
session marketing n'avait pas vue.

---

## Ce que le produit promettait, et qui bloquait

La politique de confidentialité, section 11, disait :

> « Notre site web n'utilise que les cookies strictement nécessaires à son
> fonctionnement et au paiement, **qui ne requièrent pas de consentement
> préalable**. Nous n'utilisons pas de régie publicitaire. »

Trois affirmations devenaient fausses le jour où un pixel serait en ligne sur
`minoapp.fr`. Et le chapeau de la politique en portait une quatrième, sans
restriction de périmètre : « Pas de traceur publicitaire. »

La section 11 est réécrite : elle décrit désormais une RÈGLE (rien sans
consentement) plutôt qu'un INVENTAIRE (il n'y a rien). Elle est donc vraie
aujourd'hui, où il n'y a aucun traceur, et elle restera vraie le jour où le
bandeau et le pixel existeront. Le chapeau, lui, limite explicitement sa
promesse à l'application.

**Ce qui reste à faire avant qu'un pixel soit légitime**, et dans cet ordre :

1. Publier la nouvelle politique — sur le site d'abord, dans l'application au
   build suivant.
2. Poser un bandeau de consentement sur le site : consentement **préalable**,
   refus aussi simple qu'accepter, choix révocable. Il n'y en a pas
   aujourd'hui, parce que la politique disait qu'il n'en fallait pas.
3. Ne déclencher le pixel qu'après acceptation.

Sans les trois, le site contredit son propre texte.

---

## Dans l'application : non, et ce n'est pas négociable

Trois raisons qui tiennent chacune toute seule :

- **La déclaration App Store.** « Aucune donnée n'est utilisée pour vous
  suivre » a été remplie ainsi. Un SDK publicitaire la rend fausse, sur
  précisément le point qu'un examinateur recoupe avec le binaire.
- **`NSUserTrackingUsageDescription`.** Voir `docs/ops/fiche-app-store.md` : la
  clé a déjà figuré dans `app.json` par erreur, avec une phrase bien
  intentionnée, et elle annonce une capacité que le code n'a jamais eue.
- **L'application est utilisée par des enfants.** Un traceur y collecterait des
  données d'enfants, ce que le produit refuse et ce que la politique interdit.

---

## SKAdNetwork : compatible, et c'est le seul moyen de ne pas être aveugle sur iOS

Les identifiants des régies dans `Info.plist` ne collectent rien, ne
déclenchent aucune invite ATT, et ne changent pas la déclaration « aucune
donnée utilisée pour vous suivre » — c'est le mécanisme qu'Apple propose **à la
place** du suivi, pas une forme de suivi.

Vérifié : la seule phrase du produit qui aurait pu gêner, « aucune mesure
d'audience marketing » (`src/content/privacy.ts`, section sur l'expérience
enfant), limite sa portée à l'expérience enfant. Elle reste vraie.

**Ce qu'il faut, et que je ne peux pas inventer** : les identifiants viennent de
Meta et de Google, et ils changent. Les prendre dans leur documentation au
moment de compiler, jamais de mémoire ni d'un article de blog.

Ils se posent dans `app.json`, sous `ios.infoPlist` :

```json
"SKAdNetworkItems": [
  { "SKAdNetworkIdentifier": "…meta…" },
  { "SKAdNetworkIdentifier": "…google…" }
]
```

Le dépôt n'en contient aucun aujourd'hui.

---

## Ce qui marche déjà, sans rien poser

- **Les analyses des boutiques**, gratuites : App Store Connect et la Play
  Console donnent l'origine des installations, campagne par campagne.
- **Une adresse de destination par campagne** vers `minoapp.fr/telecharger`,
  qui aiguille ensuite selon l'appareil.
- **Les codes de parrainage**, qui existent déjà et qui relient une famille à
  celle qui l'a amenée.

Pour CIBLER, Meta n'a besoin de rien dans l'application : une audience
construite depuis les visiteurs du site suffit. Ce qu'on perd sans SKAdNetwork,
c'est l'ATTRIBUTION de l'installation — savoir quelle annonce a produit quel
téléchargement.

---

**Ce document n'est pas un avis juridique.** Julie a dit vouloir faire vérifier
les textes par un juriste ; la section 11 réécrite fait partie de ce qui doit
lui être montré.
