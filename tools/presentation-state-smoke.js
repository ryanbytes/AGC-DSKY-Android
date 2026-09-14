#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(n){this.values.delete(n)}toggle(n,f){f?this.values.add(n):this.values.delete(n)}}
class Element{constructor(){this.textContent='';this.classList=new Classes();this.listeners={};this.style={filter:'',setProperty(){}}}addEventListener(n,cb){this.listeners[n]=cb}closest(){return null}}
const elements=Object.fromEntries(['mode','mission','dim','dreambright','sound','display','agc','clock','dsky','prog','verb','noun'].map(id=>[id,new Element()]));
const storage=new Map([['runMode','clock'],['audioTickV4','0'],['dim','1'],['displayOnly','1'],['dreamMode','bright']]);
const context={window:null,location:{search:''},URLSearchParams,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},document:{hidden:false,body:new Element(),getElementById:id=>elements[id]||null,addEventListener(){},querySelectorAll(){return[]}},navigator:{},Date,Math,Number,JSON,Object,String,Set,parseFloat,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},addEventListener(){},set2(){},setReg(){},setLamp(){},clearLamps(){},setAppVisible(){},saveAgcState(){},agcCore:null,appVisible:true,lastAutosaveAt:0,enterAgc(){},enterClock(){},syncClockFace(){},playRelayBurst(){},ensureAudio(){return null},DreamBridge:null};
context.window=context;vm.createContext(context);
for(const name of ['app-state-runtime.js','app-shell-runtime.js','display-environment.js','relay-audio-runtime.js'])new vm.Script(read(name),{filename:name}).runInContext(context);
const state=context.AGCDSKY_APP_STATE;
assert(!state.tickSound&&state.dim&&state.displayOnly&&state.dreamMode==='bright','stored presentation settings were not loaded into shared state');
vm.runInContext('applyTickSound(); applyDim(); applyDisplayOnly();',context);
assert(elements.sound.textContent==='RELAY CLICKS OFF','shared relay-click state did not drive control label');
assert(elements.display.textContent==='EXIT FULL DSKY DISPLAY','shared display-only state did not drive control label');
vm.runInContext('tickSound=true; dim=false; displayOnly=false;',context);
assert(state.tickSound&&state.dim===false&&state.displayOnly===false,'legacy Window compatibility writes did not update shared state');
assert(read('display-environment.js').includes('const environmentState=window.AGCDSKY_APP_STATE;'),'display environment is not an explicit state consumer');
assert(read('relay-audio-runtime.js').includes('const audioState=window.AGCDSKY_APP_STATE;'),'relay audio is not an explicit state consumer');
const hardware=read('hardware-fidelity.js'),guard=read('background-audio-guard.js');
assert(hardware.includes('tickSound')&&guard.includes('tickSound'),'late compatibility consumers unexpectedly disappeared without gate update');
assert(read('app-state-runtime.js').includes("'tickSound','displayOnly','ntpStatus'"),'Window compatibility bridge no longer includes presentation state');
console.log('presentation state smoke: PASS');
console.log('  persisted settings, explicit core consumers, and legacy late-layer Window bridge verified');
