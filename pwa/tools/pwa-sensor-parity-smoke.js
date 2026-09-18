#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../static/pwa-sensor-parity.js'), 'utf8');
const fail = message => { console.error('PWA SENSOR PARITY FAIL: ' + message); process.exit(1); };
const windowHandlers = new Map();
const documentHandlers = new Map();
const calls = [];
let orientationPermissionCalls = 0;
const orientationPermissionArgs = [];
let motionPermissionCalls = 0;
let wakeLockCalls = 0;

function addHandler(map, name, fn) {
  if (!map.has(name)) map.set(name, []);
  map.get(name).push(fn);
}
function fire(map, name, event={}) {
  for (const fn of map.get(name) || []) fn(event);
}

const dsky = {
  nativePhoneLinearAcceleration(...args) { calls.push(['accel', ...args]); },
  nativePipaSensorStatus(...args) { calls.push(['pipa-status', ...args]); },
  nativeMagneticQuaternion(...args) { calls.push(['mag-q', ...args]); },
  nativeMagneticSensorStatus(...args) { calls.push(['mag-status', ...args]); }
};

const wakeSentinel = { addEventListener() {} };
const windowObject = {
  AGCDSKY: dsky,
  AGCDSKYPWA: {},
  orientation: 0,
  addEventListener(name, fn) { addHandler(windowHandlers, name, fn); },
  dispatchEvent() {}
};
const documentObject = {
  hidden: false,
  addEventListener(name, fn) { addHandler(documentHandlers, name, fn); }
};

function DeviceOrientationEvent() {}
DeviceOrientationEvent.requestPermission = absolute => {
  orientationPermissionCalls++;
  orientationPermissionArgs.push(absolute);
  return Promise.resolve('granted');
};
function DeviceMotionEvent() {}
DeviceMotionEvent.requestPermission = () => {
  motionPermissionCalls++;
  return Promise.resolve('granted');
};

const context = {
  window: windowObject,
  document: documentObject,
  navigator: {
    mediaDevices: {getUserMedia() {}},
    geolocation: {},
    wakeLock: {request: async kind => {
      if (kind !== 'screen') throw new Error('wrong wake-lock type');
      wakeLockCalls++;
      return wakeSentinel;
    }}
  },
  screen: {orientation: {angle: 90}},
  performance: {now: () => 1234.5},
  DeviceOrientationEvent,
  DeviceMotionEvent,
  CustomEvent: function CustomEvent(type, init) { this.type=type; this.detail=init && init.detail; },
  Promise,
  Math,
  Number,
  console,
  setTimeout,
  clearTimeout
};
windowObject.navigator = context.navigator;
windowObject.DeviceOrientationEvent = DeviceOrientationEvent;
windowObject.DeviceMotionEvent = DeviceMotionEvent;

try { vm.runInNewContext(source, context, {filename:'pwa-sensor-parity.js'}); }
catch (error) { fail('script execution failed: ' + error.stack); }

(async () => {
  // Give the initial async wake-lock request one turn to settle.
  await Promise.resolve();
  await Promise.resolve();
  if (wakeLockCalls < 1) fail('screen wake lock was not requested');

  fire(documentHandlers, 'pointerup', {});
  await Promise.resolve();
  await Promise.resolve();
  if (orientationPermissionCalls !== 1) fail('orientation permission was not requested from gesture');
  if (orientationPermissionArgs[0] !== true) fail('absolute/magnetometer orientation permission was not requested');
  if (motionPermissionCalls !== 1) fail('motion permission was not requested from same gesture');

  fire(windowHandlers, 'devicemotion', {
    acceleration: {x:1.25, y:-2.5, z:0.75},
    accelerationIncludingGravity: null
  });
  const pipaStatus = calls.find(c => c[0] === 'pipa-status');
  const accel = calls.find(c => c[0] === 'accel');
  if (!pipaStatus || pipaStatus[1] !== 'web-device-motion' || pipaStatus[2] !== true) fail('web PIPA sensor was not announced');
  if (!accel) fail('DeviceMotion sample was not forwarded to PIPA bridge');
  if (Math.abs(accel[1]-1.25)>1e-9 || Math.abs(accel[2]+2.5)>1e-9 || Math.abs(accel[3]-0.75)>1e-9) fail('DeviceMotion vector changed unexpectedly');
  if (accel[5] !== 90) fail('display rotation was not forwarded with motion sample');

  fire(windowHandlers, 'deviceorientationabsolute', {
    alpha: 25,
    beta: 10,
    gamma: -5,
    absolute: true,
    webkitCompassAccuracy: 15
  });
  const magStatus = calls.find(c => c[0] === 'mag-status');
  const magQ = calls.find(c => c[0] === 'mag-q');
  if (!magStatus || magStatus[1] !== 'web-absolute-orientation' || magStatus[2] !== true) fail('web absolute orientation was not announced');
  if (!magQ) fail('absolute orientation quaternion was not forwarded');
  const norm = Math.hypot(magQ[1],magQ[2],magQ[3],magQ[4]);
  if (Math.abs(norm-1)>1e-9) fail('absolute orientation quaternion is not normalized');
  if (magQ[5] !== 90) fail('display rotation was not forwarded with magnetic quaternion');
  if (magQ[6] !== 3) fail('browser compass accuracy was not mapped');

  // iOS/WebKit exposes real-world heading on ordinary deviceorientation via
  // webkitCompassHeading rather than deviceorientationabsolute.
  const beforeIosCompass = calls.filter(c => c[0] === 'mag-q').length;
  fire(windowHandlers, 'deviceorientation', {
    alpha: 12,
    beta: 82,
    gamma: 3,
    absolute: false,
    webkitCompassHeading: 90,
    webkitCompassAccuracy: 12
  });
  const afterIosCompass = calls.filter(c => c[0] === 'mag-q').length;
  if (afterIosCompass !== beforeIosCompass + 1) fail('iOS webkitCompassHeading path did not publish absolute orientation');

  fire(windowHandlers, 'deviceorientation', {
    alpha: 12,
    beta: 82,
    gamma: 3,
    absolute: false,
    webkitCompassHeading: -1,
    webkitCompassAccuracy: -1
  });
  if (calls.filter(c => c[0] === 'mag-q').length !== afterIosCompass) fail('invalid iOS compass heading was not rejected');

  const status = windowObject.AGCDSKYPWA.parityStatus();
  if (status.motion !== 'active') fail('motion capability did not become active');
  if (status.absoluteOrientation !== 'active') fail('absolute orientation capability did not become active');
  if (status.wakeLock !== 'active') fail('wake-lock capability did not become active');

  console.log('PWA sensor parity behavior: PASS');
  console.log('  wake lock, absolute compass permission, iOS compass heading, PIPA motion and display rotation verified');
})().catch(error => fail(error.stack || String(error)));
