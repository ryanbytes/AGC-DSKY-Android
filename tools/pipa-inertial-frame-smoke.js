#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/src/main/assets/phone-icdu.js'),'utf8');
const geomagneticSource=fs.readFileSync(path.join(root,'app/src/main/assets/geomagnetic-model.js'),'utf8');
const nativeActivity=fs.readFileSync(path.join(root,'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'),'utf8');
function assert(ok,message){if(!ok)throw new Error(message)}

assert(nativeActivity.includes('pushPhoneQuaternion(q,angle,event.timestamp)'),
  'Android attitude sensor event timestamp is not forwarded to the phone IMU bridge');
assert(nativeActivity.includes('nativePhoneQuaternion(%.9f,%.9f,%.9f,%.9f,%d,%.8f)'),
  'native phone IMU bridge does not send attitude timestamp to the production runtime');

function createHarness(screenAngle=0){
  const core={running:true,writes:[],writeIo(ch,value){this.writes.push([ch,value]);return 1}};
  const api={getCore:()=>core};
  const buttons=Object.fromEntries(['imu-zero','mag-lock','pipa-cal'].map(id=>[id,{textContent:'',title:''}]));
  let clickHandler=null,hidden=false;
  const documentListeners={},windowListeners={},intervals=[];
  const service={installImplementations(implementations){Object.assign(api,implementations)}};
  let geomagnetic=null;
  const registry={
    get(name){if(name==='AGCDSKY_PHONE')return service;if(name==='AGCDSKY_WMM2025')return geomagnetic;assert(false,`unexpected service requested: ${name}`)},
    publish(name,value){assert(name==='AGCDSKY_WMM2025','unexpected model service publication');geomagnetic=value}
  };
  const context={
    window:null,
    AGCDSKY:api,
    AGCDSKY_SERVICE_REGISTRY:registry,
    document:{get hidden(){return hidden},getElementById:id=>buttons[id]||null,addEventListener(name,handler){if(name==='click')clickHandler=handler;else documentListeners[name]=handler}},
    screen:{orientation:{angle:screenAngle}},
    performance:{now:()=>0},
    localStorage:{getItem:()=>null,setItem(){}},
    navigator:{},
    addEventListener(name,handler){windowListeners[name]=handler},
    setInterval(fn){intervals.push(fn);return intervals.length},
    clearInterval(){},
    Math,Number,Array,Object,String,Date,JSON,Set,Reflect,Error,TypeError
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(geomagneticSource,context,{filename:'geomagnetic-model.js'});
  vm.runInContext(source,context,{filename:'phone-icdu.js'});
  api.__buttons=buttons;
  api.__core=core;
  api.__setHidden=value=>{hidden=!!value;if(documentListeners.visibilitychange)documentListeners.visibilitychange()};
  api.__fireWindowEvent=(name,event)=>{if(windowListeners[name])windowListeners[name](event)};
  api.__tick=()=>intervals.forEach(fn=>fn());
  api.clickPipaCalibration=()=>{assert(clickHandler,'PIPA calibration click handler was not registered');clickHandler({target:{id:'pipa-cal'}})};
  return api;
}

function qMul(a,b){return [
  a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
  a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
  a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
  a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]
]}
function qConj(q){return [q[0],-q[1],-q[2],-q[3]]}
function qNorm(q){const n=Math.hypot(...q)||1;return q.map(value=>value/n)}
function qRotate(q,v){const [w,x,y,z]=q,[vx,vy,vz]=v,tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);return [vx+w*tx+(y*tz-z*ty),vy+w*ty+(z*tx-x*tz),vz+w*tz+(x*ty-y*tx)]}
function qAxisZ(degrees){return [Math.cos(degrees*Math.PI/360),0,0,Math.sin(degrees*Math.PI/360)]}
function qAxis(axis,degrees){const h=degrees*Math.PI/360,c=Math.cos(h),s=Math.sin(h);return axis==='x'?[c,s,0,0]:axis==='y'?[c,0,s,0]:[c,0,0,s]}
function sensorToScreen(v,degrees){const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [c*v[0]+s*v[1],-s*v[0]+c*v[1],v[2]]}

// Acceleration and attitude are separate Android sensor streams. Pair PIPA
// samples with the attitude at their event timestamp, not whichever attitude
// happened to be delivered most recently by the WebView bridge.
const timestampProbe=createHarness();
timestampProbe.nativePhoneQuaternion(1,0,0,0,0,1.00);
timestampProbe.nativePhoneQuaternion(...qAxisZ(90),0,1.10);
timestampProbe.nativePipaSensorStatus('test-linear-acceleration',true);
timestampProbe.nativePhoneLinearAcceleration(1,0,0,1.05,0);
const timestampState=timestampProbe.phoneIcduStatus().pipa;
assert(Math.abs(timestampState.acceleration.x-Math.SQRT1_2)<1e-9
    &&Math.abs(timestampState.acceleration.y-Math.SQRT1_2)<1e-9,
  `PIPA did not interpolate attitude at the acceleration event timestamp: ${JSON.stringify(timestampState.acceleration)}`);

// W3C DeviceOrientation stays in the device's standard-orientation frame.
// Verify its browser fallback maps natural device +X to each display's screen
// basis before turning that attitude change into the Apollo CDU axes.
for(const [displayAngle,expected] of [
  [0,{outer:10,inner:0,middle:0}],
  [90,{outer:0,inner:-10,middle:0}],
  [180,{outer:-10,inner:0,middle:0}],
  [270,{outer:0,inner:10,middle:0}]
]){
  const probe=createHarness(displayAngle);
  probe.__fireWindowEvent('deviceorientation',{alpha:0,beta:0,gamma:0});
  probe.__fireWindowEvent('deviceorientation',{alpha:0,beta:10,gamma:0});
  const attitude=probe.phoneIcduStatus().unwrappedDegrees;
  for(const axis of ['outer','inner','middle'])assert(Math.abs(attitude[axis]-expected[axis])<1e-6,
    `DeviceOrientation display rotation ${displayAngle} mapped device +X to wrong ${axis} CDU angle: ${attitude[axis]}`);
}

// Identical game and magnetic attitude streams must not create a yaw-drift
// correction merely because the phone started tilted or the display is rotated.
for(const displayAngle of [0,90,180,270]){
  const probe=createHarness(displayAngle);
  const base=qMul(qMul(qAxis('z',0),qAxis('y',30)),qAxis('x',20));
  const moved=qMul(qAxis('z',10),base);
  probe.nativeMagneticQuaternion(...base,displayAngle,3);
  probe.nativePhoneQuaternion(...base,displayAngle);
  probe.nativeMagneticQuaternion(...moved,displayAngle,3);
  probe.nativePhoneQuaternion(...moved,displayAngle);
  const correction=probe.phoneIcduStatus().magnetic.yawCorrection;
  assert(Math.abs(correction)<1e-12,
    `identical attitude sources created ${correction} degrees of magnetic correction at display rotation ${displayAngle}`);
}

const api=createHarness();

// A magnetic sensor is not true-north pointing until the shared WMM model has
// a supported date and fresh location. Android and browser paths use this same
// production correction service.
const pointingProbe=createHarness();
pointingProbe.nativeMagneticPointing(90,30,3);
assert(!pointingProbe.phoneSkyPointing().seen,'magnetic azimuth was presented as true north before location/model data arrived');
pointingProbe.nativeMagneticQuaternion(1,0,0,0,0,3);
assert(!pointingProbe.phoneSkyPointing().seen,'absolute magnetic quaternion was presented as true north before declination was known');
let skyStatus=pointingProbe.updateSkyLocation(39.77,-86.16,250,new Date(Date.UTC(2026,6,4)));
assert(skyStatus.reference?.model==='WMM2025'&&Math.abs(skyStatus.declination-(-5.025))<.01,
  `shared sky reference did not use WMM2025: ${JSON.stringify(skyStatus)}`);
pointingProbe.nativeMagneticPointing(90,30,3);
assert(Math.abs(pointingProbe.phoneSkyPointing().az-(90+skyStatus.declination))<1e-9,
  'native magnetic azimuth did not receive the shared true-north correction');
let calibration=pointingProbe.calibrateSkyBoresight(90,30,'NOAA VECTOR');
assert(calibration.ok&&calibration.calibration.schema===2&&calibration.calibration.model==='WMM2025',
  'star calibration did not record the current WMM model identity');
let projected=pointingProbe.projectSkyTarget(90,30);
assert(projected?.calibrated&&projected.distance<1e-6,
  'calibrated target was not projected at its star-reference location');
pointingProbe.nativeMagneticQuaternion(1,0,0,0,0,0);
skyStatus=pointingProbe.skyCalibrationStatus();
assert(skyStatus.stale&&skyStatus.reason==='orientation-unreliable'
    &&!pointingProbe.projectSkyTarget(90,30).calibrated,
  'saved calibration remained confident after the orientation sensor reported UNRELIABLE');
calibration=pointingProbe.calibrateSkyBoresight(90,30,'UNRELIABLE SENSOR');
assert(!calibration.ok&&calibration.error.includes('UNRELIABLE'),
  'boresight recalibration was accepted while absolute orientation was UNRELIABLE');
pointingProbe.nativeMagneticQuaternion(1,0,0,0,0,-1);
assert(pointingProbe.skyCalibrationStatus().reason==='orientation-unreliable'
    &&!pointingProbe.calibrateSkyBoresight(90,30,'NO CONTACT').ok,
  'nonpositive absolute-orientation status was treated as usable compass data');
pointingProbe.nativeMagneticQuaternion(1,0,0,0,0,3);
assert(pointingProbe.skyCalibrationStatus().calibrated,
  'valid saved calibration did not recover after orientation accuracy became reliable');
skyStatus=pointingProbe.updateSkyLocation(40,-75,250,new Date(Date.UTC(2026,6,4)));
assert(skyStatus.stale&&skyStatus.reason==='magnetic-reference-shifted'
    &&!pointingProbe.projectSkyTarget(90,30).calibrated,
  'calibration was kept confident after the WMM reference shifted materially');
skyStatus=pointingProbe.updateSkyLocation(39.77,-86.16,250,new Date(Date.UTC(2026,6,4)));
assert(skyStatus.calibrated,'returning to the calibration reference did not restore the valid calibration');
skyStatus=pointingProbe.updateSkyLocation(39.77,-86.16,250,new Date(Date.UTC(2030,0,1)));
assert(skyStatus.stale&&skyStatus.reason==='location-or-date-unavailable'
    &&!pointingProbe.phoneSkyPointing().seen,
  'expired WMM model date retained a true-north pointing result');

const cautionProbe=createHarness();
cautionProbe.updateSkyLocation(80,-110,250,new Date(Date.UTC(2026,6,4)));
cautionProbe.nativeMagneticQuaternion(1,0,0,0,0,3);
assert(!cautionProbe.calibrateSkyBoresight(0,0).ok,
  'boresight calibration was allowed in a WMM caution zone');

// Sensor availability must not silently calibrate while the phone may be
// moving. PIPA integration remains disabled until the user starts calibration.
api.nativePhoneQuaternion(1,0,0,0,0);
api.nativePipaSensorStatus('test-linear-acceleration',true);
const bias=[0.12,-0.03,0.04];
for(let i=0;i<6;i++)api.nativePhoneLinearAcceleration(1,-2,0.5,0.1+i*0.02,0);
let state=api.phoneIcduStatus().pipa;
assert(!state.calibrated&&state.calRemaining===0,'PIPA calibration started automatically on sensor availability');
assert(state.pending.x===0&&state.pending.y===0&&state.pending.z===0,'uncalibrated acceleration generated PIPA increments');
assert(buttonFor(api).textContent==='PIPA CALIBRATE','uncalibrated phone did not expose the explicit calibration action');
api.clickPipaCalibration();
for(let i=0;i<60;i++)api.nativePhoneLinearAcceleration(...bias,1+i*0.02,0);
state=api.phoneIcduStatus().pipa;
assert(state.calibrated&&state.calRemaining===0,'PIPA bias calibration did not finish');
assert(buttonFor(api).textContent==='PIPA RECALIBRATE','completed PIPA calibration state was not reflected in its control');
for(const axis of ['x','y','z'])assert(Math.abs(state.biasDevice[axis]-bias[['x','y','z'].indexOf(axis)])<1e-12,
  `calibration did not preserve device-axis ${axis} bias`);

// Rotate the handset 90 degrees with no real linear acceleration. A fixed
// sensor bias must rotate into the same stable-platform frame as the sample,
// producing no simulated PIPA increments.
const half=Math.SQRT1_2;
api.nativePhoneQuaternion(half,0,0,half,0);
for(let i=1;i<=12;i++)api.nativePhoneLinearAcceleration(...bias,2.2+i*0.05,0);
state=api.phoneIcduStatus().pipa;
for(const axis of ['x','y','z']){
  assert(state.pending[axis]===0,`sensor bias created false ${axis.toUpperCase()} PIPA pulses: ${state.pending[axis]}`);
  assert(Math.abs(state.fractional[axis])<1e-9,`sensor bias accumulated false ${axis.toUpperCase()} fractional PIPA delta-V: ${state.fractional[axis]}`);
}

// A real +X stable-frame acceleration is -Y in the device frame after that
// rotation. The corrected input should therefore accumulate only X pulses.
api.nativePhoneLinearAcceleration(bias[0],bias[1]-1,bias[2],2.85,0);
api.nativePhoneLinearAcceleration(bias[0],bias[1]-1,bias[2],2.90,0);
state=api.phoneIcduStatus().pipa;
assert(state.pending.x===1,'stable-frame +X acceleration did not generate the expected first PIPA increment');
assert(state.pending.y===0&&state.pending.z===0,'stable-frame +X acceleration leaked into another PIPA axis');

// Device-frame +Y maps to stable-frame -X in the same attitude. A stronger
// reverse acceleration should create negative X increments only.
api.nativePhoneLinearAcceleration(bias[0],bias[1]+2,bias[2],2.95,0);
api.nativePhoneLinearAcceleration(bias[0],bias[1]+2,bias[2],3.00,0);
state=api.phoneIcduStatus().pipa;
assert(state.pending.x===-1,'stable-frame -X acceleration did not generate a negative PIPAX increment');
assert(state.pending.y===0&&state.pending.z===0,'stable-frame -X acceleration leaked into another PIPA axis');
assert(Math.abs(state.pending.x+state.fractional.x+0.1/0.0585)<1e-9,
  'positive/negative PIPA delta-V did not conserve the source-backed 5.85 cm/s increment scale');

// Accepted sensor intervals are elapsed event time. Do not silently integrate
// only 50 ms when Android delivers a slower (but still accepted) event.
const intervalProbe=createHarness();
intervalProbe.nativePhoneQuaternion(1,0,0,0,0);
intervalProbe.nativePipaSensorStatus('test-linear-acceleration',true);
intervalProbe.clickPipaCalibration();
for(let i=0;i<60;i++)intervalProbe.nativePhoneLinearAcceleration(0,0,0,1+i*0.02,0);
intervalProbe.nativePhoneLinearAcceleration(0,0,0,2.20,0);
intervalProbe.nativePhoneLinearAcceleration(1,0,0,2.30,0);
let intervalState=intervalProbe.phoneIcduStatus().pipa;
assert(Math.abs(intervalState.pending.x+intervalState.fractional.x-0.1/0.0585)<1e-9,
  '100 ms accepted PIPA interval discarded acceleration beyond 50 ms');
intervalProbe.nativePhoneLinearAcceleration(1,0,0,2.50,0);
intervalState=intervalProbe.phoneIcduStatus().pipa;
assert(Math.abs(intervalState.pending.x+intervalState.fractional.x-0.3/0.0585)<1e-9,
  '200 ms accepted PIPA interval discarded acceleration beyond 50 ms');
intervalProbe.nativePhoneLinearAcceleration(100,0,0,2.45,0);
intervalProbe.nativePhoneLinearAcceleration(1,0,0,2.55,0);
intervalState=intervalProbe.phoneIcduStatus().pipa;
assert(Math.abs(intervalState.pending.x+intervalState.fractional.x-0.35/0.0585)<1e-9,
  'out-of-order PIPA timestamp moved the integration baseline backward');

// Verify the production pump emits the CM PIPA channels with the proper PINC /
// MINC sense, and retries a ring-buffer rejection without losing a pulse.
const transportProbe=createHarness();
transportProbe.nativePhoneQuaternion(1,0,0,0,0);
transportProbe.nativePipaSensorStatus('test-linear-acceleration',true);
transportProbe.clickPipaCalibration();
for(let i=0;i<60;i++)transportProbe.nativePhoneLinearAcceleration(0,0,0,1+i*0.02,0);
transportProbe.nativePhoneLinearAcceleration(0,0,0,2.20,0);
transportProbe.nativePhoneLinearAcceleration(1,-1,2,2.25,0);
transportProbe.nativePhoneLinearAcceleration(1,-1,2,2.30,0);
const transportAttempts=[];
const transportCore=transportProbe.__core;
let rejectFirstPositiveX=true;
transportCore.writeIo=(channel,value)=>{
  transportAttempts.push([channel,value]);
  if(channel===0o237&&rejectFirstPositiveX){rejectFirstPositiveX=false;return 0}
  transportCore.writes.push([channel,value]);
  return 1;
};
transportProbe.__tick();
let transportState=transportProbe.phoneIcduStatus().pipa;
assert(transportState.pending.x===1&&transportState.pending.y===0&&transportState.pending.z===0,
  'rejected PIPAX increment was dropped or blocked unrelated PIPA axes');
transportProbe.__tick();
transportState=transportProbe.phoneIcduStatus().pipa;
assert(transportState.pending.x===0&&transportState.pending.y===0&&transportState.pending.z===0,
  'accepted PIPA retry did not drain its pending increment');
assert(transportCore.writes.filter(([channel])=>channel===0o237).length===1,
  'PIPAX ring-buffer retry did not emit exactly one accepted pulse');
assert(transportCore.writes.filter(([channel,value])=>channel===0o240&&value===0o02).length===1,
  'negative stable-frame Y did not emit one PIPAY MINC');
assert(transportCore.writes.filter(([channel,value])=>channel===0o241&&value===0o00).length===3,
  'positive stable-frame Z did not emit three PIPAZ PINC pulses');

// Android's documented ROTATION_90 remap uses AXIS_Y and AXIS_MINUS_X:
// device +X therefore maps to screen -Y, and device +Y maps to screen +X.
// Assert the basis mapping independently of the production rotation helper.
for(const [angle,expectedX,expectedY] of [[0,[1,0,0],[0,1,0]],[90,[0,-1,0],[1,0,0]],[180,[-1,0,0],[0,-1,0]],[270,[0,1,0],[-1,0,0]]]){
  const actualX=sensorToScreen([1,0,0],angle),actualY=sensorToScreen([0,1,0],angle);
  for(let axis=0;axis<3;axis++){
    assert(Math.abs(actualX[axis]-expectedX[axis])<1e-12,`display ${angle} mapped device +X incorrectly`);
    assert(Math.abs(actualY[axis]-expectedY[axis])<1e-12,`display ${angle} mapped device +Y incorrectly`);
  }
}

// Verify the production bridge, not just this fixture helper, applies the
// Android 90-degree basis mapping to actual PIPA samples.
const landscapeProbe=createHarness(90);
landscapeProbe.nativePhoneQuaternion(1,0,0,0,90);
landscapeProbe.nativePipaSensorStatus('test-linear-acceleration',true);
landscapeProbe.clickPipaCalibration();
for(let i=0;i<60;i++)landscapeProbe.nativePhoneLinearAcceleration(0,0,0,1+i*0.02,90);
landscapeProbe.nativePhoneLinearAcceleration(1,0,0,2.3,90);
let landscapeState=landscapeProbe.phoneIcduStatus().pipa;
assert(Math.abs(landscapeState.acceleration.x)<1e-12&&Math.abs(landscapeState.acceleration.y+1)<1e-12,
  'production PIPA path did not map device +X to screen -Y at Android ROTATION_90');
landscapeProbe.nativePhoneLinearAcceleration(0,1,0,2.32,90);
landscapeState=landscapeProbe.phoneIcduStatus().pipa;
assert(Math.abs(landscapeState.acceleration.x-1)<1e-12&&Math.abs(landscapeState.acceleration.y)<1e-12,
  'production PIPA path did not map device +Y to screen +X at Android ROTATION_90');

// Exercise compound pitch/roll/yaw under every Android display rotation. Each
// fixture calibrates in device coordinates, then independently transforms a
// fixed bias and a known stable-frame acceleration back into device axes.
const biasProbe=[0.08,-0.045,0.027];
const orientation=qNorm(qMul(qMul(qAxis('z',61),qAxis('x',-37)),qAxis('y',23)));
for(const angle of [0,90,180,270]){
  const probe=createHarness(angle),baseQ=qNorm(qAxisZ(angle));
  probe.nativePhoneQuaternion(1,0,0,0,angle);
  probe.nativePipaSensorStatus('test-linear-acceleration',true);
  probe.clickPipaCalibration();
  for(let i=0;i<60;i++)probe.nativePhoneLinearAcceleration(...biasProbe,1+i*0.02,angle);
  const calibrated=probe.phoneIcduStatus().pipa;
  assert(calibrated.calibrated,`PIPA calibration failed at display rotation ${angle}`);

  probe.nativePhoneQuaternion(...orientation,angle);
  probe.nativePhoneLinearAcceleration(...biasProbe,3.2,angle);
  probe.nativePhoneLinearAcceleration(...biasProbe,3.25,angle);
  let rotated=probe.phoneIcduStatus().pipa;
  for(const axis of ['x','y','z']){
    assert(rotated.pending[axis]===0,`compound attitude/display ${angle} created false ${axis.toUpperCase()} pulses`);
    assert(Math.abs(rotated.fractional[axis])<1e-9,`compound attitude/display ${angle} left false ${axis.toUpperCase()} delta-V`);
  }

  const currentQ=qNorm(qMul(orientation,qAxisZ(angle)));
  const relativeQ=qNorm(qMul(qConj(baseQ),currentQ));
  const stableAcceleration=[1.18,0,0];
  const screenAcceleration=qRotate(qConj(relativeQ),stableAcceleration);
  const deviceAcceleration=sensorToScreen(screenAcceleration,-angle);
  const sample=biasProbe.map((value,index)=>value+deviceAcceleration[index]);
  probe.nativePhoneLinearAcceleration(...sample,3.30,angle);
  probe.nativePhoneLinearAcceleration(...sample,3.35,angle);
  rotated=probe.phoneIcduStatus().pipa;
  assert(rotated.pending.x===2,`stable +X failed under compound attitude/display ${angle}: ${rotated.pending.x}`);
  assert(rotated.pending.y===0&&rotated.pending.z===0,`stable +X leaked axes under compound attitude/display ${angle}`);
  assert(Math.abs(rotated.pending.x+rotated.fractional.x-1.18*0.1/0.0585)<1e-8,
    `display ${angle} failed PIPA delta-V conservation`);
  assert(rotated.pending.y===0&&rotated.pending.z===0&&Math.abs(rotated.fractional.y)<1e-8&&Math.abs(rotated.fractional.z)<1e-8,
    `display ${angle} leaked stable +X into a fractional off-axis PIPA`);
}

// Motion accumulated while the app is hidden must not be injected into the
// AGC when Android/WebView resumes without delivering background sensor events.
const resumeProbe=createHarness();
resumeProbe.nativePhoneQuaternion(1,0,0,0,0);
resumeProbe.__core.running=false;
resumeProbe.__setHidden(true);
const pausedAngle=20*Math.PI/360;
resumeProbe.nativePhoneQuaternion(Math.cos(pausedAngle),Math.sin(pausedAngle),0,0,0);
resumeProbe.__setHidden(false);
resumeProbe.__core.running=true;
resumeProbe.nativePhoneQuaternion(Math.cos(pausedAngle),Math.sin(pausedAngle),0,0,0);
let resumed=resumeProbe.phoneIcduStatus();
assert(resumed.pending.x===0&&resumed.pending.y===0&&resumed.pending.z===0,
  'orientation change while hidden created a resumed CDU pulse backlog');
resumeProbe.__tick();
assert(resumeProbe.__core.writes.length===0,'hidden-period orientation was emitted to yaAGC after resume');

// Sensor loss also drops buffered PIPA increments instead of replaying them
// when the acceleration source registers again.
const pipaResumeProbe=createHarness();
pipaResumeProbe.nativePhoneQuaternion(1,0,0,0,0);
pipaResumeProbe.nativePipaSensorStatus('test-linear-acceleration',true);
pipaResumeProbe.clickPipaCalibration();
for(let i=0;i<60;i++)pipaResumeProbe.nativePhoneLinearAcceleration(0,0,0,1+i*0.02,0);
pipaResumeProbe.nativePhoneLinearAcceleration(0,0,0,2.20,0);
pipaResumeProbe.nativePhoneLinearAcceleration(1,0,0,2.25,0);
pipaResumeProbe.nativePhoneLinearAcceleration(1,0,0,2.30,0);
let pipaResume=pipaResumeProbe.phoneIcduStatus().pipa;
assert(pipaResume.pending.x===1,'PIPA lifecycle fixture did not create a buffered increment');
pipaResumeProbe.nativePipaSensorStatus('test-linear-acceleration',false);
pipaResume=pipaResumeProbe.phoneIcduStatus().pipa;
assert(pipaResume.pending.x===0&&pipaResume.pending.y===0&&pipaResume.pending.z===0,
  'lost PIPA sensor retained buffered increments');
assert(pipaResume.fractional.x===0&&pipaResume.fractional.y===0&&pipaResume.fractional.z===0,
  'lost PIPA sensor retained a partial delta-V interval');

console.log('PIPA inertial-frame smoke: PASS');
console.log('  rotating bias cancellation, stable-frame axis mapping, bidirectional increments, and CM pulse scale verified');
console.log('  attitude/acceleration timestamp interpolation, compound attitude, all display rotations, variable event intervals, out-of-order timestamps, PINC/MINC transport, backpressure retry, lifecycle rebasing, and PIPA sensor-loss clearing verified');

function buttonFor(harnessApi){return harnessApi.__buttons['pipa-cal']}
