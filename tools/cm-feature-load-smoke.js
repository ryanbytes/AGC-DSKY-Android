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
  'relay-perceptual-personality',
  'relay-show'
];

let priorIndex = -1;
for (const feature of features) {
  const tag = `<script src="${feature}.js" data-feature="${feature}"></script>`;
  const index = html.indexOf(tag);
  if (index < 0) fail(`index.html is missing deterministic ${feature} script tag`);
  if (index <= priorIndex) fail(`${feature}.js is out of CM dependency order`);
  priorIndex = index;
  if (cm.includes(`script.src = '${feature}.js'`) || cm.includes('createElement(\'script\')')) {
    fail(`cm-mode.js still contains dynamic feature loading for ${feature}`);
  }
}

const dreamIndex = html.indexOf('<script src="dream-agc.js"></script>');
if (dreamIndex < 0 || priorIndex >= dreamIndex) {
  fail('all CM hardware/presentation layers must initialize before dream-agc.js readiness marker');
}

const relayShowButton = html.indexOf('<button id="relay-show">RELAY SHOW</button>');
const displayButton = html.indexOf('<button id="display">FULL DSKY DISPLAY</button>');
assert(relayShowButton >= 0, 'Relay Show control is not statically declared');
assert(displayButton > relayShowButton, 'Relay Show control must remain immediately before the display control group');
assert((html.match(/id="relay-show"/g) || []).length === 1,
  'Relay Show control must be declared exactly once');
assert((html.match(/src="relay-show\.js"/g) || []).length === 1,
  'relay-show.js must be parser-loaded exactly once');

const classes = new Set();
const storage = new Map();
const context = {
  console,
  document:{body:{classList:{add(name){ classes.add(name); }}}},
  localStorage:{setItem(key,value){ storage.set(String(key), String(value)); }},
  AGCDSKY:{},
  window:null
};
context.window = context;
vm.createContext(context);
vm.runInContext(cm, context, {filename:'cm-mode.js'});

assert(classes.has('spacecraft-cm'), 'cm-mode.js did not apply the CM body class synchronously');
assert(storage.get('agcMission') === 'comanche055', 'cm-mode.js did not lock the Comanche mission');
assert(typeof context.AGCDSKY.applyCmMode === 'function', 'cm-mode.js did not publish applyCmMode');

context.AGCDSKY.applyCmMode();
assert(classes.has('spacecraft-cm') && storage.get('agcMission') === 'comanche055',
  'repeat CM-mode application changed the locked CM state');

console.log('CM feature load smoke: PASS');
console.log('  all CM feature scripts and Relay Show control are parser-loaded exactly once; cm-mode owns configuration only');
