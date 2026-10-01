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
const apple=read('apple/Sources/AGCWebView.swift');
const manifest=read('app/src/main/AndroidManifest.xml');
const html=read('app/src/main/assets/index.html');
const sw=read('pwa/static/sw.js');
function assert(c,m){if(!c)throw new Error(m)}

for(const marker of [
  "window.AGCDSKY_SERVICE_REGISTRY",
  "registry.publish('AGCDSKY_KEY_TACTILE'",
  "make:'disabled'",
  "release:'disabled'",
  "diagnostic:'explicit test pulse only'",
  "relay:'separate relay-specific bridge'",
  "keyHapticsEnabled:false",
  "policy:'normal DSKY key make/release haptics disabled; diagnostic test pulse only; relay haptics are separate'",
  "browserVibration:",
  "hapticPlatform:",
  "backend: () => 'navigator.vibrate'",
  "keyMake: () => navigator.vibrate(WEB_MAKE_MS)",
  "keyRelease: () => navigator.vibrate(WEB_RELEASE_MS)",
  "testPulse: () => navigator.vibrate(WEB_TEST_MS)",
  "totalFingerForceOz: null"
])assert(tactile.includes(marker),'tactile service missing: '+marker);
for(const forbidden of ['forceToAmplitude','amplitude:','createWaveform'])
  assert(!tactile.includes(forbidden),'tactile service invented force/amplitude mapping: '+forbidden);

for(const marker of [
  'VibratorManager',
  'manager.getDefaultVibrator()',
  'Settings.System.HAPTIC_FEEDBACK_ENABLED',
  'Settings.System.VIBRATE_ON',
  'Manifest.permission.VIBRATE',
  'PackageManager.PERMISSION_GRANTED',
  'PowerManager',
  'openSoundSettings()',
  'Settings.ACTION_SOUND_SETTINGS',
  'private static final long MAKE_MS = 22L',
  'private static final long RELEASE_MS = 10L',
  'private static final long DIAGNOSTIC_MS = 120L',
  'VibrationEffect.createOneShot(',
  'VibrationEffect.DEFAULT_AMPLITUDE',
  'testPulse()',
  'HapticFeedbackConstants.VIRTUAL_KEY',
  'HapticFeedbackConstants.VIRTUAL_KEY_RELEASE',
  'target.performHapticFeedback(legacyViewEffect)',
  'setHapticFeedbackEnabled(true)'
])assert(bridge.includes(marker),'native haptic bridge missing: '+marker);
for(const forbidden of ['VibrationEffect.createPredefined','import android.os.VibrationAttributes','VibrationAttributes.createForUsage'])
  assert(!bridge.includes(forbidden),'native key bridge retained failed/suppressed vibration path: '+forbidden);
assert(bridge.includes('@JavascriptInterface public boolean keyMake() {\n        return performOneShot(MAKE_MS, HapticFeedbackConstants.VIRTUAL_KEY);'),'key make no longer uses one-shot native cue');
assert(bridge.includes('@JavascriptInterface public boolean keyRelease() {\n        return performOneShot(RELEASE_MS,'),'key release no longer uses one-shot native cue');
assert(bridge.includes('@JavascriptInterface public boolean relayWaveform(String timingsCsv, String amplitudesCsv)'),'relay-only waveform endpoint missing');
const waveformLengthGuard=bridge.indexOf('if (timingsCsv.length() > RELAY_MAX_WAVEFORM_TEXT_CHARS');
const waveformSplit=bridge.indexOf('String[] timingParts = timingsCsv.split(",")');
assert(bridge.includes('RELAY_MAX_WAVEFORM_TEXT_CHARS = 1024')&&waveformLengthGuard>=0&&waveformSplit>waveformLengthGuard,
  'haptic CSV inputs must be bounded before split allocation');
assert(manifest.includes('android.permission.VIBRATE'),'one-shot VibrationEffect path requires VIBRATE permission');

for(const marker of [
  'import CoreHaptics',
  'UIImpactFeedbackGenerator(style: .rigid)',
  'UIImpactFeedbackGenerator(style: .light)',
  'UIImpactFeedbackGenerator(style: .heavy)',
  'CHHapticEngine.capabilitiesForHardware().supportsHaptics',
  'configuration.userContentController.add(self, name: "HapticBridge")',
  'window.HapticBridge=Object.freeze({',
  "postMessage('make')",
  "postMessage('release')",
  "postMessage('test')",
  'removeScriptMessageHandler(forName: "HapticBridge")',
  'performKeyHaptic(command)',
  'NSHapticFeedbackManager.defaultPerformer',
  'performer.perform(.alignment, performanceTime: .now)',
  'performer.perform(.levelChange, performanceTime: .now)'
])assert(apple.includes(marker),'Apple haptic parity missing: '+marker);

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
  platform(){return 'android'},
  backend(){return 'VibratorManager.default-one-shot'},
  amplitudeControl(){return true},
  vibratePermissionGranted(){return true},
  systemHapticFeedbackEnabled(){return 0},
  systemVibrateOn(){return 0},
  powerSaveMode(){return false},
  makeDurationMs(){return 22},
  releaseDurationMs(){return 10},
  openSoundSettings(){calls.push('settings');return true},
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
assert(service.make('1')===false&&service.release('1')===false,'normal key haptics must be disabled');
assert(calls.length===0,'disabled normal key haptics must not reach native vibration');
const status=service.status();
assert(status.nativeBridge===true,'native bridge status false');
assert(status.browserVibration===false,'native surface incorrectly reports browser vibration');
assert(status.hapticPlatform==='android','native platform status wrong');
assert(status.nativeBackend==='VibratorManager.default-one-shot','native backend status wrong');
assert(status.amplitudeControl===true,'amplitude-control status wrong');
assert(status.vibratePermissionGranted===true,'VIBRATE permission status wrong');
assert(status.systemHapticFeedbackEnabled===0&&status.systemVibrateOn===0,'system vibration settings not propagated');
assert(status.powerSaveMode===false,'power-saver status wrong');
assert(status.makeDurationMs===22&&status.releaseDurationMs===10,'one-shot pulse durations wrong');
assert(service.test()===true&&calls[calls.length-1]==='test','direct native haptic probe failed');
assert(service.openSystemSettings()===true&&calls[calls.length-1]==='settings','system vibration settings launcher failed');
assert(status.platformEffects.make==='disabled'&&status.platformEffects.release==='disabled','key haptic diagnostics must report disabled');
assert(status.platformEffects.relay==='separate relay-specific bridge','relay haptics must remain explicitly separate');
assert(status.keyHapticsEnabled===false,'key haptic disable flag missing');
assert(status.makeCount===0&&status.releaseCount===0&&status.lastEvent===null,'disabled key haptics must not record tactile events');
assert(status.actuationTravelIn===3/16&&status.overtravelToBottomIn===1/16&&status.totalTravelIn===1/4,'R-700 travel not propagated');
assert(status.springForceIncreaseToActuationOzMin===9&&status.springForceIncreaseToActuationOzMax===10.5,'actuation spring ΔF wrong');
assert(status.springForceIncreaseToBottomOzMin===12&&status.springForceIncreaseToBottomOzMax===14,'bottom spring ΔF wrong');
assert(status.totalFingerForceOz===null,'total finger force was invented');

const browserCalls=[];
const browser={console,Date,window:null,navigator:{vibrate(ms){browserCalls.push(ms);return true}}};
browser.window=browser;const browserRegistry=installServiceRegistry(browser);
browserRegistry.publish('AGCDSKY_KEY_MECHANICAL_SPEC',registry.get('AGCDSKY_KEY_MECHANICAL_SPEC'),'mechanical fixture');
vm.createContext(browser);vm.runInContext(tactile,browser,{filename:'key-tactile-feedback-browser.js'});
const browserService=browserRegistry.get('AGCDSKY_KEY_TACTILE');
assert(browserService.make('1')===false&&browserService.release('1')===false,'browser key haptics must be disabled');
assert(browserCalls.length===0,'disabled browser key haptics must not call navigator.vibrate');
assert(browserService.test()===true,'supported browser diagnostic vibration rejected');
assert(browserCalls.join(',')==='120','browser diagnostic vibration timing wrong');
const browserStatus=browserService.status();
assert(browserStatus.nativeBridge===false&&browserStatus.browserVibration===true,'browser fallback status wrong');
assert(browserStatus.hapticPlatform==='web'&&browserStatus.nativeBackend==='navigator.vibrate','browser backend status wrong');

const unsupported={console,Date,window:null,navigator:{}};unsupported.window=unsupported;
const unsupportedRegistry=installServiceRegistry(unsupported);
unsupportedRegistry.publish('AGCDSKY_KEY_MECHANICAL_SPEC',registry.get('AGCDSKY_KEY_MECHANICAL_SPEC'),'mechanical fixture');
vm.createContext(unsupported);vm.runInContext(tactile,unsupported,{filename:'key-tactile-feedback-unsupported.js'});
const unsupportedService=unsupportedRegistry.get('AGCDSKY_KEY_TACTILE');
assert(unsupportedService.make('1')===false&&unsupportedService.release('1')===false,'unsupported web surface must no-op');
assert(unsupportedService.status().nativeBridge===false&&unsupportedService.status().browserVibration===false,'unsupported web surface incorrectly reports haptics');

console.log('key tactile feedback smoke: PASS');
console.log('  normal DSKY button make/release haptics are disabled on native and web; diagnostic test pulse remains available; relay haptics are separate');
