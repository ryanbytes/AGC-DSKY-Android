#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/lighting-rheostat-stop.js'), 'utf8'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const LEVELS = [1.00, 0.75, 0.50, 0.25, 0.00];
let ni = 4; // simulate old persisted OFF index
let ii = 4;
const listeners = {};
const calls = [];
const lighting = {
  levels(){ return {numerics:LEVELS[ni], integral:LEVELS[ii], numericsIndex:ni, integralIndex:ii}; },
  cycleNumerics(){ ni=(ni+1)%LEVELS.length; calls.push(['n',ni]); },
  cycleIntegral(){ ii=(ii+1)%LEVELS.length; calls.push(['i',ii]); },
  demo(){ calls.push(['demo']); }
};

const context = {
  console,
  window:null,
  AGCDSKY:{lighting},
  showControls(){ calls.push(['controls']); },
  addEventListener(type, fn){ (listeners[type] ||= []).push(fn); }
};
context.window=context;
vm.createContext(context);
vm.runInContext(source, context, {filename:'lighting-rheostat-stop.js'});

assert(ni===0 && ii===0, 'persisted 0% levels were not normalized to a legal rheostat position');
assert(context.AGCDSKY.lightingRheostatStop.minimumNormalUiLevel===0.25,
  'mechanical-stop metadata lost the lowest discrete UI level');
assert(context.AGCDSKY.lightingRheostatStop.zeroReservedFor.includes('feed-open'),
  'zero must remain documented as feed-open/demo only');

function click(id){
  const event={
    target:{closest(selector){ return selector==='#numerics-light,#integral-light'?{id}:null; }},
    preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}
  };
  for(const fn of listeners.click||[]) fn(event);
}

const seenN=[];
for(let x=0;x<8;x++){ click('numerics-light'); seenN.push(lighting.levels().numerics); }
assert(seenN.every(v=>v>0), `normal NUMERICS clicks reached OFF: ${seenN.join(',')}`);
assert(seenN.slice(0,4).join(',')==='0.75,0.5,0.25,1',
  `NUMERICS mechanical-stop cycle wrong: ${seenN.slice(0,4).join(',')}`);

const seenI=[];
for(let x=0;x<8;x++){ click('integral-light'); seenI.push(lighting.levels().integral); }
assert(seenI.every(v=>v>0), `normal INTEGRAL clicks reached OFF: ${seenI.join(',')}`);
assert(seenI.slice(0,4).join(',')==='0.75,0.5,0.25,1',
  `INTEGRAL mechanical-stop cycle wrong: ${seenI.slice(0,4).join(',')}`);

// This layer must not remove/replace the underlying demo API, which is the
// legitimate path that may temporarily open a feed and produce zero light.
assert(typeof lighting.demo==='function', 'lighting bus demo API was removed');
lighting.demo();
assert(calls.some(c=>c[0]==='demo'), 'feed-open demo API no longer callable');

console.log('lighting rheostat stop smoke: PASS');
console.log('  normal cycle excludes OFF; legacy OFF normalizes; feed-open demo remains available');
