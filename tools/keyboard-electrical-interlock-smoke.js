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
let nowMs = 0;
const calls = [];

function addListener(bucket, type, fn) {
  (bucket[type] ||= []).push(fn);
}
function dispatch(bucket, type, event) {
  for (const fn of bucket[type] || []) fn(event);
}
function runNextTimer() {
  if (!timers.size) return false;
  let selectedId = null;
  let selected = null;
  for (const [id, timer] of timers) {
    if (!selected || timer.due < selected.due || (timer.due === selected.due && id < selectedId)) {
      selectedId = id;
      selected = timer;
    }
  }
  timers.delete(selectedId);
  nowMs = Math.max(nowMs, selected.due);
  selected.fn();
  return true;
}
function flushTimers() {
  let guard = 0;
  while (runNextTimer()) {
    if (++guard > 1000) throw new Error('timer loop did not settle');
  }
}

const core = {
  keyPress(code){ calls.push(['make', code, nowMs]); return 1; },
  keyRelease(){ calls.push(['reset', nowMs]); return true; }
};

const context = {
  console,
  mode:'agc',
  performance:{now(){ return nowMs; }},
  localStorage:{ getItem(){ return '0'; } },
  setTimeout(fn, delay=0){
    const id = nextTimer++;
    timers.set(id, {fn, due:nowMs + Math.max(0, Number(delay) || 0)});
    return id;
  },
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
  scheduleAgcAutosave(){ calls.push(['autosave', nowMs]); },
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
assert(state.minKeycodeHoldMs === 12,
  'expected 12-ms best-estimate minimum keycode dwell');

// Releasing the accepted key while the blocked second key remains down must
// not assert KEYRST yet: the physical series chain has not returned to all-up.
e = makeEvent(one, 1);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'reset').length === 0,
  'KEYRST asserted before all normal keys were released');

// Once every normal key is up the reset may still wait out the minimum input
// dwell, but it must occur exactly once and then fully unlatch the keyboard.
e = makeEvent(two, 2);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'reset').length === 0,
  'KEYRST ignored the minimum electrical dwell');
state = context.AGCDSKY.keyboardElectrical.state();
assert(state.keyResetPending && state.cycleLatched,
  'all-up keyboard did not retain its cycle while the KEYRST dwell was pending');
flushTimers();
assert(calls.filter(c => c[0] === 'reset').length === 1,
  'all-released keyboard did not generate exactly one delayed KEYRST');
state = context.AGCDSKY.keyboardElectrical.state();
assert(!state.cycleLatched && state.down === 0 && !state.electricalMade && !state.keyResetPending,
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
assert(calls.filter(c => c[0] === 'reset').length === 1,
  'KEYRST should wait for the minimum dwell on the second key cycle');
flushTimers();
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

// A touchscreen fast tap makes once immediately, but KEYRST must not occur in
// that same turn.  The keycode stays asserted through the estimated D-filter
// interval so yaAGC can sample the make just as the hardware interface did.
const fast = makeButton('1');
e = makeEvent(fast, 10);
dispatch(windowListeners, 'pointerdown', e);
e = makeEvent(fast, 10);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'make').length === 3,
  'fast tap failed to close the keyboard contact');
assert(calls.filter(c => c[0] === 'reset').length === 2,
  'fast tap asserted KEYRST in the same turn as key make');
state = context.AGCDSKY.keyboardElectrical.state();
assert(state.keyResetPending && state.electricalMade,
  'fast tap did not retain the keycode during minimum dwell');
const fastMake = calls.filter(c => c[0] === 'make')[2];
flushTimers();
const resets = calls.filter(c => c[0] === 'reset');
assert(resets.length === 3,
  'fast tap failed to restore KEYRST after minimum dwell');
assert(resets[2][1] - fastMake[2] >= 12,
  'fast-tap keycode was not held for the required minimum electrical dwell');

console.log('keyboard electrical interlock smoke: PASS');
console.log('  single-code series chain, all-up KEYRST, 12-ms input dwell, PRO bypass, and fast tap verified');
