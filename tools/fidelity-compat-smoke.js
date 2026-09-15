#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
class Classes{constructor(){this.values=new Set()}add(...n){n.forEach(x=>this.values.add(x))}remove(...n){n.forEach(x=>this.values.delete(x))}toggle(n,f){if(f===undefined)f=!this.values.has(n);f?this.values.add(n):this.values.delete(n);return f}contains(n){return this.values.has(n)}}
class Element{constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.classList=new Classes();this.style={filter:''}}}
const elements=Object.fromEntries(['prog','verb','noun','r1','r2','r3','sound','mode','dsky'].map(id=>[id,new Element(id)]));
const lamps={};for(const name of ['comp','uplink','temp','keyrel','oprerr','restart','stby','vel','noatt','alt','gimbal','tracker','prog'])lamps[name]=new Element(`lamp-${name}`);
const timers=[];
const document={hidden:false,body:new Element('body'),getElementById:id=>elements[id]||null,querySelector(selector){const match=selector.match(/^\[data-lamp="(.+)"\]$/);return match?lamps[match[1]]||null:null},querySelectorAll(selector){return selector==='[data-lamp]'?Object.values(lamps):[]}};
const storage=new Map();
const shell={store:{get:key=>storage.has(key)?storage.get(key):null,set(key,value){storage.set(key,String(value));return true},remove:key=>storage.delete(key)},element:id=>elements[id]||null,accurateDate:()=>new Date('2026-09-15T13:07:05Z'),show:(verb,noun)=>{elements.verb.textContent=verb;elements.noun.textContent=noun}};
const environment={tickLevel:()=>1};
const context={console,window:null,document,AGCDSKY_SHELL:shell,AGCDSKY_ENVIRONMENT:environment,renderReplacementCalls:0,audioReplacementCalls:0,clockReplacementCalls:0,channelReplacement:null,setTimeout(fn,ms=0){timers.push({fn,ms});return timers.length},clearTimeout(){}};
context.window=context;vm.createContext(context);
const load=name=>new vm.Script(read(name),{filename:name}).runInContext(context);

load('app-state-runtime.js');
const state=context.AGCDSKY_APP_STATE,core=context.AGCDSKY_CORE_SESSION,compat=context.AGCDSKY_COMPAT;
assert(state&&Object.isSealed(state),'app state missing or unsealed');assert(core&&Object.isSealed(core),'core session missing or unsealed');assert(compat&&Object.isFrozen(compat),'compatibility registry missing or mutable');
for(const name of ['mode','verb','tickSound','agcCore'])assert(!Object.getOwnPropertyDescriptor(context,name),`state field leaked onto Window: ${name}`);

load('dsky-display-renderer.js');
const renderer=context.AGCDSKY_RENDERER;renderer.set2('prog','16');assert(elements.prog.innerHTML.includes('el-glyph'),'base renderer did not render');
const renderVersion=renderer.compatibilityVersions().renderDigits;
vm.runInContext("'use strict'; renderDigits=function(el,text){renderReplacementCalls++;el.innerHTML='replacement:'+text}",context);
renderer.set2('prog','88');assert(elements.prog.innerHTML==='replacement:88'&&context.renderReplacementCalls===1,'strict renderer replacement did not dispatch through service');assert(renderer.compatibilityVersions().renderDigits===renderVersion+1,'renderer replacement was not versioned');

load('relay-audio-runtime.js');
const audio=context.AGCDSKY_AUDIO,audioBefore=audio.compatibilityVersions();
vm.runInContext("'use strict'; playRelayBurst=function(count){audioReplacementCalls+=count}; applyTickSound=function(){audioReplacementCalls+=100}",context);
audio.playBurst(7);audio.applySetting();assert(context.audioReplacementCalls===107,'strict audio replacements did not dispatch through service');const audioAfter=audio.compatibilityVersions();assert(audioAfter.playBurst===audioBefore.playBurst+1&&audioAfter.applySetting===audioBefore.applySetting+1,'audio replacements were not versioned');

load('phone-clock-runtime.js');
const clock=context.AGCDSKY_CLOCK;clock.syncFace();assert(context.clockDigits.r1.join('')==='00013'&&context.clockDigits.r2.join('')==='00007'&&context.clockDigits.r3.join('')==='00005','PHONE CLOCK digits changed');assert(context.DIGIT_RELAY['8']===0o35,'digit relay 8 changed');assert(clock.v35RelayState()[12]===0o650,'Comanche V35 relay 12 changed');
const tickVersion=clock.compatibilityVersions().tick;vm.runInContext("'use strict'; tick=function(){clockReplacementCalls++}",context);clock.tick();assert(context.clockReplacementCalls===1,'strict clock replacement did not dispatch through service');assert(clock.compatibilityVersions().tick===tickVersion+1,'clock replacement was not versioned');const digitTable=context.DIGIT_RELAY;vm.runInContext("'use strict'; DIGIT_RELAY={}",context);assert(context.DIGIT_RELAY===digitTable&&context.DIGIT_RELAY['8']===0o35,'read-only compatibility value was replaced');

load('agc-display-runtime.js');
const display=context.AGCDSKY_DISPLAY;state.mode='agc';state.tickSound=false;display.onChannel(0o10,(10<<11)|(3<<5)|25);assert(display.status().display.verb.join('')==='12','base channel-010 decode changed');display.onChannel(0o11,0o6);assert(display.status().channels.ch011===0o6&&lamps.comp.classList.contains('on')&&lamps.uplink.classList.contains('on'),'channel-011 decode changed');display.onChannel(0o163,0o770);assert(lamps.temp.classList.contains('on')&&lamps.keyrel.classList.contains('on')&&lamps.oprerr.classList.contains('on'),'channel-0163 decode changed');
const ui=display.snapshotUi();display.resetFace();display.applySnapshotUi(ui);assert(display.status().display.verb.join('')==='12','display UI snapshot round-trip changed');
const relayDigitVersion=display.compatibilityVersions().relayDigit;vm.runInContext("'use strict'; relayDigit=function(code){return Number(code)===1?'X':' '}",context);display.onChannel(0o10,(10<<11)|(1<<5)|1);assert(display.status().display.verb.join('')==='XX','schematic relayDigit replacement did not affect base decoder');assert(display.compatibilityVersions().relayDigit===relayDigitVersion+1,'relayDigit replacement was not versioned');
const channelVersion=display.compatibilityVersions().ch10;vm.runInContext("'use strict'; decodeChannel10=function(value){channelReplacement=value}",context);display.onChannel(0o10,12345);assert(context.channelReplacement===12345,'strict channel-010 replacement did not dispatch through service');assert(display.compatibilityVersions().ch10===channelVersion+1,'channel-010 replacement was not versioned');state.mode='clock';context.channelReplacement=null;display.onChannel(0o10,77);assert(context.channelReplacement===null,'display mode gate was bypassed by replacement slot');

for(const required of ['renderDigits','playRelayBurst','tick','relayDigit','decodeChannel10'])assert(compat.describe().some(item=>item.name===required&&item.version>=1),`compatibility diagnostics missing ${required}`);
console.log('fidelity compatibility smoke: PASS');
console.log('  strict renderer/audio/clock/display replacements dispatch through frozen services');
console.log('  app/core state stays explicit and read-only compatibility values resist replacement');
console.log('  schematic relayDigit and channel-010 middleware replacements are versioned');
