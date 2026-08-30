#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const refine = fs.readFileSync(path.join(ASSETS, 'app-refine.js'), 'utf8');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function literalAfter(name) {
  const pattern = new RegExp(
    'const\\s+' + name + '\\s*=\\s*(?:Object\\.freeze\\()?'
    + '(\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\)?;');
  const match = app.match(pattern);
  assert(match, `could not locate ${name}`);
  return vm.runInNewContext('(' + match[1] + ')');
}

const digitRelay = literalAfter('DIGIT_RELAY');
const channel10Digits = literalAfter('CHANNEL10_DIGITS');
const channel10Signs = literalAfter('CHANNEL10_SIGNS');
assert(digitRelay['8'] === 0o35, 'V35 numerical light test must use relay code 035 for digit 8');

assert(app.includes('const V35_TEST_MS=5000,V35_FLASH_PHASE_MS=320;'),
  'clock V35 must retain the Luminary five-second duration and 320 ms flash phase');
assert(app.includes("decodeChannel10((12<<11)|0o674);"),
  'clock V35 must drive the six Apollo-11 LM relay-12 condition lights');
assert(app.includes('decodeChannel11(0o00004);'),
  'clock V35 must light UPLINK ACTY without asserting COMP ACTY');
assert(app.includes('decodeChannel163(0o00730);'),
  'clock V35 must assert TEMP/KEY REL/OPR ERR/RESTART/STBY through the DSKY state path');
assert(!/function lampTest\(\)[\s\S]*?querySelectorAll\('\[data-lamp\]'\)[\s\S]*?classList\.add\('on'\)/.test(app),
  'clock V35 must not bypass the relay/state model by force-lighting every DOM lamp');
assert(html.indexOf('<script src="app-refine.js"></script>') > html.indexOf('<script src="app.js"></script>'),
  'app-refine.js must load after app.js so the effective V35 relay model is installed');

// RSET/mission/mode refinement depends on this base helper actually killing
// both asynchronous pieces of the synthetic test. Guard the contract directly
// instead of allowing the wrapper smoke to fake a stronger cancel function.
const cancelStart = app.indexOf('function cancelLampTest(');
const cancelEnd = app.indexOf('function v35RelayWord(', cancelStart);
assert(cancelStart >= 0 && cancelEnd > cancelStart, 'could not isolate cancelLampTest');
const cancelSource = app.slice(cancelStart, cancelEnd);
assert(cancelSource.includes('clearTimeout(lampTestTimer)'),
  'cancelLampTest must clear the five-second V35 teardown timeout');
assert(cancelSource.includes('clearInterval(lampTestFlashTimer)'),
  'cancelLampTest must clear the 320-ms V35 flash interval');
assert(cancelSource.includes('lampTestActive=false'),
  'cancelLampTest must clear the active-test ownership flag');

// Load the base relay-word constructor, then the actual post-load refinement
// layer. This tests the effective browser binding rather than a second model in
// the smoke itself.
const start = app.indexOf('function v35RelayWord(');
const end = app.indexOf('function startClockV35Flash', start);
assert(start >= 0 && end > start, 'could not isolate v35RelayWord');
const context = {
  DIGIT_RELAY: digitRelay,
  CHANNEL10_DIGITS: channel10Digits,
  CHANNEL10_SIGNS: channel10Signs,
  mode: 'clock',
  lampTestActive: false,
  selectedMission: 'luminary099',
  clockRelayWords: {},
  agcRelayWords: {},
  window: { AGCDSKY: {} },
  press() {},
  cancelLampTest() {},
  enterAgc() {},
  cycleMission() {}
};
vm.createContext(context);
vm.runInContext(app.slice(start, end) + '\nthis.__baseV35RelayWord=v35RelayWord;', context,
  { filename: 'app-v35-relays.js' });
const baseV35RelayWord = context.__baseV35RelayWord;
vm.runInContext(refine, context, { filename: 'app-refine.js' });
const v35RelayWord = context.v35RelayWord;
assert(typeof v35RelayWord === 'function', 'effective V35 relay constructor missing after refinement');

// Luminary 99 VBTSTLTS loads FULLDSP 05675 into every numeric DSPTAB entry.
// After T4 strips the dirty/selector bits, every ordinary numeric row therefore
// carries low-11 01675; the three plus rows carry FULLDSP1 low-11 03675.
// Relay 8's C field is not visibly connected, but those five physical relays are
// still driven and must be represented by the model.
for (const relay of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
  const value = v35RelayWord(relay);
  assert(((value >> 11) & 0o17) === relay,
    `V35 relay word selected ${((value >> 11) & 0o17)} instead of ${relay}`);
  const c = (value >> 5) & 0o37;
  const d = value & 0o37;
  assert(c === 0o35 && d === 0o35,
    `V35 relay ${relay} must drive both physical five-relay fields to digit 8`);
  const sign = channel10Signs[relay];
  const b = (value >> 10) & 1;
  assert(b === (sign && sign[1] === 'plus' ? 1 : 0),
    `V35 relay ${relay} sign bit does not match the shared sign matrix`);
  const expectedLow11 = [7, 5, 2].includes(relay) ? 0o3675 : 0o1675;
  assert((value & 0o3777) === expectedLow11,
    `V35 relay ${relay} low-11 word is 0${(value & 0o3777).toString(8)}, expected 0${expectedLow11.toString(8)}`);
}

assert(((baseV35RelayWord(8) >> 5) & 0o37) === 0,
  'base relay-8 behavior changed; remove the refinement only after app.js itself models FULLDSP');
assert(((v35RelayWord(8) >> 5) & 0o37) === 0o35,
  'effective relay-8 C bank must be driven by the refinement layer');

for (const relay of [7, 5, 2]) {
  assert((v35RelayWord(relay) & 0o2000) !== 0,
    `V35 must assert plus-sign B bit on relay ${relay}`);
}
for (const relay of [6, 4, 1]) {
  assert((v35RelayWord(relay) & 0o2000) === 0,
    `V35 must leave minus-sign B bit clear on relay ${relay}`);
}

const flashStart = app.indexOf('function startClockV35Flash(');
const flashEnd = app.indexOf('function lampTest(', flashStart);
assert(flashStart >= 0 && flashEnd > flashStart, 'could not isolate clock V35 flash model');
const flashSource = app.slice(flashStart, flashEnd);
assert(flashSource.includes('phase=(phase+1)%4'),
  'V35 flash must retain four equal 320 ms phases (1.28 s period)');
assert(flashSource.includes('const off=phase===0'),
  'V35 flash must be off for exactly one of four phases (75% duty cycle)');
assert(flashSource.includes("setLamp('keyrel',!off);setLamp('oprerr',!off);"),
  'V35 off phase must suppress KEY REL and OPR ERR with V/N blanking');

console.log('V35 relay model smoke: PASS');
console.log('  FULLDSP/FULLDSP1 physical relay rows: PASS');
console.log('  explicit timeout + flash-interval cancellation contract: PASS');
console.log('  21 visible numerical positions + three plus signs: PASS');
console.log('  relay-12 condition lights / COMP exclusion: PASS');
console.log('  five-second test / 1.28 s 75% flash: PASS');
