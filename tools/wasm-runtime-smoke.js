#!/usr/bin/env node
'use strict';

/*
 * Execute the real pinned yaAGC WebAssembly binary under Node using the same
 * agc-core.js wrapper loaded by Android. It exercises the pinned CM rope using
 * the same engine and requires no LM assets.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const CORE_JS = path.join(ROOT, 'app/src/main/assets/agc-core.js');
const WASM = path.join(ROOT, 'vendor/yaAGC-cm/yaAGC.wasm');
const ROPE_NAME = 'Comanche055.bin';
const ROPE = path.join(ROOT, 'vendor/webAGC/demo/agc/Comanche055.bin');

const CHANNEL_DSKY = 0o10;
const CHANNEL_DSKY_DISCRETES = 0o163;
const OPR_ERR_BIT = 0o100;
const FAILREG_ADDRESSES = [0o375, 0o376, 0o377];
const COLD_START_PHASE_TABLE_ALARM = 0o1107;
const OCTAL_DIGIT_BY_RELAY_CODE = new Map([
    [0o25, '0'], [0o03, '1'], [0o31, '2'], [0o33, '3'],
    [0o17, '4'], [0o36, '5'], [0o34, '6'], [0o23, '7']
]);
const RELAY_ZERO = 0o25;
const RELAY_EIGHT = 0o35;
const RELAY_SIGN_BIT = 0o2000;
const PROGRAM00_LOW11 = (RELAY_ZERO << 5) | RELAY_ZERO;
const VERB16_LOW11 = (0o03 << 5) | 0o34;
const VERB06_LOW11 = (0o25 << 5) | 0o34;
const NOUN65_LOW11 = (0o34 << 5) | 0o36;
const COMANCHE_V35_RELAY12_LOW11 = 0o650;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function arrayBufferFromBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function requireFile(file, expectedSize) {
    assert(fs.existsSync(file), `missing required runtime asset: ${file}`);
    const data = fs.readFileSync(file);
    assert(data.length === expectedSize,
        `${path.basename(file)} is ${data.length} bytes; expected ${expectedSize}`);
    return data;
}

function verifyBinaryImportContract(wasmBytes) {
    const module = new WebAssembly.Module(wasmBytes);
    const actual = WebAssembly.Module.imports(module)
        .map(({ module: namespace, name, kind }) => `${namespace}.${name}:${kind}`)
        .sort();
    const expected = [
        'env.memory:memory',
        'wasi_snapshot_preview1.fd_fdstat_get:function',
        'wasi_snapshot_preview1.fd_seek:function',
        'wasi_snapshot_preview1.fd_write:function'
    ].sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected),
        `unexpected yaAGC WASM imports:\n  actual: ${actual.join(', ')}\n  expected: ${expected.join(', ')}`);

    const exported = new Set(WebAssembly.Module.exports(module).map((entry) => entry.name));
    for (const name of ['malloc', 'free', 'set_fixed', 'configure_cm_mode', 'get_cm_mode', 'get_erasable_ptr', 'cpu_reset', 'cpu_step', 'packet_write', 'packet_read']) {
        assert(exported.has(name), `yaAGC WASM missing required export: ${name}`);
    }
}

function makeContext(filesByUrl) {
    const source = fs.readFileSync(CORE_JS, 'utf8');
    const context = {
        window: null,
        console,
        TextDecoder,
        Uint8Array,
        Uint16Array,
        DataView,
        ArrayBuffer,
        WebAssembly,
        performance,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        btoa: (text) => Buffer.from(text, 'binary').toString('base64'),
        atob: (text) => Buffer.from(text, 'base64').toString('binary'),
        fetch: async (url) => {
            const key = String(url);
            const data = filesByUrl.get(key);
            return {
                ok: !!data,
                status: data ? 200 : 404,
                async arrayBuffer() {
                    return data ? arrayBufferFromBuffer(data) : new ArrayBuffer(0);
                }
            };
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'agc-core.js' });
    return context;
}

function updateRelayState(relays, value) {
    const relay = (value >> 11) & 0o17;
    if (relay >= 1 && relay <= 12) relays.set(relay, value);
}

function relayStateFromUpdates(channelUpdates) {
    const relays = new Map();
    for (const [channel, value] of channelUpdates) {
        if (channel === CHANNEL_DSKY) updateRelayState(relays, value);
    }
    return relays;
}

function program00Present(relays) {
    const relay11 = relays.get(11);
    return relay11 !== undefined && (relay11 & 0o3777) === PROGRAM00_LOW11;
}

function pairIsEight(value) {
    return ((value >> 5) & 0o37) === RELAY_EIGHT && (value & 0o37) === RELAY_EIGHT;
}

function lightTestNumericsPresent(relays) {
    for (const relay of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
        const value = relays.get(relay);
        if (value === undefined || !pairIsEight(value)) return false;
    }
    return true;
}

function lightTestSignsPresent(relays) {
    return [7, 5, 2].every((relay) => {
        const value = relays.get(relay);
        return value !== undefined && (value & RELAY_SIGN_BIT) !== 0;
    });
}

function completeV35RelayState(relays, expectedRelay12 = COMANCHE_V35_RELAY12_LOW11) {
    const relay12 = relays.get(12);
    return lightTestNumericsPresent(relays)
        && lightTestSignsPresent(relays)
        && relay12 !== undefined
        && (relay12 & 0o3777) === expectedRelay12;
}

function keyAndRun(core, keyCode, steps = 12000) {
    assert(core.keyPress(keyCode) > 0,
        `Comanche055: normal key 0o${keyCode.toString(8)} was not accepted`);
    core.step(steps);
    assert(core.keyRelease(),
        `Comanche055: KEYRST failed after normal key 0o${keyCode.toString(8)}`);
    core.step(1);
    assert(core.inputChannelBits(0o15, 0o177) === 0,
        `Comanche055: normal key 0o${keyCode.toString(8)} remained electrically held after KEYRST`);
}

function sendKeys(core, keyCodes, steps = 12000) {
    for (const keyCode of keyCodes) keyAndRun(core, keyCode, steps);
}

function failRegWords(core) {
    const base = core.exports.get_erasable_ptr() >>> 1;
    const erasable = new Uint16Array(core.memory.buffer);
    return FAILREG_ADDRESSES.map((address) => erasable[base + address]);
}

function decodeOctalNoun09(relays) {
    const digit = (relay, contact) => {
        const word = relays.get(relay);
        assert(word !== undefined, `Comanche055: V05N09 missing relay ${relay}`);
        const code = contact === 'C' ? (word >> 5) & 0o37 : word & 0o37;
        const value = OCTAL_DIGIT_BY_RELAY_CODE.get(code);
        assert(value !== undefined,
            `Comanche055: V05N09 relay ${relay} ${contact} contact has non-octal code 0o${code.toString(8).padStart(2, '0')}`);
        return value;
    };
    const rows = [
        [digit(8, 'D'), digit(7, 'C'), digit(7, 'D'), digit(6, 'C'), digit(6, 'D')],
        [digit(5, 'C'), digit(5, 'D'), digit(4, 'C'), digit(4, 'D'), digit(3, 'C')],
        [digit(3, 'D'), digit(2, 'C'), digit(2, 'D'), digit(1, 'C'), digit(1, 'D')]
    ];
    const signRelays = [7, 6, 5, 4, 2, 1];
    const signed = signRelays.some((relay) => ((relays.get(relay) || 0) & RELAY_SIGN_BIT) !== 0);
    return {words: rows.map((row) => row.join('')), signed};
}

function proveComancheFreshStart(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    const coldStartAlarm = failRegWords(core);
    assert(coldStartAlarm[0] === COLD_START_PHASE_TABLE_ALARM
            && coldStartAlarm[1] === 0 && coldStartAlarm[2] === 0,
        `Comanche055: cold reset did not expose source-documented phase-table alarm 01107 in FAILREG: ${coldStartAlarm.map((word) => `0o${word.toString(8).padStart(5, '0')}`).join(' ')}`);

    // SLAP1 is the source-documented, pilot-commanded fresh start. It clears
    // FAILREG and initializes the phase tables before ordinary mission tests.
    sendKeys(core, [0o21, 0o03, 0o06, 0o34]);
    core.step(10000);
    const afterFreshStart = failRegWords(core);
    assert(afterFreshStart.every((word) => word === 0),
        `Comanche055: V36E fresh start did not clear FAILREG: ${afterFreshStart.map((word) => `0o${word.toString(8).padStart(5, '0')}`).join(' ')}`);
    assert(errors.length === 0, 'Comanche055: error during V36E fresh start');

    return {coldStartAlarm, afterFreshStart};
}

function enterProgram00(core, errors, channelUpdates) {
    sendKeys(core, [0o21, 0o03, 0o07, 0o34, 0o20, 0o20, 0o34]);
    assert(errors.length === 0, 'Comanche055: error while entering P00 with V37E00E');
    const relays = relayStateFromUpdates(channelUpdates);
    assert(program00Present(relays),
        `Comanche055: V37E00E did not leave relay 11 at PROG 00 (0o${PROGRAM00_LOW11.toString(8)})`);
    return relays;
}

function proveV16N65Monitor(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0,
        'peripheral setup must leave mission accounting at the true reset vector');
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    enterProgram00(core, errors, channelUpdates);
    channelUpdates.length = 0;

    sendKeys(core, [0o21, 0o01, 0o06, 0o37, 0o06, 0o05]);
    assert(errors.length === 0, 'Comanche055: error while typing V16N65');

    const enteredRelays = relayStateFromUpdates(channelUpdates);
    const verbRelay = enteredRelays.get(10);
    const nounRelay = enteredRelays.get(9);
    assert(verbRelay !== undefined && (verbRelay & 0o3777) === VERB16_LOW11,
        'Comanche055: V16 relay state is wrong');
    assert(nounRelay !== undefined && (nounRelay & 0o3777) === NOUN65_LOW11,
        'Comanche055: N65 relay state is wrong');

    channelUpdates.length = 0;
    core.keyPress(0o34);

    let responseSteps = 0;
    let eventIndex = 0;
    let numericResponse = false;
    let operatorErrorObserved = false;
    const responseRelays = new Set();
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && !numericResponse && !operatorErrorObserved) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY_DISCRETES && (value & OPR_ERR_BIT) !== 0) {
                operatorErrorObserved = true;
            }
            if (channel !== CHANNEL_DSKY) continue;
            const relay = (value >> 11) & 0o17;
            if (relay >= 1 && relay <= 8) {
                responseRelays.add(relay);
                numericResponse = true;
            }
        }
    }

    assert(errors.length === 0, 'Comanche055: error while executing V16N65E');
    assert(!operatorErrorObserved, 'Comanche055: V16N65E asserted OPR ERR');
    assert(numericResponse,
        `Comanche055: V16N65E produced no numeric response within ${maxResponseSteps} steps`);

    return {
        responseSteps,
        verbRelay: verbRelay & 0o3777,
        nounRelay: nounRelay & 0o3777,
        responseRelays: Array.from(responseRelays).sort((a, b) => a - b)
    };
}

function proveV06N65DecimalDisplay(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0,
        'V06N65 setup must leave mission accounting at the true reset vector');
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    enterProgram00(core, errors, channelUpdates);
    channelUpdates.length = 0;
    // Comanche055 V06 is a one-shot decimal display. N65 is the sampled
    // three-component AGC clock (hours, minutes, seconds), fetched by interrupt.
    sendKeys(core, [0o21, 0o20, 0o06, 0o37, 0o06, 0o05]);
    assert(errors.length === 0, 'Comanche055: error while typing V06N65');

    const enteredRelays = relayStateFromUpdates(channelUpdates);
    const verbRelay = enteredRelays.get(10);
    const nounRelay = enteredRelays.get(9);
    assert(verbRelay !== undefined && (verbRelay & 0o3777) === VERB06_LOW11,
        'Comanche055: V06 relay state is wrong');
    assert(nounRelay !== undefined && (nounRelay & 0o3777) === NOUN65_LOW11,
        'Comanche055: N65 relay state is wrong');

    channelUpdates.length = 0;
    core.keyPress(0o34);
    const responseRows = new Set();
    let operatorErrorObserved = false;
    let eventIndex = 0;
    let responseSteps = 0;
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && responseRows.size < 8 && !operatorErrorObserved) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY_DISCRETES && (value & OPR_ERR_BIT) !== 0) {
                operatorErrorObserved = true;
            }
            if (channel !== CHANNEL_DSKY) continue;
            const relay = (value >> 11) & 0o17;
            if (relay >= 1 && relay <= 8) responseRows.add(relay);
        }
    }

    assert(errors.length === 0, 'Comanche055: error while executing V06N65E');
    assert(!operatorErrorObserved, 'Comanche055: V06N65E asserted OPR ERR');
    assert(responseRows.size === 8,
        `Comanche055: V06N65E did not display all three decimal components; rows ${Array.from(responseRows).sort((a,b)=>a-b).join(',')}`);
    return {responseSteps, responseRows: Array.from(responseRows).sort((a,b)=>a-b)};
}

function proveV05N09AlarmDisplay(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0,
        'V05N09 setup must leave mission accounting at the true reset vector');
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    const expectedFailReg = failRegWords(core);
    assert(expectedFailReg[0] === COLD_START_PHASE_TABLE_ALARM
            && expectedFailReg[1] === 0 && expectedFailReg[2] === 0,
        `Comanche055: V05N09 setup did not reproduce FAILREG 01107 00000 00000: ${expectedFailReg.map((word) => `0o${word.toString(8).padStart(5, '0')}`).join(' ')}`);

    enterProgram00(core, errors, channelUpdates);
    channelUpdates.length = 0;
    // Comanche055 documents V05 as a three-component octal display and N09
    // as the read-only alarm-code noun (FAILREG).
    sendKeys(core, [0o21, 0o20, 0o05, 0o37, 0o20, 0o11]);
    assert(errors.length === 0, 'Comanche055: error while typing V05N09');

    const enteredRelays = relayStateFromUpdates(channelUpdates);
    const verbRelay = enteredRelays.get(10);
    const nounRelay = enteredRelays.get(9);
    assert(verbRelay !== undefined && (verbRelay & 0o3777) === ((0o25 << 5) | 0o36),
        `Comanche055: V05 relay state is wrong: ${verbRelay === undefined ? 'missing' : `0o${(verbRelay & 0o3777).toString(8)}`}`);
    assert(nounRelay !== undefined && (nounRelay & 0o3777) === ((0o25 << 5) | 0o37),
        `Comanche055: N09 relay state is wrong: ${nounRelay === undefined ? 'missing' : `0o${(nounRelay & 0o3777).toString(8)}`}`);

    channelUpdates.length = 0;
    keyAndRun(core, 0o34);
    const responseRows = new Set();
    let operatorErrorObserved = false;
    let eventIndex = 0;
    let responseSteps = 12000;
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && responseRows.size < 8 && !operatorErrorObserved) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY_DISCRETES && (value & OPR_ERR_BIT) !== 0) {
                operatorErrorObserved = true;
            }
            if (channel !== CHANNEL_DSKY) continue;
            const relay = (value >> 11) & 0o17;
            if (relay >= 1 && relay <= 8) responseRows.add(relay);
        }
    }

    assert(errors.length === 0, 'Comanche055: error while executing V05N09E');
    assert(!operatorErrorObserved, 'Comanche055: V05N09E asserted OPR ERR');
    assert(responseRows.size === 8,
        `Comanche055: V05N09E did not display all three octal components; rows ${Array.from(responseRows).sort((a,b)=>a-b).join(',')}`);
    const responseRelays = relayStateFromUpdates(channelUpdates);
    const displayedFailReg = decodeOctalNoun09(responseRelays);
    const expectedDisplay = expectedFailReg.map((word) => word.toString(8).padStart(5, '0'));
    assert(!displayedFailReg.signed,
        'Comanche055: V05N09 displayed a sign on its octal FAILREG words');
    assert(JSON.stringify(displayedFailReg.words) === JSON.stringify(expectedDisplay),
        `Comanche055: V05N09 display did not match raw FAILREG: displayed ${displayedFailReg.words.join(' ')}; erasable ${expectedDisplay.join(' ')}`);
    return {responseSteps, responseRows: Array.from(responseRows).sort((a,b)=>a-b), displayedFailReg: displayedFailReg.words};
}

function proveV14N09TwoComponentMonitor(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0,
        'V14N09 setup must leave mission accounting at the true reset vector');
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    enterProgram00(core, errors, channelUpdates);
    channelUpdates.length = 0;
    // Comanche055 defines V14 as monitoring components 1 and 2 in R1/R2;
    // N09 is a three-component, octal-only noun. This checks the component
    // count boundary without loading or changing erasable data.
    sendKeys(core, [0o21, 0o01, 0o04, 0o37, 0o20, 0o11]);
    assert(errors.length === 0, 'Comanche055: error while typing V14N09');

    const enteredRelays = relayStateFromUpdates(channelUpdates);
    const verbRelay = enteredRelays.get(10);
    const nounRelay = enteredRelays.get(9);
    assert(verbRelay !== undefined && (verbRelay & 0o3777) === 0o0157,
        `Comanche055: V14 relay state is wrong: ${verbRelay === undefined ? 'missing' : `0o${(verbRelay & 0o3777).toString(8)}`}`);
    assert(nounRelay !== undefined && (nounRelay & 0o3777) === ((0o25 << 5) | 0o37),
        'Comanche055: N09 relay state is wrong');

    channelUpdates.length = 0;
    core.keyPress(0o34);
    const responseRows = new Set();
    let operatorErrorObserved = false;
    let eventIndex = 0;
    let responseSteps = 0;
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && responseRows.size < 6 && !operatorErrorObserved) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY_DISCRETES && (value & OPR_ERR_BIT) !== 0) {
                operatorErrorObserved = true;
            }
            if (channel !== CHANNEL_DSKY) continue;
            const relay = (value >> 11) & 0o17;
            if (relay >= 1 && relay <= 8) responseRows.add(relay);
        }
    }

    assert(errors.length === 0, 'Comanche055: error while executing V14N09E');
    assert(!operatorErrorObserved, 'Comanche055: V14N09E asserted OPR ERR');
    assert(responseRows.size === 6
        && [3, 4, 5, 6, 7, 8].every((relay) => responseRows.has(relay)),
    `Comanche055: V14N09E did not monitor exactly components 1 and 2 in R1/R2; relays ${Array.from(responseRows).sort((a,b)=>a-b).join(',')}`);
    return {responseSteps, responseRows: Array.from(responseRows).sort((a,b)=>a-b)};
}

function proveV35LightTest(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0,
        'V35 setup must leave mission accounting at the true reset vector');
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    const p00Relays = enterProgram00(core, errors, channelUpdates);
    sendKeys(core, [0o21, 0o03, 0o05]);
    channelUpdates.length = 0;
    core.keyPress(0o34);

    const relays = new Map();
    let eventIndex = 0;
    let responseSteps = 0;
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && !completeV35RelayState(relays)) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY) updateRelayState(relays, value);
        }
    }

    assert(errors.length === 0, 'Comanche055: error while executing real V35E');
    assert(lightTestNumericsPresent(relays), 'Comanche055: V35E did not produce all numeric 8s');
    assert(lightTestSignsPresent(relays), 'Comanche055: V35E did not assert all plus signs');
    assert(relays.has(12) && (relays.get(12) & 0o3777) === COMANCHE_V35_RELAY12_LOW11,
        `Comanche055: V35E relay 12 is not 0o${COMANCHE_V35_RELAY12_LOW11.toString(8)}`);

    return {
        responseSteps,
        p00Relay11: p00Relays.get(11) & 0o3777,
        relay12: relays.get(12) & 0o3777
    };
}

function proveComancheNavigationKeyInterrupt(core, errors) {
    core.reset();
    core.configureInputMasks();
    errors.length = 0;
    core.step(100000);

    const ERASABLE_TO_INTERRUPT_REQUESTS = 92196;
    const KEYRUPT1_REQUEST = 5;
    const KEYRUPT2_REQUEST = 6;
    const base = core.exports.get_erasable_ptr() >>> 0;
    const requests = new Uint8Array(core.memory.buffer, base + ERASABLE_TO_INTERRUPT_REQUESTS);

    assert(core.navKeyPress(0o40), 'Comanche055: real MARK navigation key was rejected');
    assert(core.inputChannelBits(0o16, 0o177) === 0o40,
        'Comanche055: MARK did not reach NAVKEYIN on channel 016');
    const input = core.inputChannelBits(0o16, 0o177);
    assert(requests[KEYRUPT1_REQUEST] === 0,
        'Comanche055: MARK incorrectly asserted the normal DSKY KEYRUPT1 request');
    assert(requests[KEYRUPT2_REQUEST] === 1,
        'Comanche055: MARK did not assert the real WASM KEYRUPT2 request');

    core.step(1);
    assert(requests[KEYRUPT2_REQUEST] === 1,
        'Comanche055: KEYRUPT2 was not retained through the first MCT after NAVKEYIN delivery');
    core.step(1);
    assert(requests[KEYRUPT2_REQUEST] === 0,
        'Comanche055: the real yaAGC CPU did not consume KEYRUPT2');
    assert(errors.length === 0, 'Comanche055: error while executing real MARK KEYRUPT2');

    return {input, consumed: true};
}

function proveComancheFastOpticsInputs(core, errors) {
    core.reset();
    core.configureInputMasks();
    core.step(1000);
    errors.length = 0;

    // The sextant's tap-to-mark path sends both optical CDU channels before
    // MARK. Exercise the same fast PCDU sequence used by phone-motion optics
    // against the real Comanche rope, then require channel 016/KEYRUPT2 to
    // follow those queued counter packets.
    const base = core.exports.get_erasable_ptr() >>> 1;
    const erasable = new Uint16Array(core.memory.buffer);
    const shaftBefore = erasable[base + 0o36];
    const trunnionBefore = erasable[base + 0o35];
    for (let i = 0; i < 12; i++) {
        assert(core.writeIo(0o236, 0o21) > 0,
            'Comanche055: fast PCDU shaft packet was rejected');
        assert(core.writeIo(0o235, 0o23) > 0,
            'Comanche055: fast MCDU trunnion packet was rejected');
    }

    assert(core.navKeyPress(0o40),
        'Comanche055: MARK after fast optical CDU packets was rejected');
    assert(erasable[base + 0o36] === shaftBefore + 12,
        'Comanche055: MARK was asserted before the queued shaft CDU counts reached the rope');
    assert((erasable[base + 0o35] & 0o77777) === ((trunnionBefore - 12) & 0o77777),
        'Comanche055: MARK was asserted before the queued trunnion CDU counts reached the rope');
    assert(core.inputChannelBits(0o16, 0o177) === 0o40,
        'Comanche055: MARK after optical CDU input did not reach NAVKEYIN');
    assert(core.navKeyRelease(),
        'Comanche055: MARK after optical CDU input did not release');
    core.step(1000);
    assert(errors.length === 0,
        'Comanche055: real optical CDU/MARK path reported an error');
    const trunnionAfter = erasable[base + 0o35] & 0o77777;
    const trunnionDelta = ((trunnionAfter - (trunnionBefore & 0o77777)) & 0o77777);
    return {shaft:erasable[base + 0o36] - shaftBefore,
        trunnion:trunnionDelta >= 0o40000 ? trunnionDelta - 0o100000 : trunnionDelta};
}

function proveProLevelSurvivesInputBackpressure(core) {
    core.reset();
    core.configureInputMasks();
    core.step(1000);

    // PIPA counter inputs use yaAGC's one-increment-per-MCT queue path and
    // can saturate the real 1024-entry ring. Fill it through the production
    // wrapper instead of substituting a mock packet_write implementation.
    let queued = 0;
    let result = 1;
    while (queued < 5000 && result > 0) {
        result = core.writeIo(0o237, 1);
        if (result > 0) queued++;
    }
    assert(queued > 0 && queued < 5000 && result === 0,
        'Comanche055: expected the real input ring to reject a packet when full');

    core.step(1);
    assert(core.proceedKey(true) > 0,
        'Comanche055: PRO press was rejected after freeing one input-ring slot');
    const stepsBeforeRelease = core.totalSteps;
    assert(core.proceedKey(false) > 0,
        'Comanche055: PRO release was lost under real input-ring backpressure');
    assert(core.totalSteps === stepsBeforeRelease + 1,
        'Comanche055: full-ring PRO retry must advance exactly one accounted MCT');

    core.step(queued + 32);
    assert(core.inputChannelBits(0o32, 0o20000) === 0o20000,
        'Comanche055: PRO must return to released-high after the saturated queue drains');

    core.reset();
    core.configureInputMasks();
    return queued;
}

function proveNormalKeySurvivesInputBackpressure(core) {
    core.reset();
    core.configureInputMasks();
    core.step(1000);

    let queued = 0;
    let result = 1;
    while (queued < 5000 && result > 0) {
        result = core.writeIo(0o237, 1);
        if (result > 0) queued++;
    }
    assert(queued > 0 && queued < 5000 && result === 0,
        'Comanche055: expected the real input ring to reject a packet when full for key test');

    const stepsBeforeMake = core.totalSteps;
    assert(core.keyPress(0o21) > 0,
        'Comanche055: channel-015 key make was lost after a full-ring response');
    assert(core.totalSteps === stepsBeforeMake + 1,
        'Comanche055: full-ring key make retry must advance exactly one accounted MCT');
    assert(core.inputChannelBits(0o15, 0o37) !== 0o21,
        'Comanche055: saturated-queue key make should still be queued, not applied early');

    assert(core.keyRelease() === true,
        'Comanche055: immediate KEYRST failed while a channel-015 make remained queued');
    assert(core.pendingNormalKeyCode === 0o21 && core.pendingNormalKeyRelease,
        'Comanche055: KEYRST must defer while the accepted key make remains queued');

    core.step(queued + 32);
    assert(core.inputChannelBits(0o15, 0o37) === 0,
        'Comanche055: deferred KEYRST must prevent a late queued key from sticking');
    assert(core.pendingNormalKeyCode === 0 && !core.pendingNormalKeyRelease,
        'Comanche055: delivered key make and deferred KEYRST must clear pending state');

    core.reset();
    core.configureInputMasks();
    return queued;
}

function proveNavigationKeyOrderingSurvivesBackpressure(core) {
    core.reset();
    core.configureInputMasks();
    core.step(100000);

    let queued = 0;
    let result = 1;
    while (queued < 5000 && result > 0) {
        result = core.writeIo(0o237, 1);
        if (result > 0) queued++;
    }
    assert(queued === 1023 && result === 0,
        'Comanche055: expected the real input ring to fill before navigation key test');

    const ERASABLE_TO_INTERRUPT_REQUESTS = 92196;
    const base = core.exports.get_erasable_ptr() >>> 0;
    const requests = new Uint8Array(core.memory.buffer, base + ERASABLE_TO_INTERRUPT_REQUESTS);
    const pressStart = core.totalSteps;
    assert(core.navKeyPress(0o40) === true,
        'Comanche055: MARK was rejected with one ring slot available');
    const pressSteps = core.totalSteps - pressStart;
    assert(pressSteps > 1,
        'Comanche055: navigation press returned before earlier queued PIPA inputs were consumed');
    assert(core.inputChannelBits(0o16, 0o177) === 0o40,
        'Comanche055: KEYRUPT2 was not preceded by delivered MARK data on NAVKEYIN');
    assert(requests[6] === 1,
        'Comanche055: ordered MARK make did not assert KEYRUPT2');

    queued = 0;
    result = 1;
    while (queued < 5000 && result > 0) {
        result = core.writeIo(0o237, 1);
        if (result > 0) queued++;
    }
    assert(queued === 1023 && result === 0,
        'Comanche055: expected the real input ring to fill before navigation release test');
    const releaseStart = core.totalSteps;
    assert(core.navKeyRelease() === true,
        'Comanche055: MARK release was lost under real input-ring backpressure');
    assert(core.totalSteps - releaseStart > 1,
        'Comanche055: navigation release returned before NAVKEYIN was cleared');
    assert(core.inputChannelBits(0o16, 0o177) === 0,
        'Comanche055: channel 016 remained asserted after ordered MARK release');
    assert(core.pendingNavigationKeyCode === 0,
        'Comanche055: navigation key bookkeeping remained held after release');
    const releaseSteps = core.totalSteps - releaseStart;

    core.reset();
    core.configureInputMasks();
    return {queued, pressSteps, releaseSteps};
}

async function main() {
    const wasmBytes = requireFile(WASM, 27270);
    const ropeBytes = requireFile(ROPE, 73728);
    verifyBinaryImportContract(wasmBytes);

    const context = makeContext(new Map([
        ['yaAGC.wasm', wasmBytes],
        [ROPE_NAME, ropeBytes]
    ]));
    const errors = [];
    const channelUpdates = [];
    const core = new context.AgcCore({
        onError(error) { errors.push(error); },
        onChannelUpdate(channel, value) { channelUpdates.push([channel, value]); }
    });

    await core.load({ropeUrl:ROPE_NAME});
    assert(errors.length === 0, 'Comanche055: error during real WASM load');
    assert(core.instance && core.exports && core.memory,
        'Comanche055: real WASM instance did not initialize completely');
    assert(core.exports.get_cm_mode() === 1,
        'Comanche055: real yaAGC did not report Command Module peripheral mode');
    assert(core.exports.configure_cm_mode() === -1 && core.exports.get_cm_mode() === 1,
        'Comanche055: core allowed CM-mode reconfiguration after CPU startup');
    assert(core.totalSteps === 0,
        'Comanche055: load must begin mission accounting at the true reset vector');

    const version = core.version();
    assert(typeof version === 'string' && version.length > 0,
        'Comanche055: yaAGC version export returned no usable string');

    const freshStart = proveComancheFreshStart(core, errors, channelUpdates);
    const v16n65 = proveV16N65Monitor(core, errors, channelUpdates);
    const v06n65 = proveV06N65DecimalDisplay(core, errors, channelUpdates);
    const v05n09 = proveV05N09AlarmDisplay(core, errors, channelUpdates);
    const v14n09 = proveV14N09TwoComponentMonitor(core, errors, channelUpdates);
    const v35 = proveV35LightTest(core, errors, channelUpdates);
    const mark = proveComancheNavigationKeyInterrupt(core, errors);
    const optics = proveComancheFastOpticsInputs(core, errors);

    core.reset();
    core.configureInputMasks();
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(2000);
    core.keyPress(0o21);
    core.step(1000);
    const proMask = 0o20000;
    assert(core.inputChannelBits(0o32, proMask) === proMask,
        'Comanche055: PRO channel 032 bit 020000 must be released before the hold');
    core.proceedKey(true);
    core.step(1);
    assert(core.inputChannelBits(0o32, proMask) === 0,
        'Comanche055: held PRO must clear input channel 032 bit 020000');
    core.step(249);
    core.proceedKey(false);
    core.step(1);
    assert(core.inputChannelBits(0o32, proMask) === proMask,
        'Comanche055: released PRO must restore input channel 032 bit 020000');
    core.step(249);
    assert(errors.length === 0, 'Comanche055: real DSKY I/O path reported an error');
    assert(core.totalSteps === 3500,
        `Comanche055: unexpected real execution step count ${core.totalSteps}`);
    const backpressurePackets = proveProLevelSurvivesInputBackpressure(core);
    assert(errors.length === 0, 'Comanche055: error during real PRO backpressure test');
    const normalKeyBackpressurePackets = proveNormalKeySurvivesInputBackpressure(core);
    assert(errors.length === 0, 'Comanche055: error during normal-key backpressure test');
    const navigationBackpressure = proveNavigationKeyOrderingSurvivesBackpressure(core);
    assert(errors.length === 0, 'Comanche055: error during navigation-key backpressure test');

    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0,
        'Comanche055: reset + peripheral setup must return to true-reset mission accounting');

    console.log(`real yaAGC ${ROPE_NAME}: PASS (${version})`);
    console.log(`  V36E cold-start recovery: PASS (FAILREG ${freshStart.coldStartAlarm.map((word) => word.toString(8).padStart(5, '0')).join(' ')} -> ${freshStart.afterFreshStart.map((word) => word.toString(8).padStart(5, '0')).join(' ')})`);
    console.log(`  V16N65E monitor: PASS (V=0o${v16n65.verbRelay.toString(8).padStart(4, '0')}; N=0o${v16n65.nounRelay.toString(8).padStart(4, '0')}; selectors ${v16n65.responseRelays.join(',')}; within ${v16n65.responseSteps} steps)`);
    console.log(`  V06N65E three-component decimal display: PASS (selectors ${v06n65.responseRows.join(',')}; within ${v06n65.responseSteps} steps)`);
    console.log(`  V05N09E alarm-code display: PASS (${v05n09.displayedFailReg.join(' ')}; selectors ${v05n09.responseRows.join(',')}; within ${v05n09.responseSteps} steps)`);
    console.log(`  V14N09E two-component monitor: PASS (selectors ${v14n09.responseRows.join(',')}; within ${v14n09.responseSteps} steps)`);
    console.log(`  P00 precondition relay 11: 0o${v35.p00Relay11.toString(8).padStart(4, '0')}`);
    console.log(`  V35E relay 12 low-11: 0o${v35.relay12.toString(8).padStart(4, '0')} within ${v35.responseSteps} steps`);
    console.log(`  MARK channel 016 / KEYRUPT2: PASS (NAVKEYIN 0o${mark.input.toString(8)}; real request consumed)`);
    console.log(`  optical CDU PCDU/MCDU fast -> MARK: PASS (shaft +${optics.shaft}; trunnion ${optics.trunnion} before NAVKEYIN)`);
    console.log('  PRO contact: PASS (real Comanche055 observes channel 032 bit 020000 held low and released high)');
    console.log(`  PRO input backpressure: PASS (${backpressurePackets} real queued PIPA increments; release retried after one MCT)`);
    console.log(`  normal-key input backpressure: PASS (${normalKeyBackpressurePackets} real queued PIPA increments; deferred KEYRST prevented a late stuck key)`);
    console.log(`  navigation-key backpressure: PASS (${navigationBackpressure.queued} real queued PIPA increments; MARK wait=${navigationBackpressure.pressSteps} MCTs; release wait=${navigationBackpressure.releaseSteps} MCTs)`);
    console.log('real yaAGC WASM runtime smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
