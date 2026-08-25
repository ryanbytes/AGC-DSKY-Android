#!/usr/bin/env node
'use strict';

/*
 * Dependency-free source smoke test for app/src/main/assets/agc-core.js.
 *
 * This does not emulate WebAssembly or prove Android/WebView compatibility.
 * It exercises wrapper invariants that can be checked with fake yaAGC exports:
 * reset/prime/reset ordering, I/O queue draining, DSKY U-bit masks, and exact
 * Apollo fixed-rope length validation.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CORE_JS = path.resolve(__dirname, '../app/src/main/assets/agc-core.js');
const source = fs.readFileSync(CORE_JS, 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createCore() {
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
        clearTimeout: () => {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'agc-core.js' });
    return new context.AgcCore();
}

async function main() {
    const core = createCore();
    const calls = [];
    const output = [(0o10 << 16) | 0o12345, 0];

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
            return 4;
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
    assert(core.totalSteps === 0, 'disposable initialization step must not count as mission execution');

    calls.length = 0;
    core.configureInputMasks();
    assert(calls.length === 2, 'exactly two DSKY input masks expected');
    assert(calls[0][0] === 'write' && calls[0][1] === (0x100 | 0o15)
        && calls[0][2] === 0o37, 'normal DSKY U-bit mask is wrong');
    assert(calls[1][0] === 'write' && calls[1][1] === (0x100 | 0o32)
        && calls[1][2] === 0o20000, 'PRO U-bit mask is wrong');

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
    assert(calls.some(([name]) => name === 'set_fixed'), 'valid fixed rope must call set_fixed');
    assert(calls.some(([name]) => name === 'free'), 'rope allocation must be freed');

    console.log('agc-core source smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
