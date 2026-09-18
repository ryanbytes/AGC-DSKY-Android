#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'optics.js'),'utf8');
const css=fs.readFileSync(path.join(ASSETS,'optics.css'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(condition,message){if(!condition)throw new Error(message)}

assert(source.includes('const api = window.AGCDSKY;'),
  'optics must consume the bootstrapped AGCDSKY facade');
assert(!source.includes('window.AGCDSKY = window.AGCDSKY || {}'),
  'optics must not recreate the root AGCDSKY facade');
assert(source.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_OPTICS',Object.freeze({open,close,status})"),
  'optics must publish a frozen dedicated service explicitly through the registry');
for(const forbidden of ['api.openSextant =','api.closeSextant =','api.sextantStatus ='])
  assert(!source.includes(forbidden),`optics regained direct public-facade mutation: ${forbidden}`);
for(const marker of [
  'async function open()',
  'function close()',
  'function status()',
  "document.body.classList.add('sxt-combined')",
  "document.body.classList.remove('sxt-combined')",
  "combinedDsky:document.body.classList.contains('sxt-combined')",
  'setInterval(pump,4)',
  "api.setOpticsCaptureActive(true)",
  "api.setOpticsCaptureActive(false)",
  'c.writeIo(ch[axis],sign>0?PCDU:MCDU)',
  'c.navKeyPulse(bit,90)',
  'api.scheduleAgcAutosave',
  'cameraPending:!!cameraAcquire',
  'pointingCalibration:typeof api.skyCalibrationStatus',
  'function requestWebStarFinderSensors()',
  "typeof pwa.requestSensorPermissions!=='function'",
  'pwa.requestSensorPermissions()',
  'COMPASS / MOTION PERMISSION DENIED',
  'ABSOLUTE COMPASS UNAVAILABLE IN THIS BROWSER'
])assert(source.includes(marker),`optics behavior marker missing: ${marker}`);
const apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>');
const opticsIndex=html.indexOf('<script src="optics.js"></script>');
assert(apiIndex>=0&&opticsIndex>apiIndex,
  'optics must load after the root AGCDSKY public facade bootstrap');
for(const marker of [
  'body.sxt-combined #sxt-view',
  'body.sxt-combined #dsky',
  'width:calc(var(--sxt-dsky-h) * 320 / 372)!important',
  'bottom:0!important',
  'z-index:10001!important'
])assert(css.includes(marker),`combined sextant/live DSKY layout missing: ${marker}`);
assert(!source.includes('cloneNode('),'sextant must use the existing live DSKY, not a clone');
console.log('optics service smoke: PASS');
console.log('  explicit sextant service publication, parser order, camera lifecycle, CDU/nav paths, autosave, and status telemetry retained');
