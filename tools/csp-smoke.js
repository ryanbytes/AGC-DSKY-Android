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

const policyMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?\s*>/i);
assert(policyMatch, 'frontend must declare an enforcing Content-Security-Policy');
const directiveParts = policyMatch[1].split(';').map(part => {
  const [name, ...values] = part.trim().split(/\s+/);
  return [name.toLowerCase(), values];
});
const directives = new Map(directiveParts);
const requiredPolicy = {
  'default-src': ["'none'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'"],
  'img-src': ["'self'"],
  'connect-src': ["'self'"],
  'media-src': ["'self'"],
  'font-src': ["'self'"],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"]
};
assert(directiveParts.length === directives.size, 'CSP must not repeat directives');
assert(directives.size === Object.keys(requiredPolicy).length, 'CSP directives changed unexpectedly');
for (const [name, expected] of Object.entries(requiredPolicy)) {
  assert(JSON.stringify(directives.get(name)) === JSON.stringify(expected),
    `CSP ${name} must be exactly ${expected.join(' ')}`);
}
assert(!policyMatch[1].split(/[;\s]+/).some(token => /^'(?:unsafe-inline|unsafe-eval)'$/i.test(token)),
  'CSP must not allow ordinary unsafe-inline or unsafe-eval');

// The packaged WebView is network-blocked by the Android shell. Keep the page
// itself self-contained too: no remote assets, forms, frames, or inline code.
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

assert(!/<style\b/i.test(html), 'frontend must not contain inline style blocks');
assert(!/\sstyle\s*=/i.test(html), 'frontend must not contain inline style attributes');
for (const filename of fs.readdirSync(ASSET_ROOT).filter(name => name.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(ASSET_ROOT, filename), 'utf8');
  assert(!/document\.createElement\(\s*['"]style['"]\s*\)/i.test(source),
    `${filename} must not inject inline style blocks`);
  assert(!/<style\b|<script\s*>/i.test(source),
    `${filename} must not generate inline style or script blocks`);
}

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
