#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {installServiceRegistry} = require('./test-service-registry');

const keycodeSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/dsky-keycodes.js'), 'utf8');
const transitionSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/runtime-transitions.js'), 'utf8');
const inputSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/dsky-input-runtime.js'), 'utf8');
const clockSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const fail = message => { console.error('CLOCK MODE BEHAVIOR FAIL: ' + message); process.exit(1); };

for (const marker of [
  'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
  "const transitions = registry?.get('AGCDSKY_RUNTIME');",
  "const input = registry?.get('AGCDSKY_INPUT');",
  'const snapshot = window.AGCDSKY_SNAPSHOT;',
  "requestAgc('clock keypad fallback')",
  'input.keyMake(code)',
  "snapshot.scheduleAutosave('clock keypad handoff')",
  "registry.publish('AGCDSKY_CLOCK_BEHAVIOR',clockBehavior"
]) {
  if (!clockSource.includes(marker)) fail('missing direct CLOCK fallback marker: ' + marker);
}
for (const forbidden of [
  'const api = window.AGCDSKY', 'api?.runtimeTransitions', 'api?.inputRuntime',
  'api.scheduleAgcAutosave', 'api.runtimeTransitions =', 'api.inputRuntime =', 'api.clockBehavior ='
]) {
  if (clockSource.includes(forbidden)) fail('CLOCK fallback regained public-facade dependency: ' + forbidden);
}
if (clockSource.includes('.keyPress(') || clockSource.includes('writeIo(0o15')) {
  fail('CLOCK fallback must not bypass the shared input runtime');
}
if (/fetch\s*\(/.test(keycodeSource + transitionSource + inputSource + clockSource) || /XMLHttpRequest/.test(keycodeSource + transitionSource + inputSource + clockSource)) {
  fail('CLOCK transition behavior must not depend on network activity');
}

function createHarness(initialMode = 'clock') {
  let mode = initialMode;
  let enterCount = 0;
  let savedReason = '';
  let enterImpl = async () => {
    enterCount++;
    if (mode === 'agc' || mode === 'agc-loading') return {mode};
    mode = 'agc-loading';
    await Promise.resolve();
    mode = 'agc';
    return {mode};
  };
  const keyPresses = [];
  const handlers = {};
  const timers = [];
  const core = {
    keyPress(code){ keyPresses.push(code); return 1; },
    keyRelease(){ return true; },
    proceedKey(){ return 1; }
  };
  const lifecycle = {
    enterAgc(){ return enterImpl(); },
    enterClock(){ mode = 'clock'; return {mode}; },
    status(){ return {mode}; }
  };
  const coreSession = {core};
  const snapshot = Object.freeze({scheduleAutosave(reason){ savedReason = reason; }});
  const AGCDSKY = {};
  const context = {
    AGCDSKY,
    AGCDSKY_LIFECYCLE:lifecycle,
    AGCDSKY_CORE_SESSION:coreSession,
    AGCDSKY_SNAPSHOT:snapshot,
    document:{addEventListener(name, fn){ handlers[name] = fn; }},
    console,
    setTimeout(fn, delay){ timers.push({fn, delay}); return timers.length; },
    clearTimeout(){},
    Promise,
    window:null
  };
  context.window = context;
  installServiceRegistry(context);
  Object.defineProperties(AGCDSKY, {
    runtimeTransitions:{enumerable:true,get:()=>context.AGCDSKY_RUNTIME||null},
    inputRuntime:{enumerable:true,get:()=>context.AGCDSKY_INPUT||null},
    clockBehavior:{enumerable:true,get:()=>context.AGCDSKY_CLOCK_BEHAVIOR||null}
  });
  AGCDSKY.enterAgc = function(){
    const runtime = context.AGCDSKY_RUNTIME;
    return runtime && runtime.enterAgc ? runtime.enterAgc('public AGCDSKY.enterAgc') : lifecycle.enterAgc();
  };
  AGCDSKY.enterClock = function(){
    const runtime = context.AGCDSKY_RUNTIME;
    return runtime && runtime.enterClock ? runtime.enterClock('CLOCK', true, 'public AGCDSKY.enterClock') : lifecycle.enterClock('CLOCK', true);
  };
  const publicEnterAgc = AGCDSKY.enterAgc;
  const publicEnterClock = AGCDSKY.enterClock;

  vm.createContext(context);
  vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
  vm.runInContext(transitionSource, context, {filename:'runtime-transitions.js'});
  vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
  vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});

  if (AGCDSKY.enterAgc !== publicEnterAgc || AGCDSKY.enterClock !== publicEnterClock) fail('runtime replaced stable public transition methods');
  if (context.enterAgc !== undefined || context.enterClock !== undefined) fail('runtime published classic transition globals');
  if (context.AGCDSKY_RUNTIME !== AGCDSKY.runtimeTransitions) fail('runtime compatibility getter differs from registry owner');
  if (context.AGCDSKY_INPUT !== AGCDSKY.inputRuntime) fail('input compatibility getter differs from registry owner');
  if (context.AGCDSKY_CLOCK_BEHAVIOR !== AGCDSKY.clockBehavior) fail('CLOCK compatibility getter differs from registry owner');
  if (!Object.isFrozen(context.AGCDSKY_CLOCK_BEHAVIOR)) fail('CLOCK behavior service is not frozen');

  return {
    AGCDSKY, context, handlers, timers, keyPresses,
    get mode(){ return mode; }, set mode(value){ mode = value; },
    get enterCount(){ return enterCount; },
    get savedReason(){ return savedReason; },
    setEnterImpl(fn){ enterImpl = fn; }
  };
}

function key(name) {
  return {dataset:{key:name}, classList:{add(){},remove(){}}, closest(selector){ return selector === '[data-key]' ? this : null; }};
}
function press(harness, name) {
  let prevented = false, stopped = false;
  harness.handlers.pointerdown({target:key(name), preventDefault(){ prevented = true; }, stopPropagation(){ stopped = true; }});
  if (!prevented || !stopped) fail(`${name} CLOCK keypad event was not intercepted`);
}
async function flush(count = 20) { for (let i = 0; i < count; i++) await Promise.resolve(); }

(async () => {
  const fresh = createHarness();
  press(fresh, 'V');
  await flush();
  if (fresh.mode !== 'agc' || fresh.enterCount !== 1) fail('first CLOCK key did not complete exactly one AGC promotion');
  if (fresh.keyPresses.length !== 1 || fresh.keyPresses[0] !== 0o21) fail('VERB did not reach Pinball as octal 021');
  if (fresh.savedReason !== 'clock keypad handoff') fail('CLOCK handoff did not route autosave through snapshot owner');
  if (fresh.timers.length !== 1 || fresh.timers[0].delay !== 90) fail('CLOCK handoff created an unexpected timer');
  const freshRuntime = fresh.context.AGCDSKY_RUNTIME.snapshot();
  const freshClock = fresh.context.AGCDSKY_CLOCK_BEHAVIOR.snapshot();
  if (freshRuntime.mode !== 'agc' || freshRuntime.transitionInFlight || freshClock.promotionInFlight || freshClock.pendingKeys.length) {
    fail('CLOCK handoff did not settle cleanly');
  }

  const queued = createHarness();
  let releaseLoad;
  queued.setEnterImpl(() => {
    queued.mode = 'agc-loading';
    return new Promise(resolve => { releaseLoad = () => { queued.mode = 'agc'; resolve({mode:'agc'}); }; });
  });
  press(queued, 'V');
  press(queued, 'N');
  await flush(2);
  if (queued.context.AGCDSKY_CLOCK_BEHAVIOR.snapshot().pendingKeys.join(',') !== 'V,N') fail('concurrent CLOCK contacts were not queued in order');
  releaseLoad();
  await flush();
  if (queued.keyPresses.join(',') !== `${0o21},${0o37}`) fail('queued CLOCK contacts were not forwarded in order');
  if (queued.savedReason !== 'clock keypad handoff') fail('queued CLOCK handoff did not schedule snapshot autosave');

  const loading = createHarness();
  let releaseDirectLoad;
  let starts = 0;
  loading.setEnterImpl(() => {
    starts++;
    loading.mode = 'agc-loading';
    return new Promise(resolve => { releaseDirectLoad = () => { loading.mode = 'agc'; resolve({mode:'agc'}); }; });
  });
  const direct = loading.AGCDSKY.enterAgc();
  await flush(2);
  press(loading, 'V');
  await flush(2);
  if (starts !== 1) fail('CLOCK keypad joined an existing AGC load by starting a second loader');
  releaseDirectLoad();
  await direct;
  await flush();
  if (loading.keyPresses.length !== 1 || loading.keyPresses[0] !== 0o21) fail('CLOCK key was dropped while public AGC entry was already loading');
  const directSnapshot = loading.context.AGCDSKY_RUNTIME.snapshot();
  if (!directSnapshot.lastTransition || directSnapshot.lastTransition.reason !== 'public AGCDSKY.enterAgc') fail('shared transition lost original public-entry ownership');

  console.log('Clock mode behavior: PASS');
  console.log('  registry runtime/input ownership, snapshot autosave, fallback queue, shared AGC load, stable public delegates, and Pinball key forwarding verified');
})().catch(error => fail(error.stack || String(error)));
