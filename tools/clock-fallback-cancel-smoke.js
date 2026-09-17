#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {installServiceRegistry} = require('./test-service-registry');

const ROOT = path.resolve(__dirname, '..');
const keycodeSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-keycodes.js'), 'utf8');
const clockSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/clock-behavior.js'), 'utf8');
const fail = message => { console.error('CLOCK FALLBACK CANCEL SMOKE FAIL: ' + message); process.exit(1); };
const assert = (condition, message) => { if (!condition) fail(message); };

for (const marker of [
  'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
  "const transitions = registry?.get('AGCDSKY_RUNTIME');",
  "const input = registry?.get('AGCDSKY_INPUT');",
  'const snapshot = window.AGCDSKY_SNAPSHOT;',
  'typeof transitions.clockRequested',
  'typeof transitions.onBeforeClock',
  'let promotionEpoch = 0',
  'function cancelClockInput()',
  'epoch !== promotionEpoch || transitions.clockRequested()',
  'transitions.onBeforeClock(cancelClockInput)',
  "registry.publish('AGCDSKY_CLOCK_BEHAVIOR',clockBehavior"
]) assert(clockSource.includes(marker), `clock fallback cancellation marker missing: ${marker}`);
for (const forbidden of [
  'const api = window.AGCDSKY', 'api?.runtimeTransitions', 'api?.inputRuntime',
  'api.scheduleAgcAutosave', "window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_CLOCK_BEHAVIOR'"
]) assert(!clockSource.includes(forbidden), `CLOCK fallback regained public/ambient dependency: ${forbidden}`);

const MODES = Object.freeze({CLOCK:'clock', AGC_LOADING:'agc-loading', AGC:'agc'});
let mode = MODES.CLOCK;
let clockPending = false;
let releaseAgc = null;
let beforeClockHook = null;
const handlers = Object.create(null);
const calls = [];
const timers = [];

const runtime = {
  modes:MODES,
  mode(){ return mode; },
  clockRequested(){ return clockPending; },
  requestAgc(reason){
    calls.push(['request-agc', reason]);
    if (clockPending) return Promise.reject(new Error('CLOCK pending'));
    if (mode === MODES.AGC) return Promise.resolve({mode});
    mode = MODES.AGC_LOADING;
    return new Promise(resolve => {
      releaseAgc = () => { mode = MODES.AGC; calls.push(['agc-ready']); resolve({mode}); };
    });
  },
  onBeforeClock(handler){ beforeClockHook = handler; return () => { if (beforeClockHook === handler) beforeClockHook = null; }; }
};
const input = {
  ready(){ return mode === MODES.AGC && !clockPending; },
  keyMake(code){ calls.push(['make', code]); return 1; }
};
const snapshot = Object.freeze({scheduleAutosave(reason){ calls.push(['autosave', reason]); }});
const context = {
  AGCDSKY_SNAPSHOT:snapshot,
  console,
  Promise,
  document:{addEventListener(type, fn){ handlers[type] = fn; }},
  setTimeout(fn, delay){ timers.push({fn, delay}); return timers.length; },
  clearTimeout(){},
  window:null
};
context.window = context;
const registry = installServiceRegistry(context);
registry.publish('AGCDSKY_RUNTIME', runtime, 'clock cancel fixture');
registry.publish('AGCDSKY_INPUT', input, 'clock cancel fixture');
vm.createContext(context);
vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});
const behavior = registry.get('AGCDSKY_CLOCK_BEHAVIOR');
assert(behavior && Object.isFrozen(behavior), 'clock fallback did not publish one frozen service');
assert(typeof beforeClockHook === 'function', 'clock fallback did not register pre-CLOCK cancellation hook');

function key(name) {
  return {dataset:{key:name}, classList:{add(){}, remove(){}}, closest(selector){ return selector === '[data-key]' ? this : null; }};
}
function press(name) {
  let prevented = false, stopped = false;
  handlers.pointerdown({target:key(name), preventDefault(){ prevented = true; }, stopPropagation(){ stopped = true; }});
  assert(prevented && stopped, `${name} fallback event was not consumed`);
}
async function flush(count = 12) { for (let i = 0; i < count; i++) await Promise.resolve(); }

(async () => {
  press('V');
  press('N');
  await flush(2);
  let snap = behavior.snapshot();
  assert(mode === MODES.AGC_LOADING && snap.promotionInFlight, 'fallback queue did not begin one AGC promotion');
  assert(snap.pendingKeys.join(',') === 'V,N', 'fallback keys were not queued in contact order');
  assert(calls.filter(call => call[0] === 'request-agc').length === 1, 'fallback queue started more than one AGC request');

  clockPending = true;
  beforeClockHook({reason:'app enterClock', from:MODES.AGC_LOADING});
  snap = behavior.snapshot();
  assert(!snap.promotionInFlight && snap.pendingKeys.length === 0, 'pre-CLOCK hook did not invalidate the fallback queue');

  press('V');
  snap = behavior.snapshot();
  assert(snap.pendingKeys.length === 0 && !snap.promotionInFlight, 'new fallback key was queued after CLOCK intent');

  releaseAgc();
  await flush();
  assert(calls.filter(call => call[0] === 'make').length === 0, 'canceled fallback queue emitted a ghost channel-015 make');
  assert(calls.filter(call => call[0] === 'autosave').length === 0, 'canceled fallback queue scheduled an AGC autosave');
  assert(behavior.snapshot().pendingKeys.length === 0 && !behavior.snapshot().promotionInFlight, 'old async fallback drain reactivated after AGC load settled');

  console.log('CLOCK fallback cancel smoke: PASS');
  console.log('  registry-owned runtime/input plus snapshot-owned autosave preserve cancellation with no public AGCDSKY dependency or ghost contact');
})().catch(error => fail(error && error.stack ? error.stack : String(error)));
