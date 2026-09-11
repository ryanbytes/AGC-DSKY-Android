#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/app.js'), 'utf8');
const relayAudio = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/relay-audio-refine.js'), 'utf8');
const relayMatrix = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-relay-matrix.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function literal(name) {
  const pattern = new RegExp(
    'const\\s+' + name + '\\s*=\\s*(?:Object\\.freeze\\()?'
    + '(\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\)?;');
  const match = app.match(pattern);
  assert(match, `could not locate ${name}`);
  return vm.runInNewContext('(' + match[1] + ')');
}

function same(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${message}\n  actual: ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
}

const expectedDigitRelay = {
  ' ': 0, '0': 21, '1': 3, '2': 25, '3': 27, '4': 15,
  '5': 30, '6': 28, '7': 19, '8': 29, '9': 31
};
const digitRelay = literal('DIGIT_RELAY');
same(digitRelay, expectedDigitRelay, 'DSKY five-relay digit table changed');

const relayDigit = literal('RELAY_DIGIT');
for (const [digit, code] of Object.entries(expectedDigitRelay)) {
  assert(relayDigit[code] === digit,
    `incoming relay decoder no longer maps code ${code} back to ${JSON.stringify(digit)}`);
}

const expectedKeys = {
  '1': 0o01, '2': 0o02, '3': 0o03, '4': 0o04, '5': 0o05,
  '6': 0o06, '7': 0o07, '8': 0o10, '9': 0o11, '0': 0o20,
  V: 0o21, R: 0o22, K: 0o31, '+': 0o32, '-': 0o33,
  E: 0o34, C: 0o36, N: 0o37
};
same(literal('AGC_KEY'), expectedKeys, 'Pinball key-code table changed');

const groups = literal('CLOCK_GROUPS');
same(groups, [
  {relay:8,cells:[['r1',0]],singleRight:true},
  {relay:7,cells:[['r1',1],['r1',2]],b:1},
  {relay:6,cells:[['r1',3],['r1',4]],b:0},
  {relay:5,cells:[['r2',0],['r2',1]],b:1},
  {relay:4,cells:[['r2',2],['r2',3]],b:0},
  {relay:3,cells:[['r2',4],['r3',0]],b:0},
  {relay:2,cells:[['r3',1],['r3',2]],b:1},
  {relay:1,cells:[['r3',3],['r3',4]],b:0}
], 'phone-clock Block II relay grouping changed');

const clockStart = app.indexOf('function clockWord(');
const clockEnd = app.indexOf('function popcount11', clockStart);
assert(clockStart >= 0 && clockEnd > clockStart, 'could not isolate clockWord');
const clockContext = { DIGIT_RELAY: expectedDigitRelay };
vm.createContext(clockContext);
vm.runInContext(app.slice(clockStart, clockEnd) + '\nthis.clockWord=clockWord;', clockContext);
const want = {
  r1:['1','2','3','4','5'],
  r2:['6','7','8','9','0'],
  r3:['2','4','6','8','0']
};
for (const group of groups) {
  let c = 0, d = 0;
  if (group.singleRight) {
    d = expectedDigitRelay[want[group.cells[0][0]][group.cells[0][1]]];
  } else {
    c = expectedDigitRelay[want[group.cells[0][0]][group.cells[0][1]]];
    d = expectedDigitRelay[want[group.cells[1][0]][group.cells[1][1]]];
  }
  const expected = ((group.b || 0) << 10) | (c << 5) | d;
  assert(clockContext.clockWord(group, want) === expected,
    `clock relay ${group.relay} encoding changed`);
}

// Block II display circuitry is 12 selectable banks of 11 bistable relays.
// Bits 12-15 of channel 010 select the bank; only the low 11 bits are the
// bank's latching relay state. A row transition therefore produces exactly
// the Hamming distance of the old/new low-11 words in mechanical operations.
assert(app.includes('const relay=(value>>11)&0o17,b=(value>>10)&1,c=(value>>5)&0o37,d=value&0o37,low11=value&0o3777;'),
  'channel 010 must retain 4-bit bank selector + low-11 relay split');
assert(app.includes('if(relay>=1&&relay<=12)'),
  'channel 010 must retain all 12 relay banks');
assert(app.includes('popcount11(prior^low11)'),
  'AGC relay sounds must be derived from changed low-11 bistable relays');
assert(app.includes('CLOCK_SETTLE_MS=20'),
  'Block II relay pull-in/settle interval must remain 20 ms');
assert(relayAudio.includes('count = Math.max(0, Math.min(11'),
  'relay audio must cap a bank transition to its 11 physical relays');
assert(relayAudio.includes('for (let i = 0; i < count; i++) emitTick'),
  'relay audio must emit one transient per changed bistable relay');
assert(relayAudio.includes('mechanical pull-in scatter only, not serialized relay drive'),
  'relay audio must document parallel electrical drive vs mechanical scatter');

// The five character relays are a contact matrix, not an enum. Verify the
// schematic-derived K1..K5 logic reproduces all supported decimal patterns and
// remains capable of displaying the other 21 electrically possible states.
const matrixStart = relayMatrix.indexOf('function segmentsForRelayCode(value)');
const matrixEnd = relayMatrix.indexOf('// Keep normal codes human-readable', matrixStart);
assert(matrixStart >= 0 && matrixEnd > matrixStart,
  'could not isolate schematic relay-contact matrix');
const matrixContext = {};
vm.createContext(matrixContext);
vm.runInContext(relayMatrix.slice(matrixStart, matrixEnd) + '\nthis.segmentsForRelayCode=segmentsForRelayCode;', matrixContext);
const expectedSegments = {
  ' ':'', '0':'abcdef', '1':'bc', '2':'abdeg', '3':'abcdg',
  '4':'bcfg', '5':'acdfg', '6':'acdefg', '7':'abc', '8':'abcdefg', '9':'abcdfg'
};
for (const [digit, code] of Object.entries(expectedDigitRelay)) {
  assert(matrixContext.segmentsForRelayCode(code) === expectedSegments[digit],
    `schematic relay contacts no longer render ${JSON.stringify(digit)} correctly`);
}
const allContactPatterns = new Set();
for (let code = 0; code < 32; code++) allContactPatterns.add(matrixContext.segmentsForRelayCode(code));
assert(allContactPatterns.size > 11,
  'relay contact renderer collapsed the 32 physical K1-K5 states to the normal decimal enum');
assert(relayMatrix.includes('SEG[ch] = segmentsForRelayCode(code);'),
  'non-decimal K1-K5 states must be wired into the segment renderer');
assert(relayMatrix.includes('relayDigit = function schematicRelayDigit(code)'),
  'hardware relay decoder must use the schematic contact matrix for unsupported states');
const geometryPos = indexHtml.indexOf('<script src="dsky-geometry.js"></script>');
const matrixPos = indexHtml.indexOf('<script src="dsky-relay-matrix.js"></script>');
const hardwarePos = indexHtml.indexOf('<script src="hardware-fidelity.js"></script>');
assert(geometryPos >= 0 && matrixPos > geometryPos && hardwarePos > matrixPos,
  'schematic contact matrix must load after glyph geometry and before hardware-fidelity timing');

const decodeStart = app.indexOf('function decodeChannel10(value)');
const decodeEnd = app.indexOf('function updateAgcCompActy()', decodeStart);
assert(decodeStart >= 0 && decodeEnd > decodeStart,
  'could not isolate current channel 010 decoder');
const decode = app.slice(decodeStart, decodeEnd);
for (const snippet of [
  "case 12:setLamp('vel',value&0o00004);setLamp('noatt',value&0o00010);setLamp('alt',value&0o00020);setLamp('gimbal',value&0o00040);setLamp('tracker',value&0o00200);setLamp('prog',value&0o00400)",
  "case 11:agcDisplay.prog[0]=relayDigit(c);agcDisplay.prog[1]=relayDigit(d)",
  "case 10:agcDisplay.verb[0]=relayDigit(c);agcDisplay.verb[1]=relayDigit(d)",
  "case 9:agcDisplay.noun[0]=relayDigit(c);agcDisplay.noun[1]=relayDigit(d)",
  "case 8:agcDisplay.r1.digits[0]=relayDigit(d)",
  "case 7:agcDisplay.r1.plus=!!b",
  "case 6:agcDisplay.r1.minus=!!b",
  "case 5:agcDisplay.r2.plus=!!b",
  "case 4:agcDisplay.r2.minus=!!b",
  "case 3:agcDisplay.r2.digits[4]=relayDigit(c);agcDisplay.r3.digits[0]=relayDigit(d)",
  "case 2:agcDisplay.r3.plus=!!b",
  "case 1:agcDisplay.r3.minus=!!b"
]) {
  assert(decode.includes(snippet), `channel 010 mapping missing: ${snippet}`);
}

assert(app.includes("setLamp('comp',!!(agcCh11&0o00002))"),
  'channel 011 COMP ACTY mapping changed');
assert(app.includes("setLamp('uplink',value&0o00004)"),
  'channel 011 UPLINK ACTY mapping changed');
assert(app.includes('agcCh13=value;'),
  'channel 013 state must remain latched for diagnostics');
for (const snippet of [
  "setLamp('temp',value&0o00010)",
  "setLamp('keyrel',value&0o00020)",
  "classList.toggle('vn-flash-off',!!(value&0o00040))",
  "setLamp('oprerr',value&0o00100)",
  "setLamp('restart',value&0o00200)",
  "setLamp('stby',value&0o00400)",
  "classList.toggle('el-off',!!(value&0o01000))"
]) {
  assert(app.includes(snippet), `channel 0163 mapping missing: ${snippet}`);
}

console.log('DSKY mapping smoke: PASS');
console.log('  Block II 12x11 relay banks, K1-K5 contact matrix, individual armature clicks, digit codes, Pinball keys, and channel mappings verified');
