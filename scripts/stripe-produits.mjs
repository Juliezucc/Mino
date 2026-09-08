#!/usr/bin/env node
/**
 * Crée dans Stripe le produit Mino Premium et ses deux tarifs.
 *
 * Écrit pour trois raisons, dans cet ordre d'importance :
 *
 * 1. **Les montants viennent du code**, pas d'un champ de formulaire. 9,90 €
 *    et 79 € sont définis dans `src/domain/billing.ts`, d'où sortent aussi le
 *    site, la FAQ, les CGV et les écrans de l'application. Saisir les mêmes
 *    chiffres à la main dans le tableau de bord, c'est créer une septième
 *    copie — celle qui encaisse, et qui ne préviendra jamais qu'elle diverge.
 *
 * 2. **Le mode test et le mode réel doivent être identiques.** On fabrique
 *    aujourd'hui les tarifs de test ; dans quelques semaines il faudra
 *    refaire exactement les mêmes en réel. Refaire « exactement » à la souris,
 *    six semaines plus tard, n'arrive jamais. Ici, c'est la même commande avec
 *    l'autre clé.
 *
 * 3. **On peut le relancer sans rien casser.** Le produit porte un
 *    identifiant fixe et les tarifs une `lookup_key` : le script retrouve ce
 *    qui existe déjà au lieu d'en créer un deuxième exemplaire.
 *
 * Usage :
 *   STRIPE_SECRET_KEY='sk_test_…' npm run stripe:produits
 *   STRIPE_SECRET_KEY='sk_test_…' npm run stripe:produits -- --dry-run
 *
 * La clé n'est lue que dans l'environnement, n'est jamais écrite nulle part,
 * et n'apparaît pas dans la sortie. Elle n'entre pas dans le dépôt.
 *
 * Un tarif Stripe est **immuable** : on ne change pas le montant d'un tarif
 * existant, on en crée un nouveau et on cesse d'utiliser l'ancien. C'est
 * pourquoi ce script ne « met pas à jour » un prix — s'il en trouve un dont le
 * montant ne correspond plus, il le dit et s'arrête plutôt que de deviner.
 */

import { pathToFileURL } from 'node:url';

const { MONTHLY_PRICE_EUR, ANNUAL_PRICE_EUR } = await import(
  pathToFileURL('src/domain/billing.ts').href
);

const cle = process.env.STRIPE_SECRET_KEY;
const dryRun = process.argv.includes('--dry-run');

// `--dry-run` n'appelle rien : il doit donc marcher sans clé, sinon on ne peut
// pas relire ce qu'on s'apprête à créer avant d'aller la chercher.
if (!cle && !dryRun) {
  console.error('STRIPE_SECRET_KEY manquante.');
  console.error('');
  console.error('Tableau de bord Stripe → Développeurs → Clés API → clé secrète.');
  console.error('Vérifie que tu es bien dans le mode voulu : une clé sk_test_ ne');
  console.error('touche jamais au mode réel, et réciproquement.');
  console.error('');
  console.error("  STRIPE_SECRET_KEY='sk_test_…' npm run stripe:produits");
  process.exit(1);
}

/**
 * Une clé qui n'en est pas une, dite en français plutôt qu'en pile d'appels.
 *
 * Le cas qui a fait écrire ces lignes : la clé collée depuis un exemple, avec
 * les points de suspension restés dedans. `fetch` refuse alors de fabriquer
 * l'en-tête et renvoie « Cannot convert argument to a ByteString because the
 * character at index 15 has a value of 8230 » — une phrase exacte, juste, et
 * parfaitement inutilisable. Le caractère 8230 est « … ».
 *
 * Toute clé Stripe est de la forme `sk_test_` ou `sk_live_` suivie de
 * caractères ASCII. Tout le reste est une erreur de copie, et le dire coûte
 * six lignes.
 */
if (cle && !/^sk_(test|live)_[A-Za-z0-9]+$/.test(cle)) {
  console.error('STRIPE_SECRET_KEY ne ressemble pas à une clé Stripe.');
  console.error('');
  if (/[^\x20-\x7E]/.test(cle)) {
    console.error("Elle contient un caractère qui n'est pas de l'ASCII — le plus souvent");
    console.error('les « … » d\'un exemple restés dans la commande.');
  } else {
    console.error('Attendu : sk_test_… ou sk_live_… suivi de lettres et de chiffres.');
  }
  console.error('');
  console.error('Tableau de bord Stripe → Développeurs → Clés API → clé secrète,');
  console.error('bouton « Révéler ». Elle fait une centaine de caractères.');
  process.exit(1);
}

const reel = cle?.startsWith('sk_live_') ?? false;

/** L'identifiant du produit, choisi par nous : c'est lui qui rend le script rejouable. */
const PRODUIT = 'mino_premium';

const TARIFS = [
  {
    cle: 'mino_premium_mensuel',
    montant: Math.round(MONTHLY_PRICE_EUR * 100),
    intervalle: 'month',
    libelle: 'mensuel',
  },
  {
    cle: 'mino_premium_annuel',
    montant: Math.round(ANNUAL_PRICE_EUR * 100),
    intervalle: 'year',
    libelle: 'annuel',
  },
];

async function stripe(chemin, corps) {
  const options = {
    method: corps ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (corps) options.body = new URLSearchParams(corps).toString();

  const reponse = await fetch(`https://api.stripe.com/v1/${chemin}`, options);
  const data = await reponse.json();
  if (!reponse.ok) {
    const message = data?.error?.message ?? `HTTP ${reponse.status}`;
    const err = new Error(message);
    err.code = data?.error?.code;
    err.status = reponse.status;
    throw err;
  }
  return data;
}

const euros = (centimes) =>
  `${(centimes / 100).toFixed(2).replace('.', ',')} €`;

console.log('');
console.log(`Mode : ${reel ? 'RÉEL — de l’argent va circuler' : 'test'}`);
console.log(`Produit : ${PRODUIT}`);
console.log(
  `Tarifs : ${TARIFS.map((t) => `${euros(t.montant)} / ${t.libelle}`).join('  ·  ')}`,
);
console.log('');

if (dryRun) {
  console.log('--dry-run : rien n’a été envoyé à Stripe.');
  process.exit(0);
}

/* ------------------------------------------------------------- le produit */

let produit;
try {
  produit = await stripe(`products/${PRODUIT}`);
  console.log(`✓ produit déjà présent : ${produit.id}`);
} catch (error) {
  if (error.status !== 404) throw error;
  produit = await stripe('products', {
    id: PRODUIT,
    name: 'Mino Premium',
    description: 'Grandir, une mission à la fois.',
  });
  console.log(`+ produit créé : ${produit.id}`);
}

/* -------------------------------------------------------------- les tarifs */

const trouves = {};

for (const tarif of TARIFS) {
  const existants = await stripe(
    `prices?lookup_keys[]=${encodeURIComponent(tarif.cle)}&active=true&limit=1`,
  );
  const deja = existants.data?.[0];

  if (deja) {
    if (deja.unit_amount !== tarif.montant) {
      console.error('');
      console.error(`✗ ${tarif.cle} existe à ${euros(deja.unit_amount)}, or le code dit ${euros(tarif.montant)}.`);
      console.error('');
      console.error('  Un tarif Stripe ne se modifie pas : il faut en créer un nouveau et');
      console.error('  cesser d’utiliser l’ancien — les abonnés en cours restent sur le leur.');
      console.error('  Ce script ne le fera pas à ta place : changer un prix engage des');
      console.error('  clients, ce n’est pas une décision de script.');
      process.exit(1);
    }
    trouves[tarif.libelle] = deja.id;
    console.log(`✓ tarif ${tarif.libelle} déjà présent : ${deja.id}  (${euros(deja.unit_amount)})`);
    continue;
  }

  const cree = await stripe('prices', {
    product: produit.id,
    lookup_key: tarif.cle,
    currency: 'eur',
    unit_amount: String(tarif.montant),
    'recurring[interval]': tarif.intervalle,
    // Le prix affiché à un consommateur français est TTC : on le déclare, pour
    // que Stripe ne rajoute pas la TVA par-dessus le jour où Stripe Tax sera
    // activé. C'est une ligne aujourd'hui, une facture fausse plus tard.
    tax_behavior: 'inclusive',
    // AUCUNE période d'essai ici, et c'est délibéré. Les 30 jours sont posés
    // par `supabase/functions/billing` au moment de créer la session
    // (`trial_period_days`) : c'est ce qui permet de refuser un second essai à
    // une famille qui en a déjà eu un, et d'allonger celui du filleul. Un
    // essai posé aussi sur le tarif s'ajouterait au premier.
  });
  trouves[tarif.libelle] = cree.id;
  console.log(`+ tarif ${tarif.libelle} créé : ${cree.id}  (${euros(cree.unit_amount)})`);
}

/* ------------------------------------------------------------ à recopier */

console.log('');
console.log('À poser en secrets Supabase :');
console.log('');
console.log(`  STRIPE_PRICE_MONTHLY=${trouves.mensuel}`);
console.log(`  STRIPE_PRICE_YEARLY=${trouves.annuel}`);
console.log('');
