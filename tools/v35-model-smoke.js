#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const clock = fs.readFileSync(path.join(ASSETS, 'phone-clock-runtime.js'), 'utf8');
const fidelity = fs.readFileSync(path.join(ASSETS, 'hardware-fidelity.js'), 'utf8');
const relayAudio = fs.readFileSync(path.join(ASSETS, 'relay-identity-audio.js'), 'utf8');
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

const digitRelay = literal(clock, 'DIGIT_RELAY');
assert(digitRelay['8'] === 0o35,
  'V35 numerical light test must use Block II relay code 035 for digit 8');
assert(!app.includes('const DIGIT_RELAY=') && !app.includes('function v35Low11('),
  'app.js regained synthetic clock/V35 relay ownership');

assert(!html.includes('app-refine.js'),
  'current page must not load deleted app-refine.js');
assert(!html.includes('runtime-debug.js'),
  'current page must not load deleted runtime-debug.js');
const clockRuntimeIndex = html.indexOf('<script src="phone-clock-runtime.js"></script>');
const appIndex = html.indexOf('<script src="app.js"></script>');
const fidelityIndex = html.indexOf('<script src="hardware-fidelity.js"></script>');
assert(clockRuntimeIndex >= 0 && clockRuntimeIndex < appIndex && fidelityIndex > appIndex,
  'phone-clock runtime must load before app.js and hardware fidelity after app.js');

const lowStart = clock.indexOf('function v35Low11(relay)');
const lowEnd = clock.indexOf('function captureClockRelayState', lowStart);
assert(lowStart >= 0 && lowEnd > lowStart, 'could not isolate v35Low11');
const lowContext = { DIGIT_RELAY: digitRelay };
vm.createContext(lowContext);
vm.runInContext(clock.slice(lowStart, lowEnd) + '\nthis.v35Low11=v35Low11;', lowContext);
for (const relay of [11,10,9,8,7,6,5,4,3,2,1]) {
  const expected = [7,5,2].includes(relay) ? 0o3675 : 0o1675;
  assert(lowContext.v35Low11(relay) === expected,
    `V35 relay ${relay} low-11 word changed from 0o${expected.toString(8)}`);
}

const stateStart = clock.indexOf('function v35RelayState()');
const stateEnd = clock.indexOf('function scheduleV35RelaySounds', stateStart);
assert(stateStart >= 0 && stateEnd > stateStart, 'could not isolate v35RelayState');
const stateContext = {
  selectedMission: 'comanche055',
  v35Low11: lowContext.v35Low11
};
vm.createContext(stateContext);
vm.runInContext(clock.slice(stateStart, stateEnd) + '\nthis.v35RelayState=v35RelayState;', stateContext);
const state = stateContext.v35RelayState();
assert(state[12] === 0o650,
  `Comanche055 V35 relay 12 must be 0650, got 0${Number(state[12]).toString(8)}`);
for (const relay of [11,10,9,8,7,6,5,4,3,2,1]) {
  const expected = [7,5,2].includes(relay) ? 0o3675 : 0o1675;
  assert(state[relay] === expected,
    `Comanche055 V35 state relay ${relay} changed`);
}

assert(clock.includes('V35_ROW_MS=40,V35_TEST_MS=5000'),
  'clock runtime must retain 40 ms row spacing and five-second lamp-test duration');
assert(!app.includes('function executeClock(')
    && !app.includes('PHONE CLOCK INPUT')
    && !app.includes('V35 · REAL AGC MODE REQUIRED'),
  'synthetic phone-clock DSKY command path must remain removed; real AGC owns V35 commands');
assert(clock.includes("document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'))"),
  'local clock-mode lamp-test presentation unexpectedly changed');

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

new vm.Script(relayAudio, {filename: 'relay-identity-audio.js'});
assert(relayAudio.includes('const DRIVE_ENVELOPE_MS = 20;'),
  'relay manufacturing model must retain the documented 20-ms drive envelope');
assert(relayAudio.includes('MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS'),
  'manufacturing variation must settle before the 20-ms drive boundary');
for (const token of [
  'setTravelMs', 'resetTravelMs', 'setStableMs', 'resetStableMs',
  'setBounceTimesMs', 'resetBounceTimesMs', 'poleSkewUs',
  'contactTraceFor', 'playContactBounce'
]) {
  assert(relayAudio.includes(token), `relay manufacturing model missing ${token}`);
}
assert(relayAudio.includes("relayManufacturingModel = 'deterministic-per-relay-set-reset-bounce-v1'"),
  'hardware diagnostics must identify the deterministic manufacturing model');
assert(!relayAudio.includes('Math.random('),
  'physical relay manufacturing fingerprints must be persistent, not per-operation random');
assert(!relayAudio.includes('agcRelayWords['),
  'relay manufacturing layer must not publish partially settled contact words');
assert(!relayAudio.includes('renderAgcReg(') && !relayAudio.includes("set2('"),
  'relay manufacturing layer must not render sub-20-ms contact motion to the EL face');

console.log('V35 relay model smoke: PASS');
console.log('  extracted clock runtime owns synthetic V35/lamp-test state while real Comanche/yaAGC V35 remains authoritative');
