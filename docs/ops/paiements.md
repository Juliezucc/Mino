# Les deux rails de paiement

**Dans l'application : Apple et Google. Sur le site : Stripe. Un seul
abonnement des deux côtés.**

Ce document dit ce que ça coûte, ce que ça change pour l'utilisateur, et le
seul point qui n'est pas résolu.

---

## Pourquoi c'est le bon choix

**La conversion.** Le parcours devient : publicité → App Store → téléchargement
→ configuration → « Continuer avec Premium » → Face ID. Rien à taper, aucune
sortie de l'application, aucun numéro de carte. Face à cela, « application →
navigateur → formulaire → carte → retour dans l'application » perd du monde à
chaque étape, et surtout chez quelqu'un qui découvre le produit depuis son
téléphone, le soir, en trois minutes.

**Et la règle.** Apple exige l'achat in-app dès qu'un paiement débloque une
fonctionnalité numérique dans l'application. Les dispositifs européens de
paiement externe existent depuis le DMA, mais imposent le mécanisme prévu par
Apple, l'acceptation de conditions spécifiques, et une commission malgré tout.
Google autorise les offres externes dans l'EEE sous conditions et sur
inscription à son programme. Autrement dit : le rail natif n'est pas une option
qu'on choisit, c'est le chemin par défaut, et s'en écarter coûte du travail
pour un gain incertain.

---

## Ce que ça coûte, en chiffres

Ce qui reste **réellement**, hors taxes, sur un abonnement mensuel à 9,99 € :

| Rail | Commission | Reste par mois | Sur 20 mois |
|---|---|---|---|
| Stripe (site) | 1,5 % + 0,25 € | **7,93 €** | 159 € |
| Apple / Google à 15 % | 15 % du HT | **7,08 €** | 142 € |
| Apple à 30 % (1ʳᵉ année, hors programme) | 30 % du HT | **5,83 €** | — |

> Les commissions des boutiques portent sur le prix **hors taxes**, la TVA
> étant reversée par elles puisqu'elles sont vendeur. Les frais Stripe portent
> sur le montant encaissé, TVA comprise, et la TVA reste à reverser. Comparer
> les montants bruts se trompe d'environ un cinquième — d'où le calcul
> `netOf()` dans `src/domain/billing.ts`, couvert par des tests.

### Le seuil de rentabilité de la décision

Passer de Stripe à l'achat natif coûte **11 % du revenu** par famille (7,93 →
7,08). Il faut donc **+12 % de conversion** pour rentrer dans ses frais.

Retirer une redirection navigateur et une saisie de carte sur mobile fait
généralement bien plus que 12 %. **La décision est donc bonne** — mais elle
n'est pas gratuite, et c'est ce chiffre-là qu'il faudra vérifier une fois les
deux rails en service (`metrics_par_rail`).

### Le seuil qui change tout, et qu'il faut anticiper

**Inscrire Mino au programme Small Business d'Apple.** Il donne 15 % au lieu de
30 % tant que les revenus restent sous 1 M$ par an — l'inscription n'est pas
automatique, elle se demande, et l'oublier double la commission.

Google applique déjà 15 % aux abonnements dès le premier euro.

Au-delà de 1 M$ (~8 300 familles à 9,99 €), Apple repasse à 30 % la première
année de chaque abonné, puis 15 %. Sur une durée de vie de 20 mois, la
commission moyenne devient ~24 %, et le seuil de rentabilité de la décision
monte à **+27 % de conversion**. À surveiller à l'approche de 8 000 familles.

### À l'échelle de l'objectif

À 10 000 familles, si 70 % s'abonnent depuis l'application :

| | Par mois |
|---|---|
| Encaissé | ~99 000 € |
| Commissions boutiques + Stripe | ~13 000 € |
| **Reste, hors TVA** | **~69 500 €** |

Contre ~73 500 € en tout-Stripe. **~4 000 €/mois d'écart** — à mettre en face
de ce que rapporte le gain de conversion, qui devrait le dépasser largement.

---

## Comment c'est construit

Un seul abonnement, trois écrivains, une seule table.

```
Achat dans l'app  →  preuve  →  store-purchase (vérifie chez Apple/Google)
                                        ↓
Apple / Google  →  notification serveur à serveur  →  store-notifications
                                        ↓
Stripe (site)   →  webhook  →  stripe-webhook       →  subscriptions.source
                                        ↓
                                 billing_events (journal)
```

**Le téléphone ne décide jamais qu'il est abonné.** Il transmet une preuve, le
serveur la fait vérifier. Un reçu interprété côté application est un reçu
qu'une application modifiée peut fabriquer : c'est la faille classique de
l'achat in-app, et elle se referme là ou nulle part.

### Le détail qui n'a aucun rattrapage

Le **jeton de compte** (`appAccountToken` chez Apple, `obfuscatedAccountId`
chez Google) transmis au moment de l'achat. Quand Apple prévient le serveur
qu'un abonnement vient d'être renouvelé ou résilié, c'est la seule chose qui
accompagne la notification. S'il n'a pas été envoyé à l'achat, la notification
arrive sans qu'on sache de quelle famille elle parle — et il est alors trop
tard, pour cet abonné, définitivement.

C'est l'erreur la plus fréquente des intégrations d'achat in-app. Ici, la base
attribue un UUID à chaque famille (`families.store_account_token`) et le
serveur vérifie qu'il désigne bien la famille appelante — sans quoi n'importe
qui pourrait faire valoir l'achat d'un tiers.

### Ce qui change pour l'utilisateur, et qui devait être corrigé

Trois textes promettaient l'inverse de ce que le rail natif permet. Corrigés :

- **La résiliation.** Ni Apple ni Google n'exposent d'API d'annulation : un
  bouton « Résilier » qui appellerait notre serveur échouerait en silence, et
  le parent croirait avoir résilié. L'écran renvoie maintenant vers les
  réglages du téléphone, et `cancel` est délibérément **absent** de l'interface
  côté boutique plutôt qu'implémenté en trompe-l'œil.
- **Les factures et les remboursements.** Apple et Google sont vendeurs de
  l'abonnement souscrit dans l'application : ils facturent, collectent la TVA
  et remboursent. Les CGV le disent désormais, article 7 et article 9.
- **« Restaurer mes achats ».** Obligatoire — Apple refuse à la revue toute
  application qui vend un abonnement sans ce bouton, et un parent qui change de
  téléphone doit retrouver le sien sans repayer.

---

## Le point qui n'est pas résolu : le mois offert du parrainage

C'est le seul endroit où les deux rails ne se comportent pas pareil, et il faut
le traiter avant le lancement.

**Ce qui marche déjà.** Les 60 jours du filleul, parce que l'essai n'appartient
à aucune boutique : il est accordé par notre serveur, avant tout achat. Le
parrainage continue donc de fonctionner exactement comme aujourd'hui côté
filleul, quel que soit le rail. C'est la raison pour laquelle **l'essai ne doit
pas être configuré comme offre d'introduction dans les boutiques** — sinon un
filleul cumulerait nos 60 jours et les 30 jours d'Apple.

**Ce qui ne marche pas.** Le mois offert du parrain, quand il paie via une
boutique. On ne peut pas demander à Apple de sauter un prélèvement : `trial_end`
et le crédit de solde Stripe n'ont pas d'équivalent.

Le mécanisme prévu pour ça existe — ce sont les **offres promotionnelles**
(Apple) et leur équivalent Play : une période gratuite accordée à un abonné
existant, l'offre étant signée par notre serveur. C'est la bonne réponse, et
elle demande deux choses qui ne se font pas depuis un dépôt de code : créer
l'offre dans App Store Connect et dans la Play Console, et générer une clé de
signature d'abonnement.

**En attendant, le mois est mis de côté** (`credit_months`) et rien n'est
perdu. Mais il faut soit implémenter les offres promotionnelles avant
d'ouvrir le parrainage aux abonnés de boutique, soit dire clairement dans
l'application que le mois offert sera appliqué à une date ultérieure. **Ne pas
choisir reviendrait à promettre un mois qui n'arrive jamais**, ce qui est la
pire chose qu'un programme de parrainage puisse faire.

---

## Ce qu'il reste à faire, dans l'ordre

### Côté boutiques — ta partie

1. **Créer les produits** : `mino.premium.monthly` et `mino.premium.yearly`
   dans App Store Connect et la Play Console. Le code déduit la formule du nom
   du produit (`monthly` / `yearly` ou `annual`) : garder ces mots.
2. **La grille d'Apple s'impose, et elle l'a fait.** 9,90 € n'existe pas comme
   palier ; 9,99 € oui — ni 79 €, mais 79,99 € oui. Les deux tarifs sont donc passés à
   **9,99 €** et **79,99 €**
   *partout* — `MONTHLY_PRICE_EUR` étant la source dont dépendent le site, la
   FAQ, les CGV, les écrans et les tarifs Stripe, un seul nombre a changé.
   Garder 9,90 sur le web et 9,99 sur les boutiques aurait réintroduit
   exactement la divergence que cette architecture existe pour empêcher, pour
   neuf centimes.
3. **S'inscrire au programme Small Business d'Apple.** 15 % au lieu de 30 %.
   Cinq minutes, et l'oublier double la commission.
4. **Ne configurer aucune offre d'introduction** — voir le parrainage ci-dessus.
5. **Activer les notifications serveur à serveur** : App Store Server
   Notifications V2 vers `…/store-notifications/apple`, et Real-time Developer
   Notifications (Pub/Sub) vers `…/store-notifications/google`.
6. **Créer le compte de service Google** avec accès à l'API Play Developer.

### Côté code — ma partie

7. **La bibliothèque native est choisie et branchée** : `expo-iap`, dans
   `src/services/billing/ExpoIapStore.ts`. Vingt et un tests, une fausse
   boutique, aucun appareil nécessaire pour les faire tourner.

   > **Ce n'est plus RevenueCat, et c'est un revirement assumé.** La
   > recommandation tenait tant que Mino n'avait pas de serveur : RevenueCat
   > vend surtout la validation des reçus et la tenue de l'état d'abonnement.
   > Or `_shared/store.ts` vérifie déjà les transactions signées d'Apple et
   > interroge l'API Play, et `store-notifications` reçoit les notifications
   > serveur à serveur des deux. Ajouter RevenueCat aujourd'hui, c'est payer un
   > intermédiaire pour refaire ce qui est écrit, et lui confier la vérité sur
   > qui est client — c'est-à-dire dépendre de sa disponibilité pour le savoir.
   >
   > `expo-iap` n'est pas de la même nature : c'est une liaison vers StoreKit 2
   > et Play Billing, sans serveur, sans compte à ouvrir, sans commission. Elle
   > s'arrête là où commence la vérification, qui reste chez nous. Et la couture
   > `native.ts` tient toujours : on peut en changer sans toucher à un écran.

8. **Tester en bac à sable**, sur un vrai iPhone et un vrai Android : achat,
   renouvellement, résiliation, remboursement, restauration sur un second
   appareil.
9. **Vérifier le garde-fou du double abonnement** en conditions réelles. Le cas
   arrive vraiment : on souscrit sur le site, on rouvre l'écran dans l'app
   avant que l'état ne soit revenu, et on paie une seconde fois — à Apple cette
   fois — d'où deux abonnements dont un qu'on ne sait pas résilier. L'écran
   relit désormais l'abonnement à son ouverture, ce qui ferme presque toute la
   fenêtre, et `has_active_subscription()` ferme le reste côté base. À rejouer
   sur deux appareils avant la sortie.

### Variables d'environnement à renseigner

```
APPLE_BUNDLE_ID=       APPLE_APP_APPLE_ID=
APPLE_KEY_ID=          APPLE_ISSUER_ID=
APPLE_PRIVATE_KEY=     APPLE_ENVIRONMENT=sandbox|production
ANDROID_PACKAGE_NAME=  GOOGLE_SERVICE_ACCOUNT_JSON=
STORE_COMMISSION_RATE=0.15
```

`APPLE_KEY_ID`, `APPLE_ISSUER_ID` et `APPLE_PRIVATE_KEY` viennent d'une clé
**Achats intégrés** créée dans App Store Connect → Utilisateurs et accès →
Intégrations. Le fichier `.p8` n'est téléchargeable qu'une fois.

> **`APPLE_ROOT_CA_G3_BASE64` n'est plus lue.** Elle servait à valider la
> chaîne de certificats hors ligne, ce qui ne peut pas se faire ici — voir
> ci-dessous. Le secret peut rester en place, il n'est plus consulté.

### Pourquoi la vérification Apple ne ressemble pas à ce qu'on lit ailleurs

Toutes les intégrations documentées valident la signature d'Apple hors ligne,
avec sa bibliothèque officielle. **Elle ne peut pas tourner sur Supabase.** Les
fonctions s'exécutent sur Deno, dont le `X509Certificate` est une coquille :
ni `toString()`, ni `raw`, donc aucun accès aux octets du certificat. Deux
erreurs successives l'ont établi en bac à sable, et il n'y avait pas de
troisième correctif à tenter.

La fonction lit donc la transaction que le téléphone annonce **sans la
croire**, en tire l'identifiant, et interroge l'API serveur d'Apple avec une
clé qui n'appartient qu'à nous. Ce qu'Apple répond fait foi.

C'est plus sûr que l'autre voie, et pas moins : une signature qu'on valide
soi-même est une signature qu'on peut valider de travers, et une chaîne mal
vérifiée accepte n'importe quoi. C'est aussi exactement ce que fait le rail
Google depuis le début — signer un jeton, demander à la boutique, croire sa
réponse.

---

## Le passage de Stripe en mode réel

**Presque tout ce qui a été configuré en test devra être refait.** Chez Stripe,
le mode test et le mode réel sont deux environnements séparés : les clés, les
produits, les tarifs, le webhook, le portail client et Stripe Tax existent en
double et ne communiquent pas. Ce qui a été réglé un matin de septembre en test
n'existera pas le jour de l'ouverture.

D'où cette liste, écrite le jour où on l'a découvert plutôt que six semaines
plus tard, de mémoire.

1. **Activer le compte** : pièce d'identité, documents de la société, et un
   IBAN **au nom d'Agence Wheb**. Ni personnel, ni celui d'une autre société.
2. **Le libellé sur le relevé bancaire** : `MINO`, pas `AGENCE WHEB`. C'est le
   nom que le client reconnaît, et c'est ce qui évite les contestations.
3. **Les produits et tarifs** : `STRIPE_SECRET_KEY=sk_live_… npm run
   stripe:produits`. C'est tout l'intérêt du script — les montants viennent du
   code, et le mode réel reçoit exactement les mêmes que le test.
4. **Stripe Tax** : adresse d'origine (47 rue Vivienne, 75002 Paris) et
   immatriculation fiscale française `FR67103231460`. Sans immatriculation,
   Stripe Tax calcule zéro et on encaisse sans collecter la TVA due. Et sans
   Stripe Tax du tout, `billing` demande un calcul que Stripe refuse : la
   session de paiement échoue, sur une erreur qui ne parle pas de taxes.

   > **« Stripe Tax activé » et « immatriculé » sont deux choses différentes,
   > et le tableau de bord ne le dit pas.** L'adresse de siège, la catégorie de
   > produit et le calcul automatique peuvent être verts partout pendant que la
   > liste des immatriculations est vide — auquel cas Stripe conclut que tu
   > n'as d'obligation nulle part, et facture 0 %. L'immatriculation est en
   > outre **propre à chaque mode** : celle du test n'existe pas en réel.
   >
   > La vérité tient en une commande, et elle ne ment pas :
   >
   > ```bash
   > curl -s https://api.stripe.com/v1/tax/registrations -u "$STRIPE_SECRET_KEY:"
   > ```
   >
   > Vide, il faut la créer. Le `place_of_supply_scheme` n'est pas facultatif —
   > sans lui, Stripe refuse avec un message qui tourne en rond (« requires
   > `standard` to be specified ») :
   >
   > ```bash
   > curl -s https://api.stripe.com/v1/tax/registrations \
   >   -u "$STRIPE_SECRET_KEY:" \
   >   -d country=FR \
   >   -d "country_options[fr][type]=standard" \
   >   -d "country_options[fr][standard][place_of_supply_scheme]=standard" \
   >   -d active_from=now
   > ```
   >
   > Créer cet objet n'immatricule auprès d'aucune administration : il déclare à
   > Stripe un fait déjà vrai. Vendre ailleurs dans l'Union suppose en revanche
   > une immatriculation **OSS**, à demander sur impots.gouv.fr — sans elle, la
   > disponibilité du site reste la France.
5. **Le portail client**, en entier : en-tête `Mino`, redirection vers
   `https://minoapp.fr/abonnement`, annulation à la fin de la période,
   changement d'offre entre les deux tarifs, quantité désactivée, « mettre fin
   aux essais » **désactivé** (sinon un parent qui passe au tarif annuel
   pendant son essai est débité sur-le-champ), et « pas de frais ni de
   crédits » plutôt que le prorata.
6. **Les informations publiques** : nom public `Mino`, et les URL réelles des
   CGV et de la politique de confidentialité. Stripe les exige en mode réel.
7. **Le webhook** sur `https://<projet>.supabase.co/functions/v1/stripe-webhook`
   avec les six événements, et le nouveau `whsec_` — celui du test ne vaut rien
   ici.
8. **Les secrets** : `supabase secrets set` avec la clé `sk_live_`, les
   nouveaux `price_`, le nouveau `whsec_`, et `APP_URL` / `APP_ORIGIN` sur
   `https://minoapp.fr`.
9. **Vérifier que le site répond** sur `/abonnement` et `/abonnement/merci`.
   Stripe y renvoie le client à la seconde où il a payé.

> **Le piège qui a coûté une heure en test, et qui ne se voit pas.** Une clé
> prise sur le mauvais compte crée tout — produit, tarifs — sans une seule
> erreur, dans un compte qu'on ne regarde pas. Le tableau de bord reste vide et
> rien n'explique pourquoi. Avant de lancer quoi que ce soit :
> `curl https://api.stripe.com/v1/account -u '<la clé>:'` répond avec le nom du
> compte auquel elle appartient.

---

## Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié** : les règles de rail (qui vend, où l'on résilie, ce que chaque rail
laisse) sont couvertes par six tests ; l'ensemble compile ; les tests passent ;
les textes de la FAQ et des CGV ont été mis en accord avec le comportement réel.
S'y ajoutent les vingt et un tests d'`ExpoIapStore` — la preuve rendue, la
transaction close, l'abandon distingué de l'échec, la transaction rejouée qui ne
se confond pas avec la nôtre. Chacune de ces protections a été cassée
volontairement pour vérifier qu'un test la rattrape.

Vérifié aussi, et ce n'était pas acquis : le paquet natif entre dans la build
iOS et **n'entre pas** dans le paquet web (l'import est dynamique, et
`expo export` le confirme des deux côtés) ; la chaîne de plugins produit bien un
projet Xcode signable — habilitation Family Controls, groupe d'applications,
cible iOS 16.4 et le pod d'`expo-iap`.

**Non vérifié** : `store.sql` n'a pas été appliqué, et les fonctions
`store-purchase` et `store-notifications` n'ont jamais été exécutées — il n'y a
ici ni projet Supabase actif, ni compte de développeur Apple ou Google, ni
appareil réel. Elles sont écrites d'après les contrats documentés d'Apple et de
Google. **Rien de tout cela ne doit être considéré comme acquis avant un achat
de test réussi en bac à sable, de bout en bout.**
