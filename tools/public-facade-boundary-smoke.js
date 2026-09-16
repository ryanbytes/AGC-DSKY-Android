#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNER='agc-api-runtime.js';
const PHONE_API=[
  'nativePhoneQuaternion','setOpticsCaptureActive','zeroOpticsCapture','phoneOpticsAngles',
  'nativePhoneSensorStatus','calibrateSkyBoresightCalibration','clearSkyBoresightCalibration',
  'skyCalibrationStatus','projectSkyTarget','nativeMagneticQuaternion',
  'nativeMagneticSensorStatus','nativeSkyPointing','phoneSkyPointing',
  'nativePipaSensorStatus','nativePhoneLinearAcceleration','phoneIcduStatus','recenterPhoneImu'
];
// Preserve the actual facade key spelling; the extra compatibility guard above
// intentionally does not alter the public name.
PHONE_API[5]='calibrateSkyBoresight';
const LATE_SERVICE_GLOBALS=[
  'AGCDSKY_PHONE','AGCDSKY_RUNTIME','AGCDSKY_INPUT','AGCDSKY_CLOCK_BEHAVIOR',
  'AGCDSKY_OPTICS','AGCDSKY_SEXTANT_TAP_MARK','AGCDSKY_CM_MODE','AGCDSKY_HARDWARE',
  'AGCDSKY_PROCEED','AGCDSKY_AUDIO_RECOVERY','AGCDSKY_FLIGHT_HARDWARE_UI',
  'AGCDSKY_LIGHTING_RHEOSTAT_STOP','AGCDSKY_KEY_MECHANICAL_SPEC','AGCDSKY_KEYBOARD_ELECTRICAL',
  'AGCDSKY_LIGHTING_ELECTRICAL','AGCDSKY_RELAY_SHOW','AGCDSKY_HARDWARE_COLOR_MODE','AGCDSKY_DIAGNOSTICS',
  'AGCDSKY_APOLLO_STARS','AGCDSKY_PARALLAX','AGCDSKY_SCREEN_ONLY_GEOMETRY'
];
const RESERVED=[
  'services','lifecycle','agcChannel','getCore','setAppVisible','getMission',
  'enterClock','enterAgc','appStatus','saveAgcState','clearSavedAgcState',
  'savedSnapshotInfo','verifySnapshotRoundTrip','scheduleAgcAutosave',
  'accurateTime','accurateDate','ntpStatus','nativeNtpStatus',
  'hardware','audioStatus','relayShow','openDiagnostics','closeDiagnostics',
  'openSextant','closeSextant','sextantStatus',
  'runtimeTransitions','inputRuntime','clockBehavior',
  'applyCmMode','hardwareColorMode','lightingElectrical','lightingRheostatStop','proceedElectrical',
  'lighting','hardwarePersonality','keyMechanicalSpec','keyboardElectrical','sextantTapMark',
  ...PHONE_API
];
const RETIRED=['parallax3d'];
function escapeRegExp(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
const files=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const violations=[];
const retiredUses=[];
for(const name of files){
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  const aliases=[];
  const aliasDecl=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*window\.AGCDSKY\s*;/g;
  let aliasMatch;while((aliasMatch=aliasDecl.exec(source)))aliases.push(aliasMatch[1]);
  for(const key of RETIRED){
    const escaped=escapeRegExp(key);
    if(new RegExp(`\\bwindow\\.AGCDSKY\\.${escaped}\\b`).test(source))retiredUses.push(`${name}: window.AGCDSKY.${key}`);
    for(const alias of aliases)if(new RegExp(`\\b${alias}\\.${escaped}\\b`).test(source))retiredUses.push(`${name}: ${alias}.${key}`);
  }
  if(name===OWNER)continue;
  for(const key of RESERVED){
    const escaped=escapeRegExp(key);
    const direct=new RegExp(`\\bwindow\\.AGCDSKY\\.${escaped}\\s*=\\s*(?!=)`,'m');
    const bracket=new RegExp(`\\bwindow\\.AGCDSKY\\[['\"]${escaped}['\"]\\]\\s*=\\s*(?!=)`,'m');
    if(direct.test(source)||bracket.test(source)){violations.push(`${name}: window.AGCDSKY.${key}`);continue;}
    for(const alias of aliases){
      const viaAlias=new RegExp(`\\b${alias}\\.${escaped}\\s*=\\s*(?!=)`,'m');
      if(viaAlias.test(source)){violations.push(`${name}: ${alias}.${key}`);break;}
    }
  }
}
if(violations.length)throw new Error(`stable public facade mutated outside ${OWNER}: ${violations.join(', ')}`);
if(retiredUses.length)throw new Error(`retired public facade alias returned: ${retiredUses.join(', ')}`);
const owner=fs.readFileSync(path.join(ASSETS,OWNER),'utf8');
for(const marker of [
  'const LATE_SERVICE_GLOBALS=Object.freeze([',
  'function createLateServiceRegistry()',
  "Object.defineProperty(window,'AGCDSKY_SERVICE_REGISTRY'",
  'function lateService(name){return apiLateServiceRegistry.get(name)}',
  'function publicEnterAgc()',
  'function publicEnterClock()',
  'function publicHardware()',
  'function publicAudioStatus()',
  'function publicOpenDiagnostics(...args)',
  'function publicCloseDiagnostics(...args)',
  'function publicOpenSextant(...args)',
  'function publicCloseSextant(...args)',
  'function publicSextantStatus(...args)',
  'function publicApplyCmMode(...args)',
  'function publicHardwarePersonality(...args)',
  'function publicKeyMechanicalSpec(...args)',
  'const publicRelayShow=Object.freeze({',
  'const PHONE_API_NAMES=Object.freeze([',
  'function publicPhoneImplementation(name)',
  'const publicPhoneApi=Object.freeze(Object.fromEntries(',
  '...publicPhoneApi',
  "get runtimeTransitions(){return lateService('AGCDSKY_RUNTIME')}",
  "get inputRuntime(){return lateService('AGCDSKY_INPUT')}",
  "get clockBehavior(){return lateService('AGCDSKY_CLOCK_BEHAVIOR')}",
  "get hardwareColorMode(){return lateService('AGCDSKY_HARDWARE_COLOR_MODE')}",
  "get lightingElectrical(){return lateService('AGCDSKY_LIGHTING_ELECTRICAL')}",
  "get lightingRheostatStop(){return lateService('AGCDSKY_LIGHTING_RHEOSTAT_STOP')}",
  "get proceedElectrical(){return lateService('AGCDSKY_PROCEED')}",
  "get lighting(){return lateService('AGCDSKY_FLIGHT_HARDWARE_UI')?.lighting||null}",
  "get keyboardElectrical(){return lateService('AGCDSKY_KEYBOARD_ELECTRICAL')}",
  "get sextantTapMark(){return lateService('AGCDSKY_SEXTANT_TAP_MARK')}",
  'window.AGCDSKY={services:apiServices'
])if(!owner.includes(marker))throw new Error(`public facade owner marker missing: ${marker}`);
const facadeStart=owner.indexOf('function lateService(name)');
const facadeSource=owner.slice(facadeStart);
for(const name of LATE_SERVICE_GLOBALS)if(facadeSource.includes(`window.${name}`))throw new Error(`public facade still consumes compatibility late-service global: window.${name}`);
for(const name of PHONE_API)if(!owner.includes(`'${name}'`))throw new Error(`phone facade key missing from bootstrap owner: ${name}`);
console.log('public facade boundary smoke: PASS');
console.log(`  ${RESERVED.length} stable AGCDSKY facade keys resolve late services through the registry; ${LATE_SERVICE_GLOBALS.length} compatibility globals are no longer facade dependencies; retired aliases absent: ${RETIRED.join(', ')}`);
require('./root-facade-creation-smoke.js');
require('./late-service-publication-smoke.js');
require('./phone-api-runtime-smoke.js');
require('./optics-service-smoke.js');
require('./late-public-facade-mutation-smoke.js');
