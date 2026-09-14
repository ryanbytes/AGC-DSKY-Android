#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const keycodeSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-keycodes.js'), 'utf8');
const inputSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-input-runtime.js'), 'utf8');
const keyboardSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/keyboard-electrical-interlock.js'), 'utf8');

function fail(message) {
  console.error('KEYBOARD CLOCK CANCEL SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'if (state.cancelled || !clockHandoffPending) return',
  'state.cancelled = true',
  'function releaseForClock()',
  'runtime.onBeforeClock(releaseForClock)'
]) {
  assert(keyboardSource.includes(marker), `keyboard cancellation marker missing: ${marker}`);
}

const MODES = Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'});
const windowListeners = Object.create(null);
const documentListeners = Object.create(null);
const calls = [];
const timers = new Map();
let nextTimer = 1;
let nowMs = 0;
let mode = MODES.CLOCK;
let releaseLoad = null;
let beforeClockHook = null;

function addListener(bucket, type, fn) {
  (bucket[type] ||= []).push(fn);
}
function dispatch(bucket, type, event) {
  for (const fn of bucket[type] || []) {
    fn(event);
    if (event.immediate) break;
  }
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
    target:{closest(selector){ return selector === '[data-key]' ? button : null; }},
    prevented:false,
    stopped:false,
    immediate:false,
    preventDefault(){ this.prevented = true; },
    stopPropagation(){ this.stopped = true; },
    stopImmediatePropagation(){ this.immediate = true; }
  };
}
async function flushMicrotasks(count = 12) {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

const core = {
  keyPress(code){ calls.push(['make', code, nowMs]); return 1; },
  keyRelease(){ calls.push(['reset', nowMs]); return true; }
};
const AGCDSKY = {
  runtimeTransitions:{
    modes:MODES,
    mode(){ return mode; },
    core(){ return core; },
    requestAgc(reason){
      calls.push(['request-agc', reason, nowMs]);
      if (mode === MODES.AGC) return Promise.resolve({mode});
      mode = MODES.AGC_LOADING;
      return new Promise(resolve => {
        releaseLoad = () => {
          mode = MODES.AGC;
          calls.push(['agc-ready', nowMs]);
          resolve({mode});
        };
      });
    },
    onBeforeClock(handler){
      beforeClockHook = handler;
      return () => { if (beforeClockHook === handler) beforeClockHook = null; };
    }
  },
  scheduleAgcAutosave(reason){ calls.push(['autosave', reason, nowMs]); },
  hardwarePersonality(){ return {keys:{V:{contactMs:10,returnSoundMs:5}}}; }
};
const context = {
  AGCDSKY,
  console,
  Promise,
  performance:{now(){ return nowMs; }},
  localStorage:{getItem(){ return '0'; }},
  setTimeout(fn, delay=0){
    const id = nextTimer++;
    timers.set(id, {fn, due:nowMs + Math.max(0, Number(delay) || 0)});
    return id;
  },
  clearTimeout(id){ timers.delete(id); },
  window:null,
  document:{hidden:false, addEventListener(type, fn){ addListener(documentListeners, type, fn); }},
  press(key){ calls.push(['legacy-clock-press', key, nowMs]); }
};
context.window = context;
context.addEventListener = function(type, fn){ addListener(windowListeners, type, fn); };
vm.createContext(context);
vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
vm.runInContext(keyboardSource, context, {filename:'keyboard-electrical-interlock.js'});

assert(typeof beforeClockHook === 'function',
  'keyboard did not register pre-CLOCK cancellation hook');

(async () => {
  const verb = makeButton('V');
  let event = makeEvent(verb, 41);
  dispatch(windowListeners, 'pointerdown', event);
  event = makeEvent(verb, 41);
  dispatch(windowListeners, 'pointerup', event); // fast tap closes contact path and begins AGC handoff

  let state = AGCDSKY.keyboardElectrical.state();
  assert(mode === MODES.AGC_LOADING && state.clockHandoffPending && state.cycleLatched,
    'fixture did not enter pending CLOCK -> AGC first-key handoff');
  assert(calls.filter(call => call[0] === 'make').length === 0,
    'keycode was emitted before AGC became ready');

  // User selects CLOCK while the AGC load is still in flight. Cleanup must
  // cancel the pending physical cycle immediately.
  beforeClockHook({reason:'app enterClock', from:MODES.AGC_LOADING});
  state = AGCDSKY.keyboardElectrical.state();
  assert(!state.clockHandoffPending && !state.cycleLatched && !state.electricalMade,
    'pre-CLOCK cleanup did not cancel pending first-key handoff');
  assert(!verb.classList.contains('pressed'),
    'pre-CLOCK cleanup left the key visually pressed');

  // The loader can still finish, but the old VERB contact must remain dead.
  releaseLoad();
  await flushMicrotasks();
  assert(calls.filter(call => call[0] === 'make').length === 0,
    'canceled first-key handoff resurrected as a ghost channel-015 make');
  assert(!calls.some(call => call[0] === 'autosave'),
    'canceled first-key handoff scheduled an AGC key autosave');
  state = AGCDSKY.keyboardElectrical.state();
  assert(!state.clockHandoffPending && !state.cycleLatched && !state.electricalMade,
    'canceled handoff re-latched keyboard electrical state after AGC load');

  console.log('keyboard CLOCK cancel smoke: PASS');
  console.log('  pending CLOCK -> AGC first-key contact is canceled cleanly and cannot reappear after async AGC loading completes');
})().catch(error => fail(error && error.stack ? error.stack : String(error)));
