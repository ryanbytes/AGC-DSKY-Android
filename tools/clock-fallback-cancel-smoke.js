#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const keycodeSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-keycodes.js'), 'utf8');
const clockSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/clock-behavior.js'), 'utf8');

function fail(message) {
  console.error('CLOCK FALLBACK CANCEL SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'typeof transitions.clockRequested',
  'typeof transitions.onBeforeClock',
  'let promotionEpoch = 0',
  'function cancelClockInput()',
  'epoch !== promotionEpoch || transitions.clockRequested()',
  'transitions.onBeforeClock(cancelClockInput)'
]) {
  assert(clockSource.includes(marker), `clock fallback cancellation marker missing: ${marker}`);
}

const MODES = Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'});
let mode = MODES.CLOCK;
let clockPending = false;
let releaseAgc = null;
let beforeClockHook = null;
const handlers = Object.create(null);
const calls = [];
const timers = [];
const core = {};

const runtimeTransitions = {
  modes:MODES,
  mode(){ return mode; },
  core(){ return core; },
  clockRequested(){ return clockPending; },
  requestAgc(reason){
    calls.push(['request-agc', reason]);
    if (clockPending) return Promise.reject(new Error('CLOCK pending'));
    if (mode === MODES.AGC) return Promise.resolve({mode});
    mode = MODES.AGC_LOADING;
    return new Promise(resolve => {
      releaseAgc = () => {
        mode = MODES.AGC;
        calls.push(['agc-ready']);
        resolve({mode});
      };
    });
  },
  onBeforeClock(handler){
    beforeClockHook = handler;
    return () => { if (beforeClockHook === handler) beforeClockHook = null; };
  }
};
const inputRuntime = {
  ready(){ return mode === MODES.AGC && !clockPending; },
  keyMake(code){ calls.push(['make', code]); return 1; }
};
const AGCDSKY = {
  scheduleAgcAutosave(reason){ calls.push(['autosave', reason]); }
};
const documentObject = {
  addEventListener(type, fn){ handlers[type] = fn; }
};
const context = {
  AGCDSKY,
  AGCDSKY_RUNTIME:runtimeTransitions,
  AGCDSKY_INPUT:inputRuntime,
  console,
  Promise,
  document:documentObject,
  setTimeout(fn, delay){ timers.push({fn, delay}); return timers.length; },
  clearTimeout(){},
  window:null
};
context.window = context;
Object.defineProperties(AGCDSKY,{
  runtimeTransitions:{enumerable:true,get:()=>context.AGCDSKY_RUNTIME||null},
  inputRuntime:{enumerable:true,get:()=>context.AGCDSKY_INPUT||null},
  clockBehavior:{enumerable:true,get:()=>context.AGCDSKY_CLOCK_BEHAVIOR||null}
});
vm.createContext(context);
vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});

assert(AGCDSKY.clockBehavior, 'clock fallback did not initialize');
assert(AGCDSKY.clockBehavior === context.AGCDSKY_CLOCK_BEHAVIOR,
  'clock fallback compatibility getter did not resolve the service owner');
assert(typeof beforeClockHook === 'function',
  'clock fallback did not register pre-CLOCK cancellation hook');

function key(name) {
  return {
    dataset:{key:name},
    classList:{add(){},remove(){}},
    closest(selector){ return selector === '[data-key]' ? this : null; }
  };
}
function press(name) {
  let prevented = false;
  let stopped = false;
  handlers.pointerdown({
    target:key(name),
    preventDefault(){ prevented = true; },
    stopPropagation(){ stopped = true; }
  });
  assert(prevented && stopped, `${name} fallback event was not consumed`);
}
async function flush(count = 12) {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

(async () => {
  press('V');
  press('N');
  await flush(2);
  let snap = AGCDSKY.clockBehavior.snapshot();
  assert(mode === MODES.AGC_LOADING && snap.promotionInFlight,
    'fallback queue did not begin one AGC promotion');
  assert(snap.pendingKeys.join(',') === 'V,N',
    'fallback keys were not queued in contact order');
  assert(calls.filter(call => call[0] === 'request-agc').length === 1,
    'fallback queue started more than one AGC request');

  // Runtime transition authority marks CLOCK intent before invoking hooks.
  clockPending = true;
  beforeClockHook({reason:'app enterClock', from:MODES.AGC_LOADING});
  snap = AGCDSKY.clockBehavior.snapshot();
  assert(!snap.promotionInFlight && snap.pendingKeys.length === 0,
    'pre-CLOCK hook did not invalidate the fallback queue');

  // A new fallback key during the deferred window is consumed but not queued.
  press('V');
  snap = AGCDSKY.clockBehavior.snapshot();
  assert(snap.pendingKeys.length === 0 && !snap.promotionInFlight,
    'new fallback key was queued after CLOCK intent');

  releaseAgc();
  await flush();
  assert(calls.filter(call => call[0] === 'make').length === 0,
    'canceled fallback queue emitted a ghost channel-015 make');
  assert(calls.filter(call => call[0] === 'autosave').length === 0,
    'canceled fallback queue scheduled an AGC key autosave');
  snap = AGCDSKY.clockBehavior.snapshot();
  assert(snap.pendingKeys.length === 0 && !snap.promotionInFlight,
    'old async fallback drain reactivated after AGC load settled');

  console.log('CLOCK fallback cancel smoke: PASS');
  console.log('  queued fallback contacts are invalidated on CLOCK intent, later contacts are suppressed, and no ghost make/autosave survives AGC loading');
})().catch(error => fail(error && error.stack ? error.stack : String(error)));
