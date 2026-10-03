#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const vm = require('vm');

const site = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const fail = message => { console.error('PWA SMOKE FAIL: ' + message); process.exit(1); };
const read = rel => fs.readFileSync(path.join(site, rel));
const text = rel => read(rel).toString('utf8');
const exists = rel => fs.existsSync(path.join(site, rel));

for (const rel of [
  'index.html', 'manifest.webmanifest', 'pwa-bootstrap.js', 'pwa-sensor-parity.js', 'pwa-auto-dim.js', 'pwa-print-bridge.js', 'pwa-print.css', 'pwa-print-android.css', 'pwa-print-window.js', 'sw.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png',
  'PRIVACY_POLICY.txt', 'yaAGC.wasm', 'Comanche055.bin', '.agcdsky-pwa-generated'
]) {
  if (!exists(rel)) fail('missing ' + rel);
}
if (text('.agcdsky-pwa-generated').trim() !== 'AGC DSKY generated PWA output v1') {
  fail('site output is missing its builder ownership marker');
}

const index = text('index.html');
const csp = index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?\s*>/i);
if (!csp) fail('index.html must enforce Content-Security-Policy');
const cspParts = csp[1].split(';').map(value => value.trim());
const cspDirectives = new Map(cspParts.map(value => {
  const [name, ...values] = value.split(/\s+/);
  return [name, values];
}));
const strictDirectives = {
  'default-src': ["'none'"], 'base-uri': ["'none'"], 'form-action': ["'none'"],
  'object-src': ["'none'"], 'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'"], 'img-src': ["'self'"], 'font-src': ["'self'"],
  'media-src': ["'self'"], 'worker-src': ["'self'"], 'manifest-src': ["'self'"]
};
if (cspDirectives.size !== cspParts.length) fail('CSP contains duplicate directives');
for (const [name, values] of Object.entries(strictDirectives)) {
  if (JSON.stringify(cspDirectives.get(name)) !== JSON.stringify(values)) fail('CSP directive mismatch: ' + name);
}
if (cspDirectives.size !== Object.keys(strictDirectives).length + 1) fail('CSP contains missing or unexpected directives');
if (csp[1].split(/[;\s]+/).some(token => /^'(?:unsafe-inline|unsafe-eval)'$/i.test(token))) fail('CSP allows ordinary unsafe-inline or unsafe-eval');
const connect = cspDirectives.get('connect-src');
if (JSON.stringify(connect) !== JSON.stringify(["'self'"])) fail('CSP connect-src must permit same-origin requests only');
if (/<style\b|\sstyle\s*=|<script\s*>/i.test(index)) fail('PWA page must not contain inline CSS or JavaScript');
for (const marker of [
  'rel="manifest" href="manifest.webmanifest"',
  'apple-mobile-web-app-capable',
  'apple-touch-icon',
  '<script src="pwa-sensor-parity.js"></script>',
  '<script src="pwa-auto-dim.js"></script>',
  '<script src="pwa-print-bridge.js"></script>',
  '<script src="pwa-bootstrap.js"></script>'
]) {
  if (!index.includes(marker)) fail('index.html missing ' + marker);
}
if (exists('analytics.js') || /analytics\.js|AGCDSKYAnalytics|AGC_ANALYTICS_ENDPOINT/i.test(index)) {
  fail('PWA output must not include analytics assets, globals, or endpoint configuration');
}
if (index.indexOf('pwa-sensor-parity.js') > index.indexOf('pwa-auto-dim.js') || index.indexOf('pwa-auto-dim.js') > index.indexOf('pwa-bootstrap.js')) {
  fail('PWA parity scripts must initialize before generic PWA bootstrap');
}

let manifest;
try { manifest = JSON.parse(text('manifest.webmanifest')); }
catch (error) { fail('manifest is not valid JSON: ' + error.message); }
if (manifest.display !== 'fullscreen') fail('manifest display must be fullscreen');
if (!Array.isArray(manifest.display_override) || manifest.display_override[0] !== 'fullscreen') {
  fail('manifest must prefer fullscreen in display_override');
}
if (manifest.start_url !== './' || manifest.scope !== './') fail('manifest must use relative project-page start_url/scope');
const icons = manifest.icons || [];
const purposes = icon => new Set(String(icon.purpose || 'any').split(/\s+/).filter(Boolean));
if (!icons.some(icon => icon.sizes === '192x192' && purposes(icon).has('any'))
    || !icons.some(icon => icon.sizes === '512x512' && purposes(icon).has('any'))) {
  fail('manifest must include any-purpose 192x192 and 512x512 icons');
}
if (!icons.some(icon => icon.src === 'icons/icon-512-maskable.png' && icon.sizes === '512x512' && purposes(icon).has('maskable'))
    || icons.some(icon => purposes(icon).has('maskable') && icon.src !== 'icons/icon-512-maskable.png')) {
  fail('manifest must use the dedicated safe-zone icon for maskable purpose');
}

const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < table.length; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrc32(type, payload) {
  let crc = 0xffffffff;
  for (const byte of type) crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  for (const byte of payload) crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(data, expected) {
  if (data.length < 33 || data.length > 16 * 1024 * 1024 || data.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error('invalid PNG signature or file length');
  }
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, compression = 0, filterMethod = 0, interlace = 0;
  let sawIhdr = false, sawPlte = false, sawIdat = false, idatClosed = false, sawIend = false;
  const idat = [];
  while (offset < data.length) {
    if (offset + 12 > data.length) throw new Error('truncated PNG chunk header');
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > data.length) throw new Error(`truncated ${type.toString('ascii')} chunk`);
    const payload = data.subarray(offset + 8, offset + 8 + length);
    if (data.readUInt32BE(offset + 8 + length) !== pngCrc32(type, payload)) {
      throw new Error(`${type.toString('ascii')} CRC mismatch`);
    }
    const name = type.toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(name)) throw new Error('invalid PNG chunk type');
    if (!sawIhdr && name !== 'IHDR') throw new Error('IHDR is not the first chunk');
    if (name === 'IHDR') {
      if (sawIhdr || length !== 13) throw new Error('invalid IHDR');
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      bitDepth = payload[8]; colorType = payload[9]; compression = payload[10];
      filterMethod = payload[11]; interlace = payload[12]; sawIhdr = true;
      if (width !== expected || height !== expected) throw new Error(`${width}x${height}; expected ${expected}x${expected}`);
    } else if (name === 'PLTE') {
      if (!length || length > 768 || length % 3) throw new Error('invalid PLTE');
      sawPlte = true;
    } else if (name === 'IDAT') {
      if (idatClosed) throw new Error('nonconsecutive IDAT chunks');
      sawIdat = true; idat.push(payload);
    } else if (name === 'IEND') {
      if (!sawIdat || length !== 0) throw new Error('invalid IEND');
      sawIend = true;
      if (end !== data.length) throw new Error('trailing data after IEND');
      offset = end;
      break;
    } else if (sawIdat) {
      idatClosed = true;
    }
    offset = end;
  }
  if (!sawIhdr || !sawIdat || !sawIend) throw new Error('missing required PNG chunk');
  const channels = ({0: 1, 2: 3, 3: 1, 4: 2, 6: 4})[colorType];
  const validDepths = ({0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16]})[colorType];
  if (!channels || !validDepths.includes(bitDepth) || (colorType === 3 && !sawPlte)) throw new Error('unsupported or invalid PNG color format');
  if (compression !== 0 || filterMethod !== 0 || (interlace !== 0 && interlace !== 1)) {
    throw new Error('unsupported PNG compression, filter, or interlace method');
  }
  const passes = interlace === 0
    ? [[0, 0, 1, 1]]
    : [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
  const compressed = Buffer.concat(idat);
  const inflated = zlib.inflateSync(compressed, {info: true, maxOutputLength: width * height * channels * 2 + height * 7 + 1});
  if (inflated.engine.bytesWritten !== compressed.length) throw new Error('trailing data in compressed image');
  const pixels = inflated.buffer;
  let cursor = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const passWidth = width <= x0 ? 0 : Math.ceil((width - x0) / dx);
    const passHeight = height <= y0 ? 0 : Math.ceil((height - y0) / dy);
    if (!passWidth || !passHeight) continue;
    const rowBytes = Math.ceil(passWidth * channels * bitDepth / 8);
    for (let row = 0; row < passHeight; row++) {
      if (cursor + 1 + rowBytes > pixels.length) throw new Error('truncated decoded image rows');
      if (pixels[cursor] > 4) throw new Error('invalid PNG row filter');
      cursor += 1 + rowBytes;
    }
  }
  if (cursor !== pixels.length) throw new Error('decoded image size does not match its dimensions');
}

function checkPng(rel, expected) {
  try { validatePng(read(rel), expected); }
  catch (error) { fail(`${rel} is not a valid ${expected}x${expected} PNG: ${error.message}`); }
}
checkPng('icons/apple-touch-icon.png', 180);
checkPng('icons/icon-192.png', 192);
checkPng('icons/icon-512.png', 512);
checkPng('icons/icon-512-maskable.png', 512);

const wasm = read('yaAGC.wasm');
if (wasm.length !== 27270) fail('yaAGC.wasm size mismatch: ' + wasm.length);
const wasmBlob = crypto.createHash('sha1').update(Buffer.from('blob ' + wasm.length + '\0')).update(wasm).digest('hex');
if (wasmBlob !== '04a24dd1df4a81738e138b3e9f048d2b10498439') fail('yaAGC.wasm Git blob mismatch: ' + wasmBlob);
if (wasm.toString('hex', 0, 4) !== '0061736d') fail('yaAGC.wasm magic mismatch');
const rope = read('Comanche055.bin');
if (rope.length !== 73728) fail('Comanche055.bin size mismatch: ' + rope.length);

const bootstrap = text('pwa-bootstrap.js');
for (const marker of [
  'requestFullscreen',
  '/Android/i',
  "'click'",
  'scheduleAndroidFullscreen',
  'fullscreenQueued = true',
  'queueMicrotask(() => {',
  "document.addEventListener('click', scheduleAndroidFullscreen, {capture: true, passive: true})"
]) {
  if (!bootstrap.includes(marker)) fail('PWA bootstrap missing Android fullscreen fallback marker ' + marker);
}
if (bootstrap.includes("navigationUI: 'hide'")) fail('PWA bootstrap should use plain requestFullscreen for Brave compatibility');
for (const forbidden of ["'pointerdown'", "'touchstart'", "'pointerup'", "'touchend'"]) {
  if (bootstrap.includes(forbidden)) fail('PWA bootstrap fullscreen fallback must not mutate viewport during pointer/touch targeting: ' + forbidden);
}
if (bootstrap.includes("document.addEventListener('click', tryAndroidFullscreen")) {
  fail('PWA bootstrap must defer fullscreen until click dispatch completes');
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

const checklistJs = text('cheatsheet.js');
const checklistCss = text('cheatsheet.css');
const pwaPrint = text('pwa-print-bridge.js');
const pwaPrintCss = text('pwa-print.css');
const pwaPrintAndroidCss = text('pwa-print-android.css');
const sharedStyle = text('style.css');
for (const marker of [
  'window.PrintBridge = bridge',
  "window.open('', '_blank')",
  "clone.querySelectorAll('[data-cheat-check]')",
  "box.setAttribute('checked', '')",
  'PRINT / SAVE PDF',
  'ANDROID · 4 COMPACT MODEL PAGES PER LETTER SHEET',
  'androidSheetMarkup',
  'pwa-model-sheet',
  'pwa-model-slot',
  "new URL('pwa-print.css', location.href)",
  "new URL('pwa-print-window.js', location.href)",
  "new URL('cheatsheet.css', location.href)"
]) {
  if (!pwaPrint.includes(marker)) fail('PWA checklist print bridge missing ' + marker);
}
for (const marker of ['grid-template-columns:repeat(2,3.90in)!important', 'grid-template-rows:repeat(2,5.20in)!important', 'width:5.10in!important', 'height:3.80in!important', 'transform:translate(-50%,-50%) rotate(90deg)!important']) {
  if (!pwaPrintCss.includes(marker)) fail('PWA checklist print stylesheet missing ' + marker);
}
if (!pwaPrintAndroidCss.includes('@page{size:8.5in 11in;margin:.20in}')) fail('Android print stylesheet missing explicit portrait Letter page size');
if (/<style\b|<script\s*>/i.test(pwaPrint)) fail('PWA print bridge must not generate inline CSS or JavaScript');
try { new Function(pwaPrint); }
catch (error) { fail('pwa-print-bridge.js syntax error: ' + error.message); }
for (const marker of [
  'id="cheat-print"',
  "PrintBridge.printChecklist()",
  "typeof window.print==='function'"
]) {
  if (!checklistJs.includes(marker)) fail('shared checklist print behavior missing ' + marker);
}
if (!checklistCss.includes('size:Letter landscape')) fail('checklist print page must use US Letter landscape');
if (!checklistCss.includes('@media print')) fail('checklist print stylesheet missing');
if (!checklistCss.includes('grid-template-columns:repeat(2,5.10in)!important')) fail('checklist print must impose two compact cards across');
if (!checklistCss.includes('grid-auto-rows:3.80in!important')) fail('checklist compact card height missing');
if (!checklistCss.includes('.cheat-pane:nth-child(4n+1):not(:first-child)')) fail('checklist print must page-break after four cards');
if (!checklistCss.includes('gap:.15in!important')) fail('checklist compact cutting gutter missing');
if (!checklistCss.includes('PAGE 1 / 5 · CUT ON DASHED GUIDE') || !checklistCss.includes('PAGE 5 / 5 · CUT ON DASHED GUIDE')) fail('checklist print page-numbered cut footers missing');
if (!checklistCss.includes('outline:.4pt dashed #888!important')) fail('checklist print cut guides missing');
if (sharedStyle.includes('.el-seg.off')) fail('unlit numeric EL segments must not have a visible style');
if (sharedStyle.includes('.comp-el:not(.on){display:none}')) fail('COMP ACTY printed legend must remain visible while de-energized');
if (!sharedStyle.includes('.el-comp-bg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;')) fail('de-energized COMP ACTY phosphor must be optically absent');
if (!sharedStyle.includes('.comp-el.on .el-comp-bg{\n  display:block;\n  fill:var(--el);')) fail('energized COMP ACTY phosphor rule missing');
if (!sharedStyle.includes('.el-seg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;')) fail('de-energized numeric/sign EL must be optically absent');
if (!sharedStyle.includes('.el-seg.on{\n  display:inline;\n  fill:var(--el);')) fail('energized numeric/sign EL rule missing');

const privacy = text('PRIVACY_POLICY.txt');
for (const marker of ['does not include analytics or send usage events', 'Ambient light sensor']) {
  if (!privacy.includes(marker)) fail('PWA privacy policy missing ' + marker);
}

const sw = text('sw.js');
if (sw.includes('__CACHE_VERSION__')) fail('service-worker cache version was not stamped');
if (sw.includes("'./analytics.js'")) fail('service worker must not cache an analytics client');
if (sw.includes("'./.self-contained-assets-note'")) fail('service-worker must not pre-cache the repository-only hidden assets marker');
if (sw.includes('client.navigate(')) fail('service-worker activation must not forcibly navigate open DSKY pages');
if (!sw.includes('.then(() => self.clients.claim())')) fail('service worker must still claim clients after activation');
for (const required of ['yaAGC.wasm', 'Comanche055.bin', 'manifest.webmanifest', 'pwa-bootstrap.js', 'pwa-sensor-parity.js', 'pwa-auto-dim.js', 'pwa-print-bridge.js', 'pwa-print.css', 'pwa-print-android.css', 'pwa-print-window.js']) {
  if (!sw.includes(`'./${required}'`)) fail('service worker does not pre-cache ' + required);
}
if (!sw.includes('event.waitUntil(cacheWrite)')) fail('service-worker cache writes must extend the fetch-event lifetime');
if (!sw.includes('.catch(() => {})')) fail('service-worker cache-write failures must not become unhandled rejections');

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

(async () => {
  const listeners = Object.create(null), waitUntilPromises = [], putErrors = [];
  let rejectCacheWrite = false;
  const self = {
    location: {origin: 'https://example.test'},
    addEventListener(name, listener) { listeners[name] = listener; },
    skipWaiting() {},
    clients: {claim: () => Promise.resolve()}
  };
  const response = {ok: true, status: 200, clone() { return {cachedCopy: true}; }};
  const installAssetUrls = [];
  const cache = {
    addAll(requests) {
      const urls = Array.from(requests, request => new URL(request, self.location.origin).href);
      if (new Set(urls).size !== urls.length) return Promise.reject(new Error('duplicate precache URLs'));
      for (const url of urls) {
        const pathname = new URL(url).pathname.replace(/^\/+/, '') || 'index.html';
        let relativePath;
        try { relativePath = decodeURIComponent(pathname); }
        catch (_) { return Promise.reject(new Error('invalid precache path ' + pathname)); }
        if (!exists(relativePath)) return Promise.reject(new Error('HTTP 404 for precache asset ' + relativePath));
      }
      installAssetUrls.push(...urls);
      return Promise.resolve();
    },
    put() {
      if (rejectCacheWrite) return Promise.reject(new Error('quota exceeded'));
      return Promise.resolve();
    }
  };
  const caches = {
    open: () => Promise.resolve(cache),
    match: () => Promise.resolve(undefined),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true)
  };
  vm.runInNewContext(sw, {self, caches, fetch: () => Promise.resolve(response), URL, Promise});

  listeners.install({waitUntil(promise) { waitUntilPromises.push(promise); }});
  if (!waitUntilPromises.length) fail('service-worker install did not retain cache.addAll in waitUntil');
  try { await waitUntilPromises.shift(); }
  catch (error) { fail('service-worker precache install failed: ' + error.message); }
  for (const required of ['https://example.test/index.html', 'https://example.test/flight-hardware-ui.js', 'https://example.test/Comanche055.bin']) {
    if (!installAssetUrls.includes(required)) fail('service-worker precache omitted ' + required);
  }
  if (new Set(installAssetUrls).size !== installAssetUrls.length) fail('service-worker precache contains duplicate normalized URLs');

  async function dispatchFetch(url) {
    let responsePromise;
    const event = {
      request: {method: 'GET', mode: 'cors', url},
      respondWith(promise) { responsePromise = promise; },
      waitUntil(promise) { waitUntilPromises.push(promise); }
    };
    listeners.fetch(event);
    const result = await responsePromise;
    if (result !== response) fail('service worker changed the network response while caching');
    if (!waitUntilPromises.length) fail('service worker did not retain cache write in waitUntil');
    try { await waitUntilPromises.shift(); } catch (error) { putErrors.push(error); }
  }

  await dispatchFetch('https://example.test/verification.js');
  rejectCacheWrite = true;
  await dispatchFetch('https://example.test/large-payload.bin');
  if (putErrors.length) fail('service-worker cache-write rejection escaped its handler');

  console.log('PWA smoke: PASS');
  console.log('Site: ' + site);
  console.log('yaAGC.wasm: ' + wasm.length + ' bytes');
  console.log('Comanche055.bin: ' + rope.length + ' bytes');
  console.log('Android browser fullscreen touch fallback: PASS');
  console.log('Browser wake lock / PIPA motion / absolute-orientation parity: PASS');
  console.log('Ambient-light / solar-location auto dimming: PASS');
  console.log('No analytics assets, hooks, or external request origin: PASS');
  console.log('Service-worker unique precache install, cache lifetime, and quota-failure handling: PASS');
  console.log('Apollo compact four-up model checklist + Android explicit-sheet imposition / dark EL + persistent COMP legend parity: PASS');
})().catch(error => fail('service-worker cache behavior test failed: ' + error.message));
