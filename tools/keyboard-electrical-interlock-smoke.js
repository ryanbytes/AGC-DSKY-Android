#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const asset = name => fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets', name), 'utf8');
const keycodeSource = asset('dsky-keycodes.js');
const source = asset('keyboard-electrical-interlock.js');
const KEY_CODES = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});

function assert(condition,message){if(!condition)throw new Error(message);}
function addListener(bucket,type,fn){(bucket[type] ||= []).push(fn);}
function dispatch(bucket,type,event){for(const fn of bucket[type]||[])fn(event);}
function makeButton(key){const classes=new Set();return{dataset:{key},classList:{add(n){classes.add(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);}},setPointerCapture(){},releasePointerCapture(){}};}
function makeEvent(button,pointerId){return{pointerId,target:{closest(s){return s==='[data-key]'?button:null;}},prevented:false,stopped:false,immediate:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;}};}
function installKeycodes(context){context.AGC_KEY=KEY_CODES;vm.runInContext(keycodeSource,context,{filename:'dsky-keycodes.js'});assert(context.AGCDSKY_KEY_CODES&&Object.isFrozen(context.AGCDSKY_KEY_CODES),'shared DSKY keycodes did not initialize frozen');}

const windowListeners=Object.create(null),documentListeners=Object.create(null),timers=new Map();
let nextTimer=1,nowMs=0;const calls=[];
function runNextTimer(){if(!timers.size)return false;let id=null,sel=null;for(const [candidate,t] of timers){if(!sel||t.due<sel.due||(t.due===sel.due&&candidate<id)){id=candidate;sel=t;}}timers.delete(id);nowMs=Math.max(nowMs,sel.due);sel.fn();return true;}
function flushTimers(){let guard=0;while(runNextTimer())if(++guard>1000)throw new Error('timer loop did not settle');}
const core={keyPress(code){calls.push(['make',code,nowMs]);return 1;},keyRelease(){calls.push(['reset',nowMs]);return true;}};
const context={console,mode:'agc',performance:{now(){return nowMs;}},localStorage:{getItem(){return'0';}},setTimeout(fn,delay=0){const id=nextTimer++;timers.set(id,{fn,due:nowMs+Math.max(0,Number(delay)||0)});return id;},clearTimeout(id){timers.delete(id);},window:null,document:{hidden:false,addEventListener(type,fn){addListener(documentListeners,type,fn);}}};
context.window=context;context.addEventListener=(type,fn)=>addListener(windowListeners,type,fn);
context.AGCDSKY={getCore(){return core;},scheduleAgcAutosave(){calls.push(['autosave',nowMs]);},hardwarePersonality(){return{keys:{'1':{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1},'2':{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1},P:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}};}};
vm.createContext(context);installKeycodes(context);vm.runInContext(source,context,{filename:'keyboard-electrical-interlock.js'});

const one=makeButton('1'),two=makeButton('2'),pro=makeButton('P');let e=makeEvent(one,1);
dispatch(windowListeners,'pointerdown',e);assert(e.prevented&&e.immediate,'normal key must be owned at window capture');flushTimers();
assert(calls.filter(c=>c[0]==='make').length===1&&calls.find(c=>c[0]==='make')[1]===0o01,'key 1 did not generate exactly one correct make');
e=makeEvent(two,2);dispatch(windowListeners,'pointerdown',e);flushTimers();assert(calls.filter(c=>c[0]==='make').length===1,'overlapping second key generated an illegal second keycode');
let state=context.AGCDSKY.keyboardElectrical.state();assert(state.down===2&&state.keys.some(k=>k.key==='2'&&!k.accepted),'overlapping key was not mechanically retained/electrically blocked');assert(state.minKeycodeHoldMs===12,'expected 12-ms minimum keycode dwell');
e=makeEvent(one,1);dispatch(windowListeners,'pointerup',e);assert(calls.filter(c=>c[0]==='reset').length===0,'KEYRST asserted before all keys released');
e=makeEvent(two,2);dispatch(windowListeners,'pointerup',e);assert(calls.filter(c=>c[0]==='reset').length===0,'KEYRST ignored minimum dwell');state=context.AGCDSKY.keyboardElectrical.state();assert(state.keyResetPending&&state.cycleLatched,'all-up keyboard did not retain pending reset cycle');flushTimers();assert(calls.filter(c=>c[0]==='reset').length===1,'all-released keyboard did not generate one KEYRST');state=context.AGCDSKY.keyboardElectrical.state();assert(!state.cycleLatched&&state.down===0&&!state.electricalMade&&!state.keyResetPending,'keyboard did not return idle');

e=makeEvent(two,3);dispatch(windowListeners,'pointerdown',e);flushTimers();const makes=calls.filter(c=>c[0]==='make');assert(makes.length===2&&makes[1][1]===0o02,'fresh post-KEYRST key 2 failed');e=makeEvent(two,3);dispatch(windowListeners,'pointerup',e);flushTimers();assert(calls.filter(c=>c[0]==='reset').length===2,'second cycle did not end in KEYRST');
e=makeEvent(pro,9);dispatch(windowListeners,'pointerdown',e);flushTimers();assert(!e.prevented&&!e.stopped&&!e.immediate,'PRO was swallowed by normal-key interlock');assert(calls.filter(c=>c[0]==='make').length===2,'PRO generated a normal keycode');

const fast=makeButton('1');e=makeEvent(fast,10);dispatch(windowListeners,'pointerdown',e);e=makeEvent(fast,10);dispatch(windowListeners,'pointerup',e);assert(calls.filter(c=>c[0]==='make').length===3,'fast tap failed to make');assert(calls.filter(c=>c[0]==='reset').length===2,'fast tap asserted KEYRST immediately');state=context.AGCDSKY.keyboardElectrical.state();assert(state.keyResetPending&&state.electricalMade,'fast tap did not retain keycode during dwell');const fastMake=calls.filter(c=>c[0]==='make')[2];flushTimers();const resets=calls.filter(c=>c[0]==='reset');assert(resets.length===3&&resets[2][1]-fastMake[2]>=12,'fast-tap KEYRST dwell was too short');

async function verifyClockHandoff(){
  const win=Object.create(null),doc=Object.create(null),queuedTimers=new Map(),handoffCalls=[];let timerId=1,clockNow=0,appMode='clock';
  const clockCore={keyPress(code){handoffCalls.push(['make',code,clockNow]);return 1;},keyRelease(){handoffCalls.push(['reset',clockNow]);return true;}};
  const clockContext={console,performance:{now(){return clockNow;}},localStorage:{getItem(){return'0';}},setTimeout(fn,delay=0){const id=timerId++;queuedTimers.set(id,{fn,due:clockNow+Math.max(0,Number(delay)||0)});return id;},clearTimeout(id){queuedTimers.delete(id);},window:null,document:{hidden:false,addEventListener(type,fn){addListener(doc,type,fn);}},press(key){handoffCalls.push(['legacy-clock-press',key,clockNow]);}};
  clockContext.window=clockContext;clockContext.addEventListener=(type,fn)=>addListener(win,type,fn);
  clockContext.AGCDSKY={appStatus(){return{mode:appMode};},async enterAgc(){handoffCalls.push(['enter-agc',clockNow]);appMode='agc-loading';await Promise.resolve();appMode='agc';},getCore(){return clockCore;},scheduleAgcAutosave(){handoffCalls.push(['autosave',clockNow]);},hardwarePersonality(){return{keys:{V:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}};}};
  clockContext.AGCDSKY.runtimeTransitions={async requestAgc(reason){handoffCalls.push(['transition-request',reason,clockNow]);await clockContext.AGCDSKY.enterAgc();return{mode:appMode};}};
  vm.createContext(clockContext);installKeycodes(clockContext);vm.runInContext(source,clockContext,{filename:'keyboard-electrical-interlock-clock.js'});
  const verb=makeButton('V');let event=makeEvent(verb,41);dispatch(win,'pointerdown',event);assert(event.prevented&&event.immediate,'clock VERB was not captured');event=makeEvent(verb,41);dispatch(win,'pointerup',event);
  let s=clockContext.AGCDSKY.keyboardElectrical.state();assert(s.clockHandoffPending&&s.cycleLatched,'released clock key was not retained during startup');assert(!handoffCalls.some(c=>c[0]==='legacy-clock-press'),'clock key leaked to synthetic editor');
  for(let i=0;i<8;i++)await Promise.resolve();
  assert(appMode==='agc','clock key did not promote to AGC');assert(handoffCalls.filter(c=>c[0]==='transition-request').length===1,'clock key did not request exactly one shared transition');assert(handoffCalls.filter(c=>c[0]==='enter-agc').length===1,'shared transition called enterAgc more than once');const hm=handoffCalls.filter(c=>c[0]==='make');assert(hm.length===1&&hm[0][1]===0o21,'VERB contact was not Pinball 021');
  s=clockContext.AGCDSKY.keyboardElectrical.state();assert(!s.clockHandoffPending&&s.electricalMade&&s.keyResetPending,'handoff did not enter make/KEYRST dwell');
  let guard=0;while(queuedTimers.size){let id=null,sel=null;for(const [candidate,t] of queuedTimers){if(!sel||t.due<sel.due||(t.due===sel.due&&candidate<id)){id=candidate;sel=t;}}queuedTimers.delete(id);clockNow=Math.max(clockNow,sel.due);sel.fn();if(++guard>1000)throw new Error('clock-handoff timer loop did not settle');}
  assert(handoffCalls.filter(c=>c[0]==='reset').length===1,'clock handoff did not generate exactly one KEYRST');s=clockContext.AGCDSKY.keyboardElectrical.state();assert(!s.cycleLatched&&!s.electricalMade&&!s.keyResetPending,'clock handoff left channel 015 latched');
}

verifyClockHandoff().then(()=>{console.log('keyboard electrical interlock smoke: PASS');console.log('  shared keycodes, series chain, KEYRST dwell, PRO bypass, fast tap, and shared CLOCK -> AGC handoff verified');}).catch(error=>{console.error('keyboard electrical interlock smoke: FAIL');console.error(error?.stack||error);process.exitCode=1;});
