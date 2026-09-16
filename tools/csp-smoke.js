#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSET_ROOT = path.join(ROOT, 'app/src/main/assets');
const INDEX = path.join(ASSET_ROOT, 'index.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const html = fs.readFileSync(INDEX, 'utf8');

// The packaged WebView is network-blocked by the Android shell. Keep the page
// itself self-contained too: no remote scripts, styles, images, forms, frames,
// or inline JavaScript/event handlers.
const assetRefs = [];
for (const pattern of [
  /<script\s+[^>]*src="([^"]+)"/gi,
  /<link\s+[^>]*href="([^"]+)"/gi,
  /<img\s+[^>]*src="([^"]+)"/gi,
  /<source\s+[^>]*src="([^"]+)"/gi
]) {
  let match;
  while ((match = pattern.exec(html)) !== null) assetRefs.push(match[1]);
}
for (const ref of assetRefs) {
  assert(!/^[a-z][a-z0-9+.-]*:/i.test(ref), `external frontend URL is forbidden: ${ref}`);
  assert(!ref.startsWith('//'), `protocol-relative frontend URL is forbidden: ${ref}`);
  assert(!ref.startsWith('/') && !ref.includes('..'), `frontend asset must stay in local asset root: ${ref}`);
}

assert(!/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html),
  'frontend must not contain inline script blocks');
assert(!/\son[a-z]+\s*=/i.test(html),
  'frontend must not contain inline event-handler attributes');
assert(!/<iframe\b/i.test(html), 'frontend must not contain iframe elements');
assert(!/<form\b/i.test(html), 'frontend must not contain form elements');

const styles = [...html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
assert(styles.length === 1, `expected exactly one inline style block, found ${styles.length}`);
assert(/\bid="dsky-solo"/i.test(styles[0][1]),
  'the only inline style block must be #dsky-solo');
assert(!/@import\b/i.test(styles[0][2]), '#dsky-solo must not import external CSS');
assert(!/url\s*\(/i.test(styles[0][2]), '#dsky-solo must not reference external resources');

// Keep this smoke focused on CSP/local-asset isolation rather than duplicating
// the full runtime architecture tests. Verify every external script is local,
// present on disk, unique, and that the major boot/runtime boundaries retain
// their required relative order.
const scriptRefs = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/gi)]
  .map((match) => match[1]);
assert(scriptRefs.length > 0, 'frontend must load external local scripts');
assert(new Set(scriptRefs).size === scriptRefs.length, 'frontend must not load duplicate scripts');
for (const script of scriptRefs) {
  assert(fs.existsSync(path.join(ASSET_ROOT, script)), `referenced frontend script missing on disk: ${script}`);
}

const orderedAnchors = [
  'agc-core.js',
  'spacecraft-default.js',
  'startup-defaults.js',
  'app-state-runtime.js',
  'app-shell-runtime.js',
  'dsky-display-renderer.js',
  'agc-api-runtime.js',
  'runtime-transitions.js',
  'dsky-input-runtime.js',
  'clock-behavior.js',
  'hardware-fidelity.js',
  'screen-only.js',
  'parallax-3d.js',
  'dream-agc.js'
];
let previous = -1;
for (const script of orderedAnchors) {
  const index = scriptRefs.indexOf(script);
  assert(index >= 0, `expected external script missing: ${script}`);
  assert(index > previous, `frontend script order changed around ${script}`);
  previous = index;
}

for (const stale of [
  'app.js',
  'runtime-debug.js',
  'app-refine.js',
  'v35-audio-refine.js',
  'spacecraft-panels.js',
  'spacecraft-panel-mode.js'
]) {
  assert(!html.includes(stale), `DSKY-only runtime must not load stale frontend asset ${stale}`);
}

console.log('frontend isolation smoke: PASS');
console.log(`  ${assetRefs.length} local asset references; ${scriptRefs.length} scripts; ${orderedAnchors.length} order anchors verified`);
