#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const fail = message => { console.error('CLOCK MODE BEHAVIOR FAIL: ' + message); process.exit(1); };

for (const marker of [
  "AGC_LOADING:'agc-loading'",
  "requestAgc('clock keypad handoff')",
  'await api.enterAgc()',
  'await waitForAgcReady()',
  'core.keyPress(code)',
  "scheduleAgcAutosave('clock keypad handoff')",
  'api.runtimeTransitions = runtime'
]) {
  if (!source.includes(marker)) fail('missing transition-controller marker: ' + marker);
}
for (const forbidden of [
  '[data-lamp="comp"]',
  'Math.random',
  'randomBetween',
  'startClockCompBurst',
  'scheduleClockCompIdle'
]) {
  if (source.includes(forbidden)) fail('clock COMP ACTY synthesis must remain disabled: ' + forbidden);
}
if (/fetch\s*\(/.test(source) || /XMLHttpRequest/.test(source)) fail('clock behavior must not be tied to network activity');

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
  const windowObject = {AGCDSKY};
  const documentObject = {addEventListener(name,fn){ handlers[name] = fn; }};
  const context = {
    window:windowObject,
    document:documentObject,
    console,
    setTimeout(fn,delay){ timers.push({fn,delay}); return timers.length; },
    clearTimeout(){},
    Promise
  };
  vm.runInNewContext(source, context, {filename:'clock-behavior.js'});
  return {
    AGCDSKY, windowObject, handlers, timers, keyPresses,
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
  const snapshot = fresh.AGCDSKY.runtimeTransitions.snapshot();
  if (snapshot.mode !== 'agc' || snapshot.transitionInFlight || snapshot.promotionInFlight || snapshot.pendingKeys.length) {
    fail('runtime transition snapshot did not settle cleanly');
  }
  if (!snapshot.lastTransition || snapshot.lastTransition.from !== 'clock' || snapshot.lastTransition.to !== 'agc') {
    fail('runtime transition did not record clock -> AGC');
  }

  // Multiple contacts while the first transition is awaiting the core must be
  // serialized through one enterAgc call and delivered in contact order.
  const queued = createHarness();
  let releaseLoad;
  queued.setEnterImpl(() => {
    queued.mode = 'agc-loading';
    return new Promise(resolve => { releaseLoad = () => { queued.mode = 'agc'; resolve(); }; });
  });
  press(queued, 'V');
  press(queued, 'N');
  await flush(2);
  if (queued.AGCDSKY.runtimeTransitions.snapshot().pendingKeys.join(',') !== 'V,N') {
    fail('concurrent keypad contacts were not queued in order');
  }
  releaseLoad();
  await flush();
  if (queued.keyPresses.join(',') !== `${0o21},${0o37}`) fail('queued keypad contacts were not forwarded in order');

  // If AGC loading was already started by another caller, keypad promotion
  // waits for that transition instead of dropping the first DSKY contact.
  const loading = createHarness('agc-loading');
  loading.setEnterImpl(async () => {});
  press(loading, 'V');
  await flush(3);
  const poll = loading.timers.find(timer => timer.delay === 10);
  if (!poll) fail('pre-existing AGC load did not enter bounded readiness wait');
  loading.mode = 'agc';
  poll.fn();
  await flush();
  if (loading.keyPresses.length !== 1 || loading.keyPresses[0] !== 0o21) {
    fail('key was dropped while another AGC load was already in flight');
  }

  console.log('Clock mode behavior: PASS');
  console.log('  serialized clock->AGC promotion, queued first keys, and pre-existing load handoff verified');
})().catch(error => fail(error.stack || String(error)));
