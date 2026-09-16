#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNERS=new Set([
  'app-state-runtime.js',
  'dsky-display-renderer.js',
  'relay-audio-runtime.js',
  'phone-clock-runtime.js',
  'agc-display-runtime.js'
]);
const token='AGCDSKY_COMPAT';
const js=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const consumers=[];
for(const name of js){
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  if(source.includes(token))consumers.push(name);
}
const unexpected=consumers.filter(name=>!OWNERS.has(name));
const missing=[...OWNERS].filter(name=>!consumers.includes(name));
if(unexpected.length)throw new Error(`compatibility registry escaped owning runtimes: ${unexpected.join(', ')}`);
if(missing.length)throw new Error(`expected compatibility boundary owner no longer registers aliases: ${missing.join(', ')}`);
if(consumers.length!==OWNERS.size)throw new Error(`compatibility owner count changed: ${consumers.join(', ')}`);
for(const name of consumers){
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  if(name==='app-state-runtime.js'){
    if(!source.includes('window.AGCDSKY_COMPAT = Object.freeze({mutable,accessor,alias,readonly,get,replace,describe});'))throw new Error('compatibility registry publication changed');
    if(!source.includes('function alias(name, getter, setter = null, versionGetter = null, historyGetter = null)'))throw new Error('forwarded compatibility alias primitive missing');
    continue;
  }
  if(!source.includes('const compat=window.AGCDSKY_COMPAT;'))throw new Error(`${name} does not bind registry only at its service boundary`);
  if(!source.includes('window.AGCDSKY_'))throw new Error(`${name} no longer publishes an owning service`);
}
const renderer=fs.readFileSync(path.join(ASSETS,'dsky-display-renderer.js'),'utf8');
if(!renderer.includes('createImplementationSlot(')||!renderer.includes('compat.alias(name,slot.get'))throw new Error('renderer does not own implementation slots behind forwarded compatibility aliases');
if(renderer.includes("compat.mutable('glyph'")||renderer.includes("compat.mutable('renderDigits'")||renderer.includes("compat.mutable('set2'"))throw new Error('renderer compatibility registry still owns implementation state');
const audio=fs.readFileSync(path.join(ASSETS,'relay-audio-runtime.js'),'utf8');
if(!audio.includes('function createOwnedSlot(name,initial,validate=null)')||!audio.includes('function createContextSlot()')||!audio.includes("compat.alias('audioCtx'")||!audio.includes('compat.alias(name,slot.get'))throw new Error('audio does not own context/implementation slots behind forwarded compatibility aliases');
for(const token of ["compat.accessor('audioCtx'","compat.mutable('ensureAudio'","compat.mutable('emitTick'","compat.mutable('playRelayBurst'","compat.mutable('applyTickSound'"])if(audio.includes(token))throw new Error(`audio compatibility registry still owns live state: ${token}`);
const clock=fs.readFileSync(path.join(ASSETS,'phone-clock-runtime.js'),'utf8');
if(!clock.includes('function createImplementationSlot(name,initial,validate=null)')||!clock.includes('function createStateSlot(name,getter,setter)')||!clock.includes("runQueueSlot=createImplementationSlot('runRelayQueue'")||!clock.includes("lampTestSlot=createImplementationSlot('lampTest'")||!clock.includes("digitsStateSlot=createStateSlot('clockDigits'")||!clock.includes("busyStateSlot=createStateSlot('relayBusy'")||!clock.includes('compat.alias(name,slot.get'))throw new Error('clock does not own implementation/backing-state slots behind forwarded compatibility aliases');
for(const token of ["compat.mutable('renderClockReg'","compat.mutable('syncClockFace'","compat.mutable('stopClockQueue'","compat.mutable('runRelayQueue'","compat.mutable('tick'","compat.mutable('cancelLampTest'","compat.mutable('lampTest'","compat.accessor('clockDigits'","compat.accessor('clockRelayWords'","compat.accessor('relayQueue'","compat.accessor('relayBusy'","compat.accessor('lampTestActive'","compat.accessor('lampTestTimer'"])if(clock.includes(token))throw new Error(`clock compatibility registry still owns live state: ${token}`);
const display=fs.readFileSync(path.join(ASSETS,'agc-display-runtime.js'),'utf8');
if(!display.includes('function createImplementationSlot(name,initial,validate=null)')||!display.includes("relayDigitSlot=createImplementationSlot('relayDigit'")||!display.includes("decode10Slot=createImplementationSlot('decodeChannel10'")||!display.includes("applySnapshotSlot=createImplementationSlot('applySnapshotUi'")||!display.includes('compat.alias(name,slot.get'))throw new Error('display does not own implementation slots behind forwarded compatibility aliases');
for(const token of ["compat.mutable('relayDigit'","compat.mutable('renderAgcReg'","compat.mutable('resetAgcFace'","compat.mutable('decodeChannel10'","compat.mutable('decodeChannel11'","compat.mutable('decodeChannel13'","compat.mutable('decodeChannel163'","compat.mutable('applySnapshotUi'"])if(display.includes(token))throw new Error(`display compatibility registry still owns implementation state: ${token}`);
console.log('compat boundary smoke: PASS');
console.log(`  registry confined to ${consumers.join(', ')}; renderer, audio, clock, and display implementation/live state is owner-held behind forwarded aliases`);