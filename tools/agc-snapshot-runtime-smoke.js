#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'agc-snapshot-runtime.js'),'utf8');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const storage=new Map(),store={get:k=>storage.has(k)?storage.get(k):null,set(k,v){storage.set(k,String(v));return true},remove:k=>storage.delete(k)};
let applied=null,renderCount=0,startCount=0,stopCount=0,importCount=0,serial=0;
const core={running:true,version:()=> 'fake-core',exportSnapshot(){const n=++serial;return{byteLength:64,fingerprint:`fp-${n}`,memoryB64:'x'}},importSnapshot(s){importCount++;this.lastImported=s;return true},snapshotFingerprint(){return`fp-${serial}`},stop(){this.running=false;stopCount++},start(){this.running=true;startCount++}};
const timers=[],sharedState=Object.seal({mode:'agc',selectedMission:'comanche055',verb:'16',noun:'65',ntpStatus:{}});
const context={console,window:null,AGCDSKY_APP_STATE:sharedState,JSON,Date,String,Object,agcCore:core,agcLoadedMission:'comanche055',appVisible:true,store,
  snapshotUiState:()=>({display:{verb:['1','6']},relayWords:{10:123}}),applySnapshotUi:ui=>{applied=ui},renderAgcSnapshot:()=>{renderCount++},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length},clearTimeout(){}};
context.window=context;vm.createContext(context);new vm.Script(source,{filename:'agc-snapshot-runtime.js'}).runInContext(context);
assert(vm.runInContext("saveAgcState('manual')",context)===true,'manual snapshot save failed');
const payload=JSON.parse(storage.get('agcSnapshotV1')),meta=JSON.parse(storage.get('agcSnapshotMetaV1'));
assert(payload.schema===1&&payload.mission==='comanche055'&&payload.ui.display.verb.join('')==='16','snapshot payload changed');
assert(meta.schema===1&&meta.bytes===64&&meta.fingerprint==='fp-1','snapshot metadata changed');
applied=null;assert(vm.runInContext('restoreSavedAgcState()',context)===true,'snapshot restore failed');
assert(importCount===1&&applied&&applied.display.verb.join('')==='16','restore did not import core + UI state');
const verify=vm.runInContext('verifySnapshotRoundTrip()',context);
assert(verify.ok===true&&stopCount===1&&startCount===1&&renderCount===1,'snapshot round-trip did not stop/import/restart/render correctly');
vm.runInContext("scheduleAgcAutosave('DSKY key make')",context);assert(timers.length===1&&timers[0].ms===1800,'autosave debounce changed');timers[0].fn();
assert(JSON.parse(storage.get('agcSnapshotMetaV1')).reason==='autosave: DSKY key make','autosave reason changed');
assert(vm.runInContext('clearSavedAgcState()',context)===true&&!storage.has('agcSnapshotV1')&&!storage.has('agcSnapshotMetaV1'),'snapshot clear failed');
sharedState.mode='clock';assert(vm.runInContext("saveAgcState('manual')",context)===false,'snapshot save must be rejected outside AGC mode');
for(const token of ['const snapshotState=window.AGCDSKY_APP_STATE;','SNAPSHOT_KEY','function saveAgcState(','function restoreSavedAgcState(','function verifySnapshotRoundTrip(','function scheduleAgcAutosave(']){assert(source.includes(token),`snapshot runtime missing ${token}`);if(token!=='const snapshotState=window.AGCDSKY_APP_STATE;')assert(!shell.includes(token)&&!api.includes(token),`non-snapshot runtime regained snapshot ownership: ${token}`)}
for(const forbidden of ['let mode=','let selectedMission=','new AgcCore(','async function enterAgc(','function decodeChannel10('])assert(!source.includes(forbidden),`snapshot runtime crossed state/authority boundary: ${forbidden}`);
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');
console.log('AGC snapshot runtime smoke: PASS');
console.log('  shared-state mission/mode gating, save/restore/clear, round-trip verification, autosave, and ownership separation verified');
