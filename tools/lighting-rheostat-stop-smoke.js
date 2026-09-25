#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/lighting-rheostat-stop.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

let numerics=1,integral=.6;
const calls=[];
const lighting={
  levels(){return{numerics,integral}},
  setNumerics(v){numerics=v;calls.push(['n',v])},
  setIntegral(v){integral=v;calls.push(['i',v])}
};
const AGCDSKY={lighting};
const context={console,AGCDSKY,window:null};context.window=context;installServiceRegistry(context);
Object.defineProperty(AGCDSKY,'lightingRheostatStop',{enumerable:true,get(){return context.AGCDSKY_LIGHTING_RHEOSTAT_STOP||null}});
vm.createContext(context);vm.runInContext(source,context,{filename:'lighting-rheostat-stop.js'});

const stop=AGCDSKY.lightingRheostatStop;
assert(stop&&stop===context.AGCDSKY_LIGHTING_RHEOSTAT_STOP,'bootstrap rheostat getter did not resolve dedicated service');
assert(Object.isFrozen(stop),'rheostat stop service must be frozen');
assert(source.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_LIGHTING_RHEOSTAT_STOP',Object.freeze({"),'rheostat stop explicit registry publication missing');
assert(!source.includes('window.AGCDSKY.lightingRheostatStop ='),'rheostat stop regained late public-facade mutation');
assert(stop.minimumNormalUiLevel===.25,'minimum mechanical UI stop changed');
assert(stop.maximumNormalUiLevel===1,'maximum rheostat UI level changed');
assert(stop.continuousUiInterpolation===true,'continuous interpolation metadata missing');
assert(stop.clamp(-1)===.25&&stop.clamp(0)===.25&&stop.clamp(.437)===.437&&stop.clamp(2)===1,'continuous clamp behavior wrong');
assert(stop.completeOffMethod.includes('circuit breaker'),'complete-off method metadata lost');
assert(!source.includes('click')&&!source.includes('cycleWithMechanicalStop'),'old click/cycle interception remains');

// Invalid legacy-like live state is normalized away from OFF.
numerics=0;integral=0;
vm.runInContext("window.__DSKY_LIGHTING_RHEOSTAT_STOP__=false",context);
vm.runInContext(source,context,{filename:'lighting-rheostat-stop.js'});
assert(numerics===1&&integral===1,'zero lighting state was not normalized to full bright');
assert(calls.some(c=>c[0]==='n'&&c[1]===1)&&calls.some(c=>c[0]==='i'&&c[1]===1),'normalization did not use lighting setters');

console.log('lighting rheostat stop smoke: PASS');
console.log('  continuous 25-100% app interpolation, mechanical minimum stop, no OFF position, and legacy zero normalization verified');
