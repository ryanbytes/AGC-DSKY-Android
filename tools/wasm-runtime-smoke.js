#!/usr/bin/env node
'use strict';

/*
 * Execute the real pinned yaAGC WebAssembly binary under Node using the same
 * app/src/main/assets/agc-core.js wrapper that Android WebView will load.
 *
 * This is still not an Android/WebView test, but unlike agc-core-smoke.js it
 * proves the checked-out WASM import contract, real instantiation, rope copy,
 * reset/I-O initialization, packet I/O, short CPU execution paths, and a real
 * Pinball semantic response (V35E DSKY light test) from each pinned rope.
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
const RELAY_EIGHT = 0o35;

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

function pairIsEight(value) {
    return ((value >> 5) & 0o37) === RELAY_EIGHT
        && (value & 0o37) === RELAY_EIGHT;
}

function lightTestNumericsPresent(relays) {
    // V35 lights every numerical DSKY position. Relay 8 only carries R1D1 in
    // its right-hand digit field; the remaining numerical relay words carry
    // two digits each. Requiring every selector 1..11 prevents a partial or
    // synthetic-looking output burst from counting as the Pinball response.
    for (const relay of [11, 10, 9, 7, 6, 5, 4, 3, 2, 1]) {
        const value = relays.get(relay);
        if (value === undefined || !pairIsEight(value)) return false;
    }
    const relay8 = relays.get(8);
    return relay8 !== undefined && (relay8 & 0o37) === RELAY_EIGHT;
}

function keyAndRun(core, keyCode, steps = 12000) {
    core.keyPress(keyCode);
    core.step(steps);
}

function proveV35LightTest(core, ropeName, errors, channelUpdates) {
    // Let the freshly reset flight program settle before invoking the P00 DSKY
    // light test. At the AGC's ~11.72 us instruction cadence this is a little
    // over one second of simulated execution without wall-clock waiting.
    core.step(100000);

    // Authentic Pinball codes: VERB=021, digits 3/5, ENTER=034.
    keyAndRun(core, 0o21);
    keyAndRun(core, 0o03);
    keyAndRun(core, 0o05);

    // Ignore startup and key-entry display traffic. Semantic proof starts with
    // the ENTER that asks the actual rope software to execute Verb 35.
    channelUpdates.length = 0;
    core.keyPress(0o34);

    const relays = new Map();
    let eventIndex = 0;
    let responseSteps = 0;
    const maxResponseSteps = 350000;
    const chunkSteps = 10000;

    while (responseSteps < maxResponseSteps && !lightTestNumericsPresent(relays)) {
        core.step(chunkSteps);
        responseSteps += chunkSteps;
        for (; eventIndex < channelUpdates.length; eventIndex++) {
            const [channel, value] = channelUpdates[eventIndex];
            if (channel === CHANNEL_DSKY) updateRelayState(relays, value);
        }
    }

    assert(errors.length === 0, `${ropeName}: error while executing real V35E`);
    assert(lightTestNumericsPresent(relays),
        `${ropeName}: V35E did not produce the complete all-8 DSKY numerical light-test pattern `
        + `within ${maxResponseSteps} AGC steps`);

    return { responseSteps, channelUpdates: channelUpdates.length };
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

    // Execute enough real AGC cycles to process the queued U-bit masks and
    // exercise ordinary output production/draining without starting a timer.
    core.step(2000);
    assert(errors.length === 0, `${ropeName}: error during initial CPU execution`);

    const v35 = proveV35LightTest(core, ropeName, errors, channelUpdates);

    // Reset after the semantic test so the generic I/O smoke below still starts
    // from a clean mission state and retains its exact step-count assertion.
    core.reset();
    core.configureInputMasks();
    channelUpdates.length = 0;
    errors.length = 0;

    core.step(2000);

    // Exercise the two DSKY input paths against the actual packet/ring-buffer
    // implementation. Pinball key 021 is VERB; PRO is channel 032 bit 020000.
    core.keyPress(0o21);
    core.step(1000);
    core.proceedKey(true);
    core.step(250);
    core.proceedKey(false);
    core.step(250);

    assert(errors.length === 0, `${ropeName}: real DSKY I/O path reported an error`);
    assert(core.totalSteps === 3500,
        `${ropeName}: unexpected real execution step count ${core.totalSteps}`);

    // A second reset repeats the real lazy-I/O-safe reset path and must return
    // the wrapper's mission step accounting to zero without throwing.
    core.reset();
    core.configureInputMasks();
    assert(core.totalSteps === 0, `${ropeName}: reset did not clear mission step count`);

    return {
        instance: core.instance,
        memory: core.memory,
        version,
        channelUpdates: channelUpdates.length,
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
        console.log(`  V35E semantic light test: PASS (${result.v35.channelUpdates} channel updates; response within ${result.v35.responseSteps} steps)`);
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
