#!/usr/bin/env node
/**
 * Builds the first frame to feed an image-to-video model.
 *
 * An image-to-video model inherits the framing of its seed: give it a character
 * that already fills the frame and it has nowhere to jump to, so it gets cropped
 * on the way up. This places the character small and low with a lot of empty
 * space above its head, measured from the character itself rather than from the
 * image bounds so the result is the same whatever pose is used.
 *
 * Usage:  node scripts/make-video-seed.mjs [expression] [width] [height]
 *         default: happy, 1080x1920 (9:16)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const expression = process.argv[2] ?? 'happy';
const OUT_W = Number(process.argv[3] ?? 1080);
const OUT_H = Number(process.argv[4] ?? 1920);

/** Character height as a share of the frame. The rest is room to move. */
const CHARACTER_HEIGHT = 0.34;
/** Where the feet sit vertically — low, so the headroom is all above. */
const FEET_AT = 0.8;

const SOURCE = `assets/mascot/${expression}.png`;
const OUT_DIR = 'docs/mascot-tests/seeds';
const ANALYSIS = 256;

const raw = execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', SOURCE,
  '-vf', `scale=${ANALYSIS}:-1`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
  { maxBuffer: 1 << 28 });
const h = raw.length / (ANALYSIS * 4);

let x0 = ANALYSIS;
let x1 = 0;
let y0 = h;
let y1 = 0;
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < ANALYSIS; x += 1) {
    if (raw[(y * ANALYSIS + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
}

// Everything below is in units of the source image, then scaled to the frame.
const boxH = (y1 - y0) / h;
const boxCx = (x0 + x1) / 2 / ANALYSIS;
const boxBottom = y1 / h;

const scaledH = Math.round((CHARACTER_HEIGHT / boxH) * OUT_H);
const scaledW = Math.round(scaledH * (ANALYSIS / h));
const x = Math.round(OUT_W / 2 - boxCx * scaledW);
const y = Math.round(FEET_AT * OUT_H - boxBottom * scaledH);

mkdirSync(OUT_DIR, { recursive: true });
const out = `${OUT_DIR}/seed-${expression}-${OUT_W}x${OUT_H}.png`;

execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', `color=white:s=${OUT_W}x${OUT_H}`,
  '-i', SOURCE,
  '-filter_complex',
  `[1:v]scale=${scaledW}:${scaledH}[c];[0:v][c]overlay=${x}:${y}:format=auto,format=rgb24`,
  '-frames:v', '1', out]);

console.log(`${out}  ·  personnage ${Math.round(CHARACTER_HEIGHT * 100)}% de la hauteur, ` +
  `${Math.round((y / OUT_H) * 100)}% de vide au-dessus`);
