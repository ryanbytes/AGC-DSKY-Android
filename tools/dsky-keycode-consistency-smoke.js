#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const shellSource = fs.readFileSync(path.join(ASSETS, 'app-shell-runtime.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(ASSETS, 'agc-api-runtime.js'), 'utf8');
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
  if (actual.join(',') !== expected.join(',')) fail(`${label} key set differs from the 18-key Pinball matrix: ${actual.join(',')}`);
  for (const key of expected) if (map[key] !== canonical[key]) fail(`${label} maps ${key} to ${String(map[key])}, expected octal ${canonical[key].toString(8)}`);
  if (Object.prototype.hasOwnProperty.call(map, 'P')) fail(`${label} incorrectly includes PRO in channel 015`);
}

const context = {window:null, Object};
context.window = context;
vm.createContext(context);
vm.runInContext(sharedSource, context, {filename:'dsky-keycodes.js'});
const shared = context.AGCDSKY_KEY_CODES;
if (!shared || !Object.isFrozen(shared)) fail('shared DSKY keycode table is missing or mutable');
assertCanonical(shared, 'shared table');

for (const [label, source] of [['app-shell-runtime.js', shellSource], ['agc-api-runtime.js', apiSource]]) {
  for (const forbidden of ['AGC_KEY','AGCDSKY_KEY_CODES',"'1':0o01",'V:0o21','N:0o37']) {
    if (source.includes(forbidden)) fail(`${label} regained normal-key code ownership: ${forbidden}`);
  }
}
if (fs.existsSync(path.join(ASSETS,'app.js'))) fail('legacy app.js unexpectedly exists');

const keycodesIndex = html.indexOf('<script src="dsky-keycodes.js"></script>');
const apiIndex = html.indexOf('<script src="agc-api-runtime.js"></script>');
const clockIndex = html.indexOf('<script src="clock-behavior.js"></script>');
const keyboardIndex = html.indexOf('<script src="keyboard-electrical-interlock.js"');
if (keycodesIndex < 0 || apiIndex < keycodesIndex || clockIndex < keycodesIndex || keyboardIndex < keycodesIndex) {
  fail('shared DSKY keycodes must parser-load before API bootstrap and all normal-key consumers');
}
if (html.includes('<script src="app.js"></script>')) fail('index still loads deleted app.js');

const consumers = [
  ['clock-behavior.js', clockSource, 'const AGC_KEY = window.AGCDSKY_KEY_CODES;'],
  ['keyboard-electrical-interlock.js', keyboardSource, 'const DSKY_KEY_CODE = window.AGCDSKY_KEY_CODES;']
];
for (const [file, source, marker] of consumers) {
  if (!source.includes(marker)) fail(`${file} does not consume the shared DSKY keycode table`);
  if (source.includes("'1':0o01") || source.includes('V:0o21') || source.includes('N:0o37')) fail(`${file} still contains a duplicate Pinball keycode table`);
}
for (const forbidden of ['AGCDSKY_KEY_CODES','DSKY_KEY_CODE','NORMAL_KEY_CHANNEL',"'1':0o01",'V:0o21','N:0o37']) {
  if (flightUiSource.includes(forbidden)) fail(`flight-hardware-ui.js regained electrical keycode ownership: ${forbidden}`);
}

console.log('DSKY keycode consistency smoke: PASS');
console.log('  dsky-keycodes.js is the single frozen Pinball map; only clock fallback and the electrical interlock consume it; shell/API/PRO remain outside normal-key mapping');
