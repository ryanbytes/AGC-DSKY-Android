#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const keyboard = fs.readFileSync(path.join(ASSETS, 'keyboard-electrical-interlock.js'), 'utf8');
const input = fs.readFileSync(path.join(ASSETS, 'dsky-input-runtime.js'), 'utf8');
const keycodes = fs.readFileSync(path.join(ASSETS, 'dsky-keycodes.js'), 'utf8');

function fail(message) {
  console.error('APP INPUT BOUNDARY SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const forbidden of [
  'AGC_KEY',
  'AGCDSKY_KEY_CODES',
  '.keyPress(',
  '.keyRelease(',
  '.proceedKey(',
  'writeIo(0o15',
  'writeIo(0o32',
  "document.querySelectorAll('[data-key]').forEach"
]) {
  assert(!app.includes(forbidden), `app.js regained extracted DSKY input ownership: ${forbidden}`);
}

assert(app.includes('function press(k){'),
  'legacy CLOCK press helper disappeared unexpectedly');
assert(app.includes("if(mode==='agc')return;"),
  'legacy app press helper can still act in AGC mode');
assert(app.includes("if(mode!=='clock')return;"),
  'legacy app press helper is not explicitly CLOCK-scoped');

// The actual AGC electrical path must remain in the extracted owners.
assert(keyboard.includes('const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;'),
  'physical keyboard no longer consumes shared keycodes');
assert(keyboard.includes('input.keyMake(code)'),
  'physical keyboard no longer delegates key make to input runtime');
assert(keyboard.includes('input.keyReset(electricalCore)'),
  'physical keyboard no longer delegates KEYRST to input runtime');
assert(input.includes('function keyMake(code)'),
  'input runtime lost key-make ownership');
assert(input.includes('function keyReset(coreOverride = null)'),
  'input runtime lost KEYRST ownership');
assert(keycodes.includes('window.AGCDSKY_KEY_CODES = Object.freeze({'),
  'shared frozen keycode source is missing');

console.log('app input boundary smoke: PASS');
console.log('  app.js installs no DSKY target handler and has no AGC electrical primitives; extracted keyboard + input runtime own real DSKY input');
