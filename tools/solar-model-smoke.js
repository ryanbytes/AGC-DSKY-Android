#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const ENV_JS = path.join(ASSETS, 'display-environment.js');
const SHELL_JS = path.join(ASSETS, 'app-shell-runtime.js');
const API_JS = path.join(ASSETS, 'agc-api-runtime.js');
const source = fs.readFileSync(ENV_JS, 'utf8');
const shell = fs.readFileSync(SHELL_JS, 'utf8');
const api = fs.readFileSync(API_JS, 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }
function close(actual, expected, tolerance, message) { assert(Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`); }

const start = source.indexOf('const DAY_MS=86400000');
const end = source.indexOf('function requestSolarLocation()');
assert(start >= 0 && end > start, 'could not isolate production solar-model functions from display-environment.js');
for (const token of ['const DAY_MS=86400000','function solarTimes(']) assert(!shell.includes(token)&&!api.includes(token), `non-environment runtime regained solar ownership: ${token}`);
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');

const solarSource = source.slice(start, end) + '\nglobalThis.__solarModel={solarTimes,currentSolarFactor,hourAngle,smoothstep};';
function fixedDateClass(nowIso) { const RealDate=Date,fixedMs=RealDate.parse(nowIso);assert(Number.isFinite(fixedMs),`invalid fixed date for test: ${nowIso}`);return class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixedMs]))}static now(){return fixedMs}}; }
function loadModel(nowIso, lat=null, lon=null) { const storage=new Map();if(lat!==null)storage.set('solarLat',String(lat));if(lon!==null)storage.set('solarLon',String(lon));const FixedDate=fixedDateClass(nowIso);const context={Math,Number,parseFloat,Date:FixedDate,accurateDate(){return new FixedDate()},store:{get(key){return storage.has(key)?storage.get(key):null}}};context.globalThis=context;vm.createContext(context);vm.runInContext(solarSource,context,{filename:'display-environment.js:solar-model'});return context.__solarModel; }
function daylightHours(times){return(times.sunset.getTime()-times.sunrise.getTime())/3600000}

const equinox=loadModel('2026-03-20T12:00:00Z');const equinoxTimes=equinox.solarTimes(new Date('2026-03-20T12:00:00Z'),0,0);assert(equinoxTimes&&equinoxTimes.sunrise instanceof Date&&equinoxTimes.sunset instanceof Date,'equatorial equinox must produce sunrise and sunset timestamps');const equinoxDaylight=daylightHours(equinoxTimes);assert(equinoxDaylight>12.0&&equinoxDaylight<12.3,`equatorial daylight implausible: ${equinoxDaylight} h`);
const polarSummer=loadModel('2026-06-21T12:00:00Z',80,0);assert(polarSummer.solarTimes(new Date('2026-06-21T12:00:00Z'),80,0)===null&&polarSummer.currentSolarFactor()===0,'polar-summer no-crossing fallback changed');
const polarWinter=loadModel('2026-12-21T12:00:00Z',80,0);assert(polarWinter.solarTimes(new Date('2026-12-21T12:00:00Z'),80,0)===null&&polarWinter.currentSolarFactor()===0,'polar-winter no-crossing fallback changed');
const sampleLat=35,sampleLon=-100,sample=loadModel('2026-08-22T16:00:00Z'),sampleTimes=sample.solarTimes(new Date('2026-08-22T16:00:00Z'),sampleLat,sampleLon);assert(sampleTimes&&sampleTimes.sunrise.getTime()<sampleTimes.sunset.getTime(),'mid-latitude sunrise must precede sunset');const sampleDaylight=daylightHours(sampleTimes);assert(sampleDaylight>12.5&&sampleDaylight<14.5,`mid-latitude August daylight implausible: ${sampleDaylight} h`);const atSampleSunrise=loadModel(sampleTimes.sunrise.toISOString(),sampleLat,sampleLon);close(atSampleSunrise.currentSolarFactor(),0.5,0.03,'DREAM SOLAR sunrise transition midpoint');

console.log('solar model smoke: PASS');
console.log(`  equator equinox daylight: ${equinoxDaylight.toFixed(3)} h`);
console.log('  high-latitude no-crossing fallback: dim, no fabricated event');
console.log(`  mid-latitude Aug 22 daylight: ${sampleDaylight.toFixed(3)} h`);
