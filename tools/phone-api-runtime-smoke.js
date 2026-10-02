#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function same(a,b,m){assert(JSON.stringify(a)===JSON.stringify(b),`${m}\n actual: ${JSON.stringify(a)}\n expected: ${JSON.stringify(b)}`)}

const apiSource=read('agc-api-runtime.js'),runtime=read('phone-api-runtime.js'),phone=read('phone-icdu.js'),html=read('index.html');
const expected=[
  'nativePhoneQuaternion','setOpticsCaptureActive','zeroOpticsCapture','phoneOpticsAngles',
  'nativePhoneSensorStatus','calibrateSkyBoresight','clearSkyBoresightCalibration',
  'skyCalibrationStatus','projectSkyTarget','nativeMagneticQuaternion',
  'nativeMagneticSensorStatus','nativeSkyPointing','phoneSkyPointing',
  'nativePipaSensorStatus','nativePhoneLinearAcceleration','phoneIcduStatus','recenterPhoneImu'
];
for(const marker of [
  "window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_PHONE',Object.freeze({",'implementation,','installImplementation,','installImplementations,','compatibilityVersions:',
  "Object.prototype.hasOwnProperty.call(source,name)","Phone API module missing implementation: ${name}"
])assert(runtime.includes(marker),`phone API registry marker missing: ${marker}`);
for(const forbidden of ['Object.defineProperty(api','set:next=>','legacy phone-icdu registration','const api=window.AGCDSKY'])assert(!runtime.includes(forbidden),`phone API registry retained root-facade mutation path: ${forbidden}`);
for(const marker of ['const PHONE_API_NAMES=Object.freeze([','function publicPhoneImplementation(name)','const publicPhoneApi=Object.freeze(Object.fromEntries(','...publicPhoneApi'])assert(apiSource.includes(marker),`bootstrap phone facade marker missing: ${marker}`);
const apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>');
const ownerIndex=html.indexOf('<script src="phone-api-runtime.js"></script>');
const phoneIndex=html.indexOf('<script src="phone-icdu.js"></script>');
assert(apiIndex>=0&&ownerIndex>apiIndex&&phoneIndex>ownerIndex,'phone registry must load after public facade and before phone-icdu');

assert(phone.includes('const app = window.AGCDSKY;'),'phone-icdu must retain app-service read access');
assert(phone.includes('const api = Object.create(app);'),'phone-icdu must define implementations on a module-local export object');
assert(phone.includes("phoneService.installImplementations(api,'phone-icdu module registration');"),'phone-icdu explicit batch registration missing');
assert(!phone.includes('const api = window.AGCDSKY;'),'phone-icdu regained direct root-facade alias');
assert(phone.includes('const e = apolloGimbals(correctedRel);'),'flight IMU path must decompose the corrected attitude with Apollo gimbal geometry');
assert(phone.includes('const CM_PIPA_DV_PER_PULSE = 0.0585;')&&phone.includes('const LM_PIPA_DV_PER_PULSE = 0.01;'),
  'phone PIPA input must use the vehicle-specific CM and LM pulse scales');
const pipaScaleMatch=phone.match(/function pipaDvPerPulse\([\s\S]*?\n  \}/);
assert(pipaScaleMatch,'mission-specific phone PIPA scale selector missing');
const pipaScale=vm.runInNewContext(`(()=>{const CM_PIPA_DV_PER_PULSE=0.0585,LM_PIPA_DV_PER_PULSE=0.01,app={getMission:()=> 'luminary099'};${pipaScaleMatch[0]};return pipaDvPerPulse})()`);
assert(pipaScale('luminary099')===0.01,'Luminary PIPA input must use 1 cm/s per pulse');
assert(pipaScale('comanche055')===0.0585,'Comanche PIPA input must retain its 5.85 cm/s per pulse scale');
assert(phone.includes('if(mission!==pipaMission){\n      pipaMission=mission;\n      pipaLastTimestamp=null;\n      pipaFraction=[0,0,0];\n      pipaPending=[0,0,0];\n    }'),
  'switching missions must discard PIPA counts accumulated under the prior vehicle scale');
assert(phone.includes('opticsAngles = eulerXYZ(opticalRel);'),'camera aiming must retain conventional device Euler decomposition');
assert(phone.includes('const gameRelYaw = eulerXYZ(rel)[2];'),'magnetic drift estimator must compare conventional device yaw, not Apollo middle-gimbal angle');
assert(phone.includes("correctedRel = qNorm(qMul(qAxis('z', rad(magneticYawCorrection)), rel));"),
  'magnetic yaw correction must be applied to the attitude quaternion before Apollo gimbal decomposition');
assert(!phone.includes('e[2] += magneticYawCorrection'),
  'magnetic yaw correction must not be added directly to the Apollo middle-gimbal angle');

const calibrationLoader=phone.match(/function loadSkyCalibration\(\)\{[\s\S]*?\n  \}/);
assert(calibrationLoader,'saved camera calibration loader missing');
function loadCalibration(value){
  const state={cameraBoresightDevice:[0,0,-1],skyCalibration:null};
  const context={
    localStorage:{getItem:()=>JSON.stringify(value)},JSON,Number,Array,Math,
    SKY_CAL_KEY:'sxtCameraBoresightV1',cameraBoresightDevice:state.cameraBoresightDevice,
    skyCalibration:state.skyCalibration
  };
  vm.createContext(context);
  vm.runInContext(`${calibrationLoader[0]};loadSkyCalibration()`,context);
  return {boresight:Array.from(context.cameraBoresightDevice),calibration:context.skyCalibration};
}
const invalidCalibration=loadCalibration({schema:1,boresight:[0,0,0]});
same(invalidCalibration.boresight,[0,0,-1],'zero-length saved boresight replaced the default camera direction');
assert(invalidCalibration.calibration===null,'zero-length saved boresight was accepted');
const oversizedCalibration=loadCalibration({schema:1,boresight:[1.7e308,1.7e308,1.7e308]});
same(oversizedCalibration.boresight,[0,0,-1],'non-finite saved boresight magnitude replaced the default camera direction');
assert(oversizedCalibration.calibration===null,'non-finite saved boresight magnitude was accepted');
const validCalibration=loadCalibration({schema:1,boresight:[0,3,4]});
same(validCalibration.boresight,[0,.6,.8],'valid saved boresight was not normalized');
assert(validCalibration.calibration!==null,'valid saved camera calibration was rejected');

const gimbalMatch=phone.match(/function apolloGimbals\(q\) \{[\s\S]*?\n  \}/);
assert(gimbalMatch,'apolloGimbals implementation missing');
const apolloGimbals=vm.runInNewContext(`(${gimbalMatch[0]})`,{
  Math,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  deg:r=>r*180/Math.PI
});
const qAxis=(axis,degrees)=>{
  const h=degrees*Math.PI/360,c=Math.cos(h),s=Math.sin(h);
  return axis==='x'?[c,s,0,0]:axis==='y'?[c,0,s,0]:[c,0,0,s];
};
const qMul=(a,b)=>[
  a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
  a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
  a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
  a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]
];
const angleError=(actual,expected)=>Math.abs((((actual-expected)+180)%360+360)%360-180);
for(const expectedAngles of [[20,0,0],[0,-30,0],[0,0,40],[37,-21,28],[-52,33,-41]]){
  const [outer,inner,middle]=expectedAngles;
  const q=qMul(qMul(qAxis('y',inner),qAxis('z',middle)),qAxis('x',outer));
  const actual=apolloGimbals(q);
  actual.forEach((value,i)=>assert(angleError(value,expectedAngles[i])<1e-9,
    `Apollo gimbal extraction mismatch for ${JSON.stringify(expectedAngles)}: ${JSON.stringify(actual)}`));
}
const assigned=[...phone.matchAll(/^\s*api\.([A-Za-z_$][\w$]*)\s*=\s*(?!=)/gm)].map(m=>m[1]);
same([...new Set(assigned)].sort(),expected.slice().sort(),'phone-icdu module export set changed without updating the explicit phone registry');

let initCount=0;
const appState=Object.seal({selectedMission:'comanche055',ntpStatus:{state:'unavailable'}}),coreSession=Object.seal({core:null});
const shell={clockTimeLabel:()=> 'CLOCK',accurateTime:()=>0,accurateDate:()=>new Date(0),updateNtpStatus(){},initialize(){initCount++}};
const renderer={},environment={},audio={context:()=>null},clock={},display={onChannel(){}},snapshot={save(){},clear(){},savedInfo(){return null},verifyRoundTrip(){return null},scheduleAutosave(){}},lifecycle={setAppVisible(){},enterClock(){return'clock'},enterAgc(){return'agc'},status(){return{mode:'clock'}}};
const context={window:null,AGCDSKY_APP_STATE:appState,AGCDSKY_CORE_SESSION:coreSession,AGCDSKY_SHELL:shell,AGCDSKY_RENDERER:renderer,AGCDSKY_ENVIRONMENT:environment,AGCDSKY_AUDIO:audio,AGCDSKY_CLOCK:clock,AGCDSKY_DISPLAY:display,AGCDSKY_SNAPSHOT:snapshot,AGCDSKY_LIFECYCLE:lifecycle,Object,Set,Reflect,Error,TypeError,String,Date};
context.window=context;
vm.createContext(context);
vm.runInContext(apiSource,context,{filename:'agc-api-runtime.js'});
const api=context.AGCDSKY;
assert(initCount===1,'public API bootstrap did not initialize shell once');
const identities=Object.fromEntries(expected.map(name=>[name,api[name]]));
for(const name of expected){assert(typeof identities[name]==='function',`bootstrap phone delegate missing: ${name}`);assert(api[name]()===undefined,`phone delegate ${name} should be inert before registry publication`)}

vm.runInContext(runtime,context,{filename:'phone-api-runtime.js'});
const service=context.AGCDSKY_PHONE;
assert(service&&Object.isFrozen(service),'phone API service must be frozen');
same(Array.from(service.keys()),expected,'phone API service key set changed');
assert(Object.values(service.compatibilityVersions()).every(v=>v===0),'phone registry must start with zero implementation versions');

const batch=Object.create(null),calls=[];
for(const name of expected)batch[name]=function(...args){calls.push([name,this===api,...args]);return {name,args};};
service.installImplementations(batch,'test module batch');
for(const name of expected){
  assert(service.implementation(name)===batch[name],`batch registration did not install ${name}`);
  assert(service.compatibilityVersions()[name]===1,`batch registration version for ${name} is not 1`);
  assert(service.registrationReasons()[name]==='test module batch',`batch registration reason for ${name} changed`);
  assert(api[name]===identities[name],`bootstrap delegate identity changed after batch registration: ${name}`);
}
const result=api.nativePhoneQuaternion(1,2,3,4,90);
same(result,{name:'nativePhoneQuaternion',args:[1,2,3,4,90]},'bootstrap delegate did not dispatch registered implementation');
same(calls,[['nativePhoneQuaternion',true,1,2,3,4,90]],'registered phone implementation received wrong this/arguments');

service.installImplementation('phoneSkyPointing',()=>({seen:true,az:12.5}),'test explicit replacement');
assert(api.phoneSkyPointing===identities.phoneSkyPointing,'explicit registry replacement changed public phone delegate identity');
same(api.phoneSkyPointing(),{seen:true,az:12.5},'explicit registry replacement did not dispatch through public delegate');
assert(service.compatibilityVersions().phoneSkyPointing===2,'explicit replacement did not advance phoneSkyPointing version');
assert(service.registrationReasons().phoneSkyPointing==='test explicit replacement','explicit replacement reason changed');

let threw=false;try{service.installImplementation('notARealPhoneApi',()=>{})}catch(_){threw=true}assert(threw,'unknown phone API implementation must be rejected');
threw=false;try{service.installImplementation('nativePipaSensorStatus',42)}catch(_){threw=true}assert(threw,'non-function phone API implementation must be rejected');
const before=service.compatibilityVersions();
const incomplete=Object.assign(Object.create(null),batch);delete incomplete.recenterPhoneImu;
threw=false;try{service.installImplementations(incomplete,'incomplete batch')}catch(_){threw=true}assert(threw,'incomplete phone module batch must be rejected');
same(service.compatibilityVersions(),before,'rejected batch partially mutated phone implementation versions');
for(const name of expected)assert(api[name]===identities[name],`stable phone API identity changed during smoke: ${name}`);

console.log('phone API runtime smoke: PASS');
console.log(`  ${expected.length} bootstrap-owned phone/IMU/optics delegates keep stable identities while complete modules register atomically through AGCDSKY_PHONE`);
