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
assert(source.includes("function comancheMissionSelected(){ return typeof api.getMission === 'function' && api.getMission() === 'comanche055'; }"),
  'CM optics must identify the active Comanche mission before sending CM-specific channel inputs');
assert(source.includes('lat < -90||lat > 90||lon < -180||lon > 180'),
  'saved or geolocation coordinates must be bounded to valid latitude/longitude ranges');
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
  'const PCDU_FAST = 0o21;',
  'const MCDU_FAST = 0o23;',
  'shaftOffsetDeg * SHAFT_COUNTS_PER_DEG',
  'trunnionOffsetDeg * TRUNNION_COUNTS_PER_DEG'
])assert(tap.includes(marker),`tap-to-mark CDU scale marker missing: ${marker}`);
assert(!tap.includes('const COUNTS_PER_DEG = 32768 / 360'),
  'tap-to-mark must not use one 360-degree scale for both optical CDUs');
assert(tap.includes("const comancheMissionSelected = () => typeof api.getMission === 'function' && api.getMission() === 'comanche055';"),
  'tap-to-mark must identify the active Comanche mission before sending CM-specific channel inputs');
assert(tap.includes("if (!comancheMissionSelected()) {\n      status('SXT · COMANCHE 055 ONLY');\n      showMarker(point, 'busy');\n      return false;\n    }"),
  'tap-to-mark must block CM CDU and MARK inputs for unsupported mission state');
for(const marker of [
  'async function open()',
  'function close()',
  'function status()',
  "document.body.classList.add('sxt-combined')",
  "document.body.classList.remove('sxt-combined')",
  "combinedDsky:document.body.classList.contains('sxt-combined')",
  'setInterval(pump,4)',
  "if(!comancheMissionSelected()){\n      document.body.classList.remove('sxt-combined');\n      setOpticsCapture(false);\n      const st=document.getElementById('sxt-status');if(st)st.textContent='SXT · COMANCHE 055 ONLY';\n      updateReadout();",
  "if(!comancheMissionSelected()){\n      el.textContent='CM OPTICS ONLY';\n      updateStarFinder();\n      return;\n    }",
  "if(!comancheMissionSelected()){\n      const st=document.getElementById('sxt-status'); if(st) st.textContent='STAR FINDER · COMANCHE 055 ONLY';\n      return;\n    }",
  "if(!comancheMissionSelected()){\n      finderEnabled=false;box.classList.remove('visible');\n      const b=document.getElementById('sxt-star-toggle');if(b)b.textContent='STAR FINDER · CM ONLY';\n      return;\n    }",
  'if(!comancheMissionSelected()){\n      if(navHeld)releaseNavContact();\n      if(opticsCaptured){\n        setOpticsCapture(false);',
  "if(!opticsCaptured&&document.getElementById('sxt-view')?.classList.contains('open')){\n      document.body.classList.add('sxt-combined');\n      setOpticsCapture(true);",
  "if(!comancheMissionSelected()){\n      const st=document.getElementById('sxt-status'); if(st) st.textContent='SXT · COMANCHE 055 ONLY';\n      return false;\n    }",
  "if(opticsCaptured===next)return;\n    if(typeof api.setOpticsCaptureActive==='function')api.setOpticsCaptureActive(next);",
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
assert(source.includes('function close(){\n    releaseNavContact();'), 'closing sextant must release a held navigation contact');
assert(source.includes("const tapMark=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_SEXTANT_TAP_MARK');\n    if(tapMark&&typeof tapMark.cancel==='function')tapMark.cancel();"), 'closing sextant must cancel an in-flight tap-to-mark operation');
assert(source.includes('if (document.hidden) {\n      releaseNavContact();'), 'backgrounding sextant must release a held navigation contact');
console.log('optics service smoke: PASS');
console.log('  explicit sextant service publication, parser order, camera lifecycle, CDU/nav paths, autosave, and status telemetry retained');
