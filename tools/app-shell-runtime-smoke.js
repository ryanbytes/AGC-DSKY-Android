#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const stateSource=fs.readFileSync(path.join(ASSETS,'app-state-runtime.js'),'utf8');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(n){this.values.delete(n)}toggle(n,f){if(f)this.values.add(n);else this.values.delete(n)}contains(n){return this.values.has(n)}}
class Element{constructor(){this.textContent='';this.classList=new Classes();this.listeners={};this.style={filter:'',setProperty(){}}}addEventListener(n,cb){this.listeners[n]=cb}closest(){return null}}
const ids=['mode','mission','dim','dreambright','sound','display','agc','clock','dsky','prog','verb','noun'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const documentListeners={},windowListeners={},storage=new Map([['runMode','clock']]),intervals=[];
const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
class FixedDate extends Date{constructor(...a){super(...(a.length?a:[1000]))}static now(){return 1000}}
let set2Calls=0,syncCalls=0;const saves=[];
const context={console,URLSearchParams,location:{search:''},localStorage,document:{hidden:false,body:new Element(),getElementById:id=>elements[id]||null,addEventListener(n,cb){documentListeners[n]=cb}},window:null,navigator:{},Date:FixedDate,Math,Number,JSON,Object,String,parseFloat,
  set2(){set2Calls++},applyDim(){},applyDreamMode(){},applyDisplayOnly(){},applyTickSound(){},clearLamps(){},syncClockFace(){syncCalls++},tick(){},updateDreamEnvironment(){},setAppVisible(){},saveAgcState(reason){saves.push(reason);return true},ensureAudio(){return null},playRelayBurst(){},enterAgc(){},enterClock(){},lastAutosaveAt:0,
  setTimeout(){return 1},clearTimeout(){},setInterval(fn,ms){intervals.push({fn,ms});return intervals.length},addEventListener(n,cb){windowListeners[n]=cb}};
context.window=context;
vm.createContext(context);new vm.Script(stateSource,{filename:'app-state-runtime.js'}).runInContext(context);new vm.Script(shell,{filename:'app-shell-runtime.js'}).runInContext(context);
const state=context.AGCDSKY_APP_STATE,coreSession=context.AGCDSKY_CORE_SESSION;

assert(vm.runInContext('restoreAgcOnLoad',context)===false,'remembered CLOCK mode must suppress AGC autostart');
assert(state.selectedMission==='comanche055','shell mission lock changed');
assert(storage.get('agcMission')==='comanche055','shell did not persist fixed CM mission');
context.TimeBridge={getStatus:()=>JSON.stringify({state:'synced',offsetMs:250})};
vm.runInContext('loadNativeNtpStatus()',context);
assert(vm.runInContext('accurateTime()',context)===1250,'NTP offset was not applied to accurateTime');
assert(vm.runInContext('clockTimeLabel()',context)==='PHONE CLOCK · NTP TIME','synced NTP label changed');
assert(state.ntpStatus.offsetMs===250&&state.ntpStatus.state==='synced','shell did not update shared NTP state');
assert(elements.mode.textContent==='PHONE CLOCK · NTP TIME','NTP update did not refresh CLOCK status');
assert(vm.runInContext('initializeAppShell()',context)===true,'first shell initialization failed');
assert(vm.runInContext('initializeAppShell()',context)===false,'shell initialization is not idempotent');
assert(syncCalls===1&&set2Calls>=1,'shell startup did not initialize clock/display');
assert(typeof documentListeners.visibilitychange==='function'&&typeof windowListeners.pagehide==='function','lifecycle listeners were not installed');
assert(elements.agc.listeners.click&&elements.clock.listeners.click&&elements.sound.listeners.click,'control handlers were not installed');
const autosave=intervals.find(x=>x.ms===5000);assert(autosave,'periodic autosave interval was not installed');
state.mode='agc';coreSession.core={running:true,stop(){this.running=false}};context.lastAutosaveAt=-20000;state.appVisible=false;autosave.fn();assert(saves.length===0,'hidden app performed periodic AGC autosave');state.appVisible=true;autosave.fn();assert(saves.length===1&&saves[0]==='periodic autosave','visible running AGC did not perform periodic autosave from shared core/visibility state');
assert(!Object.getOwnPropertyDescriptor(context,'appVisible')&&!Object.getOwnPropertyDescriptor(context,'agcCore'),'shell smoke must not depend on Window visibility/core globals');

for(const token of ['const shellState=window.AGCDSKY_APP_STATE;','function shellCore()','window.AGCDSKY_CORE_SESSION','const store=','const MISSIONS=','function accurateTime()','function updateNtpStatus(','function showControls()','function initializeAppShell()','shellState.appVisible'])assert(shell.includes(token),`shell runtime missing ${token}`);
for(const forbidden of ['agcCore','let selectedMission=','let verb=','let noun=','let mode=','let ntpStatus=','new AgcCore(','function decodeChannel10(','SNAPSHOT_KEY','.keyPress(','writeIo(0o15'])assert(!shell.includes(forbidden),`shell crossed state/core/subsystem authority: ${forbidden}`);
for(const forbidden of ['URLSearchParams','const store=','const MISSIONS=','function accurateTime()','document.addEventListener','setInterval('])assert(!api.includes(forbidden),`API bootstrap regained shell ownership: ${forbidden}`);
assert(api.includes('window.AGCDSKY={')&&api.includes('initializeAppShell();'),'API runtime is no longer a facade/bootstrap');
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');
const stateIndex=html.indexOf('<script src="app-state-runtime.js"></script>'),shellIndex=html.indexOf('<script src="app-shell-runtime.js"></script>'),rendererIndex=html.indexOf('<script src="dsky-display-renderer.js"></script>'),keycodesIndex=html.indexOf('<script src="dsky-keycodes.js"></script>'),apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>'),dreamIndex=html.indexOf('<script src="dream-silence.js"></script>');
assert(stateIndex>=0&&shellIndex>stateIndex&&rendererIndex>shellIndex&&apiIndex>keycodesIndex&&dreamIndex>apiIndex,'app state/shell/API parser order is invalid');
assert(!html.includes('<script src="app.js"></script>'),'index still loads legacy app.js');

console.log('app shell runtime smoke: PASS');
console.log('  shared app/core state, configuration, NTP offset/label, controls/startup, visibility-gated periodic autosave, idempotence, and API handoff verified');
