#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const cm = fs.readFileSync(path.join(root, 'app/src/main/assets/cm-mode.js'), 'utf8');

function fail(message) {
  console.error('CM FEATURE LOAD FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

const features = [
  'flight-hardware-ui',
  'lighting-rheostat-stop',
  'key-mechanical-spec',
  'keyboard-electrical-interlock',
  'lighting-electrical-model',
  'relay-perceptual-personality'
];

let priorIndex = -1;
for (const feature of features) {
  const tag = `<script src="${feature}.js" data-feature="${feature}"></script>`;
  const index = html.indexOf(tag);
  if (index < 0) fail(`index.html is missing deterministic ${feature} script tag`);
  if (index <= priorIndex) fail(`${feature}.js is out of CM dependency order`);
  priorIndex = index;

  if (cm.includes(`script.src = '${feature}.js'`)) {
    fail(`cm-mode.js still contains dead dynamic fallback loading for ${feature}`);
  }
}

const dreamIndex = html.indexOf('<script src="dream-agc.js"></script>');
if (dreamIndex < 0 || priorIndex >= dreamIndex) {
  fail('CM hardware layers must all initialize before dream-agc.js readiness marker');
}

const relayShowIndex = html.indexOf('<script src="relay-show.js"');
if (relayShowIndex >= 0) fail('relay-show.js should remain dynamically paired with its injected control button');
if (!cm.includes("script.src = 'relay-show.js'")) fail('cm-mode.js lost dynamic Relay Show installation');

const keyboardIndex = html.indexOf('data-feature="keyboard-electrical-interlock"');
const closingBody = html.indexOf('</body>');
if (keyboardIndex < 0 || keyboardIndex >= closingBody) {
  fail('keyboard electrical interlock is not parser-loaded before the page completes');
}

// Execute cm-mode.js against a minimal DOM. Parser-loaded CM features need no
// runtime discovery or fallback injection; Relay Show is the sole dynamic
// script because its button/script pair is intentionally created together.
const loadHandlers = [];
const appendedScripts = [];
const insertedButtons = [];
const classes = new Set();
const storage = new Map();
const controls = {
  insertBefore(node){ insertedButtons.push(node); node.parentNode = controls; },
  appendChild(node){ insertedButtons.push(node); node.parentNode = controls; }
};
const display = {id:'display', parentNode:controls};

const documentObject = {
  readyState:'loading',
  body:{
    classList:{add(name){ classes.add(name); }},
    appendChild(node){
      if (node && node.tagName === 'SCRIPT') appendedScripts.push(node);
      node.parentNode = this;
      return node;
    }
  },
  getElementById(id){
    if (id === 'controls') return controls;
    if (id === 'display') return display;
    if (id === 'relay-show') return insertedButtons.find(node => node.id === 'relay-show') || null;
    return null;
  },
  createElement(tag){
    return {tagName:String(tag).toUpperCase(), dataset:{}, id:'', textContent:'', parentNode:null};
  }
};
const context = {
  console,
  document:documentObject,
  localStorage:{setItem(key,value){ storage.set(String(key), String(value)); }},
  AGCDSKY:{},
  window:null,
  addEventListener(type, fn, options){
    if (type === 'load') loadHandlers.push({fn, options});
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(cm, context, {filename:'cm-mode.js'});

assert(classes.has('spacecraft-cm'), 'cm-mode.js did not apply the CM body class synchronously');
assert(storage.get('agcMission') === 'comanche055', 'cm-mode.js did not lock the Comanche mission');
assert(typeof context.AGCDSKY.applyCmMode === 'function', 'cm-mode.js did not publish applyCmMode');
assert(loadHandlers.length === 1, `expected one CM load callback, found ${loadHandlers.length}`);
assert(loadHandlers[0].options && loadHandlers[0].options.once === true,
  'CM load callback must remain one-shot');

loadHandlers[0].fn();
const scriptSources = appendedScripts.map(node => node.src);
assert(scriptSources.length === 1 && scriptSources[0] === 'relay-show.js',
  `expected only dynamic relay-show.js after load, got: ${scriptSources.join(', ') || 'none'}`);
assert(insertedButtons.filter(node => node.id === 'relay-show').length === 1,
  'Relay Show control was not created exactly once');

// Re-running the load hook cannot duplicate the button/script pair.
loadHandlers[0].fn();
assert(appendedScripts.length === 1,
  'repeat Relay Show installation appended another script');
assert(insertedButtons.filter(node => node.id === 'relay-show').length === 1,
  'repeat Relay Show installation duplicated its control');

// A second direct apply must be harmless and continue locking CM mission state.
context.AGCDSKY.applyCmMode();
assert(classes.has('spacecraft-cm') && storage.get('agcMission') === 'comanche055',
  'repeat CM-mode application changed the locked CM state');

console.log('CM feature load smoke: PASS');
console.log('  CM hardware layers are parser-loaded only; cm-mode injects no fallback copies; Relay Show remains the sole dynamic feature');
