#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function same(a,b,m){assert(JSON.stringify(a)===JSON.stringify(b),`${m}\n actual: ${JSON.stringify(a)}\n expected: ${JSON.stringify(b)}`)}

const runtime=read('phone-api-runtime.js'),phone=read('phone-icdu.js'),html=read('index.html');
const expected=[
  'nativePhoneQuaternion','setOpticsCaptureActive','zeroOpticsCapture','phoneOpticsAngles',
  'nativePhoneSensorStatus','calibrateSkyBoresight','clearSkyBoresightCalibration',
  'skyCalibrationStatus','projectSkyTarget','nativeMagneticQuaternion',
  'nativeMagneticSensorStatus','nativeSkyPointing','phoneSkyPointing',
  'nativePipaSensorStatus','nativePhoneLinearAcceleration','phoneIcduStatus','recenterPhoneImu'
];
for(const marker of [
  'window.AGCDSKY_PHONE=Object.freeze({','implementation,','installImplementation,','compatibilityVersions:',
  "set:next=>installImplementation(name,next,'legacy phone-icdu registration')"
])assert(runtime.includes(marker),`phone API owner marker missing: ${marker}`);
const apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>');
const ownerIndex=html.indexOf('<script src="phone-api-runtime.js"></script>');
const phoneIndex=html.indexOf('<script src="phone-icdu.js"></script>');
assert(apiIndex>=0&&ownerIndex>apiIndex&&phoneIndex>ownerIndex,'phone API owner must load after public facade and before phone-icdu');

const assigned=[...phone.matchAll(/\bapi\.([A-Za-z_$][\w$]*)\s*=\s*(?!=)/g)].map(m=>m[1]);
same([...new Set(assigned)].sort(),expected.slice().sort(),'phone-icdu late public API assignments changed without updating the explicit owner');

const window={AGCDSKY:{getCore:()=>null}};
const context={window,Object,Set,Reflect,Error,TypeError,String};
vm.runInNewContext(runtime,context,{filename:'phone-api-runtime.js'});
const api=window.AGCDSKY,service=window.AGCDSKY_PHONE;
assert(service&&Object.isFrozen(service),'phone API service must be frozen');
same(Array.from(service.keys()),expected,'phone API service key set changed');
const identities=Object.fromEntries(expected.map(name=>[name,api[name]]));
for(const name of expected)assert(typeof identities[name]==='function',`public phone API delegate missing: ${name}`);

let calls=[];
api.nativePhoneQuaternion=(...args)=>{calls.push(['first',...args]);return 'first-result'};
assert(api.nativePhoneQuaternion===identities.nativePhoneQuaternion,'legacy registration replaced stable nativePhoneQuaternion identity');
assert(api.nativePhoneQuaternion(1,2,3,4,90)==='first-result','stable delegate did not dispatch first implementation');
same(calls,[['first',1,2,3,4,90]],'first phone API implementation received wrong arguments');
const v1=service.compatibilityVersions().nativePhoneQuaternion;
assert(v1===1,'first legacy registration must increment nativePhoneQuaternion version to 1');

api.nativePhoneQuaternion=(...args)=>{calls.push(['second',...args]);return 'second-result'};
assert(api.nativePhoneQuaternion===identities.nativePhoneQuaternion,'second registration replaced stable nativePhoneQuaternion identity');
assert(api.nativePhoneQuaternion(5,6,7,8,180)==='second-result','stable delegate did not dispatch replacement implementation');
assert(service.compatibilityVersions().nativePhoneQuaternion===2,'second legacy registration must increment version to 2');
assert(service.registrationReasons().nativePhoneQuaternion==='legacy phone-icdu registration','legacy registration reason changed');

service.installImplementation('phoneSkyPointing',()=>({seen:true,az:12.5}),'test explicit service install');
assert(api.phoneSkyPointing===identities.phoneSkyPointing,'service install replaced stable phoneSkyPointing identity');
same(api.phoneSkyPointing(),{seen:true,az:12.5},'explicit service installation did not dispatch through public delegate');
assert(service.implementation('phoneSkyPointing')!==null,'phone API service failed to expose installed implementation');
assert(service.registrationReasons().phoneSkyPointing==='test explicit service install','explicit service install reason changed');

let threw=false;try{service.installImplementation('notARealPhoneApi',()=>{})}catch(_){threw=true}assert(threw,'unknown phone API implementation must be rejected');
threw=false;try{api.nativePipaSensorStatus=42}catch(_){threw=true}assert(threw,'non-function legacy phone API registration must be rejected');
for(const name of expected)assert(api[name]===identities[name],`stable phone API identity changed during smoke: ${name}`);

console.log('phone API runtime smoke: PASS');
console.log(`  ${expected.length} late phone/IMU/optics methods keep stable public identities while implementations register through AGCDSKY_PHONE`);
