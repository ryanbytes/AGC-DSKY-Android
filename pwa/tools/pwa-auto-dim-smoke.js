#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../static/pwa-auto-dim.js'), 'utf8');
const fail = message => { console.error('PWA AUTO DIM FAIL: ' + message); process.exit(1); };
const values = new Map([['pwaAutoDimModeV1','auto']]);
const localStorage = {
  getItem(key){ return values.has(key) ? values.get(key) : null; },
  setItem(key,value){ values.set(key,String(value)); },
  removeItem(key){ values.delete(key); }
};
let filter = '';
const dskyElement = {style:{setProperty(name,value){ if(name==='filter') filter=value; }}};
const buttonElement = {textContent:'',addEventListener(){}};
const documentObject = {
  hidden:false,
  getElementById(id){ return id==='dsky' ? dskyElement : id==='dreambright' ? buttonElement : null; },
  addEventListener(){}
};
let sensorStarts=0;
class AmbientLightSensor {
  constructor(){ this.illuminance=0; this.handlers={}; }
  addEventListener(name,fn){ this.handlers[name]=fn; }
  start(){ sensorStarts++; }
}
let locationCalls=0;
const navigatorObject = {
  geolocation:{getCurrentPosition(success){ locationCalls++; success({coords:{latitude:40.8,longitude:-85.8}}); }}
};
const windowObject = {
  AGCDSKYPWA:{},
  AmbientLightSensor,
  dispatchEvent(){},
  addEventListener(){},
  navigator:navigatorObject
};
const context = {
  window:windowObject,
  document:documentObject,
  navigator:navigatorObject,
  localStorage,
  CustomEvent:function CustomEvent(type,init){this.type=type;this.detail=init&&init.detail;},
  Date,Math,Number,Promise,console,
  setInterval(){return 1;},
  clearInterval(){},
  queueMicrotask(fn){fn();}
};

try { vm.runInNewContext(source,context,{filename:'pwa-auto-dim.js'}); }
catch(error){ fail('script execution failed: '+error.stack); }

const api=windowObject.AGCDSKYPWA;
if(typeof api.autoDimStatus!=='function')fail('status API missing');
if(typeof api.setAutoDimMode!=='function')fail('mode API missing');
if(typeof api.luxDimFactor!=='function')fail('lux mapping API missing');
if(typeof api.solarDimFactor!=='function')fail('solar mapping API missing');
if(sensorStarts!==1)fail('ambient light sensor was not started in AUTO mode');
if(locationCalls!==1)fail('solar location was not requested in AUTO mode');
if(!Number.isFinite(Number(values.get('solarLat')))||!Number.isFinite(Number(values.get('solarLon'))))fail('solar coordinates were not stored');

if(Math.abs(api.luxDimFactor(0)-0)>1e-9)fail('0 lux must map to minimum factor');
if(api.luxDimFactor(10)<=api.luxDimFactor(1))fail('lux mapping must increase monotonically');
if(Math.abs(api.luxDimFactor(1000)-1)>1e-9)fail('1000 lux must reach full factor');

api.ingestAmbientLux(0);
let s=api.autoDimStatus();
if(s.source!=='ambient'||Math.abs(s.brightness-.20)>1e-9)fail('dark ambient sample did not select 20% minimum');
if(!/brightness\(0\.200\)/.test(filter))fail('dark ambient sample did not update DSKY filter');

api.setAutoDimMode('bright');
s=api.autoDimStatus();
if(s.source!=='bright'||Math.abs(s.brightness-1)>1e-9)fail('BRIGHT mode is not full brightness');
api.setAutoDimMode('dim');
s=api.autoDimStatus();
if(s.source!=='dim'||Math.abs(s.brightness-.20)>1e-9)fail('DIM mode is not minimum brightness');
api.setAutoDimMode('auto');
if(!buttonElement.textContent.startsWith('AUTO DIM'))fail('PWA brightness control was not relabeled');
const solar=api.solarDimFactor();
if(!Number.isFinite(solar)||solar<0||solar>1)fail('stored location did not produce a valid solar factor');

console.log('PWA auto dim behavior: PASS');
console.log('  ambient lux mapping, solar-location fallback, fixed modes and DSKY brightness filter verified');
