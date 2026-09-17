#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {installServiceRegistry} = require('./test-service-registry');

const asset = name => fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets', name), 'utf8');
const html = asset('index.html');
const keycodeSource = asset('dsky-keycodes.js');
const transitionSource = asset('runtime-transitions.js');
const inputSource = asset('dsky-input-runtime.js');
const clockSource = asset('clock-behavior.js');
const keyboardSource = asset('keyboard-electrical-interlock.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const add = (bucket, type, fn) => { (bucket[type] ||= []).push(fn); };
const dispatch = (bucket, type, event) => { for (const fn of bucket[type] || []) { fn(event); if (event.immediate) break; } };
const pointer = (win, doc, type, event) => { dispatch(win, type, event); if (!event.stopped && !event.immediate) dispatch(doc, type, event); };
const button = key => ({dataset:{key}, classList:{add(){},remove(){},contains(){return false;}}, setPointerCapture(){}, releasePointerCapture(){}});
const event = (target, id) => ({
  pointerId:id,
  target:{closest:selector => selector === '[data-key]' ? target : null},
  prevented:false, stopped:false, immediate:false,
  preventDefault(){ this.prevented = true; },
  stopPropagation(){ this.stopped = true; },
  stopImmediatePropagation(){ this.immediate = true; }
});
async function flush(count = 12) { for (let i = 0; i < count; i++) await Promise.resolve(); }

(async () => {
  const keyIndex = html.indexOf('<script src="dsky-keycodes.js"></script>');
  const apiIndex = html.indexOf('<script src="agc-api-runtime.js"></script>');
  const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
  const inputIndex = html.indexOf('<script src="dsky-input-runtime.js"></script>');
  const clockIndex = html.indexOf('<script src="clock-behavior.js"></script>');
  assert(keyIndex >= 0 && apiIndex > keyIndex && runtimeIndex > apiIndex && inputIndex > runtimeIndex && clockIndex > inputIndex,
    'key/API/runtime/input/CLOCK parser order changed');

  assert(!transitionSource.includes('const api = window.AGCDSKY') && !transitionSource.includes('api.appStatus') && !transitionSource.includes('api.getCore'),
    'transition runtime regained public-facade state/core dependency');
  assert(!inputSource.includes('const api = window.AGCDSKY') && !inputSource.includes('api.runtimeTransitions'),
    'input runtime regained public-facade runtime dependency');
  for (const marker of [
    'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
    "const transitions = registry?.get('AGCDSKY_RUNTIME');",
    "const input = registry?.get('AGCDSKY_INPUT');",
    'const snapshot = window.AGCDSKY_SNAPSHOT;',
    "registry.publish('AGCDSKY_CLOCK_BEHAVIOR',clockBehavior"
  ]) assert(clockSource.includes(marker), `direct CLOCK service marker missing: ${marker}`);
  for (const forbidden of ['const api = window.AGCDSKY', 'api?.runtimeTransitions', 'api?.inputRuntime', 'api.scheduleAgcAutosave']) {
    assert(!clockSource.includes(forbidden), `CLOCK behavior regained facade dependency: ${forbidden}`);
  }
  assert(!keyboardSource.includes('api.keyboardElectrical ='), 'keyboard runtime must not mutate the public facade');

  const win = {}, doc = {}, timers = new Map(), calls = [];
  let next = 1, now = 0, mode = 'clock', enterCount = 0, resolveLoad;
  const loadGate = new Promise(resolve => { resolveLoad = resolve; });
  const core = {
    keyPress(code){ calls.push(['make', code, now]); return 1; },
    keyRelease(){ calls.push(['reset', now]); return true; },
    proceedKey(){ return 1; }
  };
  async function baseEnterAgc(){
    enterCount++;
    if (mode === 'agc' || mode === 'agc-loading') return {mode};
    mode = 'agc-loading';
    calls.push(['enter', now]);
    await loadGate;
    mode = 'agc';
    return {mode};
  }
  function baseEnterClock(){ mode = 'clock'; return {mode}; }
  const lifecycle = {enterAgc:baseEnterAgc, enterClock:baseEnterClock, status(){ return {mode}; }};
  const coreSession = {core};
  const snapshot = Object.freeze({scheduleAutosave(reason){ calls.push(['snapshot-autosave', reason, now]); }});
  const api = {
    scheduleAgcAutosave(reason){ calls.push(['api-autosave', reason, now]); },
    hardwarePersonality(){ return {keys:{V:{contactMs:10, returnSoundMs:5, makePitch:520, returnPitch:330, soundGain:1}}}; }
  };
  const context = {
    console, Promise,
    performance:{now(){ return now; }},
    localStorage:{getItem(){ return '0'; }},
    setTimeout(fn, delay = 0){ const id = next++; timers.set(id, {fn, due:now + Math.max(0, Number(delay) || 0)}); return id; },
    clearTimeout(id){ timers.delete(id); },
    window:null,
    document:{hidden:false, addEventListener(type, fn){ add(doc, type, fn); }},
    AGCDSKY:api,
    AGCDSKY_LIFECYCLE:lifecycle,
    AGCDSKY_CORE_SESSION:coreSession,
    AGCDSKY_SNAPSHOT:snapshot
  };
  context.window = context;
  context.addEventListener = (type, fn) => add(win, type, fn);
  installServiceRegistry(context);
  Object.defineProperties(api, {
    runtimeTransitions:{enumerable:true,get:()=>context.AGCDSKY_RUNTIME||null},
    inputRuntime:{enumerable:true,get:()=>context.AGCDSKY_INPUT||null},
    clockBehavior:{enumerable:true,get:()=>context.AGCDSKY_CLOCK_BEHAVIOR||null},
    keyboardElectrical:{enumerable:true,get:()=>context.AGCDSKY_KEYBOARD_ELECTRICAL||null}
  });
  api.enterAgc = function(){ const runtime = context.AGCDSKY_RUNTIME; return runtime && runtime.enterAgc ? runtime.enterAgc('public AGCDSKY.enterAgc') : lifecycle.enterAgc(); };
  api.enterClock = function(){ const runtime = context.AGCDSKY_RUNTIME; return runtime && runtime.enterClock ? runtime.enterClock('CLOCK', true, 'public AGCDSKY.enterClock') : lifecycle.enterClock('CLOCK', true); };

  vm.createContext(context);
  vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
  const oldPublicEnter = api.enterAgc;
  const oldPublicClock = api.enterClock;
  vm.runInContext(transitionSource, context, {filename:'runtime-transitions.js'});
  vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
  vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});
  vm.runInContext(keyboardSource, context, {filename:'keyboard-electrical-interlock.js'});

  assert(api.enterAgc === oldPublicEnter && api.enterClock === oldPublicClock, 'runtime replaced public transition methods');
  assert(context.enterAgc === undefined && context.enterClock === undefined, 'runtime published classic transition globals');
  assert(context.AGCDSKY_RUNTIME === api.runtimeTransitions, 'runtime compatibility getter differs from registry owner');
  assert(context.AGCDSKY_INPUT === api.inputRuntime, 'input compatibility getter differs from registry owner');
  assert(context.AGCDSKY_CLOCK_BEHAVIOR === api.clockBehavior, 'CLOCK compatibility getter differs from registry owner');
  assert(context.AGCDSKY_KEYBOARD_ELECTRICAL === api.keyboardElectrical, 'keyboard compatibility getter differs from registry owner');
  assert(Object.isFrozen(api.clockBehavior) && Object.isFrozen(api.keyboardElectrical), 'published CLOCK/keyboard services must be frozen');

  const existing = api.enterAgc();
  await flush(2);
  assert(mode === 'agc-loading' && enterCount === 1, 'public entry did not start exactly one shared AGC load');

  const verb = button('V');
  let e = event(verb, 41);
  pointer(win, doc, 'pointerdown', e);
  assert(e.prevented && e.immediate, 'keyboard did not own VERB at window capture');
  e = event(verb, 41);
  pointer(win, doc, 'pointerup', e);
  let state = api.keyboardElectrical.state();
  assert(state.clockHandoffPending && state.cycleLatched, 'released VERB was not retained during AGC load');
  assert(enterCount === 1, 'keyboard started a second AGC load');
  assert(api.clockBehavior.snapshot().pendingKeys.length === 0, 'document CLOCK fallback also consumed a window-owned physical contact');

  resolveLoad();
  await existing;
  await flush();
  assert(mode === 'agc' && enterCount === 1, 'shared AGC load did not settle once');
  const makes = calls.filter(call => call[0] === 'make');
  assert(makes.length === 1 && makes[0][1] === 0o21, 'physical VERB handoff did not make Pinball octal 021 exactly once');
  const runtimeSnapshot = api.runtimeTransitions.snapshot();
  assert(runtimeSnapshot.lastTransition && runtimeSnapshot.lastTransition.reason === 'public AGCDSKY.enterAgc' && runtimeSnapshot.lastTransition.to === 'agc',
    'shared transition diagnostics lost the original owner');

  let guard = 0;
  while (timers.size) {
    let id = null, selected = null;
    for (const [candidateId, timer] of timers) {
      if (!selected || timer.due < selected.due || (timer.due === selected.due && candidateId < id)) { id = candidateId; selected = timer; }
    }
    timers.delete(id); now = Math.max(now, selected.due); selected.fn();
    if (++guard > 1000) throw new Error('timer loop did not settle');
  }
  assert(calls.filter(call => call[0] === 'reset').length === 1, 'physical handoff did not finish with one KEYRST');
  state = api.keyboardElectrical.state();
  assert(!state.cycleLatched && !state.electricalMade && !state.keyResetPending, 'physical electrical cycle remained latched');

  console.log('runtime transition integration smoke: PASS');
  console.log('  direct CLOCK registry/snapshot ownership coexists with window-capture keyboard handoff, one shared AGC load, Pinball 021, and one KEYRST');
})().catch(error => {
  console.error('runtime transition integration smoke: FAIL');
  console.error(error.stack || error);
  process.exitCode = 1;
});
