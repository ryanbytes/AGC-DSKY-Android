#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/keyboard-electrical-interlock.js'),
  'utf8'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeButton(key) {
  const classes = new Set();
  return {
    dataset:{key},
    classList:{
      add(name){ classes.add(name); },
      remove(name){ classes.delete(name); },
      contains(name){ return classes.has(name); }
    },
    setPointerCapture(){},
    releasePointerCapture(){}
  };
}

function makeEvent(button, pointerId) {
  return {
    pointerId,
    target:{ closest(selector){ return selector === '[data-key]' ? button : null; } },
    prevented:false,
    stopped:false,
    immediate:false,
    preventDefault(){ this.prevented = true; },
    stopPropagation(){ this.stopped = true; },
    stopImmediatePropagation(){ this.immediate = true; }
  };
}

const windowListeners = Object.create(null);
const documentListeners = Object.create(null);
const timers = new Map();
let nextTimer = 1;
const calls = [];

function addListener(bucket, type, fn) {
  (bucket[type] ||= []).push(fn);
}
function dispatch(bucket, type, event) {
  for (const fn of bucket[type] || []) fn(event);
}
function flushTimers() {
  while (timers.size) {
    const batch = Array.from(timers.entries());
    timers.clear();
    for (const [, fn] of batch) fn();
  }
}

const core = {
  keyPress(code){ calls.push(['make', code]); return 1; },
  keyRelease(){ calls.push(['reset']); return true; }
};

const context = {
  console,
  mode:'agc',
  localStorage:{ getItem(){ return '0'; } },
  setTimeout(fn){ const id = nextTimer++; timers.set(id, fn); return id; },
  clearTimeout(id){ timers.delete(id); },
  window:null,
  document:{
    hidden:false,
    addEventListener(type, fn){ addListener(documentListeners, type, fn); }
  }
};
context.window = context;
context.addEventListener = function(type, fn){ addListener(windowListeners, type, fn); };
context.AGCDSKY = {
  getCore(){ return core; },
  scheduleAgcAutosave(){ calls.push(['autosave']); },
  hardwarePersonality(){
    return {keys:{
      '1':{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1},
      '2':{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1},
      P:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}
    }};
  }
};

vm.createContext(context);
vm.runInContext(source, context, {filename:'keyboard-electrical-interlock.js'});

const one = makeButton('1');
const two = makeButton('2');
const pro = makeButton('P');

// First normal key owns the series-contact cycle.
let e = makeEvent(one, 1);
dispatch(windowListeners, 'pointerdown', e);
assert(e.prevented && e.immediate, 'normal key must be owned at window capture');
flushTimers();
assert(calls.filter(c => c[0] === 'make').length === 1,
  'first normal key did not generate exactly one make');
assert(calls.find(c => c[0] === 'make')[1] === 0o01,
  'key 1 generated the wrong DSKY keycode');

// A second depressed normal key may move mechanically but the series wiring
// must prevent another electrical code while the first cycle is latched.
e = makeEvent(two, 2);
dispatch(windowListeners, 'pointerdown', e);
flushTimers();
assert(calls.filter(c => c[0] === 'make').length === 1,
  'overlapping second key generated an illegal second keycode');
let state = context.AGCDSKY.keyboardElectrical.state();
assert(state.down === 2 && state.keys.some(k => k.key === '2' && !k.accepted),
  'overlapping key was not retained as a mechanically-down but electrically-blocked switch');

// Releasing the accepted key while the blocked second key remains down must
// not assert KEYRST yet: the physical series chain has not returned to all-up.
e = makeEvent(one, 1);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'reset').length === 0,
  'KEYRST asserted before all normal keys were released');

// Once every normal key is up, KEYRST occurs exactly once.
e = makeEvent(two, 2);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'reset').length === 1,
  'all-released keyboard did not generate exactly one KEYRST');
state = context.AGCDSKY.keyboardElectrical.state();
assert(!state.cycleLatched && state.down === 0 && !state.electricalMade,
  'all-released keyboard did not return to its idle electrical state');

// The previously blocked key can only become a coded key after that complete
// all-up reset, on a new depression cycle.
e = makeEvent(two, 3);
dispatch(windowListeners, 'pointerdown', e);
flushTimers();
const makes = calls.filter(c => c[0] === 'make');
assert(makes.length === 2 && makes[1][1] === 0o02,
  'fresh post-KEYRST depression did not generate key 2 normally');
e = makeEvent(two, 3);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'reset').length === 2,
  'second complete key cycle did not end in KEYRST');

// PRO is outside the 18-key coding matrix. The electrical interlock must not
// consume its event or emit a channel-015 keycode; hardware-fidelity.js owns it.
e = makeEvent(pro, 9);
dispatch(windowListeners, 'pointerdown', e);
flushTimers();
assert(!e.prevented && !e.stopped && !e.immediate,
  'PRO was incorrectly swallowed by the normal-key series interlock');
assert(calls.filter(c => c[0] === 'make').length === 2,
  'PRO incorrectly generated a normal keyboard keycode');

// Fast tap still makes once and resets once; it cannot disappear between the
// mechanical contact timer and pointer release.
const fast = makeButton('1');
e = makeEvent(fast, 10);
dispatch(windowListeners, 'pointerdown', e);
e = makeEvent(fast, 10);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'make').length === 3,
  'fast tap failed to close the keyboard contact');
assert(calls.filter(c => c[0] === 'reset').length === 3,
  'fast tap failed to restore KEYRST');

console.log('keyboard electrical interlock smoke: PASS');
console.log('  single-code series chain, all-up KEYRST, PRO bypass, and fast tap verified');
