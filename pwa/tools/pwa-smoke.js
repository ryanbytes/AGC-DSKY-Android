#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const site = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const fail = message => { console.error('PWA SMOKE FAIL: ' + message); process.exit(1); };
const read = rel => fs.readFileSync(path.join(site, rel));
const text = rel => read(rel).toString('utf8');
const exists = rel => fs.existsSync(path.join(site, rel));

for (const rel of [
  'index.html', 'manifest.webmanifest', 'pwa-bootstrap.js', 'analytics.js', 'sw.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'PRIVACY_POLICY.txt', 'yaAGC.wasm', 'Comanche055.bin'
]) {
  if (!exists(rel)) fail('missing ' + rel);
}

const index = text('index.html');
for (const marker of [
  'rel="manifest" href="manifest.webmanifest"',
  'apple-mobile-web-app-capable',
  'apple-touch-icon',
  '<script src="pwa-bootstrap.js"></script>',
  '<script src="analytics.js"></script>'
]) {
  if (!index.includes(marker)) fail('index.html missing ' + marker);
}

let manifest;
try { manifest = JSON.parse(text('manifest.webmanifest')); }
catch (error) { fail('manifest is not valid JSON: ' + error.message); }
if (manifest.display !== 'fullscreen') fail('manifest display must be fullscreen');
if (!Array.isArray(manifest.display_override) || manifest.display_override[0] !== 'fullscreen') {
  fail('manifest must prefer fullscreen in display_override');
}
if (manifest.start_url !== './' || manifest.scope !== './') fail('manifest must use relative project-page start_url/scope');
const sizes = new Set((manifest.icons || []).map(icon => icon.sizes));
if (!sizes.has('192x192') || !sizes.has('512x512')) fail('manifest must include 192x192 and 512x512 icons');

function checkPng(rel, expected) {
  const data = read(rel);
  if (data.length < 24 || data.toString('hex', 0, 8) !== '89504e470d0a1a0a') fail(rel + ' is not a PNG');
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== expected || height !== expected) fail(`${rel} is ${width}x${height}; expected ${expected}x${expected}`);
}
checkPng('icons/apple-touch-icon.png', 180);
checkPng('icons/icon-192.png', 192);
checkPng('icons/icon-512.png', 512);

const wasm = read('yaAGC.wasm');
if (wasm.length !== 132617) fail('yaAGC.wasm size mismatch: ' + wasm.length);
if (wasm.toString('hex', 0, 4) !== '0061736d') fail('yaAGC.wasm magic mismatch');
const rope = read('Comanche055.bin');
if (rope.length !== 73728) fail('Comanche055.bin size mismatch: ' + rope.length);

const bootstrap = text('pwa-bootstrap.js');
for (const marker of ['requestFullscreen', '/Android/i', "'pointerup'", "'touchend'", "'click'"]) {
  if (!bootstrap.includes(marker)) fail('PWA bootstrap missing Android fullscreen fallback marker ' + marker);
}
if (bootstrap.includes("navigationUI: 'hide'")) fail('PWA bootstrap should use plain requestFullscreen for Brave compatibility');
if (bootstrap.includes("'pointerdown'") || bootstrap.includes("'touchstart'")) {
  fail('PWA bootstrap must request fullscreen after completed touch activation, not pointerdown/touchstart');
}
try { new Function(bootstrap); }
catch (error) { fail('pwa-bootstrap.js syntax error: ' + error.message); }

const analytics = text('analytics.js');
if (analytics.includes('__ANALYTICS_ENDPOINT_JSON__') || analytics.includes('__APP_VERSION_JSON__')) {
  fail('analytics build tokens were not replaced');
}
try { new Function(analytics); }
catch (error) { fail('analytics.js syntax error: ' + error.message); }
if (!analytics.includes("navigator.doNotTrack === '1'")) fail('analytics client must honor Do Not Track');
if (!analytics.includes("credentials: 'omit'")) fail('analytics client must omit credentials');

const privacy = text('PRIVACY_POLICY.txt');
for (const marker of ['ANONYMOUS USAGE ANALYTICS', 'HMAC-hashes', '?telemetry=off']) {
  if (!privacy.includes(marker)) fail('PWA privacy policy missing ' + marker);
}

const sw = text('sw.js');
if (sw.includes('__CACHE_VERSION__')) fail('service-worker cache version was not stamped');
for (const required of ['yaAGC.wasm', 'Comanche055.bin', 'manifest.webmanifest', 'pwa-bootstrap.js', 'analytics.js']) {
  if (!sw.includes(`'./${required}'`)) fail('service worker does not pre-cache ' + required);
}

const refs = [];
for (const regex of [/<script[^>]+src="([^"]+)"/g, /<link[^>]+href="([^"]+)"/g]) {
  for (const match of index.matchAll(regex)) {
    const ref = match[1];
    if (!/^(?:https?:|data:|blob:|#)/i.test(ref)) refs.push(ref.replace(/^\.\//, ''));
  }
}
for (const rel of new Set(refs)) {
  if (!exists(rel)) fail('index references missing local asset ' + rel);
  if (rel !== 'sw.js' && !sw.includes(`'./${rel}'`)) fail('service worker does not pre-cache index dependency ' + rel);
}

console.log('PWA smoke: PASS');
console.log('Site: ' + site);
console.log('yaAGC.wasm: ' + wasm.length + ' bytes');
console.log('Comanche055.bin: ' + rope.length + ' bytes');
console.log('Android browser fullscreen touch fallback: PASS');
console.log('Analytics client: PASS');
