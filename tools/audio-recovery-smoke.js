#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const guardSource=read('background-audio-guard.js'),audioSource=read('relay-audio-runtime.js'),shellSource=read('app-shell-runtime.js'),pageResourceLifecycleSource=read('page-resource-lifecycle.js'),debugReporterSource=fs.readFileSync(path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/DebugReporter.java'),'utf8');
function makeHarness({dream=false,hidden=false}={}){
  const reports=[],instances=[],scheduled=new Map();let timerId=0;
  class FakeAudioContext{
    static nextState='running';static nextResumeError=null;
    constructor(){this.state=FakeAudioContext.nextState;this.resumeError=FakeAudioContext.nextResumeError;FakeAudioContext.nextState='running';FakeAudioContext.nextResumeError=null;this.currentTime=1;this.listeners=new Map();this.closeCount=0;instances.push(this)}
    addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn)}
    dispatch(type,event={}){for(const fn of this.listeners.get(type)||[])fn(event)}
    resume(){if(this.resumeError)return Promise.reject(this.resumeError);this.state='running';this.dispatch('statechange');return Promise.resolve()}
    close(){this.closeCount++;this.state='closed';this.dispatch('statechange');return Promise.resolve()}
  }
  const soundButton={textContent:'RELAY CLICKS ON'},storage=new Map();
  const shell={store:{get:k=>storage.get(k)||null,set(k,v){storage.set(k,String(v));return true}},element:id=>id==='sound'?soundButton:null};
  const environment={tickLevel:()=>1};
  const clock={stopQueue(){}};
  const context={console,window:null,globalThis:null,document:{hidden,getElementById:id=>id==='sound'?soundButton:null,addEventListener(){}},AGCDSKY_SHELL:shell,AGCDSKY_ENVIRONMENT:environment,AGCDSKY_CLOCK:clock,AudioContext:FakeAudioContext,webkitAudioContext:undefined,DebugBridge:{report(detail){reports.push(String(detail))}},Promise,WeakSet,Map,Object,Number,String,Math,Error,TypeError,setTimeout(fn){const id=++timerId;scheduled.set(id,fn);return id},clearTimeout(id){scheduled.delete(id)}};
  context.window=context;context.globalThis=context;installServiceRegistry(context);vm.createContext(context);
  for(const name of ['app-state-runtime.js','relay-audio-runtime.js'])new vm.Script(read(name),{filename:name}).runInContext(context);
  const state=context.AGCDSKY_APP_STATE;state.dream=dream;state.tickSound=true;state.appVisible=!hidden;
  new vm.Script(guardSource,{filename:'background-audio-guard.js'}).runInContext(context);
  return{context,state,audio:context.AGCDSKY_AUDIO,recovery:context.AGCDSKY_AUDIO_RECOVERY,FakeAudioContext,instances,reports,soundButton,scheduled};
}
async function flush(){await Promise.resolve();await Promise.resolve()}
(async()=>{
  assert(audioSource.includes('installImplementation'),'audio runtime must own replaceable implementation installation');
  assert(audioSource.includes('implementation(name)'),'audio runtime must expose implementation lookup for wrapper chaining');
  assert(audioSource.includes('setContext'),'audio runtime must own context replacement');
  assert(audioSource.includes('function createOwnedSlot(name,initial,validate=null)'),'audio implementation slot owner missing');
  assert(audioSource.includes('function createContextSlot()'),'audio context slot owner missing');
  assert(audioSource.includes("compat.alias('audioCtx'")&&audioSource.includes('compat.alias(name,slot.get'),'audio compatibility globals must forward to audio-owned slots');
  for(const token of ["compat.accessor('audioCtx'","compat.mutable('ensureAudio'","compat.mutable('emitTick'","compat.mutable('playRelayBurst'","compat.mutable('applyTickSound'"])assert(!audioSource.includes(token),`compatibility registry still owns audio live state: ${token}`);
  assert(guardSource.includes("audio.installImplementation('ensure'"),'audio guard must install resilient ensure through audio service');
  assert(guardSource.includes("audio.installImplementation('applySetting'"),'audio guard must install resilient setting through audio service');
  assert(guardSource.includes("audio.installImplementation('emitTick'"),'audio guard must install tick visibility gate through audio service');
  assert(guardSource.includes("audio.installImplementation('playBurst'"),'audio guard must install burst visibility gate through audio service');
  assert(guardSource.includes("audio.setContext(value,'audio recovery context')"),'audio recovery must replace context through audio service');
  assert(guardSource.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_AUDIO_RECOVERY'"),'audio recovery must publish explicitly through the service registry');
  assert(!guardSource.includes('AGCDSKY_COMPAT')&&!guardSource.includes('compat.'),'audio recovery must not depend directly on compatibility registry');
  assert(guardSource.includes("ctx.addEventListener('error'"),'audio guard must listen for renderer errors');
  assert(guardSource.includes('AUDIO_FAILURE_LIMIT=2'),'audio guard failure limit changed');
  assert(guardSource.includes("ctx.state!=='running'&&typeof ctx.resume==='function'"),'audio guard must resume any recoverable non-running WebAudio state');
  assert(shellSource.includes("const audio=services&&services.audio;"),'app shell must bind the audio service before defining relay audio helper');
  assert(shellSource.indexOf("function requestRelayAudioStart(playConfirmation=false)")>shellSource.indexOf("const audio=services&&services.audio;"),'relay audio helper must live inside initializeAppShell after the audio binding');
  assert(shellSource.includes("shellState.tickSound=!shellState.tickSound;audio.applySetting();if(shellState.tickSound)requestRelayAudioStart(true)"),'sound toggle must enable state before acquiring/resuming relay audio');
  assert(shellSource.includes("document.addEventListener('pointerdown',()=>{if(shellState.tickSound)requestRelayAudioStart(false)"),'user gesture must explicitly unlock relay audio');
  assert(!shellSource.includes("function requestRelayAudioStart(audio,playConfirmation=false)"),'relay audio helper should not depend on an outer service parameter');
  assert(!guardSource.includes('applySnapshotUi =')&&!guardSource.includes('renderAgcReg ='),'audio recovery guard must not own display/snapshot projection');
  assert(pageResourceLifecycleSource.includes("if (context.state === 'closed') audioContexts.delete(context);"),'lifecycle tracker must release closed AudioContexts');
  const chromiumMessage='The AudioContext encountered an error from the audio device or the WebAudio renderer.';assert(debugReporterSource.includes(chromiumMessage)&&debugReporterSource.includes('isRecoverableWebAudioRenderError(detail)'),'native reporter must recognize/filter recoverable Chromium WebAudio renderer errors');

  const h=makeHarness(),first=h.audio.ensure();assert(first===h.instances[0],'first ensure must create first context');
  first.dispatch('error',{error:new Error('renderer failed')});assert(first.closeCount===1,'renderer failure must retire context');assert(h.recovery.status().state==='none'&&h.recovery.status().failures===1&&!h.recovery.status().circuitOpen,'first failure recovery state changed');
  const replacement=h.audio.ensure();assert(replacement&&replacement!==first&&h.instances.length===2,'next audible event must create one fresh context');const stableTimers=h.scheduled.size;h.audio.ensure();h.audio.ensure();assert(h.scheduled.size===stableTimers,'ordinary relay activity must not restart stability timer');
  replacement.dispatch('error',{error:new Error('replacement failed')});assert(h.recovery.status().circuitOpen,'second consecutive failure must open circuit');assert(h.reports.length===1&&/WebAudio recovery failed/.test(h.reports[0]),'repeated failure must create one local debug report');assert(/OFF\/ON TO RETRY/.test(h.soundButton.textContent),'sound button must explain manual retry');const count=h.instances.length;assert(h.audio.ensure()===null&&h.instances.length===count,'circuit breaker must block automatic retries');
  h.state.tickSound=false;h.audio.applySetting();h.state.tickSound=true;h.audio.applySetting();assert(!h.recovery.status().circuitOpen,'sound OFF/ON must reset recovery circuit');assert(h.audio.ensure()&&h.instances.length===3,'manual retry must permit fresh context');
  const closed=h.audio.context();closed.state='closed';const afterClosed=h.audio.ensure();assert(afterClosed&&afterClosed!==closed&&h.instances.length===4,'closed context must be replaced exactly once');assert(h.recovery.status().failures===0,'ordinary closed-context replacement is not renderer failure');

  const r=makeHarness();r.FakeAudioContext.nextState='suspended';r.FakeAudioContext.nextResumeError=new Error('device unavailable');assert(r.audio.ensure(),'suspended context should exist while resume settles');await flush();assert(r.recovery.status().state==='none'&&r.recovery.status().failures===1,'resume rejection must retire/count failed context');
  const p=makeHarness();p.FakeAudioContext.nextState='suspended';const policy=new Error('gesture required');policy.name='NotAllowedError';p.FakeAudioContext.nextResumeError=policy;const policyCtx=p.audio.ensure();await flush();assert(p.recovery.status().state==='suspended'&&p.recovery.status().failures===0&&policyCtx.closeCount===0,'NotAllowedError must retain suspended context without failure count');
  const interrupted=makeHarness();interrupted.FakeAudioContext.nextState='interrupted';const interruptedCtx=interrupted.audio.ensure();await flush();assert(interruptedCtx&&interrupted.recovery.status().state==='running','interrupted WebAudio context must be resumed');
  const dream=makeHarness({dream:true});assert(dream.audio.ensure()===null&&dream.instances.length===0,'Dream mode must remain silent');
  const hidden=makeHarness({hidden:true});assert(hidden.audio.ensure()===null&&hidden.instances.length===0,'hidden app must not create/resume relay audio');
  console.log('audio recovery smoke: PASS');console.log('  audio-owned context/implementation slots, forwarded compatibility aliases, explicit recovery publication, circuit breaker, closed-context replacement, policy rejection, and Dream/hidden silence verified');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
