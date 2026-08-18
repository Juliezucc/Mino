#!/usr/bin/env node
/**
 * Turns a rendered mascot clip on a white background into a transparent,
 * stabilised PNG sequence plus an animated WebP the app can play.
 *
 * Why keying works here rather than fighting us: the background is a flat
 * near-white, so the background is exactly "the near-white pixels you can reach
 * from the border". Enclosed whites — eye highlights, teeth — can't reach it and
 * stay opaque, which is what a naive colour threshold gets wrong. The mask is
 * then feathered over 3x3 so edges land soft instead of stair-stepped.
 *
 * The clip is also stabilised: one common scale and centre for the whole
 * sequence, computed from the visible pixels. Generated clips drift in framing,
 * and drift reads as the mascot sliding around its box.
 *
 * Usage:  node scripts/video-to-sequence.mjs <video> [start] [duration] [options]
 *           --name=celebrate     clip name, becomes <name>.webp + <name>.json
 *           --loop               loop forever (idle clips) instead of playing once
 *           --pingpong           append the frames in reverse, so the loop is
 *                                seamless whatever pose the clip ends on
 *           --background=white   flatten colour, or 'none' to keep alpha
 *
 * Requirements for the source clip:
 *   - flat white (or near-white) background, no gradient
 *   - the character fully in frame at all times, with margin
 *   - locked-off camera
 *   - no watermark inside the character's bounding box (the crop drops corners)
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const VIDEO = process.argv[2];
const START = Number(process.argv[3] ?? 0);
const DUR = Number(process.argv[4] ?? 2);
/**
 * Animated WebP written by ffmpeg does not dispose frames to background, so
 * transparent frames blend onto each other and every past arm position stays
 * on screen. Flattening onto the screen colour sidesteps it entirely: opaque
 * frames replace what came before. The transparent PNG sequence is still
 * written next to it, and stays the source of truth.
 *
 * Pass 'none' to keep alpha, once a muxer that sets disposal is available.
 */
const flag = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const BACKGROUND = flag('background', 'white');
const NAME = flag('name', 'celebrate');
const LOOP = process.argv.includes('--loop');
const PINGPONG = process.argv.includes('--pingpong');

if (!VIDEO) {
  console.error('Usage: node scripts/video-to-sequence.mjs <video> [start] [duration] [--name=x] [--loop]');
  process.exit(1);
}
const FPS = 24;
const OUT = 'assets/mascot/sequence';
const CANVAS = 640;
const FRAMES_DIR = `${OUT}/${NAME}-frames`;

rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

// Read the clip's own dimensions rather than assuming any. `ffmpeg -i` with no
// output always exits non-zero, so the probe lives in a try/catch.
let probe = '';
try {
  execFileSync(ffmpeg, ['-hide_banner', '-i', VIDEO], { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  probe = error.stderr?.toString() ?? '';
}
const match = probe.match(/,\s(\d{2,5})x(\d{2,5})[\s,]/);
if (!match) throw new Error('dimensions de la vidéo illisibles');
const W = Number(match[1]);
const H = Number(match[2]);
console.log(`source ${W}x${H}`);

const raw = execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error',
  '-ss', String(START), '-t', String(DUR), '-i', VIDEO,
  '-vf', `fps=${FPS}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 30 });
const frameSize = W * H * 4;
const count = Math.floor(raw.length / frameSize);
console.log(`${count} images extraites`);

function keyFrame(data) {
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    // Also swallow the soft grey contact shadow, which is desaturated too.
    return min > 198 && max - min < 26;
  };
  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (bg[k] || !isBg(k * 4)) return;
    bg[k] = 1; stack.push(x, y);
  };
  for (let x = 0; x < W; x += 1) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y += 1) { push(0, y); push(W - 1, y); }
  while (stack.length) { const y = stack.pop(); const x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx, ny = y + dy;
        sum += (nx < 0 || ny < 0 || nx >= W || ny >= H) ? 1 : bg[ny * W + nx];
      }
      data[(y * W + x) * 4 + 3] = Math.round(255 * (1 - sum / 9));
    }
  }
  return data;
}

/** Centre of mass + extent of the visible pixels: enough to stabilise a clip. */
function centre(data) {
  let sx = 0, sy = 0, n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 40) {
        sx += x; sy += y; n += 1;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { cx: sx / n, cy: sy / n, w: x1 - x0, h: y1 - y0 };
}

const frames = [];
for (let i = 0; i < count; i += 1) {
  const data = Buffer.from(raw.subarray(i * frameSize, (i + 1) * frameSize));
  keyFrame(data);
  frames.push({ data, ...centre(data) });
}

// One common scale and centre for the whole clip, so the character stays put.
const maxExtent = Math.max(...frames.map((f) => Math.max(f.w, f.h)));
const scale = (CANVAS * 0.92) / maxExtent;
const avgCx = frames.reduce((s, f) => s + f.cx, 0) / frames.length;
const avgCy = frames.reduce((s, f) => s + f.cy, 0) / frames.length;
console.log(`échelle ${scale.toFixed(2)} · centre (${avgCx.toFixed(0)}, ${avgCy.toFixed(0)})`);

frames.forEach((f, i) => {
  const tmp = `/tmp/seq-${i}.raw`;
  writeFileSync(tmp, f.data);
  const sw = Math.round(W * scale);
  const pad = CANVAS;
  const cropX = Math.round(avgCx * scale - CANVAS / 2 + pad);
  const cropY = Math.round(avgCy * scale - CANVAS / 2 + pad);
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', tmp,
    '-vf', `scale=${sw}:-1,format=rgba,pad=iw+${pad * 2}:ih+${pad * 2}:${pad}:${pad}:color=black@0,crop=${CANVAS}:${CANVAS}:${cropX}:${cropY}`,
    '-pix_fmt', 'rgba', `${FRAMES_DIR}/f${String(i).padStart(3, '0')}.png`]);
});

const flatten = BACKGROUND === 'none'
  ? []
  : ['-f', 'lavfi', '-i', `color=${BACKGROUND}:s=${CANVAS}x${CANVAS}`,
     '-filter_complex', '[1][0]overlay=shortest=1,format=rgb24'];

// A generated clip rarely ends where it started, so a plain loop jumps. Playing
// it forward then backward always closes seamlessly.
let total = frames.length;
if (PINGPONG) {
  for (let i = frames.length - 2; i > 0; i -= 1) {
    copyFileSync(
      `${FRAMES_DIR}/f${String(i).padStart(3, '0')}.png`,
      `${FRAMES_DIR}/f${String(total).padStart(3, '0')}.png`,
    );
    total += 1;
  }
}

execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(FPS), '-i', `${FRAMES_DIR}/f%03d.png`,
  ...flatten,
  // Lossless: on flat-shaded 3D artwork it comes out both cleaner AND smaller
  // than lossy, which streaks the character and fringes the alpha.
  // loop 1 = play once; 0 = forever, for idle clips.
  '-vcodec', 'libwebp', '-lossless', '1', '-loop', LOOP ? '0' : '1',
  '-preset', 'picture', '-an', '-vsync', '0', `${OUT}/${NAME}.webp`]);

execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(FPS), '-i', `${FRAMES_DIR}/f%03d.png`,
  '-vf', 'scale=300:-1,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse',
  '-loop', '0', `${OUT}/${NAME}-preview.gif`]);

// The app needs the duration to know when a one-shot clip is over and it should
// hand back to the still poses, so it ships next to the clip rather than being
// hardcoded somewhere it can drift.
writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify({
  frames: total,
  fps: FPS,
  durationMs: Math.round((total / FPS) * 1000),
  loop: LOOP,
}, null, 2) + '\n');

console.log(`${NAME}.webp · ${total} images · ${Math.round((total / FPS) * 1000)} ms` +
  `${LOOP ? ' · en boucle' : ''}${PINGPONG ? ' · aller-retour' : ''}`);
