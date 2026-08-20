#!/usr/bin/env node
/**
 * Builds the icons and the splash from the mascot artwork.
 *
 * Generated rather than exported by hand, for the same reason the guide's
 * screenshots are: five files that must agree with each other and with the
 * brand drift the moment one of them is redone by hand.
 *
 * Usage:  node scripts/make-launch-assets.mjs
 *
 * Produces, in assets/:
 *   icon.png           1024²  full-bleed, for iOS and the stores
 *   adaptive-icon.png  1024²  Android foreground, inside the 66% safe circle
 *   splash-icon.png     512²  transparent, on the light background
 *   favicon.png          64²  the web tab
 *   notification-icon.png 96² white silhouette, for the Android status bar
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const SOURCE = 'assets/mascot/happy.png';
const OUT = 'assets/';

/**
 * From the brand board — and one decision worth stating.
 *
 * The icon background is light, not blue. Mino is a blue character; on the
 * brand's blue gradient he came out as a blue blob the moment the icon was
 * drawn at 60px on a home screen. Light also matches the identity, which asks
 * for a lot of white.
 */
const ICON_TOP = 'FFFFFF';
const ICON_BOTTOM = 'DCEBFF';
const SURFACE = 'F2F6FF';

mkdirSync(OUT, { recursive: true });

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

/**
 * The app icon: the mascot on a soft brand gradient.
 *
 * Android masks this to a circle and iOS to a rounded square, so the character
 * sits at 62% of the canvas — small enough that no crop ever takes an ear off,
 * large enough to still read on a home screen full of other icons.
 */
function icon(size, scale, background, file) {
  const inner = Math.round(size * scale);
  run([
    '-f', 'lavfi', '-i', `color=c=0x${ICON_TOP}:s=${size}x${size}`,
    '-f', 'lavfi', '-i', `color=c=0x${ICON_BOTTOM}:s=${size}x${size}`,
    '-i', SOURCE,
    '-filter_complex',
    [
      // A diagonal gradient, made by fading one flat colour over the other.
      `[0][1]blend=all_expr='A*(1-(X/W*0.5+Y/H*0.5))+B*(X/W*0.5+Y/H*0.5)'[bg]`,
      `[2]scale=${inner}:-1[m]`,
      // Nudged up a touch: the mascot's legs read as padding otherwise.
      `[bg][m]overlay=(W-w)/2:(H-h)/2-${Math.round(size * 0.02)}`,
      background === 'none' ? 'format=rgba' : 'format=rgb24',
    ].join(','),
    // `color=` is an endless source: without this, ffmpeg keeps producing
    // frames and refuses to write them all to one filename.
    '-frames:v', '1',
    `${OUT}${file}`,
  ]);
  console.log(`${file} · ${size}²`);
}

/** Transparent variants, laid on whatever background the platform paints. */
function bare(size, scale, file) {
  const inner = Math.round(size * scale);
  run([
    '-f', 'lavfi', '-i', `color=c=0x${SURFACE}@0.0:s=${size}x${size}:r=1`,
    '-i', SOURCE,
    '-filter_complex', `[1]scale=${inner}:-1[m];[0][m]overlay=(W-w)/2:(H-h)/2,format=rgba`,
    '-frames:v', '1', `${OUT}${file}`,
  ]);
  console.log(`${file} · ${size}²`);
}

/**
 * Android draws the status-bar icon as a silhouette: every non-transparent
 * pixel becomes white whatever its colour. So it is generated as a flat white
 * shape from the alpha channel — anything else turns into a white blob.
 */
function silhouette(size, file) {
  run([
    '-i', SOURCE,
    '-filter_complex',
    [
      `scale=${size}:-1`,
      'format=rgba',
      // Keep the alpha, discard the colours.
      "geq=r='255':g='255':b='255':a='alpha(X,Y)'",
    ].join(','),
    '-frames:v', '1',
    `${OUT}${file}`,
  ]);
  console.log(`${file} · ${size}²`);
}

icon(1024, 0.62, 'solid', 'icon.png');
// Android crops to a circle of ~66%: the character has to fit well inside it.
icon(1024, 0.46, 'solid', 'adaptive-icon.png');
bare(512, 0.86, 'splash-icon.png');
bare(64, 0.92, 'favicon.png');
silhouette(96, 'notification-icon.png');

writeFileSync(
  `${OUT}README.md`,
  `# Visuels de lancement\n\n` +
    `Générés par \`node scripts/make-launch-assets.mjs\` à partir de \`${SOURCE}\`.\n` +
    `Ne les retouchez pas à la main : relancez le script après un changement de mascotte.\n`,
);
console.log('\nassets/README.md');
