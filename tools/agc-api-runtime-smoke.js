#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
let initCount=0,baseClockArgs=null,baseAgcCalls=0,runtimeAgcCalls=0,runtimeClockArgs=null;
const core={id:'core'},status={mode:'agc'},appState=Object.seal({mode:'agc',selectedMission:'comanche055',verb:'16',noun:'65',dream:false,dreamMode:'dim',dim:false,tickSound:true,displayOnly:false,ntpStatus:{state:'synced',offsetMs:5}});
const context={window:null,AGCDSKY_APP_STATE:appState,agcCore:core,onAgcChannel(){},setAppVisible(){},enterClock(...args){baseClockArgs=args;return'base-clock'},clockTimeLabel:()=> 'CLOCK LABEL',enterAgc(){baseAgcCalls++;return'base-agc'},agcAppStatus:()=>status,saveAgcState:()=>true,clearSavedAgcState:()=>true,savedSnapshotInfo:()=>({saved:true}),verifySnapshotRoundTrip:()=>({ok:true}),scheduleAgcAutosave(){},accurateTime:()=>1234,accurateDate:()=>new Date(1234),updateNtpStatus(){},initializeAppShell(){initCount++},Object,Date};
context.window=context;vm.createContext(context);new vm.Script(source,{filename:'agc-api-runtime.js'}).runInContext(context);
const api=context.AGCDSKY,oldAgc=api.enterAgc,oldClock=api.enterClock;
assert(initCount===1,'API bootstrap did not initialize shell once');assert(api.getCore()===core&&api.getMission()==='comanche055','core/mission facade changed');
assert(api.enterAgc()==='base-agc'&&baseAgcCalls===1,'pre-runtime AGC fallback changed');assert(api.enterClock()==='base-clock'&&baseClockArgs[0]==='CLOCK LABEL'&&baseClockArgs[1]===true,'pre-runtime CLOCK fallback changed');
context.AGCDSKY_RUNTIME={enterAgc(reason){runtimeAgcCalls++;return reason},enterClock(...args){runtimeClockArgs=args;return'runtime-clock'}};
assert(api.enterAgc()==='public AGCDSKY.enterAgc'&&runtimeAgcCalls===1,'public AGC call did not discover transition runtime');assert(api.enterClock()==='runtime-clock'&&runtimeClockArgs[0]==='CLOCK LABEL'&&runtimeClockArgs[1]===true&&runtimeClockArgs[2]==='public AGCDSKY.enterClock','public CLOCK call did not delegate preserve semantics/reason');assert(api.enterAgc===oldAgc&&api.enterClock===oldClock,'public API function identity changed after runtime publication');
const ntp=api.ntpStatus();assert(ntp.state==='synced'&&ntp!==appState.ntpStatus,'NTP facade must return a copy');
for(const marker of ['function publicEnterAgc()','function publicEnterClock()','window.AGCDSKY_RUNTIME','enterClock:publicEnterClock','enterAgc:publicEnterAgc','initializeAppShell();'])assert(source.includes(marker),`API runtime missing ${marker}`);
for(const forbidden of ['URLSearchParams','localStorage','new AgcCore(','function decodeChannel10(','SNAPSHOT_KEY','.keyPress(','writeIo(0o15','setInterval(','document.addEventListener'])assert(!source.includes(forbidden),`API runtime crossed subsystem boundary: ${forbidden}`);
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');const stateIndex=html.indexOf('<script src="app-state-runtime.js"></script>'),apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>'),runtimeIndex=html.indexOf('<script src="runtime-transitions.js"></script>');assert(stateIndex>=0&&apiIndex>stateIndex&&runtimeIndex>apiIndex,'state/API/runtime parser order invalid');
console.log('AGC API runtime smoke: PASS');
console.log('  stable facade identity, lifecycle fallback, dynamic transition delegation, CLOCK preserve semantics, and shared-state access verified');
