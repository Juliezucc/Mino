#!/usr/bin/env node
/**
 * Packs the Expo web export into ONE self-contained HTML file, so the app can
 * be opened from a link with nothing to install — useful for showing the
 * product on a phone before there is a build.
 *
 * The export references every asset as a plain string module
 * (`m.exports="/assets/..."`), so inlining is a straight substitution of those
 * paths by data URIs. The mascot renders are 1024px PNGs meant for a retina
 * phone screen; at preview size 512px is indistinguishable and divides the
 * payload by three, which is what keeps the page under the hosting limit.
 *
 * Usage:  npx expo export -p web --output-dir dist
 *         node scripts/build-web-preview.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

const DIST = 'dist';
const OUT = 'dist/mino-preview.html';
const TMP = '/tmp/mino-preview';
/** Mascot renders are shipped at 1024px; halve them for the preview. */
const MASCOT_SIZE = 512;

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

/** Only these fonts are actually loaded by app/_layout.tsx. */
const USED_FONTS = [
  'Nunito_400Regular',
  'Nunito_600SemiBold',
  'Nunito_700Bold',
  'Nunito_800ExtraBold',
  'Nunito_900Black',
];

const bundleDir = join(DIST, '_expo/static/js/web');
const bundleName = readdirSync(bundleDir).find((f) => f.endsWith('.js'));
if (!bundleName) throw new Error('bundle introuvable — lancer `npx expo export -p web` d’abord');
let bundle = readFileSync(join(bundleDir, bundleName), 'utf8');
console.log(`bundle ${bundleName} · ${(bundle.length / 1e6).toFixed(1)} Mo`);

mkdirSync(TMP, { recursive: true });

/** Halve a mascot render, keeping its alpha. */
function shrink(source) {
  const out = join(TMP, source.replace(/[^a-zA-Z0-9.]/g, '_'));
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', source,
    '-vf', `scale=${MASCOT_SIZE}:-1`, '-pix_fmt', 'rgba', out]);
  return out;
}

const refs = [...new Set(bundle.match(/\/assets\/[a-zA-Z0-9_@./-]+\.[a-z0-9]{2,5}/g) ?? [])];
let inlined = 0;
let skipped = 0;
let bytes = 0;

for (const ref of refs) {
  // The export serves assets under /assets/, and lays them out on disk the
  // same way, so the URL path is the path inside dist.
  const file = join(DIST, ref);
  if (!existsSync(file) || !statSync(file).isFile()) { skipped += 1; continue; }

  // Unused font weights are shipped by the package but never loaded — carrying
  // them would be megabytes of dead payload.
  if (ref.endsWith('.ttf') && !USED_FONTS.some((f) => ref.includes(f))) { skipped += 1; continue; }

  const ext = extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) { skipped += 1; continue; }

  const source = ref.includes('/mascot/') && ext === '.png' ? shrink(file) : file;
  const uri = `data:${mime};base64,${readFileSync(source).toString('base64')}`;
  bundle = bundle.split(`"${ref}"`).join(JSON.stringify(uri));
  inlined += 1;
  bytes += uri.length;
}
console.log(`${inlined} fichiers intégrés (${(bytes / 1e6).toFixed(1)} Mo), ${skipped} ignorés`);

// A literal </script> inside the bundle would close the tag early.
const safe = bundle.split('</script').join('<\\/script');

// expo-router matches routes against the real URL path. Hosted anywhere other
// than the domain root — which a preview link never is — every route misses and
// the app opens on "Unmatched Route". Rewriting the path to "/" before the
// bundle boots puts the router back on the index route; it is same-origin, so
// it is allowed, and in-app navigation carries on normally from there.
const html = `<title>Mino</title>
<style>
  html, body { height: 100%; margin: 0; background: #F2F6FF; }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>try { history.replaceState(null, '', '/'); } catch (e) {}</script>
<script>${safe}</script>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`${OUT} · ${(html.length / 1e6).toFixed(1)} Mo`);
