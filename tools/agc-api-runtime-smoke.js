#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
let initCount=0,clockArgs=null;
const core={id:'core'},status={mode:'agc'},context={window:null,agcCore:core,selectedMission:'comanche055',onAgcChannel(){},setAppVisible(){},enterClock(...args){clockArgs=args;return 'clock-result'},clockTimeLabel:()=> 'CLOCK LABEL',enterAgc(){return 'agc-result'},agcAppStatus:()=>status,saveAgcState:()=>true,clearSavedAgcState:()=>true,savedSnapshotInfo:()=>({saved:true}),verifySnapshotRoundTrip:()=>({ok:true}),scheduleAgcAutosave(){},accurateTime:()=>1234,accurateDate:()=>new Date(1234),ntpStatus:{state:'synced',offsetMs:5},updateNtpStatus(){},initializeAppShell(){initCount++},Object,Date};
context.window=context;vm.createContext(context);new vm.Script(source,{filename:'agc-api-runtime.js'}).runInContext(context);
const api=context.AGCDSKY;
assert(api&&typeof api==='object','AGCDSKY facade was not published');
assert(initCount===1,'API bootstrap did not initialize app shell exactly once');
assert(api.getCore()===core,'getCore no longer exposes authoritative core');
assert(api.getMission()==='comanche055','getMission no longer exposes fixed mission');
assert(api.appStatus()===status,'appStatus no longer delegates to lifecycle runtime');
assert(api.enterAgc()==='agc-result','enterAgc delegation changed');
assert(api.enterClock()==='clock-result'&&clockArgs&&clockArgs[0]==='CLOCK LABEL'&&clockArgs[1]===true,'enterClock no longer preserves resumable AGC semantics');
assert(api.saveAgcState()===true&&api.clearSavedAgcState()===true&&api.verifySnapshotRoundTrip().ok===true,'snapshot facade delegation changed');
assert(api.accurateTime()===1234&&api.accurateDate().getTime()===1234,'time facade delegation changed');
const ntp=api.ntpStatus();assert(ntp.state==='synced'&&ntp.offsetMs===5&&ntp!==context.ntpStatus,'ntpStatus facade must return a copy');
for(const marker of ['window.AGCDSKY={','agcChannel:onAgcChannel','getCore:()=>agcCore','enterClock:()=>enterClock(clockTimeLabel(),true)','nativeNtpStatus:updateNtpStatus','initializeAppShell();'])assert(source.includes(marker),`API runtime missing ${marker}`);
for(const forbidden of ['URLSearchParams','localStorage','new AgcCore(','function decodeChannel10(','SNAPSHOT_KEY','.keyPress(','writeIo(0o15','setInterval(','document.addEventListener'])assert(!source.includes(forbidden),`API runtime crossed subsystem boundary: ${forbidden}`);
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');
const keycodesIndex=html.indexOf('<script src="dsky-keycodes.js"></script>'),apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>'),dreamIndex=html.indexOf('<script src="dream-silence.js"></script>');
assert(keycodesIndex>=0&&apiIndex>keycodesIndex&&dreamIndex>apiIndex,'API runtime parser order is invalid');
assert(!html.includes('<script src="app.js"></script>'),'index still loads legacy app.js');
console.log('AGC API runtime smoke: PASS');
console.log('  public facade delegation, resumable CLOCK semantics, time/snapshot bridge, shell bootstrap, and legacy app.js removal verified');
