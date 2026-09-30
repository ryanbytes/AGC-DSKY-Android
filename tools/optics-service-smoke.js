#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'optics.js'),'utf8');
const tap=fs.readFileSync(path.join(ASSETS,'sextant-tap-mark.js'),'utf8');
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
  'const SHAFT_COUNTS_PER_DEG = 32768 / 360',
  'const TRUNNION_COUNTS_PER_DEG = 32768 / 90',
  'const TRUNNION_BIAS_COUNTS = 7200',
  'function signed15(word)',
  'function shaftDegrees(word)',
  'function trunnionDegrees(word)',
  'const scales=[SHAFT_COUNTS_PER_DEG,TRUNNION_COUNTS_PER_DEG]',
  'TRUNNION_ZERO_BIAS_DEG'
])assert(source.includes(marker),`optics CDU scale/bias marker missing: ${marker}`);
assert(!source.includes('const COUNTS_PER_DEG = COUNTS_PER_REV / 360'),
  'optics must not use the shaft 360-degree scale for trunnion CDU pulses/readout');
for(const marker of [
  'const SHAFT_COUNTS_PER_DEG = 32768 / 360',
  'const TRUNNION_COUNTS_PER_DEG = 32768 / 90',
  'shaftOffsetDeg * SHAFT_COUNTS_PER_DEG',
  'trunnionOffsetDeg * TRUNNION_COUNTS_PER_DEG'
])assert(tap.includes(marker),`tap-to-mark CDU scale marker missing: ${marker}`);
assert(!tap.includes('const COUNTS_PER_DEG = 32768 / 360'),
  'tap-to-mark must not use one 360-degree scale for both optical CDUs');
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
  'bindNavContact(\'sxt-mark\',MARK_BIT)',
  'bindNavContact(\'sxt-reject\',REJECT_BIT)',
  'const ok=c.navKeyPress(bit)',
  'held.core.navKeyRelease()',
  "addEventListener('blur',releaseNavContact)",
  'api.scheduleAgcAutosave',
  'cameraPending:!!cameraAcquire',
  'pointingCalibration:typeof api.skyCalibrationStatus',
  'function requestWebStarFinderSensors()',
  "typeof pwa.requestSensorPermissions!=='function'",
  'pwa.requestSensorPermissions({absolute:true})',
  'BRAVE: ENABLE SETTINGS › SITE SETTINGS › MOTION SENSORS',
  'COMPASS / ORIENTATION PERMISSION DENIED',
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
assert(!source.includes('c.navKeyPulse(bit,90)'), 'flight-facing MARK controls must not synthesize a fixed 90 ms hold');
assert(source.includes('releaseNavContact();\n    const view = document.getElementById(\'sxt-view\')'), 'closing sextant must release a held navigation contact');
assert(source.includes('if (document.hidden) {\n      releaseNavContact();'), 'backgrounding sextant must release a held navigation contact');
console.log('optics service smoke: PASS');
console.log('  explicit sextant service publication, parser order, camera lifecycle, CDU/nav paths, autosave, and status telemetry retained');
