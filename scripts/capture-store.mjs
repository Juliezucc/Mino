#!/usr/bin/env node
/**
 * Fabrique les captures de la fiche App Store et Play Store.
 *
 * Générées plutôt que montées à la main, pour la raison qui a déjà valu au
 * guide d'être généré : huit visuels par plateforme qui doivent rester
 * d'accord entre eux et avec l'application, ça ne survit pas à trois retouches
 * dans un éditeur d'images. Après un changement d'écran ou de charte, on
 * relance ce script.
 *
 * Deux passes, et c'est ce qui rend le résultat présentable :
 *
 *   1. **capture** — on conduit la vraie application dans Chromium et on
 *      photographie les écrans. Ce sont donc de vrais écrans, pas des maquettes.
 *   2. **composition** — on habille chaque capture dans une page HTML (dégradé
 *      de marque, légende en Nunito, coins arrondis, ombre douce) qu'on
 *      photographie à son tour, à la taille exacte demandée par la boutique.
 *
 * La deuxième passe se fait en HTML et non avec ffmpeg parce que la typographie
 * et les coins arrondis y sont justes du premier coup, là où une pile de
 * filtres vidéo demande une demi-journée pour un résultat approximatif.
 *
 * Prérequis :
 *   npx expo export -p web --output-dir dist
 *   node scripts/build-web-preview.mjs
 *   npx http-server dist -p 8099 --silent &
 *   node scripts/capture-store.mjs
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

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
const OUT = 'store';
const RAW = '/tmp/store-raw';
const PIN = ['1', '2', '3', '4'];

/**
 * Les formats demandés.
 *
 * Apple ne réclame plus qu'un seul jeu iPhone et dérive les autres ; Google
 * accepte une large plage et se contente de proportions. On produit donc le
 * jeu de référence de chacun, et rien de plus : des fichiers en trop sont des
 * fichiers qui vieillissent sans qu'on s'en aperçoive.
 *
 * Les dimensions exactes sont à confirmer dans App Store Connect au moment de
 * la soumission — c'est le genre de valeur qu'Apple ajuste sans prévenir. Voir
 * docs/ops/captures-stores.md.
 */
const FORMATS = [
  {
    id: 'ios-6.9',
    width: 1320,
    height: 2868,
    label: 'iPhone 6,9 pouces — jeu de référence Apple',
    // L'écran capturé, en points : c'est lui qui décide de la mise en page que
    // l'application rend, et donc de ce qu'on photographie.
    viewport: { width: 393, height: 852 },
    deviceFraction: 0.72,
    alpha: true,
  },
  {
    id: 'ios-6.5',
    width: 1284,
    height: 2778,
    /**
     * Le second emplacement iPhone, produit par prudence.
     *
     * Le 6,9 pouces reste le jeu de référence : c'est lui qu'on remplit, et
     * Apple dérive toutes les autres tailles. Mais la page de la version
     * n'affiche d'emblée que l'emplacement « Écran de 6,5 pouces » — le 6,9
     * n'apparaît qu'en ouvrant le gestionnaire des visuels. Déposer le
     * 1320 × 2868 dans la case visible donne un refus en rouge qui ne dit pas
     * qu'on s'est trompé de case : « Les dimensions d'au moins une capture
     * d'écran sont incorrectes. »
     *
     * Produire les deux coûte quelques secondes et évite de rester bloqué
     * devant une erreur qui décrit le symptôme. Ce qu'Apple présente change
     * sans prévenir — c'est ce qu'annonce le commentaire ci-dessus — et avoir
     * les deux formats sous la main vaut mieux que d'en deviner un.
     */
    label: 'iPhone 6,5 pouces — le second emplacement, par prudence',
    viewport: { width: 393, height: 852 },
    deviceFraction: 0.72,
    alpha: true,
  },
  {
    id: 'ios-ipad-13',
    width: 2064,
    height: 2752,
    label: 'iPad 13 pouces — obligatoire tant que supportsTablet vaut true',
    viewport: { width: 1024, height: 1366 },
    // Une tablette est large : le même rapport que sur téléphone donnerait un
    // écran minuscule perdu au milieu de la page.
    deviceFraction: 0.82,
    alpha: true,
  },
  {
    id: 'android',
    width: 1080,
    height: 1920,
    label: 'Google Play — téléphone',
    viewport: { width: 393, height: 852 },
    deviceFraction: 0.72,
    // Play refuse un PNG porteur d'un canal alpha : on aplatit en JPEG.
    alpha: false,
  },
];

/**
 * Le fil, dans l'ordre où il défilera sur la fiche.
 *
 * Le premier compte plus que les sept autres réunis : c'est souvent le seul
 * qu'un parent regarde avant de décider. `path` est la suite de gestes qui
 * mène à l'écran dans la démo — vérifiée en conduisant l'application, pas
 * supposée.
 */
const SCREENS = JSON.parse(readFileSync(new URL('./store-screens.json', import.meta.url), 'utf8'));

/* ---------------------------------------------------------------- la marque */

const font = (weight, file) =>
  `@font-face{font-family:'Nunito';font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${readFileSync(
    `node_modules/@expo-google-fonts/nunito/${file}`,
  ).toString('base64')}) format('truetype');}`;

const FONTS =
  font(800, '800ExtraBold/Nunito_800ExtraBold.ttf') + font(600, '600SemiBold/Nunito_600SemiBold.ttf');

/** Les fonds alternent, pour que le défilé de la fiche ne soit pas monotone. */
const BACKGROUNDS = [
  ['#E8F3FF', '#F7FAFF'],
  ['#EAF7F1', '#F8FCFA'],
  ['#F1EFFF', '#FAF9FF'],
  ['#FFF4E8', '#FFFBF6'],
];

/**
 * La page qui habille une capture.
 *
 * Tout est en unités relatives à la hauteur demandée : le même gabarit sert
 * donc au format Apple et au format Google sans qu'aucune valeur ne soit à
 * reprendre à la main.
 */
function compose({ shot, caption, subcaption, index, width, height, deviceFraction }) {
  const [from, to] = BACKGROUNDS[index % BACKGROUNDS.length];

  // Deux unités, et il faut les deux : ce qui est horizontal — largeur de
  // l'appareil, corps du texte — se règle sur la largeur, ce qui est vertical
  // sur la hauteur. Tout mesurer avec une seule fait déborder l'appareil du
  // cadre dès que les proportions changent d'une boutique à l'autre.
  const w = width / 1000;
  const h = height / 1000;

  return `<!doctype html><meta charset="utf-8"><style>
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${width}px;height:${height}px;overflow:hidden;
      background:linear-gradient(165deg,${from} 0%,${to} 62%);
      font-family:'Nunito',system-ui,sans-serif;
      display:flex;flex-direction:column;align-items:center;
      padding:${62 * h}px ${70 * w}px 0}
    h1{font-weight:800;font-size:${58 * w}px;line-height:1.14;color:#1A1D2E;
      text-align:center;letter-spacing:${-0.6 * w}px}
    p{font-weight:600;font-size:${31 * w}px;line-height:1.38;color:#5B6480;
      text-align:center;margin-top:${18 * h}px;max-width:${860 * w}px}
    /* L'appareil déborde volontairement en bas : la fiche défile, et un écran
       coupé donne envie de faire glisser le doigt. */
    .device{margin-top:${46 * h}px;width:${deviceFraction * width}px;flex:none;
      border-radius:${40 * w}px;overflow:hidden;background:#F2F6FF;
      box-shadow:0 ${26 * h}px ${62 * h}px rgba(26,29,46,.16),
                 0 ${4 * h}px ${12 * h}px rgba(26,29,46,.06)}
    .device img{display:block;width:100%}
  </style>
  <h1>${caption}</h1>
  <p>${subcaption}</p>
  <div class="device"><img src="data:image/png;base64,${shot}"></div>`;
}

/* ------------------------------------------------------------- le programme */

const { chromium } = loadPlaywright();

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];

const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
page.on('pageerror', (error) => problems.push(String(error).slice(0, 200)));

const wait = (ms) => page.waitForTimeout(ms);

async function open() {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await wait(2600);
}

async function step(instruction) {
  // « onglet Temps » vise la barre d'onglets, faite de liens et non de texte :
  // la viser par son libellé attraperait n'importe quel homonyme de la page.
  const tab = instruction.match(/^onglet (.+)$/i);
  if (tab) {
    const routes = {
      missions: '/child',
      temps: '/child/temps',
      profil: '/child/profil',
      accueil: '/parent',
      'missions-parent': '/parent/missions',
      enfants: '/parent/enfants',
      'réglages': '/parent/reglages',
      reglages: '/parent/reglages',
    };
    const href = routes[tab[1].toLowerCase()];
    if (href) {
      await page.locator(`a[href="${href}"]`).first().click();
      await wait(1500);
      return;
    }
  }

  // « défiler 420 » : certains écrans ont leur moment plus bas que le pli.
  // C'est le cas de la confirmation — les deux boutons sont ce qu'il faut
  // montrer, et ils arrivent après la vue d'ensemble.
  const scroll = instruction.match(/^défiler (\d+)$/i);
  if (scroll) {
    await page.mouse.move(200, 500);
    await page.mouse.wheel(0, Number(scroll[1]));
    await wait(900);
    return;
  }

  if (instruction === 'code parent') {
    for (const digit of PIN) {
      await page.getByText(digit, { exact: true }).filter({ visible: true }).first().click();
      await wait(320);
    }
    await wait(1700);
    return;
  }

  const target = page.getByText(instruction, { exact: false }).filter({ visible: true }).first();
  await target.waitFor({ timeout: 12000 });
  await target.click();
  await wait(1500);
}

/** Rejoue le chemin d'un écran depuis une démo neuve, et photographie. */
async function capture(screen, viewport) {
  await page.setViewportSize(viewport);
  await open();
  // Repartir d'une démo neuve à chaque fois : une capture qui dépend de la
  // précédente casse dès qu'on en réordonne une seule.
  await page.evaluate(() => localStorage.clear());
  await open();

  for (const instruction of screen.path.split('→').map((part) => part.trim())) {
    if (instruction) await step(instruction);
  }
  return page.screenshot();
}

const composer = await browser.newPage();
/**
 * On vide le dossier avant d'écrire, comme on vide déjà le dossier temporaire.
 *
 * **Le défaut que cela répare.** Seul `RAW` était nettoyé ; `store/` ne l'était
 * pas. Le script écrasait donc les fichiers de même nom et laissait les autres
 * intacts — or les noms viennent des légendes, et une légende réécrite change
 * de nom. Après deux campagnes, le dossier contenait `01-promesse.png` à côté
 * de `01-temps-gagne.png` : deux premières captures, aucune façon de savoir
 * laquelle est d'aujourd'hui, dans un dossier qu'on ouvre pour glisser des
 * fichiers vers une boutique.
 *
 * C'est exactement ce que redoutait le commentaire des formats plus haut —
 * « des fichiers en trop sont des fichiers qui vieillissent sans qu'on s'en
 * aperçoive » — et il manquait la ligne qui l'empêche. Le risque n'est pas
 * l'encombrement : c'est de publier une capture qui annonce un ancien prix.
 */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const format of FORMATS) mkdirSync(`${OUT}/${format.id}`, { recursive: true });

/** Les tailles d'écran distinctes : on ne rejoue un parcours qu'une fois par taille. */
const viewports = [...new Set(FORMATS.map((f) => JSON.stringify(f.viewport)))].map((v) =>
  JSON.parse(v),
);

let index = 0;
let written = 0;

for (const screen of SCREENS) {
  const shots = new Map();

  for (const viewport of viewports) {
    try {
      const raw = await capture(screen, viewport);
      const key = `${viewport.width}x${viewport.height}`;
      shots.set(key, raw.toString('base64'));
      writeFileSync(`${RAW}/${screen.id}-${key}.png`, raw);
    } catch (error) {
      problems.push(`${screen.id} @ ${viewport.width}px : ${String(error).split('\n')[0]}`);
    }
  }

  for (const format of FORMATS) {
    const shot = shots.get(`${format.viewport.width}x${format.viewport.height}`);
    if (!shot) continue;

    await composer.setViewportSize({ width: format.width, height: format.height });
    await composer.setContent(
      compose({ shot, ...screen, index, ...format }),
      { waitUntil: 'load' },
    );
    await composer.waitForTimeout(140);

    // Play refuse un PNG avec canal alpha ; le JPEG l'aplatit, et une capture
    // d'interface n'a rien à y perdre à qualité 92.
    const extension = format.alpha ? 'png' : 'jpg';
    const file = `${OUT}/${format.id}/${String(index + 1).padStart(2, '0')}-${screen.id}.${extension}`;
    await composer.screenshot(
      format.alpha ? { path: file } : { path: file, type: 'jpeg', quality: 92 },
    );
    console.log(file);
    written += 1;
  }

  index += 1;
}

/* ------------------------------------------- les visuels de la fiche Play */

/**
 * Deux images qu'aucune capture ne remplace, et sans lesquelles Google refuse
 * de publier : l'icône et l'image mise en avant.
 *
 * Ni prix, ni « gratuit », ni note, ni « Télécharger » : Google interdit tout
 * cela sur l'image mise en avant. Le centre reste dégagé, parce que le nom de
 * l'application vient parfois se superposer par-dessus.
 */
mkdirSync(`${OUT}/play`, { recursive: true });

const mascot = readFileSync('assets/mascot/happy.png').toString('base64');

await composer.setViewportSize({ width: 1024, height: 500 });
await composer.setContent(
  `<!doctype html><meta charset="utf-8"><style>
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:1024px;height:500px;overflow:hidden;
      background:linear-gradient(120deg,#E8F3FF 0%,#F4F1FF 55%,#FFF6EC 100%);
      font-family:'Nunito',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:space-between;
      padding:0 78px}
    .words{max-width:560px}
    h1{font-weight:800;font-size:56px;line-height:1.08;color:#1A1D2E;letter-spacing:-1px}
    p{font-weight:600;font-size:26px;line-height:1.35;color:#5B6480;margin-top:18px}
    img{height:330px;filter:drop-shadow(0 22px 40px rgba(26,29,46,.18))}
  </style>
  <div class="words">
    <h1>Grandir,<br>une mission à la fois.</h1>
    <p>Ses missions, son temps d’écran.</p>
  </div>
  <img src="data:image/png;base64,${mascot}">`,
  { waitUntil: 'load' },
);
await composer.waitForTimeout(160);
await composer.screenshot({ path: `${OUT}/play/feature-graphic-1024x500.jpg`, type: 'jpeg', quality: 92 });
console.log(`${OUT}/play/feature-graphic-1024x500.jpg`);

await browser.close();

// L'icône de la fiche Play : 512², PNG avec alpha, tirée de l'icône de l'app
// pour qu'elles ne puissent pas diverger.
execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'assets/icon.png',
  '-vf', 'scale=512:512:flags=lanczos', '-frames:v', '1', `${OUT}/play/icon-512.png`]);
console.log(`${OUT}/play/icon-512.png`);

if (problems.length) {
  console.error(`\n${problems.length} problème(s) :`);
  for (const problem of problems) console.error(`  · ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`\n${written} fichiers — ${index} écrans × ${FORMATS.length} formats, dans ${OUT}/`);
}
