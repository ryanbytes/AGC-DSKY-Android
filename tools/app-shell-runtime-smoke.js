#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const app=fs.readFileSync(path.join(ASSETS,'app.js'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(n){this.values.delete(n)}toggle(n,f){if(f)this.values.add(n);else this.values.delete(n)}contains(n){return this.values.has(n)}}
class Element{constructor(){this.textContent='';this.classList=new Classes();this.listeners={};this.style={filter:'',setProperty(){}}}addEventListener(n,cb){this.listeners[n]=cb}closest(){return null}}
const ids=['mode','mission','dim','dreambright','sound','display','agc','clock','dsky','prog','verb','noun'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const documentListeners={},windowListeners={},storage=new Map([['runMode','clock']]);
const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
class FixedDate extends Date{constructor(...a){super(...(a.length?a:[1000]))}static now(){return 1000}}
let set2Calls=0,syncCalls=0,clockTicks=0,visibilityCalls=0;
const context={console,URLSearchParams,location:{search:''},localStorage,document:{hidden:false,body:new Element(),getElementById:id=>elements[id]||null,addEventListener(n,cb){documentListeners[n]=cb}},window:null,navigator:{},Date:FixedDate,Math,Number,JSON,Object,String,parseFloat,
  set2(){set2Calls++},applyDim(){},applyDreamMode(){},applyDisplayOnly(){},applyTickSound(){},clearLamps(){},syncClockFace(){syncCalls++},tick(){clockTicks++},updateDreamEnvironment(){},setAppVisible(){visibilityCalls++},saveAgcState(){return true},ensureAudio(){return null},playRelayBurst(){},enterAgc(){},enterClock(){},agcCore:null,appVisible:true,lastAutosaveAt:0,
  setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},addEventListener(n,cb){windowListeners[n]=cb}};
context.window=context;
vm.createContext(context);new vm.Script(shell,{filename:'app-shell-runtime.js'}).runInContext(context);

assert(vm.runInContext('restoreAgcOnLoad',context)===false,'remembered CLOCK mode must suppress AGC autostart');
assert(vm.runInContext('selectedMission',context)==='comanche055','shell mission lock changed');
assert(storage.get('agcMission')==='comanche055','shell did not persist fixed CM mission');
context.TimeBridge={getStatus:()=>JSON.stringify({state:'synced',offsetMs:250})};
vm.runInContext('loadNativeNtpStatus()',context);
assert(vm.runInContext('accurateTime()',context)===1250,'NTP offset was not applied to accurateTime');
assert(vm.runInContext('clockTimeLabel()',context)==='PHONE CLOCK · NTP TIME','synced NTP label changed');
assert(elements.mode.textContent==='PHONE CLOCK · NTP TIME','NTP update did not refresh CLOCK status');
assert(vm.runInContext('initializeAppShell()',context)===true,'first shell initialization failed');
assert(vm.runInContext('initializeAppShell()',context)===false,'shell initialization is not idempotent');
assert(syncCalls===1&&set2Calls>=1,'shell startup did not initialize clock/display');
assert(typeof documentListeners.visibilitychange==='function'&&typeof windowListeners.pagehide==='function','lifecycle listeners were not installed');
assert(elements.agc.listeners.click&&elements.clock.listeners.click&&elements.sound.listeners.click,'control handlers were not installed');

for(const token of ['const store=','const MISSIONS=','let ntpStatus=','function accurateTime()','function updateNtpStatus(','function showControls()','function initializeAppShell()'])assert(shell.includes(token),`shell runtime missing ${token}`);
for(const forbidden of ['new AgcCore(','function decodeChannel10(','SNAPSHOT_KEY','.keyPress(','writeIo(0o15'])assert(!shell.includes(forbidden),`shell crossed subsystem authority: ${forbidden}`);
for(const forbidden of ['URLSearchParams','const store=','const MISSIONS=','let ntpStatus=','function accurateTime()','document.addEventListener','setInterval('])assert(!app.includes(forbidden),`app.js regained shell ownership: ${forbidden}`);
assert(app.includes('window.AGCDSKY={')&&app.includes('initializeAppShell();'),'app.js is no longer a facade/bootstrap');
const shellIndex=html.indexOf('<script src="app-shell-runtime.js"></script>'),rendererIndex=html.indexOf('<script src="dsky-display-renderer.js"></script>'),appIndex=html.indexOf('<script src="app.js"></script>');
assert(shellIndex>=0&&rendererIndex>shellIndex&&appIndex>rendererIndex,'app shell parser order is invalid');

console.log('app shell runtime smoke: PASS');
console.log('  configuration, NTP offset/label, controls/startup, idempotence, and thin app bootstrap verified');
