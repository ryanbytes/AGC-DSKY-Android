#!/usr/bin/env node
'use strict';

/*
 * Execute the real pinned yaAGC WebAssembly binary under Node using the same
 * agc-core.js wrapper loaded by Android. The current app is CM-only, so this
 * smoke exercises Comanche 055 only.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const CORE_JS = path.join(ROOT, 'app/src/main/assets/agc-core.js');
const WASM = path.join(ROOT, 'vendor/webAGC/src/yaAGC.wasm');
const ROPE_NAME = 'Comanche055.bin';
const ROPE = path.join(ROOT, 'vendor/webAGC/demo/agc/Comanche055.bin');

const CHANNEL_DSKY = 0o10;
const CHANNEL_DSKY_DISCRETES = 0o163;
const OPR_ERR_BIT = 0o100;
const RELAY_ZERO = 0o25;
const RELAY_EIGHT = 0o35;
const RELAY_SIGN_BIT = 0o2000;
const PROGRAM00_LOW11 = (RELAY_ZERO << 5) | RELAY_ZERO;
const VERB16_LOW11 = (0o03 << 5) | 0o34;
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
        'wasi_snapshot_preview1.fd_close:function',
        'wasi_snapshot_preview1.fd_fdstat_get:function',
        'wasi_snapshot_preview1.fd_seek:function',
        'wasi_snapshot_preview1.fd_write:function'
    ].sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected),
        `unexpected yaAGC WASM imports:\n  actual: ${actual.join(', ')}\n  expected: ${expected.join(', ')}`);

    const exported = new Set(WebAssembly.Module.exports(module).map((entry) => entry.name));
    for (const name of ['malloc', 'free', 'set_fixed', 'cpu_reset', 'cpu_step', 'packet_write', 'packet_read']) {
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

function completeV35RelayState(relays) {
    const relay12 = relays.get(12);
    return lightTestNumericsPresent(relays)
        && lightTestSignsPresent(relays)
        && relay12 !== undefined
        && (relay12 & 0o3777) === COMANCHE_V35_RELAY12_LOW11;
}

function keyAndRun(core, keyCode, steps = 12000) {
    core.keyPress(keyCode);
    core.step(steps);
}

function sendKeys(core, keyCodes, steps = 12000) {
    for (const keyCode of keyCodes) keyAndRun(core, keyCode, steps);
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
    assert(core.totalSteps === 1, 'peripheral setup must account for one initialization step');
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

function proveV35LightTest(core, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 1, 'V35 setup must account for one initialization step');
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

async function main() {
    const wasmBytes = requireFile(WASM, 132617);
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

    await core.load();
    assert(errors.length === 0, 'Comanche055: error during real WASM load');
    assert(core.instance && core.exports && core.memory,
        'Comanche055: real WASM instance did not initialize completely');
    assert(core.totalSteps === 1,
        'Comanche055: load must leave one accounted ring-buffer initialization step');

    const version = core.version();
    assert(typeof version === 'string' && version.length > 0,
        'Comanche055: yaAGC version export returned no usable string');

    const v16n65 = proveV16N65Monitor(core, errors, channelUpdates);
    const v35 = proveV35LightTest(core, errors, channelUpdates);

    core.reset();
    core.configureInputMasks();
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(2000);
    core.keyPress(0o21);
    core.step(1000);
    core.proceedKey(true);
    core.step(250);
    core.proceedKey(false);
    core.step(250);
    assert(errors.length === 0, 'Comanche055: real DSKY I/O path reported an error');
    assert(core.totalSteps === 3501,
        `Comanche055: unexpected real execution step count ${core.totalSteps}`);

    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 1,
        'Comanche055: reset + peripheral setup must leave one initialization step');

    console.log(`real yaAGC ${ROPE_NAME}: PASS (${version})`);
    console.log(`  V16N65E monitor: PASS (V=0o${v16n65.verbRelay.toString(8).padStart(4, '0')}; N=0o${v16n65.nounRelay.toString(8).padStart(4, '0')}; selectors ${v16n65.responseRelays.join(',')}; within ${v16n65.responseSteps} steps)`);
    console.log(`  P00 precondition relay 11: 0o${v35.p00Relay11.toString(8).padStart(4, '0')}`);
    console.log(`  V35E relay 12 low-11: 0o${v35.relay12.toString(8).padStart(4, '0')} within ${v35.responseSteps} steps`);
    console.log('real yaAGC WASM runtime smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
