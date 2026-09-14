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
const flightUiSource = fs.readFileSync(path.join(ASSETS, 'flight-hardware-ui.js'), 'utf8');

const canonical = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});
function fail(message){ console.error('DSKY KEYCODE CONSISTENCY FAIL: ' + message); process.exit(1); }
function extractAppLiteral(){
  const match = appSource.match(/const\s+AGC_KEY\s*=\s*(\{[^}]+\})/s);
  if (!match) fail('app.js no longer exposes the canonical AGC_KEY table');
  return match[1];
}

const literal = extractAppLiteral();
let appMap;
try {
  appMap = vm.runInNewContext(`(${literal})`, Object.create(null), {filename:'app.js'});
} catch (error) {
  fail(`app.js AGC_KEY could not be evaluated: ${error.message}`);
}
const expected = Object.keys(canonical).sort();
const actual = Object.keys(appMap).sort();
if (actual.join(',') !== expected.join(',')) {
  fail(`app.js key set differs from the 18-key Pinball matrix: ${actual.join(',')}`);
}
for (const key of expected) {
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
const consumers = [
  ['clock-behavior.js', clockSource, 'const AGC_KEY = window.AGCDSKY_KEY_CODES;'],
  ['keyboard-electrical-interlock.js', keyboardSource, 'const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;'],
  ['flight-hardware-ui.js', flightUiSource, 'const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;']
];
for (const [file, source, marker] of consumers) {
  if (!source.includes(marker)) fail(`${file} does not consume the shared DSKY keycode table`);
  if (source.includes("'1':0o01") || source.includes('V:0o21') || source.includes('N:0o37')) {
    fail(`${file} still contains a duplicate Pinball keycode table`);
  }
}

// Match production classic-script semantics: app.js creates a top-level lexical
// const in one script; dsky-keycodes.js is a later classic script in the same
// global environment and must resolve that lexical binding without window.AGC_KEY.
const context = {window:null, Object};
context.window = context;
vm.createContext(context);
vm.runInContext(`const AGC_KEY=${literal};`, context, {filename:'app-keycode-lexical.js'});
if (Object.prototype.hasOwnProperty.call(context, 'AGC_KEY')) {
  fail('test setup accidentally exposed AGC_KEY as a window property');
}
vm.runInContext(sharedSource, context, {filename:'dsky-keycodes.js'});
const shared = context.AGCDSKY_KEY_CODES;
if (!shared || !Object.isFrozen(shared)) fail('shared DSKY keycode table is missing or mutable');
if (shared === appMap) fail('shared DSKY keycode export must be an immutable copy');
for (const key of expected) {
  if (shared[key] !== canonical[key]) fail(`shared table changed ${key}`);
}
if (Object.prototype.hasOwnProperty.call(shared, 'P')) fail('shared table incorrectly includes PRO');

console.log('DSKY keycode consistency smoke: PASS');
console.log('  app.js is the one Pinball-map source; clock, electrical interlock, and flight UI consume one frozen copy; PRO remains separate');
