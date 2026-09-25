#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
function fail(message){throw new Error(`RELAY VISUAL COUPLING FAIL: ${message}`)}
function assert(condition,message){if(!condition)fail(message)}
function req(source,token,label){if(!source.includes(token))fail(`${label} missing: ${token}`)}

const source=read('relay-visual-coupling.js'),stabilitySource=read('relay-stretch-stability.js'),html=read('index.html');
new vm.Script(source,{filename:'relay-visual-coupling.js'});new vm.Script(stabilitySource,{filename:'relay-stretch-stability.js'});
const identityAt=html.indexOf('<script src="relay-identity-audio.js"></script>'),visualAt=html.indexOf('<script src="relay-visual-coupling.js"></script>'),stabilityAt=html.indexOf('<script src="relay-stretch-stability.js"></script>'),panelAt=html.indexOf('<script src="relay-panel.js"></script>');
assert(identityAt>=0&&visualAt>identityAt&&stabilityAt>visualAt&&panelAt>stabilityAt,'relay identity/visual/stability/panel parser order changed');
for(const token of [
  "mode:'single-event-relay-contact-coupled'","audioModel.playRelayImpact?.(","audioModel.contactTraceFor(","type:'relay-drive'","type:'relay-contact'",
  'function presentDrive(','function subscribe(','display.installImplementation(\'decodeChannel10\',relayContactVisualDecode',"hardware.registerSettledPaintPolicy('relay-visual-coupling'"
])req(source,token,'single-event relay contract');

let now=0,nextTimerId=1;const timers=[],raf=[],renders=[],baseDecode=[],impacts=[],events=[],storage=new Map(),buttonListeners={};
const timingButton={textContent:'',title:'',attrs:{},addEventListener(type,fn){buttonListeners[type]=fn},setAttribute(name,value){this.attrs[name]=String(value)}};
const context={console,window:null,globalThis:null,Object,Map,Set,Number,String,Math,TypeError,Promise,
  document:{getElementById:id=>id==='relay-timing'?timingButton:null},
  setTimeout(fn,ms=0){const item={id:nextTimerId++,fn,due:now+Math.max(0,Number(ms)||0)};timers.push(item);return item.id},
  clearTimeout(id){const i=timers.findIndex(x=>x.id===id);if(i>=0)timers.splice(i,1)},
  requestAnimationFrame(fn){raf.push(fn);return raf.length}
};
context.window=context;context.globalThis=context;vm.createContext(context);
const registry=installServiceRegistry(context);
context.AGCDSKY_APP_STATE=Object.seal({tickSound:true});
context.AGCDSKY_SHELL={store:{get:key=>storage.has(key)?storage.get(key):null,set(key,value){storage.set(key,String(value));return true}},showControls(){}};
const hardwareState={latches:{10:0},activeDrive:10};let paintPolicy=null;
registry.publish('AGCDSKY_HARDWARE',{snapshot:()=>({latches:{...hardwareState.latches},activeDrive:hardwareState.activeDrive}),registerSettledPaintPolicy:(name,fn)=>{assert(name==='relay-visual-coupling','wrong paint-policy owner');paintPolicy=fn;return()=>{};}},'relay visual smoke');

const profiles={
  0:{setTravelMs:5,resetTravelMs:6,setStableMs:6,resetStableMs:7,setBounceCount:1,resetBounceCount:1,poleSkewUs:0},
  5:{setTravelMs:11,resetTravelMs:12,setStableMs:12,resetStableMs:13,setBounceCount:0,resetBounceCount:0,poleSkewUs:0}
};
const fallback={setTravelMs:8,resetTravelMs:8,setStableMs:9,resetStableMs:9,setBounceCount:0,resetBounceCount:0,poleSkewUs:0};
context.DSKY_RELAY_AUDIO={
  relayIdentity:(row,bit)=>`ROW-${row}:BIT-${bit}`,
  profileFor:(_row,bit)=>profiles[bit]||fallback,
  contactTraceFor:(_row,bit,on)=>{
    const p=profiles[bit]||fallback,travel=on?p.setTravelMs:p.resetTravelMs,stable=on?p.setStableMs:p.resetStableMs;
    if(bit===0&&on)return[{atMs:travel,state:true,kind:'armature'},{atMs:travel+.5,state:false,kind:'bounce'},{atMs:stable,state:true,kind:'settled'}];
    return[{atMs:travel,state:!!on,kind:'armature'},{atMs:stable,state:!!on,kind:'settled'}];
  },
  playRelayImpact:(row,bit,on,strength)=>{impacts.push({row,bit,on:!!on,strength,at:now});return true},
  auxiliaryNames:[],auxiliaryProfileFor:()=>fallback,auxiliaryContactTraceFor:()=>[],playAuxImpact:()=>true
};
context.DSKY_RELAY_MATRIX={segmentsForCode:()=>''};
let decodeImpl=value=>{baseDecode.push({value:Number(value),at:now});return true};
context.AGCDSKY_DISPLAY={
  implementation:name=>{if(name!=='decodeChannel10')throw new Error(`unknown display implementation ${name}`);return decodeImpl},
  installImplementation:(name,next)=>{if(name!=='decodeChannel10'||typeof next!=='function')throw new Error('bad display install');decodeImpl=next;return next},
  renderRelayWord:(row,word)=>renders.push({row:Number(row),word:Number(word)&0o3777,at:now}),
  status:()=>({relayWords:{...hardwareState.latches}})
};
new vm.Script(source,{filename:'relay-visual-coupling.js'}).runInContext(context);
const visual=context.DSKY_RELAY_VISUAL;
assert(visual&&Object.isFrozen(visual),'visual API missing/mutable');
assert(visual.contactBounceVisible===true&&visual.stretchedAudioFrameLocked===true&&visual.stretchedBounceAudio===true,'coupled contact/bounce flags changed');
visual.subscribe(event=>events.push({...event,at:now}));
assert(typeof paintPolicy==='function'&&paintPolicy()===true,'authentic paint policy changed');

function runNextTimer(){
  if(!timers.length)return false;
  timers.sort((a,b)=>a.due-b.due||a.id-b.id);const item=timers.shift();now=item.due;item.fn();return true;
}
function runAllTimers(limit=100){
  let n=0;while(timers.length&&n++<limit)runNextTimer();if(n>=limit)fail('timer loop did not quiesce');
}

const command=(10<<11)|(1<<5)|1;
decodeImpl(command);
assert(baseDecode.length===1&&baseDecode[0].value===command,'wrapper bypassed hardware decoder');
const drives=events.filter(e=>e.type==='relay-drive');
assert(drives.length===2&&drives.some(e=>e.bit===0&&e.durationMs===5)&&drives.some(e=>e.bit===5&&e.durationMs===11),'manufactured drive durations not published');

runNextTimer();
const armature0=events.find(e=>e.type==='relay-contact'&&e.bit===0&&e.phase==='armature');
assert(armature0&&armature0.at===5,'first contact event did not occur at manufactured 5 ms travel');
assert(impacts.some(x=>x.bit===0&&x.at===5),'relay sound was not emitted by the same 5 ms contact event');
assert(renders.some(x=>x.word===1&&x.at===5),'DSKY contact projection was not emitted by the same 5 ms event');

runNextTimer();
assert(events.some(e=>e.type==='relay-contact'&&e.bit===0&&e.phase==='bounce'&&e.state===false&&e.at===5.5),'manufacturing bounce event missing');
assert(renders.some(x=>x.word===0&&x.at===5.5),'DSKY projection did not follow contact bounce');
runAllTimers();
assert(renders[renders.length-1].word===33,'authentic transition did not settle to target contact word');

buttonListeners.click();
assert(visual.getTimingMode()==='stretched'&&paintPolicy()===false,'stretched mode/paint policy changed');
timers.length=0;raf.length=0;renders.length=0;impacts.length=0;events.length=0;now=100;
decodeImpl(command);
const beforeRender=renders.length,beforeImpact=impacts.length;
runNextTimer();
assert(raf.length===1&&renders.length===beforeRender&&impacts.length===beforeImpact,'stretched armature must wait for presentation frame');
const frameAt=now;raf.shift()();
const stretchedArm=events.find(e=>e.type==='relay-contact'&&e.phase==='armature');
assert(stretchedArm&&stretchedArm.at===frameAt,'stretched rack event was not frame-coupled');
assert(impacts.some(x=>x.at===frameAt),'stretched relay sound was not emitted on the contact frame');
assert(renders.some(x=>x.at===frameAt),'stretched DSKY contact was not rendered on the same frame');
assert(visual.lastPresentationClick()&&visual.lastPresentationClick().bit===0,'last presentation click diagnostic changed');

console.log('relay visual coupling smoke: PASS');
console.log('  one manufactured contact event drives relay rack subscribers, sound, DSKY projection and contact bounce; stretched mode remains frame-coupled');
