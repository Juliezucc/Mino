# Backend de facturation Mino

Deux fonctions Supabase Edge, en Deno :

| Fonction | Rôle | JWT |
|---|---|---|
| `billing` | L'API que l'app appelle : lire l'abonnement, ouvrir un paiement, ouvrir le portail client, résilier, reprendre, parrainer. | Requis |
| `stripe-webhook` | Reçoit les événements Stripe. **Seul écrivain** de l'état de facturation. | Aucun — la signature Stripe fait foi |

Les deux importent les règles depuis `src/domain/billing.ts`, le même fichier que
l'application. Un plafond de parrainage ou un prix ne peut donc pas diverger
entre ce que le client affiche et ce que le serveur applique.

## 1. Créer les produits dans Stripe

Dans le Dashboard Stripe, en mode Test d'abord :

1. **Produit** « Mino » avec deux tarifs récurrents :
   - `9,90 € / mois` → note l'identifiant `price_…`
   - `79,00 € / an` → note l'identifiant `price_…`
   Coche **« Prix TTC »** (tax behavior : *inclusive*) : les CGV annoncent des
   prix TTC.
2. **Stripe Tax** : Réglages → Taxes → active-le, déclare le siège en France, et
   inscris-toi à l'**OSS** quand tu dépasses le seuil européen. Sans ça, la TVA
   du pays du client n'est pas calculée et les factures sont fausses.
3. **Portail client** : Réglages → Portail client → autorise l'annulation
   *à la fin de la période*, la mise à jour du moyen de paiement et le
   changement de formule. C'est ce portail qui rend la résiliation conforme.
4. **Webhook** : Développeurs → Webhooks → ajoute un endpoint pointant sur
   `https://<projet>.supabase.co/functions/v1/stripe-webhook`, avec les
   événements :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

   Note le secret de signature `whsec_…`.

## 2. Variables d'environnement

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_… \
  STRIPE_WEBHOOK_SECRET=whsec_… \
  STRIPE_PRICE_MONTHLY=price_… \
  STRIPE_PRICE_YEARLY=price_… \
  APP_URL=https://minoapp.fr \
  APP_ORIGIN=https://minoapp.fr
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées
automatiquement par Supabase.

> **`mino.app` appartient à un tiers.** Ces deux lignes le portaient, et ce
> n'était pas une coquille de documentation : `APP_URL` compose les
> `success_url` et `cancel_url` envoyées à Stripe. Un parent qui venait de
> payer aurait été renvoyé sur `https://mino.app/abonnement/merci`,
> c'est-à-dire chez quelqu'un d'autre — avec, dans l'adresse, l'identifiant de
> sa session de paiement. `APP_ORIGIN`, lui, ouvre le `Access-Control-Allow-Origin`
> des fonctions.
>
> **Deux choses à vérifier avant le premier paiement réel :**
> `supabase secrets list` doit montrer `minoapp.fr` sur les deux, et le site
> doit répondre sur `/abonnement/merci` et `/abonnement`. Sans ces deux pages,
> le client atterrit sur une 404 la seconde après avoir payé — c'est le pire
> endroit du parcours pour en rencontrer une.

## 3. Déployer

```bash
supabase db push                                    # tables subscriptions + referrals
supabase functions deploy billing
supabase functions deploy stripe-webhook --no-verify-jwt
```

Le `--no-verify-jwt` est indispensable sur le webhook : Stripe ne peut pas
présenter de JWT Supabase. C'est la vérification de signature, dans la fonction,
qui authentifie l'appel — ne la retire jamais.

## 4. Brancher l'application

```bash
EXPO_PUBLIC_BILLING_API_URL=https://<projet>.supabase.co/functions/v1
```

Sans cette variable, l'app utilise le service local qui ne débite rien et
l'affiche clairement à l'écran. Aucun autre changement n'est nécessaire.

## 5. Tester avant d'ouvrir

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
supabase functions serve
```

Carte de test `4242 4242 4242 4242`. Le parcours à vérifier, dans l'ordre :

1. Un paiement aboutit → la ligne `subscriptions` passe en `trialing` puis
   `active` à la fin de l'essai.
2. Résiliation depuis l'app → `cancel_at_period_end` à `true`, accès conservé.
3. Un filleul entre un code → ligne `referrals` en `pending`, essai porté à
   60 jours.
4. Ce filleul paie sa première facture → la ligne passe en `credited` et le
   parrain reçoit son avoir. Vérifie-le sur la fiche client Stripe : le solde
   doit être négatif de 9,90 €.
5. Rejoue le même `invoice.paid` depuis le Dashboard : rien ne doit bouger. Les
   webhooks sont rejoués en cas d'erreur, donc chaque gestionnaire doit être
   rejouable sans effet double.

## Comment le mois de parrainage est réellement donné

- **Parrain encore en essai** → le `trial_end` de son abonnement Stripe est
  repoussé d'un mois. La date de premier paiement recule vraiment.
- **Parrain déjà payant** → un avoir de 9,90 € est porté au solde de son compte
  client. Stripe le déduit automatiquement de la facture suivante.
- **Parrain sans compte client** (il a parrainé avant de s'abonner) → le mois est
  mis de côté dans `credit_months` et consommé au premier paiement.

Le crédit n'intervient que sur une facture réellement payée d'un montant
supérieur à zéro. Une facture à 0 €, c'est un essai qui démarre : récompenser
là-dessus reviendrait à payer pour des comptes, pas pour des clients.
