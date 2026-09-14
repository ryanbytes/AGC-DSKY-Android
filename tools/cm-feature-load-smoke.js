#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const cm = fs.readFileSync(path.join(root, 'app/src/main/assets/cm-mode.js'), 'utf8');

function fail(message) {
  console.error('CM FEATURE LOAD FAIL: ' + message);
  process.exit(1);
}

const features = [
  'flight-hardware-ui',
  'lighting-rheostat-stop',
  'key-mechanical-spec',
  'keyboard-electrical-interlock',
  'lighting-electrical-model',
  'relay-perceptual-personality'
];

let priorIndex = -1;
for (const feature of features) {
  const tag = `<script src="${feature}.js" data-feature="${feature}"></script>`;
  const index = html.indexOf(tag);
  if (index < 0) fail(`index.html is missing deterministic ${feature} script tag`);
  if (index <= priorIndex) fail(`${feature}.js is out of CM dependency order`);
  priorIndex = index;

  const selector = `script[data-feature="${feature}"]`;
  if (!cm.includes(selector)) fail(`cm-mode.js no longer guards duplicate ${feature} injection`);
  if (!cm.includes(`script.src = '${feature}.js'`)) fail(`cm-mode.js lost fallback loader for ${feature}`);
}

const dreamIndex = html.indexOf('<script src="dream-agc.js"></script>');
if (dreamIndex < 0 || priorIndex >= dreamIndex) {
  fail('CM hardware layers must all initialize before dream-agc.js readiness marker');
}

const relayShowIndex = html.indexOf('<script src="relay-show.js"');
if (relayShowIndex >= 0) fail('relay-show.js should remain dynamically paired with its injected control button');
if (!cm.includes("script.src = 'relay-show.js'")) fail('cm-mode.js lost dynamic Relay Show installation');

const keyboardIndex = html.indexOf('data-feature="keyboard-electrical-interlock"');
const closingBody = html.indexOf('</body>');
if (keyboardIndex < 0 || keyboardIndex >= closingBody) {
  fail('keyboard electrical interlock is not parser-loaded before the page becomes interactive');
}

console.log('CM feature load smoke: PASS');
console.log('  hardware/personality/interlock layers load deterministically; cm-mode fallback cannot duplicate them; Relay Show remains dynamic');
