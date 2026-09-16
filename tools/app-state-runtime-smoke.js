#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const source=read('app-state-runtime.js'),html=read('index.html');
const context={window:null,document:{hidden:false},Object,Map,TypeError,String};context.window=context;vm.createContext(context);new vm.Script(source,{filename:'app-state-runtime.js'}).runInContext(context);
const state=context.AGCDSKY_APP_STATE,core=context.AGCDSKY_CORE_SESSION,compat=context.AGCDSKY_COMPAT;
assert(state&&Object.isSealed(state),'shared app state must exist and be sealed');
assert(core&&Object.isSealed(core),'shared AGC core session must exist and be sealed');
assert(compat&&Object.isFrozen(compat),'compatibility registry must exist and be frozen');
assert(state.mode==='clock'&&state.selectedMission==='comanche055'&&state.verb==='16'&&state.noun==='65','shared app-state core defaults changed');
assert(state.dream===false&&state.dreamMode==='dim'&&state.dim===false&&state.tickSound===true&&state.displayOnly===false&&state.appVisible===true,'shared presentation/visibility defaults changed');
assert(state.ntpStatus&&state.ntpStatus.server==='time.cloudflare.com'&&state.ntpStatus.state==='unavailable','NTP state defaults changed');
assert(core.core===null&&core.loadedMission===''&&core.suspendedForClock===false&&core.pausedForVisibility===false,'core-session defaults changed');

const stateNames=['mode','selectedMission','verb','noun','dream','dreamMode','dim','tickSound','displayOnly','appVisible','ntpStatus','agcCore','agcLoadedMission','agcSuspendedForClock','agcPausedForVisibility'];
for(const name of stateNames)assert(!Object.getOwnPropertyDescriptor(context,name),`${name} must not be a Window state property`);

const probe=compat.mutable('compatProbe',()=>1,value=>typeof value==='function');
assert(context.compatProbe()===1&&probe.version()===0,'compatibility mutable slot bootstrap changed');
vm.runInContext("compatProbe=function(){return 2}",context);
assert(context.compatProbe()===2&&compat.get('compatProbe')()===2&&probe.version()===1,'compatibility assignment did not update the owning slot');
compat.replace('compatProbe',()=>3,'explicit smoke replacement');
assert(context.compatProbe()===3&&probe.version()===2,'explicit compatibility replacement did not update the owning slot');
assert(probe.history().length===2&&probe.history()[1].reason==='explicit smoke replacement','compatibility replacement provenance changed');
assert(compat.describe().some(item=>item.name==='compatProbe'&&item.version===2),'compatibility registry diagnostics changed');

let forwarded=1,forwardedVersion=0;const forwardedHistory=[];
compat.alias('forwardedProbe',()=>forwarded,(next,reason)=>{forwarded=Number(next);forwardedVersion++;forwardedHistory.push({version:forwardedVersion,reason})},()=>forwardedVersion,()=>forwardedHistory);
assert(context.forwardedProbe===1&&compat.get('forwardedProbe')===1,'forwarded compatibility alias bootstrap changed');
context.forwardedProbe=2;assert(forwarded===2&&forwardedVersion===1,'forwarded compatibility assignment did not reach owner');
compat.replace('forwardedProbe',3,'forwarded replacement');assert(forwarded===3&&forwardedVersion===2,'forwarded explicit replacement did not reach owner');
const forwardedDescription=compat.describe().find(item=>item.name==='forwardedProbe');assert(forwardedDescription&&forwardedDescription.kind==='alias'&&forwardedDescription.version===2,'forwarded compatibility diagnostics do not reflect owner version');

state.mode='agc';state.verb='35';state.noun='00';state.tickSound=false;state.dream=true;state.displayOnly=true;state.dreamMode='solar';state.dim=true;state.appVisible=false;core.loadedMission='comanche055';core.suspendedForClock=true;core.pausedForVisibility=true;core.core={running:false};
assert(state.mode==='agc'&&state.verb==='35'&&state.noun==='00'&&state.tickSound===false&&state.dream&&state.displayOnly&&state.dreamMode==='solar'&&state.dim&&state.appVisible===false,'direct shared-state writes changed');
assert(core.core&&core.loadedMission==='comanche055'&&core.suspendedForClock&&core.pausedForVisibility,'direct core-session writes changed');
const originalState=state,originalCore=core,originalCompat=compat;new vm.Script(source).runInContext(context);assert(context.AGCDSKY_APP_STATE===originalState&&context.AGCDSKY_CORE_SESSION===originalCore&&context.AGCDSKY_COMPAT===originalCompat&&state.mode==='agc'&&core.loadedMission==='comanche055','bootstrap reinitialized an existing session/registry');
assert(source.includes('window.AGCDSKY_COMPAT = Object.freeze({mutable,accessor,alias,readonly,get,replace,describe});'),'audited compatibility registry publication missing forwarded-alias API');
assert(source.includes('Object.defineProperty(window, name'),'compatibility registry must own its accessor boundary');

const stateIndex=html.indexOf('src="app-state-runtime.js"'),shellIndex=html.indexOf('src="app-shell-runtime.js"');
assert(stateIndex>=0&&shellIndex>stateIndex,'app-state runtime must parser-load before shell');
const expected=[
  ['app-shell-runtime.js','shellState'],['display-environment.js','environmentState'],['relay-audio-runtime.js','audioState'],
  ['phone-clock-runtime.js','clockState'],['agc-display-runtime.js','displayState'],['agc-snapshot-runtime.js','snapshotState'],
  ['agc-lifecycle-runtime.js','lifecycleState'],['agc-api-runtime.js','apiState'],['dsky-geometry.js','geometryState'],
  ['hardware-fidelity.js','fidelityState'],['background-audio-guard.js','guardState'],['screen-only.js','screenState'],
  ['relay-identity-audio.js','identityState'],['relay-visual-coupling.js','visualState'],['relay-show.js','showState'],
  ['dream-agc.js','dreamState']
];
for(const [name,alias] of expected){
  assert(html.indexOf(`src="${name}"`)>stateIndex,`${name} must load after shared state`);
  const s=read(name);assert(s.includes(`const ${alias}`)&&s.includes('window.AGCDSKY_APP_STATE'),`${name} does not bind explicit shared app state`);
}
const coreExpected=[['agc-snapshot-runtime.js','snapshotCore'],['agc-lifecycle-runtime.js','lifecycleCore'],['agc-api-runtime.js','apiCore'],['relay-show.js','showCore'],['dream-agc.js','dreamCore']];
for(const [name,alias] of coreExpected){const s=read(name);assert(s.includes(`${alias}=window.AGCDSKY_CORE_SESSION`)||s.includes(`${alias} = window.AGCDSKY_CORE_SESSION`),`${name} does not bind explicit AGC core session`)}
const shell=read('app-shell-runtime.js');assert(shell.includes('function shellCore()')&&shell.includes('window.AGCDSKY_CORE_SESSION'),'shell does not dynamically resolve the explicit core session');
for(const forbidden of ['let selectedMission=','let verb=','let noun=','let mode=','let ntpStatus=','let dreamMode=','let dim=','let tickSound=','let displayOnly=','let appVisible=','let agcCore=','let agcLoadedMission=','let agcSuspendedForClock=','let agcPausedForVisibility='])assert(!shell.includes(forbidden),`shell regained implicit session/core state: ${forbidden}`);
console.log('app state runtime smoke: PASS');
console.log('  sealed explicit app/core state, audited compatibility registry, forwarded owner-backed aliases, explicit replacement provenance, idempotent bootstrap, and explicit consumers verified');
