# Le parcours d'inscription, et où se place la carte

> **État : plan, rien n'est écrit.** Ce document est à valider avant la
> première ligne de code. Il remplacera la section correspondante de
> `docs/ops/paiements.md` une fois réalisé.

## Le défaut à réparer

Le parcours actuel demande tout avant de donner quoi que ce soit.

```
Télécharger (gratuit)
→ app/onboarding/account.tsx   e-mail, mot de passe, code parent, consentement
→ ⛔ confirmation par e-mail    on quitte l'application
→ app/onboarding/child.tsx     le premier enfant
→ app/onboarding/mission.tsx   la première mission
→ app/onboarding/appareil.tsx
→ … 30 jours plus tard         app/parent/abonnement.tsx
```

Deux fautes de séquence, et une troisième qui en découle.

**On demande l'effort avant d'avoir rien montré.** Quatre champs et une case à
cocher avant que le parent n'ait vu quoi que ce soit qui ressemble à sa
famille. C'est le moment du parcours où l'on perd le plus de monde, et on l'a
placé en premier.

**La confirmation d'e-mail tombe au pire endroit** : juste après l'engagement,
juste avant la récompense. Elle envoie le parent dans sa boîte mail, souvent
dans un autre navigateur que celui où l'application est ouverte, et il revient
— quand il revient — devant un écran de connexion qui lui redemande ce qu'il
vient de taper.

**Et la carte n'est jamais demandée.** L'essai de trente jours est accordé par
le serveur, sans carte, et se termine sur un mur : au trentième jour le parent
doit revenir de son plein gré, ressortir sa carte et payer. C'est le modèle qui
convertit le moins bien qui soit. Le modèle standard — carte à l'entrée,
`0 € aujourd'hui`, prélèvement automatique au trentième jour — n'a pas la même
vertu morale mais il a les revenus, et il n'a rien de trompeur tant que le prix
et l'échéance sont écrits sur l'écran.

## Le parcours visé

```
Télécharger (gratuit)
→ 1. Le prénom de votre enfant           + son âge, son avatar, LE CONSENTEMENT
→ 2. Sa première mission                 choisie dans la bibliothèque
→ 3. Votre compte                        e-mail, mot de passe, code parent
→ 4. 💳 0 € aujourd'hui                   30 jours gratuits, puis 9,99 €/mois
     └── sortie unique : « J'ai un code de parrainage »
→ 5. L'appareil de l'enfant
```

L'ordre est le seul changement de fond : **le parent voit sa famille exister
avant qu'on lui demande quoi que ce soit.**

### Pourquoi le compte est en 3 et non en 5

Il serait tentant de le repousser après le paiement — moins de friction encore
avant la carte. C'est un piège : une famille qui paie sur une session anonyme
et n'attache jamais d'adresse est **irrécupérable à la réinstallation**. Elle a
payé, et elle ne peut plus rentrer chez elle.

Le compte se crée donc avant que le moindre euro ne bouge. Le parent a déjà vu
son enfant et sa première mission à l'écran : à cet instant, taper une adresse
n'est plus un obstacle, c'est un rangement.

### Ce que devient la confirmation d'e-mail

Rien ne change dans sa configuration : elle reste **activée**. Mais elle cesse
d'être un mur, parce qu'elle arrive alors que le parent est déjà dans
l'application, sa famille créée. Il la traitera quand il voudra ; le lien le
ramènera sur `app/confirme.tsx`, qui sait déjà où l'emmener.

## Ce que ça demande, techniquement

### 1. La session anonyme, du premier écran

`signInAnonymously()` est déjà utilisé pour les tablettes des enfants
(`SupabaseAuthService.signInAsDevice`). On s'en sert dès l'écran 1 : la famille
et l'enfant s'écrivent tout de suite, sur une identité qui n'a pas encore
d'adresse.

**À vérifier avant d'écrire** : les politiques RLS acceptent-elles qu'un
utilisateur anonyme crée une ligne `families` et une ligne `parents` ?
`parents.user_id` vaut `auth.uid()` par défaut, donc a priori oui — mais cela
se prouve avec `supabase/test/rls.sql`, pas avec un raisonnement.

### 2. Rattacher l'adresse à la session anonyme

Nouvelle méthode `AuthService.linkEmail({ email, password })`, qui appelle
`updateUser` plutôt que `signUp`. C'est le point délicat : `signUp` sur une
session anonyme crée un **second** utilisateur et abandonne le premier — avec
la famille et l'enfant dessus.

`createAccount` (`useMinoStore.ts:463`) sait déjà ne pas réinscrire quelqu'un
dont la session est ouverte, mais il teste `kind !== 'parent'` : une session
anonyme vaut `'device'`, elle repasserait donc par `signUp`. C'est exactement
le défaut à ne pas laisser passer.

### 3. Le consentement déménage, il ne disparaît pas

Il se recueille désormais sur l'écran 1, **avant** la création du profil
enfant. C'est ce que le dossier déposé chez Apple affirme, et c'est la date qui
vaut preuve (`consentAt`). Le déplacer est acceptable ; le perdre ne l'est pas.

### 4. Le paywall, et sa seule porte de sortie

Nouvel écran `app/onboarding/abonnement.tsx`, distinct de
`app/parent/abonnement.tsx` qui reste ce qu'il est. Obligations, toutes
vérifiables à la revue Apple :

- le prix, la durée de l'essai et le renouvellement automatique **sur l'écran** ;
- les liens CGV et confidentialité (motif 3.1.2, déjà rencontré) ;
- un bouton **« Restaurer mes achats »** visible ;
- une sortie : **« J'ai un code de parrainage »**, qui ouvre la saisie du code
  et, s'il est valide, laisse passer sans carte.

**Le compte de démonstration doit traverser le mur.** Un paywall infranchissable
bloque aussi le vérificateur d'Apple, et c'est un motif de rejet classique.
`demo@minoapp.fr` doit entrer sans payer, et les notes de revue doivent le dire.

### 5. Les offres d'introduction, cette fois pour de bon

`docs/ops/paiements.md` interdit aujourd'hui d'en créer, et cette interdiction
était juste **tant que l'essai était accordé par notre serveur**. Elle tombe
avec ce parcours : c'est désormais la boutique qui porte l'essai de celui qui
s'abonne.

- App Store Connect et Play Console : offre **Gratuit · 1 mois** sur les deux
  formules, sur les deux boutiques.
- Stripe n'en a pas besoin : `trialEndForCheckout` envoie déjà la fin d'essai
  enregistrée, et elle vaudra trente jours pleins puisque la famille vient
  d'être créée.

**La fuite résiduelle, qu'Apple rend inévitable.** Un parent qui refuse au
paywall, consomme les trente jours du serveur, puis s'abonne au vingt-huitième
jour recevra en plus le mois gratuit d'Apple. L'éligibilité à une offre
d'introduction ne peut pas être conditionnée à un état qui vit chez nous.
Plafond du dégât : un mois, et seulement pour les tardifs — ceux qui allaient
partir.

### 6. Le parrainage passe aux offres promotionnelles

Les soixante jours du filleul ne peuvent plus venir du serveur sur les
boutiques, sous peine de s'ajouter au mois d'Apple. Il faut donc les **offres
promotionnelles** (Apple) et leur équivalent Play, signées par notre serveur —
ce que `docs/ops/paiements.md` annonçait déjà comme nécessaire pour le mois
offert du parrain. Une clé de signature d'abonnement est à générer.

C'est la moitié du travail de ce chantier, et la seule partie qui ne peut pas
être écrite depuis le dépôt seul.

### 7. Les familles abandonnées

Une session anonyme par visiteur qui n'ira pas au bout. Le mécanisme de purge
existe (`supabase/purge-essais.sql`), il faut l'étendre aux familles sans
parent identifié, au-delà d'un délai à fixer.

## Ce qui ne change pas

- `app/join.tsx` — l'appareil d'un enfant qui rejoint avec le code famille.
  Il ne voit aucun paywall : il ne paie pas, il rejoint une famille qui paie.
- `app/login.tsx` — un parent qui revient.
- `app/parent/abonnement.tsx` — la gestion de l'abonnement une fois abonné.
- La démonstration, qui n'écrit rien de tout cela.
- Le verrou de fin d'essai (`src/domain/access.ts`) : il reste le filet pour
  ceux qui refusent au paywall.

## Ce qu'il reste à décider

1. **Le paywall est-il franchissable autrement que par un code ?** Le plan
   ci-dessus dit non. C'est le choix qui rapporte le plus, et celui qui
   demande le plus de confiance à un parent qui n'a pas encore vu son enfant
   utiliser Mino — la valeur de ce produit dépend de l'adhésion d'un tiers, ce
   qui n'est pas le cas d'une application de méditation.
2. **Le code de parrainage circulera**, dès lors qu'il devient le seul moyen
   d'essayer sans carte. Les codes sont uniques par famille et le parrain n'est
   récompensé que si le filleul paie : un code partagé publiquement ne coûte
   que des essais. Le plafond tient, il faudra le surveiller.

## L'ordre des travaux

| | | Où |
|---|---|---|
| 1 | Prouver que les RLS acceptent l'écriture anonyme | `supabase/test/rls.sql` |
| 2 | `linkEmail`, et `createAccount` qui cesse de confondre anonyme et parent | `services/auth`, `store` |
| 3 | Réordonner les quatre écrans, déplacer le consentement | `app/onboarding/` |
| 4 | L'écran de paywall, sa sortie par code, la restauration | `app/onboarding/abonnement.tsx` |
| 5 | Les offres d'introduction | App Store Connect, Play Console |
| 6 | Les offres promotionnelles et la clé de signature | les deux boutiques + serveur |
| 7 | La purge des familles abandonnées | `supabase/purge-essais.sql` |

Les points 5 et 6 ne se font pas depuis le dépôt. Les autres, si.

Deux jours de travail, et une version à faire valider par Apple.
