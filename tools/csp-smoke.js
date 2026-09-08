#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'app/src/main/assets/index.html');

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

const scripts = [
  'agc-core.js',
  'spacecraft-default.js',
  'app.js',
  'phone-icdu.js',
  'apollo-stars.js',
  'optics.js',
  'spacecraft-panel-mode.js',
  'relay-audio-refine.js',
  'dsky-geometry.js',
  'hardware-fidelity.js',
  'background-audio-guard.js',
  'screen-only.js',
  'cheatsheet.js',
  'diagnostics.js'
];
let previous = -1;
for (const script of scripts) {
  const tag = `<script src="${script}"></script>`;
  const index = html.indexOf(tag);
  assert(index >= 0, `expected external script missing: ${script}`);
  assert(index > previous, `frontend script order changed around ${script}`);
  previous = index;
}
assert(!html.includes('runtime-debug.js'), 'removed runtime-debug patch must not be loaded');
assert(!html.includes('app-refine.js'), 'removed app-refine patch must not be loaded');
assert(!html.includes('v35-audio-refine.js'), 'removed V35 audio patch must not be loaded');
assert(!html.includes('spacecraft-panels.js'), 'DSKY-only runtime must not load spacecraft panel renderer');

console.log('frontend isolation smoke: PASS');
console.log(`  ${assetRefs.length} local asset references; ${scripts.length} scripts in verified order`);
