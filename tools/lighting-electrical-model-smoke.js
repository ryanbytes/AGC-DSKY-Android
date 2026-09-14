#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/lighting-electrical-model.js'),
  'utf8'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance=1e-5) {
  return Math.abs(actual - expected) <= tolerance;
}

let observerCallback = null;
let derivedWrites = 0;
const properties = new Map([['--integral-level','1']]);
const root = {
  style:{
    getPropertyValue(name){ return properties.get(name) || ''; },
    setProperty(name, value){
      const text = String(value);
      const prior = properties.get(name) || '';
      properties.set(name, text);
      if (name === '--integral-incandescent-level' && prior !== text) derivedWrites++;
      if (observerCallback && prior !== text) {
        observerCallback([{type:'attributes', attributeName:'style'}]);
      }
    }
  }
};
const elements = new Map();
const head = {
  appendChild(node){ if (node.id) elements.set(node.id, node); }
};
const document = {
  documentElement:root,
  head,
  getElementById(id){ return elements.get(id) || null; },
  createElement(tag){ return {tagName:String(tag).toUpperCase(), id:'', textContent:''}; }
};

class MutationObserver {
  constructor(callback){ this.callback = callback; }
  observe(target, options){
    assert(target === root, 'lighting observer must watch the root element');
    assert(options && options.attributes && options.attributeFilter.includes('style'),
      'lighting observer must be limited to root style changes');
    observerCallback = this.callback;
  }
}

const context = {
  console,
  Math,
  Number,
  Object,
  document,
  MutationObserver,
  getComputedStyle(){
    return {getPropertyValue(name){ return properties.get(name) || ''; }};
  },
  window:null
};
context.window = context;
context.AGCDSKY = {};

vm.createContext(context);
vm.runInContext(source, context, {filename:'lighting-electrical-model.js'});

const model = context.AGCDSKY.lightingElectrical;
assert(model, 'lighting electrical model did not publish diagnostics/API');
assert(near(model.incandescentFlux(1), 1), 'full-voltage incandescent output must normalize to 1');
assert(near(model.incandescentFlux(0), 0), 'open/zero-voltage incandescent output must be 0');
assert(near(model.incandescentFlux(0.5), Math.pow(0.5, 3.4)),
  'half-voltage incandescent response does not use V^3.4 estimate');
assert(near(model.incandescentFlux(0.75), Math.pow(0.75, 3.4)),
  'three-quarter-voltage incandescent response does not use V^3.4 estimate');

const style = elements.get('dsky-lighting-electrical-model');
assert(style && style.textContent.includes('--integral-incandescent-level'),
  'incandescent lamp override style was not installed');
assert(style.textContent.includes('var(--lamp-gain,1)'),
  'electrical dimmer override discarded per-bulb manufacturing gain');

// Changing the shared INTEGRAL control must leave the key/EL control variable
// intact and derive a separate nonlinear lamp flux variable.
root.style.setProperty('--integral-level', '0.75');
const state75 = model.state();
assert(near(state75.integralVoltageRatio, 0.75),
  'model did not observe shared INTEGRAL control voltage');
assert(near(state75.incandescentFluxRatio, Math.pow(0.75,3.4)),
  'incandescent branch was not derived from the INTEGRAL voltage');
assert(properties.get('--integral-level') === '0.75',
  'lighting model altered the key/EL INTEGRAL control');
assert(near(Number(properties.get('--integral-incandescent-level')), Math.pow(0.75,3.4), 1e-4),
  'derived incandescent CSS variable has the wrong value');

root.style.setProperty('--integral-level', '0.25');
const state25 = model.state();
assert(state25.incandescentFluxRatio < 0.02,
  'quarter-voltage incandescent branch is still behaving approximately linearly');
assert(state25.keyBranch.includes('115 VAC') && state25.keyBranch.includes('400 Hz'),
  'key EL electrical branch metadata is missing');
assert(state25.indicatorBranch.includes('0-5 VAC') && state25.indicatorBranch.includes('400 Hz'),
  'status/caution electrical branch metadata is missing');
assert(state25.curveSource.includes('estimate'),
  'estimated incandescent dimmer curve is not labeled as an estimate');

// The observer must settle rather than recursively rewriting its own derived
// root style variable forever. Four expected derived values are enough here:
// initial 1.0, 0.75, and 0.25 (with no duplicate self-trigger writes).
assert(derivedWrites === 3,
  `derived style wrote ${derivedWrites} times; expected 3 without observer recursion`);

console.log('lighting electrical model smoke: PASS');
console.log('  shared INTEGRAL control, separate 115-V EL / 5-V incandescent branches, and V^3.4 lamp response verified');
