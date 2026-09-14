#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const asset=name=>fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets',name),'utf8');
const html=asset('index.html'),keycodeSource=asset('dsky-keycodes.js'),transitionSource=asset('runtime-transitions.js'),clockSource=asset('clock-behavior.js'),keyboardSource=asset('keyboard-electrical-interlock.js');
const KEY_CODES=Object.freeze({'1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37});
function assert(c,m){if(!c)throw new Error(m);}function add(b,t,f){(b[t] ||= []).push(f);}function dispatch(b,t,e){for(const f of b[t]||[]){f(e);if(e.immediate)break;}}function dispatchPointer(w,d,t,e){dispatch(w,t,e);if(!e.stopped&&!e.immediate)dispatch(d,t,e);}function button(key){const c=new Set();return{dataset:{key},classList:{add(n){c.add(n);},remove(n){c.delete(n);}},setPointerCapture(){},releasePointerCapture(){}};}function event(b,id){return{pointerId:id,target:{closest(s){return s==='[data-key]'?b:null;}},prevented:false,stopped:false,immediate:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;}};}async function flush(n=12){for(let i=0;i<n;i++)await Promise.resolve();}

async function main(){
 const order=['app.js','dream-silence.js','dsky-keycodes.js','runtime-transitions.js','clock-behavior.js','cm-mode.js'].map(n=>html.indexOf(`<script src="${n}"></script>`));
 assert(order.every(x=>x>=0)&&order.every((x,i)=>i===0||x>order[i-1]),'script order must be app -> dream silence -> shared keycodes -> runtime transitions -> clock fallback -> CM features');
 assert(!transitionSource.includes('waitForAgcReady')&&!transitionSource.includes('LOAD_POLL_MS'),'transition service must not poll');
 assert(clockSource.includes('window.AGCDSKY_KEY_CODES')&&keyboardSource.includes('window.AGCDSKY_KEY_CODES'),'both input layers must consume shared keycodes');

 const wl=Object.create(null),dl=Object.create(null),timers=new Map(),calls=[];let next=1,now=0,mode='clock',enterCount=0,resolveLoad;const loadGate=new Promise(r=>{resolveLoad=r;});
 const core={keyPress(code){calls.push(['make',code,now]);return 1;},keyRelease(){calls.push(['reset',now]);return true;}};
 const AGCDSKY={appStatus(){return{mode};},async enterAgc(){enterCount++;if(mode==='agc'||mode==='agc-loading')return;mode='agc-loading';calls.push(['enter',now]);await loadGate;mode='agc';},getCore(){return core;},scheduleAgcAutosave(reason){calls.push(['autosave',reason,now]);},hardwarePersonality(){return{keys:{V:{contactMs:10,returnSoundMs:5,makePitch:520,returnPitch:330,soundGain:1}}};}};
 const context={AGC_KEY:KEY_CODES,AGCDSKY,console,Promise,performance:{now(){return now;}},localStorage:{getItem(){return'0';}},setTimeout(fn,delay=0){const id=next++;timers.set(id,{fn,due:now+Math.max(0,Number(delay)||0)});return id;},clearTimeout(id){timers.delete(id);},window:null,document:{hidden:false,addEventListener(t,f){add(dl,t,f);}},press(key){calls.push(['legacy-clock-press',key,now]);}};
 context.window=context;context.addEventListener=(t,f)=>add(wl,t,f);context.enterAgc=AGCDSKY.enterAgc;const original=context.enterAgc;vm.createContext(context);
 vm.runInContext(keycodeSource,context,{filename:'dsky-keycodes.js'});assert(context.AGCDSKY_KEY_CODES&&Object.isFrozen(context.AGCDSKY_KEY_CODES),'shared keycodes missing/mutable');assert(context.AGCDSKY_KEY_CODES!==KEY_CODES,'shared keycodes must be copied');
 vm.runInContext(transitionSource,context,{filename:'runtime-transitions.js'});assert(AGCDSKY.runtimeTransitions&&context.enterAgc!==original&&AGCDSKY.enterAgc===context.enterAgc,'transition service did not replace global/API entry');
 vm.runInContext(clockSource,context,{filename:'clock-behavior.js'});assert(AGCDSKY.clockBehavior,'clock fallback did not initialize');
 vm.runInContext(keyboardSource,context,{filename:'keyboard-electrical-interlock.js'});assert(AGCDSKY.keyboardElectrical,'electrical interlock did not initialize');

 const existing=context.enterAgc();await flush(2);assert(mode==='agc-loading'&&enterCount===1,'direct app transition did not start exactly once');
 const verb=button('V');let e=event(verb,41);dispatchPointer(wl,dl,'pointerdown',e);assert(e.prevented&&e.immediate,'electrical interlock did not own VERB at window capture');e=event(verb,41);dispatchPointer(wl,dl,'pointerup',e);
 let state=AGCDSKY.keyboardElectrical.state();assert(state.clockHandoffPending&&state.cycleLatched,'released physical key not retained during startup');assert(enterCount===1,'keyboard started a second transition');assert(!calls.some(c=>c[0]==='legacy-clock-press'),'physical key leaked to synthetic editor');assert(!Array.from(timers.values()).some(t=>t.due-now===10),'readiness polling reappeared');assert(!AGCDSKY.clockBehavior.snapshot().promotionInFlight,'document fallback participated despite window stop');
 resolveLoad();await existing;await flush();assert(mode==='agc'&&enterCount===1,'shared transition did not finish once');const makes=calls.filter(c=>c[0]==='make');assert(makes.length===1&&makes[0][1]===0o21,'VERB was not exactly one Pinball 021 make');assert(AGCDSKY.runtimeTransitions.snapshot().lastTransition?.reason==='app enterAgc','keyboard join replaced direct app transition owner');state=AGCDSKY.keyboardElectrical.state();assert(!state.clockHandoffPending&&state.electricalMade&&state.keyResetPending,'physical handoff did not enter KEYRST dwell');
 let guard=0;while(timers.size){let id=null,sel=null;for(const [candidate,t] of timers){if(!sel||t.due<sel.due||(t.due===sel.due&&candidate<id)){id=candidate;sel=t;}}timers.delete(id);now=Math.max(now,sel.due);sel.fn();if(++guard>1000)throw new Error('integration timer loop did not settle');}
 assert(calls.filter(c=>c[0]==='reset').length===1,'physical handoff did not produce exactly one KEYRST');state=AGCDSKY.keyboardElectrical.state();assert(!state.cycleLatched&&!state.electricalMade&&!state.keyResetPending,'channel 015 remained latched');
 console.log('runtime transition integration smoke: PASS');console.log('  shared keycodes, direct app entry, window/document ownership, no polling, and make/KEYRST verified');
}
main().catch(error=>{console.error('runtime transition integration smoke: FAIL');console.error(error?.stack||error);process.exitCode=1;});
