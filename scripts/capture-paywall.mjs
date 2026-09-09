#!/usr/bin/env node
/**
 * La capture d'écran que réclame App Store Connect pour un abonnement.
 *
 * Chaque abonnement déposé chez Apple exige une image montrant **où** il est
 * proposé dans l'application. Sans elle, l'abonnement reste « Métadonnées
 * manquantes » et la version ne part pas — y compris les offres
 * d'introduction, qui s'y accrochent.
 *
 * On la fabrique ici plutôt que sur un iPhone parce qu'il n'en faut pas un :
 * l'image sert de preuve d'emplacement, pas de visuel marketing. Et surtout,
 * elle doit se refaire à chaque fois que le prix, la durée ou la formule
 * changent — c'est-à-dire précisément ce qu'on ne refait pas quand il faut
 * ressortir un téléphone, refaire le parcours à la main et se transférer un
 * fichier.
 *
 * Sans clés Supabase dans l'environnement, l'application tombe sur son dépôt
 * local et sa doublure de facturation : la famille se crée en mémoire, l'essai
 * aussi, et l'écran de paiement s'affiche comme sur un vrai appareil.
 *
 * Prérequis :
 *   npx expo export -p web --output-dir dist
 *   node scripts/build-web-preview.mjs
 *   npx http-server dist -p 8099 --silent &
 *   node scripts/capture-paywall.mjs
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(id);
    } catch {
      /* on essaie le suivant */
    }
  }
  throw new Error('Playwright introuvable. `npm i -D playwright && npx playwright install chromium`');
}

const APP_URL = process.env.STORE_URL ?? 'http://127.0.0.1:8099/mino-preview.html';
/**
 * Une capture par abonnement, et non une pour les deux.
 *
 * L'écran est le même, mais la formule sélectionnée n'y est pas la même — et
 * c'est cette sélection-là qu'App Store Connect demande de montrer, abonnement
 * par abonnement. Déposer l'annuel en face du mensuel, c'est donner au
 * vérificateur une image où le prix qu'il vérifie n'est pas celui qui est mis
 * en avant.
 */
const SORTIE_ANNUEL = 'store/paywall-ios.png';
const SORTIE_MENSUEL = 'store/paywall-ios-mensuel.png';

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
// 393 × 852 en points, ×3 : 1179 × 2556 pixels, la définition d'un iPhone
// récent. App Store Connect n'impose pas de taille, mais une image au format
// d'un téléphone se lit sans effort par le vérificateur.
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });

const attendre = (ms) => page.waitForTimeout(ms);
const ou = async (etape) =>
  console.log(
    `[${etape}] ${(await page.evaluate(() => document.body.innerText)).slice(0, 120).replace(/\n+/g, ' · ')}`,
  );

/**
 * Un bouton désigné par son texte — et jamais un texte qui contient des liens.
 *
 * Le consentement de l'écran « enfant » est un bloc de phrase où « conditions
 * générales » et « politique de confidentialité » sont cliquables. Viser ce
 * texte fait tomber le clic au milieu, c'est-à-dire sur un lien : on quitte
 * l'écran au lieu de cocher la case.
 */
const bouton = async (texte) => {
  const cible = page.locator('button', { hasText: texte }).first();
  await cible.waitFor({ state: 'visible', timeout: 15000 });
  await cible.scrollIntoViewIfNeeded().catch(() => undefined);
  await cible.click();
  await attendre(1500);
};

const champ = async (placeholder, valeur) => {
  const cible = page.getByPlaceholder(placeholder).first();
  await cible.waitFor({ state: 'visible', timeout: 15000 });
  await cible.fill(valeur);
  await attendre(250);
};

await page.goto(APP_URL, { waitUntil: 'networkidle' });
await attendre(2500);
await ou('accueil');

await bouton('Créer ma famille');
await ou('enfant');

await champ('Noah', 'Lou');
// La case, à 14 points de son bord gauche, loin des deux liens.
await page.locator('[role="checkbox"]').first().click({ position: { x: 14, y: 14 } });
await attendre(300);
await bouton('Continuer');
await ou('mission');

await champ('Ranger ma chambre', 'Ranger ma chambre');
await bouton('CRÉER LA MISSION');
await ou('compte');

await champ('Julie', 'Julie');
await champ('julie@exemple.fr', 'julie@exemple.fr');
await champ('8 caractères minimum', 'mino-capture-2026');
await bouton('Continuer');
await attendre(2500);
await ou('abonnement');

const texte = await page.evaluate(() => document.body.innerText);
// Le garde-fou qui empêche de déposer chez Apple une capture d'un autre écran :
// le paywall a pu se sauter lui-même, ou le parcours s'arrêter sur une erreur.
if (!texte.includes('0 € aujourd’hui')) {
  throw new Error(`L'écran de paiement n'a pas été atteint. Écran obtenu :\n${texte.slice(0, 400)}`);
}

mkdirSync('store', { recursive: true });

// L'annuel, présélectionné : c'est l'état dans lequel le parent trouve l'écran.
await page.screenshot({ path: SORTIE_ANNUEL });
console.log(`→ ${SORTIE_ANNUEL}`);

// Puis le mensuel, choisi. Le cadre bleu quitte l'annuel et la ligne « Ou
// 9,99 € par mois » passe en bleu appuyé — c'est tout ce qui change à
// l'écran, et c'est précisément ce que la capture doit prouver.
const mensuel = page.getByText('Ou 9,99 € par mois').first();
await mensuel.waitFor({ state: 'visible', timeout: 15000 });
await mensuel.click();
await attendre(600);

/**
 * On vérifie ce que la capture doit montrer, et pas autre chose.
 *
 * L'état sélectionné ne se lit pas dans le balisage : React Native Web 0.21 ne
 * reporte plus `accessibilityState` sur la page — c'est un écart réel, mais
 * qui ne concerne que l'aperçu web, les applications natives recevant bien cet
 * état. Ce qu'on contrôle ici est donc la seule chose qui compte pour une
 * image : la ligne du mensuel est passée en gras bleu.
 */
const mensuelEnAvant = await page.evaluate(() => {
  const ligne = [...document.querySelectorAll('div')].find(
    (e) => e.childElementCount === 0 && e.textContent?.trim() === 'Ou 9,99 € par mois',
  );
  if (!ligne) return null;
  const style = getComputedStyle(ligne);
  return { police: style.fontFamily, couleur: style.color };
});
if (!mensuelEnAvant?.police.includes('Bold')) {
  throw new Error(
    `La formule mensuelle n'a pas été mise en avant (lu : ${JSON.stringify(mensuelEnAvant)}).`,
  );
}

await page.screenshot({ path: SORTIE_MENSUEL });
console.log(`→ ${SORTIE_MENSUEL}`);

await browser.close();
