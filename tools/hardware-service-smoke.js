#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

const stateSource=read('app-state-runtime.js'),topologySource=read('dsky-relay-topology.js'),hardwareSource=read('hardware-fidelity.js');
const timers=new Map();let timerId=0,now=0;
const commits=[],renders=[],lamps=new Map(),channelState=[],classStates=new Map();
const document={hidden:false,body:{classList:{toggle(name,on){classStates.set(name,!!on)},remove(...names){for(const name of names)classStates.set(name,false)}}}};
const context={console,window:null,document,performance:{now:()=>now},setTimeout(fn,ms=0){const id=++timerId;timers.set(id,{fn,due:now+Math.max(0,Number(ms)||0)});return id},clearTimeout(id){timers.delete(id)},setInterval(){return 1},clearInterval(){},Object,Map,Set,Number,String,Math,TypeError,Promise};
context.window=context;installServiceRegistry(context);vm.createContext(context);
new vm.Script(stateSource,{filename:'app-state-runtime.js'}).runInContext(context);
new vm.Script(topologySource,{filename:'dsky-relay-topology.js'}).runInContext(context);
const state=context.AGCDSKY_APP_STATE;
state.mode='agc';state.tickSound=false;

const DIGIT_RELAY={' ':0,'0':21,'1':3,'2':25,'3':27,'4':15,'5':30,'6':28,'7':19,'8':29,'9':31};
const CLOCK_GROUPS=[{relay:8,cells:[['r1',0]],singleRight:true}];
const clockDigits={r1:['0','0','0','0','0'],r2:['0','0','0','0','0'],r3:['0','0','0','0','0']},clockRelayWords={};
let relayQueue=[],relayBusy=false,lampTestActive=false,lampTestTimer=0;
const clockSlots={
  stopQueue:()=>{relayQueue=[];relayBusy=false},
  runQueue:()=>{},
  cancelLampTest:()=>{lampTestActive=false},
  lampTest:()=>{}
};

context.AGCDSKY_RENDERER={setLamp:(name,on)=>lamps.set(name,!!on)};
context.AGCDSKY_AUDIO={ensure:()=>null,emitTick:()=>{}};
context.AGCDSKY_CLOCK={
  relayGroups:()=>CLOCK_GROUPS,
  desiredDigits:()=>({r1:['0','0','0','0','1'],r2:['0','0','0','0','2'],r3:['0','0','0','0','3']}),
  relayWord:(group,want)=>DIGIT_RELAY[want.r1[0]]||0,
  digitRelayCode:value=>DIGIT_RELAY[String(value)]??0,
  digits:()=>clockDigits,
  relayWords:()=>clockRelayWords,
  queue:()=>relayQueue,
  queueBusy:()=>relayBusy,
  setQueueBusy:value=>(relayBusy=!!value),
  lampTestActive:()=>lampTestActive,
  setLampTestActive:value=>(lampTestActive=!!value),
  lampTestTimer:()=>lampTestTimer,
  setLampTestTimer:value=>(lampTestTimer=Number(value)||0),
  implementation:name=>clockSlots[name],
  installImplementation(name,next){if(typeof next!=='function')throw new TypeError(`invalid clock implementation ${name}`);clockSlots[name]=next;return next},
  cancelLampTest:(...args)=>clockSlots.cancelLampTest(...args),
  stopQueue:(...args)=>clockSlots.stopQueue(...args),
  runQueue:(...args)=>clockSlots.runQueue(...args),
  lampTest:(...args)=>clockSlots.lampTest(...args),
  renderReg:name=>renders.push(name),
  syncFace:()=>{},
  tick:()=>{}
};
const displaySlots={decodeChannel10:()=>{},decodeChannel11:()=>{},decodeChannel13:()=>{},decodeChannel163:()=>{},resetFace:()=>{}},externalChannelHandlers=new Map();
context.AGCDSKY_DISPLAY={
  commitRelayWord:(relay,word,options)=>{commits.push({relay,word,render:options&&options.render,at:now});return true},
  setChannelState:(channel,value,options)=>{channelState.push({channel,value,render:!!(options&&options.render),at:now});return true},
  implementation:name=>displaySlots[name],
  installImplementation(name,next){if(typeof next!=='function')throw new TypeError(`invalid display implementation ${name}`);displaySlots[name]=next;return next},
  registerChannelHandler(channel,handler){if(typeof handler!=='function')throw new TypeError('invalid external channel handler');externalChannelHandlers.set(Number(channel),handler);return()=>externalChannelHandlers.delete(Number(channel))}
};
context.AGCDSKY_SHELL={element:()=>({textContent:''})};
new vm.Script(hardwareSource,{filename:'hardware-fidelity.js'}).runInContext(context);
const hardware=context.AGCDSKY_HARDWARE,display=context.AGCDSKY_DISPLAY,clock=context.AGCDSKY_CLOCK;
assert(hardware&&Object.isFrozen(hardware),'hardware service missing/mutable');
assert(hardware.relayDriveMs===20&&hardware.dirtyRowStartMs===40,'hardware timing constants changed');
for(const name of ['decodeChannel10','decodeChannel11','decodeChannel163','resetFace'])assert(typeof display.implementation(name)==='function',`hardware did not install ${name} through display service`);
for(const name of ['stopQueue','runQueue'])assert(typeof clock.implementation(name)==='function',`hardware did not install ${name} through clock service`);
commits.length=0;timers.clear();now=0;

function runNext(){let chosen=null;for(const [id,timer] of timers){if(!chosen||timer.due<chosen.timer.due||(timer.due===chosen.timer.due&&id<chosen.id))chosen={id,timer}}if(!chosen)return false;timers.delete(chosen.id);now=chosen.timer.due;chosen.timer.fn();return true}

display.implementation('decodeChannel10')((10<<11)|0o123);
assert(commits.length===0,'channel 010 published before 20-ms settle');
const first=[...timers.values()].sort((a,b)=>a.due-b.due)[0];
assert(first&&first.due===20,'channel 010 settle callback is not 20 ms');
runNext();
assert(commits.length===1&&commits[0].relay===10&&commits[0].word===0o123&&commits[0].render===true&&commits[0].at===20,'20-ms settled relay commit changed');

display.implementation('decodeChannel11')(0o46);
assert(channelState.some(item=>item.channel===0o11&&item.value===0o46&&item.render===false),'channel 011 raw state must update without bypassing relay contacts');
assert(lamps.get('comp')===true&&lamps.get('uplink')===true,'auxiliary relay fallback did not project channel 011 lamps');
assert(hardware.snapshot().auxRelays.isswar===false,'channel 011 bit 1 state changed unexpectedly');
assert(hardware.snapshot().auxRelays.flash===false,'channel 011 flash command must not masquerade as the physical FLASH relay');
assert(typeof externalChannelHandlers.get(0o12)==='function','channel 012 hardware relay handler was not registered');
externalChannelHandlers.get(0o12)(0o30000);
assert(hardware.snapshot().auxRelays.injseq===true&&hardware.snapshot().auxRelays.cutoff===true,'channel 012 INJ SEQ/CUTOFF physical relays did not follow real AGC output');
display.implementation('decodeChannel163')(0o770);
assert(channelState.some(item=>item.channel===0o163&&item.value===0o770&&item.render===false),'channel 0163 raw state must update without bypassing relay contacts');
assert(lamps.get('temp')===true&&lamps.get('keyrel')===true&&lamps.get('oprerr')===true&&lamps.get('restart')===true&&lamps.get('stby')===true,'auxiliary relay fallback did not project channel 0163 lamps');
display.implementation('decodeChannel163')(0o771);
assert(hardware.snapshot().auxRelays.circuit===true,'channel 0163 bit 1 did not drive CIRCUIT/CMC warning physical relay');
assert(hardware.snapshot().auxRelays.flash===true&&classStates.get('vn-flash-off')===true,'channel 0163 flash-off phase must drive the modeled FLASH relay and visible blanking together');
display.implementation('decodeChannel163')(0o730);
assert(hardware.snapshot().auxRelays.flash===false&&classStates.get('vn-flash-off')===false,'channel 0163 flash-on phase must release the modeled FLASH relay and visible blanking together');

// ROW-03:B is a logical channel-010 bit with no physical relay package.
display.implementation('decodeChannel10')((3<<11)|0o2000);
assert(hardware.snapshot().lastWrite.changed===0,'unpopulated ROW-03:B produced a physical armature change');
runNext();
assert(commits.some(item=>item.relay===3&&item.word===0o2000),'logical ROW-03:B word failed to settle despite absent physical relay');

const removePolicy=hardware.registerSettledPaintPolicy('test',()=>false);
display.implementation('decodeChannel10')((9<<11)|0o456);
runNext();
assert(commits.length===2&&commits[1].relay===9&&commits[1].word===0o456&&commits[1].render===false,'settled-paint policy must suppress paint without suppressing relay commit');
removePolicy();
hardware.registerSnapshotExtension('test',snapshot=>({...snapshot,testExtension:true}));
const diagnostic=hardware.snapshot();
assert(diagnostic.testExtension===true&&diagnostic.latches[10]===0o123&&diagnostic.latches[9]===0o456,'hardware diagnostic extension/latches changed');
assert(!hardwareSource.includes('window.AGCDSKY.hardware ='),'hardware source must not patch public facade');
assert(hardwareSource.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_HARDWARE'"),'hardware service must publish explicitly through the registry');
for(const name of ['decodeChannel10','decodeChannel11','decodeChannel163','resetFace'])assert(hardwareSource.includes(`display.installImplementation('${name}'`),`hardware display-service registration missing: ${name}`);
for(const name of ['stopQueue','runQueue'])assert(hardwareSource.includes(`clock.installImplementation('${name}'`),`hardware clock-service registration missing: ${name}`);
for(const forbidden of ["clock.installImplementation('cancelLampTest'","clock.installImplementation('lampTest'",'hardwareLampTest','scheduleSyntheticRows'])assert(!hardwareSource.includes(forbidden),`hardware retained synthetic V35 hook: ${forbidden}`);
assert(!hardwareSource.includes('AGCDSKY_COMPAT')&&!hardwareSource.includes('compat.'),'hardware retained direct compatibility-registry dependency');
assert(hardwareSource.includes('display.commitRelayWord(relay,low11,{render:paint})'),'settled commit marker missing');
assert(hardwareSource.includes("visual.presentDrive(relay,prior,low11,{renderContact:!!render})"),'clock no-paint policy is not propagated into relay contact presentation');
assert(hardwareSource.includes('beginRelayDrive(relay,low11,false);relayWords[relay]=low11;'),'PHONE CLOCK queue must retain no-transient-display relay drive');

console.log('hardware service smoke: PASS');
console.log('  explicit hardware-service publication, normal clock queue hooks, no synthetic V35 hook, clock no-transient-EL relay presentation, 20-ms settled commit, paint-policy suppression, latch diagnostics, and diagnostic extension composition verified');
