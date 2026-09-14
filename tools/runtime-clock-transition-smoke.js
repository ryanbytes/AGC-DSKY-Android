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
  'let deferredClockPromise = null',
  'function onBeforeClock(handler)',
  'function sharedEnterClock(...args)',
  'function sharedApiEnterClock(...args)',
  'window.enterClock = sharedEnterClock',
  'api.enterClock = sharedApiEnterClock',
  'clockTransitionInFlight:!!deferredClockPromise',
  'lastClockTransition',
  'clockEntryWrapped:clockEntryAvailable'
]) {
  assert(source.includes(marker), `runtime transition source missing CLOCK marker: ${marker}`);
}

async function main() {
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

  // Match app.js: one global CLOCK function accepts status/preserveAgc, while
  // the exported AGCDSKY convenience API always requests preserveAgc=true.
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

  let snap = AGCDSKY.runtimeTransitions.snapshot();
  assert(snap.lastClockTransition
      && snap.lastClockTransition.from === 'agc'
      && snap.lastClockTransition.executedFrom === 'agc'
      && snap.lastClockTransition.to === 'clock'
      && snap.lastClockTransition.deferred === false,
    'immediate CLOCK transition diagnostics were not recorded');
  assert(snap.beforeClockHooks === 1,
    'CLOCK transition hook-count diagnostics are wrong');

  unsubscribe();
  assert(AGCDSKY.runtimeTransitions.snapshot().beforeClockHooks === 0,
    'CLOCK cleanup-hook unsubscribe failed');

  // If CLOCK is requested during an owned AGC load, cleanup happens now but
  // the base CLOCK switch must wait for the async loader. Otherwise enterAgc's
  // completion would overwrite CLOCK and restart the AGC after the user left it.
  let loadingMode = 'clock';
  let releaseLoad;
  const loadingCalls = [];
  const loadingApi = {
    appStatus(){ return {mode:loadingMode}; },
    getCore(){ return {}; },
    async enterAgc(){
      loadingMode = 'agc-loading';
      loadingCalls.push(['agc-start']);
      await new Promise(resolve => { releaseLoad = resolve; });
      loadingMode = 'agc';
      loadingCalls.push(['agc-ready']);
    }
  };
  const loading = {
    AGCDSKY:loadingApi,
    console,
    window:null,
    __baseClock(status='DEFAULT', preserve=false){
      loadingCalls.push(['clock-base', loadingMode, status, preserve]);
      loadingMode = 'clock';
      return 'deferred-clock-result';
    }
  };
  loading.window = loading;
  vm.createContext(loading);
  vm.runInContext(`
    function enterClock(status='DEFAULT', preserveAgc=false) {
      return __baseClock(status, preserveAgc);
    }
    AGCDSKY.enterClock = () => enterClock('API DEFERRED', true);
  `, loading, {filename:'app-clock-loading-prelude.js'});
  vm.runInContext(source, loading, {filename:'runtime-transitions-loading.js'});

  let loadingHooks = 0;
  loadingApi.runtimeTransitions.onBeforeClock(info => {
    loadingHooks++;
    loadingCalls.push(['cleanup', info.from]);
  });
  const agcPromise = loading.enterAgc();
  await Promise.resolve();
  assert(loadingMode === 'agc-loading', 'deferred fixture did not enter agc-loading');
  const clockPromise = loading.enterClock('DEFERRED', true);
  assert(clockPromise && typeof clockPromise.then === 'function',
    'CLOCK request during AGC loading did not become a deferred Promise');
  assert(loadingHooks === 1, 'deferred CLOCK request did not run cleanup immediately');
  assert(!loadingCalls.some(call => call[0] === 'clock-base'),
    'base CLOCK transition ran before AGC loading settled');
  snap = loadingApi.runtimeTransitions.snapshot();
  assert(snap.transitionInFlight && snap.clockTransitionInFlight,
    'deferred CLOCK/AGC transition diagnostics were not both in flight');

  releaseLoad();
  await agcPromise;
  result = await clockPromise;
  assert(result === 'deferred-clock-result', 'deferred CLOCK result changed');
  assert(loadingMode === 'clock', 'deferred CLOCK request did not win after AGC load completion');
  const baseCall = loadingCalls.find(call => call[0] === 'clock-base');
  assert(baseCall && baseCall[1] === 'agc' && baseCall[2] === 'DEFERRED' && baseCall[3] === true,
    'deferred base CLOCK transition did not execute from settled AGC with original arguments');
  snap = loadingApi.runtimeTransitions.snapshot();
  assert(!snap.transitionInFlight && !snap.clockTransitionInFlight,
    'deferred transition diagnostics did not settle');
  assert(snap.lastClockTransition
      && snap.lastClockTransition.from === 'agc-loading'
      && snap.lastClockTransition.executedFrom === 'agc'
      && snap.lastClockTransition.to === 'clock'
      && snap.lastClockTransition.deferred === true,
    'deferred CLOCK transition diagnostics were wrong');

  // Partial AGC-only harnesses still get shared mode/core authority and cleanup
  // registration even when CLOCK entry surfaces are intentionally omitted.
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
  console.log('  immediate/API semantics, cleanup hooks, AGC-load serialization, diagnostics, and AGC-only harness compatibility verified');
}

main().catch(error => fail(error && error.stack ? error.stack : String(error)));
