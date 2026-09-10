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
  'index.html', 'manifest.webmanifest', 'pwa-bootstrap.js', 'sw.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'yaAGC.wasm', 'Comanche055.bin'
]) {
  if (!exists(rel)) fail('missing ' + rel);
}

const index = text('index.html');
for (const marker of [
  'rel="manifest" href="manifest.webmanifest"',
  'apple-mobile-web-app-capable',
  'apple-touch-icon',
  '<script src="pwa-bootstrap.js"></script>'
]) {
  if (!index.includes(marker)) fail('index.html missing ' + marker);
}

let manifest;
try { manifest = JSON.parse(text('manifest.webmanifest')); }
catch (error) { fail('manifest is not valid JSON: ' + error.message); }
if (manifest.display !== 'standalone') fail('manifest display must be standalone');
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

const sw = text('sw.js');
if (sw.includes('__CACHE_VERSION__')) fail('service-worker cache version was not stamped');
for (const required of ['yaAGC.wasm', 'Comanche055.bin', 'manifest.webmanifest', 'pwa-bootstrap.js']) {
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
