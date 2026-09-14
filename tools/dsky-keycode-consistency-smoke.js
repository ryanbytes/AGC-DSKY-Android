#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const appSource = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const sharedSource = fs.readFileSync(path.join(ASSETS, 'dsky-keycodes.js'), 'utf8');
const clockSource = fs.readFileSync(path.join(ASSETS, 'clock-behavior.js'), 'utf8');
const keyboardSource = fs.readFileSync(path.join(ASSETS, 'keyboard-electrical-interlock.js'), 'utf8');

const canonical = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});

function fail(message) {
  console.error('DSKY KEYCODE CONSISTENCY FAIL: ' + message);
  process.exit(1);
}

function extractAppMap() {
  const match = appSource.match(/const\s+AGC_KEY\s*=\s*(\{[^}]+\})/s);
  if (!match) fail('app.js no longer exposes the canonical AGC_KEY table');
  try {
    return vm.runInNewContext(`(${match[1]})`, Object.create(null), {filename:'app.js'});
  } catch (error) {
    fail(`app.js AGC_KEY could not be evaluated: ${error.message}`);
  }
}

const appMap = extractAppMap();
const expectedKeys = Object.keys(canonical).sort();
const actualKeys = Object.keys(appMap).sort();
if (actualKeys.join(',') !== expectedKeys.join(',')) {
  fail(`app.js key set differs from the 18-key Pinball matrix: ${actualKeys.join(',')}`);
}
for (const key of expectedKeys) {
  if (appMap[key] !== canonical[key]) {
    fail(`app.js maps ${key} to ${String(appMap[key])}, expected octal ${canonical[key].toString(8)}`);
  }
}
if (Object.prototype.hasOwnProperty.call(appMap, 'P')) {
  fail('app.js incorrectly includes PRO in the normal channel-015 keycode matrix');
}

for (const marker of [
  'window.AGCDSKY_KEY_CODES = Object.freeze({...AGC_KEY})',
  "throw new Error('Canonical DSKY keycode table unavailable')"
]) {
  if (!sharedSource.includes(marker)) fail(`dsky-keycodes.js missing shared-table marker: ${marker}`);
}
if (!clockSource.includes('const AGC_KEY = window.AGCDSKY_KEY_CODES;')) {
  fail('clock-behavior.js does not consume the shared DSKY keycode table');
}
if (!keyboardSource.includes('const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;')) {
  fail('keyboard-electrical-interlock.js does not consume the shared DSKY keycode table');
}
for (const [file, source] of [
  ['clock-behavior.js', clockSource],
  ['keyboard-electrical-interlock.js', keyboardSource]
]) {
  if (source.includes("'1':0o01") || source.includes('V:0o21') || source.includes('N:0o37')) {
    fail(`${file} still contains a duplicate Pinball keycode table`);
  }
}

const context = {window:null, AGC_KEY:appMap, Object};
context.window = context;
vm.createContext(context);
vm.runInContext(sharedSource, context, {filename:'dsky-keycodes.js'});
const shared = context.AGCDSKY_KEY_CODES;
if (!shared || !Object.isFrozen(shared)) fail('shared DSKY keycode table is missing or mutable');
if (shared === appMap) fail('shared DSKY keycode export must be an immutable copy, not the mutable source object');
for (const key of expectedKeys) {
  if (shared[key] !== canonical[key]) fail(`shared table changed ${key}`);
}
if (Object.prototype.hasOwnProperty.call(shared, 'P')) {
  fail('shared table incorrectly includes PRO');
}

console.log('DSKY keycode consistency smoke: PASS');
console.log('  app.js is the one Pinball-map source; clock/electrical layers consume one frozen shared copy; PRO remains separate');
