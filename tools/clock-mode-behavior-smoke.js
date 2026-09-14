#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const keycodeSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/dsky-keycodes.js'), 'utf8');
const transitionSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/runtime-transitions.js'), 'utf8');
const inputSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/dsky-input-runtime.js'), 'utf8');
const clockSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const fail = message => { console.error('CLOCK MODE BEHAVIOR FAIL: ' + message); process.exit(1); };
const KEY_CODES = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});

for (const marker of [
  'const baseEnterAgc = api.enterAgc',
  'function beginAgc(',
  'await baseEnterAgc()',
  'if (transitionPromise) return transitionPromise',
  'ready:next.mode === MODES.AGC',
  'window.enterAgc = sharedEnterAgc',
  'api.enterAgc = sharedEnterAgc',
  'api.runtimeTransitions = runtime'
]) {
  if (!transitionSource.includes(marker)) fail('missing runtime-transition marker: ' + marker);
}
for (const forbidden of [
  'waitForAgcReady',
  'LOAD_POLL_MS',
  'MAX_LOAD_POLLS'
]) {
  if (transitionSource.includes(forbidden)) fail('runtime transition service still contains polling fallback: ' + forbidden);
}
for (const marker of [
  'const AGC_KEY = window.AGCDSKY_KEY_CODES;',
  'const input = api?.inputRuntime;',
  "requestAgc('clock keypad fallback')",
  'input.keyMake(code)',
  "scheduleAgcAutosave('clock keypad handoff')",
  'api.clockBehavior = clockBehavior'
]) {
  if (!clockSource.includes(marker)) fail('missing clock-fallback marker: ' + marker);
}
if (clockSource.includes('.keyPress(') || clockSource.includes('writeIo(0o15')) {
  fail('clock fallback must not bypass the shared input runtime');
}
for (const forbidden of [
  '[data-lamp="comp"]',
  'Math.random',
  'randomBetween',
  'startClockCompBurst',
  'scheduleClockCompIdle'
]) {
  if (clockSource.includes(forbidden)) fail('clock COMP ACTY synthesis must remain disabled: ' + forbidden);
}
if (/fetch\s*\(/.test(keycodeSource + transitionSource + inputSource + clockSource)
    || /XMLHttpRequest/.test(keycodeSource + transitionSource + inputSource + clockSource)) {
  fail('clock transition behavior must not be tied to network activity');
}

function createHarness(initialMode = 'clock') {
  let mode = initialMode;
  let enterCount = 0;
  let enterImpl = async () => {
    enterCount++;
    if (mode === 'agc-loading') return;
    mode = 'agc-loading';
    await Promise.resolve();
    mode = 'agc';
  };
  const keyPresses = [];
  const handlers = {};
  const timers = [];
  const core = {keyPress(code){ keyPresses.push(code); }};
  const AGCDSKY = {
    appStatus(){ return {mode}; },
    enterAgc(){ return enterImpl(); },
    getCore(){ return core; },
    scheduleAgcAutosave(reason){ AGCDSKY.savedReason = reason; }
  };
  const documentObject = {addEventListener(name,fn){ handlers[name] = fn; }};
  const context = {
    AGCDSKY,
    document:documentObject,
    console,
    setTimeout(fn,delay){ timers.push({fn,delay}); return timers.length; },
    clearTimeout(){},
    Promise,
    window:null
  };
  context.window = context;
  context.enterAgc = AGCDSKY.enterAgc;
  const baseEnterAgc = context.enterAgc;
  vm.createContext(context);
  vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
  if (!context.AGCDSKY_KEY_CODES || !Object.isFrozen(context.AGCDSKY_KEY_CODES)) {
    fail('shared DSKY keycode bridge did not publish a frozen table');
  }
  vm.runInContext(transitionSource, context, {filename:'runtime-transitions.js'});
  if (context.enterAgc === baseEnterAgc || context.AGCDSKY.enterAgc !== context.enterAgc) {
    fail('runtime service did not replace both global/API AGC entry references');
  }
  vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
  if (context.AGCDSKY_INPUT !== context.AGCDSKY.inputRuntime) {
    fail('shared input runtime did not publish one controller reference');
  }
  vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});
  if (!context.AGCDSKY.clockBehavior) {
    fail('clock fallback did not initialize against shared keycode/runtime/input services');
  }
  return {
    AGCDSKY, context, handlers, timers, keyPresses,
    get mode(){ return mode; }, set mode(value){ mode = value; },
    get enterCount(){ return enterCount; }, setEnterImpl(fn){ enterImpl = fn; }
  };
}

function key(name) {
  return {
    dataset:{key:name},
    classList:{add(){},remove(){}},
    closest(selector){ return selector === '[data-key]' ? this : null; }
  };
}
function press(harness, name) {
  let prevented = false, stopped = false;
  harness.handlers.pointerdown({
    target:key(name),
    preventDefault(){ prevented = true; },
    stopPropagation(){ stopped = true; }
  });
  if (!prevented || !stopped) fail(`${name} clock keypad event was not intercepted`);
}
async function flush(count = 20) {
  for (let i = 0; i < count; i++) await Promise.resolve();
}

(async () => {
  const fresh = createHarness();
  if (fresh.timers.length) fail('clock mode started an unsolicited timer before keypad input');
  press(fresh, 'V');
  await flush();
  if (fresh.mode !== 'agc') fail('clock keypad entry did not hand off to AGC mode');
  if (fresh.enterCount !== 1) fail(`first-key handoff started AGC ${fresh.enterCount} times`);
  if (fresh.keyPresses.length !== 1 || fresh.keyPresses[0] !== 0o21) fail('original VERB key was not forwarded to the AGC');
  if (fresh.AGCDSKY.savedReason !== 'clock keypad handoff') fail('handoff did not schedule AGC autosave');
  if (fresh.timers.length !== 1 || fresh.timers[0].delay !== 90) fail('only keypad press animation timer should remain');

  const runtimeSnapshot = fresh.AGCDSKY.runtimeTransitions.snapshot();
  if (runtimeSnapshot.mode !== 'agc' || runtimeSnapshot.transitionInFlight) {
    fail('runtime transition snapshot did not settle cleanly');
  }
  if (!runtimeSnapshot.lastTransition
      || runtimeSnapshot.lastTransition.from !== 'clock'
      || runtimeSnapshot.lastTransition.to !== 'agc'
      || runtimeSnapshot.lastTransition.reason !== 'clock keypad fallback'
      || runtimeSnapshot.lastTransition.ready !== true) {
    fail('runtime transition did not record the fallback clock -> AGC handoff');
  }
  const clockSnapshot = fresh.AGCDSKY.clockBehavior.snapshot();
  if (clockSnapshot.promotionInFlight || clockSnapshot.pendingKeys.length) {
    fail('clock fallback queue did not settle cleanly');
  }

  const queued = createHarness();
  let releaseLoad;
  queued.setEnterImpl(() => {
    queued.mode = 'agc-loading';
    return new Promise(resolve => { releaseLoad = () => { queued.mode = 'agc'; resolve(); }; });
  });
  press(queued, 'V');
  press(queued, 'N');
  await flush(2);
  const duringRuntime = queued.AGCDSKY.runtimeTransitions.snapshot();
  const duringClock = queued.AGCDSKY.clockBehavior.snapshot();
  if (!duringRuntime.transitionInFlight || !duringClock.promotionInFlight) {
    fail('queued-contact handoff was not marked in flight');
  }
  if (duringClock.pendingKeys.join(',') !== 'V,N') {
    fail('concurrent keypad contacts were not queued in order');
  }
  releaseLoad();
  await flush();
  if (queued.keyPresses.join(',') !== `${0o21},${0o37}`) fail('queued keypad contacts were not forwarded in order');
  if (queued.AGCDSKY.clockBehavior.snapshot().pendingKeys.length) fail('queued keypad contacts were not drained');

  const loading = createHarness();
  let releaseDirectLoad;
  let directStarts = 0;
  loading.setEnterImpl(() => {
    directStarts++;
    loading.mode = 'agc-loading';
    return new Promise(resolve => { releaseDirectLoad = () => { loading.mode = 'agc'; resolve(); }; });
  });
  const directPromise = loading.context.enterAgc();
  await flush(2);
  if (loading.mode !== 'agc-loading' || directStarts !== 1) {
    fail('direct app AGC entry did not start one shared transition');
  }
  press(loading, 'V');
  await flush(3);
  if (directStarts !== 1) fail('keypad handoff restarted the underlying AGC loader');
  if (loading.timers.some(timer => timer.delay === 10)) fail('shared app entry unexpectedly fell back to polling');
  releaseDirectLoad();
  await directPromise;
  await flush();
  if (loading.keyPresses.length !== 1 || loading.keyPresses[0] !== 0o21) {
    fail('key was dropped while direct app AGC loading was already in flight');
  }
  const directSnapshot = loading.AGCDSKY.runtimeTransitions.snapshot();
  if (!directSnapshot.lastTransition
      || directSnapshot.lastTransition.reason !== 'app enterAgc'
      || directSnapshot.lastTransition.ready !== true) {
    fail('direct app transition ownership was not retained when keypad joined');
  }

  const failed = createHarness();
  let finishFailure;
  failed.setEnterImpl(() => {
    failed.mode = 'agc-loading';
    return new Promise(resolve => {
      finishFailure = () => { failed.mode = 'clock'; resolve(); };
    });
  });
  const appFailurePromise = failed.context.enterAgc();
  const requiredAgcPromise = failed.AGCDSKY.runtimeTransitions.requestAgc('keyboard readiness test');
  await flush(2);
  finishFailure();
  const appFailureResult = await appFailurePromise;
  if (!appFailureResult || appFailureResult.mode !== 'clock') {
    fail('direct app entry no longer resolves with app.js clock fallback state');
  }
  let readinessRejected = false;
  try {
    await requiredAgcPromise;
  } catch (error) {
    readinessRejected = /ended in clock mode/.test(String(error && error.message || error));
  }
  if (!readinessRejected) fail('AGC-required caller did not reject after app.js fell back to clock');
  const failedSnapshot = failed.AGCDSKY.runtimeTransitions.snapshot();
  if (!failedSnapshot.lastTransition
      || failedSnapshot.lastTransition.to !== 'clock'
      || failedSnapshot.lastTransition.ready !== false) {
    fail('failed app transition diagnostics did not preserve clock fallback outcome');
  }

  console.log('Clock mode behavior: PASS');
  console.log('  shared keycodes/runtime/input entry, fallback queue, no polling, and app-failure compatibility verified');
})().catch(error => fail(error.stack || String(error)));
