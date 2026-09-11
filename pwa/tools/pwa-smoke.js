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
  'index.html', 'manifest.webmanifest', 'pwa-bootstrap.js', 'pwa-sensor-parity.js', 'pwa-auto-dim.js', 'sw.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'PRIVACY_POLICY.txt', 'yaAGC.wasm', 'Comanche055.bin'
]) {
  if (!exists(rel)) fail('missing ' + rel);
}
if (exists('analytics.js')) fail('legacy custom analytics client must not be shipped');

const index = text('index.html');
for (const marker of [
  'rel="manifest" href="manifest.webmanifest"',
  'apple-mobile-web-app-capable',
  'apple-touch-icon',
  '<script src="pwa-sensor-parity.js"></script>',
  '<script src="pwa-auto-dim.js"></script>',
  '<script src="pwa-bootstrap.js"></script>'
]) {
  if (!index.includes(marker)) fail('index.html missing ' + marker);
}
if (index.indexOf('pwa-sensor-parity.js') > index.indexOf('pwa-auto-dim.js') || index.indexOf('pwa-auto-dim.js') > index.indexOf('pwa-bootstrap.js')) {
  fail('PWA parity scripts must initialize before generic PWA bootstrap');
}
if (index.includes('<script src="analytics.js"></script>') || index.includes('/v1/event')) {
  fail('index.html still references legacy custom analytics');
}

const webAnalyticsToken = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN || '';
const beaconUrl = 'https://static.cloudflareinsights.com/beacon.min.js';
if (webAnalyticsToken) {
  if (!index.includes(beaconUrl)) fail('production build missing Cloudflare Web Analytics beacon');
  if (!index.includes(`"token":"${webAnalyticsToken}"`)) fail('Cloudflare Web Analytics beacon token mismatch');
  if (!index.includes('data-cf-beacon=')) fail('Cloudflare Web Analytics data-cf-beacon attribute missing');
} else if (index.includes(beaconUrl) || index.includes('data-cf-beacon=')) {
  fail('analytics-free build unexpectedly contains Cloudflare Web Analytics beacon');
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

const parity = text('pwa-sensor-parity.js');
for (const marker of [
  "navigator.wakeLock.request('screen')",
  "window.addEventListener('devicemotion'",
  "window.addEventListener('deviceorientationabsolute'",
  'DeviceMotionEvent',
  'DeviceOrientationEvent',
  'nativePhoneLinearAcceleration',
  'nativePipaSensorStatus',
  'nativeMagneticQuaternion',
  'nativeMagneticSensorStatus',
  'accelerationIncludingGravity',
  "'web-device-motion'",
  "'web-absolute-orientation'"
]) {
  if (!parity.includes(marker)) fail('PWA sensor parity bridge missing ' + marker);
}
for (const marker of ["'pointerup'", "'touchend'", "'click'"]) {
  if (!parity.includes(marker)) fail('PWA sensor permission bridge missing completed gesture ' + marker);
}
if (parity.includes("'pointerdown'")) fail('PWA parity permission request must use a completed gesture');
try { new Function(parity); }
catch (error) { fail('pwa-sensor-parity.js syntax error: ' + error.message); }

const autoDim = text('pwa-auto-dim.js');
for (const marker of [
  'AmbientLightSensor',
  'navigator.geolocation.getCurrentPosition',
  "const LAT_KEY = 'solarLat'",
  "const LON_KEY = 'solarLon'",
  'SOLAR_FADE_HALF_MS = 30 * 60 * 1000',
  'luxToFactor',
  "source:'ambient'",
  "source:'solar'",
  "panel.style.setProperty('filter'",
  'AUTO DIM'
]) {
  if (!autoDim.includes(marker)) fail('PWA auto dim layer missing ' + marker);
}
try { new Function(autoDim); }
catch (error) { fail('pwa-auto-dim.js syntax error: ' + error.message); }

const privacy = text('PRIVACY_POLICY.txt');
for (const marker of ['CLOUDFLARE WEB ANALYTICS', 'page views', 'custom installation identifier', 'Ambient light sensor']) {
  if (!privacy.includes(marker)) fail('PWA privacy policy missing ' + marker);
}

const sw = text('sw.js');
if (sw.includes('__CACHE_VERSION__')) fail('service-worker cache version was not stamped');
if (sw.includes("'./analytics.js'")) fail('service worker still pre-caches legacy analytics.js');
for (const required of ['yaAGC.wasm', 'Comanche055.bin', 'manifest.webmanifest', 'pwa-bootstrap.js', 'pwa-sensor-parity.js', 'pwa-auto-dim.js']) {
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
console.log('Browser wake lock / PIPA motion / absolute-orientation parity: PASS');
console.log('Ambient-light / solar-location auto dimming: PASS');
console.log('Cloudflare Web Analytics: ' + (webAnalyticsToken ? 'PASS' : 'disabled for this build'));
