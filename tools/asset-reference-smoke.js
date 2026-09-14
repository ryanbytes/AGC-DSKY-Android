#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const INDEX = path.join(ASSETS, 'index.html');
const APP = path.join(ASSETS, 'app.js');
const CORE = path.join(ASSETS, 'agc-core.js');
const DISPLAY = path.join(ASSETS, 'dsky-display-renderer.js');
const ENV = path.join(ASSETS, 'display-environment.js');
const AUDIO = path.join(ASSETS, 'relay-audio-runtime.js');
const CLOCK = path.join(ASSETS, 'phone-clock-runtime.js');
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
    assert(!/^[a-z][a-z0-9+.-]*:/i.test(ref), `index.html must not reference an external URL: ${ref}`);
    assert(!ref.startsWith('/') && !ref.includes('..'), `index.html reference must stay in packaged asset root: ${ref}`);
    const full = path.join(ASSETS, ref);
    assert(fs.existsSync(full) && fs.statSync(full).isFile(), `index.html references missing packaged asset: ${ref}`);
}

for (const stale of ['app-refine.js','runtime-debug.js','v35-audio-refine.js','spacecraft-panels.js','spacecraft-panels.css','spacecraft-panel-mode.js']) {
    assert(!refs.includes(stale), `current DSKY-only index unexpectedly loads stale renderer/patch asset ${stale}`);
    assert(!fs.existsSync(path.join(ASSETS, stale)), `current DSKY-only asset tree unexpectedly retains stale renderer/patch asset ${stale}`);
}

for (const required of [
    'cm-dsky-finish.css','cm-mode.js','dream-silence.js','dsky-keycodes.js',
    'dsky-display-renderer.js','display-environment.js','relay-audio-runtime.js','phone-clock-runtime.js',
    'runtime-transitions.js','hardware-fidelity.js','proceed-electrical.js'
]) {
    assert(refs.includes(required), `current CM-only index is missing required frontend asset ${required}`);
}

const displayIndex = refs.indexOf('dsky-display-renderer.js');
const envIndex = refs.indexOf('display-environment.js');
const audioIndex = refs.indexOf('relay-audio-runtime.js');
const phoneClockIndex = refs.indexOf('phone-clock-runtime.js');
const keycodesIndex = refs.indexOf('dsky-keycodes.js');
const appIndex = refs.indexOf('app.js');
const dreamSilenceIndex = refs.indexOf('dream-silence.js');
const runtimeTransitionsIndex = refs.indexOf('runtime-transitions.js');
const clockBehaviorIndex = refs.indexOf('clock-behavior.js');
assert(displayIndex >= 0 && envIndex === displayIndex + 1,
    'display-environment.js must load immediately after dsky-display-renderer.js');
assert(audioIndex === envIndex + 1 && phoneClockIndex === audioIndex + 1,
    'relay audio then phone-clock runtime must parser-load after display environment');
assert(keycodesIndex === phoneClockIndex + 1 && appIndex === keycodesIndex + 1,
    'shared runtime chain must complete before app.js');
assert(dreamSilenceIndex === appIndex + 1, 'dream-silence.js must load immediately after app.js');
assert(runtimeTransitionsIndex === dreamSilenceIndex + 1, 'runtime-transitions.js must load immediately after dream-silence.js');
assert(clockBehaviorIndex > runtimeTransitionsIndex, 'runtime-transitions.js must load before clock behavior');

const hardwareIndex = refs.indexOf('hardware-fidelity.js');
const proceedIndex = refs.indexOf('proceed-electrical.js');
const relayIdentityIndex = refs.indexOf('relay-identity-audio.js');
assert(hardwareIndex >= 0 && proceedIndex === hardwareIndex + 1,
    'proceed-electrical.js must load immediately after hardware-fidelity.js');
assert(relayIdentityIndex > proceedIndex, 'PRO electrical ownership must initialize before later relay refinements');

const dreamSilence = fs.readFileSync(DREAM_SILENCE, 'utf8');
assert(dreamSilence.includes("new URLSearchParams(location.search).get('dream') === '1'"),
    'Dream silence guard no longer scopes itself to dream=1');
assert(dreamSilence.includes("ensureAudio = () => null"), 'Dream mode no longer blocks WebAudio creation/resume');
assert(dreamSilence.includes("playRelayBurst = () => {}"), 'Dream mode no longer suppresses relay bursts');

const display = fs.readFileSync(DISPLAY, 'utf8');
const env = fs.readFileSync(ENV, 'utf8');
const audio = fs.readFileSync(AUDIO, 'utf8');
const clock = fs.readFileSync(CLOCK, 'utf8');
const app = fs.readFileSync(APP, 'utf8');
assert(display.includes('function renderDigits(') && display.includes('function setLamp('),
    'extracted display renderer is missing shared EL/lamp primitives');
assert(env.includes('const DAY_MS=86400000') && env.includes('function updateDreamEnvironment()'),
    'display environment is missing solar/dream ownership');
assert(audio.includes('function ensureAudio()') && audio.includes('function playRelayBurst('),
    'relay audio runtime is missing base audio ownership');
assert(clock.includes('const CLOCK_GROUPS=[') && clock.includes('function lampTest()'),
    'phone-clock runtime is missing relay/lamp-test ownership');
assert(app.includes("comanche055:{label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'}"),
    'current app no longer defines the Comanche 055 mission');
for (const forbidden of [
    'AGC_KEY','AGCDSKY_KEY_CODES','.keyPress(','.keyRelease(','.proceedKey(','writeIo(0o15',
    'function press(','window.press','function executeClock(','PHONE CLOCK INPUT','entryMode=',
    'const SEG=','const PATH=','const DIGIT_RELAY=','const CLOCK_GROUPS=','function syncClockFace()',
    'function lampTest()','clockRelayWords={}','$DAY_MS','const DAY_MS=86400000','function solarTimes(',
    'function updateDreamEnvironment()','function ensureAudio()','function emitTick(','function playRelayBurst('
]) {
    const token = forbidden === '$DAY_MS' ? 'const DAY_MS=86400000' : forbidden;
    assert(!app.includes(token), `app.js regained extracted ownership: ${token}`);
}
assert(!app.includes('Luminary099.bin'), 'CM-only app unexpectedly references Luminary099.bin');

const core = fs.readFileSync(CORE, 'utf8');
assert(core.includes("options.wasmUrl || 'yaAGC.wasm'"), 'AGC core default WASM filename changed');
assert(core.includes("options.ropeUrl || 'Comanche055.bin'"), 'AGC core default rope filename changed');
assert(!core.includes('Luminary099.bin'), 'AGC core unexpectedly references removed LM rope');

const localNames = new Set(refs.concat(['yaAGC.wasm', 'Comanche055.bin']));
assert(localNames.size === refs.length + 2, 'a binary asset name unexpectedly collides with a frontend asset name');

const rasterPanels = fs.readdirSync(ASSETS).filter((name) => /\.(jpe?g|webp)$/i.test(name));
assert(rasterPanels.length === 0, `DSKY-only asset tree unexpectedly contains raster panel images: ${rasterPanels.join(', ')}`);
const rasterReferences = [];
for (const name of fs.readdirSync(ASSETS).filter((entry) => /\.(html|css|js)$/i.test(entry))) {
    const source = fs.readFileSync(path.join(ASSETS, name), 'utf8');
    if (/[^\s"'()]+\.(?:jpe?g|webp)(?:[?#][^\s"'()]*)?/i.test(source)) rasterReferences.push(name);
}
assert(rasterReferences.length === 0, `DSKY-only frontend unexpectedly references raster panel images from: ${rasterReferences.join(', ')}`);

console.log('asset-reference smoke: PASS');
