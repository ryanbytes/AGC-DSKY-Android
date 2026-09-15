#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const A=path.resolve(__dirname,'../app/src/main/assets');
const apiSource=fs.readFileSync(path.join(A,'agc-api-runtime.js'),'utf8');
const runtimeSource=fs.readFileSync(path.join(A,'runtime-transitions.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
let mode='clock',releaseLoad,baseClockCalls=0,baseAgcCalls=0;
const gate=new Promise(r=>releaseLoad=r),state={mode:'clock',selectedMission:'comanche055',verb:'16',noun:'65',dream:false,dreamMode:'dim',dim:false,tickSound:true,displayOnly:false,ntpStatus:{state:'unavailable',offsetMs:0}};
const context={window:null,AGCDSKY_APP_STATE:state,agcCore:{},onAgcChannel(){},setAppVisible(){},clockTimeLabel:()=> 'CLOCK',async enterAgc(){baseAgcCalls++;mode='agc-loading';await gate;mode='agc'},enterClock(label,preserve){baseClockCalls++;mode='clock';return[label,preserve]},agcAppStatus:()=>({mode}),saveAgcState(){},clearSavedAgcState(){},savedSnapshotInfo(){return null},verifySnapshotRoundTrip(){return{ok:true}},scheduleAgcAutosave(){},accurateTime:()=>0,accurateDate:()=>new Date(0),updateNtpStatus(){},initializeAppShell(){},Object,Date,Promise,Set,console};context.window=context;vm.createContext(context);
new vm.Script(apiSource).runInContext(context);const api=context.AGCDSKY,oldAgc=api.enterAgc,oldClock=api.enterClock;new vm.Script(runtimeSource).runInContext(context);
assert(api.enterAgc===oldAgc&&api.enterClock===oldClock,'transition runtime replaced public API identity');
(async()=>{const p=api.enterAgc();await Promise.resolve();assert(mode==='agc-loading'&&baseAgcCalls===1,'public AGC did not enter one owned load');const c=api.enterClock();assert(c&&typeof c.then==='function','CLOCK during load was not deferred');assert(baseClockCalls===0,'CLOCK base ran before AGC settled');releaseLoad();await p;const result=await c;assert(mode==='clock'&&baseClockCalls===1&&result[0]==='CLOCK'&&result[1]===true,'CLOCK did not win with preserve semantics');const snap=api.runtimeTransitions.snapshot();assert(snap.publicApiDelegates===true&&!snap.transitionInFlight&&!snap.clockTransitionInFlight,'transition diagnostics did not settle');console.log('Phase 24 transition smoke: PASS')})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
