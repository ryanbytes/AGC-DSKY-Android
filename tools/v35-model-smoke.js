#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const fidelity = fs.readFileSync(path.join(ASSETS, 'hardware-fidelity.js'), 'utf8');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function literal(source, name) {
  const pattern = new RegExp(
    'const\\s+' + name + '\\s*=\\s*(?:Object\\.freeze\\()?'
    + '(\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\)?;');
  const match = source.match(pattern);
  assert(match, `could not locate ${name}`);
  return vm.runInNewContext('(' + match[1] + ')');
}

const digitRelay = literal(app, 'DIGIT_RELAY');
assert(digitRelay['8'] === 0o35,
  'V35 numerical light test must use Block II relay code 035 for digit 8');

assert(!html.includes('app-refine.js'),
  'current v0.38.3 page must not load deleted app-refine.js');
assert(!html.includes('runtime-debug.js'),
  'current v0.38.3 page must not load deleted runtime-debug.js');
assert(html.indexOf('<script src="hardware-fidelity.js"></script>') >
       html.indexOf('<script src="app.js"></script>'),
  'hardware-fidelity.js must load after app.js');

const lowStart = app.indexOf('function v35Low11(relay)');
const lowEnd = app.indexOf('function captureClockRelayState', lowStart);
assert(lowStart >= 0 && lowEnd > lowStart, 'could not isolate v35Low11');
const lowContext = { DIGIT_RELAY: digitRelay };
vm.createContext(lowContext);
vm.runInContext(app.slice(lowStart, lowEnd) + '\nthis.v35Low11=v35Low11;', lowContext);
for (const relay of [11,10,9,8,7,6,5,4,3,2,1]) {
  const expected = [7,5,2].includes(relay) ? 0o3675 : 0o1675;
  assert(lowContext.v35Low11(relay) === expected,
    `V35 relay ${relay} low-11 word changed from 0o${expected.toString(8)}`);
}

const stateStart = app.indexOf('function v35RelayState()');
const stateEnd = app.indexOf('function scheduleV35RelaySounds', stateStart);
assert(stateStart >= 0 && stateEnd > stateStart, 'could not isolate v35RelayState');
const stateContext = {
  selectedMission: 'comanche055',
  v35Low11: lowContext.v35Low11
};
vm.createContext(stateContext);
vm.runInContext(app.slice(stateStart, stateEnd) + '\nthis.v35RelayState=v35RelayState;', stateContext);
const state = stateContext.v35RelayState();
assert(state[12] === 0o650,
  `Comanche055 V35 relay 12 must be 0650, got 0${Number(state[12]).toString(8)}`);
for (const relay of [11,10,9,8,7,6,5,4,3,2,1]) {
  const expected = [7,5,2].includes(relay) ? 0o3675 : 0o1675;
  assert(state[relay] === expected,
    `Comanche055 V35 state relay ${relay} changed`);
}

assert(app.includes('V35_ROW_MS=40,V35_TEST_MS=5000'),
  'base relay-sound model must retain 40 ms row spacing and five-second test duration');
assert(app.includes("if(verb==='35'){$('mode').textContent='V35 · REAL AGC MODE REQUIRED';return}"),
  'phone-clock command path must refuse to synthesize V35 as real AGC output');
assert(app.includes("document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'))"),
  'legacy local lamp-test helper unexpectedly changed; real AGC V35 remains authoritative through the command gate');

assert(fidelity.includes('In AGC mode V35 is not synthesized here'),
  'hardware-fidelity layer must document real Comanche/yaAGC V35 authority');
assert(fidelity.includes('const V35_HOLD_MS = 5000;'),
  'hardware-fidelity V35 hold duration changed');
assert(fidelity.includes('const DSKY_FLASH_QUANTUM_MS = 320;'),
  'hardware-fidelity DSKY flash quantum changed');
assert(fidelity.includes('state[12] = 0o650;'),
  'hardware-fidelity CM V35 relay-12 state changed from 0650');
assert(fidelity.includes('const plus = relay === 2 || relay === 5 || relay === 7;'),
  'hardware-fidelity plus-sign relay selection changed');
assert(fidelity.includes('AgcCore.prototype.start = function fidelityStart'),
  'hardware-fidelity AGC scheduler override missing');
assert(fidelity.includes('}, 4);'),
  'hardware-fidelity scheduler must continue draining output at 250 Hz');
assert(fidelity.includes('function releaseProceed()'),
  'maintained PRO release helper missing');
assert(fidelity.includes('agcCore.proceedKey(false)'),
  'maintained PRO release must deassert channel 032 input');

console.log('V35 relay model smoke: PASS');
console.log('  Comanche055 FULLDSP/FULLDSP1 rows, relay-12 0650, real-AGC command gate, five-second timing, 320 ms flash quantum, and maintained PRO verified');
