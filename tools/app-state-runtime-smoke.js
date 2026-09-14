#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const source=read('app-state-runtime.js'),html=read('index.html');
const context={window:null,Object};context.window=context;vm.createContext(context);new vm.Script(source,{filename:'app-state-runtime.js'}).runInContext(context);
const state=context.AGCDSKY_APP_STATE;
assert(state&&Object.isSealed(state),'shared app state must exist and be sealed');
assert(state.mode==='clock'&&state.selectedMission==='comanche055'&&state.verb==='16'&&state.noun==='65','shared app-state defaults changed');
assert(state.ntpStatus&&state.ntpStatus.server==='time.cloudflare.com'&&state.ntpStatus.state==='unavailable','NTP state defaults changed');
state.mode='agc';state.verb='35';new vm.Script(source).runInContext(context);assert(context.AGCDSKY_APP_STATE===state&&state.mode==='agc'&&state.verb==='35','state runtime reinitialized an existing session');
const stateIndex=html.indexOf('<script src="app-state-runtime.js"></script>'),shellIndex=html.indexOf('<script src="app-shell-runtime.js"></script>');
assert(stateIndex>=0&&shellIndex>stateIndex,'app-state runtime must parser-load before shell');
for(const name of ['phone-clock-runtime.js','agc-display-runtime.js','agc-snapshot-runtime.js','agc-lifecycle-runtime.js','agc-api-runtime.js'])assert(html.indexOf(`<script src="${name}"></script>`)>stateIndex,`${name} must load after shared state`);
const expected=[['app-shell-runtime.js','shellState'],['phone-clock-runtime.js','clockState'],['agc-display-runtime.js','displayState'],['agc-snapshot-runtime.js','snapshotState'],['agc-lifecycle-runtime.js','lifecycleState'],['agc-api-runtime.js','apiState']];
for(const [name,alias] of expected){const s=read(name);assert(s.includes(`const ${alias}=window.AGCDSKY_APP_STATE;`),`${name} does not bind explicit shared app state`);for(const forbidden of ['let selectedMission=','let verb=','let noun=','let mode=','let ntpStatus='])assert(!s.includes(forbidden),`${name} regained implicit session state: ${forbidden}`)}
console.log('app state runtime smoke: PASS');
console.log('  sealed shared session state, idempotent load, parser order, and explicit consumer ownership verified');
