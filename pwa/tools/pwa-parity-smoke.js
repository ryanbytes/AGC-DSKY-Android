#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'app/src/main/assets');
const site = path.resolve(process.argv[2] || path.join(root, 'pwa/dist'));
const fail = message => { console.error('PWA PARITY FAIL: ' + message); process.exit(1); };

function walk(dir, prefix='') {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name === '.DS_Store') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

const sourceFiles = walk(source);
for (const rel of sourceFiles) {
  const built = path.join(site, rel);
  if (!fs.existsSync(built)) fail(`shared Android asset missing from PWA build: ${rel}`);

  // index.html receives only PWA manifest/bootstrap injection. The web privacy
  // policy intentionally replaces the Android-local policy. Everything else
  // must be byte-for-byte identical to the Android WebView frontend.
  if (rel !== 'index.html' && rel !== 'PRIVACY_POLICY.txt') {
    const a = fs.readFileSync(path.join(source, rel));
    const b = fs.readFileSync(built);
    if (!a.equals(b)) fail(`shared asset diverged from Android: ${rel}`);
  }
}

// The PWA serves the same clock-behavior bytes through a one-time v2 filename
// so browsers with the old experimental COMP ACTY helper cached cannot reuse it.
const sourceClock = fs.readFileSync(path.join(source, 'clock-behavior.js'));
const pwaClockAlias = fs.readFileSync(path.join(site, 'clock-behavior-v2.js'));
if (!sourceClock.equals(pwaClockAlias)) fail('clock-behavior-v2.js diverged from shared clock behavior');

const sourceIndex = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
const builtIndex = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const refs = html => [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]);
const sharedRefs = refs(sourceIndex);
const builtRefs = refs(builtIndex);
let cursor = -1;
for (const ref of sharedRefs) {
  const expected = ref === 'clock-behavior.js' ? 'clock-behavior-v2.js' : ref;
  const next = builtRefs.indexOf(expected, cursor + 1);
  if (next < 0) fail(`shared index dependency missing or reordered: ${expected}`);
  cursor = next;
}

const sw = fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
for (const rel of sourceFiles) {
  if (rel === 'index.html' || rel.startsWith('.')) continue;
  if (!sw.includes(`'./${rel}'`)) fail(`shared asset is not available offline: ${rel}`);
}

for (const rel of ['pwa-bootstrap.js', 'pwa-sensor-parity.js', 'pwa-auto-dim.js', 'pwa-clock-guard.js', 'clock-behavior-v2.js', 'analytics.js', 'manifest.webmanifest', 'yaAGC.wasm', 'Comanche055.bin']) {
  if (!sw.includes(`'./${rel}'`)) fail(`PWA-only runtime asset is not available offline: ${rel}`);
}

console.log('PWA parity smoke: PASS');
console.log(`  ${sourceFiles.length} shared Android frontend assets present in PWA`);
console.log('  shared clock behavior is byte-identical through cache-busted PWA alias');
console.log('  shared assets byte-identical except intentional index/privacy overlays');
console.log('  shared and PWA runtime assets available offline');
