#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const source=read('app-state-runtime.js'),html=read('index.html');
const context={window:null,document:{hidden:false},Object};context.window=context;vm.createContext(context);new vm.Script(source,{filename:'app-state-runtime.js'}).runInContext(context);
const state=context.AGCDSKY_APP_STATE,core=context.AGCDSKY_CORE_SESSION;
assert(state&&Object.isSealed(state),'shared app state must exist and be sealed');
assert(core&&Object.isSealed(core),'shared AGC core session must exist and be sealed');
assert(state.mode==='clock'&&state.selectedMission==='comanche055'&&state.verb==='16'&&state.noun==='65','shared app-state core defaults changed');
assert(state.dream===false&&state.dreamMode==='dim'&&state.dim===false&&state.tickSound===true&&state.displayOnly===false&&state.appVisible===true,'shared presentation/visibility defaults changed');
assert(state.ntpStatus&&state.ntpStatus.server==='time.cloudflare.com'&&state.ntpStatus.state==='unavailable','NTP state defaults changed');
assert(core.core===null&&core.loadedMission===''&&core.suspendedForClock===false&&core.pausedForVisibility===false,'core-session defaults changed');

// Application state is explicit-only. None of these fields may be mirrored to
// Window, because classic-script bare identifiers recreate hidden cross-file
// coupling and a second apparent state API.
const stateNames=['mode','selectedMission','verb','noun','dream','dreamMode','dim','tickSound','displayOnly','appVisible','ntpStatus','agcCore','agcLoadedMission','agcSuspendedForClock','agcPausedForVisibility'];
for(const name of stateNames)assert(!Object.getOwnPropertyDescriptor(context,name),`${name} must not be a Window state property`);
state.mode='agc';state.verb='35';state.noun='00';state.tickSound=false;state.dream=true;state.displayOnly=true;state.dreamMode='solar';state.dim=true;state.appVisible=false;core.loadedMission='comanche055';core.suspendedForClock=true;core.pausedForVisibility=true;core.core={running:false};
assert(state.mode==='agc'&&state.verb==='35'&&state.noun==='00'&&state.tickSound===false&&state.dream&&state.displayOnly&&state.dreamMode==='solar'&&state.dim&&state.appVisible===false,'direct shared-state writes changed');
assert(core.core&&core.loadedMission==='comanche055'&&core.suspendedForClock&&core.pausedForVisibility,'direct core-session writes changed');
const originalState=state,originalCore=core;new vm.Script(source).runInContext(context);assert(context.AGCDSKY_APP_STATE===originalState&&context.AGCDSKY_CORE_SESSION===originalCore&&state.mode==='agc'&&core.loadedMission==='comanche055','state bootstrap reinitialized an existing session');
assert(!source.includes('Object.defineProperty(window'),'state bootstrap regained Window compatibility properties');

const stateIndex=html.indexOf('<script src="app-state-runtime.js"></script>'),shellIndex=html.indexOf('<script src="app-shell-runtime.js"></script>');
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
  assert(html.indexOf(`<script src="${name}"></script>`)>stateIndex,`${name} must load after shared state`);
  const s=read(name);assert(s.includes(`const ${alias}`)&&s.includes('window.AGCDSKY_APP_STATE'),`${name} does not bind explicit shared app state`);
}
const coreExpected=[['agc-snapshot-runtime.js','snapshotCore'],['agc-lifecycle-runtime.js','lifecycleCore'],['agc-api-runtime.js','apiCore'],['relay-show.js','showCore'],['dream-agc.js','dreamCore']];
for(const [name,alias] of coreExpected){const s=read(name);assert(s.includes(`const ${alias}`)&&s.includes('window.AGCDSKY_CORE_SESSION'),`${name} does not bind explicit AGC core session`)}
const shell=read('app-shell-runtime.js');assert(shell.includes('function shellCore()')&&shell.includes('window.AGCDSKY_CORE_SESSION'),'shell does not dynamically resolve the explicit core session');
for(const forbidden of ['let selectedMission=','let verb=','let noun=','let mode=','let ntpStatus=','let dreamMode=','let dim=','let tickSound=','let displayOnly=','let appVisible=','let agcCore=','let agcLoadedMission=','let agcSuspendedForClock=','let agcPausedForVisibility='])assert(!shell.includes(forbidden),`shell regained implicit session/core state: ${forbidden}`);
console.log('app state runtime smoke: PASS');
console.log('  sealed explicit app/core session objects, no Window field bridge, idempotent bootstrap, parser order, and explicit consumers verified');
