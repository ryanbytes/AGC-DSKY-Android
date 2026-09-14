#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const source=read('app-state-runtime.js'),html=read('index.html');
const context={window:null,Object};context.window=context;vm.createContext(context);new vm.Script(source,{filename:'app-state-runtime.js'}).runInContext(context);
const state=context.AGCDSKY_APP_STATE;
assert(state&&Object.isSealed(state),'shared app state must exist and be sealed');
assert(state.mode==='clock'&&state.selectedMission==='comanche055'&&state.verb==='16'&&state.noun==='65','shared app-state core defaults changed');
assert(state.dream===false&&state.dreamMode==='dim'&&state.dim===false&&state.tickSound===true&&state.displayOnly===false,'shared presentation defaults changed');
assert(state.ntpStatus&&state.ntpStatus.server==='time.cloudflare.com'&&state.ntpStatus.state==='unavailable','NTP state defaults changed');

// Late classic-script layers still contain some bare state reads. Window
// accessors must make those reads/writes resolve to this same state object,
// never to a duplicate shadow variable.
assert(vm.runInContext('mode',context)==='clock'&&vm.runInContext('verb',context)==='16'&&vm.runInContext('tickSound',context)===true,'legacy Window bridge does not expose shared state');
vm.runInContext("mode='agc'; verb='35'; noun='00'; tickSound=false; dream=true; displayOnly=true",context);
assert(state.mode==='agc'&&state.verb==='35'&&state.noun==='00'&&state.tickSound===false&&state.dream===true&&state.displayOnly===true,'legacy Window bridge writes did not update shared state');
state.dreamMode='solar';state.dim=true;assert(vm.runInContext('dreamMode',context)==='solar'&&vm.runInContext('dim',context)===true,'shared presentation reads did not cross Window bridge');
const original=state;new vm.Script(source).runInContext(context);assert(context.AGCDSKY_APP_STATE===original&&state.mode==='agc'&&state.verb==='35','state runtime reinitialized an existing session');

const stateIndex=html.indexOf('<script src="app-state-runtime.js"></script>'),shellIndex=html.indexOf('<script src="app-shell-runtime.js"></script>');
assert(stateIndex>=0&&shellIndex>stateIndex,'app-state runtime must parser-load before shell');
for(const name of ['display-environment.js','relay-audio-runtime.js','phone-clock-runtime.js','agc-display-runtime.js','agc-snapshot-runtime.js','agc-lifecycle-runtime.js','agc-api-runtime.js'])assert(html.indexOf(`<script src="${name}"></script>`)>stateIndex,`${name} must load after shared state`);
const expected=[['app-shell-runtime.js','shellState'],['display-environment.js','environmentState'],['relay-audio-runtime.js','audioState'],['phone-clock-runtime.js','clockState'],['agc-display-runtime.js','displayState'],['agc-snapshot-runtime.js','snapshotState'],['agc-lifecycle-runtime.js','lifecycleState'],['agc-api-runtime.js','apiState']];
for(const [name,alias] of expected){const s=read(name);assert(s.includes(`const ${alias}=window.AGCDSKY_APP_STATE;`),`${name} does not bind explicit shared app state`)}
for(const forbidden of ['let selectedMission=','let verb=','let noun=','let mode=','let ntpStatus=','let dreamMode=','let dim=','let tickSound=','let displayOnly='])assert(!read('app-shell-runtime.js').includes(forbidden),`shell regained implicit session state: ${forbidden}`);
console.log('app state runtime smoke: PASS');
console.log('  sealed shared session/presentation state, legacy Window bridge, idempotent load, parser order, and explicit core consumers verified');
