#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'agc-lifecycle-runtime.js'),'utf8'),app=fs.readFileSync(path.join(ASSETS,'app.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const elements={agc:{textContent:''},mode:{textContent:''}};let constructCount=0,loadCount=0,startCount=0,stopCount=0,resetCount=0,configureCount=0,renderCount=0,faceResetCount=0;const saves=[],remembered=[];
class FakeCore{constructor(o){this.options=o;this.running=false;constructCount++}async load(o){this.loaded=o;loadCount++}start(){this.running=true;startCount++}stop(){this.running=false;stopCount++}reset(){resetCount++}configureInputMasks(){configureCount++}version(){return'fake-core'}snapshotFingerprint(){return'fp'}}
const context={console,document:{hidden:false},AgcCore:FakeCore,mode:'clock',dream:false,selectedMission:'comanche055',verb:'16',noun:'65',agcCh11:2,agcCh13:3,agcCh163:4,agcDisplay:{verb:['1','6']},lastSnapshotAction:'none',lastSnapshotError:'',lastSnapshotVerify:null,lastAutosaveAt:0,
  $:id=>elements[id],clockTimeLabel:()=> 'CLOCK',cancelLampTest(){},rememberRunMode:m=>remembered.push(m),saveAgcState:r=>{saves.push(r);return true},savedSnapshotInfo:()=>null,clearLamps(){},set2(){},show(){},stopClockQueue(){},syncClockFace(){},missionSpec:()=>({label:'COMANCHE055',rope:'Comanche055.bin'}),renderAgcSnapshot:()=>renderCount++,resetAgcFace:()=>faceResetCount++,onAgcChannel(){},restoreSavedAgcState:()=>false,JSON,Object,String};
vm.createContext(context);new vm.Script(source,{filename:'agc-lifecycle-runtime.js'}).runInContext(context);
(async()=>{
  await vm.runInContext('enterAgc()',context);
  assert(context.mode==='agc','cold AGC entry did not reach AGC mode');
  assert(constructCount===1&&loadCount===1,'cold AGC entry did not construct/load one core');
  assert(vm.runInContext('agcCore.running',context)===true&&startCount===1,'cold AGC core did not start');
  assert(vm.runInContext('agcLoadedMission',context)==='comanche055','loaded mission tracking changed');
  const firstCore=vm.runInContext('agcCore',context);
  vm.runInContext("enterClock('CLOCK',true)",context);
  assert(context.mode==='clock'&&saves.includes('suspend for clock'),'CLOCK suspension did not save resumable state');
  assert(vm.runInContext('agcSuspendedForClock',context)===true,'CLOCK suspension flag not retained');
  await vm.runInContext('enterAgc()',context);
  assert(context.mode==='agc'&&vm.runInContext('agcCore',context)===firstCore,'CLOCK-to-AGC did not resume same core');
  assert(constructCount===1&&loadCount===1,'resume unexpectedly rebuilt/reloaded core');
  vm.runInContext('setAppVisible(false)',context);assert(vm.runInContext('appVisible',context)===false&&saves.includes('app background'),'visibility hide did not pause/save');
  vm.runInContext('setAppVisible(true)',context);assert(vm.runInContext('appVisible',context)===true&&vm.runInContext('agcCore.running',context)===true,'visibility resume did not restart core');
  const status=vm.runInContext('agcAppStatus()',context);assert(status.mode==='agc'&&status.coreLoaded&&status.loadedMission==='comanche055','lifecycle status changed');assert(status.channels.ch011===2&&status.display.verb.join('')==='16','status lost display/channel authority');
  assert(faceResetCount===1&&remembered.filter(x=>x==='agc').length>=2,'lifecycle mode bookkeeping changed');
  for(const token of ['let agcCore=null','function enterClock(','async function enterAgc()','function agcFailure(','function setAppVisible(','function agcAppStatus()']){assert(source.includes(token),`lifecycle runtime missing ${token}`);assert(!app.includes(token),`app.js regained lifecycle ownership: ${token}`)}
  for(const forbidden of ['localStorage','function decodeChannel10(','SNAPSHOT_KEY','function saveAgcState(','function solarTimes('])assert(!source.includes(forbidden),`lifecycle runtime crossed authority boundary: ${forbidden}`);
  console.log('AGC lifecycle runtime smoke: PASS');
  console.log('  cold load, CLOCK suspension/save, same-core resume, visibility lifecycle, and status reporting verified');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
