#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const INDEX = path.join(ASSETS, 'index.html');
const APP = path.join(ASSETS, 'app.js');
const CORE = path.join(ASSETS, 'agc-core.js');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const html = fs.readFileSync(INDEX, 'utf8');
const refs = [];
for (const pattern of [/<script\s+[^>]*src="([^"]+)"/g, /<link\s+[^>]*href="([^"]+)"/g]) {
    let match;
    while ((match = pattern.exec(html)) !== null) refs.push(match[1]);
}

assert(refs.length > 0, 'index.html contains no local script/stylesheet references');
for (const ref of refs) {
    assert(!/^[a-z][a-z0-9+.-]*:/i.test(ref),
        `index.html must not reference an external URL: ${ref}`);
    assert(!ref.startsWith('/') && !ref.includes('..'),
        `index.html reference must stay in the packaged asset root: ${ref}`);
    assert(fs.isFileSync(path.join(ASSETS, ref)),
        `index.html references missing packaged asset: ${ref}`);
}

const app = fs.readFileSync(APP, 'utf8');
for (const rope of ['Luminary099.bin', 'Comanche055.bin']) {
    assert(app.includes(`rope:'${rope}'`),
        `mission selector no longer references staged rope ${rope}`);
}

const core = fs.readFileSync(CORE, 'utf8');
assert(core.includes("options.wasmUrl || 'yaAGC.wasm'"),
    'AGC core default WASM filename changed from staged yaAGC.wasm');
assert(core.includes("options.ropeUrl || 'Luminary099.bin'"),
    'AGC core default rope filename changed from staged Luminary099.bin');

const localNames = new Set(refs.concat([
    'yaAGC.wasm', 'Luminary099.bin', 'Comanche055.bin'
]));
assert(localNames.size === refs.length + 3,
    'a binary asset name unexpectedly collides with a frontend asset name');

console.log('asset-reference smoke: PASS');
