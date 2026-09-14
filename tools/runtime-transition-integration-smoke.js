#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/index.html'), 'utf8');
const transitionSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/runtime-transitions.js'), 'utf8');
const clockSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const keyboardSource = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/keyboard-electrical-interlock.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
    target:{ closest(selector){ return selector === '[data-key]' ? button : null; } },
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

async function main() {
  const appIndex = html.indexOf('<script src="app.js"></script>');
  const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
  const clockIndex = html.indexOf('<script src="clock-behavior.js"></script>');
  const cmIndex = html.indexOf('<script src="cm-mode.js"></script>');
  assert(appIndex >= 0 && runtimeIndex > appIndex && clockIndex > runtimeIndex && cmIndex > clockIndex,
    'script order must be app -> runtime transitions -> clock fallback -> CM dynamic features');

  const windowListeners = Object.create(null);
  const documentListeners = Object.create(null);
  const timers = new Map();
  let nextTimer = 1;
  let nowMs = 0;
  let mode = 'clock';
  let enterCount = 0;
  let resolveLoad;
  const loadGate = new Promise(resolve => { resolveLoad = resolve; });
  const calls = [];

  const core = {
    keyPress(code){ calls.push(['make', code, nowMs]); return 1; },
    keyRelease(){ calls.push(['reset', nowMs]); return true; }
  };

  const AGCDSKY = {
    appStatus(){ return {mode}; },
    async enterAgc(){
      enterCount++;
      if (mode === 'agc') return;
      if (mode === 'agc-loading') return;
      mode = 'agc-loading';
      calls.push(['enter', nowMs]);
      await loadGate;
      mode = 'agc';
    },
    getCore(){ return core; },
    scheduleAgcAutosave(reason){ calls.push(['autosave', reason, nowMs]); },
    hardwarePersonality(){
      return {keys:{V:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}};
    }
  };

  const context = {
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
    document:{
      hidden:false,
      addEventListener(type, fn){ addListener(documentListeners, type, fn); }
    },
    AGCDSKY,
    press(key){ calls.push(['legacy-clock-press', key, nowMs]); }
  };
  context.window = context;
  context.addEventListener = function(type, fn){ addListener(windowListeners, type, fn); };

  vm.createContext(context);
  vm.runInContext(transitionSource, context, {filename:'runtime-transitions.js'});
  assert(AGCDSKY.runtimeTransitions,
    'runtime transition service did not publish on AGCDSKY');
  assert(context.AGCDSKY_RUNTIME === AGCDSKY.runtimeTransitions,
    'global and AGCDSKY transition service references differ');

  vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});
  assert(AGCDSKY.clockBehavior,
    'clock fallback layer did not initialize against the transition service');

  vm.runInContext(keyboardSource, context, {filename:'keyboard-electrical-interlock.js'});
  assert(AGCDSKY.keyboardElectrical,
    'keyboard electrical interlock did not initialize');

  // Start AGC loading from a non-keyboard caller. The physical keyboard must
  // join this one authoritative transition rather than calling enterAgc again
  // or maintaining its own loading poll loop.
  const existingTransition = AGCDSKY.runtimeTransitions.requestAgc('external startup');
  await flushMicrotasks(2);
  assert(mode === 'agc-loading', 'external transition did not enter agc-loading');
  assert(enterCount === 1, 'external transition did not call enterAgc exactly once');

  const verb = makeButton('V');
  let event = makeEvent(verb, 41);
  dispatch(windowListeners, 'pointerdown', event);
  assert(event.prevented && event.immediate,
    'electrical interlock did not own the physical VERB contact at window capture');

  // Fast tap while loading. finishPointer closes the contact immediately; the
  // shared coordinator should retain it until the already-running load ends.
  event = makeEvent(verb, 41);
  dispatch(windowListeners, 'pointerup', event);
  let state = AGCDSKY.keyboardElectrical.state();
  assert(state.clockHandoffPending && state.cycleLatched,
    'released physical key was not retained during shared AGC startup');
  assert(enterCount === 1,
    'keyboard started a second AGC transition instead of joining the existing one');
  assert(!calls.some(call => call[0] === 'legacy-clock-press'),
    'physical key leaked into the obsolete synthetic clock editor');

  resolveLoad();
  await existingTransition;
  await flushMicrotasks();

  assert(mode === 'agc', 'shared transition did not finish in AGC mode');
  assert(enterCount === 1,
    'shared transition called enterAgc more than once');
  const makes = calls.filter(call => call[0] === 'make');
  assert(makes.length === 1 && makes[0][1] === 0o21,
    'original VERB contact was not forwarded as Pinball keycode 021');
  assert(!calls.some(call => call[0] === 'legacy-clock-press'),
    'handoff executed the synthetic clock key path');

  const transitionState = AGCDSKY.runtimeTransitions.snapshot();
  assert(!transitionState.transitionInFlight,
    'shared transition remained marked in flight after completion');
  assert(transitionState.lastTransition && transitionState.lastTransition.to === 'agc',
    'shared transition diagnostics did not record AGC completion');
  assert(transitionState.lastTransition.reason === 'external startup',
    'joining keyboard request incorrectly replaced the owner/reason of the existing transition');
  const clockState = AGCDSKY.clockBehavior.snapshot();
  assert(!clockState.promotionInFlight && clockState.pendingKeys.length === 0,
    'document-level fallback incorrectly participated in the window-capture electrical handoff');

  state = AGCDSKY.keyboardElectrical.state();
  assert(!state.clockHandoffPending && state.electricalMade && state.keyResetPending,
    'physical handoff did not enter the normal make/KEYRST dwell after AGC became ready');

  let guard = 0;
  while (timers.size) {
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
    if (++guard > 1000) throw new Error('integration timer loop did not settle');
  }

  assert(calls.filter(call => call[0] === 'reset').length === 1,
    'physical handoff did not produce exactly one KEYRST');
  state = AGCDSKY.keyboardElectrical.state();
  assert(!state.cycleLatched && !state.electricalMade && !state.keyResetPending,
    'channel-015 electrical cycle remained latched after KEYRST');

  console.log('runtime transition integration smoke: PASS');
  console.log('  extracted transition service, clock fallback isolation, dynamic electrical owner, and make/KEYRST verified');
}

main().catch(error => {
  console.error('runtime transition integration smoke: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
