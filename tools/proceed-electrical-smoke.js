#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/proceed-electrical.js'), 'utf8');
const inputSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-input-runtime.js'), 'utf8');
const hardware = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/hardware-fidelity.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/index.html'), 'utf8');

function fail(message) {
  console.error('PRO ELECTRICAL SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'window.__DSKY_PROCEED_ELECTRICAL__',
  'const runtime = api?.runtimeTransitions',
  'const input = api?.inputRuntime',
  'typeof runtime.clockRequested',
  'typeof runtime.onBeforeClock',
  "document.querySelector('[data-key=\"P\"]')",
  "pro.addEventListener('pointerdown'",
  "pro.addEventListener('pointerup'",
  "pro.addEventListener('pointercancel'",
  "document.addEventListener('visibilitychange'",
  'input.proceed(true)',
  'input.proceed(false)',
  'runtime.onBeforeClock(releaseProceed)',
  'api.proceedElectrical = controller'
]) {
  assert(source.includes(marker), `PRO controller missing lifecycle marker: ${marker}`);
}
for (const forbidden of [
  'proceedPulse(',
  '.proceedKey(',
  'window.enterClock =',
  'api.appStatus',
  'api.getCore'
]) {
  assert(!source.includes(forbidden), `PRO controller retained obsolete ownership: ${forbidden}`);
}
for (const forbidden of [
  "document.querySelector('[data-key=\"P\"]')",
  'proPointer',
  'releaseProceed',
  'proceedKey(true)',
  'proceedKey(false)',
  'hardwareEnterClock'
]) {
  assert(!hardware.includes(forbidden), `hardware-fidelity.js retained PRO ownership: ${forbidden}`);
}

const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
const inputIndex = html.indexOf('<script src="dsky-input-runtime.js"></script>');
const hardwareIndex = html.indexOf('<script src="hardware-fidelity.js"></script>');
const proceedIndex = html.indexOf('<script src="proceed-electrical.js"></script>');
assert(runtimeIndex >= 0 && inputIndex > runtimeIndex && hardwareIndex > inputIndex && proceedIndex > hardwareIndex,
  'PRO controller load order must follow shared runtime/input authority and hardware fidelity');

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
const failures = [];
let mode = 'agc';
let clockPending = false;
let throwOnPress = false;
let beforeClockHook = null;
let beforeClockRegistrations = 0;

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
const documentObject = {
  hidden:false,
  querySelector(selector){ return selector === '[data-key="P"]' ? pro : null; },
  addEventListener(type, fn){
    if (documentListeners[type]) fail(`duplicate document ${type} listener installed`);
    documentListeners[type] = fn;
  }
};
const MODES = Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'});
const AGCDSKY = {
  runtimeTransitions:Object.freeze({
    modes:MODES,
    mode(){ return mode; },
    core(){ return core; },
    clockRequested(){ return clockPending; },
    onBeforeClock(handler){
      beforeClockRegistrations++;
      beforeClockHook = handler;
      return () => { if (beforeClockHook === handler) beforeClockHook = null; };
    }
  })
};
const context = {
  console,
  document:documentObject,
  AGCDSKY,
  agcFailure(error){ failures.push(String(error && error.message || error)); },
  __baseEnterClock(...args){
    calls.push(['enterClock', ...args]);
    mode = MODES.CLOCK;
    return 'clock-result';
  },
  window:null
};
context.window = context;
vm.createContext(context);
vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
vm.runInContext(source, context, {filename:'proceed-electrical.js'});

assert(typeof proListeners.pointerdown === 'function'
    && typeof proListeners.pointerup === 'function'
    && typeof proListeners.pointercancel === 'function',
  'PRO pointer listeners were not installed');
assert(typeof documentListeners.visibilitychange === 'function',
  'PRO visibility release listener was not installed');
assert(typeof beforeClockHook === 'function' && beforeClockRegistrations === 1,
  'PRO did not register exactly one shared pre-CLOCK cleanup hook');
assert(context.AGCDSKY_PROCEED === AGCDSKY.proceedElectrical,
  'global and AGCDSKY PRO controller references differ');

// Re-running the classic script must not duplicate listeners or CLOCK hooks.
vm.runInContext(source, context, {filename:'proceed-electrical-second-load.js'});
assert(beforeClockRegistrations === 1, 'second PRO load duplicated the CLOCK cleanup hook');

let event = makeEvent(41);
proListeners.pointerdown(event);
assert(event.prevented && event.immediate, 'AGC PRO pointerdown was not exclusively captured');
assert(classes.has('pressed'), 'PRO key did not enter pressed presentation state');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === 1,
  'PRO pointerdown did not assert exactly one maintained contact');

event = makeEvent(42);
proListeners.pointerdown(event);
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === 1,
  'second PRO pointer generated another make');

event = makeEvent(42);
proListeners.pointerup(event);
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 0,
  'non-owning pointer released PRO');

event = makeEvent(41);
proListeners.pointerup(event);
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 1,
  'owning pointer-up did not release PRO exactly once');
assert(!classes.has('pressed'), 'PRO presentation remained pressed after release');

// Cancel and hidden lifecycle both release the maintained contact.
event = makeEvent(51);
proListeners.pointerdown(event);
proListeners.pointercancel(makeEvent(51));
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 2,
  'pointercancel did not release PRO');

event = makeEvent(61);
proListeners.pointerdown(event);
documentObject.hidden = true;
documentListeners.visibilitychange();
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 3,
  'hidden-page transition did not release PRO');
documentObject.hidden = false;

// Shared CLOCK authority must invoke the registered cleanup before app.js stops
// the core and changes mode.
mode = MODES.AGC;
event = makeEvent(71);
proListeners.pointerdown(event);
const beforeClock = calls.length;
clockPending = true;
beforeClockHook({reason:'app enterClock', from:MODES.AGC});
const result = context.__baseEnterClock('test-clock', true);
clockPending = false;
const after = calls.slice(beforeClock);
assert(result === 'clock-result', 'base CLOCK transition result changed');
assert(after.length >= 2
    && after[0][0] === 'proceed' && after[0][1] === false
    && after[1][0] === 'enterClock',
  'shared pre-CLOCK hook did not release PRO before the base transition');
assert(mode === MODES.CLOCK, 'base CLOCK transition did not execute');

// New PRO makes are suppressed after CLOCK intent has been registered, even if
// the underlying app mode is still AGC while a deferred transition settles.
mode = MODES.AGC;
clockPending = true;
const makesBeforePending = calls.filter(call => call[0] === 'proceed' && call[1] === true).length;
event = makeEvent(75);
proListeners.pointerdown(event);
assert(!event.prevented && !event.immediate,
  'suppressed PRO make should be left to the inert legacy path');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === makesBeforePending,
  'PRO asserted channel 032 after CLOCK was requested');
clockPending = false;

// Outside AGC mode PRO remains available to non-AGC presentation paths.
mode = MODES.CLOCK;
const pressesBeforeClockMode = calls.filter(call => call[0] === 'proceed' && call[1] === true).length;
event = makeEvent(81);
proListeners.pointerdown(event);
assert(!event.prevented && !event.immediate, 'PRO was swallowed outside AGC mode');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === pressesBeforeClockMode,
  'PRO asserted channel 032 outside AGC mode');

// Failed electrical make must restore release level and report through agcFailure.
mode = MODES.AGC;
throwOnPress = true;
event = makeEvent(91);
proListeners.pointerdown(event);
throwOnPress = false;
assert(failures.length === 1 && failures[0] === 'synthetic PRO failure',
  'failed PRO make did not reach agcFailure');
assert(!classes.has('pressed') && !AGCDSKY.proceedElectrical.state().held,
  'failed PRO make left local ownership held');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === false).length === 5,
  'failed PRO make did not restore released level');

console.log('PRO electrical smoke: PASS');
console.log('  maintained contact, lifecycle cleanup, centralized CLOCK release ordering, pending-CLOCK suppression, idempotence, and failure cleanup verified');
