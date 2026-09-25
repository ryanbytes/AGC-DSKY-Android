#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const tactile=read('app/src/main/assets/key-tactile-feedback.js');
const mechanical=read('app/src/main/assets/key-mechanical-spec.js');
const keyboard=read('app/src/main/assets/keyboard-electrical-interlock.js');
const proceed=read('app/src/main/assets/proceed-electrical.js');
const main=read('app/src/main/java/org/apollo/agcdsky/MainActivity.java');
const sensor=read('app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');
const bridge=read('app/src/main/java/org/apollo/agcdsky/KeyHapticBridge.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const html=read('app/src/main/assets/index.html');
const sw=read('pwa/static/sw.js');
function assert(c,m){if(!c)throw new Error(m)}

for(const marker of [
  "window.AGCDSKY_SERVICE_REGISTRY",
  "registry.publish('AGCDSKY_KEY_TACTILE'",
  "make:'VibrationEffect.EFFECT_CLICK'",
  "release:'VibrationEffect.EFFECT_TICK'",
  "legacyFallback:'View.performHapticFeedback'",
  "policy:'event-cue-only; predefined device-tuned effects; no force-to-vibration amplitude mapping'",
  "totalFingerForceOz: null"
])assert(tactile.includes(marker),'tactile service missing: '+marker);
for(const forbidden of ['navigator.vibrate','forceToAmplitude','amplitude:','createOneShot','createWaveform'])
  assert(!tactile.includes(forbidden),'tactile service invented raw vibration mapping: '+forbidden);

for(const marker of [
  'VibrationEffect.EFFECT_CLICK',
  'VibrationEffect.EFFECT_TICK',
  'VibrationEffect.createPredefined(predefinedEffect)',
  'vibrator.vibrate(VibrationEffect.createPredefined(predefinedEffect))',
  'VibrationEffect.EFFECT_HEAVY_CLICK',
  'testPulse()',
  'HapticFeedbackConstants.VIRTUAL_KEY',
  'HapticFeedbackConstants.VIRTUAL_KEY_RELEASE',
  'target.performHapticFeedback(legacyViewEffect)',
  'setHapticFeedbackEnabled(true)'
])assert(bridge.includes(marker),'native haptic bridge missing: '+marker);
for(const forbidden of ['VibrationEffect.createOneShot','VibrationEffect.createWaveform','VibrationAttributes.USAGE_TOUCH','USAGE_TOUCH'])
  assert(!bridge.includes(forbidden),'native bridge retained suppressed/raw vibration path: '+forbidden);
assert(manifest.includes('android.permission.VIBRATE'),'predefined VibrationEffect path requires VIBRATE permission');

for(const [source,label] of [[main,'MainActivity'],[sensor,'SensorMainActivity']]){
  assert(source.includes('new KeyHapticBridge(webView),"HapticBridge"'),label+' missing HapticBridge exposure');
  assert(source.includes('"HapticBridge"'),label+' teardown does not name HapticBridge');
}
assert(html.indexOf('key-mechanical-spec.js')<html.indexOf('key-tactile-feedback.js')&&
       html.indexOf('key-tactile-feedback.js')<html.indexOf('keyboard-electrical-interlock.js'),
       'tactile service parser order must be mechanical -> tactile -> keyboard');
assert(sw.includes("'./key-tactile-feedback.js'"),'PWA offline contract missing tactile asset');

for(const marker of [
  "get('AGCDSKY_KEY_TACTILE')",
  "state.source === 'pointer'",
  "source:'pointer'",
  "source:'keyboard'",
  "keyHaptic(state.button, false)",
  "keyHaptic(state.button, true)"
])assert(keyboard.includes(marker),'normal-key tactile coupling missing: '+marker);
assert(proceed.includes("get('AGCDSKY_KEY_TACTILE')"),'PRO tactile service lookup missing');
assert(proceed.includes("keyHaptic(false)"),'PRO make haptic missing');
assert(proceed.includes("releaseProceedWithHaptic()"),'PRO release haptic missing');

const calls=[];
const context={console,Date,window:null,HapticBridge:{
  available(){return true},
  backend(){return 'Vibrator.predefined-unclassified'},
  amplitudeControl(){return true},
  keyMake(){calls.push('make');return true},
  keyRelease(){calls.push('release');return true},
  testPulse(){calls.push('test');return true}
}};
context.window=context;
const registry=installServiceRegistry(context);
registry.publish('AGCDSKY_KEY_MECHANICAL_SPEC',Object.freeze({spec:()=>Object.freeze({
  assembly:Object.freeze({actuationTravelIn:3/16,overtravelToBottomIn:1/16,totalTravelIn:1/4}),
  compressionSpring:Object.freeze({rateLbPerInMin:3,rateLbPerInMax:3.5}),
  sensitiveSwitch:Object.freeze({actuatingForceOzMax:7,releaseForceOzMin:1}),
  springForceEnvelope:Object.freeze({
    forceIncreaseToActuationOzMin:9,forceIncreaseToActuationOzMax:10.5,
    forceIncreaseToBottomOzMin:12,forceIncreaseToBottomOzMax:14,
    totalFingerForceOzMin:null,totalFingerForceOzMax:null
  })
})}),'mechanical fixture');
vm.createContext(context);
vm.runInContext(tactile,context,{filename:'key-tactile-feedback.js'});
const service=registry.get('AGCDSKY_KEY_TACTILE');
assert(service&&Object.isFrozen(service),'tactile service missing/mutable');
assert(service.make('1')===true&&service.release('1')===true,'native bridge calls rejected');
assert(calls.join(',')==='make,release','native bridge event order wrong');
const status=service.status();
assert(status.nativeBridge===true,'native bridge status false');
assert(status.nativeBackend==='Vibrator.predefined-unclassified','native backend status wrong');
assert(status.amplitudeControl===true,'amplitude-control status wrong');
assert(service.test()===true&&calls[calls.length-1]==='test','direct native haptic probe failed');
assert(status.platformEffects.make==='VibrationEffect.EFFECT_CLICK'&&status.platformEffects.release==='VibrationEffect.EFFECT_TICK','predefined effect mapping wrong');
assert(status.makeCount===1&&status.releaseCount===1,'tactile event counters wrong');
assert(status.actuationTravelIn===3/16&&status.overtravelToBottomIn===1/16&&status.totalTravelIn===1/4,'R-700 travel not propagated');
assert(status.springForceIncreaseToActuationOzMin===9&&status.springForceIncreaseToActuationOzMax===10.5,'actuation spring ΔF wrong');
assert(status.springForceIncreaseToBottomOzMin===12&&status.springForceIncreaseToBottomOzMax===14,'bottom spring ΔF wrong');
assert(status.totalFingerForceOz===null,'total finger force was invented');

const browser={console,Date,window:null};browser.window=browser;const browserRegistry=installServiceRegistry(browser);
browserRegistry.publish('AGCDSKY_KEY_MECHANICAL_SPEC',registry.get('AGCDSKY_KEY_MECHANICAL_SPEC'),'mechanical fixture');
vm.createContext(browser);vm.runInContext(tactile,browser,{filename:'key-tactile-feedback-browser.js'});
const browserService=browserRegistry.get('AGCDSKY_KEY_TACTILE');
assert(browserService.make('1')===false&&browserService.release('1')===false,'non-native surface must no-op');
assert(browserService.status().nativeBridge===false,'non-native surface incorrectly reports haptics');

console.log('key tactile feedback smoke: PASS');
console.log('  R-700/2004941/1010901 mechanics remain numeric diagnostics only; Android uses device-tuned EFFECT_CLICK make / EFFECT_TICK release with no raw force-amplitude fiction');
