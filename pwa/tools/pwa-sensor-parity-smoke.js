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
DeviceOrientationEvent.requestPermission = () => {
  orientationPermissionCalls++;
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

  const status = windowObject.AGCDSKYPWA.parityStatus();
  if (status.motion !== 'active') fail('motion capability did not become active');
  if (status.absoluteOrientation !== 'active') fail('absolute orientation capability did not become active');
  if (status.wakeLock !== 'active') fail('wake-lock capability did not become active');

  console.log('PWA sensor parity behavior: PASS');
  console.log('  wake lock, iOS permission gesture, PIPA motion, display rotation and absolute orientation verified');
})().catch(error => fail(error.stack || String(error)));
