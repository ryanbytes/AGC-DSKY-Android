#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(n){this.values.delete(n)}toggle(n,f){f?this.values.add(n):this.values.delete(n)}}
class Element{constructor(){this.textContent='';this.classList=new Classes();this.listeners={};this.style={filter:'',setProperty(){}}}addEventListener(n,cb){this.listeners[n]=cb}closest(){return null}}
const elements=Object.fromEntries(['mode','mission','dim','dreambright','sound','display','agc','clock','dsky','prog','verb','noun'].map(id=>[id,new Element()]));
const storage=new Map([['runMode','clock'],['audioTickV4','0'],['dim','1'],['displayOnly','1'],['dreamMode','bright']]);
const context={window:null,location:{search:''},URLSearchParams,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},document:{hidden:false,body:new Element(),getElementById:id=>elements[id]||null,addEventListener(){},querySelectorAll(){return[]}},navigator:{},Date,Math,Number,JSON,Object,String,Set,parseFloat,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},addEventListener(){},set2(){},setReg(){},setLamp(){},clearLamps(){},setAppVisible(){},saveAgcState(){},agcCore:null,lastAutosaveAt:0,enterAgc(){},enterClock(){},syncClockFace(){},playRelayBurst(){},ensureAudio(){return null},DreamBridge:null};
context.window=context;vm.createContext(context);
for(const name of ['app-state-runtime.js','app-shell-runtime.js','display-environment.js','relay-audio-runtime.js'])new vm.Script(read(name),{filename:name}).runInContext(context);
const state=context.AGCDSKY_APP_STATE;
assert(!state.tickSound&&state.dim&&state.displayOnly&&state.dreamMode==='bright'&&state.appVisible===true,'stored/default presentation state was not loaded correctly');
vm.runInContext('applyTickSound(); applyDim(); applyDisplayOnly();',context);
assert(elements.sound.textContent==='RELAY CLICKS OFF','shared relay-click state did not drive control label');
assert(elements.display.textContent==='EXIT FULL DSKY DISPLAY','shared display-only state did not drive control label');
state.tickSound=true;vm.runInContext('dim=false; displayOnly=false;',context);
assert(state.tickSound&&state.dim===false&&state.displayOnly===false,'shared/remaining compatibility presentation writes did not update state');
assert(!Object.getOwnPropertyDescriptor(context,'tickSound'),'tickSound must remain shared-state only, not a Window compatibility accessor');
assert(read('display-environment.js').includes('const environmentState=window.AGCDSKY_APP_STATE;'),'display environment is not an explicit state consumer');
assert(read('relay-audio-runtime.js').includes('const audioState=window.AGCDSKY_APP_STATE;'),'relay audio is not an explicit state consumer');
const hardware=read('hardware-fidelity.js'),guard=read('background-audio-guard.js');
assert(hardware.includes('const fidelityState = window.AGCDSKY_APP_STATE;'),'hardware fidelity is not an explicit shared-state consumer');
assert(guard.includes('const guardState = window.AGCDSKY_APP_STATE;'),'background audio guard is not an explicit shared-state consumer');
for(const old of ["if (!tickSound)","mode !== 'clock'","mode === 'clock'","currentClockLatchState(verb, noun)","verb = '16'; noun = '65';"])assert(!hardware.includes(old),`hardware fidelity retained implicit state expression: ${old}`);
for(const old of ["!dream &&","!tickSound","if (tickSound &&","typeof mode !== 'undefined'","!dream && typeof"])assert(!guard.includes(old),`background audio guard retained implicit state expression: ${old}`);
assert(guard.includes('guardState.appVisible')&&guard.includes('guardState.dream')&&guard.includes('guardState.tickSound')&&guard.includes("guardState.mode === 'clock'"),'audio guard does not consume shared visibility/presentation/mode state');
assert(read('app-state-runtime.js').includes("appVisible:!document.hidden"),'shared state does not own lifecycle visibility');
console.log('presentation state smoke: PASS');
console.log('  persisted settings, explicit hardware/audio consumers, shared visibility, and tickSound shared-state-only ownership verified');
