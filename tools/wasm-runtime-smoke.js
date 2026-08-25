#!/usr/bin/env node
'use strict';

/*
 * Execute the real pinned yaAGC WebAssembly binary under Node using the same
 * app/src/main/assets/agc-core.js wrapper that Android WebView will load.
 *
 * This is still not an Android/WebView test, but unlike agc-core-smoke.js it
 * proves the checked-out WASM import contract, real instantiation, rope copy,
 * reset/I-O initialization, packet I/O, and short CPU execution paths.
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

    // Execute enough real AGC cycles to process the queued U-bit masks and
    // exercise ordinary output production/draining without starting a timer.
    core.step(2000);
    assert(errors.length === 0, `${ropeName}: error during initial CPU execution`);

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

    return channelUpdates.length;
}

async function main() {
    const wasmBytes = requireFile(WASM, 132617);
    verifyBinaryImportContract(wasmBytes);

    const filesByUrl = new Map([['yaAGC.wasm', wasmBytes]]);
    for (const [name, file] of ROPES) {
        filesByUrl.set(name, requireFile(file, 73728));
    }

    const context = makeContext(filesByUrl);
    for (const [name] of ROPES) {
        const updates = await smokeMission(context, name);
        console.log(`real yaAGC ${name}: PASS (${updates} channel updates observed)`);
    }

    console.log('real yaAGC WASM runtime smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
