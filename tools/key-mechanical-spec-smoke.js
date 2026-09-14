#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/assets/key-mechanical-spec.js'), 'utf8'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function button(key) {
  const props = Object.create(null);
  return {
    dataset:{key},
    style:{setProperty(name, value){ props[name] = value; }},
    props
  };
}

const buttons = ['1','2','3','V','N','R','K','E','C','+','-','P'].map(button);
const baseKeys = Object.fromEntries(buttons.map(b => [b.dataset.key, {
  contactMs: 31.7,
  returnSoundMs: 22.3,
  travelVmin: 0.456,
  makePitch: 500,
  returnPitch: 320,
  soundGain: 1.03
}]));

const context = {
  console,
  window:null,
  document:{querySelectorAll(selector){ return selector === '[data-key]' ? buttons : []; }},
  AGCDSKY:{
    hardwarePersonality(){ return {seed:'1234abcd', lamps:{}, keys:baseKeys}; }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, {filename:'key-mechanical-spec.js'});

const first = context.AGCDSKY.hardwarePersonality();
const second = context.AGCDSKY.hardwarePersonality();
assert(first === second, 'mechanical personality must be stable within the simulated DSKY');
assert(first.keyMechanicalSpec.assembly.actuationTravelIn === 3/16,
  'source-backed 3/16-inch actuation travel missing');
assert(first.keyMechanicalSpec.assembly.totalTravelIn === 1/4,
  'source-backed 1/4-inch total travel missing');
assert(first.keyMechanicalSpec.compressionSpring.rateLbPerInMin === 3.0 &&
       first.keyMechanicalSpec.compressionSpring.rateLbPerInMax === 3.5,
  'compression spring documented rate range missing');
assert(first.keyMechanicalSpec.sensitiveSwitch.actuatingForceOzMax === 7,
  'sensitive switch 7-ounce max actuation force missing');
assert(first.keyMechanicalSpec.sensitiveSwitch.releaseForceOzMin === 1,
  'sensitive switch 1-ounce min release force missing');
assert(first.keyMechanicalSpec.keyEl.minimumBrightnessFootLamberts === 2.0 &&
       first.keyMechanicalSpec.keyEl.testVrms === 75 &&
       first.keyMechanicalSpec.keyEl.testHz === 400,
  'key EL shaft-assembly acceptance requirement missing');

const force = first.keyMechanicalSpec.springForceEnvelope;
assert(force.forceIncreaseToActuationOzMin === 9 && force.forceIncreaseToActuationOzMax === 10.5,
  'documented spring range should imply only a 9.0-10.5 oz force increase through the 3/16-in actuation stroke');
assert(force.forceIncreaseToBottomOzMin === 12 && force.forceIncreaseToBottomOzMax === 14,
  'documented spring range should imply only a 12-14 oz force increase through the 1/4-in full stroke');
assert(force.totalFingerForceOzMin === null && force.totalFingerForceOzMax === null,
  'total finger force must remain unresolved without source-backed spring preload/installed geometry');
assert(force.excludedSecondaryEstimate.includes('21-26 oz'),
  'replica total-force figure must remain explicitly excluded from Apollo-source requirements');
assert(first.keyMechanicalSpec.forcePolicy.includes('Total finger force remains unresolved'),
  'force limitation must be visible in exported mechanical metadata');

const rates = [];
for (const [key, p] of Object.entries(first.keys)) {
  assert(p.springRateLbPerIn >= 3.0 && p.springRateLbPerIn <= 3.5,
    `${key}: spring rate escaped documented 3.0-3.5 lb/in range`);
  assert(p.contactMs === 36,
    `${key}: contact timing must remain a fixed gesture estimate, not a fake manufacturing tolerance`);
  assert(p.returnSoundMs === 18,
    `${key}: return audio timing must remain an estimate, not a fake manufacturing tolerance`);
  assert(p.assembly.totalTravelIn === 0.25,
    `${key}: total physical stroke metadata drifted`);
  assert(p.totalFingerForceOz === null,
    `${key}: total finger force was invented from incomplete preload/lever data`);
  assert(p.springIncrementAtActuationOz >= 9 && p.springIncrementAtActuationOz <= 10.5,
    `${key}: actuation spring-force increment escaped source-derived envelope`);
  assert(p.springIncrementAtBottomOz >= 12 && p.springIncrementAtBottomOz <= 14,
    `${key}: bottom spring-force increment escaped source-derived envelope`);
  assert(p.estimateFields.includes('contactMs') && p.estimateFields.includes('travelVmin'),
    `${key}: estimated presentation fields are not labeled`);
  rates.push(p.springRateLbPerIn);
}
assert(new Set(rates).size > 1,
  'deterministic unit personalities did not vary documented spring rate across keys');

for (const b of buttons) {
  assert(b.dataset.keyStrokeIn === '0.2500', `${b.dataset.key}: DOM physical stroke metadata missing`);
  assert(b.dataset.keyActuationIn === '0.1875', `${b.dataset.key}: DOM contact-point metadata missing`);
  assert(b.props['--key-travel'] === '0.42vmin',
    `${b.dataset.key}: screen-depth estimate should be fixed, not randomly varied`);
}

console.log('key mechanical specification smoke: PASS');
console.log('  stroke/switch data and source-derived spring-force increments verified; unsourced total finger force remains intentionally unset');
