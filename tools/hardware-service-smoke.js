#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

const stateSource=read('app-state-runtime.js'),hardwareSource=read('hardware-fidelity.js');
const timers=new Map();let timerId=0,now=0;
const commits=[],renders=[],lamps=new Map();
const document={hidden:false,body:{classList:{toggle(){},remove(){}}}};
const context={console,window:null,document,performance:{now:()=>now},setTimeout(fn,ms=0){const id=++timerId;timers.set(id,{fn,due:now+Math.max(0,Number(ms)||0)});return id},clearTimeout(id){timers.delete(id)},setInterval(){return 1},clearInterval(){},Object,Map,Set,Number,String,Math,TypeError,Promise};
context.window=context;vm.createContext(context);
new vm.Script(stateSource,{filename:'app-state-runtime.js'}).runInContext(context);
const compat=context.AGCDSKY_COMPAT,state=context.AGCDSKY_APP_STATE,isFn=v=>typeof v==='function';
state.mode='agc';state.tickSound=false;

const DIGIT_RELAY={' ':0,'0':21,'1':3,'2':25,'3':27,'4':15,'5':30,'6':28,'7':19,'8':29,'9':31};
const CLOCK_GROUPS=[{relay:8,cells:[['r1',0]],singleRight:true}];
const clockDigits={r1:['0','0','0','0','0'],r2:['0','0','0','0','0'],r3:['0','0','0','0','0']},clockRelayWords={};
let relayQueue=[],relayBusy=false,lampTestActive=false,lampTestTimer=0;
compat.readonly('DIGIT_RELAY',()=>DIGIT_RELAY);
compat.readonly('CLOCK_GROUPS',()=>CLOCK_GROUPS);
compat.readonly('desiredClockDigits',()=>()=>({r1:['0','0','0','0','1'],r2:['0','0','0','0','2'],r3:['0','0','0','0','3']}));
compat.readonly('clockWord',()=>((group,want)=>DIGIT_RELAY[want.r1[0]]||0));
compat.accessor('clockDigits',()=>clockDigits,next=>Object.assign(clockDigits,next));
compat.accessor('clockRelayWords',()=>clockRelayWords,next=>{for(const k of Object.keys(clockRelayWords))delete clockRelayWords[k];Object.assign(clockRelayWords,next||{})});
compat.accessor('relayQueue',()=>relayQueue,next=>{relayQueue=Array.isArray(next)?next:[]});
compat.accessor('relayBusy',()=>relayBusy,next=>{relayBusy=!!next});
compat.accessor('lampTestActive',()=>lampTestActive,next=>{lampTestActive=!!next});
compat.accessor('lampTestTimer',()=>lampTestTimer,next=>{lampTestTimer=Number(next)||0});
for(const [name,fn] of [['stopClockQueue',()=>{relayQueue=[];relayBusy=false}],['runRelayQueue',()=>{}],['cancelLampTest',()=>{lampTestActive=false}],['lampTest',()=>{}]])compat.mutable(name,fn,isFn);

context.AGCDSKY_RENDERER={setLamp:(name,on)=>lamps.set(name,!!on)};
context.AGCDSKY_AUDIO={ensure:()=>null,emitTick:()=>{}};
context.AGCDSKY_CLOCK={lampTestActive:()=>lampTestActive,cancelLampTest:(...args)=>compat.get('cancelLampTest')(...args),stopQueue:(...args)=>compat.get('stopClockQueue')(...args),renderReg:name=>renders.push(name),syncFace:()=>{},tick:()=>{}};
const displaySlots={decodeChannel10:()=>{},decodeChannel11:()=>{},decodeChannel13:()=>{},decodeChannel163:()=>{},resetFace:()=>{}};
context.AGCDSKY_DISPLAY={
  commitRelayWord:(relay,word,options)=>{commits.push({relay,word,render:options&&options.render,at:now});return true},
  implementation:name=>displaySlots[name],
  installImplementation(name,next){if(typeof next!=='function')throw new TypeError(`invalid display implementation ${name}`);displaySlots[name]=next;return next}
};
context.AGCDSKY_SHELL={element:()=>({textContent:''})};
new vm.Script(hardwareSource,{filename:'hardware-fidelity.js'}).runInContext(context);
const hardware=context.AGCDSKY_HARDWARE,display=context.AGCDSKY_DISPLAY;
assert(hardware&&Object.isFrozen(hardware),'hardware service missing/mutable');
assert(hardware.relayDriveMs===20&&hardware.dirtyRowStartMs===40,'hardware timing constants changed');
for(const name of ['decodeChannel10','decodeChannel11','decodeChannel163','resetFace'])assert(typeof display.implementation(name)==='function',`hardware did not install ${name} through display service`);
commits.length=0;timers.clear();now=0;

function runNext(){let chosen=null;for(const [id,timer] of timers){if(!chosen||timer.due<chosen.timer.due||(timer.due===chosen.timer.due&&id<chosen.id))chosen={id,timer}}if(!chosen)return false;timers.delete(chosen.id);now=chosen.timer.due;chosen.timer.fn();return true}

display.implementation('decodeChannel10')((10<<11)|0o123);
assert(commits.length===0,'channel 010 published before 20-ms settle');
const first=[...timers.values()].sort((a,b)=>a.due-b.due)[0];
assert(first&&first.due===20,'channel 010 settle callback is not 20 ms');
runNext();
assert(commits.length===1&&commits[0].relay===10&&commits[0].word===0o123&&commits[0].render===true&&commits[0].at===20,'20-ms settled relay commit changed');

const removePolicy=hardware.registerSettledPaintPolicy('test',()=>false);
display.implementation('decodeChannel10')((9<<11)|0o456);
runNext();
assert(commits.length===2&&commits[1].relay===9&&commits[1].word===0o456&&commits[1].render===false,'settled-paint policy must suppress paint without suppressing relay commit');
removePolicy();
hardware.registerSnapshotExtension('test',snapshot=>({...snapshot,testExtension:true}));
const diagnostic=hardware.snapshot();
assert(diagnostic.testExtension===true&&diagnostic.latches[10]===0o123&&diagnostic.latches[9]===0o456,'hardware diagnostic extension/latches changed');
assert(!hardwareSource.includes('window.AGCDSKY.hardware ='),'hardware source must not patch public facade');
for(const name of ['decodeChannel10','decodeChannel11','decodeChannel163','resetFace'])assert(hardwareSource.includes(`display.installImplementation('${name}'`),`hardware display-service registration missing: ${name}`);
for(const legacy of ["compat.replace('decodeChannel10'","compat.replace('decodeChannel11'","compat.replace('decodeChannel163'","compat.replace('resetAgcFace'"])assert(!hardwareSource.includes(legacy),`hardware retained display compatibility mutation: ${legacy}`);
assert(hardwareSource.includes("compat.replace('runRelayQueue'",),'clock queue compatibility hook unexpectedly moved in display-only slice');
assert(hardwareSource.includes('display.commitRelayWord(relay,low11,{render:paint})'),'settled commit marker missing');

console.log('hardware service smoke: PASS');
console.log('  display-owned decoder/reset hooks, 20-ms settled commit, paint-policy suppression, latch diagnostics, and diagnostic extension composition verified');
