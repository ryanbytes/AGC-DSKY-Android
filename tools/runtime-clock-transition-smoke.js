#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/runtime-transitions.js'), 'utf8');

function fail(message) {
  console.error('RUNTIME CLOCK TRANSITION SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'const baseEnterClock = typeof window.enterClock',
  'const baseApiEnterClock = typeof api.enterClock',
  'const clockEntryAvailable',
  'function onBeforeClock(handler)',
  'function sharedEnterClock(...args)',
  'function sharedApiEnterClock(...args)',
  'window.enterClock = sharedEnterClock',
  'api.enterClock = sharedApiEnterClock',
  'lastClockTransition',
  'clockEntryWrapped:clockEntryAvailable'
]) {
  assert(source.includes(marker), `runtime transition source missing CLOCK marker: ${marker}`);
}

let mode = 'agc';
const calls = [];
const AGCDSKY = {
  appStatus(){ return {mode}; },
  getCore(){ return {}; },
  async enterAgc(){ mode = 'agc'; }
};
const context = {
  AGCDSKY,
  console,
  window:null,
  __baseClock(status='DEFAULT', preserve=false){
    calls.push(['base', status, preserve]);
    mode = 'clock';
    return 'clock-result';
  }
};
context.window = context;
vm.createContext(context);

// Match app.js: one global CLOCK function accepts status/preserveAgc, while the
// exported AGCDSKY convenience API deliberately calls it with preserveAgc=true.
vm.runInContext(`
  function enterClock(status='DEFAULT', preserveAgc=false) {
    return __baseClock(status, preserveAgc);
  }
  AGCDSKY.enterClock = () => enterClock('API LABEL', true);
`, context, {filename:'app-clock-prelude.js'});

const oldGlobal = context.enterClock;
const oldApi = AGCDSKY.enterClock;
vm.runInContext(source, context, {filename:'runtime-transitions.js'});

assert(context.enterClock !== oldGlobal, 'global CLOCK entry was not wrapped');
assert(AGCDSKY.enterClock !== oldApi, 'AGCDSKY CLOCK entry was not wrapped');
assert(AGCDSKY.runtimeTransitions, 'runtime transition service was not published');
assert(AGCDSKY.runtimeTransitions.snapshot().clockEntryWrapped === true,
  'production-style CLOCK surfaces were not marked wrapped');

let hooks = 0;
const seen = [];
const unsubscribe = AGCDSKY.runtimeTransitions.onBeforeClock(info => {
  hooks++;
  seen.push([info.reason, info.from]);
});

let result = context.enterClock('DIRECT', false);
assert(result === 'clock-result', 'global CLOCK result changed');
assert(hooks === 1, 'global CLOCK entry did not run exactly one cleanup hook');
assert(calls[0][1] === 'DIRECT' && calls[0][2] === false,
  'global CLOCK arguments changed through the coordinator');
assert(seen[0][0] === 'app enterClock' && seen[0][1] === 'agc',
  'cleanup hook did not receive the pre-transition AGC state');

mode = 'agc';
result = AGCDSKY.enterClock('IGNORED', false);
assert(result === 'clock-result', 'AGCDSKY CLOCK result changed');
assert(hooks === 2, 'AGCDSKY CLOCK entry did not run exactly one additional hook');
assert(calls[1][1] === 'API LABEL' && calls[1][2] === true,
  'AGCDSKY.enterClock lost its historical preserveAgc=true behavior');

const snap = AGCDSKY.runtimeTransitions.snapshot();
assert(snap.lastClockTransition
    && snap.lastClockTransition.from === 'agc'
    && snap.lastClockTransition.to === 'clock'
    && snap.lastClockTransition.reason === 'app enterClock',
  'CLOCK transition diagnostics were not recorded');
assert(snap.beforeClockHooks === 1,
  'CLOCK transition hook-count diagnostics are wrong');

unsubscribe();
assert(AGCDSKY.runtimeTransitions.snapshot().beforeClockHooks === 0,
  'CLOCK cleanup-hook unsubscribe failed');

// Partial AGC-only harnesses must still get mode/core/input authority and the
// cleanup-hook registry even when they intentionally omit CLOCK entry surfaces.
let partialMode = 'clock';
const partialApi = {
  appStatus(){ return {mode:partialMode}; },
  getCore(){ return {}; },
  async enterAgc(){ partialMode = 'agc'; }
};
const partial = {AGCDSKY:partialApi, console, window:null};
partial.window = partial;
partial.enterAgc = partialApi.enterAgc;
vm.createContext(partial);
vm.runInContext(source, partial, {filename:'runtime-transitions-partial.js'});
assert(partialApi.runtimeTransitions,
  'AGC-only harness did not initialize shared runtime authority');
assert(partialApi.runtimeTransitions.snapshot().clockEntryWrapped === false,
  'AGC-only harness incorrectly reported CLOCK entry wrapping');
let partialHooks = 0;
partialApi.runtimeTransitions.onBeforeClock(() => { partialHooks++; });
assert(partialApi.runtimeTransitions.snapshot().beforeClockHooks === 1 && partialHooks === 0,
  'AGC-only harness could not register dormant CLOCK cleanup hooks');

console.log('runtime CLOCK transition smoke: PASS');
console.log('  global arguments, AGCDSKY preserveAgc semantics, cleanup hooks, diagnostics, and AGC-only harness compatibility verified');
