#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/lighting-rheostat-stop.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const LEVELS=[1,.75,.5,.25,0];let ni=4,ii=4;const listeners={},calls=[];
const lighting={levels(){return{numerics:LEVELS[ni],integral:LEVELS[ii],numericsIndex:ni,integralIndex:ii}},cycleNumerics(){ni=(ni+1)%LEVELS.length;calls.push(['n',ni])},cycleIntegral(){ii=(ii+1)%LEVELS.length;calls.push(['i',ii])},demo(){calls.push(['demo'])}};
const AGCDSKY={lighting};
const context={console,AGCDSKY,showControls(){calls.push(['controls'])},addEventListener(type,fn){(listeners[type]||=[]).push(fn)},window:null};context.window=context;installServiceRegistry(context);
Object.defineProperty(AGCDSKY,'lightingRheostatStop',{enumerable:true,get(){return context.AGCDSKY_LIGHTING_RHEOSTAT_STOP||null}});
vm.createContext(context);vm.runInContext(source,context,{filename:'lighting-rheostat-stop.js'});
const stop=AGCDSKY.lightingRheostatStop;
assert(stop&&stop===context.AGCDSKY_LIGHTING_RHEOSTAT_STOP,'bootstrap rheostat getter did not resolve dedicated service');
assert(Object.isFrozen(stop),'rheostat stop service must be frozen');
assert(source.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_LIGHTING_RHEOSTAT_STOP',Object.freeze({"),'rheostat stop explicit registry publication missing');
assert(!source.includes('window.AGCDSKY.lightingRheostatStop ='),'rheostat stop regained late public-facade mutation');
assert(ni===0&&ii===0,'persisted 0% levels were not normalized');
assert(stop.minimumNormalUiLevel===.25,'mechanical-stop metadata lost lowest UI level');
assert(stop.zeroReservedFor.includes('feed-open'),'zero must remain feed-open/demo only');
function click(id){const event={target:{closest(selector){return selector==='#numerics-light,#integral-light'?{id}:null}},preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};for(const fn of listeners.click||[])fn(event)}
const seenN=[];for(let x=0;x<8;x++){click('numerics-light');seenN.push(lighting.levels().numerics)}assert(seenN.every(v=>v>0),`NUMERICS reached OFF: ${seenN.join(',')}`);assert(seenN.slice(0,4).join(',')==='0.75,0.5,0.25,1',`NUMERICS cycle wrong: ${seenN.slice(0,4).join(',')}`);
const seenI=[];for(let x=0;x<8;x++){click('integral-light');seenI.push(lighting.levels().integral)}assert(seenI.every(v=>v>0),`INTEGRAL reached OFF: ${seenI.join(',')}`);assert(seenI.slice(0,4).join(',')==='0.75,0.5,0.25,1',`INTEGRAL cycle wrong: ${seenI.slice(0,4).join(',')}`);
assert(typeof lighting.demo==='function','lighting bus demo API removed');lighting.demo();assert(calls.some(c=>c[0]==='demo'),'feed-open demo no longer callable');
console.log('lighting rheostat stop smoke: PASS');
console.log('  explicit registry publication, dedicated frozen service, bootstrap getter, normal cycle excluding OFF, legacy normalization, and feed-open demo verified');
