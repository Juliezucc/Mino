# Les captures des fiches App Store et Play Store

**Générées, pas montées à la main.** Huit visuels par plateforme qui doivent
rester d'accord entre eux et avec l'application : ça ne survit pas à trois
retouches dans un éditeur d'images.

```bash
npx expo export -p web --output-dir dist
node scripts/build-web-preview.mjs
npx http-server dist -p 8099 --silent &
node scripts/capture-store.mjs
```

Les légendes vivent dans `scripts/store-screens.json`. Après un changement
d'écran, de charte ou de légende : on relance, et les vingt-six fichiers sont
refaits.

---

## Ce qui est produit

| Dossier | Format | Statut |
|---|---|---|
| `store/ios-6.9/` | 1320 × 2868 PNG | **obligatoire** — le seul jeu iPhone requis, Apple dérive les autres |
| `store/ios-ipad-13/` | 2064 × 2752 PNG | **obligatoire tant que `supportsTablet` vaut `true`** |
| `store/android/` | 1080 × 1920 JPEG | **obligatoire** — au moins deux |
| `store/play/feature-graphic-1024x500.jpg` | 1024 × 500 | **obligatoire** pour publier sur Play |
| `store/play/icon-512.png` | 512 × 512 | **obligatoire** pour publier sur Play |

Deux détails techniques qui font refuser un envoi sans rien expliquer :

- **Play refuse un PNG porteur d'un canal alpha.** Les captures Android sortent
  donc en JPEG. L'icône, elle, doit au contraire être un PNG **avec** alpha.
- **Play refuse un rapport supérieur à 2:1.** Le format natif de beaucoup
  d'Android récents — 1080 × 2400, soit 2,22:1 — est donc rejeté tel quel. D'où
  le 9:16.

---

## Les pièges de contenu, et ce qu'on en a fait

### Aucune marque tierce dans une capture

Apple 2.3.9 : on répond des droits sur tout ce qui figure dans une capture. La
famille de démonstration nommait un appareil « Nintendo Switch » — il s'appelle
désormais **« Console du salon »**. Dans l'application, un parent nomme ses
appareils comme il veut, et `DEVICE_SUGGESTIONS` continue de proposer les vraies
marques : c'est un usage descriptif, et il est utile. **Mais l'écran d'ajout
d'appareil, où ces suggestions s'affichent, ne doit jamais être photographié
pour une fiche.**

### Ne rien promettre que le binaire ne fasse

Tant que la version soumise tourne en `timer-only` — c'est-à-dire tant que le
module natif de blocage n'est pas embarqué et l'habilitation Apple obtenue —
**aucune légende ne doit contenir « bloque », « verrouille », « empêche »,
« coupe » ou « applique la limite ».** C'est le motif de retrait le plus direct
(Apple 2.3.1).

Corollaire pour les écrans déclarés : Mino ne démarre rien sur une console ou
une télévision, et n'en a pas le pouvoir. La légende dit donc « il demande,
**vous** lancez le minuteur ».

> `docs/marketing/aso.md` proposait une capture « Un vrai blocage, pas un
> compteur ». **À ne pas utiliser avant que le blocage réel soit dans le
> binaire soumis.**

### Une fiche pour familles, pas une fiche « pour enfants »

Apple 5.1.4 : les termes qui laissent entendre que le public principal est
constitué d'enfants — « pour les enfants », « dès 3 ans » — sont réservés à la
catégorie Kids. Aucune légende ne les emploie.

Apple 2.3.8 : les captures doivent convenir à un classement 4+, **même si
l'application est classée plus haut**.

### La conversation avec Mino

Elle est en septième position, jamais dans les trois premières, et montre un
échange anodin. **Aucune capture ne doit faire apparaître le 119, un message
signalé ou un sujet grave** : la fiche deviendrait une fiche sur la détresse
enfantine, et le classement d'âge suivrait.

---

## Ce que ces captures ont fait découvrir

Photographier l'iPad a révélé ce qu'aucun test n'avait signalé : **`app.json`
déclare `supportsTablet: true` et l'application n'avait aucune mise en page
tablette.** Le contenu s'étirait sur toute la largeur — une carte de mission de
mille pixels de large, un anneau de temps perdu au milieu du vide. Google
pénalise explicitement cela depuis ses règles grand écran, et Apple aurait
accepté une fiche qui donnait une mauvaise première impression.

Corrigé à la racine : `Screen` borne désormais son contenu à **620 points,
centrés**. La même colonne de lecture confortable que sur un grand téléphone,
sur iPad, sur tablette Android et dans un navigateur.

L'alternative — passer `supportsTablet` à `false` — aurait été un renoncement :
la tablette partagée du salon est précisément l'un des usages pour lesquels le
verrou d'appareil a été écrit.

---

## À vérifier au moment de la soumission

1. **Les dimensions exactes**, dans App Store Connect. Apple les ajuste sans
   prévenir, et la page de référence fait foi : elle accepte aujourd'hui trois
   tailles pour la classe 6,9 pouces (1320 × 2868, 1290 × 2796, 1260 × 2736).
   **Ne pas mélanger deux tailles dans un même jeu.**
2. **Les captures tablette Android**, si vous visez le facteur de forme :
   Google réduit la visibilité des applications qui n'en fournissent pas.
3. **Le questionnaire de classement d'âge**, à remplir en cohérence avec la
   présence du compagnon conversationnel — voir `docs/ops/compagnon.md`.
