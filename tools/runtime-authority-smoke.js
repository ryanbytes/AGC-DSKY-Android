#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const runtime = fs.readFileSync(path.join(ASSETS, 'runtime-transitions.js'), 'utf8');
const consumers = [
  ['clock-behavior.js', fs.readFileSync(path.join(ASSETS, 'clock-behavior.js'), 'utf8')],
  ['proceed-electrical.js', fs.readFileSync(path.join(ASSETS, 'proceed-electrical.js'), 'utf8')],
  ['keyboard-electrical-interlock.js', fs.readFileSync(path.join(ASSETS, 'keyboard-electrical-interlock.js'), 'utf8')]
];

function fail(message) {
  console.error('RUNTIME AUTHORITY SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'const MODES = Object.freeze',
  'function status()',
  'function mode()',
  'function core()',
  'requestAgc,',
  'modes:MODES',
  'mode,',
  'core,'
]) {
  assert(runtime.includes(marker), `runtime-transitions.js missing authority marker: ${marker}`);
}
assert(runtime.includes('api.appStatus()'),
  'runtime-transitions.js must remain the adapter over appStatus()');
assert(runtime.includes('api.getCore()'),
  'runtime-transitions.js must remain the adapter over getCore()');

for (const [file, source] of consumers) {
  assert(source.includes('runtimeTransitions'), `${file} does not consume shared runtime authority`);
  assert(!source.includes('api.appStatus('), `${file} regained direct api.appStatus() ownership`);
  assert(!source.includes('api.getCore('), `${file} regained direct api.getCore() ownership`);
  assert(!source.includes('window.AGCDSKY.appStatus('), `${file} regained direct window.AGCDSKY.appStatus() ownership`);
  assert(!source.includes('window.AGCDSKY.getCore('), `${file} regained direct window.AGCDSKY.getCore() ownership`);
}

const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
assert(runtimeIndex >= 0, 'runtime-transitions.js is not packaged');
for (const file of ['clock-behavior.js', 'proceed-electrical.js', 'keyboard-electrical-interlock.js']) {
  const index = html.indexOf(`<script src="${file}"`);
  assert(index > runtimeIndex, `${file} must load after runtime-transitions.js`);
}

console.log('runtime authority smoke: PASS');
console.log('  clock fallback, PRO, and normal keyboard consume one validated mode/core authority');
