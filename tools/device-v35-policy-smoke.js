#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRIVER = path.join(ROOT, 'tools/device-v35-smoke.js');
const REFINE = path.join(ROOT, 'app/src/main/assets/app-refine.js');
const READY = path.join(ROOT, 'app/src/main/assets/runtime-debug.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const driver = fs.readFileSync(DRIVER, 'utf8');
const refine = fs.readFileSync(REFINE, 'utf8');
const ready = fs.readFileSync(READY, 'utf8');

// Real Luminary V35 runs as an Executive job, so COMP ACTY may legitimately
// follow normal Executive activity. The device test must verify the lamp from
// raw channel 011 bit 2 rather than asserting a fixed off state.
assert(!driver.includes('state.lamps.comp === false'),
  'real V35 device gate must not hard-code COMP ACTY off');
assert(driver.includes('state.lamps.comp === !!(v11 & 0o00002)'),
  'real V35 device gate must derive COMP ACTY from channel 011 bit 2');
assert(driver.includes('state.lamps.uplink === !!(v11 & 0o00004)'),
  'real V35 device gate must derive UPLINK ACTY from channel 011 bit 3');

// The modulated DSKY state must likewise be checked against yaAGC channel 0163
// rather than inferred solely from rendered CSS/lamp classes.
for (const token of [
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
assert(driver.includes("ch11.mode !== 'agc'") && driver.includes("ch163.mode !== 'agc'"),
  'device V35 gate must reject synthetic/non-AGC channel diagnostics');

assert(refine.includes('window.AGCDSKY.snapshotChannels = snapshotChannels'),
  'frontend refinement must expose read-only raw channel diagnostics');
assert(refine.includes('lastChannel011 = { value: value & 0o77777, mode }'),
  'channel 011 diagnostic must capture exact raw word and source mode');
assert(refine.includes('lastChannel163 = { value: value & 0o77777, mode }'),
  'channel 0163 diagnostic must capture exact raw word and source mode');

assert(ready.includes("typeof global.AGCDSKY.snapshotChannels === 'function'"),
  'FRONTEND READY must require the raw-channel diagnostic layer');

console.log('device V35 policy smoke: PASS');
console.log('  COMP/UPLINK follow raw channel 011: PASS');
console.log('  DSKY modulation follows raw channel 0163: PASS');
console.log('  fixed COMP-off assertion forbidden: PASS');
