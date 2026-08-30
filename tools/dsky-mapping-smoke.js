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

function literalAfter(source, name) {
    const pattern = new RegExp(
        'const\\s+' + name + '\\s*=\\s*(?:Object\\.freeze\\()?'
        + '(\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\)?;');
    const match = source.match(pattern);
    assert(match, `could not locate ${name}`);
    return vm.runInNewContext('(' + match[1] + ')');
}

function same(actual, expected, message) {
    assert(JSON.stringify(actual) === JSON.stringify(expected),
        `${message}\n  actual: ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
}

// VirtualAGC piPeripheral/convertNasspLog.py and yaDSKY2 use this exact Block II
// five-relay character matrix. app.js keeps only this direction as source data
// and derives the incoming-code inverse so the two tables cannot drift apart.
const expectedDigitRelay = {
    ' ': 0, '0': 21, '1': 3, '2': 25, '3': 27, '4': 15,
    '5': 30, '6': 28, '7': 19, '8': 29, '9': 31
};
const digitRelay = literalAfter(app, 'DIGIT_RELAY');
same(digitRelay, expectedDigitRelay, 'DSKY digit relay-code table changed');
assert(app.includes(
    'Object.fromEntries(Object.entries(DIGIT_RELAY).map(([digit,code])=>[code,digit]))'),
    'incoming relay decoder must derive its inverse from DIGIT_RELAY');

// Apollo/VirtualAGC Pinball key codes used on input channel 015.
const expectedKeys = {
    '1': 0o01, '2': 0o02, '3': 0o03, '4': 0o04, '5': 0o05,
    '6': 0o06, '7': 0o07, '8': 0o10, '9': 0o11, '0': 0o20,
    V: 0o21, R: 0o22, K: 0o31, '+': 0o32, '-': 0o33,
    E: 0o34, C: 0o36, N: 0o37
};
const keys = literalAfter(app, 'AGC_KEY');
same(keys, expectedKeys, 'Pinball key-code table changed');

// Channel 010 relay selector layout from the Block II DSKY relay matrix.
const expectedDigits = {
    11: [['prog', 0, 'c'], ['prog', 1, 'd']],
    10: [['verb', 0, 'c'], ['verb', 1, 'd']],
    9: [['noun', 0, 'c'], ['noun', 1, 'd']],
    8: [['r1', 0, 'd']],
    7: [['r1', 1, 'c'], ['r1', 2, 'd']],
    6: [['r1', 3, 'c'], ['r1', 4, 'd']],
    5: [['r2', 0, 'c'], ['r2', 1, 'd']],
    4: [['r2', 2, 'c'], ['r2', 3, 'd']],
    3: [['r2', 4, 'c'], ['r3', 0, 'd']],
    2: [['r3', 1, 'c'], ['r3', 2, 'd']],
    1: [['r3', 3, 'c'], ['r3', 4, 'd']]
};
const expectedSigns = {
    7: ['r1', 'plus'], 6: ['r1', 'minus'],
    5: ['r2', 'plus'], 4: ['r2', 'minus'],
    2: ['r3', 'plus'], 1: ['r3', 'minus']
};
const expectedLamps = [
    [0o00004, 'vel'], [0o00010, 'noatt'], [0o00020, 'alt'],
    [0o00040, 'gimbal'], [0o00200, 'tracker'], [0o00400, 'prog']
];
same(literalAfter(app, 'CHANNEL10_DIGITS'), expectedDigits,
    'channel 010 digit-selector matrix changed');
same(literalAfter(app, 'CHANNEL10_SIGNS'), expectedSigns,
    'channel 010 sign-selector matrix changed');
same(literalAfter(app, 'CHANNEL10_LAMPS'), expectedLamps,
    'Apollo 11-14 LM relay-12 lamp matrix changed');
assert(app.includes('Apollo 11-14 LM panels left relay-12 bits 1/2 unplacarded and unused'),
    'relay-12 Apollo 11-14 blank-position rationale must remain documented');

// The synthetic phone-clock relay emulator must consume the same selector
// topology rather than carrying another hand-maintained grouping table.
assert(!app.includes('CLOCK_GROUPS'),
    'do not reintroduce a second phone-clock relay topology');
same(literalAfter(app, 'CLOCK_RELAYS'), [8, 7, 6, 5, 4, 3, 2, 1],
    'phone-clock dirty relay order changed');
assert(app.includes('const targets=CHANNEL10_DIGITS[relay]'),
    'phone-clock relay words must derive digit placement from CHANNEL10_DIGITS');
assert(app.includes("const sign=CHANNEL10_SIGNS[relay],b=sign&&sign[1]==='plus'?1:0"),
    'phone-clock plus-sign bits must derive from CHANNEL10_SIGNS');

const clockStart = app.indexOf('function clockWord(');
const clockEnd = app.indexOf('function popcount11', clockStart);
assert(clockStart >= 0 && clockEnd > clockStart,
    'could not isolate phone-clock relay encoder');
const clockContext = {
    DIGIT_RELAY: expectedDigitRelay,
    CHANNEL10_DIGITS: expectedDigits,
    CHANNEL10_SIGNS: expectedSigns
};
vm.createContext(clockContext);
vm.runInContext(app.slice(clockStart, clockEnd) + '\nthis.__clockWord=clockWord;',
    clockContext, { filename: 'app-clock-relays.js' });
const clockWord = clockContext.__clockWord;
const clockWant = {
    r1: ['1', '2', '3', '4', '5'],
    r2: ['6', '7', '8', '9', '0'],
    r3: ['2', '4', '6', '8', '0']
};
function expectedClockWord(relay) {
    let c = 0;
    let d = 0;
    for (const [name, index, source] of expectedDigits[relay]) {
        const code = expectedDigitRelay[clockWant[name][index]];
        if (source === 'c') c = code;
        else d = code;
    }
    const sign = expectedSigns[relay];
    const b = sign && sign[1] === 'plus' ? 1 : 0;
    return (b << 10) | (c << 5) | d;
}
for (const relay of [8, 7, 6, 5, 4, 3, 2, 1]) {
    assert(clockWord(relay, clockWant) === expectedClockWord(relay),
        `phone-clock relay ${relay} does not encode through shared Block II topology`);
}

// Execute the actual app.js channel-010 decoder in isolation. This avoids a
// second hand-written decoder that could agree with itself while the app is
// broken. Rendering and lamps are replaced by small observation hooks only.
const start = app.indexOf('const CHANNEL10_DIGITS=');
const end = app.indexOf('function decodeChannel11');
assert(start >= 0 && end > start, 'could not isolate channel 010 decoder source');

const rendered = {};
const lamps = {};
const errors = [];
const relayDigit = Object.fromEntries(
    Object.entries(expectedDigitRelay).map(([digit, code]) => [code, digit]));
const relayWords = {};
const context = {
    RELAY_DIGIT: Object.freeze(relayDigit),
    agcRelayWords: relayWords,
    tickSound: false,
    set2(name, text) {
        rendered[name] = String(text);
    },
    setReg(name, sign, digits) {
        rendered[name] = String(sign) + String(digits);
    },
    setLamp(name, on) {
        lamps[name] = !!on;
    },
    popcount11(value) {
        value &= 0x7ff;
        let count = 0;
        while (value) {
            value &= value - 1;
            count++;
        }
        return count;
    },
    playRelayBurst() {},
    clearLamps() {},
    console: {
        error(...args) {
            errors.push(args.map((arg) => String(arg)).join(' '));
        }
    },
    Object,
    Set,
    Error
};
vm.createContext(context);
vm.runInContext(
    app.slice(start, end)
    + '\nthis.__decodeChannel10=decodeChannel10;this.__agcDisplay=agcDisplay;',
    context,
    { filename: 'app-channel10.js' });

const decode = context.__decodeChannel10;
const display = context.__agcDisplay;
assert(typeof decode === 'function', 'channel 010 decoder did not load');

function word(relay, b = 0, c = 0, d = 0) {
    return (relay << 11) | (b << 10) | (c << 5) | d;
}

// PROG/VERB/NOUN and all 15 register digits.
assert(decode(word(11, 0, 3, 25)) === true && rendered.prog === '12',
    'relay 11 must drive PROG digits 1/2');
assert(decode(word(10, 0, 27, 15)) === true && rendered.verb === '34',
    'relay 10 must drive VERB digits 1/2');
assert(decode(word(9, 0, 30, 28)) === true && rendered.noun === '56',
    'relay 9 must drive NOUN digits 1/2');

// Relay 8 has no left/C digit. An invalid C pattern therefore must not reject
// a valid R1D1 update; only the right/D field is connected on the real matrix.
assert(decode(word(8, 0, 1, 19)) === true,
    'relay 8 must ignore its unconnected C field');
assert(decode(word(7, 1, 29, 31)) === true,
    'relay 7 must drive R1 plus, D2 and D3');
assert(decode(word(6, 0, 21, 3)) === true && rendered.r1 === '+78901',
    'relays 8/7/6 must assemble R1 as +78901');

assert(decode(word(5, 1, 25, 27)) === true,
    'relay 5 must drive R2 plus, D1 and D2');
assert(decode(word(4, 0, 15, 30)) === true,
    'relay 4 must drive R2 minus, D3 and D4');
assert(decode(word(3, 0, 28, 19)) === true && rendered.r2 === '+23456',
    'relays 5/4/3 must assemble R2 as +23456');
assert(decode(word(2, 1, 29, 31)) === true,
    'relay 2 must drive R3 plus, D2 and D3');
assert(decode(word(1, 0, 21, 3)) === true && rendered.r3 === '+78901',
    'relays 3/2/1 must assemble R3 as +78901');

// Sign relays latch independently. VirtualAGC gives plus priority when both
// relay bits are set, exactly as the app should.
decode(word(6, 1, 21, 3));
assert(display.r1.plus && display.r1.minus && rendered.r1 === '+78901',
    'plus must have display priority when both R1 sign relays are asserted');
decode(word(7, 0, 29, 31));
assert(!display.r1.plus && display.r1.minus && rendered.r1 === '-78901',
    'R1 minus relay must render minus when plus is clear');
decode(word(6, 0, 21, 3));
assert(!display.r1.plus && !display.r1.minus && rendered.r1 === ' 78901',
    'R1 sign must blank when both sign relays are clear');

// Relay 12 condition lamps. 0674 is bits 3,4,5,6,8,9 all asserted.
assert(decode((12 << 11) | 0o674) === true,
    'relay 12 all-lamps word must decode');
for (const [, name] of expectedLamps) {
    assert(lamps[name] === true, `relay 12 must light ${name}`);
}
// Bits 1/2 are real relay positions but unused/unplacarded on Apollo 11-14 LM.
assert(decode((12 << 11) | 0o003) === true,
    'Apollo 11 relay-12 unused bits 1/2 must not be treated as malformed');
for (const [, name] of expectedLamps) {
    assert(lamps[name] === false, `relay 12 must clear ${name}`);
}
assert(Object.keys(lamps).length === 6,
    'Apollo 11-14 LM decoder must expose exactly six relay-12 condition lamps');

// 00000 is the only valid blank code. Other unused five-bit patterns are not
// blanks and must not erase previously latched digits.
assert(decode(word(11, 0, 0, 0)) === true && rendered.prog === '  ',
    'relay digit code 0 must remain a valid blank');
decode(word(11, 0, 3, 25));
const goodProg = rendered.prog;
const goodRelay11 = relayWords[11];
const errorCount = errors.length;
assert(decode(word(11, 0, 1, 25)) === false,
    'unused C digit pattern must be rejected');
assert(rendered.prog === goodProg && relayWords[11] === goodRelay11,
    'malformed relay word must not alter displayed or latched relay state');
assert(errors.length === errorCount + 1,
    'first malformed relay word must produce one diagnostic');
assert(decode(word(11, 0, 1, 25)) === false && errors.length === errorCount + 1,
    'identical malformed relay word diagnostics must be rate-limited');
assert(decode(word(13, 0, 3, 25)) === false,
    'unused relay selector 13 must be rejected');
assert(errors.length === errorCount + 2,
    'invalid selector must produce its own diagnostic');

// Output channel 011: COMP ACTY bit 2 and UPLINK ACTY bit 3.
assert(app.includes("function decodeChannel11(value){setLamp('comp',value&0o00002);setLamp('uplink',value&0o00004)}"),
    'channel 011 COMP/UPLINK mapping changed');

// yaAGC synthetic/modulated channel 0163 constants from agc_engine.h. The
// engine already performs V/N modulation; the frontend must follow the fake
// channel state rather than starting a second flashing timer.
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
console.log('  shared phone-clock / AGC relay topology: PASS');
console.log('  channel 010 selectors 1-12: PASS');
console.log('  signs / 21 numerical positions / Apollo 11 LM lamps: PASS');
console.log('  malformed relay-word preservation and diagnostics: PASS');
