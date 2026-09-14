#!/usr/bin/env node
'use strict';

/* Dependency-free source smoke for the current v0.38.3 agc-core.js wrapper. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CORE_JS = path.resolve(__dirname, '../app/src/main/assets/agc-core.js');
const source = fs.readFileSync(CORE_JS, 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createEnvironment(overrides = {}) {
    const context = {
        window: null,
        console,
        TextDecoder,
        Uint8Array,
        Uint16Array,
        DataView,
        ArrayBuffer,
        Math,
        WebAssembly,
        performance: { now: () => 1000 },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: () => 1,
        clearTimeout: () => {},
        btoa: (text) => Buffer.from(text, 'binary').toString('base64'),
        atob: (text) => Buffer.from(text, 'base64').toString('binary'),
        ...overrides
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'agc-core.js' });
    return context;
}

function makeCoreHarness(options = {}) {
    const calls = [];
    let packetWriteResult = options.packetWriteResult ?? 4;
    const core = new (createEnvironment(options.environment || {}).AgcCore)();
    core.memory = { buffer: new ArrayBuffer(options.memoryBytes || 200000) };
    core.exports = {
        cpu_reset() { calls.push(['reset']); },
        cpu_step(steps) { calls.push(['step', steps]); },
        packet_read() { calls.push(['read']); return 0; },
        packet_write(channel, value) { calls.push(['write', channel, value]); return packetWriteResult; },
        malloc(size) { calls.push(['malloc', size]); return 256; },
        free(ptr) { calls.push(['free', ptr]); },
        set_fixed(ptr) { calls.push(['set_fixed', ptr]); },
        get_erasable_ptr() { return 1024; }
    };
    return { core, calls, setPacketWriteResult: (v) => { packetWriteResult = v; } };
}

async function testResetAndPeripheralSetup() {
    const { core, calls, setPacketWriteResult } = makeCoreHarness();

    core.reset();
    assert(calls.filter(([name]) => name === 'reset').length === 2,
        'reset must prime the transport and then return to the true reset vector');
    assert(calls.some(([name, steps]) => name === 'step' && steps === 1),
        'reset must execute one transport-initialization CPU step');
    assert(calls.some(([name]) => name === 'read'),
        'reset must drain transient transport output before the final reset');
    assert(core.totalSteps === 0,
        'transport initialization must not count as mission execution');

    calls.length = 0;
    core.configureInputMasks();
    const writes = calls.filter(([name]) => name === 'write');
    const expected = [
        [0x100 | 0o15, 0o37],
        [0x100 | 0o32, 0o20000]
    ];
    assert(writes.length === expected.length,
        `expected ${expected.length} startup I/O writes, got ${writes.length}`);
    expected.forEach(([channel, value], i) => {
        assert(writes[i][1] === channel && writes[i][2] === value,
            `startup I/O write ${i} mismatch`);
    });
    assert(!writes.some(([, channel]) => channel === (0x100 | 0o30) || channel === 0o30),
        'startup must not synthesize an ISS OPERATE transition on channel 030');

    calls.length = 0;
    setPacketWriteResult(0);
    assert(core.writeIo(0o15, 0o21) === 0,
        'writeIo must return the raw packet_write result');
    core.keyPress(0o21);
    assert(calls.filter(([name]) => name === 'write').length === 2,
        'keyPress must forward the key packet without synthesizing an exception');

    calls.length = 0;
    setPacketWriteResult(4);
    await core.loadRope(new Uint8Array([1, 2, 3, 4]).buffer);
    assert(calls.some(([name, size]) => name === 'malloc' && size === 4),
        'loadRope must allocate the actual rope buffer length');
    assert(calls.some(([name]) => name === 'set_fixed'),
        'loadRope must call set_fixed');
    assert(calls.some(([name]) => name === 'free'),
        'loadRope must free its temporary WASM allocation');
}

function testNavigationAndSnapshots() {
    const { core, calls } = makeCoreHarness({ memoryBytes: 220000 });
    const bytes = new Uint8Array(core.memory.buffer);

    assert(core.navKeyPress(0o20) === true,
        'accepted navigation key must assert KEYRUPT2');
    assert(calls.some(([name, channel, value]) => name === 'write'
        && channel === 0o16 && value === 0o20),
        'navigation key must write channel 016');
    assert(calls.some(([name, steps]) => name === 'step' && steps === 1),
        'navigation key must process one CPU step before KEYRUPT2');
    assert(bytes[1024 + 92196 + 6] === 1,
        'navigation key must assert KEYRUPT2 request byte');

    bytes[10] = 0x12;
    bytes[11] = 0x34;
    const before = core.snapshotFingerprint();
    const snapshot = core.exportSnapshot();
    assert(snapshot.schema === 1 && snapshot.byteLength === bytes.length,
        'snapshot metadata is invalid');
    assert(snapshot.fingerprint === before,
        'snapshot fingerprint must match current memory');

    bytes[10] = 0;
    bytes[11] = 0;
    assert(core.importSnapshot(snapshot) === true,
        'snapshot import must report success');
    assert(bytes[10] === 0x12 && bytes[11] === 0x34,
        'snapshot import did not restore WASM memory');
    assert(core.snapshotFingerprint() === before,
        'snapshot round trip changed the memory fingerprint');

    const words = new Uint16Array(core.memory.buffer);
    const baseWord = 1024 >>> 1;
    words[baseWord + 2 * 0o400 + 0o123] = 0x6abc;
    assert(core.readErasable(2, 0o123) === 0x6abc,
        'readErasable returned the wrong word');
    assert(core.readErasable(8, 0) === null,
        'readErasable must reject invalid banks');
}

function testSchedulerLifecycle() {
    let now = 5000;
    let intervalCallback = null;
    let intervalMs = null;
    let intervalCreates = 0;
    const cleared = [];
    const steps = [];

    const context = createEnvironment({
        performance: { now: () => now },
        setInterval(callback, ms) {
            intervalCreates++;
            intervalCallback = callback;
            intervalMs = ms;
            return 77;
        },
        clearInterval(id) { cleared.push(id); }
    });
    const core = new context.AgcCore();
    core.exports = {
        cpu_step(count) { steps.push(count); },
        packet_read() { return 0; }
    };

    core.start(1);
    assert(core.running && core.timer === 77,
        'scheduler did not enter running state');
    assert(intervalCreates === 1 && intervalMs === 4,
        `scheduler must run the peripheral drain at 4 ms; got ${intervalMs}`);

    core.start(2);
    assert(intervalCreates === 1 && core.clockDivisor === 1,
        'start must be idempotent while already running');

    const start = core.startTime;
    now += 11.72;
    const expected = Math.floor((now - start) / (1000 / 85333));
    intervalCallback();
    assert(steps.length === 1 && steps[0] === expected,
        `scheduler executed ${JSON.stringify(steps)}; expected ${expected}`);
    assert(core.totalSteps === expected,
        'scheduler accounting does not match executed machine cycles');

    const beforeBacklog = steps.length;
    now += 2000;
    intervalCallback();
    assert(steps.length === beforeBacklog,
        'scheduler must not execute an unbounded backlog');
    assert(core.totalSteps === 0 && core.startTime === now,
        'backlog rebase did not reset relative scheduler accounting');

    core.stop();
    assert(!core.running && core.timer === 0 && cleared.includes(77),
        'stop did not clear the active scheduler');
}

async function testLoadPipeline() {
    const calls = [];
    let memory;

    class FakeMemory {
        constructor(options) {
            calls.push(['memory', options.initial]);
            this.buffer = new ArrayBuffer(options.initial * 65536);
            memory = this;
        }
    }

    const fakeExports = {
        malloc(size) { calls.push(['malloc', size]); return 1024; },
        free(ptr) { calls.push(['free', ptr]); },
        set_fixed(ptr) { calls.push(['set_fixed', ptr]); },
        cpu_reset() { calls.push(['reset']); },
        cpu_step(steps) { calls.push(['step', steps]); },
        packet_write(channel, value) { calls.push(['write', channel, value]); return 4; },
        packet_read() { calls.push(['read']); return 0; }
    };

    const fakeWebAssembly = {
        Memory: FakeMemory,
        async compile(bytes) { calls.push(['compile', bytes.byteLength]); return { fake: true }; },
        async instantiate(module, imports) {
            assert(module.fake, 'compiled module must reach instantiate');
            assert(imports.env.memory === memory, 'env.memory must use the allocated AGC memory');
            const wasi = imports.wasi_snapshot_preview1;
            for (const name of ['fd_close', 'fd_fdstat_get', 'fd_seek', 'fd_write']) {
                assert(typeof wasi[name] === 'function', `missing WASI import ${name}`);
            }
            calls.push(['instantiate']);
            return { exports: fakeExports };
        }
    };

    const fetched = [];
    const context = createEnvironment({
        WebAssembly: fakeWebAssembly,
        fetch: async (url) => {
            fetched.push(String(url));
            return {
                ok: true,
                status: 200,
                async arrayBuffer() {
                    return new ArrayBuffer(String(url).endsWith('.wasm') ? 32 : 73728);
                }
            };
        }
    });

    const core = new context.AgcCore();
    await core.load();

    assert(fetched.includes('yaAGC.wasm'),
        'default load did not fetch yaAGC.wasm');
    assert(fetched.includes('Comanche055.bin'),
        'default load did not fetch Comanche055.bin');
    assert(!fetched.includes('Luminary099.bin'),
        'CM-only default load unexpectedly fetched Luminary099.bin');
    assert(calls.filter(([name]) => name === 'reset').length === 2,
        'load must prime transport state and then restore the true AGC reset vector');
    assert(calls.filter(([name, count]) => name === 'step' && count === 1).length === 1,
        'load must initialize the ring buffer with exactly one CPU step');
    assert(calls.filter(([name]) => name === 'write').length === 2,
        'load must queue only the two DSKY input masks');
    assert(core.totalSteps === 0,
        'post-load mission accounting must begin at the true reset vector');
}

async function main() {
    await testResetAndPeripheralSetup();
    testNavigationAndSnapshots();
    testSchedulerLifecycle();
    await testLoadPipeline();
    console.log('agc-core source smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
