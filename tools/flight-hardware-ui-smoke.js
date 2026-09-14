#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const fail = m => { console.error(`FLIGHT HARDWARE UI FAIL: ${m}`); process.exit(1); };
const req = (t, n, l) => { if (!t.includes(n)) fail(`${l} missing: ${n}`); };
const no = (t, n, l) => { if (t.includes(n)) fail(`${l} must not contain: ${n}`); };

const ui = read('app/src/main/assets/flight-hardware-ui.js');
const rheostat = read('app/src/main/assets/lighting-rheostat-stop.js');
const keySpec = read('app/src/main/assets/key-mechanical-spec.js');
const interlock = read('app/src/main/assets/keyboard-electrical-interlock.js');
const proceed = read('app/src/main/assets/proceed-electrical.js');
const cm = read('app/src/main/assets/cm-mode.js');
const finish = read('app/src/main/assets/cm-dsky-finish.css');
const controls = read('app/src/main/assets/controls-layout.css');
const hw = read('app/src/main/assets/hardware-fidelity.js');
const sw = read('pwa/static/sw.js');

for (const [text, filename] of [
  [ui,'flight-hardware-ui.js'],
  [rheostat,'lighting-rheostat-stop.js'],
  [keySpec,'key-mechanical-spec.js'],
  [interlock,'keyboard-electrical-interlock.js'],
  [proceed,'proceed-electrical.js']
]) {
  try { new vm.Script(text, {filename}); }
  catch (error) { fail(`${filename} syntax error: ${error.message}`); }
}

req(cm, "script.src = 'flight-hardware-ui.js'", 'CM feature loader');
req(cm, "script.dataset.feature = 'flight-hardware-ui'", 'CM feature marker');
req(cm, "script.src = 'lighting-rheostat-stop.js'", 'lighting rheostat stop loader');
req(cm, "script.dataset.feature = 'lighting-rheostat-stop'", 'lighting rheostat stop marker');
req(cm, "script.src = 'key-mechanical-spec.js'", 'key mechanical spec loader');
req(cm, "script.dataset.feature = 'key-mechanical-spec'", 'key mechanical spec marker');
req(cm, "script.src = 'keyboard-electrical-interlock.js'", 'keyboard interlock loader');
req(cm, "script.dataset.feature = 'keyboard-electrical-interlock'", 'keyboard interlock marker');
req(sw, "'./flight-hardware-ui.js'", 'offline PWA cache');
req(sw, "'./lighting-rheostat-stop.js'", 'offline rheostat stop cache');
req(sw, "'./key-mechanical-spec.js'", 'offline key mechanical spec cache');
req(sw, "'./keyboard-electrical-interlock.js'", 'offline keyboard interlock cache');

for (const marker of [
  "const LEVELS = Object.freeze([1.00, 0.75, 0.50, 0.25, 0.00])",
  "saveIndex('dskyNumericsLevel'",
  "saveIndex('dskyIntegralLevel'",
  "--numerics-level",
  "--integral-level",
  "NUMERICS ${levelText(numericsIndex)}",
  "INTEGRAL ${levelText(integralIndex)}",
  "LIGHT BUS DEMO",
  "NUMERICS FEED OPEN",
  "INTEGRAL FEED OPEN",
  "BOTH LIGHTING FEEDS OPEN",
  "RELAY STATE RETAINED"
]) req(ui, marker, 'independent lighting model');

// The private zero level remains available for explicit feed-open simulation,
// but the real CM rheostats have mechanical stops and cannot select OFF during
// ordinary rotation. Complete disable is by opening the lighting circuit/feed.
for (const marker of [
  "const MIN_NORMAL_LEVEL = 0.25",
  "cycleWithMechanicalStop",
  "normalizeOne('numerics')",
  "normalizeOne('integral')",
  "completeOffMethod:'open lighting feed / circuit breaker, not normal rheostat rotation'",
  "zeroReservedFor:'LIGHT BUS DEMO feed-open state'"
]) req(rheostat, marker, 'lighting rheostat mechanical stop');

for (const forbidden of ['decodeChannel10(', 'agcCore.stop(', 'agcCore.reset(', 'resetAgcFace('])
  no(ui, forbidden, 'lighting bus demo state isolation');

// flight-hardware-ui.js owns presentation personality only. It prepares
// deterministic key travel/contact/sound values consumed by the real electrical
// interlock, but never captures normal key events or touches channel 015.
for (const marker of [
  "const KEY_CONTACT_BASE_MS = 36",
  "const KEY_RETURN_SOUND_BASE_MS = 18",
  "const HARDWARE_SEED_KEY = 'dskyHardwareUnitSeedV1'",
  "contactMs: Number(vary(KEY_CONTACT_BASE_MS",
  "returnSoundMs: Number(vary(KEY_RETURN_SOUND_BASE_MS",
  "makePitch: Number(vary(520",
  "returnPitch: Number(vary(330",
  "--key-travel",
  "function prepareKeys()",
  "window.AGCDSKY.hardwarePersonality = () => ({"
]) req(ui, marker, 'key presentation personality');
for (const forbidden of [
  'NORMAL_KEY_CHANNEL',
  'DSKY_KEY_CODE',
  'function fireKeyContact(',
  'function onKeyDown(',
  'function releaseAgcKey(',
  'function releaseKey(',
  'function releaseAllKeys(',
  "document.addEventListener('pointerdown'",
  "document.addEventListener('pointerup'",
  "document.addEventListener('pointercancel'",
  'core.keyPress(code)',
  'core.writeIo(0o15',
  'keyState = new Map()'
]) no(ui, forbidden, 'presentation layer electrical ownership');

// Manufacturing variation is source-bounded, not arbitrary. R-700 supplies the
// assembled stroke/contact geometry; drawing 2004941 supplies the only bounded
// spring-rate range we sample. 1010901 acceptance limits stay envelopes rather
// than being misused as probability distributions. Total finger force remains
// intentionally unknown until installed preload/lever/friction geometry is
// source-backed.
for (const marker of [
  "actuationTravelIn: 3 / 16",
  "overtravelToBottomIn: 1 / 16",
  "totalTravelIn: 1 / 4",
  "rateLbPerInMin: 3.0",
  "rateLbPerInMax: 3.5",
  "actuatingForceOzMax: 7",
  "releaseForceOzMin: 1",
  "pretravelInMax: 0.030",
  "differentialMovementInMax: 0.006",
  "overtravelInMin: 0.003",
  "minimumBrightnessFootLamberts: 2.0",
  "testVrms: 75",
  "testHz: 400",
  "contactMs: 36",
  "returnSoundMs: 18",
  "forceIncreaseToActuationOzMin",
  "forceIncreaseToBottomOzMax",
  "totalFingerForceOzMin: null",
  "totalFingerForceOz: null",
  "Only documented bounded spring-rate range is varied per key",
  "Total finger force remains unresolved"
]) req(keySpec, marker, 'source-backed key mechanics');
no(keySpec, "vary(KEY_CONTACT_BASE_MS", 'key contact timing must not masquerade as manufacturing tolerance');

// The electrical interlock is the sole owner of all 18 keycoded switches at
// window capture. The first depression latches the keyboard cycle; overlapping
// keys can move but cannot produce another code. KEYRST waits for all normal
// keys to return and for the estimated D-input dwell on a fast tap.
for (const marker of [
  "window.addEventListener('pointerdown', onPointerDown, {capture:true, passive:false})",
  "if (!button || button.dataset.key === 'P') return null",
  "const accepted = !cycleLatched",
  "if (!state.accepted) return",
  "if (!allNormalKeysReleased()) return",
  "const MIN_KEYCODE_HOLD_MS = 12",
  "const remaining = MIN_KEYCODE_HOLD_MS - elapsed",
  "keyResetPending:!!keyResetTimer",
  "typeof core.keyRelease === 'function'",
  "electricalKeyCode",
  "keyboardElectrical"
]) req(interlock, marker, 'series-contact keyboard interlock');
no(interlock, "P:0o", 'series-contact keycode map must exclude PRO');

// PRO is physically separate from channel 015. Pointer/lifecycle ownership now
// lives in proceed-electrical.js; hardware-fidelity.js must remain focused on
// relay/display timing and must not regain a PRO event handler.
for (const marker of [
  "document.querySelector('[data-key=\"P\"]')",
  "pro.addEventListener('pointerdown'",
  "pro.addEventListener('pointerup'",
  "pro.addEventListener('pointercancel'",
  'core.proceedKey(true)',
  'core.proceedKey(false)',
  'window.enterClock = function proceedSafeEnterClock'
]) req(proceed, marker, 'dedicated PRO / channel-032 path');
for (const forbidden of [
  "document.querySelector('[data-key=\"P\"]')",
  'proPointer',
  'releaseProceed',
  'proceedKey(true)',
  'proceedKey(false)',
  'hardwareEnterClock'
]) no(hw, forbidden, 'relay fidelity PRO ownership');
no(ui, "P:0o", 'presentation layer must not define a normal-key map including PRO');

for (const marker of [
  "part:'MS24367-713'",
  "part:'MS24367-680'",
  "riseMs:32, fallMs:48",
  "riseMs:40, fallMs:58",
  "source.className = `lamp-source lamp-source-${i + 1}`",
  "--lamp-rise",
  "--lamp-fall",
  "--lamp-gain",
  "legend.className = 'lamp-legend'",
  "document.body.classList.add('lamp-hardware-ready')",
  ".lamp .lamp-source",
  "transition-duration:var(--lamp-fall,52ms)",
  "transition-duration:var(--lamp-rise,36ms)"
]) req(ui + finish, marker, 'three-bulb incandescent model');

no(finish, 'transition:opacity 145ms', 'obsolete generic annunciator decay');
no(finish, 'transition-duration:85ms', 'obsolete generic annunciator rise');

for (const marker of [
  '--key-el-color',
  '--key-el-shadow',
  '.key.pressed',
  'translateY(var(--key-travel,.42vmin))',
  'color:var(--key-el-color',
  'text-shadow:var(--key-el-shadow'
]) req(finish + controls, marker, 'white EL key illumination / options styling');

req(ui, "oldDim.hidden = true", 'retired whole-panel dimmer');
req(ui, "document.body.classList.remove('dim')", 'separate lighting feed enforcement');

console.log('Flight hardware UI smoke: PASS');
console.log('  presentation, normal-key electrical ownership, dedicated PRO controller, rheostat stop, key mechanics, and three-bulb annunciators gated');
