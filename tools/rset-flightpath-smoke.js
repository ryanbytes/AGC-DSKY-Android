#!/usr/bin/env node
'use strict';

/*
 * RSET / ERROR RESET fidelity gate.
 *
 * Comanche 055 PINBALL_GAME_BUTTONS_AND_LIGHTS documents ERROR RES as the
 * five-bit keyboard code 10010 (octal 022). Physical RSET therefore belongs on
 * the normal channel-015 / KEYRUPT1 path. Flight software's CHARIN dispatches
 * code 022 to ERROR; JavaScript must not synthesize the resulting alarm reset.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const appSource = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
const keycodesSource = fs.readFileSync(path.join(ASSETS, 'dsky-keycodes.js'), 'utf8');
const transitionsSource = fs.readFileSync(path.join(ASSETS, 'runtime-transitions.js'), 'utf8');
const keyboardSource = fs.readFileSync(path.join(ASSETS, 'keyboard-electrical-interlock.js'), 'utf8');
const clockSource = fs.readFileSync(path.join(ASSETS, 'clock-behavior.js'), 'utf8');

function fail(message) {
  console.error('RSET FLIGHT PATH FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

const mapMatch = appSource.match(/const\s+AGC_KEY\s*=\s*(\{[^}]+\})/s);
assert(mapMatch, 'app.js canonical keycode table missing');
const appMap = vm.runInNewContext(`(${mapMatch[1]})`, Object.create(null));
assert(appMap.R === 0o22, `RSET canonical keycode is ${String(appMap.R)}, expected octal 022`);
assert(!Object.prototype.hasOwnProperty.call(appMap, 'P'), 'PRO leaked into the normal keycode table');

// Neither physical input layer may directly manipulate display/error state.
for (const [file, source] of [
  ['keyboard-electrical-interlock.js', keyboardSource],
  ['clock-behavior.js', clockSource]
]) {
  for (const forbidden of ['clearLamps(', 'resetAgcFace(', 'cancelLampTest(', "press('R')", 'press("R")']) {
    assert(!source.includes(forbidden), `${file} contains synthetic RSET/reset behavior: ${forbidden}`);
  }
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
function dispatchPointer(win, doc, type, event) {
  dispatch(win, type, event);
  if (!event.stopped && !event.immediate) dispatch(doc, type, event);
}
function makeButton(key) {
  const classes = new Set();
  return {
    dataset:{key},
    classList:{add(name){classes.add(name);},remove(name){classes.delete(name);}},
    setPointerCapture(){},
    releasePointerCapture(){}
  };
}
function makeEvent(button, pointerId) {
  return {
    pointerId,
    target:{closest(selector){return selector === '[data-key]' ? button : null;}},
    prevented:false,
    stopped:false,
    immediate:false,
    preventDefault(){this.prevented=true;},
    stopPropagation(){this.stopped=true;},
    stopImmediatePropagation(){this.immediate=true;}
  };
}
async function flushMicrotasks(count=16) {
  for (let i=0; i<count; i++) await Promise.resolve();
}

async function main() {
  const win = Object.create(null);
  const doc = Object.create(null);
  const timers = new Map();
  const calls = [];
  let nextTimer = 1;
  let nowMs = 0;
  let mode = 'clock';
  let enterCount = 0;
  let resolveLoad;
  const loadGate = new Promise(resolve => { resolveLoad = resolve; });

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
      return {keys:{R:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}};
    }
  };
  const context = {
    console,
    Promise,
    Object,
    performance:{now(){return nowMs;}},
    localStorage:{getItem(){return '0';}},
    setTimeout(fn, delay=0){
      const id=nextTimer++;
      timers.set(id,{fn,due:nowMs+Math.max(0,Number(delay)||0)});
      return id;
    },
    clearTimeout(id){timers.delete(id);},
    AGCDSKY,
    window:null,
    document:{hidden:false,addEventListener(type,fn){addListener(doc,type,fn);}},
    press(key){calls.push(['legacy-press',key,nowMs]);}
  };
  context.window=context;
  context.addEventListener=function(type,fn){addListener(win,type,fn);};
  context.enterAgc=AGCDSKY.enterAgc;

  vm.createContext(context);
  // Reproduce app.js's top-level lexical table, then execute the same bridge
  // production uses. The bridge must resolve RSET=022 from that canonical map.
  vm.runInContext(`const AGC_KEY=${mapMatch[1]};`,context,{filename:'app-keycodes.js'});
  vm.runInContext(keycodesSource,context,{filename:'dsky-keycodes.js'});
  assert(context.AGCDSKY_KEY_CODES.R === 0o22, 'shared RSET keycode is not 022');

  vm.runInContext(transitionsSource,context,{filename:'runtime-transitions.js'});
  vm.runInContext(clockSource,context,{filename:'clock-behavior.js'});
  vm.runInContext(keyboardSource,context,{filename:'keyboard-electrical-interlock.js'});
  assert(AGCDSKY.keyboardElectrical, 'physical electrical interlock did not initialize');

  // CLOCK -> AGC: a fast physical RSET release while Comanche is loading must
  // retain the same switch cycle and deliver code 022 after the shared load.
  const rset=makeButton('R');
  let event=makeEvent(rset,41);
  dispatchPointer(win,doc,'pointerdown',event);
  assert(event.prevented && event.immediate, 'CLOCK RSET was not captured by the physical electrical owner');
  event=makeEvent(rset,41);
  dispatchPointer(win,doc,'pointerup',event);
  let state=AGCDSKY.keyboardElectrical.state();
  assert(state.clockHandoffPending && state.cycleLatched,
    'released CLOCK RSET was not retained during AGC startup');
  assert(enterCount === 1, `CLOCK RSET started AGC ${enterCount} times`);
  assert(!calls.some(call=>call[0]==='legacy-press'),
    'CLOCK RSET leaked into the synthetic app press/reset path');

  resolveLoad();
  await flushMicrotasks();
  assert(mode === 'agc', 'CLOCK RSET handoff did not reach AGC mode');
  let makes=calls.filter(call=>call[0]==='make');
  assert(makes.length === 1 && makes[0][1] === 0o22,
    `CLOCK RSET forwarded ${makes.length ? makes[0][1].toString(8) : 'no'} keycode instead of 022`);

  // Drain only the electrical-return timers. The resulting cycle must contain
  // one KEYRST and no synthetic clear/reset action.
  let guard=0;
  while(timers.size){
    let id=null, selected=null;
    for(const [candidateId,timer] of timers){
      if(!selected||timer.due<selected.due||(timer.due===selected.due&&candidateId<id)){id=candidateId;selected=timer;}
    }
    timers.delete(id); nowMs=Math.max(nowMs,selected.due); selected.fn();
    if(++guard>1000)throw new Error('CLOCK RSET timer loop did not settle');
  }
  assert(calls.filter(call=>call[0]==='reset').length===1,
    'CLOCK RSET did not finish with exactly one KEYRST');
  state=AGCDSKY.keyboardElectrical.state();
  assert(!state.cycleLatched&&!state.electricalMade&&!state.keyResetPending,
    'CLOCK RSET left channel-015 electrical state latched');

  // Already in AGC: RSET remains an ordinary physical channel-015 make. A fast
  // tap must produce another 022 and another KEYRST, with no mode transition.
  const entersBefore=enterCount;
  event=makeEvent(rset,51); dispatchPointer(win,doc,'pointerdown',event);
  event=makeEvent(rset,51); dispatchPointer(win,doc,'pointerup',event);
  makes=calls.filter(call=>call[0]==='make');
  assert(makes.length===2&&makes[1][1]===0o22,
    'AGC-mode RSET did not forward a second Pinball 022 make');
  assert(enterCount===entersBefore, 'AGC-mode RSET incorrectly started another AGC transition');
  assert(!calls.some(call=>call[0]==='legacy-press'),
    'AGC-mode RSET leaked into the synthetic app press/reset path');

  guard=0;
  while(timers.size){
    let id=null, selected=null;
    for(const [candidateId,timer] of timers){
      if(!selected||timer.due<selected.due||(timer.due===selected.due&&candidateId<id)){id=candidateId;selected=timer;}
    }
    timers.delete(id); nowMs=Math.max(nowMs,selected.due); selected.fn();
    if(++guard>1000)throw new Error('AGC RSET timer loop did not settle');
  }
  assert(calls.filter(call=>call[0]==='reset').length===2,
    'two physical RSET cycles did not produce exactly two KEYRST releases');

  console.log('RSET flight path smoke: PASS');
  console.log('  CLOCK handoff and AGC-mode physical RSET both deliver Pinball 022 + KEYRST with no synthetic JavaScript reset path');
}

main().catch(error=>fail(error && error.stack ? error.stack : String(error)));
