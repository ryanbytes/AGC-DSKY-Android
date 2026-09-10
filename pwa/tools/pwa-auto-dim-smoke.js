#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.resolve(__dirname, '../static/pwa-auto-dim.js'), 'utf8');
const fail = message => { console.error('PWA AUTO DIM FAIL: ' + message); process.exit(1); };
const values = new Map();
const localStorage = {
  getItem(key){ return values.has(key) ? values.get(key) : null; },
  setItem(key,value){ values.set(key,String(value)); },
  removeItem(key){ values.delete(key); }
};
let filter = '';
let screenOnly = false;
const dskyElement = {style:{
  setProperty(name,value){ if(name==='filter') filter=value; },
  removeProperty(name){ if(name==='filter') filter=''; }
}};
const buttonElement = {textContent:'',addEventListener(){}};
const bodyElement = {classList:{contains(name){ return name==='screen-only' && screenOnly; }}};
const documentObject = {
  hidden:false,
  body:bodyElement,
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
class MutationObserver { constructor(fn){ this.fn=fn; } observe(){} }
const windowObject = {
  AGCDSKYPWA:{},
  AmbientLightSensor,
  MutationObserver,
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
if(typeof api.setAutoDimEnabled!=='function')fail('enabled API missing');
if(typeof api.setAutoDimMode!=='function')fail('mode API missing');
if(typeof api.luxDimFactor!=='function')fail('lux mapping API missing');
if(typeof api.solarDimFactor!=='function')fail('solar mapping API missing');
if(api.autoDimEnabled()!==false)fail('EL auto dim must default OFF');
if(sensorStarts!==0||locationCalls!==0)fail('disabled auto dim must not start sensors or request location');
if(filter!=='')fail('disabled auto dim must not alter full-panel brightness');
if(buttonElement.textContent!=='EL AUTO DIM OFF')fail('disabled option label incorrect');

api.setAutoDimEnabled(true);
if(sensorStarts!==0||locationCalls!==0)fail('enabled auto dim must remain dormant until isolated EL screen is active');
if(filter!=='')fail('full DSKY must not be dimmed when option is enabled');
if(!buttonElement.textContent.includes('SCREEN ONLY'))fail('enabled dormant option should identify screen-only scope');

screenOnly=true;
api.refreshAutoDim();
if(sensorStarts!==1)fail('ambient light sensor did not start when isolated EL screen became active');
if(locationCalls!==1)fail('solar location was not requested when isolated EL screen became active');
if(!Number.isFinite(Number(values.get('solarLat')))||!Number.isFinite(Number(values.get('solarLon'))))fail('solar coordinates were not stored');

if(Math.abs(api.luxDimFactor(0)-0)>1e-9)fail('0 lux must map to minimum factor');
if(api.luxDimFactor(10)<=api.luxDimFactor(1))fail('lux mapping must increase monotonically');
if(Math.abs(api.luxDimFactor(1000)-1)>1e-9)fail('1000 lux must reach full factor');

api.ingestAmbientLux(0);
let s=api.autoDimStatus();
if(!s.active||s.source!=='ambient'||Math.abs(s.brightness-.20)>1e-9)fail('dark ambient sample did not select 20% EL brightness');
if(!/brightness\(0\.200\)/.test(filter))fail('dark ambient sample did not update isolated EL filter');

screenOnly=false;
api.refreshAutoDim();
s=api.autoDimStatus();
if(s.active)fail('auto dim stayed active after leaving isolated EL screen');
if(filter!=='')fail('auto dim filter leaked onto full DSKY');

api.setAutoDimEnabled(false);
if(values.get('pwaElAutoDimEnabledV1')!=='0')fail('disabled preference was not persisted');
if(buttonElement.textContent!=='EL AUTO DIM OFF')fail('disabled option label did not restore');

console.log('PWA EL auto dim behavior: PASS');
console.log('  opt-in, screen-only gating, ambient lux, solar fallback and full-panel isolation verified');
