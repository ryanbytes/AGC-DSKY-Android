#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const INDEX = path.join(ASSETS, 'index.html');
const APP = path.join(ASSETS, 'app.js');
const CORE = path.join(ASSETS, 'agc-core.js');
const DREAM_SILENCE = path.join(ASSETS, 'dream-silence.js');

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
    const full = path.join(ASSETS, ref);
    assert(fs.existsSync(full) && fs.statSync(full).isFile(),
        `index.html references missing packaged asset: ${ref}`);
}

for (const stale of [
    'app-refine.js',
    'runtime-debug.js',
    'v35-audio-refine.js',
    'spacecraft-panels.js',
    'spacecraft-panels.css',
    'spacecraft-panel-mode.js'
]) {
    assert(!refs.includes(stale), `current DSKY-only index unexpectedly loads stale renderer/patch asset ${stale}`);
    assert(!fs.existsSync(path.join(ASSETS, stale)),
        `current DSKY-only asset tree unexpectedly retains stale renderer/patch asset ${stale}`);
}

for (const required of ['cm-dsky-finish.css', 'cm-mode.js', 'dream-silence.js']) {
    assert(refs.includes(required), `current CM-only index is missing required frontend asset ${required}`);
}

const appIndex = refs.indexOf('app.js');
const dreamSilenceIndex = refs.indexOf('dream-silence.js');
const clockBehaviorIndex = refs.indexOf('clock-behavior.js');
assert(appIndex >= 0 && dreamSilenceIndex === appIndex + 1,
    'dream-silence.js must load immediately after app.js');
assert(clockBehaviorIndex > dreamSilenceIndex,
    'dream-silence.js must load before clock behavior and before timer callbacks can run');

const dreamSilence = fs.readFileSync(DREAM_SILENCE, 'utf8');
assert(dreamSilence.includes("new URLSearchParams(location.search).get('dream') === '1'"),
    'Dream silence guard no longer scopes itself to dream=1');
assert(dreamSilence.includes("ensureAudio = () => null"),
    'Dream mode no longer blocks WebAudio creation/resume');
assert(dreamSilence.includes("playRelayBurst = () => {}"),
    'Dream mode no longer suppresses clock relay bursts');
assert(!dreamSilence.includes("store.set('audioTickV4'"),
    'Dream silence guard must not alter the saved relay-click preference');

const app = fs.readFileSync(APP, 'utf8');
assert(app.includes("comanche055:{label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'}"),
    'current app no longer defines the Comanche 055 mission');
assert(!app.includes('Luminary099.bin'),
    'CM-only app unexpectedly references Luminary099.bin');

const core = fs.readFileSync(CORE, 'utf8');
assert(core.includes("options.wasmUrl || 'yaAGC.wasm'"),
    'AGC core default WASM filename changed from staged yaAGC.wasm');
assert(core.includes("options.ropeUrl || 'Comanche055.bin'"),
    'AGC core default rope filename changed from staged Comanche055.bin');
assert(!core.includes('Luminary099.bin'),
    'AGC core unexpectedly references the removed LM rope');

const localNames = new Set(refs.concat(['yaAGC.wasm', 'Comanche055.bin']));
assert(localNames.size === refs.length + 2,
    'a binary asset name unexpectedly collides with a frontend asset name');

const rasterPanels = fs.readdirSync(ASSETS)
    .filter((name) => /\.(jpe?g|webp)$/i.test(name));
assert(rasterPanels.length === 0,
    `DSKY-only asset tree unexpectedly contains raster panel images: ${rasterPanels.join(', ')}`);

const rasterReferences = [];
for (const name of fs.readdirSync(ASSETS).filter((entry) => /\.(html|css|js)$/i.test(entry))) {
    const source = fs.readFileSync(path.join(ASSETS, name), 'utf8');
    if (/[^\s"'()]+\.(?:jpe?g|webp)(?:[?#][^\s"'()]*)?/i.test(source)) rasterReferences.push(name);
}
assert(rasterReferences.length === 0,
    `DSKY-only frontend unexpectedly references raster panel images from: ${rasterReferences.join(', ')}`);

console.log('asset-reference smoke: PASS');
