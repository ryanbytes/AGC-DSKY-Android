#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const keycodeSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/dsky-keycodes.js'),
  'utf8'
);
const inputSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/dsky-input-runtime.js'),
  'utf8'
);
const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/keyboard-electrical-interlock.js'),
  'utf8'
);
const KEY_CODES = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});
const MODES = Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(source.includes('const runtime = api?.runtimeTransitions'),
  'keyboard must consume shared runtime authority');
assert(source.includes('const input = api?.inputRuntime'),
  'keyboard must consume shared input runtime');
assert(!source.includes('appStatus()') && !source.includes('getCore()'),
  'keyboard must not interpret app mode/core through direct app APIs');
for (const forbidden of ['.keyPress(', '.keyRelease(', 'writeIo(0o15']) {
  assert(!source.includes(forbidden),
    `keyboard must not bypass input runtime with electrical primitive: ${forbidden}`);
}

function installKeycodes(context) {
  vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
  assert(context.AGCDSKY_KEY_CODES && Object.isFrozen(context.AGCDSKY_KEY_CODES),
    'shared DSKY keycode bridge did not publish a frozen table');
}

function installInputRuntime(context) {
  vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
  assert(context.AGCDSKY_INPUT === context.AGCDSKY.inputRuntime,
    'shared input runtime did not publish one controller reference');
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
  runtimeTransitions:{
    modes:MODES,
    mode(){ return MODES.AGC; },
    core(){ return core; },
    async requestAgc(){ return {mode:MODES.AGC}; }
  },
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
installKeycodes(context);
installInputRuntime(context);
vm.runInContext(source, context, {filename:'keyboard-electrical-interlock.js'});

const one = makeButton('1');
const two = makeButton('2');
const pro = makeButton('P');

let e = makeEvent(one, 1);
dispatch(windowListeners, 'pointerdown', e);
assert(e.prevented && e.immediate, 'normal key must be owned at window capture');
flushTimers();
assert(calls.filter(c => c[0] === 'make').length === 1,
  'first normal key did not generate exactly one make');
assert(calls.find(c => c[0] === 'make')[1] === 0o01,
  'key 1 generated the wrong DSKY keycode');

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

e = makeEvent(one, 1);
dispatch(windowListeners, 'pointerup', e);
assert(calls.filter(c => c[0] === 'reset').length === 0,
  'KEYRST asserted before all normal keys were released');

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

e = makeEvent(pro, 9);
dispatch(windowListeners, 'pointerdown', e);
flushTimers();
assert(!e.prevented && !e.stopped && !e.immediate,
  'PRO was incorrectly swallowed by the normal-key series interlock');
assert(calls.filter(c => c[0] === 'make').length === 2,
  'PRO incorrectly generated a normal keyboard keycode');

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

async function verifyClockHandoff() {
  const win = Object.create(null);
  const doc = Object.create(null);
  const queuedTimers = new Map();
  const handoffCalls = [];
  let timerId = 1;
  let clockNow = 0;
  let appMode = MODES.CLOCK;

  const clockCore = {
    keyPress(code){ handoffCalls.push(['make', code, clockNow]); return 1; },
    keyRelease(){ handoffCalls.push(['reset', clockNow]); return true; }
  };
  const clockContext = {
    console,
    performance:{now(){ return clockNow; }},
    localStorage:{getItem(){ return '0'; }},
    setTimeout(fn, delay=0){
      const id = timerId++;
      queuedTimers.set(id, {fn, due:clockNow + Math.max(0, Number(delay) || 0)});
      return id;
    },
    clearTimeout(id){ queuedTimers.delete(id); },
    window:null,
    document:{
      hidden:false,
      addEventListener(type, fn){ addListener(doc, type, fn); }
    },
    press(key){ handoffCalls.push(['legacy-clock-press', key, clockNow]); }
  };
  clockContext.window = clockContext;
  clockContext.addEventListener = function(type, fn){ addListener(win, type, fn); };
  clockContext.AGCDSKY = {
    scheduleAgcAutosave(){ handoffCalls.push(['autosave', clockNow]); },
    hardwarePersonality(){
      return {keys:{V:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}};
    }
  };
  clockContext.AGCDSKY.runtimeTransitions = {
    modes:MODES,
    mode(){ return appMode; },
    core(){ return clockCore; },
    async requestAgc(reason){
      handoffCalls.push(['transition-request', reason, clockNow]);
      if (appMode === MODES.AGC) return {mode:appMode};
      appMode = MODES.AGC_LOADING;
      handoffCalls.push(['enter-agc', clockNow]);
      await Promise.resolve();
      appMode = MODES.AGC;
      return {mode:appMode};
    }
  };

  vm.createContext(clockContext);
  installKeycodes(clockContext);
  installInputRuntime(clockContext);
  vm.runInContext(source, clockContext, {filename:'keyboard-electrical-interlock-clock.js'});

  const verb = makeButton('V');
  let event = makeEvent(verb, 41);
  dispatch(win, 'pointerdown', event);
  assert(event.prevented && event.immediate,
    'clock VERB was not captured by the electrical interlock');
  event = makeEvent(verb, 41);
  dispatch(win, 'pointerup', event);

  let clockState = clockContext.AGCDSKY.keyboardElectrical.state();
  assert(clockState.clockHandoffPending && clockState.cycleLatched,
    'released clock key did not stay owned while AGC startup was pending');
  assert(!handoffCalls.some(c => c[0] === 'legacy-clock-press'),
    'clock key fell back into the synthetic clock command editor');

  for (let i = 0; i < 8; i++) await Promise.resolve();

  assert(appMode === MODES.AGC, 'clock key did not promote the app to AGC mode');
  assert(handoffCalls.filter(c => c[0] === 'transition-request').length === 1,
    'clock key did not request exactly one shared AGC transition');
  assert(handoffCalls.filter(c => c[0] === 'enter-agc').length === 1,
    'shared transition did not begin AGC exactly once');
  const handoffMakes = handoffCalls.filter(c => c[0] === 'make');
  assert(handoffMakes.length === 1 && handoffMakes[0][1] === 0o21,
    'original VERB contact was not forwarded as Pinball keycode 021');
  assert(!handoffCalls.some(c => c[0] === 'legacy-clock-press'),
    'clock handoff also executed the old synthetic-clock key path');

  clockState = clockContext.AGCDSKY.keyboardElectrical.state();
  assert(!clockState.clockHandoffPending && clockState.electricalMade && clockState.keyResetPending,
    'released handoff key did not enter normal electrical make/KEYRST dwell');

  let guard = 0;
  while (queuedTimers.size) {
    let selectedId = null;
    let selected = null;
    for (const [id, timer] of queuedTimers) {
      if (!selected || timer.due < selected.due || (timer.due === selected.due && id < selectedId)) {
        selectedId = id;
        selected = timer;
      }
    }
    queuedTimers.delete(selectedId);
    clockNow = Math.max(clockNow, selected.due);
    selected.fn();
    if (++guard > 1000) throw new Error('clock-handoff timer loop did not settle');
  }

  assert(handoffCalls.filter(c => c[0] === 'reset').length === 1,
    'released clock-handoff key did not generate exactly one KEYRST');
  clockState = clockContext.AGCDSKY.keyboardElectrical.state();
  assert(!clockState.cycleLatched && !clockState.electricalMade && !clockState.keyResetPending,
    'clock-handoff key left the channel-015 cycle latched');
}

verifyClockHandoff().then(() => {
  console.log('keyboard electrical interlock smoke: PASS');
  console.log('  shared keycodes/runtime/input authority, series chain, KEYRST dwell, PRO bypass, fast tap, and shared CLOCK -> AGC first-key handoff verified');
}).catch(error => {
  console.error('keyboard electrical interlock smoke: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
