#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const keycodeSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-keycodes.js'), 'utf8');
const inputSource = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/dsky-input-runtime.js'), 'utf8');
const source = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/keyboard-electrical-interlock.js'), 'utf8');
const KEY_CODES = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});
const MODES = Object.freeze({CLOCK:'clock',AGC_LOADING:'agc-loading',AGC:'agc'});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const marker of [
  'const runtime = api?.runtimeTransitions',
  'const input = api?.inputRuntime',
  'typeof runtime.clockRequested',
  'typeof runtime.onBeforeClock',
  'input.keyMake(code)',
  'input.keyReset(electricalCore)',
  'function releaseForClock()',
  'runtime.onBeforeClock(releaseForClock)'
]) {
  assert(source.includes(marker), `keyboard missing shared-owner marker: ${marker}`);
}
for (const forbidden of ['appStatus()', 'getCore()', '.keyPress(', '.keyRelease(', 'writeIo(0o15', 'window.enterClock =']) {
  assert(!source.includes(forbidden), `keyboard retained obsolete ownership: ${forbidden}`);
}

function installKeycodes(context) {
  vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
  assert(context.AGCDSKY_KEY_CODES && Object.isFrozen(context.AGCDSKY_KEY_CODES),
    'shared DSKY keycode table was not published/frozen');
}
function installInputRuntime(context) {
  vm.runInContext(inputSource, context, {filename:'dsky-input-runtime.js'});
  assert(context.AGCDSKY_INPUT === context.AGCDSKY.inputRuntime,
    'shared input runtime did not publish one controller reference');
}
function addListener(bucket, type, fn) {
  (bucket[type] ||= []).push(fn);
}
function dispatch(bucket, type, event) {
  for (const fn of bucket[type] || []) fn(event);
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
function makeTimers(nowRef) {
  const timers = new Map();
  let nextId = 1;
  return {
    timers,
    set(fn, delay=0){
      const id = nextId++;
      timers.set(id, {fn, due:nowRef.value + Math.max(0, Number(delay) || 0)});
      return id;
    },
    clear(id){ timers.delete(id); },
    flush(){
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
        nowRef.value = Math.max(nowRef.value, selected.due);
        selected.fn();
        if (++guard > 1000) throw new Error('timer loop did not settle');
      }
    }
  };
}

function createAgcHarness() {
  const win = Object.create(null);
  const doc = Object.create(null);
  const calls = [];
  const now = {value:0};
  const timer = makeTimers(now);
  let mode = MODES.AGC;
  let clockPending = false;
  let beforeClockHook = null;
  let hookRegistrations = 0;
  const core = {
    keyPress(code){ calls.push(['make', code, now.value]); return 1; },
    keyRelease(){ calls.push(['reset', now.value]); return true; }
  };
  const context = {
    console,
    performance:{now(){ return now.value; }},
    localStorage:{getItem(){ return '0'; }},
    setTimeout(fn, delay){ return timer.set(fn, delay); },
    clearTimeout(id){ timer.clear(id); },
    window:null,
    document:{hidden:false, addEventListener(type, fn){ addListener(doc, type, fn); }}
  };
  context.window = context;
  context.addEventListener = function(type, fn){ addListener(win, type, fn); };
  context.AGCDSKY = {
    runtimeTransitions:{
      modes:MODES,
      mode(){ return mode; },
      core(){ return core; },
      clockRequested(){ return clockPending; },
      async requestAgc(){ return {mode}; },
      onBeforeClock(handler){
        hookRegistrations++;
        beforeClockHook = handler;
        return () => { if (beforeClockHook === handler) beforeClockHook = null; };
      }
    },
    scheduleAgcAutosave(){ calls.push(['autosave', now.value]); },
    hardwarePersonality(){
      return {keys:{
        '1':{contactMs:10,returnSoundMs:5},
        '2':{contactMs:10,returnSoundMs:5},
        V:{contactMs:10,returnSoundMs:5}
      }};
    }
  };
  vm.createContext(context);
  installKeycodes(context);
  installInputRuntime(context);
  vm.runInContext(source, context, {filename:'keyboard-electrical-interlock.js'});
  return {
    context, win, doc, calls, now, timer, core,
    setMode(value){ mode = value; },
    setClockPending(value){ clockPending = !!value; },
    get beforeClockHook(){ return beforeClockHook; },
    get hookRegistrations(){ return hookRegistrations; }
  };
}

const h = createAgcHarness();
assert(typeof h.beforeClockHook === 'function' && h.hookRegistrations === 1,
  'keyboard did not register exactly one pre-CLOCK cleanup hook');

const one = makeButton('1');
const two = makeButton('2');
const pro = makeButton('P');

// One accepted coded switch per complete all-up cycle.
let event = makeEvent(one, 1);
dispatch(h.win, 'pointerdown', event);
assert(event.prevented && event.immediate, 'normal key was not owned at window capture');
h.timer.flush();
assert(h.calls.filter(c => c[0] === 'make').length === 1
    && h.calls.find(c => c[0] === 'make')[1] === 0o01,
  'first key did not generate exactly keycode 001');

event = makeEvent(two, 2);
dispatch(h.win, 'pointerdown', event);
h.timer.flush();
assert(h.calls.filter(c => c[0] === 'make').length === 1,
  'overlapping second key generated an illegal second keycode');
let state = h.context.AGCDSKY.keyboardElectrical.state();
assert(state.down === 2 && state.keys.some(k => k.key === '2' && !k.accepted),
  'overlapping key was not retained as mechanically down/electrically blocked');

dispatch(h.win, 'pointerup', makeEvent(one, 1));
assert(h.calls.filter(c => c[0] === 'reset').length === 0,
  'KEYRST asserted before all normal keys were released');
dispatch(h.win, 'pointerup', makeEvent(two, 2));
h.timer.flush();
assert(h.calls.filter(c => c[0] === 'reset').length === 1,
  'all-up series chain did not produce exactly one KEYRST');
state = h.context.AGCDSKY.keyboardElectrical.state();
assert(!state.cycleLatched && state.down === 0 && !state.electricalMade,
  'series chain did not return to idle after KEYRST');

// PRO is electrically outside the 18-key channel-015 matrix.
event = makeEvent(pro, 9);
dispatch(h.win, 'pointerdown', event);
assert(!event.prevented && !event.immediate,
  'normal-key interlock incorrectly swallowed PRO');
assert(h.calls.filter(c => c[0] === 'make').length === 1,
  'PRO incorrectly generated a channel-015 make');

// Fast touchscreen tap must still make, then hold through the minimum dwell.
const fast = makeButton('1');
dispatch(h.win, 'pointerdown', makeEvent(fast, 10));
dispatch(h.win, 'pointerup', makeEvent(fast, 10));
assert(h.calls.filter(c => c[0] === 'make').length === 2,
  'fast tap failed to close the key contact');
assert(h.calls.filter(c => c[0] === 'reset').length === 1,
  'fast tap asserted KEYRST in the same turn as make');
h.timer.flush();
assert(h.calls.filter(c => c[0] === 'reset').length === 2,
  'fast tap did not restore KEYRST after minimum dwell');

// Selecting CLOCK while a key is still held must force KEYRST synchronously
// before app.js stops the AGC. Do not wait out the normal 12-ms return dwell.
const held = makeButton('1');
dispatch(h.win, 'pointerdown', makeEvent(held, 20));
h.timer.flush();
assert(h.context.AGCDSKY.keyboardElectrical.state().electricalMade,
  'held-key transition fixture never made channel 015');
const beforeClock = h.calls.length;
h.setClockPending(true);
h.beforeClockHook({reason:'app enterClock', from:MODES.AGC});
h.calls.push(['clock-base', h.now.value]);
const transitionCalls = h.calls.slice(beforeClock);
assert(transitionCalls.length >= 2
    && transitionCalls[0][0] === 'reset'
    && transitionCalls[1][0] === 'clock-base',
  'pre-CLOCK cleanup did not assert KEYRST before the base CLOCK transition');
state = h.context.AGCDSKY.keyboardElectrical.state();
assert(state.down === 0 && !state.cycleLatched && !state.electricalMade && !state.keyResetPending,
  'pre-CLOCK cleanup left keyboard electrical state latched');
assert(!held.classList.contains('pressed'),
  'pre-CLOCK cleanup left the held key visually pressed');

// While CLOCK intent remains pending, later physical normal keys are swallowed
// at window capture and cannot start another channel-015 cycle.
const suppressed = makeButton('2');
const makesBeforeSuppressed = h.calls.filter(c => c[0] === 'make').length;
event = makeEvent(suppressed, 21);
dispatch(h.win, 'pointerdown', event);
h.timer.flush();
assert(event.prevented && event.immediate,
  'pending-CLOCK normal key was not swallowed at window capture');
assert(h.calls.filter(c => c[0] === 'make').length === makesBeforeSuppressed,
  'normal key generated channel 015 after CLOCK was requested');
assert(h.context.AGCDSKY.keyboardElectrical.state().down === 0,
  'pending-CLOCK key created mechanical/electrical pointer ownership');
h.setClockPending(false);

async function verifyClockHandoff() {
  const win = Object.create(null);
  const doc = Object.create(null);
  const calls = [];
  const now = {value:0};
  const timer = makeTimers(now);
  let mode = MODES.CLOCK;
  let clockPending = false;
  const core = {
    keyPress(code){ calls.push(['make', code, now.value]); return 1; },
    keyRelease(){ calls.push(['reset', now.value]); return true; }
  };
  const context = {
    console,
    performance:{now(){ return now.value; }},
    localStorage:{getItem(){ return '0'; }},
    setTimeout(fn, delay){ return timer.set(fn, delay); },
    clearTimeout(id){ timer.clear(id); },
    window:null,
    document:{hidden:false, addEventListener(type, fn){ addListener(doc, type, fn); }},
    press(key){ calls.push(['legacy-clock-press', key, now.value]); }
  };
  context.window = context;
  context.addEventListener = function(type, fn){ addListener(win, type, fn); };
  context.AGCDSKY = {
    runtimeTransitions:{
      modes:MODES,
      mode(){ return mode; },
      core(){ return core; },
      clockRequested(){ return clockPending; },
      async requestAgc(reason){
        calls.push(['transition-request', reason, now.value]);
        if (clockPending) throw new Error('CLOCK pending');
        if (mode === MODES.AGC) return {mode};
        mode = MODES.AGC_LOADING;
        calls.push(['enter-agc', now.value]);
        await Promise.resolve();
        mode = MODES.AGC;
        return {mode};
      },
      onBeforeClock(){ return () => {}; }
    },
    scheduleAgcAutosave(){ calls.push(['autosave', now.value]); },
    hardwarePersonality(){ return {keys:{V:{contactMs:10,returnSoundMs:5}}}; }
  };
  vm.createContext(context);
  installKeycodes(context);
  installInputRuntime(context);
  vm.runInContext(source, context, {filename:'keyboard-electrical-interlock-clock.js'});

  const verb = makeButton('V');
  event = makeEvent(verb, 41);
  dispatch(win, 'pointerdown', event);
  dispatch(win, 'pointerup', makeEvent(verb, 41));
  let clockState = context.AGCDSKY.keyboardElectrical.state();
  assert(clockState.clockHandoffPending && clockState.cycleLatched,
    'released CLOCK key did not remain owned during AGC startup');
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert(mode === MODES.AGC, 'CLOCK key did not promote to AGC mode');
  assert(calls.filter(c => c[0] === 'transition-request').length === 1,
    'CLOCK key requested more than one AGC transition');
  assert(calls.filter(c => c[0] === 'make').length === 1
      && calls.find(c => c[0] === 'make')[1] === 0o21,
    'original VERB contact was not forwarded as Pinball 021');
  assert(!calls.some(c => c[0] === 'legacy-clock-press'),
    'CLOCK handoff leaked into the synthetic clock editor');
  timer.flush();
  assert(calls.filter(c => c[0] === 'reset').length === 1,
    'released CLOCK-handoff key did not produce exactly one KEYRST');
  clockState = context.AGCDSKY.keyboardElectrical.state();
  assert(!clockState.cycleLatched && !clockState.electricalMade && !clockState.keyResetPending,
    'CLOCK-handoff key left channel 015 latched');
}

verifyClockHandoff().then(() => {
  console.log('keyboard electrical interlock smoke: PASS');
  console.log('  series-key exclusion, minimum KEYRST dwell, PRO bypass, pre-CLOCK release, pending-CLOCK suppression, and CLOCK -> AGC first-contact handoff verified');
}).catch(error => {
  console.error('keyboard electrical interlock smoke: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
