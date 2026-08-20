#!/usr/bin/env node
/**
 * Cuts a sheet of avatar characters on white into six transparent PNGs.
 *
 * The sheet is a 2×3 grid, but the script does not trust that: it keys the
 * white background, finds the connected blobs of visible pixels, and keeps the
 * six largest. A character whose arm crosses the grid line, or a sheet exported
 * with different margins, still comes out right.
 *
 * Each avatar is then squared and scaled to a common size, so that six
 * creatures of different heights sit identically inside their circles — an
 * avatar that jumps by a few pixels between profiles reads as sloppy at 26px.
 *
 * Usage:  node scripts/slice-avatars.mjs assets/avatars/source/monsters.png
 *
 * Order of the output is left-to-right, top-to-bottom, matching AVATARS in
 * `src/components/ui/Avatar.tsx`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const SHEET = process.argv[2] ?? 'assets/avatars/source/monsters.png';
const OUT = 'assets/avatars';
const NAMES = ['blue', 'green', 'pink', 'yellow', 'purple', 'teal'];
const SIZE = 512;
/** Share of the square the character fills, leaving air inside the circle. */
const FILL = 0.88;

mkdirSync(OUT, { recursive: true });

let probe = '';
try {
  execFileSync(ffmpeg, ['-hide_banner', '-i', SHEET], { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  probe = error.stderr?.toString() ?? '';
}
const match = probe.match(/,\s(\d{2,5})x(\d{2,5})[\s,]/);
if (!match) throw new Error(`dimensions illisibles pour ${SHEET}`);
const W = Number(match[1]);
const H = Number(match[2]);
console.log(`planche ${W}x${H}`);

const raw = execFileSync(
  ffmpeg,
  ['-hide_banner', '-loglevel', 'error', '-i', SHEET, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
  { maxBuffer: 1 << 30 },
);

/**
 * Background = the near-white pixels reachable from the border. Enclosed
 * whites — eye highlights, teeth — cannot reach it and stay opaque, which is
 * what a plain colour threshold gets wrong.
 */
const bg = new Uint8Array(W * H);
const isBg = (i) => {
  const r = raw[i], g = raw[i + 1], b = raw[i + 2];
  const min = Math.min(r, g, b);
  return min > 205 && Math.max(r, g, b) - min < 22;
};
{
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (bg[k] || !isBg(k * 4)) return;
    bg[k] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x += 1) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y += 1) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

// Connected blobs of foreground: one per character.
const seen = new Uint8Array(W * H);
const blobs = [];
for (let sy = 0; sy < H; sy += 1) {
  for (let sx = 0; sx < W; sx += 1) {
    const start = sy * W + sx;
    if (seen[start] || bg[start]) continue;

    let x0 = sx, x1 = sx, y0 = sy, y1 = sy, count = 0;
    const stack = [sx, sy];
    seen[start] = 1;
    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      count += 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (seen[k] || bg[k]) continue;
        seen[k] = 1;
        stack.push(nx, ny);
      }
    }
    if (count > (W * H) / 400) blobs.push({ x0, x1, y0, y1, count });
  }
}

if (blobs.length < NAMES.length) {
  throw new Error(`${blobs.length} personnages trouvés, ${NAMES.length} attendus`);
}

// Six biggest, then read them like a page: rows first, then left to right.
const rowHeight = H / 6;
const characters = blobs
  .sort((a, b) => b.count - a.count)
  .slice(0, NAMES.length)
  .sort((a, b) => Math.floor(a.y0 / rowHeight) - Math.floor(b.y0 / rowHeight) || a.x0 - b.x0);

characters.forEach((blob, index) => {
  const name = NAMES[index];
  const w = blob.x1 - blob.x0 + 1;
  const h = blob.y1 - blob.y0 + 1;
  const side = Math.max(w, h);

  // Square crop centred on the character, then alpha from the keyed mask.
  const out = Buffer.alloc(SIZE * SIZE * 4);
  const scale = (SIZE * FILL) / side;
  const cx = blob.x0 + w / 2;
  const cy = blob.y0 + h / 2;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const sx = Math.round(cx + (x - SIZE / 2) / scale);
      const sy = Math.round(cy + (y - SIZE / 2) / scale);
      const o = (y * SIZE + x) * 4;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;

      const k = sy * W + sx;
      const i = k * 4;
      out[o] = raw[i];
      out[o + 1] = raw[i + 1];
      out[o + 2] = raw[i + 2];
      // Feather over 3x3 so edges land soft instead of stair-stepped.
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = sx + dx, ny = sy + dy;
          sum += nx < 0 || ny < 0 || nx >= W || ny >= H ? 1 : bg[ny * W + nx];
        }
      }
      out[o + 3] = Math.round(255 * (1 - sum / 9));
    }
  }

  const tmp = `/tmp/avatar-${name}.raw`;
  writeFileSync(tmp, out);
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${SIZE}x${SIZE}`, '-i', tmp,
    '-pix_fmt', 'rgba', `${OUT}/${name}.png`]);

  console.log(`${name}.png · source ${w}x${h} à (${blob.x0}, ${blob.y0})`);
});

console.log(
  `\nDécommente les require() dans src/components/ui/avatarAssets.ts pour les activer.`,
);
