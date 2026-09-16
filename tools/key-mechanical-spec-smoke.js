#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app/src/main/assets/key-mechanical-spec.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function button(key){const props=Object.create(null);return{dataset:{key},style:{setProperty(name,value){props[name]=value}},props}}
const buttons=['1','2','3','V','N','R','K','E','C','+','-','P'].map(button);
const baseKeys=Object.fromEntries(buttons.map(b=>[b.dataset.key,{contactMs:31.7,returnSoundMs:22.3,travelVmin:.456,makePitch:500,returnPitch:320,soundGain:1.03}]));
const baseService=Object.freeze({hardwarePersonality(){return{seed:'1234abcd',lamps:{},keys:baseKeys}}});
const AGCDSKY={};
const context={console,document:{querySelectorAll(selector){return selector==='[data-key]'?buttons:[]}},AGCDSKY,AGCDSKY_FLIGHT_HARDWARE_UI:baseService,window:null};context.window=context;
AGCDSKY.hardwarePersonality=function(){const service=context.AGCDSKY_KEY_MECHANICAL_SPEC;return service&&service.hardwarePersonality?service.hardwarePersonality():context.AGCDSKY_FLIGHT_HARDWARE_UI.hardwarePersonality()};
AGCDSKY.keyMechanicalSpec=function(){const service=context.AGCDSKY_KEY_MECHANICAL_SPEC;return service&&service.spec?service.spec():null};
const personalityIdentity=AGCDSKY.hardwarePersonality,specIdentity=AGCDSKY.keyMechanicalSpec;
vm.createContext(context);vm.runInContext(source,context,{filename:'key-mechanical-spec.js'});
assert(context.AGCDSKY_KEY_MECHANICAL_SPEC&&Object.isFrozen(context.AGCDSKY_KEY_MECHANICAL_SPEC),'key mechanical service missing/mutable');
assert(AGCDSKY.hardwarePersonality===personalityIdentity&&AGCDSKY.keyMechanicalSpec===specIdentity,'service publication replaced bootstrap compatibility functions');
assert(!source.includes('window.AGCDSKY.hardwarePersonality =')&&!source.includes('window.AGCDSKY.keyMechanicalSpec ='),'key mechanics regained late facade mutation');
const first=AGCDSKY.hardwarePersonality(),second=AGCDSKY.hardwarePersonality();
assert(first===second,'mechanical personality must be stable within simulated DSKY');
assert(AGCDSKY.keyMechanicalSpec()===first.keyMechanicalSpec,'bootstrap keyMechanicalSpec delegate did not expose composed spec');
assert(first.keyMechanicalSpec.assembly.actuationTravelIn===3/16,'3/16-inch actuation travel missing');
assert(first.keyMechanicalSpec.assembly.totalTravelIn===1/4,'1/4-inch total travel missing');
assert(first.keyMechanicalSpec.compressionSpring.rateLbPerInMin===3&&first.keyMechanicalSpec.compressionSpring.rateLbPerInMax===3.5,'compression spring rate range missing');
assert(first.keyMechanicalSpec.sensitiveSwitch.actuatingForceOzMax===7,'7-ounce max actuation force missing');
assert(first.keyMechanicalSpec.sensitiveSwitch.releaseForceOzMin===1,'1-ounce min release force missing');
assert(first.keyMechanicalSpec.keyEl.minimumBrightnessFootLamberts===2&&first.keyMechanicalSpec.keyEl.testVrms===75&&first.keyMechanicalSpec.keyEl.testHz===400,'key EL acceptance requirement missing');
const force=first.keyMechanicalSpec.springForceEnvelope;
assert(force.forceIncreaseToActuationOzMin===9&&force.forceIncreaseToActuationOzMax===10.5,'actuation spring force envelope wrong');
assert(force.forceIncreaseToBottomOzMin===12&&force.forceIncreaseToBottomOzMax===14,'bottom spring force envelope wrong');
assert(force.totalFingerForceOzMin===null&&force.totalFingerForceOzMax===null,'total finger force must remain unresolved');
assert(force.excludedSecondaryEstimate.includes('21-26 oz'),'replica total-force figure exclusion missing');
assert(first.keyMechanicalSpec.forcePolicy.includes('Total finger force remains unresolved'),'force limitation missing');
const rates=[];
for(const [key,p] of Object.entries(first.keys)){
  assert(p.springRateLbPerIn>=3&&p.springRateLbPerIn<=3.5,`${key}: spring rate escaped range`);
  assert(p.contactMs===36,`${key}: contact timing must remain fixed estimate`);
  assert(p.returnSoundMs===18,`${key}: return timing must remain fixed estimate`);
  assert(p.assembly.totalTravelIn===.25,`${key}: total stroke drifted`);
  assert(p.totalFingerForceOz===null,`${key}: total finger force invented`);
  assert(p.springIncrementAtActuationOz>=9&&p.springIncrementAtActuationOz<=10.5,`${key}: actuation increment escaped envelope`);
  assert(p.springIncrementAtBottomOz>=12&&p.springIncrementAtBottomOz<=14,`${key}: bottom increment escaped envelope`);
  assert(p.estimateFields.includes('contactMs')&&p.estimateFields.includes('travelVmin'),`${key}: estimate fields unlabeled`);
  rates.push(p.springRateLbPerIn);
}
assert(new Set(rates).size>1,'deterministic spring-rate personalities did not vary');
for(const b of buttons){assert(b.dataset.keyStrokeIn==='0.2500',`${b.dataset.key}: stroke metadata missing`);assert(b.dataset.keyActuationIn==='0.1875',`${b.dataset.key}: contact-point metadata missing`);assert(b.props['--key-travel']==='0.42vmin',`${b.dataset.key}: screen-depth estimate drifted`)}
console.log('key mechanical specification smoke: PASS');
console.log('  composed service ownership, stable bootstrap delegates, stroke/switch data, and source-derived spring-force increments verified; total finger force remains unset');
