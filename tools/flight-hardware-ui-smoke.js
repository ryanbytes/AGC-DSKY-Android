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
const keySpec = read('app/src/main/assets/key-mechanical-spec.js');
const interlock = read('app/src/main/assets/keyboard-electrical-interlock.js');
const cm = read('app/src/main/assets/cm-mode.js');
const finish = read('app/src/main/assets/cm-dsky-finish.css');
const controls = read('app/src/main/assets/controls-layout.css');
const hw = read('app/src/main/assets/hardware-fidelity.js');
const sw = read('pwa/static/sw.js');

for (const [text, filename] of [[ui,'flight-hardware-ui.js'],[keySpec,'key-mechanical-spec.js'],[interlock,'keyboard-electrical-interlock.js']]) {
  try { new vm.Script(text, {filename}); }
  catch (error) { fail(`${filename} syntax error: ${error.message}`); }
}

req(cm, "script.src = 'flight-hardware-ui.js'", 'CM feature loader');
req(cm, "script.dataset.feature = 'flight-hardware-ui'", 'CM feature marker');
req(cm, "script.src = 'key-mechanical-spec.js'", 'key mechanical spec loader');
req(cm, "script.dataset.feature = 'key-mechanical-spec'", 'key mechanical spec marker');
req(cm, "script.src = 'keyboard-electrical-interlock.js'", 'keyboard interlock loader');
req(cm, "script.dataset.feature = 'keyboard-electrical-interlock'", 'keyboard interlock marker');
req(sw, "'./flight-hardware-ui.js'", 'offline PWA cache');
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

for (const forbidden of ['decodeChannel10(', 'agcCore.stop(', 'agcCore.reset(', 'resetAgcFace('])
  no(ui, forbidden, 'lighting bus demo state isolation');

for (const marker of [
  "const NORMAL_KEY_CHANNEL = 0o15",
  "const KEY_CONTACT_BASE_MS = 36",
  "const HARDWARE_SEED_KEY = 'dskyHardwareUnitSeedV1'",
  "document.addEventListener('pointerdown', onKeyDown, {capture:true, passive:false})",
  "event.stopImmediatePropagation()",
  "button.dataset.key === 'P'",
  "core.keyPress(code)",
  "core.writeIo(NORMAL_KEY_CHANNEL, 0)",
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('blur', releaseAllKeys",
  "--key-travel",
  "keySound(button, false)",
  "keySound(button, true)"
]) req(ui, marker, 'mechanical held-key model');

// Manufacturing variation is source-bounded, not arbitrary. R-700 supplies the
// assembled stroke/contact geometry; drawing 2004941 supplies the only bounded
// spring-rate range we sample. 1010901 acceptance limits stay envelopes rather
// than being misused as probability distributions.
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
  "Only documented bounded spring-rate range is varied per key"
]) req(keySpec, marker, 'source-backed key mechanics');
no(keySpec, "vary(KEY_CONTACT_BASE_MS", 'key contact timing must not masquerade as manufacturing tolerance');

// The electrical layer owns all 18 keycoded switches at window capture. The
// first depression latches the keyboard cycle; overlapping keys can move but
// cannot produce another code. KEYRST waits for all normal keys to return and,
// for touchscreen-fast taps, for the explicitly estimated D-input dwell.
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

// PRO is physically separate and must remain owned by the source-backed
// channel-032 hardware path, never converted into a channel-015 key code.
for (const marker of [
  "agcCore.proceedKey(true)",
  "agcCore.proceedKey(false)"
]) req(hw, marker, 'PRO / standby path');
no(ui, "P:0o", 'normal-key map must exclude PRO');

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

// The former generic slow fade was an unsupported presentation choice.
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
console.log('  source-bounded key mechanics, series-contact KEYRST, minimum D-input dwell, dedicated PRO, and three-bulb annunciator timing gated');
