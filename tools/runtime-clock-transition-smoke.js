#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/runtime-transitions.js'),'utf8');
function fail(m){console.error('RUNTIME CLOCK TRANSITION SMOKE FAIL: '+m);process.exit(1)}function assert(c,m){if(!c)fail(m)}
for(const marker of ['const lifecycle = api.lifecycle;','const baseEnterAgc = lifecycle.enterAgc;','const baseEnterClock = lifecycle.enterClock;','function enterAgc(reason','function enterClock(statusLabel','function coordinateClock(','publicApiDelegates:true','classicTransitionGlobals:false',"window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_RUNTIME',runtime"])assert(source.includes(marker),`missing marker ${marker}`);
for(const forbidden of ['baseApiEnterClock','sharedApiEnterClock','sharedEnterAgc','sharedEnterClock','window.enterAgc','window.enterClock','api.enterClock =','api.enterAgc ='])assert(!source.includes(forbidden),`obsolete transition ownership remains: ${forbidden}`);

function installFacade(context,api,lifecycle,label='API LABEL'){
  Object.defineProperty(api,'runtimeTransitions',{enumerable:true,configurable:true,get:()=>context.AGCDSKY_RUNTIME||null});
  api.enterAgc=function(){
    const r=context.AGCDSKY_RUNTIME;
    return r&&r.enterAgc?r.enterAgc('public AGCDSKY.enterAgc'):lifecycle.enterAgc();
  };
  api.enterClock=function(){
    const r=context.AGCDSKY_RUNTIME;
    return r&&r.enterClock?r.enterClock(label,true,'public AGCDSKY.enterClock'):lifecycle.enterClock(label,true);
  };
}

async function main(){
  let mode='agc';const calls=[];
  const lifecycle={
    enterAgc(){mode='agc';return Promise.resolve({mode})},
    enterClock(status='DEFAULT',preserve=false){calls.push(['base',status,preserve,mode]);mode='clock';return'clock-result'}
  };
  const api={lifecycle,appStatus(){return{mode}},getCore(){return{} }};
  const context={AGCDSKY:api,console,window:null};context.window=context;installServiceRegistry(context);vm.createContext(context);installFacade(context,api,lifecycle);
  const oldApiAgc=api.enterAgc,oldApiClock=api.enterClock;
  vm.runInContext(source,context,{filename:'runtime-transitions.js'});
  assert(api.enterAgc===oldApiAgc&&api.enterClock===oldApiClock,'public API methods were replaced');
  assert(context.enterAgc===undefined&&context.enterClock===undefined,'classic transition globals were published');
  let snap=api.runtimeTransitions.snapshot();assert(snap.publicApiDelegates===true&&snap.classicTransitionGlobals===false,'runtime ownership snapshot changed');
  let hooks=0;api.runtimeTransitions.onBeforeClock(()=>hooks++);
  let result=api.enterClock();assert(result==='clock-result','API CLOCK result changed');assert(hooks===1,'API CLOCK cleanup did not run once');assert(calls[0][1]==='API LABEL'&&calls[0][2]===true,'API preserveAgc semantics changed');
  mode='agc';result=api.runtimeTransitions.enterClock('DIRECT',false,'direct runtime test');assert(result==='clock-result','direct runtime CLOCK result changed');assert(hooks===2&&calls[1][1]==='DIRECT'&&calls[1][2]===false,'direct runtime CLOCK args/cleanup changed');

  let loadingMode='clock',release;const loadingCalls=[];
  const loadingLifecycle={
    async enterAgc(){loadingMode='agc-loading';loadingCalls.push('agc-start');await new Promise(r=>release=r);loadingMode='agc';loadingCalls.push('agc-ready')},
    enterClock(s,p){loadingCalls.push(['clock',loadingMode,s,p]);loadingMode='clock';return'done'}
  };
  const loadingApi={lifecycle:loadingLifecycle,appStatus(){return{mode:loadingMode}},getCore(){return{} }};
  const loading={AGCDSKY:loadingApi,console,window:null};loading.window=loading;installServiceRegistry(loading);vm.createContext(loading);installFacade(loading,loadingApi,loadingLifecycle,'API DEFERRED');vm.runInContext(source,loading);
  const agcPromise=loadingApi.enterAgc();await Promise.resolve();assert(loadingMode==='agc-loading','load did not start');const clockPromise=loadingApi.enterClock();assert(clockPromise&&typeof clockPromise.then==='function','CLOCK during load was not deferred');assert(!loadingCalls.some(x=>Array.isArray(x)&&x[0]==='clock'),'base CLOCK ran before load settled');release();await agcPromise;assert(await clockPromise==='done'&&loadingMode==='clock','deferred CLOCK did not win');const clockCall=loadingCalls.find(x=>Array.isArray(x)&&x[0]==='clock');assert(clockCall&&clockCall[1]==='agc'&&clockCall[2]==='API DEFERRED'&&clockCall[3]===true,'deferred CLOCK args/execution state changed');
  assert(loading.enterAgc===undefined&&loading.enterClock===undefined,'deferred harness gained classic transition globals');

  console.log('runtime CLOCK transition smoke: PASS');
  console.log('  stable API methods, lifecycle-backed bootstrap compatibility getter, explicit service publication, cleanup hooks, direct runtime semantics, no classic transition globals, and AGC-load serialization verified');
}
main().catch(e=>fail(e&&e.stack?e.stack:String(e)));
