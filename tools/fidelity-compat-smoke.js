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
const context={console,window:null,document,AGCDSKY_SHELL:shell,AGCDSKY_ENVIRONMENT:environment,renderReplacementCalls:0,audioReplacementCalls:0,clockReplacementCalls:0,clockServiceCalls:0,channelReplacement:null,setTimeout(fn,ms=0){timers.push({fn,ms});return timers.length},clearTimeout(){}};
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
const clock=context.AGCDSKY_CLOCK;clock.syncFace();assert(context.clockDigits.r1.join('')==='00013'&&context.clockDigits.r2.join('')==='00007'&&context.clockDigits.r3.join('')==='00005','PHONE CLOCK digits changed');assert(context.DIGIT_RELAY['8']===0o35&&clock.digitRelayCode('8')===0o35,'digit relay 8 changed');let v35ClockError=null;try{clock.lampTest()}catch(error){v35ClockError=error}assert(v35ClockError&&/AGC\/Comanche/.test(String(v35ClockError.message||v35ClockError)),'PHONE CLOCK did not reject synthetic V35');assert(clock.relayGroups()===context.CLOCK_GROUPS&&clock.digits()===context.clockDigits&&clock.relayWords()===context.clockRelayWords&&clock.queue()===context.relayQueue,'clock service state views diverged from compatibility aliases');
const backing=clock.snapshotBackingState(),probe=clock.snapshotBackingState();probe.digits.r1[0]='9';probe.relayWords[8]=999;assert(context.clockDigits.r1[0]==='0'&&context.clockRelayWords[8]!==999,'clock backing snapshot leaked mutable service state');clock.restoreBackingState({digits:{r1:['1','2','3','4','5'],r2:['5','4','3','2','1'],r3:['0','0','0','0','0']},relayWords:{8:123}});assert(context.clockDigits.r1.join('')==='12345'&&context.clockRelayWords[8]===123,'clock backing restore did not update compatibility aliases');clock.restoreBackingState(backing);assert(context.clockDigits.r1.join('')==='00013','clock backing restore did not restore prior digits');clock.setQueueBusy(true);assert(clock.queueBusy()===true&&context.relayBusy===true,'clock queue-busy service state did not reach compatibility alias');clock.setQueueBusy(false);clock.setLampTestActive(true);assert(clock.lampTestActive()===true&&context.lampTestActive===true,'clock lamp-test service state did not reach compatibility alias');clock.setLampTestActive(false);assert(clock.lampTestActive()===false&&context.lampTestActive===false,'clock lamp-test service state did not release compatibility alias');clock.setLampTestTimer(77);assert(clock.lampTestTimer()===77&&context.lampTestTimer===77,'clock lamp-test timer service state did not reach compatibility alias');clock.setLampTestTimer(0);
const stopVersion=clock.compatibilityVersions().stopQueue;clock.installImplementation('stopQueue',()=>{context.clockServiceCalls++},'service ownership smoke');clock.stopQueue();context.stopClockQueue();assert(context.clockServiceCalls===2,'clock service replacement did not dispatch through service and compatibility alias');assert(clock.compatibilityVersions().stopQueue===stopVersion+1,'clock service replacement was not versioned');
const tickVersion=clock.compatibilityVersions().tick;vm.runInContext("'use strict'; tick=function(){clockReplacementCalls++}",context);clock.tick();assert(context.clockReplacementCalls===1,'strict clock replacement did not dispatch through service');assert(clock.compatibilityVersions().tick===tickVersion+1,'clock replacement was not versioned');const digitTable=context.DIGIT_RELAY;vm.runInContext("'use strict'; DIGIT_RELAY={}",context);assert(context.DIGIT_RELAY===digitTable&&context.DIGIT_RELAY['8']===0o35,'read-only clock compatibility value was replaced');

load('agc-display-runtime.js');
const display=context.AGCDSKY_DISPLAY;assert(context.RELAY_DIGIT&&context.RELAY_DIGIT[21]==='0','base relay-digit table is not available to late schematic layer');
load('dsky-relay-matrix.js');
assert(context.DSKY_RELAY_MATRIX&&context.DSKY_RELAY_MATRIX.characterRelays===5,'actual relay matrix did not initialize');assert(display.compatibilityVersions().relayDigit>=1,'relay matrix did not replace the display-owned relayDigit slot');
state.mode='agc';state.tickSound=false;display.onChannel(0o10,(10<<11)|(3<<5)|25);assert(display.status().display.verb.join('')==='12','base decimal channel-010 decode changed after relay-matrix install');display.onChannel(0o11,0o6);assert(display.status().channels.ch011===0o6&&lamps.comp.classList.contains('on')&&lamps.uplink.classList.contains('on'),'channel-011 decode changed');display.onChannel(0o163,0o770);assert(lamps.temp.classList.contains('on')&&lamps.keyrel.classList.contains('on')&&lamps.oprerr.classList.contains('on'),'channel-0163 decode changed');
const ui=display.snapshotUi();display.resetFace();display.applySnapshotUi(ui);assert(display.status().display.verb.join('')==='12','display UI snapshot round-trip changed');
const physical=context.relayDigit(1);assert(physical&&physical!==' ','schematic matrix did not expose a non-decimal physical relay state');display.onChannel(0o10,(10<<11)|(1<<5)|1);assert(display.status().display.verb[0]===physical&&display.status().display.verb[1]===physical,'base decoder did not consume actual matrix relayDigit replacement');
const relayTable=context.RELAY_DIGIT;vm.runInContext("'use strict'; RELAY_DIGIT={}",context);assert(context.RELAY_DIGIT===relayTable&&context.RELAY_DIGIT[21]==='0','read-only display relay table was replaced');
const channelVersion=display.compatibilityVersions().ch10;vm.runInContext("'use strict'; decodeChannel10=function(value){channelReplacement=value}",context);display.onChannel(0o10,12345);assert(context.channelReplacement===12345,'strict channel-010 replacement did not dispatch through service');assert(display.compatibilityVersions().ch10===channelVersion+1,'channel-010 replacement was not versioned');state.mode='clock';context.channelReplacement=null;display.onChannel(0o10,77);assert(context.channelReplacement===null,'display mode gate was bypassed by replacement slot');

for(const required of ['renderDigits','playRelayBurst','stopClockQueue','tick','relayDigit','decodeChannel10'])assert(compat.describe().some(item=>item.name===required&&item.version>=1),`compatibility diagnostics missing ${required}`);
console.log('fidelity compatibility smoke: PASS');
console.log('  renderer/audio/clock/display service replacements and strict legacy assignments share the same versioned slots');
console.log('  clock queue/backing state stays service-owned; PHONE CLOCK rejects synthetic V35 while compatibility aliases remain synchronized');
console.log('  actual K1-K5 relay matrix initializes and replaces relayDigit without losing decimal decode');
console.log('  app/core state stays explicit and read-only compatibility values resist replacement');
