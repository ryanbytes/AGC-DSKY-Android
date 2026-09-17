#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),source=fs.readFileSync(path.join(ASSETS,'dream-agc.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function hasBareCall(text,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(^|[^.$\\w])${escaped}\\s*\\(`,'m').test(text)}
for(const marker of [
  'const dreamShell = window.AGCDSKY_SHELL;',
  'const dreamClock = window.AGCDSKY_CLOCK;',
  'const dreamDisplay = window.AGCDSKY_DISPLAY;',
  'const DreamAgcCore = window.AgcCore;',
  "dreamDisplay.implementation('decodeChannel10')(value)",
  "dreamDisplay.implementation('decodeChannel11')(value)",
  "dreamDisplay.implementation('decodeChannel13')(value)",
  "dreamDisplay.implementation('decodeChannel163')(value)",
  "dreamShell.store.get('agcSnapshotV1')",
  'dreamDisplay.applySnapshotUi(payload.ui)',
  'dreamClock.cancelLampTest()',
  'dreamClock.stopQueue()',
  'dreamDisplay.resetFace()',
  'dreamShell.missionSpec()',
  "dreamShell.element('mode')",
  'dreamDisplay.renderSnapshot()',
  'new DreamAgcCore({',
  "window.addEventListener('pagehide'"
])assert(source.includes(marker),`Dream AGC explicit service marker missing: ${marker}`);
for(const name of ['decodeChannel10','decodeChannel11','decodeChannel13','decodeChannel163','applySnapshotUi','cancelLampTest','stopClockQueue','resetAgcFace','missionSpec','renderAgcSnapshot'])assert(!hasBareCall(source,name),`Dream AGC retained ambient call: ${name}()`);
assert(!source.includes('localStorage.'),'Dream AGC retained direct localStorage access');
assert(!/new\s+AgcCore\s*\(/.test(source),'Dream AGC retained ambient AgcCore constructor');
assert(!source.includes('AGCDSKY_COMPAT')&&!source.includes('compat.'),'Dream AGC depends on compatibility registry');

function makeEnv(search){
  const calls={clockCancel:0,clockStop:0,reset:0,apply:0,render:0,imports:[],starts:[],stops:0,loads:[],channels:[],storeGets:[],debug:[]};
  const status={textContent:''},documentListeners={},windowListeners={};
  const payload={schema:1,mission:'comanche055',ui:{relayWords:{10:123},ch11:2,ch13:3,ch163:4},core:{memoryB64:'snapshot'}};
  const state=Object.seal({mode:'clock',selectedMission:'comanche055'}),session=Object.seal({core:null,loadedMission:'',suspendedForClock:false,pausedForVisibility:false});
  class FakeCore{
    constructor(options){this.options=options;this.running=false;calls.core=this}
    async load(options){calls.loads.push({...options})}
    importSnapshot(value){calls.imports.push(value);return true}
    version(){return'dream-test-core'}
    start(rate){this.running=true;calls.starts.push(rate)}
    stop(){this.running=false;calls.stops++}
  }
  const shell={
    store:{get(key){calls.storeGets.push(key);return key==='agcSnapshotV1'?JSON.stringify(payload):null}},
    element:id=>id==='mode'?status:null,
    missionSpec:()=>({label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'})
  };
  const clock={cancelLampTest(){calls.clockCancel++},stopQueue(){calls.clockStop++}};
  const decoders=Object.fromEntries(['decodeChannel10','decodeChannel11','decodeChannel13','decodeChannel163'].map(name=>[name,value=>{calls.channels.push({name,value});return true}]));
  const display={
    implementation(name){if(!decoders[name])throw new Error(`unknown Dream decoder ${name}`);return decoders[name]},
    applySnapshotUi(ui){calls.apply++;calls.appliedUi=ui;return true},
    resetFace(){calls.reset++},
    renderSnapshot(){calls.render++}
  };
  const document={hidden:false,addEventListener(name,fn){documentListeners[name]=fn}};
  const context={console,window:null,URLSearchParams,location:{search},document,AGCDSKY_APP_STATE:state,AGCDSKY_CORE_SESSION:session,AGCDSKY_SHELL:shell,AGCDSKY_CLOCK:clock,AGCDSKY_DISPLAY:display,AgcCore:FakeCore,addEventListener(name,fn){windowListeners[name]=fn}};
  context.window=context;context.location=context.location;context.DebugBridge={ready:value=>calls.debug.push(value)};
  vm.createContext(context);new vm.Script(source,{filename:'dream-agc.js'}).runInContext(context);
  return{context,calls,state,session,status,document,documentListeners,windowListeners,payload};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve()}
(async()=>{
  const active=makeEnv('?dream=1&agc=1');await flush();
  const {calls,state,session,status,document,documentListeners,windowListeners,payload}=active,core=session.core;
  assert(core&&core===calls.core,'Dream AGC did not construct its page-owned core');
  assert(calls.clockCancel===1&&calls.clockStop===1&&calls.reset===1,'Dream AGC startup did not route clock/display reset through services');
  assert(calls.loads.length===1&&calls.loads[0].wasmUrl==='yaAGC.wasm'&&calls.loads[0].ropeUrl==='Comanche055.bin','Dream AGC assets changed');
  assert(session.loadedMission==='comanche055'&&state.mode==='dream-agc','Dream AGC mission/mode did not settle');
  assert(calls.storeGets.length===1&&calls.storeGets[0]==='agcSnapshotV1','Dream snapshot clone bypassed shell storage service');
  assert(calls.imports.length===1&&calls.imports[0].memoryB64==='snapshot','Dream snapshot core clone changed');
  assert(calls.apply===1&&calls.appliedUi.relayWords[10]===123&&calls.render===1,'Dream snapshot UI clone/render changed');
  assert(core.running&&calls.starts.length===1&&calls.starts[0]===1,'visible Dream AGC core did not start');
  assert(status.textContent.includes('COMANCHE055 · DREAM · dream-test-core · STATE CLONED'),'Dream status label changed');
  for(const [channel,name] of [[0o10,'decodeChannel10'],[0o11,'decodeChannel11'],[0o13,'decodeChannel13'],[0o163,'decodeChannel163']])core.options.onChannelUpdate(channel,channel+1);
  assert(calls.channels.length===4&&calls.channels.every((item,index)=>item.name===['decodeChannel10','decodeChannel11','decodeChannel13','decodeChannel163'][index]),'Dream channel route bypassed display implementation slots');
  assert(typeof documentListeners.visibilitychange==='function'&&typeof windowListeners.pagehide==='function','Dream lifecycle listeners missing');
  document.hidden=true;documentListeners.visibilitychange();assert(!core.running&&calls.stops===1,'hidden Dream AGC did not stop');
  document.hidden=false;documentListeners.visibilitychange();assert(core.running&&calls.starts.length===2,'visible Dream AGC did not resume');
  windowListeners.pagehide();assert(!core.running&&calls.stops===2,'Dream pagehide did not stop core');

  const inert=makeEnv('?dream=1&clock=1&display=1');await flush();
  assert(inert.session.core===null&&inert.state.mode==='clock','clock DreamService URL started Dream AGC');
  assert(inert.calls.clockCancel===0&&inert.calls.clockStop===0&&inert.calls.reset===0&&inert.calls.storeGets.length===0,'inert Dream AGC gate touched services');
  console.log('Dream AGC runtime smoke: PASS');
  console.log('  explicit shell/clock/display/core ownership, read-only snapshot clone, dynamic channel implementations, lifecycle pause/resume, and clock-Dream isolation verified');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});