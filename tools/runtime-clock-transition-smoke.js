#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/runtime-transitions.js'),'utf8');
function fail(m){console.error('RUNTIME CLOCK TRANSITION SMOKE FAIL: '+m);process.exit(1)}function assert(c,m){if(!c)fail(m)}
for(const marker of ['const baseEnterAgc = typeof window.enterAgc','const baseEnterClock = typeof window.enterClock','function enterAgc(reason','function enterClock(statusLabel','function coordinateClock(','function sharedEnterClock(...args)','window.enterClock = sharedEnterClock','publicApiDelegates:true'])assert(source.includes(marker),`missing marker ${marker}`);
for(const forbidden of ['baseApiEnterClock','sharedApiEnterClock','api.enterClock =','api.enterAgc ='])assert(!source.includes(forbidden),`public API is still monkey-patched: ${forbidden}`);

function installFacade(context,api,label='API LABEL'){
  vm.runInContext(`
    AGCDSKY.enterAgc = function(){
      const r=window.AGCDSKY_RUNTIME;
      return r&&r.enterAgc ? r.enterAgc('public AGCDSKY.enterAgc') : enterAgc();
    };
    AGCDSKY.enterClock = function(){
      const r=window.AGCDSKY_RUNTIME;
      return r&&r.enterClock ? r.enterClock('${label}',true,'public AGCDSKY.enterClock') : enterClock('${label}',true);
    };
  `,context);
}

async function main(){
  let mode='agc';const calls=[];
  const api={appStatus(){return{mode}},getCore(){return{} }};
  const context={AGCDSKY:api,console,window:null,__clock(status='DEFAULT',preserve=false){calls.push(['base',status,preserve,mode]);mode='clock';return'clock-result'}};context.window=context;vm.createContext(context);
  vm.runInContext(`function enterAgc(){mode='agc'}; function enterClock(status='DEFAULT',preserve=false){return __clock(status,preserve)}`,context);
  // expose closure mode to script fixture functions
  context.mode='agc';Object.defineProperty(context,'__mode',{get(){return mode},set(v){mode=v}});
  vm.runInContext(`enterAgc=function(){__mode='agc'}; enterClock=function(status='DEFAULT',preserve=false){return __clock(status,preserve)}`,context);
  installFacade(context,api);
  const oldApiAgc=api.enterAgc,oldApiClock=api.enterClock,oldGlobalClock=context.enterClock;
  vm.runInContext(source,context,{filename:'runtime-transitions.js'});
  assert(api.enterAgc===oldApiAgc&&api.enterClock===oldApiClock,'public API methods were replaced');
  assert(context.enterClock!==oldGlobalClock,'global compatibility CLOCK entry was not wrapped');
  assert(api.runtimeTransitions.snapshot().publicApiDelegates===true,'runtime did not report stable API delegation');
  let hooks=0;api.runtimeTransitions.onBeforeClock(()=>hooks++);
  let result=api.enterClock();assert(result==='clock-result','API CLOCK result changed');assert(hooks===1,'API CLOCK cleanup did not run once');assert(calls[0][1]==='API LABEL'&&calls[0][2]===true,'API preserveAgc semantics changed');
  mode='agc';context.__mode='agc';result=context.enterClock('DIRECT',false);assert(result==='clock-result','global CLOCK result changed');assert(hooks===2&&calls[1][1]==='DIRECT'&&calls[1][2]===false,'global CLOCK args/cleanup changed');

  // Deferred CLOCK must still wait for an owned AGC load and then win.
  let loadingMode='clock',release;const loadingCalls=[];
  const loadingApi={appStatus(){return{mode:loadingMode}},getCore(){return{} }};
  const loading={AGCDSKY:loadingApi,console,window:null,__baseAgc:async()=>{loadingMode='agc-loading';loadingCalls.push('agc-start');await new Promise(r=>release=r);loadingMode='agc';loadingCalls.push('agc-ready')},__baseClock:(s,p)=>{loadingCalls.push(['clock',loadingMode,s,p]);loadingMode='clock';return'done'}};loading.window=loading;vm.createContext(loading);
  vm.runInContext(`async function enterAgc(){return __baseAgc()}; function enterClock(s='D',p=false){return __baseClock(s,p)}`,loading);installFacade(loading,loadingApi,'API DEFERRED');vm.runInContext(source,loading);
  const agcPromise=loadingApi.enterAgc();await Promise.resolve();assert(loadingMode==='agc-loading','load did not start');const clockPromise=loadingApi.enterClock();assert(clockPromise&&typeof clockPromise.then==='function','CLOCK during load was not deferred');assert(!loadingCalls.some(x=>Array.isArray(x)&&x[0]==='clock'),'base CLOCK ran before load settled');release();await agcPromise;assert(await clockPromise==='done'&&loadingMode==='clock','deferred CLOCK did not win');const clockCall=loadingCalls.find(x=>Array.isArray(x)&&x[0]==='clock');assert(clockCall&&clockCall[1]==='agc'&&clockCall[2]==='API DEFERRED'&&clockCall[3]===true,'deferred CLOCK args/execution state changed');

  console.log('runtime CLOCK transition smoke: PASS');
  console.log('  stable API methods, dynamic runtime delegation, cleanup hooks, direct/global semantics, and AGC-load serialization verified');
}
main().catch(e=>fail(e&&e.stack?e.stack:String(e)));
