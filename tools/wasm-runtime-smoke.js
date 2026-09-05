#!/usr/bin/env node
'use strict';

/*
 * Execute the real pinned yaAGC WebAssembly binary under Node using the same
 * app/src/main/assets/agc-core.js wrapper that Android WebView will load.
 *
 * This is still not an Android/WebView test, but unlike agc-core-smoke.js it
 * proves the checked-out WASM import contract, real instantiation, rope copy,
 * reset/I-O initialization, packet I/O, a representative non-V35 Pinball
 * monitor command (V16N65E), and the real V35E DSKY light test for each pinned
 * rope.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const CORE_JS = path.join(ROOT, 'app/src/main/assets/agc-core.js');
const WASM = path.join(ROOT, 'vendor/webAGC/src/yaAGC.wasm');
const ROPES = [
    ['Luminary099.bin', path.join(ROOT, 'vendor/webAGC/demo/agc/Luminary099.bin')],
    ['Comanche055.bin', path.join(ROOT, 'vendor/webAGC/demo/agc/Comanche055.bin')]
];

const CHANNEL_DSKY = 0o10;
const CHANNEL_DSKY_DISCRETES = 0o163;
const OPR_ERR_BIT = 0o100;
const RELAY_ZERO = 0o25;
const RELAY_EIGHT = 0o35;
const RELAY_SIGN_BIT = 0o2000;
const PROGRAM00_LOW11 = (RELAY_ZERO << 5) | RELAY_ZERO;
const VERB16_LOW11 = (0o03 << 5) | 0o34;
const NOUN65_LOW11 = (0o34 << 5) | 0o36;
const V35_RELAY12_LOW11 = Object.freeze({
    'Luminary099.bin': 0o674,
    'Comanche055.bin': 0o650
});

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
        `unexpected yaAGC WASM imports:\n  actual: ${actual.join(', ')}\n`
        + `  expected: ${expected.join(', ')}`);

    const exported = new Set(WebAssembly.Module.exports(module).map((entry) => entry.name));
    for (const name of [
        'malloc', 'free', 'set_fixed', 'cpu_reset', 'cpu_step',
        'packet_write', 'packet_read'
    ]) {
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
        DataView,
        ArrayBuffer,
        WebAssembly,
        performance,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        fetch: async (url) => {
            const key = String(url);
            const data = filesByUrl.get(key);
            return {
                ok: !!data,
                status: data ? 200 : 404,
                async arrayBuffer() {
                    if (!data) return new ArrayBuffer(0);
                    return arrayBufferFromBuffer(data);
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
    return ((value >> 5) & 0o37) === RELAY_EIGHT
        && (value & 0o37) === RELAY_EIGHT;
}

function lightTestNumericsPresent(relays) {
    // Both Apollo-11 ropes use FULLDSP=05675 / FULLDSP1=07675. Thus V35
    // drives both five-relay character banks to code 035 on selectors 1..11,
    // including selector 8's visually unused C bank.
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

function missionRelay12Present(relays, ropeName) {
    const expected = V35_RELAY12_LOW11[ropeName];
    const relay12 = relays.get(12);
    return expected !== undefined
        && relay12 !== undefined
        && (relay12 & 0o3777) === expected;
}

function completeV35RelayState(relays, ropeName) {
    return lightTestNumericsPresent(relays)
        && lightTestSignsPresent(relays)
        && missionRelay12Present(relays, ropeName);
}

function keyAndRun(core, keyCode, steps = 12000) {
    core.keyPress(keyCode);
    core.step(steps);
}

function sendKeys(core, keyCodes, steps = 12000) {
    for (const keyCode of keyCodes) keyAndRun(core, keyCode, steps);
}

function enterProgram00(core, ropeName, errors, channelUpdates) {
    sendKeys(core, [0o21, 0o03, 0o07, 0o34, 0o20, 0o20, 0o34]);
    assert(errors.length === 0, `${ropeName}: error while entering P00 with V37E00E`);
    const relays = relayStateFromUpdates(channelUpdates);
    assert(program00Present(relays),
        `${ropeName}: V37E00E did not leave channel-010 relay 11 at PROG 00 (low-11 0o${PROGRAM00_LOW11.toString(8)})`);
    return relays;
}

function proveV16N65Monitor(core, ropeName, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    enterProgram00(core, ropeName, errors, channelUpdates);
    channelUpdates.length = 0;

    // VirtualAGC's own DSKY automation uses V16N65E as a representative
    // non-V35 monitor command. Enter every key except final ENTER first so the
    // typed VERB/NOUN relay state can be proved separately from command output.
    sendKeys(core, [0o21, 0o01, 0o06, 0o37, 0o06, 0o05]);
    assert(errors.length === 0, `${ropeName}: error while typing V16N65`);

    const enteredRelays = relayStateFromUpdates(channelUpdates);
    const verbRelay = enteredRelays.get(10);
    const nounRelay = enteredRelays.get(9);
    assert(verbRelay !== undefined && (verbRelay & 0o3777) === VERB16_LOW11,
        `${ropeName}: V16 did not produce relay-10 low-11 0o${VERB16_LOW11.toString(8)}`);
    assert(nounRelay !== undefined && (nounRelay & 0o3777) === NOUN65_LOW11,
        `${ropeName}: N65 did not produce relay-9 low-11 0o${NOUN65_LOW11.toString(8)}`);

    // Discard the entry echo. A pass now requires the final ENTER to make the
    // AGC produce an actual numeric-register channel-010 response, rather than
    // merely proving that Pinball echoed the typed verb/noun digits.
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

    assert(errors.length === 0, `${ropeName}: error while executing V16N65E`);
    assert(!operatorErrorObserved,
        `${ropeName}: V16N65E asserted OPR ERR instead of accepting the monitor command`);
    assert(numericResponse,
        `${ropeName}: V16N65E produced no numeric-register channel-010 response within ${maxResponseSteps} AGC steps`);

    return {
        responseSteps,
        channelUpdates: channelUpdates.length,
        verbRelay: verbRelay & 0o3777,
        nounRelay: nounRelay & 0o3777,
        responseRelays: Array.from(responseRelays).sort((a, b) => a - b)
    };
}

function proveV35LightTest(core, ropeName, errors, channelUpdates) {
    core.reset();
    core.configureInputMasks();
    channelUpdates.length = 0;
    errors.length = 0;
    core.step(100000);

    // Explicitly enter P00 and prove the channel-driven program row rather than
    // treating a fixed delay/step count as evidence of the precondition.
    const p00Relays = enterProgram00(core, ropeName, errors, channelUpdates);

    // Authentic Pinball codes for V35 before final ENTER.
    sendKeys(core, [0o21, 0o03, 0o05]);
    channelUpdates.length = 0;
    core.keyPress(0o34);

    const relays = new Map();
    let eventIndex = 0;
    let responseSteps = 0;
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && !completeV35RelayState(relays, ropeName)) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY) updateRelayState(relays, value);
        }
    }

    assert(errors.length === 0, `${ropeName}: error while executing real V35E`);
    assert(lightTestNumericsPresent(relays),
        `${ropeName}: V35E did not produce FULLDSP digit-8 codes on every numeric relay row within ${maxResponseSteps} AGC steps`);
    assert(lightTestSignsPresent(relays),
        `${ropeName}: V35E did not assert the R1/R2/R3 plus-sign relay bits`);
    assert(missionRelay12Present(relays, ropeName),
        `${ropeName}: V35E relay 12 low-11 state was not exact expected 0o${V35_RELAY12_LOW11[ropeName].toString(8)}`);

    return {
        responseSteps,
        channelUpdates: channelUpdates.length,
        p00Relay11: p00Relays.get(11) & 0o3777,
        relay12: relays.get(12) & 0o3777
    };
}

async function smokeMission(context, ropeName) {
    const errors = [];
    const channelUpdates = [];
    const core = new context.AgcCore({
        onError(error) {
            errors.push(error);
        },
        onChannelUpdate(channel, value) {
            channelUpdates.push([channel, value]);
        }
    });

    await core.load({ wasmUrl: 'yaAGC.wasm', ropeUrl: ropeName });
    assert(errors.length === 0, `${ropeName}: error during real WASM load`);
    assert(core.instance && core.exports && core.memory,
        `${ropeName}: real WASM instance did not initialize completely`);

    const version = core.version();
    assert(typeof version === 'string' && version.length > 0,
        `${ropeName}: yaAGC version export returned no usable string`);

    core.step(2000);
    assert(errors.length === 0, `${ropeName}: error during initial CPU execution`);

    const v16n65 = proveV16N65Monitor(core, ropeName, errors, channelUpdates);
    const v35 = proveV35LightTest(core, ropeName, errors, channelUpdates);

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

    assert(errors.length === 0, `${ropeName}: real DSKY I/O path reported an error`);
    assert(core.totalSteps === 3500,
        `${ropeName}: unexpected real execution step count ${core.totalSteps}`);

    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0, `${ropeName}: reset did not clear mission step count`);

    return {
        instance: core.instance,
        memory: core.memory,
        version,
        channelUpdates: channelUpdates.length,
        v16n65,
        v35
    };
}

async function main() {
    const wasmBytes = requireFile(WASM, 132617);
    verifyBinaryImportContract(wasmBytes);

    const filesByUrl = new Map([['yaAGC.wasm', wasmBytes]]);
    for (const [name, file] of ROPES) {
        filesByUrl.set(name, requireFile(file, 73728));
    }

    const context = makeContext(filesByUrl);
    const runs = [];
    for (const [name] of ROPES) {
        const result = await smokeMission(context, name);
        runs.push(result);
        console.log(`real yaAGC ${name}: PASS (${result.channelUpdates} generic channel updates; ${result.version})`);
        console.log(`  V16N65E monitor: PASS (V=0o${result.v16n65.verbRelay.toString(8).padStart(4, '0')}; N=0o${result.v16n65.nounRelay.toString(8).padStart(4, '0')}; numeric response selectors ${result.v16n65.responseRelays.join(',')}; within ${result.v16n65.responseSteps} steps)`);
        console.log(`  P00 precondition relay 11: 0o${result.v35.p00Relay11.toString(8).padStart(4, '0')}`);
        console.log(`  V35E semantic relay test: PASS (${result.v35.channelUpdates} channel updates; response within ${result.v35.responseSteps} steps)`);
        console.log(`  V35E relay 12 low-11 state: 0o${result.v35.relay12.toString(8).padStart(4, '0')}`);
    }

    assert(runs.length === 2, 'expected exactly two real mission runs');
    assert(runs[0].instance !== runs[1].instance,
        'LM and CM mission loads must use distinct WebAssembly instances');
    assert(runs[0].memory !== runs[1].memory,
        'LM and CM mission loads must use distinct WebAssembly memories');

    console.log('real yaAGC WASM runtime smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
