#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRIVER = path.join(ROOT, 'tools/device-v35-smoke.js');
const APP = path.join(ROOT, 'app/src/main/assets/app.js');
const HARDWARE = path.join(ROOT, 'app/src/main/assets/hardware-fidelity.js');
const INDEX = path.join(ROOT, 'app/src/main/assets/index.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const driver = fs.readFileSync(DRIVER, 'utf8');
const app = fs.readFileSync(APP, 'utf8');
const hardware = fs.readFileSync(HARDWARE, 'utf8');
const html = fs.readFileSync(INDEX, 'utf8');

assert(!driver.includes('Luminary099') && !driver.includes('luminary099'),
  'device V35 smoke must be CM/Comanche-only');
assert(!driver.includes("getElementById('mission')"),
  'device V35 smoke must not depend on the removed mission selector');
assert(driver.includes("mission === 'comanche055'") || driver.includes("mission === \"comanche055\""),
  'device V35 smoke must require Comanche055');
assert(driver.includes('12:0o0650'),
  'device V35 smoke must use Comanche055 relay-12 test word 0650');
assert(driver.includes("typeof api.appStatus==='function'") && driver.includes("typeof api.hardware==='function'"),
  'device V35 smoke must use the current appStatus/hardware diagnostic surfaces');

for (const token of [
  "state.lamps.comp === !!(v11 & 0o00002)",
  "state.lamps.uplink === !!(v11 & 0o00004)",
  "state.lamps.temp === !!(v163 & 0o00010)",
  "state.lamps.keyrel === !!(v163 & 0o00020)",
  "state.vnBlanked === !!(v163 & 0o00040)",
  "state.lamps.oprerr === !!(v163 & 0o00100)",
  "state.lamps.restart === !!(v163 & 0o00200)",
  "state.lamps.stby === !!(v163 & 0o00400)",
  "state.elOff === !!(v163 & 0o01000)"
]) {
  assert(driver.includes(token), `device V35 raw-channel invariant missing: ${token}`);
}
assert(driver.includes("state.mode !== 'agc'"),
  'device V35 raw-channel comparison must be restricted to real AGC mode');
assert(driver.includes("['V','3','7','E','0','0','E']"),
  'device V35 test must establish the P00 precondition through pointer keys');
assert(driver.includes("['V','3','5','E']"),
  'device V35 test must execute V35E through pointer keys');

assert(app.includes('channels:{ch011:agcCh11,ch013:agcCh13,ch0163:agcCh163}'),
  'appStatus must expose current AGC output channels to diagnostics');
assert(app.includes('function decodeChannel11(value){agcCh11=value;'),
  'channel 011 state must come from AGC output decoding');
assert(app.includes('function decodeChannel163(value){'),
  'channel 0163 state must come from AGC output decoding');

assert(hardware.includes('In AGC mode V35 is not synthesized here'),
  'hardware layer must document that real Comanche V35 is authoritative in AGC mode');
assert(hardware.includes('window.AGCDSKY.hardware = () => ({'),
  'hardware layer must expose read-only latch/timing diagnostics');
assert(hardware.includes('state[12] = 0o650'),
  'hardware model must use CM/Comanche relay-12 V35 state for clock-only compatibility');
assert(html.includes('<script src="hardware-fidelity.js"></script>'),
  'current frontend must load the hardware-fidelity diagnostic layer');
assert(!html.includes('src="app-refine.js"') && !html.includes('src="runtime-debug.js"'),
  'current frontend must not load removed patch-era diagnostics');

console.log('device V35 policy smoke: PASS');
console.log('  Comanche055-only pointer path and relay-12 0650: PASS');
console.log('  rendered discrete state follows raw channels 011/0163: PASS');
console.log('  diagnostics use appStatus + hardware surfaces: PASS');
