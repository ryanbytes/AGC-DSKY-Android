#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'app/src/main/assets/app.js');
const source = fs.readFileSync(APP_JS, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance,
    `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}

const start = source.indexOf('const DAY_MS=86400000');
const end = source.indexOf('function requestSolarLocation()');
assert(start >= 0 && end > start,
  'could not isolate the production solar-model functions from app.js');

const solarSource = source.slice(start, end)
  + '\nglobalThis.__solarModel={solarTimes,currentSolarFactor,hourAngle,smoothstep};';

function fixedDateClass(nowIso) {
  const RealDate = Date;
  const fixedMs = RealDate.parse(nowIso);
  assert(Number.isFinite(fixedMs), `invalid fixed date for test: ${nowIso}`);
  return class FixedDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedMs]));
    }
    static now() {
      return fixedMs;
    }
  };
}

function loadModel(nowIso, lat = null, lon = null) {
  const storage = new Map();
  if (lat !== null) storage.set('solarLat', String(lat));
  if (lon !== null) storage.set('solarLon', String(lon));
  const context = {
    Math,
    Number,
    parseFloat,
    Date: fixedDateClass(nowIso),
    store: {
      get(key) {
        return storage.has(key) ? storage.get(key) : null;
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(solarSource, context, { filename: 'app.js:solar-model' });
  return context.__solarModel;
}

function daylightHours(times) {
  return (times.sunset.getTime() - times.sunrise.getTime()) / 3600000;
}

// Equinox at the equator should have an ordinary sunrise/sunset pair and a
// little over 12 hours between the standard apparent -0.833 degree events.
const equinox = loadModel('2026-03-20T12:00:00Z');
assert(typeof equinox.hourAngle === 'function',
  'production solar model must expose the current hourAngle helper');
const equinoxTimes = equinox.solarTimes(new Date('2026-03-20T12:00:00Z'), 0, 0);
assert(equinoxTimes && equinoxTimes.sunrise instanceof Date && equinoxTimes.sunset instanceof Date,
  'equatorial equinox must produce sunrise and sunset timestamps');
const equinoxDaylight = daylightHours(equinoxTimes);
assert(equinoxDaylight > 12.0 && equinoxDaylight < 12.3,
  `equatorial apparent-sun daylight length is implausible: ${equinoxDaylight} h`);

// The recovered v0.38.3 model returns null when the standard sunrise/sunset
// crossing does not occur. The brightness helper deliberately falls back to
// the dim state rather than fabricating an event time.
const polarSummer = loadModel('2026-06-21T12:00:00Z', 80, 0);
assert(polarSummer.solarTimes(new Date('2026-06-21T12:00:00Z'), 80, 0) === null,
  '80 N near June solstice must return no fabricated sunrise/sunset crossing');
assert(polarSummer.currentSolarFactor() === 0,
  'no-crossing solar fallback must remain dim in the recovered v0.38.3 model');

const polarWinter = loadModel('2026-12-21T12:00:00Z', 80, 0);
assert(polarWinter.solarTimes(new Date('2026-12-21T12:00:00Z'), 80, 0) === null,
  '80 N near December solstice must return no fabricated sunrise/sunset crossing');
assert(polarWinter.currentSolarFactor() === 0,
  'polar-night no-crossing fallback must remain dim');

// Indiana sanity check: this is not intended as an almanac replacement, only
// a guard against sign/cycle regressions in longitude or the no-event logic.
const wabashLat = 40.8358;
const wabashLon = -85.7293;
const wabash = loadModel('2026-08-22T16:00:00Z');
const wabashTimes = wabash.solarTimes(
  new Date('2026-08-22T16:00:00Z'), wabashLat, wabashLon);
assert(wabashTimes && wabashTimes.sunrise.getTime() < wabashTimes.sunset.getTime(),
  'Wabash-area sunrise must precede sunset');
const wabashDaylight = daylightHours(wabashTimes);
assert(wabashDaylight > 13 && wabashDaylight < 14.5,
  `Wabash-area August daylight length is implausible: ${wabashDaylight} h`);

// At the center of the one-hour sunrise transition smoothstep should put the
// environment near the midpoint rather than snapping directly to day/night.
const atWabashSunrise = loadModel(wabashTimes.sunrise.toISOString(), wabashLat, wabashLon);
close(atWabashSunrise.currentSolarFactor(), 0.5, 0.03,
  'DREAM SOLAR sunrise transition midpoint');

console.log('solar model smoke: PASS');
console.log(`  equator equinox daylight: ${equinoxDaylight.toFixed(3)} h`);
console.log('  high-latitude no-crossing fallback: dim, no fabricated event');
console.log(`  Wabash Aug 22 daylight: ${wabashDaylight.toFixed(3)} h`);
