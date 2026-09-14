#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/hardware-fidelity.js'), 'utf8');

function fail(message) {
  console.error('PRO ELECTRICAL SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

const startMarker = '// AGC PRO is a maintained contact, not a 120-ms synthetic pulse.';
const endMarker = '// Seed the physical latch model and AGC-facing renderer';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
assert(start >= 0 && end > start, 'could not isolate the PRO maintained-contact block');
const proSource = source.slice(start, end);

for (const marker of [
  "document.querySelector('[data-key=\"P\"]')",
  "pro.addEventListener('pointerdown'",
  "pro.addEventListener('pointerup'",
  "pro.addEventListener('pointercancel'",
  "document.addEventListener('visibilitychange'",
  'agcCore.proceedKey(true)',
  'agcCore.proceedKey(false)',
  'const enterClockBeforeProceedGuard = enterClock',
  'releaseProceed();'
]) {
  assert(proSource.includes(marker), `PRO block missing lifecycle marker: ${marker}`);
}
assert(!proSource.includes('proceedPulse('), 'physical PRO path must not use a synthetic pulse');

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
  addEventListener(type, fn){ proListeners[type] = fn; },
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
  addEventListener(type, fn){ documentListeners[type] = fn; }
};
const context = {
  console,
  document:documentObject,
  mode,
  agcCore:core,
  agcFailure(error){ failures.push(String(error && error.message || error)); },
  enterClock(...args){ baseEnterClockCalls++; calls.push(['enterClock', ...args]); return 'clock-result'; },
  window:null
};
context.window = context;
vm.createContext(context);
vm.runInContext(proSource, context, {filename:'hardware-fidelity-pro-block.js'});

assert(typeof proListeners.pointerdown === 'function'
  && typeof proListeners.pointerup === 'function'
  && typeof proListeners.pointercancel === 'function',
  'PRO pointer listeners were not installed');
assert(typeof documentListeners.visibilitychange === 'function',
  'PRO visibility release listener was not installed');

let event = makeEvent(41);
proListeners.pointerdown(event);
assert(event.prevented && event.immediate, 'AGC PRO pointerdown was not exclusively captured');
assert(classes.has('pressed'), 'PRO key did not enter pressed presentation state');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === 1,
  'PRO pointerdown did not assert exactly one maintained contact');
assert(calls.some(call => call[0] === 'capture' && call[1] === 41),
  'PRO pointer capture was not requested');

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

// Entering CLOCK must release first, then call the original transition.
event = makeEvent(71);
proListeners.pointerdown(event);
const beforeClock = calls.length;
const result = context.enterClock('test-clock', true);
const after = calls.slice(beforeClock);
assert(result === 'clock-result' && baseEnterClockCalls === 1,
  'PRO enterClock wrapper did not preserve the original transition result');
assert(after.length >= 2 && after[0][0] === 'proceed' && after[0][1] === false
  && after[1][0] === 'enterClock',
  'enterClock did not release PRO before changing mode');

// Outside AGC mode PRO must be ignored and left for non-AGC presentation paths.
context.mode = 'clock';
const pressesBeforeClockMode = calls.filter(call => call[0] === 'proceed' && call[1] === true).length;
event = makeEvent(81);
proListeners.pointerdown(event);
assert(!event.prevented && !event.immediate,
  'PRO was swallowed outside AGC mode');
assert(calls.filter(call => call[0] === 'proceed' && call[1] === true).length === pressesBeforeClockMode,
  'PRO asserted channel 032 outside AGC mode');
context.mode = 'agc';

// A failed electrical make must clear local ownership, restore released level,
// and report the failure through the existing AGC error path.
throwOnPress = true;
event = makeEvent(91);
proListeners.pointerdown(event);
throwOnPress = false;
assert(failures.length === 1 && failures[0] === 'synthetic PRO failure',
  'failed PRO make did not reach agcFailure');
assert(!classes.has('pressed'), 'failed PRO make left the key visually held');
const finalReleases = calls.filter(call => call[0] === 'proceed' && call[1] === false).length;
assert(finalReleases === 5,
  `failed PRO make did not restore released level; releases=${finalReleases}`);

console.log('PRO electrical smoke: PASS');
console.log('  maintained make/release, pointer ownership, cancel/hidden cleanup, CLOCK release ordering, non-AGC bypass, and failure cleanup verified');
