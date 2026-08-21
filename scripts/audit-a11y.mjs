#!/usr/bin/env node
/**
 * Mesure ce que le cahier des charges affirme : « gros boutons, atteignables
 * par un enfant de 5 ans, icône + texte, contraste suffisant ».
 *
 * Trois choses qu'on ne peut pas vérifier en relisant le code, parce qu'elles
 * ne dépendent pas d'une ligne mais du rendu : la taille réellement affichée,
 * la couleur réellement calculée, et le libellé réellement lu à voix haute par
 * un lecteur d'écran.
 *
 * Les seuils :
 *
 * - **44 points**, le minimum d'Apple, et **48** celui de Google. On retient 44
 *   partout, et **60** sur les écrans de l'enfant : viser une cible de 44 avec
 *   un doigt de cinq ans dans une voiture n'a rien à voir avec la viser assis à
 *   son bureau.
 * - **4,5:1** de contraste pour le texte courant, **3:1** pour le grand texte
 *   (WCAG AA). C'est aussi ce que regarde Apple pour l'accessibilité déclarée.
 * - **un nom accessible** sur tout ce qui se touche. Sans lui, VoiceOver
 *   annonce « bouton », ce qui n'aide personne.
 *
 * Usage :  AUDIT_URL=http://127.0.0.1:4181/ node scripts/audit-a11y.mjs
 */

import { createRequire } from 'node:module';

const APP_URL = process.env.AUDIT_URL || 'http://127.0.0.1:4181/';

function loadPlaywright() {
  for (const base of ['/opt/node22/lib/node_modules/playwright/', `${process.cwd()}/`]) {
    try {
      return createRequire(base)('playwright');
    } catch {
      /* on essaie le suivant */
    }
  }
  throw new Error('playwright introuvable');
}

/** Seuils, par registre. */
const MIN_TOUCH = { enfant: 60, parent: 44 };

/**
 * Les écarts assumés, avec leur raison.
 *
 * Écrits ici plutôt que rattrapés en silence : un audit dont on baisse le
 * seuil jusqu'à ce qu'il passe ne mesure plus rien. Ces éléments restent
 * comptés et affichés, simplement à part.
 */
const ACCEPTED = [
  {
    label: /^Retour$/,
    min: 52,
    why: "chrome de navigation partagé avec l'espace parent ; 52 dépasse les minimums d'Apple (44) et de Google (48), et une flèche de 64 dans un en-tête écrase le titre",
  },
];
const MIN_CONTRAST = { normal: 4.5, large: 3 };

/**
 * Les écrans, et comment y arriver.
 *
 * Même grammaire de chemin que `capture-store.mjs` — un libellé à toucher,
 * `onglet X`, `code parent` — pour qu'il n'y ait qu'une façon de décrire un
 * parcours dans ce dépôt.
 */
const SCREENS = [
  { id: 'accueil-enfant', registre: 'enfant', path: 'Découvrir avec la démo → Noah' },
  { id: 'missions-enfant', registre: 'enfant', path: 'Découvrir avec la démo → Noah → VOIR MES MISSIONS' },
  {
    id: 'mission-enfant',
    registre: 'enfant',
    path: 'Découvrir avec la démo → Noah → VOIR MES MISSIONS → Ranger ma chambre',
  },
  { id: 'temps-enfant', registre: 'enfant', path: 'Découvrir avec la démo → Noah → onglet Temps' },
  { id: 'profil-enfant', registre: 'enfant', path: 'Découvrir avec la démo → Noah → onglet Profil' },
  // L'écran d'accueil s'adresse à un parent qui installe : c'est le seul de
  // cette liste où le seuil adulte est le bon.
  { id: 'accueil-app', registre: 'parent', path: '' },
  { id: 'qui', registre: 'enfant', path: 'Découvrir avec la démo → Espace parent → code parent → onglet Réglages → Verrouiller l’espace parent' },
  {
    id: 'accueil-parent',
    registre: 'parent',
    path: 'Découvrir avec la démo → Espace parent → code parent',
  },
  {
    id: 'missions-parent',
    registre: 'parent',
    path: 'Découvrir avec la démo → Espace parent → code parent → onglet Missions-parent',
  },
  {
    id: 'reglages-parent',
    registre: 'parent',
    path: 'Découvrir avec la démo → Espace parent → code parent → onglet Réglages',
  },
];

/* ------------------------------------------------- ce qui se mesure, dans la page */

/**
 * Injecté dans la page. Écrit sans dépendance : il tourne dans le navigateur,
 * pas ici.
 */
const PROBE = `(() => {
  const luminance = (r, g, b) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const parse = (colour) => {
    const m = colour.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map((v) => parseFloat(v));
    return { r, g, b, a: a === undefined ? 1 : a };
  };

  /** La première couleur de fond réellement opaque en remontant les parents. */
  const backgroundOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a >= 0.95) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const ratio = (a, b) => {
    const la = luminance(a.r, a.g, a.b);
    const lb = luminance(b.r, b.g, b.b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity || '1') > 0.05;
  };

  const touches = [];
  const contrasts = [];

  for (const el of document.querySelectorAll('[role="button"], button, [role="switch"], [role="link"], a, input')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    touches.push({
      w: Math.round(r.width),
      h: Math.round(r.height),
      label: (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
    });
  }

  // Les nœuds qui portent du texte, et eux seuls : mesurer un conteneur
  // reviendrait à comparer une couleur héritée à un fond qu'il ne montre pas.
  for (const el of document.querySelectorAll('div, span, p, h1, h2, h3, a, button')) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg || fg.a < 0.95) continue;
    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10) || 400;
    // WCAG : « grand texte » = 18,66px en gras, ou 24px.
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const bg = backgroundOf(el);
    const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    contrasts.push({
      fg: hex(fg),
      bg: hex(bg),
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
      size: Math.round(size * 10) / 10,
      large,
      text: el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 50),
    });
  }

  return { touches, contrasts };
})()`;

/* ------------------------------------------------------------- le programme */

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
const wait = (ms) => page.waitForTimeout(ms);
const PIN = '1234';

async function step(instruction) {
  const tab = instruction.match(/^onglet (.+)$/i);
  if (tab) {
    const routes = {
      missions: '/child',
      temps: '/child/temps',
      profil: '/child/profil',
      accueil: '/parent',
      'missions-parent': '/parent/missions',
      enfants: '/parent/enfants',
      réglages: '/parent/reglages',
      reglages: '/parent/reglages',
    };
    const href = routes[tab[1].toLowerCase()];
    if (href) {
      await page.locator(`a[href="${href}"]`).first().click();
      await wait(1400);
      return;
    }
  }

  if (instruction === 'code parent') {
    for (const digit of PIN) {
      await page.getByText(digit, { exact: true }).filter({ visible: true }).first().click();
      await wait(300);
    }
    await wait(1600);
    return;
  }

  const target = page.getByText(instruction, { exact: false }).filter({ visible: true }).first();
  await target.waitFor({ timeout: 12000 });
  await target.click();
  await wait(1400);
}

const problems = [];
page.on('pageerror', (e) => problems.push(String(e).slice(0, 160)));

let touchFails = 0;
let contrastFails = 0;
let unnamed = 0;

for (const screen of SCREENS) {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await wait(2200);
  await page.evaluate(() => localStorage.clear());
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await wait(2400);

  try {
    for (const part of screen.path.split('→').map((p) => p.trim())) {
      if (part) await step(part);
    }
  } catch (error) {
    console.log(`\n${screen.id} : chemin injouable — ${String(error).split('\n')[0]}`);
    continue;
  }

  const { touches, contrasts } = await page.evaluate(PROBE);
  const minTouch = MIN_TOUCH[screen.registre];

  const tolere = (t) =>
    ACCEPTED.some((e) => e.label.test(t.label) && Math.min(t.w, t.h) >= e.min);
  const petits = touches.filter((t) => Math.min(t.w, t.h) < minTouch && !tolere(t));
  const acceptes = touches.filter((t) => Math.min(t.w, t.h) < minTouch && tolere(t));
  const sansNom = touches.filter((t) => !t.label);
  const faibles = contrasts.filter(
    (c) => c.ratio < (c.large ? MIN_CONTRAST.large : MIN_CONTRAST.normal),
  );

  touchFails += petits.length;
  unnamed += sansNom.length;
  contrastFails += faibles.length;

  console.log(`\n=== ${screen.id}  (${screen.registre}, seuil ${minTouch} px)`);
  console.log(`    ${touches.length} éléments touchables · ${contrasts.length} textes`);

  for (const t of petits) {
    console.log(`  ⚠ ${t.w}×${t.h} — « ${t.label || '(sans nom)'} »`);
  }
  for (const t of acceptes) {
    const e = ACCEPTED.find((x) => x.label.test(t.label));
    console.log(`  · ${t.w}×${t.h} — « ${t.label} » — écart assumé : ${e.why}`);
  }
  for (const t of sansNom) {
    console.log(`  ⚠ sans nom accessible — ${t.role} ${t.w}×${t.h}`);
  }
  for (const c of faibles) {
    console.log(
      `  ⚠ ${c.ratio}:1  ${c.fg} sur ${c.bg}  (${c.size}px${c.large ? ', grand' : ''}) — « ${c.text} »`,
    );
  }
  if (!petits.length && !sansNom.length && !faibles.length && !acceptes.length)
    console.log('    rien à signaler');
}

console.log('\n────────────────────────');
console.log(`cibles trop petites : ${touchFails}`);
console.log(`sans nom accessible : ${unnamed}`);
console.log(`contrastes insuffisants : ${contrastFails}`);
console.log(`erreurs de page : ${problems.length ? problems.join(' | ') : 'aucune'}`);

await browser.close();
process.exit(touchFails + unnamed + contrastFails > 0 ? 1 : 0);
