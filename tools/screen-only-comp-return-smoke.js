#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'app/src/main/assets/screen-only.js'),'utf8');
function assert(condition,message){if(!condition)throw new Error(message)}

const listeners={document:{},el:{},display:{}};
const on=(bucket,type,fn)=>{(bucket[type]||(bucket[type]=[])).push(fn)};
const classes=new Set();
const body={classList:{
  toggle(name,onValue){onValue?classes.add(name):classes.delete(name)},
  remove:name=>classes.delete(name)
}};
const compChild={};
const comp={contains:target=>target===comp||target===compChild};
const el={addEventListener:(type,fn)=>on(listeners.el,type,fn)};
const display={textContent:'',addEventListener:(type,fn)=>on(listeners.display,type,fn)};
const storage=new Map([['screenOnly','1']]);
const appState={tickSound:false};
let controlsShown=0,audioEnsured=0,audioApplied=0,bursts=0,now=0,nextTimer=1;
const context={
  window:{AGCDSKY_APP_STATE:appState},
  document:{body,getElementById:id=>id==='display'?display:id==='elpanel'?el:id==='comp'?comp:null,addEventListener:(type,fn)=>on(listeners.document,type,fn)},
  location:{search:''},URLSearchParams,
  localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value))},
  performance:{now:()=>now},setTimeout:()=>nextTimer++,clearTimeout:()=>{},
  showControls(){controlsShown++},ensureAudio(){audioEnsured++},applyTickSound(){audioApplied++},playRelayBurst(){bursts++},console
};
vm.runInNewContext(source,context,{filename:'screen-only.js'});
const fire=(bucket,type,event={})=>{for(const fn of bucket[type]||[])fn(event)};
const event=target=>({target,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.immediate=true}});

assert(classes.has('screen-only'),'stored screen-only mode did not activate');
fire(listeners.document,'pointerdown',event(compChild));
now=120;
fire(listeners.document,'pointerup',event(compChild));
assert(!classes.has('screen-only'),'COMP ACTY tap did not return to full DSKY');
assert(storage.get('screenOnly')==='0','COMP ACTY return was not persisted');
assert(controlsShown===0,'COMP ACTY return unexpectedly opened controls');
assert(audioEnsured===0&&audioApplied===0&&bursts===0&&!appState.tickSound,'COMP ACTY return toggled relay-click sound');

const syntheticClick=event(compChild);
fire(listeners.el,'click',syntheticClick);
assert(syntheticClick.prevented&&syntheticClick.stopped,'COMP ACTY synthetic click was not consumed');
assert(!classes.has('screen-only'),'COMP ACTY synthetic click bounced back into screen-only mode');

// A later independent EL/COMP tap from full DSKY must retain the existing
// shortcut that enters isolated EL mode.
now=300;fire(listeners.document,'pointerdown',event(compChild));
now=420;fire(listeners.document,'pointerup',event(compChild));
fire(listeners.el,'click',event(compChild));
assert(classes.has('screen-only'),'later EL tap no longer enters screen-only mode');

// Ordinary screen-only short tap keeps the existing relay-click toggle.
const elsewhere={};
now=500;fire(listeners.document,'pointerdown',event(elsewhere));
now=620;fire(listeners.document,'pointerup',event(elsewhere));
assert(appState.tickSound&&audioEnsured===1&&audioApplied===1&&bursts===1,'ordinary screen-only tap behavior regressed');

console.log('screen-only COMP ACTY return smoke: PASS');
