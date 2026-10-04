#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/sextant-tap-mark.js'),'utf8');
const fail=message=>{throw new Error(`SEXTANT TAP MARK FAIL: ${message}`)};
const listeners=Object.create(null),timers=[];
const marker={style:{setProperty(){}},classList:{add(){},remove(){}},setAttribute(){},innerHTML:''};
const eye={
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};},
  addEventListener(name,fn){listeners[name]=fn;},
  appendChild(){},
  setPointerCapture(){}
};
const document={
  readyState:'complete',hidden:false,
  getElementById(id){return id==='sxt-eyepiece'?eye:id==='sxt-tap-mark'?marker:null;},
  createElement(){return marker;},
  addEventListener(){}
};
const writes=[];
let marks=0,service=null;
const core={running:true,writeIo(channel,value){writes.push([channel,value]);return 1;},navKeyPulse(){marks++;return true;}};
const context={
  window:null,document,performance:{now(){return 0;}},console,
  setTimeout(fn,ms){const timer={fn,ms};timers.push(timer);return timer;},
  clearTimeout(timer){const i=timers.indexOf(timer);if(i>=0)timers.splice(i,1);},
  setInterval(){return 1;},clearInterval(){},
  AGCDSKY:{getCore:()=>core,getMission:()=> 'comanche055',sextantStatus:()=>({pending:{shaft:0,trunnion:0},target:null})},
  AGCDSKY_SERVICE_REGISTRY:{publish(name,value){if(name==='AGCDSKY_SEXTANT_TAP_MARK')service=value;}}
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'sextant-tap-mark.js'});
if(!service||!listeners.pointerdown||!listeners.pointerup)fail('service or eye pointer handlers missing');

listeners.pointerdown({button:0,pointerId:7,clientX:75,clientY:75});
listeners.pointerup({pointerId:7,clientX:75,clientY:75,preventDefault(){}});

(async()=>{
  for(let i=0;i<8;i++)await Promise.resolve();
  const pulseTimers=timers.filter(timer=>timer.ms===4);
  if(writes.length!==16||pulseTimers.length!==2)fail(`expected one 8-pulse batch per CDU before cancellation; got ${writes.length} writes and ${pulseTimers.length} timers`);
  const expectedFirstBatch=[...Array(8)].map(()=>[0o236,0o21]).concat([...Array(8)].map(()=>[0o235,0o23]));
  if(JSON.stringify(writes)!==JSON.stringify(expectedFirstBatch))fail('tap-to-mark must use source-backed fast PCDU/MCDU sequences for both optical CDUs');
  service.cancel();
  for(const timer of pulseTimers)timer.fn();
  for(let i=0;i<8;i++)await Promise.resolve();
  if(writes.length!==16)fail(`cancelled tap continued sending CDU pulses (${writes.length} total)`);
  if(marks!==0)fail('cancelled tap emitted MARK');
  console.log('sextant tap mark smoke: PASS');
  console.log('  cancellation during CDU pulse settling stops later pulses and suppresses MARK');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
