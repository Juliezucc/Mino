# Le parcours d'inscription, et où se place la carte

> **État : plan validé, rien n'est encore écrit.** Ce document remplacera la
> section correspondante de `docs/ops/paiements.md` une fois réalisé — en
> particulier la ligne qui interdit les offres d'introduction, qui cesse d'être
> juste avec ce parcours.

## Le défaut à réparer

Le parcours actuel demande tout avant de rien montrer.

```
Télécharger (gratuit)
→ app/onboarding/account.tsx   e-mail, mot de passe, code parent, consentement
→ ⛔ confirmation par e-mail    on quitte l'application
→ app/onboarding/child.tsx     le premier enfant
→ app/onboarding/mission.tsx   la première mission
→ app/onboarding/appareil.tsx
→ … 30 jours plus tard         app/parent/abonnement.tsx
```

**On demande l'effort avant d'avoir rien donné.** Quatre champs et une case à
cocher avant que le parent n'ait vu quoi que ce soit qui ressemble à sa
famille. C'est l'endroit du parcours où l'on perd le plus de monde, et on l'a
mis en premier.

**La confirmation d'e-mail tombe au pire moment** : juste après l'engagement,
juste avant la récompense. Elle envoie le parent dans sa boîte mail, souvent
dans un autre navigateur que celui où l'application est ouverte, et il revient
— quand il revient — devant un écran de connexion qui lui redemande ce qu'il
vient de taper.

**Et la carte n'est jamais demandée.** L'essai est accordé sans carte et se
termine sur un mur : au trentième jour, le parent doit revenir de son plein
gré, ressortir sa carte et payer. C'est le modèle qui convertit le moins bien
qui soit.

## Le parcours visé

```
Télécharger (gratuit)
→ 1. Le prénom de votre enfant           + son âge, son avatar, LE CONSENTEMENT
→ 2. Sa première mission                 choisie dans la bibliothèque
→ 3. Votre compte                        e-mail, mot de passe, code parent
→ 4. 💳 0 € aujourd'hui                   30 jours gratuits, puis l'abonnement
→ 5. L'appareil de l'enfant
```

Le parent voit sa famille exister **avant** qu'on lui demande quoi que ce soit.

### Le compte est en 3, et pas après le paiement

Il serait tentant de le repousser encore. C'est un piège : une famille qui paie
sur une session anonyme et n'attache jamais d'adresse est **irrécupérable à la
réinstallation**. Elle a payé, et elle ne peut plus rentrer chez elle.

Le compte se crée donc avant que le moindre euro ne bouge. À cet instant, le
parent a déjà vu son enfant et sa première mission : taper une adresse n'est
plus un obstacle, c'est un rangement.

### La confirmation d'e-mail reste activée

Rien ne change dans sa configuration. Elle cesse d'être un mur parce qu'elle
arrive alors que le parent est déjà dans l'application, sa famille créée. Le
lien le ramènera sur `app/confirme.tsx`, qui sait déjà où l'emmener.

## Le paywall

Infranchissable — seul le compte de démonstration passe outre.

```
        0 € aujourd'hui
   30 jours gratuits, puis :

┌──────────────────────────────────┐
│  ANNUEL              -33 %       │   ← présélectionné, dominant
│  6,67 € / mois                   │   ← ce qu'on lit en premier
│  soit 79,99 € par an             │   ← petit, mais lisible
└──────────────────────────────────┘

   Mensuel · 9,99 € / mois            ← lien discret, pas une carte

   Rien n'est prélevé aujourd'hui.
   Annulable en deux touches.
```

Le prix mensuel équivalent vient de `formatPrice(ANNUAL_PRICE_EUR / 12)` : il
ne s'écrit pas en dur, sinon il cessera un jour de correspondre au prix
facturé.

**La limite à ne pas franchir** : le montant réellement débité et sa
périodicité restent lisibles. Apple le vérifie, et la loi française l'impose.
« Soit 79,99 € par an » en petit satisfait les deux ; le retirer, non.

### Obligations sur cet écran

- prix, durée de l'essai et renouvellement automatique **sur l'écran** ;
- liens CGV et confidentialité — motif 3.1.2, déjà rencontré ;
- bouton **« Restaurer mes achats »**, obligatoire chez Apple ;
- **le compte de démonstration doit traverser le mur.** Un paywall
  infranchissable bloque aussi le vérificateur d'Apple, et c'est un motif de
  rejet classique. `demo@minoapp.fr` entre sans payer, et les notes de revue le
  disent.

### Les deux rappels

Ils ne sont pas une précaution morale, ils comblent deux manques réels.

- **À J-3 de la fin d'essai.** Apple en envoie un pour ses offres
  d'introduction ; **Stripe n'en envoie aucun.** Sans lui, les abonnés web sont
  moins bien traités que les abonnés iPhone, sur le même produit.
- **Avant le renouvellement annuel**, à partir de la deuxième année. C'est une
  obligation : l'article L215-1 du code de la consommation impose d'informer le
  consommateur de sa faculté de non-reconduction, entre trois mois et un mois
  avant l'échéance. Cela concerne la formule annuelle.

## Le parrainage

**Trente jours pour tout le monde, filleul compris.** Le filleul ne reçoit rien
de particulier. C'est la décision qui simplifie le plus ce chantier : l'offre
d'introduction devient uniforme sur les deux boutiques, et les « codes
d'offre » d'Apple disparaissent entièrement du plan.

**Le bénéfice va au parrain, et il doit fonctionner sur les trois rails.**
Trente jours de plus par filleul devenu payant, plafonnés à douze mois par an
glissant (`REFERRAL`, dans `src/domain/billing.ts`).

| Rail | Comment on repousse l'échéance du parrain | État |
|---|---|---|
| Stripe | `trial_end` décalé, ou crédit du solde client | déjà écrit (`rewardReferrer`) |
| Google Play | `purchases.subscriptions.defer` — décale la date de facturation | à écrire, simple |
| Apple | offre promotionnelle signée par notre serveur | à écrire, clé d'abonnement à générer |

> **Réserve consignée.** Un parrainage à sens unique convertit moins bien qu'un
> parrainage à double sens : le filleul n'a aucune raison de se signaler.
> Le lien ci-dessous est ce qui rend ce choix tenable — sans lui, personne ne
> serait jamais attribué. Décision prise en connaissance de cause.

### Un lien, pas un code à taper

Un filleul qui ne gagne rien ne tapera jamais un code. Le lien supprime la
question.

| Situation | Le code passe-t-il ? |
|---|---|
| Le lien s'ouvre sur le site web | oui, automatiquement |
| L'application est déjà installée | oui — les liens entrants existent déjà (`services/auth/lienEntrant.ts`) |
| Android, application non installée | oui, via l'API *Install Referrer* de Google Play — officielle, sans dépendance |
| **iPhone, application non installée** | **non, et c'est irréductible** |

**Le cas iPhone.** L'ami clique, atterrit sur l'App Store, installe, ouvre — et
le code a disparu. Apple ne fournit aucun mécanisme pour le transporter. Les
seuls contournements sont des SDK d'attribution tiers qui font de l'empreinte
d'appareil.

**On ne les utilisera pas.** Ce serait du suivi publicitaire : il faudrait
redéclarer « Suivi » dans la confidentialité App Store, réintroduire la demande
ATT retirée le 9 septembre 2026, et contredire ce que le produit promet depuis
le début. Pour un mois offert, l'échange n'est pas raisonnable.

**À la place, une page d'invitation** sur le site, vers laquelle le lien pointe :

> **Julie vous invite à essayer Mino.**
> Votre code d'invitation : **MINO-2DU97M** *(bouton copier)*
> Il vous sera demandé une fois l'application installée.
>
> [ App Store ] [ Google Play ]

Sur Android le code s'applique seul et la page n'est qu'une vitrine. Sur
iPhone, le filleul le colle une fois, au paywall, avec une instruction reçue
trente secondes plus tôt.

**La page ne promet rien au filleul.** « Julie vous invite à essayer Mino »
suffit. Sous-entendre un avantage inexistant se paierait au premier avis.

## Ce que ça demande, techniquement

### 1. La session anonyme, dès le premier écran

`signInAnonymously()` sert déjà aux tablettes des enfants
(`SupabaseAuthService.signInAsDevice`). On s'en sert dès l'écran 1 : la famille
et l'enfant s'écrivent tout de suite, sur une identité sans adresse.

**À prouver avant d'écrire quoi que ce soit** : les politiques RLS acceptent-
elles qu'un utilisateur anonyme crée une ligne `families` et une ligne
`parents` ? `parents.user_id` vaut `auth.uid()` par défaut, donc a priori oui —
mais cela se démontre dans `supabase/test/rls.sql`, pas par raisonnement.

### 2. Rattacher l'adresse à la session anonyme

Nouvelle méthode `AuthService.linkEmail({ email, password })`, appuyée sur
`updateUser` et non sur `signUp`.

C'est le point délicat du chantier : `signUp` sur une session anonyme crée un
**second** utilisateur et abandonne le premier — avec la famille et l'enfant
dessus. Or `createAccount` (`useMinoStore.ts:463`) teste aujourd'hui
`kind !== 'parent'` : une session anonyme vaut `'device'`, elle repasserait donc
par `signUp`. C'est exactement le défaut à ne pas laisser passer, et il mérite
son test.

### 3. Le consentement déménage, il ne disparaît pas

Il se recueille sur l'écran 1, **avant** la création du profil enfant. C'est ce
que le dossier déposé chez Apple affirme, et c'est la date qui vaut preuve
(`consentAt`).

### 4. Les offres d'introduction

`docs/ops/paiements.md` interdit aujourd'hui d'en créer. Cette interdiction
était juste tant que l'essai venait de notre serveur ; elle tombe avec ce
parcours, puisque c'est désormais la boutique qui porte l'essai de celui qui
s'abonne.

- App Store Connect et Play Console : **Gratuit · 1 mois**, sur les deux
  formules, sur les deux boutiques, uniformément.
- Stripe n'a rien à configurer : `trialEndForCheckout` envoie la fin d'essai
  déjà enregistrée.

**La fuite résiduelle, qu'Apple rend inévitable.** Un parent qui refuse au
paywall, consomme les trente jours du serveur, puis s'abonne au vingt-huitième
jour recevra en plus le mois gratuit d'Apple : l'éligibilité à une offre
d'introduction ne peut pas dépendre d'un état qui vit chez nous. Plafond du
dégât : un mois, et seulement pour les tardifs — ceux qui allaient partir.

### 5. Les familles abandonnées

Une session anonyme par visiteur qui n'ira pas au bout. La purge existe
(`supabase/purge-essais.sql`) ; il faut l'étendre aux familles sans parent
identifié, au-delà d'un délai à fixer.

## Ce qui ne change pas

- `app/join.tsx` — l'appareil d'un enfant qui rejoint avec le code famille. Il
  ne voit aucun paywall : il ne paie pas, il rejoint une famille qui paie.
- `app/login.tsx` — un parent qui revient.
- `app/parent/abonnement.tsx` — la gestion de l'abonnement une fois abonné.
- La démonstration, qui n'écrit rien de tout cela.
- Le verrou de fin d'essai (`src/domain/access.ts`), filet pour ceux qui
  refusent au paywall.

## L'ordre des travaux

| | | Où |
|---|---|---|
| 1 | Prouver que les RLS acceptent l'écriture anonyme | `supabase/test/rls.sql` |
| 2 | `linkEmail`, et `createAccount` qui cesse de confondre anonyme et parent | `services/auth`, `store` |
| 3 | Réordonner les quatre écrans, déplacer le consentement | `app/onboarding/` |
| 4 | Le paywall : annuel d'abord, restauration, démo qui traverse | `app/onboarding/abonnement.tsx` |
| 5 | Les deux rappels | `services/notifications` |
| 6 | Le mois du parrain sur Play (`defer`) et Apple (offre signée) | fonctions Supabase |
| 7 | Le lien de parrainage, la page d'invitation, l'Install Referrer | site + `app/` |
| 8 | La purge des familles abandonnées | `supabase/purge-essais.sql` |

Les offres d'introduction et la clé de signature d'abonnement ne se font pas
depuis le dépôt : elles se créent dans App Store Connect et la Play Console.
Tout le reste, si.

Un jour et demi de travail, et une version à faire valider par Apple.
