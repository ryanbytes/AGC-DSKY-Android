#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '../app/src/main/assets/runtime-debug.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const listeners = {};
const reports = [];
const originalConsoleCalls = [];

const context = {
    window: null,
    DebugBridge: {
        report(detail) {
            reports.push(String(detail));
        }
    },
    console: {
        error(...args) {
            originalConsoleCalls.push(args);
        }
    },
    addEventListener(name, callback) {
        listeners[name] = callback;
    },
    JSON,
    String,
    Array
};
context.window = context;

vm.createContext(context);
vm.runInContext(source, context, { filename: 'runtime-debug.js' });

assert(typeof listeners.error === 'function',
    'unhandled JavaScript error listener did not register');
assert(typeof listeners.unhandledrejection === 'function',
    'unhandled promise rejection listener did not register');

// String-only stderr from yaAGC/WASI remains visible in the real console but
// must not create a persistent failure report by itself.
context.console.error('[yaAGC] informational stderr text');
assert(originalConsoleCalls.length === 1,
    'wrapped console.error must preserve string-only console output');
assert(reports.length === 0,
    'string-only yaAGC stderr must not create a persistent failure report');

const handled = new Error('handled AGC failure');
context.console.error('AGC core stopped', handled);
assert(originalConsoleCalls.length === 2,
    'wrapped console.error must still call the original console');
assert(reports.length === 1,
    'stack-bearing handled console.error must be mirrored to DebugBridge');
assert(reports[0].includes('CONSOLE ERROR')
        && reports[0].includes('AGC core stopped')
        && reports[0].includes('handled AGC failure'),
    'handled console error report is missing useful detail');

listeners.error({
    message: 'unhandled boom',
    filename: 'https://appassets.androidplatform.net/assets/app.js',
    lineno: 12,
    colno: 3,
    error: new Error('unhandled boom')
});
assert(reports.length === 2 && reports[1].includes('UNHANDLED JAVASCRIPT ERROR'),
    'unhandled JavaScript error must be reported');

listeners.unhandledrejection({ reason: new Error('async boom') });
assert(reports.length === 3 && reports[2].includes('UNHANDLED PROMISE REJECTION'),
    'unhandled promise rejection must be reported');

console.log('runtime-debug smoke: PASS');
