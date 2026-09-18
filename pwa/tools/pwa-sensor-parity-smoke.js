#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../static/pwa-sensor-parity.js'), 'utf8');
const fail = message => { console.error('PWA SENSOR PARITY FAIL: ' + message); process.exit(1); };
const assert = (condition, message) => { if (!condition) fail(message); };

function handlerMap() { return new Map(); }
function addHandler(map, name, fn) {
  if (!map.has(name)) map.set(name, []);
  map.get(name).push(fn);
}
function fire(map, name, event={}) {
  for (const fn of map.get(name) || []) fn(event);
}

function baseContext({navigator, dsky, extraWindow={}}) {
  const windowHandlers = handlerMap();
  const documentHandlers = handlerMap();
  const wakeSentinel = { addEventListener() {} };
  let wakeLockCalls = 0;
  const windowObject = {
    AGCDSKY: dsky,
    AGCDSKYPWA: {},
    orientation: 0,
    addEventListener(name, fn) { addHandler(windowHandlers, name, fn); },
    dispatchEvent() {},
    ...extraWindow
  };
  const documentObject = {
    hidden: false,
    addEventListener(name, fn) { addHandler(documentHandlers, name, fn); }
  };
  navigator.wakeLock = {request: async kind => {
    if (kind !== 'screen') throw new Error('wrong wake-lock type');
    wakeLockCalls++;
    return wakeSentinel;
  }};
  const context = {
    window: windowObject,
    document: documentObject,
    navigator,
    screen: {orientation: {angle: 90}},
    performance: {now: () => 1234.5},
    CustomEvent: function CustomEvent(type, init) { this.type=type; this.detail=init && init.detail; },
    Promise, Math, Number, Array, String, console, setTimeout, clearTimeout
  };
  Object.assign(context, extraWindow);
  windowObject.navigator = navigator;
  return {context, windowObject, windowHandlers, documentHandlers, getWakeLockCalls:()=>wakeLockCalls};
}

async function runIosWebKitScenario() {
  const calls = [];
  let orientationPermissionCalls = 0;
  const orientationArgs = [];
  let motionPermissionCalls = 0;

  function DeviceOrientationEvent() {}
  DeviceOrientationEvent.requestPermission = (...args) => {
    orientationPermissionCalls++;
    orientationArgs.push(args);
    return Promise.resolve('granted');
  };
  function DeviceMotionEvent() {}
  DeviceMotionEvent.requestPermission = () => {
    motionPermissionCalls++;
    return Promise.resolve('granted');
  };

  const dsky = {
    nativePhoneLinearAcceleration(...args) { calls.push(['accel', ...args]); },
    nativePipaSensorStatus(...args) { calls.push(['pipa-status', ...args]); },
    nativeMagneticQuaternion(...args) { calls.push(['mag-q', ...args]); },
    nativeMagneticSensorStatus(...args) { calls.push(['mag-status', ...args]); }
  };
  const navigator = {
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
    platform:'iPhone',
    maxTouchPoints:5,
    mediaDevices:{getUserMedia(){}},
    geolocation:{}
  };
  const h=baseContext({navigator,dsky,extraWindow:{DeviceOrientationEvent,DeviceMotionEvent}});
  vm.runInNewContext(source,h.context,{filename:'pwa-sensor-parity.js'});

  await Promise.resolve(); await Promise.resolve();
  assert(h.getWakeLockCalls()>=1,'screen wake lock was not requested');

  fire(h.documentHandlers,'pointerup',{});
  await Promise.resolve(); await Promise.resolve();
  assert(orientationPermissionCalls===0&&motionPermissionCalls===0,'arbitrary first gesture triggered sensor prompt');

  await h.windowObject.AGCDSKYPWA.requestSensorPermissions({absolute:true});
  assert(orientationPermissionCalls===1,'iOS orientation permission was not requested');
  assert(orientationArgs[0].length===0,'iOS WebKit must use ordinary orientation permission');
  assert(motionPermissionCalls===1,'iOS motion permission was not requested');

  fire(h.windowHandlers,'deviceorientation',{
    alpha:12,beta:82,gamma:3,absolute:false,webkitCompassHeading:90,webkitCompassAccuracy:12
  });
  assert(calls.some(c=>c[0]==='mag-q'),'iOS webkitCompassHeading did not publish magnetic quaternion');

  const status=h.windowObject.AGCDSKYPWA.parityStatus();
  assert(status.absoluteOrientation==='active','iOS absolute orientation did not become active');
}

async function runAndroidGenericScenario() {
  const calls=[];
  const instances={absolute:[],relative:[],linear:[]};

  class FakeSensor {
    constructor(){this.handlers=new Map();this.timestamp=2000;}
    addEventListener(name,fn){addHandler(this.handlers,name,fn);}
    start(){this.started=true;}
    emit(name,event={}){fire(this.handlers,name,event);}
  }
  class AbsoluteOrientationSensor extends FakeSensor {
    constructor(options){super();this.options=options;this.quaternion=[0,0,0,1];instances.absolute.push(this);}
  }
  class RelativeOrientationSensor extends FakeSensor {
    constructor(options){super();this.options=options;this.quaternion=[0,0,0,1];instances.relative.push(this);}
  }
  class LinearAccelerationSensor extends FakeSensor {
    constructor(options){super();this.options=options;this.x=1.25;this.y=-2.5;this.z=.75;instances.linear.push(this);}
  }
  function DeviceOrientationEvent() {}
  function DeviceMotionEvent() {}

  const dsky={
    nativePhoneQuaternion(...args){calls.push(['phone-q',...args]);},
    nativePhoneSensorStatus(...args){calls.push(['phone-status',...args]);},
    nativePhoneLinearAcceleration(...args){calls.push(['accel',...args]);},
    nativePipaSensorStatus(...args){calls.push(['pipa-status',...args]);},
    nativeMagneticQuaternion(...args){calls.push(['mag-q',...args]);},
    nativeMagneticSensorStatus(...args){calls.push(['mag-status',...args]);}
  };
  const navigator={
    userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 9a) AppleWebKit/537.36 Chrome/152.0 Mobile Safari/537.36',
    platform:'Linux armv8l',
    maxTouchPoints:5,
    brave:{isBrave:async()=>true},
    mediaDevices:{getUserMedia(){}},
    geolocation:{}
  };
  const extraWindow={DeviceOrientationEvent,DeviceMotionEvent,AbsoluteOrientationSensor,RelativeOrientationSensor,LinearAccelerationSensor};
  const h=baseContext({navigator,dsky,extraWindow});
  vm.runInNewContext(source,h.context,{filename:'pwa-sensor-parity.js'});

  await h.windowObject.AGCDSKYPWA.requestSensorPermissions({absolute:true});
  assert(instances.absolute.length===1&&instances.absolute[0].started,'Android absolute generic sensor did not start');
  assert(instances.relative.length===1&&instances.relative[0].started,'Android relative generic sensor did not start');
  assert(instances.linear.length===1&&instances.linear[0].started,'Android linear acceleration sensor did not start');

  instances.absolute[0].emit('reading');
  instances.relative[0].emit('reading');
  instances.linear[0].emit('reading');

  const mag=calls.find(c=>c[0]==='mag-q');
  assert(!!mag,'Android generic absolute sensor did not feed magnetic bridge');
  assert(mag[1]===1&&mag[2]===0&&mag[3]===0&&mag[4]===0,'Generic Sensor quaternion order was not converted from xyzw to wxyz');
  assert(calls.some(c=>c[0]==='mag-status'&&c[1]==='web-absolute-orientation-sensor'),'Android generic absolute sensor was not announced');
  assert(calls.some(c=>c[0]==='phone-q'),'Android generic relative sensor did not feed phone quaternion');
  assert(calls.some(c=>c[0]==='phone-status'&&c[1]==='web-relative-orientation-sensor'),'Android generic relative sensor was not announced');
  const accel=calls.find(c=>c[0]==='accel');
  assert(!!accel&&Math.abs(accel[1]-1.25)<1e-9&&Math.abs(accel[2]+2.5)<1e-9,'Android linear acceleration sensor did not feed PIPA bridge');

  const status=h.windowObject.AGCDSKYPWA.parityStatus();
  assert(status.browser==='brave-android','Brave Android was not detected');
  assert(status.genericAbsolute==='active'&&status.absoluteOrientation==='active','Android generic absolute orientation did not become active');
  assert(status.genericRelative==='active'&&status.orientation==='active','Android generic relative orientation did not become active');
  assert(status.genericLinearAcceleration==='active'&&status.motion==='active','Android generic acceleration did not become active');
}

(async()=>{
  assert(source.includes('new window.AbsoluteOrientationSensor'),'generic absolute-orientation fallback missing');
  assert(source.includes('new window.RelativeOrientationSensor'),'generic relative-orientation fallback missing');
  assert(source.includes('new window.LinearAccelerationSensor'),'generic acceleration fallback missing');
  await runIosWebKitScenario();
  await runAndroidGenericScenario();
  console.log('PWA sensor parity behavior: PASS');
  console.log('  iOS WebKit compass and Brave Android Generic Sensor fallbacks verified');
})().catch(error=>fail(error.stack||String(error)));
