#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const shell = fs.readFileSync(path.join(ASSETS, 'app-shell-runtime.js'), 'utf8');
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

for (const [label, source] of [['app.js', app], ['app-shell-runtime.js', shell]]) {
  for (const forbidden of [
    'AGC_KEY','AGCDSKY_KEY_CODES','.keyPress(','.keyRelease(','.proceedKey(',
    'writeIo(0o15','writeIo(0o32',"document.querySelectorAll('[data-key]').forEach",
    'function press(','window.press','function executeClock(','PHONE CLOCK INPUT','entryMode='
  ]) assert(!source.includes(forbidden), `${label} regained removed DSKY input/editor ownership: ${forbidden}`);
}

assert(!keyboard.includes('window.press') && !keyboard.includes("typeof window.press"),
  'physical keyboard regained legacy app press fallback');
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
console.log('  app/bootstrap shell own no DSKY electrical/editor path; extracted keyboard + input runtime remain authoritative');
