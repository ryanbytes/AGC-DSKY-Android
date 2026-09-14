#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'app/src/main/assets/proceed-electrical.js');
const INPUT = path.join(ROOT, 'app/src/main/assets/dsky-input-runtime.js');
const HARDWARE = path.join(ROOT, 'app/src/main/assets/hardware-fidelity.js');
const INDEX = path.join(ROOT, 'app/src/main/assets/index.html');
const source = fs.readFileSync(SOURCE, 'utf8');
const inputSource = fs.readFileSync(INPUT, 'utf8');
const hardware = fs.readFileSync(HARDWARE, 'utf8');
const html = fs.readFileSync(INDEX, 'utf8');

function fail(message) {
  console.error('PRO ELECTRICAL SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'window.__DSKY_PROCEED_ELECTRICAL__',
  'const api = window.AGCDSKY',
  'const runtime = api?.runtimeTransitions',
  'const input = api?.inputRuntime',
  "document.querySelector('[data-key=\"P\"]')",
  "pro.addEventListener('pointerdown'",
  "pro.addEventListener('pointerup'",
  "pro.addEventListener('pointercancel'",
  "document.addEventListener('visibilitychange'",
  'input.proceed(true)',
  'input.proceed(false)',
  'window.enterClock = function proceedSafeEnterClock',
  'api.proceedElectrical = controller'
]) {
  assert(source.includes(marker), `extracted PRO controller missing lifecycle marker: ${marker}`);
}
assert(!source.includes('proceedPulse('), 'physical PRO path must not use a synthetic pulse');
assert(!source.includes('.proceedKey('),
  'PRO controller must not bypass the shared input runtime');
assert(!source.includes('api.appStatus') && !source.includes('api.getCore'),
  'PRO controller must consume shared runtime authority instead of interpreting app state directly');

for (const forbidden of [
  "document.querySelector('[data-key=\"P\"]')",
  'proPointer',
  'releaseProceed',
  'proceedKey(true)',
  'proceedKey(false)',
  'hardwareEnterClock'
]) {
  assert(!hardware.includes(forbidden),
    `hardware-fidelity.js retained PRO pointer/lifecycle ownership: ${forbidden}`);
}

const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
const inputIndex = html.indexOf('<script src="dsky-input-runtime.js"></script>');
const hardwareIndex = html.indexOf('<script src="hardware-fidelity.js"></script>');
const proceedIndex = html.indexOf('<script src="proceed-electrical.js"></script>');
const relayAudioIndex = html.indexOf('<script src="relay-identity-audio.js"></script>');
assert(runtimeIndex >= 0 && inputIndex > runtimeIndex && hardwareIndex > inputIndex
  && proceedIndex > hardwareIndex && relayAudioIndex > proceedIndex,
  'PRO electrical controller must load after shared runtime/input authority and hardware-fidelity');

function makeEvent(pointerId) {
  return {
    pointerId,
    prevented:false,
    immediate:false,
    preventDefault(){ this.prevented = true; },
    stopImmediatePropagation(){ this.immediate = true; }
  };
}

const proListeners = Object.create(null);
const documentListeners = Object.create(null);
const classes = new Set();
const calls = [];
let mode = 'agc';
let throwOnPress = false;
const pro = {
  classList:{
    add(name){ classes.add(name); },
    remove(name){ classes.delete(name); }
  },
  addEventListener(type, fn){
    if (proListeners[type]) fail(`duplicate PRO ${type} listener installed`);
    proListeners[type] = fn;
  },
  setPointerCapture(pointerId){ calls.push(['capture', pointerId]); }
};
const core = {
  proceedKey(pressed){
    calls.push(['proceed', !!pressed]);
    if (pressed && throwOnPress) throw new Error('synthetic PRO failure');
    return 1;
  }
};
let baseEnterClockCalls = 0;
const failures = [];
const documentObject = {
  hidden:false,
  querySelector(selector){ return selector === '[data-key="P"]' ? pro : null; },
  addEventListener(type, fn){
    if (documentListeners[type]) fail(`duplicate document ${type} listener installed`);
    documentListeners[type] = fn;
  }
};
const AGCDSKY = {};
AGCDSKY.runtimeTransitions = Object.freeze({
  modes:Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'}),
  mode(){ return mode; },
  core(){ return core; }
});
const context = {
  console,
  document:documentObject,
  AGCDSKY,
  agcFailure(error){ failures.push(String(error && error.message || error)); },
  __baseEnterClock(...args){
    baseEnterClockCalls++;
    calls.push(['enterClock', ...args]);
    mode = 'clock';
    return 'clock-result';
  },
  window:null
};
context.window = context;
vm.createContext(context);

vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
assert(context.AGCDSKY_INPUT === AGCDSKY.inputRuntime,
  'shared input runtime did not publish one controller reference');

// Match production classic-script semantics. app.js declares enterClock and
// installs closures before this later script replaces the global binding.
vm.runInContext(`
  function enterClock(...args) { return __baseEnterClock(...args); }
  window.existingClockCaller = (...args) => enterClock(...args);
`, context, {filename:'app-enter-clock-prelude.js'});
vm.runInContext(source, context, {filename:'proceed-electrical.js'});

assert(typeof proListeners.pointerdown === 'function'
  && typeof proListeners.pointerup === 'function'
  && typeof proListeners.pointercancel === 'function',
  'PRO pointer listeners were not installed');
assert(typeof documentListeners.visibilitychange === 'function',
  'PRO visibility release listener was not installed');
assert(context.AGCDSKY_PROCEED === AGCDSKY.proceedElectrical,
  'global and AGCDSKY PRO controller references differ');
assert(AGCDSKY.proceedElectrical.state().held === false,
  'PRO controller did not initialize released');

// Re-running the classic script must be idempotent.
vm.runInContext(source, context, {filename:'proceed-electrical-second-load.js'});

let event = makeEvent(41);
proListeners.pointerdown(event);
assert(event.prevented && event.immediate, 'AGC PRO pointerdown was not exclusively captured');
assert(classes.has('pressed'), 'PRO key did not enter pressed presentation state');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === 1,
  'PRO pointerdown did not assert exactly one maintained contact');
assert(calls.some(call => call[0] === 'capture' && call[1] === 41),
  'PRO pointer capture was not requested');
assert(AGCDSKY.proceedElectrical.state().held
  && AGCDSKY.proceedElectrical.state().pointerId === 41,
  'PRO diagnostic state did not record the owning pointer');

// A second pointer cannot steal the maintained contact.
event = makeEvent(42);
proListeners.pointerdown(event);
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === 1,
  'second PRO pointer generated another make');

// A non-owning pointer-up must not release the held contact.
event = makeEvent(42);
proListeners.pointerup(event);
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 0,
  'non-owning pointer released PRO');
assert(classes.has('pressed'), 'non-owning pointer removed PRO pressed state');

// The owning pointer releases the active-low maintained contact.
event = makeEvent(41);
proListeners.pointerup(event);
assert(event.prevented && event.immediate, 'owning PRO pointer-up was not captured');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 1,
  'owning pointer-up did not release PRO exactly once');
assert(!classes.has('pressed'), 'PRO presentation remained pressed after release');
assert(!AGCDSKY.proceedElectrical.state().held, 'PRO diagnostic state remained held after release');

// Cancel and hidden-page lifecycle both release a held contact.
event = makeEvent(51);
proListeners.pointerdown(event);
event = makeEvent(51);
proListeners.pointercancel(event);
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 2,
  'pointercancel did not release PRO');

event = makeEvent(61);
proListeners.pointerdown(event);
documentObject.hidden = true;
documentListeners.visibilitychange();
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 3,
  'hidden-page transition did not release PRO');
documentObject.hidden = false;

// An app.js closure created before extraction must still resolve the replaced
// classic-script global binding. PRO must release before the base transition
// changes mode to CLOCK.
mode = 'agc';
event = makeEvent(71);
proListeners.pointerdown(event);
const beforeClock = calls.length;
const result = context.existingClockCaller('test-clock', true);
const after = calls.slice(beforeClock);
assert(result === 'clock-result' && baseEnterClockCalls === 1,
  'PRO enterClock wrapper did not preserve the original transition result');
assert(after.length >= 2 && after[0][0] === 'proceed' && after[0][1] === false
  && after[1][0] === 'enterClock',
  'enterClock did not release PRO before changing mode');
assert(mode === 'clock', 'base CLOCK transition did not execute');

// Outside AGC mode PRO must be ignored and left for non-AGC presentation paths.
const pressesBeforeClockMode = calls.filter(call => call[0] === 'proceed' && call[1] === true).length;
event = makeEvent(81);
proListeners.pointerdown(event);
assert(!event.prevented && !event.immediate,
  'PRO was swallowed outside AGC mode');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === pressesBeforeClockMode,
  'PRO asserted channel 032 outside AGC mode');

// A failed electrical make must clear local ownership, restore released level,
// and report the failure through the existing AGC error path.
mode = 'agc';
throwOnPress = true;
event = makeEvent(91);
proListeners.pointerdown(event);
throwOnPress = false;
assert(failures.length === 1 && failures[0] === 'synthetic PRO failure',
  'failed PRO make did not reach agcFailure');
assert(!classes.has('pressed'), 'failed PRO make left the key visually held');
assert(!AGCDSKY.proceedElectrical.state().held, 'failed PRO make left controller ownership latched');
const finalReleases = calls.filter(call => call[0] === 'proceed' && call[1] === false).length;
assert(finalReleases === 5,
  `failed PRO make did not restore released level; releases=${finalReleases}`);

console.log('PRO electrical smoke: PASS');
console.log('  shared runtime/input authority, maintained make/release, pointer ownership, cancel/hidden cleanup, CLOCK release ordering, non-AGC bypass, idempotence, and failure cleanup verified');
