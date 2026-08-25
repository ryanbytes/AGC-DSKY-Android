#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/app.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/agc-core.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function objectLiteralAfter(source, name) {
    const pattern = new RegExp('const\\s+' + name + '\\s*=\\s*(\\{[\\s\\S]*?\\});');
    const match = source.match(pattern);
    assert(match, `could not locate ${name}`);
    return vm.runInNewContext('(' + match[1] + ')');
}

// VirtualAGC piPeripheral/convertNasspLog.py numberPatterns.
const expectedDigits = {
    0: ' ', 21: '0', 3: '1', 25: '2', 27: '3',
    15: '4', 30: '5', 28: '6', 19: '7', 29: '8', 31: '9'
};
const relayDigits = objectLiteralAfter(app, 'RELAY_DIGIT');
for (const [code, digit] of Object.entries(expectedDigits)) {
    assert(relayDigits[code] === digit,
        `relay code ${code} must decode as ${JSON.stringify(digit)}`);
}
assert(Object.keys(relayDigits).length === Object.keys(expectedDigits).length,
    'relay digit table contains an unexpected code');

// Apollo/VirtualAGC Pinball key codes used on input channel 015.
const expectedKeys = {
    '1': 0o01, '2': 0o02, '3': 0o03, '4': 0o04, '5': 0o05,
    '6': 0o06, '7': 0o07, '8': 0o10, '9': 0o11, '0': 0o20,
    V: 0o21, R: 0o22, K: 0o31, '+': 0o32, '-': 0o33,
    E: 0o34, C: 0o36, N: 0o37
};
const keys = objectLiteralAfter(app, 'AGC_KEY');
for (const [key, code] of Object.entries(expectedKeys)) {
    assert(keys[key] === code,
        `DSKY key ${key} must use Pinball code 0o${code.toString(8)}`);
}
assert(Object.keys(keys).length === Object.keys(expectedKeys).length,
    'AGC key table contains an unexpected key');

// Channel 010 relay selector/sign placement. Relay 7/5/2 carry plus and
// relay 6/4/1 carry minus; plus has priority if both sign relays are set.
for (const snippet of [
    'case 7:agcDisplay.r1.plus=!!b',
    'case 6:agcDisplay.r1.minus=!!b',
    'case 5:agcDisplay.r2.plus=!!b',
    'case 4:agcDisplay.r2.minus=!!b',
    'case 2:agcDisplay.r3.plus=!!b',
    'case 1:agcDisplay.r3.minus=!!b'
]) {
    assert(app.includes(snippet), `missing authentic sign relay mapping: ${snippet}`);
}
assert(app.includes("function regSign(reg){return reg.plus?'+':reg.minus?'-':' '}"),
    'plus must have priority when both DSKY sign relays are asserted');
assert(app.includes('case 8:agcDisplay.r1.digits[0]=relayDigit(d)'),
    'relay 8 must take R1 digit 1 from the right-hand D field');

// Output channel 011: COMP ACTY bit 2 and UPLINK ACTY bit 3.
assert(app.includes("function decodeChannel11(value){setLamp('comp',value&0o00002);setLamp('uplink',value&0o00004)}"),
    'channel 011 COMP/UPLINK mapping changed');

// yaAGC synthetic/modulated channel 0163 constants from agc_engine.h.
for (const snippet of [
    "setLamp('temp',value&0o00010)",
    "setLamp('keyrel',value&0o00020)",
    "classList.toggle('vn-flash-off',!!(value&0o00040))",
    "setLamp('oprerr',value&0o00100)",
    "setLamp('restart',value&0o00200)",
    "setLamp('stby',value&0o00400)",
    "classList.toggle('el-off',!!(value&0o01000))"
]) {
    assert(app.includes(snippet), `channel 0163 mapping changed: ${snippet}`);
}

// PRO is not a normal Pinball key. It owns channel 032 bit 14 and the
// peripheral U-bit masks own only the intended DSKY bits.
assert(core.includes('const NORMAL_KEY_CHANNEL = 0o15;'),
    'normal DSKY input channel must remain 015');
assert(core.includes('const PROCEED_CHANNEL = 0o32;'),
    'PRO input channel must remain 032');
assert(core.includes('const NORMAL_KEY_MASK = 0o37;'),
    'normal DSKY input mask must remain 00037');
assert(core.includes('const PROCEED_MASK = 0o20000;'),
    'PRO input mask must remain 20000');
assert(core.includes('this.writeIo(U_BIT | NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK);'),
    'normal DSKY U-bit mask packet changed');
assert(core.includes('this.writeIo(U_BIT | PROCEED_CHANNEL, PROCEED_MASK);'),
    'PRO U-bit mask packet changed');

console.log('DSKY mapping smoke: PASS');
