# Mino — ce qu'il faut savoir avant de toucher à quoi que ce soit

Ce fichier existe parce que les règles de ce projet vivaient dans une
conversation. Une conversation se termine ; le dépôt reste. Tout ce qui est
ci-dessous a été appris en le construisant, souvent en se trompant d'abord.

**Ce fichier ne remplace pas la documentation, il y conduit.** `README.md` porte
l'architecture, `docs/ARCHITECTURE.md` les décisions structurantes, et
`docs/ops/` six mille lignes sur les paiements, les notifications, le
lancement et le reste. Les messages de commit expliquent chaque défaut trouvé et
pourquoi la correction est celle-là : `git log` est la meilleure source du
dépôt, et de loin.

---

## Le produit, en une phrase

Un parent crée des **MISSIONS** quotidiennes. L'enfant appuie sur **J'AI
TERMINÉ**. Le parent confirme. Les minutes d'écran arrivent tout de suite.

**La récompense est du temps d'écran, et rien d'autre.** Pas de monnaie
virtuelle, pas de niveaux, pas de boutique, pas de mascotte à nourrir, pas de
mini-jeux, pas de RPG. Chaque fois que quelqu'un propose d'en ajouter, la
réponse est non — ce sont ces mécaniques que les parents fuient en installant
Mino.

**Le vocabulaire n'est pas décoratif.** On dit « missions », jamais
« corvées » ni « quêtes ». Le premier mot dit à un enfant que ce qu'on lui
demande est une punition déguisée ; le second transforme sa vie de famille en
jeu vidéo. Voir `README.md`.

**Le blocage des autres applications est le produit.** Un Mino qui compte des
minutes sans rien bloquer est un chronomètre. C'est la seule étape qu'on ne peut
pas faire à la place du parent, et c'est celle qu'il faut protéger dans le
parcours.

Slogan : « Grandir, une mission à la fois. » Tarifs : 9,99 €/mois,
79,99 €/an, 30 jours d'essai. Éditeur : Agence Wheb, SASU, SIREN 103 231 460.
Médiateur : CM2C.

---

## Deux registres, un seul seuil

`TEEN_FROM = 13` dans `src/domain/ageBand.ts` décide de tout ce qui suit :

- **moins de 13 ans** : des **minos**, la mascotte, les confettis, de très
  grands boutons ;
- **13 ans et plus** : des **minutes**, un ton sobre, pas de confettis, une mise
  en page dense.

Un adolescent à qui l'on sert des confettis et une monnaie appelée « minos »
ferme l'application et ne la rouvre pas. Toute tranche d'âge, tout quiz, toute
liste de suggestions qui enjambe 13 ans est un défaut.

L'enfant ne voit jamais ses missions déjà validées, et sous 13 ans il ne voit
jamais de minutes.

---

## Sécurité et données — non négociable

- Aucune donnée enfant inutile. Un prénom et un âge, rien de plus. Pas de nom de
  famille, pas de date de naissance, pas d'école.
- Pas de géolocalisation. Pas de publicité. Pas de suivi marketing côté enfant.
- Pas de messagerie. Pas de contenu public. Pas de profil public.
- **Les enfants d'une famille ne sont jamais visibles par une autre.** C'est la
  ligne sur laquelle repose tout le modèle : voir les politiques RLS dans
  `supabase/schema.sql`, et `supabase/test/rls.sql` qui les éprouve une par une.
- La clé **`service_role`** de Supabase n'entre jamais dans l'application ni
  dans le dépôt.
- **Aucun secret ne s'affiche dans un terminal ni ne se colle dans une
  conversation.** Ils passent par des fichiers en `chmod 600`, supprimés après
  usage. Exception : la clé **publiable** Stripe (`pk_`), que Stripe destine au
  code source des pages — ce n'est pas un secret. La clé secrète (`sk_`) en est
  un.

Une règle qui n'existe que dans le client n'est pas une règle. Tout ce qui
protège quelque chose doit être tenu par la base, et éprouvé par
`npm run test:sql`.

---

## Accessibilité

- Les boutons de l'enfant doivent être atteignables par un enfant de cinq ans.
- **Jamais de sens porté par la seule lecture** : icône **et** texte, partout.
- Contrastes suffisants — mesurés, pas estimés. Voir les commentaires de
  `src/theme/colors.ts`, qui expliquent pourquoi le texte sur le bleu de marque
  est marine et non blanc.
- Zones sûres iPhone et Android respectées.
- Le libellé d'un bouton doit survivre à une police agrandie à 200 %.

---

## Forme

Palette dans `src/theme/colors.ts` — bleu `#4EB6FF`, violet `#7A7CFF`, menthe
`#2BC98A`, jaune `#FFC85A`, rose `#FF7DA0`, bleu clair `#F2F6FF`, marine
`#1A1D2E`, pêche `#FFB592`. Police **Nunito**. Beaucoup de blanc, ombres très
légères, angles très arrondis.

**Tous les messages d'erreur sont en français**, y compris ceux qui viennent
d'Apple ou de Google. Un message de boutique qui atteint l'écran d'un parent en
anglais est un défaut. Voir `messageBoutique()` dans
`src/services/billing/ExpoIapStore.ts`.

Le parent est vouvoyé, l'enfant tutoyé.

---

## Contraintes techniques

**Ne jamais lancer Prettier sur ce dépôt.** Il n'y a pas de configuration, et
il reformaterait tout.

**`npm ci`, jamais `npm install`** — voir `README.md`, qui explique pourquoi.

**Les fonctions Edge tournent sous Deno.** Elles ne peuvent pas importer de
module React Native (`expo-crypto`, `expo-notifications`) ni l'alias `@/`. Elles
importent le domaine par chemin relatif **avec l'extension `.ts`**, et un import
de type doit s'écrire `import type` pour être effacé à la compilation.
`__tests__/fonctionsEdge.test.ts` parcourt le vrai graphe d'imports et refuse
tout écart — c'est une faute qui ne se voit qu'au premier appel en production.

**`env()` dans `_shared/mino.ts` lève** sur une variable absente. Utiliser
`Deno.env.get()` quand un repli est voulu.

---

## Vérifier

```
npx tsc --noEmit      # 0 erreur attendue
npm test              # ~477 essais
npm run test:sql      # ~233 vérifications, sur une base jetable
npm run compil        # ce que le typecheck ne voit pas
npm run db:bundle     # régénère supabase/tout.sql après un changement SQL
```

**Lire le code de sortie, jamais l'affichage.** Une chaîne de commandes peut
afficher une erreur et rendre 0 ; c'est arrivé, et un essai cassé a été poussé
deux fois pour cette raison.

**Éprouver un essai neuf en le cassant.** Un essai qui passe sans qu'on ait
vérifié qu'il tombe quand il le doit ne prouve rien. Deux gardes écrites ici ont
été trouvées inutiles de cette façon.

**Ce que ces commandes ne couvrent pas.** `npm run audit:a11y` n'atteint plus
qu'un écran sur onze — il passait par un bouton « Voir la démo » retiré depuis —
et annonce donc « 0 problème » en n'ayant presque rien regardé. À réparer.

---

## La leçon la plus chère

Presque tous les défauts sérieux de ce projet ont été trouvés **en conduisant un
parcours de bout en bout**, jamais en relisant un écran : une notification que
personne ne pouvait recevoir, un achat Android jeté en silence, un espace parent
ouvert à l'enfant sur la tablette qu'on venait de partager, une inscription
abandonnée qui donnait un accès gratuit à vie.

Deux corollaires :

- **Ne pas conclure sans vérifier la chose elle-même.** « Le code est juste donc
  la fonction déployée l'est aussi » est faux dès que quelqu'un a déployé depuis
  un dépôt pas à jour. Appeler le serveur ; lire le fichier ; ne pas décrire de
  mémoire.
- **Une vérification qui confirme ce qu'on espère n'est pas une vérification.**
  Un `curl` qui renvoie 200 sur un cache, un test qui passe sans exercer la
  règle, un audit qui annonce du vert sans avoir rien visité.
