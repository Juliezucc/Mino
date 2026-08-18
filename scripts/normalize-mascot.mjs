#!/usr/bin/env node
/**
 * Normalises the mascot renders so every expression can be swapped in place
 * without the character jumping.
 *
 * The 3D renders come framed differently on purpose — Mino sits down when it is
 * sleepy, throws its arms out when it is delighted, and some poses carry props
 * (confetti, a storm cloud, ZZZ) that inflate the image far beyond the body.
 * Dropped in as-is, the mascot would change size and position on every screen.
 *
 * So this script ignores the image bounds and aligns on the character instead:
 *
 *   1. it isolates the body blue and finds the largest circle that fits inside
 *      it — the round body — which gives a centre and a radius that mean the
 *      same thing in all eight poses, whatever the arms and props are doing;
 *   2. it picks the largest common scale at which no pose gets clipped;
 *   3. it renders all eight onto one square canvas, body centred and identical
 *      in size, props preserved around it.
 *
 * Usage:  node scripts/normalize-mascot.mjs
 *         reads  assets/mascot/source/<expression>.png   (untouched originals)
 *         writes assets/mascot/<expression>.png          (used by the app)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

import ffmpeg from 'ffmpeg-static';

const SOURCE_DIR = 'assets/mascot/source';
const OUT_DIR = 'assets/mascot';
/** Output canvas, square. Big enough for the largest on-screen use at @3x. */
const CANVAS = 1024;
/** Width the analysis runs at — precision here is worth ~2px on the source. */
const ANALYSIS_WIDTH = 400;
/** Treated as "the character" rather than a prop or an eye highlight. */
const isBodyBlue = (r, g, b, a) => a > 128 && b > 140 && g > r + 25 && b > r + 40;

function decode(file, width) {
  const out = execFileSync(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-i', file,
     '-vf', `scale=${width}:-1`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
    { maxBuffer: 1 << 30 },
  );
  const height = out.length / (width * 4);
  if (!Number.isInteger(height)) throw new Error(`taille inattendue pour ${file}`);
  return { data: out, width, height };
}

/**
 * Largest inscribed circle of the body mask, via a chamfer distance transform.
 * Arms, legs and props stick out of the body but never contain a bigger circle
 * than the body itself, which is what makes this robust across poses.
 */
function bodyCircle({ data, width, height }) {
  const INF = 1e9;
  const blue = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      blue[y * width + x] = isBodyBlue(data[i], data[i + 1], data[i + 2], data[i + 3]) ? 1 : 0;
    }
  }

  // The eyes, mouth and specular highlight are huge non-blue holes punched in
  // the middle of the face. Left as-is they split the mask and the inscribed
  // circle squeezes between them, reporting a body several times too small.
  // Anything not blue that can't reach the image border is inside the body.
  const outside = new Uint8Array(width * height);
  const queue = [];
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const k = y * width + x;
    if (outside[k] || blue[k]) return;
    outside[k] = 1;
    queue.push([x, y]);
  };
  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    visit(0, y);
    visit(width - 1, y);
  }
  while (queue.length > 0) {
    const [x, y] = queue.pop();
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }

  const dist = new Float32Array(width * height);
  for (let k = 0; k < dist.length; k += 1) {
    dist[k] = blue[k] || !outside[k] ? INF : 0;
  }

  const D1 = 1;
  const D2 = Math.SQRT2;
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : dist[y * width + x]);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = y * width + x;
      if (dist[k] === 0) continue;
      dist[k] = Math.min(
        dist[k],
        at(x - 1, y) + D1, at(x, y - 1) + D1,
        at(x - 1, y - 1) + D2, at(x + 1, y - 1) + D2,
      );
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const k = y * width + x;
      if (dist[k] === 0) continue;
      dist[k] = Math.min(
        dist[k],
        at(x + 1, y) + D1, at(x, y + 1) + D1,
        at(x + 1, y + 1) + D2, at(x - 1, y + 1) + D2,
      );
    }
  }

  let best = 0;
  let cx = width / 2;
  let cy = height / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = dist[y * width + x];
      if (d > best && d < INF) {
        best = d;
        cx = x;
        cy = y;
      }
    }
  }
  return { cx, cy, radius: best };
}

/**
 * Bounding box of the character alone — body, arms, legs and shoes.
 *
 * Props never touch the character (confetti, storm cloud, ZZZ, sweat drops,
 * exclamation marks all float free), so flood-filling the visible pixels from
 * the body centre separates the two without any colour heuristics. Framing on
 * the character is what keeps the mascot a usable size on screen: framing on
 * the props would shrink it to fit the widest confetti burst.
 */
function characterBox({ data, width, height }, start) {
  const seen = new Uint8Array(width * height);
  const visible = (x, y) => data[(y * width + x) * 4 + 3] > 8;

  const stack = [[Math.round(start.cx), Math.round(start.cy)]];
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const k = y * width + x;
    if (seen[k] || !visible(x, y)) continue;
    seen[k] = 1;

    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/* ---------------------------------------------------------------- analysis */

if (!existsSync(SOURCE_DIR)) {
  console.error(`Dossier introuvable : ${SOURCE_DIR}`);
  process.exit(1);
}

const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.png')).sort();
if (files.length === 0) {
  console.error(`Aucun PNG dans ${SOURCE_DIR}`);
  process.exit(1);
}

const poses = files.map((file) => {
  const full = path.join(SOURCE_DIR, file);
  const image = decode(full, ANALYSIS_WIDTH);
  const circle = bodyCircle(image);
  const box = characterBox(image, circle);
  if (circle.radius < 10) throw new Error(`corps non détecté dans ${file}`);

  // Everything is expressed in body radii, which is what makes the poses comparable.
  return {
    name: path.basename(file, '.png'),
    file: full,
    circle,
    box,
    left: (circle.cx - box.x0) / circle.radius,
    right: (box.x1 - circle.cx) / circle.radius,
    top: (circle.cy - box.y0) / circle.radius,
    bottom: (box.y1 - circle.cy) / circle.radius,
  };
});

// Largest body radius that keeps every character inside the canvas. Props that
// reach further than this get cropped, which is the right trade: a slightly
// clipped confetti beats a mascot too small to read.
const eLeft = Math.max(...poses.map((p) => p.left));
const eRight = Math.max(...poses.map((p) => p.right));
const eTop = Math.max(...poses.map((p) => p.top));
const eBottom = Math.max(...poses.map((p) => p.bottom));

const targetY = Math.round((CANVAS * eTop) / (eTop + eBottom));
const targetX = Math.round(CANVAS / 2);
const radius = Math.floor(
  Math.min(targetX / eLeft, (CANVAS - targetX) / eRight, targetY / eTop, (CANVAS - targetY) / eBottom),
);

console.log(`Canvas ${CANVAS}px · corps ⌀${radius * 2}px · centre (${targetX}, ${targetY})`);
console.log('');

mkdirSync(OUT_DIR, { recursive: true });

for (const pose of poses) {
  // Measurements are in analysis pixels; this maps them to output pixels.
  const scale = radius / pose.circle.radius;
  const outWidth = Math.round(ANALYSIS_WIDTH * scale);
  const cx = pose.circle.cx * scale;
  const cy = pose.circle.cy * scale;

  // Pad generously so the crop window is always inside the frame, then cut.
  const pad = CANVAS;
  const cropX = Math.round(cx - targetX + pad);
  const cropY = Math.round(cy - targetY + pad);

  const filters = [
    `scale=${outWidth}:-1:flags=lanczos`,
    'format=rgba',
    `pad=iw+${pad * 2}:ih+${pad * 2}:${pad}:${pad}:color=black@0`,
    `crop=${CANVAS}:${CANVAS}:${cropX}:${cropY}`,
  ].join(',');

  const out = path.join(OUT_DIR, `${pose.name}.png`);
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', pose.file,
    '-vf', filters, '-pix_fmt', 'rgba', out]);

  console.log(
    `${pose.name.padEnd(11)} corps ⌀${Math.round(pose.circle.radius * 2)}px → ⌀${radius * 2}px` +
      `   personnage ${pose.left.toFixed(2)}←→${pose.right.toFixed(2)} ${pose.top.toFixed(2)}↑↓${pose.bottom.toFixed(2)} rayons`,
  );
}

console.log('\nTerminé.');
