#!/usr/bin/env node
'use strict';

/*
 * Dependency-free source smoke test for app/src/main/assets/agc-core.js.
 *
 * This does not emulate the real yaAGC WebAssembly binary or prove Android/
 * WebView compatibility. It exercises wrapper invariants and the complete JS
 * load pipeline with controlled fake WebAssembly/fetch implementations.
 */

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
        DataView,
        ArrayBuffer,
        WebAssembly,
        performance: { now: () => 1234 },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: () => 1,
        clearTimeout: () => {},
        ...overrides
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'agc-core.js' });
    return context;
}

function createCore() {
    return new (createEnvironment().AgcCore)();
}

async function testWrapperInvariants() {
    const core = createCore();
    const calls = [];
    const output = [(0o10 << 16) | 0o12345, 0];
    const reportedErrors = [];
    let packetWriteResult = 4;
    core.onError = (error) => reportedErrors.push(error);

    core.exports = {
        cpu_reset() {
            calls.push(['reset']);
        },
        cpu_step(steps) {
            calls.push(['step', steps]);
        },
        packet_read() {
            calls.push(['read']);
            return output.length ? output.shift() : 0;
        },
        packet_write(channel, value) {
            calls.push(['write', channel, value]);
            return packetWriteResult;
        },
        malloc(size) {
            calls.push(['malloc', size]);
            return 64;
        },
        free(ptr) {
            calls.push(['free', ptr]);
        },
        set_fixed(ptr) {
            calls.push(['set_fixed', ptr]);
        }
    };
    core.memory = { buffer: new ArrayBuffer(73728 + 128) };

    core.reset();
    const structural = calls.filter(([name]) => name !== 'read');
    assert(structural.length === 3, 'reset should perform reset -> step(1) -> reset');
    assert(structural[0][0] === 'reset', 'first reset missing');
    assert(structural[1][0] === 'step' && structural[1][1] === 1,
        'I/O initialization must use exactly one disposable CPU step');
    assert(structural[2][0] === 'reset', 'final reset must restore the reset vector');
    assert(core.totalSteps === 0,
        'disposable initialization step must not count as mission execution');

    calls.length = 0;
    core.configureInputMasks();
    assert(calls.length === 2, 'exactly two DSKY input masks expected');
    assert(calls[0][0] === 'write' && calls[0][1] === (0x100 | 0o15)
        && calls[0][2] === 0o37, 'normal DSKY U-bit mask is wrong');
    assert(calls[1][0] === 'write' && calls[1][1] === (0x100 | 0o32)
        && calls[1][2] === 0o20000, 'PRO U-bit mask is wrong');

    packetWriteResult = 0;
    reportedErrors.length = 0;
    core.keyPress(0o21);
    assert(reportedErrors.length === 1
        && /input queue full/.test(String(reportedErrors[0])),
        'key packet_write=0 must route input queue full through onError');

    reportedErrors.length = 0;
    core.proceedPulse();
    assert(reportedErrors.length === 1
        && /input queue full/.test(String(reportedErrors[0])),
        'PRO packet_write=0 must route input queue full through onError');

    packetWriteResult = -1;
    let invalidPacketRaised = false;
    try {
        core.writeIo(0x3ff, 0xffff);
    } catch (error) {
        invalidPacketRaised = /rejected I\/O packet/.test(String(error));
    }
    assert(invalidPacketRaised,
        'direct packet_write<0 must surface an invalid packet error');
    packetWriteResult = 4;

    let rejectedShortRope = false;
    try {
        await core.loadRope(new ArrayBuffer(73727));
    } catch (error) {
        rejectedShortRope = /Invalid AGC rope size/.test(String(error));
    }
    assert(rejectedShortRope, 'short/corrupt rope must be rejected before set_fixed');

    calls.length = 0;
    await core.loadRope(new ArrayBuffer(73728));
    assert(calls.some(([name, size]) => name === 'malloc' && size === 73728),
        'valid fixed rope must allocate exactly 73728 bytes');
    assert(calls.some(([name]) => name === 'set_fixed'),
        'valid fixed rope must call set_fixed');
    assert(calls.some(([name]) => name === 'free'),
        'rope allocation must be freed');
}

function testSchedulerLifecycle() {
    let now = 5000;
    let intervalCallback = null;
    let intervalMs = null;
    let intervalCreates = 0;
    const clearedIntervals = [];
    const steps = [];
    const errors = [];

    const context = createEnvironment({
        performance: { now: () => now },
        setInterval(callback, ms) {
            intervalCreates++;
            intervalCallback = callback;
            intervalMs = ms;
            return 77;
        },
        clearInterval(id) {
            clearedIntervals.push(id);
        }
    });
    const core = new context.AgcCore({ onError: (error) => errors.push(error) });
    core.exports = {
        cpu_step(count) {
            steps.push(count);
        },
        packet_read() {
            return 0;
        }
    };

    core.start(1);
    assert(core.running === true, 'scheduler did not enter running state');
    assert(core.timer === 77, 'scheduler did not retain its interval handle');
    assert(intervalCreates === 1 && typeof intervalCallback === 'function',
        'scheduler must create exactly one interval');
    assert(Math.abs(intervalMs - (1000 / 60)) < 0.000001,
        `scheduler cadence changed from 60 Hz: ${intervalMs}`);

    // start() is deliberately idempotent while the same core is already live.
    core.start(2);
    assert(intervalCreates === 1,
        'starting an already-running core must not create another interval');
    assert(core.clockDivisor === 1,
        'starting an already-running core must not silently change its divisor');

    const firstStart = core.startTime;
    now += 11.72;
    const expectedFirstSteps = Math.floor((now - firstStart) / 0.01172);
    intervalCallback();
    assert(steps.length === 1 && steps[0] === expectedFirstSteps,
        `scheduler stepped ${JSON.stringify(steps)}; expected ${expectedFirstSteps}`);
    assert(core.totalSteps === expectedFirstSteps,
        'scheduler mission-step accounting did not follow the executed batch');
    assert(errors.length === 0, 'normal scheduler tick reported an error');

    // Match the upstream webAGC safety policy: after a long timer stall, do not
    // execute an unbounded catch-up batch. Rebase the wall-clock epoch and wait
    // for the next normal tick instead.
    const stepsBeforeBacklog = steps.length;
    now += 2000;
    intervalCallback();
    assert(steps.length === stepsBeforeBacklog,
        'scheduler must not execute an over-100000-step catch-up burst');
    assert(core.totalSteps === 0,
        'scheduler backlog rebase must clear only relative step accounting');
    assert(core.startTime === now,
        'scheduler backlog rebase must move the wall-clock epoch to now');

    const rebasedStart = core.startTime;
    now += 11.72;
    const expectedAfterRebase = Math.floor((now - rebasedStart) / 0.01172);
    intervalCallback();
    assert(steps.length === stepsBeforeBacklog + 1
        && steps[steps.length - 1] === expectedAfterRebase,
        'scheduler did not resume normal stepping after backlog rebase');

    core.stop();
    assert(core.running === false && core.timer === 0,
        'stop() did not clear scheduler running/timer state');
    assert(JSON.stringify(clearedIntervals) === JSON.stringify([77]),
        `stop() cleared unexpected interval handles: ${JSON.stringify(clearedIntervals)}`);

    // Restarting a stopped core resumes the same CPU object but starts a fresh
    // relative wall-clock accounting epoch. It must not reset mission state.
    now += 250;
    const stepsBeforeResume = steps.length;
    core.start(2);
    assert(intervalCreates === 2 && core.clockDivisor === 2,
        'stopped core did not restart with the requested clock divisor');
    assert(core.totalSteps === 0 && core.startTime === now,
        'restart did not establish a fresh relative timing epoch');
    now += 23.44;
    const expectedDividedSteps = Math.floor(23.44 / 0.01172 / 2);
    intervalCallback();
    assert(steps.length === stepsBeforeResume + 1
        && steps[steps.length - 1] === expectedDividedSteps,
        'clock divisor was not applied after scheduler restart');
    assert(errors.length === 0, 'scheduler lifecycle smoke reported an error');
    core.stop();
}

async function testLoadPipeline() {
    const calls = [];
    let memory;

    class FakeMemory {
        constructor(options) {
            calls.push(['memory', options.initial]);
            this.buffer = new ArrayBuffer(256 * 1024);
            memory = this;
        }
    }

    const fakeExports = {
        malloc(size) {
            calls.push(['malloc', size]);
            return 1024;
        },
        free(ptr) {
            calls.push(['free', ptr]);
        },
        set_fixed(ptr) {
            calls.push(['set_fixed', ptr]);
        },
        cpu_reset() {
            calls.push(['reset']);
        },
        cpu_step(steps) {
            calls.push(['step', steps]);
        },
        packet_write(channel, value) {
            calls.push(['write', channel, value]);
            return 4;
        },
        packet_read() {
            calls.push(['read']);
            return 0;
        }
    };

    const fakeWebAssembly = {
        Memory: FakeMemory,
        async compile(bytes) {
            calls.push(['compile', bytes.byteLength]);
            return { fakeModule: true };
        },
        async instantiate(module, imports) {
            calls.push(['instantiate']);
            assert(module && module.fakeModule, 'compiled module must reach instantiate');
            assert(imports.env && imports.env.memory === memory,
                'env.memory must be the allocated AGC memory');
            const wasi = imports.wasi_snapshot_preview1;
            assert(wasi && typeof wasi.fd_close === 'function', 'fd_close WASI import missing');
            assert(typeof wasi.fd_fdstat_get === 'function', 'fd_fdstat_get WASI import missing');
            assert(typeof wasi.fd_seek === 'function', 'fd_seek WASI import missing');
            assert(typeof wasi.fd_write === 'function', 'fd_write WASI import missing');
            return { exports: fakeExports };
        }
    };

    const fakeFetch = async (url) => {
        calls.push(['fetch', url]);
        const isWasm = String(url).endsWith('.wasm');
        return {
            ok: true,
            status: 200,
            async arrayBuffer() {
                calls.push(['arrayBuffer', url]);
                return new ArrayBuffer(isWasm ? 32 : 73728);
            }
        };
    };

    const context = createEnvironment({
        WebAssembly: fakeWebAssembly,
        fetch: fakeFetch
    });
    const core = new context.AgcCore();
    await core.load({ wasmUrl: 'yaAGC.wasm', ropeUrl: 'Luminary099.bin' });

    assert(calls.some(([name, initial]) => name === 'memory' && initial === 5),
        'load must allocate five initial WASM pages');
    assert(calls.some(([name, url]) => name === 'fetch' && url === 'yaAGC.wasm'),
        'load must fetch the requested WASM asset');
    assert(calls.some(([name, url]) => name === 'fetch' && url === 'Luminary099.bin'),
        'load must fetch the requested rope asset');
    assert(calls.some(([name, size]) => name === 'malloc' && size === 73728),
        'load must allocate the full rope image');
    assert(calls.filter(([name]) => name === 'reset').length === 2,
        'load reset path must end at a fresh AGC reset state');
    assert(calls.some(([name, steps]) => name === 'step' && steps === 1),
        'load must prime lazy yaAGC I/O with one disposable step');

    const writes = calls.filter(([name]) => name === 'write');
    assert(writes.length === 2, 'load must queue exactly two DSKY U-bit masks');
    assert(writes[0][1] === (0x100 | 0o15) && writes[0][2] === 0o37,
        'load normal-key mask is wrong');
    assert(writes[1][1] === (0x100 | 0o32) && writes[1][2] === 0o20000,
        'load PRO mask is wrong');
}

async function main() {
    await testWrapperInvariants();
    testSchedulerLifecycle();
    await testLoadPipeline();
    console.log('agc-core source smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
