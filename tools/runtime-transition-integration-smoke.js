#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/index.html'), 'utf8');
const keycodeSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/dsky-keycodes.js'), 'utf8');
const transitionSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/runtime-transitions.js'), 'utf8');
const inputSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/dsky-input-runtime.js'), 'utf8');
const clockSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/clock-behavior.js'), 'utf8');
const keyboardSource = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/keyboard-electrical-interlock.js'), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }
function addListener(bucket,type,fn){(bucket[type] ||= []).push(fn)}
function dispatch(bucket,type,event){for(const fn of bucket[type]||[]){fn(event);if(event.immediate)break}}
function dispatchPointer(windowListeners,documentListeners,type,event){dispatch(windowListeners,type,event);if(!event.stopped&&!event.immediate)dispatch(documentListeners,type,event)}
function makeButton(key){const classes=new Set();return{dataset:{key},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},setPointerCapture(){},releasePointerCapture(){}}}
function makeEvent(button,pointerId){return{pointerId,target:{closest:s=>s==='[data-key]'?button:null},prevented:false,stopped:false,immediate:false,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.immediate=true}}}
async function flushMicrotasks(count=12){for(let i=0;i<count;i++)await Promise.resolve()}

async function main(){
  const apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>');
  const dreamSilenceIndex=html.indexOf('<script src="dream-silence.js"></script>');
  const keycodesIndex=html.indexOf('<script src="dsky-keycodes.js"></script>');
  const runtimeIndex=html.indexOf('<script src="runtime-transitions.js"></script>');
  const inputIndex=html.indexOf('<script src="dsky-input-runtime.js"></script>');
  const clockIndex=html.indexOf('<script src="clock-behavior.js"></script>');
  const cmIndex=html.indexOf('<script src="cm-mode.js"></script>');
  assert(keycodesIndex>=0&&apiIndex>keycodesIndex&&dreamSilenceIndex>apiIndex&&runtimeIndex>dreamSilenceIndex&&inputIndex>runtimeIndex&&clockIndex>inputIndex&&cmIndex>clockIndex,
    'script order must be shared keycodes -> API bootstrap -> dream silence -> runtime -> input runtime -> clock fallback -> CM config');
  assert(!html.includes('<script src="app.js"></script>'),'deleted app.js is still parser-loaded');
  assert(!transitionSource.includes('waitForAgcReady')&&!transitionSource.includes('LOAD_POLL_MS'),'shared transition service must not retain an independent loading poll loop');
  assert(clockSource.includes('window.AGCDSKY_KEY_CODES')&&keyboardSource.includes('window.AGCDSKY_KEY_CODES'),'clock and electrical layers must consume shared DSKY keycodes');
  assert(clockSource.includes('api?.inputRuntime')&&keyboardSource.includes('api?.inputRuntime'),'clock and electrical layers must consume shared input runtime');
  for(const [label,source] of [['clock',clockSource],['keyboard',keyboardSource]])for(const forbidden of ['.keyPress(','.keyRelease(','writeIo(0o15'])assert(!source.includes(forbidden),`${label} layer bypasses input runtime with ${forbidden}`);

  const windowListeners=Object.create(null),documentListeners=Object.create(null),timers=new Map();
  let nextTimer=1,nowMs=0,mode='clock',enterCount=0,resolveLoad;
  const loadGate=new Promise(resolve=>{resolveLoad=resolve}),calls=[];
  const core={keyPress(code){calls.push(['make',code,nowMs]);return 1},keyRelease(){calls.push(['reset',nowMs]);return true}};
  const AGCDSKY={appStatus(){return{mode}},async enterAgc(){enterCount++;if(mode==='agc'||mode==='agc-loading')return;mode='agc-loading';calls.push(['enter',nowMs]);await loadGate;mode='agc'},getCore(){return core},scheduleAgcAutosave(reason){calls.push(['autosave',reason,nowMs])},hardwarePersonality(){return{keys:{V:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}}}};
  const context={console,Promise,performance:{now(){return nowMs}},localStorage:{getItem(){return'0'}},setTimeout(fn,delay=0){const id=nextTimer++;timers.set(id,{fn,due:nowMs+Math.max(0,Number(delay)||0)});return id},clearTimeout(id){timers.delete(id)},window:null,document:{hidden:false,addEventListener(type,fn){addListener(documentListeners,type,fn)}},AGCDSKY};
  context.window=context;context.addEventListener=(type,fn)=>addListener(windowListeners,type,fn);context.enterAgc=AGCDSKY.enterAgc;const originalEnterAgc=context.enterAgc;
  vm.createContext(context);vm.runInContext(keycodeSource,context,{filename:'dsky-keycodes.js'});assert(context.AGCDSKY_KEY_CODES&&Object.isFrozen(context.AGCDSKY_KEY_CODES),'shared DSKY keycode bridge did not publish a frozen table');
  vm.runInContext(transitionSource,context,{filename:'runtime-transitions.js'});assert(AGCDSKY.runtimeTransitions,'runtime transition service did not publish on AGCDSKY');assert(context.AGCDSKY_RUNTIME===AGCDSKY.runtimeTransitions,'global and AGCDSKY transition references differ');assert(context.enterAgc!==originalEnterAgc&&AGCDSKY.enterAgc===context.enterAgc,'runtime service did not replace both global/API AGC entry references');
  vm.runInContext(inputSource,context,{filename:'dsky-input-runtime.js'});assert(context.AGCDSKY_INPUT===AGCDSKY.inputRuntime,'input runtime did not publish one shared controller');
  vm.runInContext(clockSource,context,{filename:'clock-behavior.js'});assert(AGCDSKY.clockBehavior,'clock fallback layer did not initialize');
  vm.runInContext(keyboardSource,context,{filename:'keyboard-electrical-interlock.js'});assert(AGCDSKY.keyboardElectrical,'keyboard electrical interlock did not initialize');

  const existingTransition=context.enterAgc();await flushMicrotasks(2);assert(mode==='agc-loading'&&enterCount===1,'direct API transition did not enter one agc-loading cycle');
  const verb=makeButton('V');let event=makeEvent(verb,41);dispatchPointer(windowListeners,documentListeners,'pointerdown',event);assert(event.prevented&&event.immediate,'electrical interlock did not own physical VERB at capture');event=makeEvent(verb,41);dispatchPointer(windowListeners,documentListeners,'pointerup',event);let state=AGCDSKY.keyboardElectrical.state();assert(state.clockHandoffPending&&state.cycleLatched,'released physical key was not retained during AGC startup');assert(enterCount===1,'keyboard started a second AGC transition');assert(!Array.from(timers.values()).some(timer=>timer.due-nowMs===10),'physical handoff unexpectedly started readiness polling');
  resolveLoad();await existingTransition;await flushMicrotasks();assert(mode==='agc'&&enterCount===1,'shared transition did not finish once in AGC mode');const makes=calls.filter(call=>call[0]==='make');assert(makes.length===1&&makes[0][1]===0o21,'original VERB contact was not forwarded as Pinball 021');
  const transitionState=AGCDSKY.runtimeTransitions.snapshot();assert(!transitionState.transitionInFlight&&transitionState.lastTransition&&transitionState.lastTransition.to==='agc'&&transitionState.lastTransition.reason==='app enterAgc','shared transition diagnostics changed');const clockState=AGCDSKY.clockBehavior.snapshot();assert(!clockState.promotionInFlight&&clockState.pendingKeys.length===0,'document fallback participated despite window capture');state=AGCDSKY.keyboardElectrical.state();assert(!state.clockHandoffPending&&state.electricalMade&&state.keyResetPending,'physical handoff did not enter make/KEYRST dwell');
  let guard=0;while(timers.size){let selectedId=null,selected=null;for(const [id,timer] of timers)if(!selected||timer.due<selected.due||(timer.due===selected.due&&id<selectedId)){selectedId=id;selected=timer}timers.delete(selectedId);nowMs=Math.max(nowMs,selected.due);selected.fn();if(++guard>1000)throw new Error('integration timer loop did not settle')}
  assert(calls.filter(call=>call[0]==='reset').length===1,'physical handoff did not produce exactly one KEYRST');state=AGCDSKY.keyboardElectrical.state();assert(!state.cycleLatched&&!state.electricalMade&&!state.keyResetPending,'channel-015 cycle remained latched after KEYRST');
  console.log('runtime transition integration smoke: PASS');
  console.log('  shared keycodes/runtime/input, API entry, physical join, no polling, and make/KEYRST verified');
}
main().catch(error=>{console.error('runtime transition integration smoke: FAIL');console.error(error&&error.stack?error.stack:error);process.exitCode=1});
