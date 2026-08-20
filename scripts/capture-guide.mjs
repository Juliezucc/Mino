#!/usr/bin/env node
/**
 * Takes the screenshots used by the in-app guide, by driving the real app.
 *
 * Generating them rather than drawing them is the whole point: a guide
 * illustrated with hand-made mockups drifts out of date the first time a button
 * moves, and a parent following a picture that no longer matches their screen
 * gives up. Re-run this after any change to the screens it covers.
 *
 * Requires a web build to be served:
 *   npx expo export -p web --output-dir dist
 *   npx http-server dist -p 8099 --silent &
 *   npx playwright install chromium      # once
 *   node scripts/capture-guide.mjs
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const require = createRequire(import.meta.url);

/** Playwright may be a project dependency or a global install. */
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(id);
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Playwright introuvable. `npm i -D playwright && npx playwright install chromium`');
}

const URL = process.env.GUIDE_URL ?? 'http://127.0.0.1:8099/mino-preview.html';
const OUT = 'assets/guide';
const RAW = '/tmp/guide-raw';
/** Displayed around 280pt wide, so twice that keeps it crisp on a retina screen. */
const WIDTH = 560;
const PIN = ['1', '2', '3', '4'];

const { chromium } = loadPlaywright();

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

const problems = [];
page.on('pageerror', (error) => problems.push(String(error)));

const wait = (ms) => page.waitForTimeout(ms);

async function open() {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await wait(2500);
}

/**
 * Ramène au sélecteur de profil.
 *
 * L'application rouvre sur le dernier profil utilisé — c'est le comportement
 * voulu, et il n'y a aucune raison de le changer. Mais un script de capture, lui,
 * a besoin de repasser par « Qui utilise Mino ? » : il oublie donc ce que
 * l'appareil avait retenu, ce que fait aussi un parent qui réinstalle.
 */
async function toProfilePicker() {
  await page.evaluate(() => localStorage.removeItem('mino.device.profile.v1'));
  await open();
}

async function tap(text, settle = 1400) {
  const target = page.getByText(text, { exact: false }).first();
  await target.waitFor({ timeout: 10000 });
  await target.click();
  await wait(settle);
}

async function tab(name, settle = 1800) {
  await page.getByRole('tab', { name }).click();
  await wait(settle);
}

/** Screenshot, then convert to a WebP small enough to ship inside the app. */
async function shot(name) {
  const raw = `${RAW}/${name}.png`;
  await page.screenshot({ path: raw });
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
    '-vf', `scale=${WIDTH}:-1:flags=lanczos`, '-quality', '82', `${OUT}/${name}.webp`]);
  console.log(`${name}.webp`);
}

async function unlockParent() {
  await tap('Espace parent');
  for (const digit of PIN) {
    const key = page.getByText(digit, { exact: true }).first();
    await key.waitFor({ timeout: 8000 });
    await key.click();
    await wait(350);
  }
  await wait(1800);
}

/* ------------------------------------------------------------- le parcours */

await open();
await page.evaluate(() => localStorage.clear());
await open();

await shot('accueil');
await tap('Découvrir avec la démo');
await shot('qui');

// Côté enfant : ce que l'enfant voit et fait.
await tap('Noah', 1800);
await shot('enfant-accueil');

await tab('Temps');
await shot('enfant-temps');

// The child's "Missions" tab is the home; the list is one tap further in.
await tab('Missions');
await tap('VOIR MES MISSIONS');
await shot('enfant-missions');

await tap('Ranger ma chambre');
await shot('enfant-mission');
await tap('AI TERMINÉ', 1800);
await shot('enfant-attente');

// Côté parent : la validation, puis la configuration.
await toProfilePicker();
await unlockParent();
await shot('parent-accueil');

await tab('Missions');
await shot('parent-missions');

await tap('Routine du coucher', 1600);
await shot('parent-routine');
await page.goBack();
await wait(1600);

await tap('Créer une mission', 1600);
await shot('parent-nouvelle-mission');
await page.goBack();
await wait(1600);

await tab('Enfants');
await shot('parent-enfants');

await tab('Réglages');
await shot('parent-reglages');

await tap('Gérer mon abonnement', 1800);
await shot('parent-abonnement');
await page.goBack();
await wait(1600);

await tap('Parrainer une famille', 1800);
await shot('parent-parrainage');
await page.goBack();
await wait(1600);

await tap('Gérer les appareils', 1800);
await shot('parent-appareils');

// La célébration, une fois la mission confirmée.
await toProfilePicker();
await unlockParent();
await tap('C’est fait', 2200);
await toProfilePicker();
await tap('Noah', 2600);
await shot('enfant-celebration');

// L'écran de configuration côté enfant : il n'apparaît que sans famille locale.
await page.evaluate(() => localStorage.removeItem('mino.family.v1'));
await open();
await tap('J’ai un code famille', 1800);
await shot('rejoindre');

console.log(problems.length ? `\nerreurs : ${problems.slice(0, 3).join(' | ')}` : '\naucune erreur');
await browser.close();
