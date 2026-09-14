#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const sharedSource = fs.readFileSync(path.join(ASSETS, 'dsky-keycodes.js'), 'utf8');
const clockSource = fs.readFileSync(path.join(ASSETS, 'clock-behavior.js'), 'utf8');
const keyboardSource = fs.readFileSync(path.join(ASSETS, 'keyboard-electrical-interlock.js'), 'utf8');
const flightUiSource = fs.readFileSync(path.join(ASSETS, 'flight-hardware-ui.js'), 'utf8');

const canonical = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});
function fail(message){ console.error('DSKY KEYCODE CONSISTENCY FAIL: ' + message); process.exit(1); }
function assertCanonical(map, label){
  const expected = Object.keys(canonical).sort();
  const actual = Object.keys(map || {}).sort();
  if (actual.join(',') !== expected.join(',')) {
    fail(`${label} key set differs from the 18-key Pinball matrix: ${actual.join(',')}`);
  }
  for (const key of expected) {
    if (map[key] !== canonical[key]) {
      fail(`${label} maps ${key} to ${String(map[key])}, expected octal ${canonical[key].toString(8)}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(map, 'P')) fail(`${label} incorrectly includes PRO in channel 015`);
}

// dsky-keycodes.js is now the only literal Pinball map in the packaged frontend.
const context = {window:null, Object};
context.window = context;
vm.createContext(context);
vm.runInContext(sharedSource, context, {filename:'dsky-keycodes.js'});
const shared = context.AGCDSKY_KEY_CODES;
if (!shared || !Object.isFrozen(shared)) fail('shared DSKY keycode table is missing or mutable');
assertCanonical(shared, 'shared table');

for (const marker of [
  'const AGC_KEY=window.AGCDSKY_KEY_CODES;',
  "if(!AGC_KEY)throw new Error('Shared DSKY keycode table unavailable')"
]) {
  if (!appSource.includes(marker)) fail(`app.js does not require shared DSKY keycodes: ${marker}`);
}
if (/const\s+AGC_KEY\s*=\s*\{/.test(appSource)
    || appSource.includes("'1':0o01")
    || appSource.includes('V:0o21')
    || appSource.includes('N:0o37')) {
  fail('app.js regained a private Pinball keycode literal');
}

const keycodesIndex = html.indexOf('<script src="dsky-keycodes.js"></script>');
const appIndex = html.indexOf('<script src="app.js"></script>');
if (keycodesIndex < 0 || appIndex < 0 || keycodesIndex > appIndex) {
  fail('dsky-keycodes.js must parser-load before app.js');
}

const consumers = [
  ['clock-behavior.js', clockSource, 'const AGC_KEY = window.AGCDSKY_KEY_CODES;'],
  ['keyboard-electrical-interlock.js', keyboardSource, 'const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;']
];
for (const [file, source, marker] of consumers) {
  if (!source.includes(marker)) fail(`${file} does not consume the shared DSKY keycode table`);
  if (source.includes("'1':0o01") || source.includes('V:0o21') || source.includes('N:0o37')) {
    fail(`${file} still contains a duplicate Pinball keycode table`);
  }
}

// flight-hardware-ui.js owns presentation personality only. A keycode-table
// dependency there would reintroduce electrical ownership outside the shared path.
for (const forbidden of [
  'AGCDSKY_KEY_CODES',
  'DSKY_KEY_CODE',
  'NORMAL_KEY_CHANNEL',
  "'1':0o01",
  'V:0o21',
  'N:0o37'
]) {
  if (flightUiSource.includes(forbidden)) {
    fail(`flight-hardware-ui.js regained electrical keycode ownership: ${forbidden}`);
  }
}

console.log('DSKY keycode consistency smoke: PASS');
console.log('  dsky-keycodes.js is the single frozen Pinball map consumed by app, clock fallback, and the electrical interlock; PRO remains separate');
