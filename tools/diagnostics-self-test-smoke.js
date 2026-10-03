#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'app/src/main/assets/diagnostics.js'),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
for(const marker of [
  'id="diag-dsky-test"',
  "document.getElementById('diag-dsky-test').onclick=startDskyTest",
  "appState.mode!=='agc'",
  "'AGC V35 test'",
  "USE THE DSKY KEYS: VERB 3 5 ENTR",
  "'REAL V35 · CLOSE AND KEY V 3 5 ENTR'",
  'id="diag-ntp-sync"',
  "document.getElementById('diag-ntp-sync').onclick=syncNetworkTimeNow",
  "if(!phoneStatus()?.pipa?.calibrated){pipaTest={ok:false,message:'CALIBRATE PIPA SENSOR FIRST'}",
  "window.AGCDSKY_SHELL.requestNetworkTimeSync",
  "section('TIME')",
  "'Clock source'",
  "'HTTP time source / origin host'",
  "'NTP server'",
  "'Network time state'",
  "'Measured clock offset'",
  "'Round-trip time'",
  "'Last successful sync'",
  "'Last sync attempt'",
  'ntp.roundTripMs',
  'ntp.offsetMs',
  'ntp.lastSyncUtcMs',
  'ntp.lastAttemptUtcMs',
  'ntp.lastAttemptResult',
  'ntp.syncInFlight',
  'id="diag-relay-show"',
  'NON-FLIGHT RELAY SHOW',
  'id="diag-full-test"',
  'RUN NON-FLIGHT APP SELF-TEST',
  "document.getElementById('diag-full-test').onclick=runFullSelfTest",
  'SELF_TEST_ASSETS',
  "fetchCheckedAsset(SELF_TEST_ASSETS[1])",
  "return SELF_TEST_ASSETS[1].size+' bytes · pinned Git blob SHA-1 verified'",
  "gitBlobSha1:'04a24dd1df4a81738e138b3e9f048d2b10498439'",
  "gitBlobSha1:'9e4ec167dc99ac12b233df07b6b91fef585e5015'",
  "WebAssembly.compile(wasmBytes.slice(0))",
  "'Comanche 055 rope'",
  "'Relay-to-digit matrix'",
  "'EL segment renderer'",
  "'Annunciator lamps'",
  "'Keypad wiring'",
  "'Keyboard electrical contacts'",
  "'Key tactile model'",
  "'Native/browser bridges'",
  "'Sensor plumbing'",
  "'Network time'",
  "'Saved-state read/write'",
  "'Audio subsystem'",
  "'Packaged assets'",
  "section('OPERATION AUTHORITY')",
  "CHANNEL 015 → yaAGC / ${mission}",
  "CHANNEL 032 ACTIVE-LOW → yaAGC / ${mission}",
  "yaAGC → CHANNELS 010 / 011 / 012 / 013 / 0163 → HARDWARE / DISPLAY",
  "Channel 012 raw output",
  "PHONE CLOCK','NON-FLIGHT",
  "Relay Show','NON-FLIGHT",
  "NO SYNTHETIC AGC DISPLAY OUTPUT",
  "section('KEY ELECTRICAL')",
  "'Keyboard schematic'",
  "'Normal switch matrix'",
  "'KEYRST'",
  "'PRO/STBY'",
  "'Synthetic keycode dwell'",
  "section('KEY MECHANICS / TACTILE')",
  "'Total finger force'",
  "'Tactile cue'",
  "'Vibrator amplitude control'",
  "'VIBRATE permission'",
  "'System haptic feedback'",
  "'System vibrate_on'",
  "'Power saver'",
  'id="diag-haptic-test"',
  "document.getElementById('diag-haptic-test').onclick",
  "tactile.test()",
  'id="diag-haptic-settings"',
  "document.getElementById('diag-haptic-settings').onclick",
  "tactile.openSystemSettings()",
  "fullSelfTestRunning?'RUNNING':(failed?'FAIL':'PASS')",
  "'Non-flight app self-test'",
  "Object.freeze({open,close,runFullSelfTest})"
]) assert(SRC.includes(marker),'diagnostics contract missing: '+marker);
assert(!SRC.includes('SELF_TEST_ASSETS[2]'),'diagnostics asset success reporting must not index beyond the two pinned assets');
assert(!/startDskyTest[\s\S]{0,1200}(?:keyMake|keyReset|writeIo|proceed|lampTest)/.test(SRC),
  'diagnostics V35 must not inject AGC inputs or synthesize display state; V35 stays user-driven through physical DSKY keys');
assert(!SRC.includes('RUN CLOCK DSKY SELF-TEST')&&!SRC.includes('V35 HARDWARE SEQUENCE STARTED'),'synthetic CLOCK V35 wording returned');
const rowHelpers=SRC.match(/function escapeHtml\(value\)\{[\s\S]*?function row\(k,v\)\{[^\n]*\}/);
assert(rowHelpers,'diagnostics row renderer must escape dynamic HTML text');
const renderRow=vm.runInNewContext(`(()=>{${rowHelpers[0]};return row})()`);
assert(renderRow('<label>','<img src=x onerror=alert(1)>')==='<tr><td>&lt;label&gt;</td><td>&lt;img src=x onerror=alert(1)&gt;</td></tr>',
  'diagnostics row values must render as text and never create markup');
console.log('diagnostics self-test / network-time smoke: PASS');

assert(!SRC.includes('onclick=startFullSelfTest'),'diagnostics full self-test handler must reference the implemented runFullSelfTest function');
const planned=(SRC.match(/await run\('/g)||[]).length;
const totalMatch=SRC.match(/const SELF_TEST_TOTAL=(\d+);/);
assert(totalMatch,'diagnostics must declare SELF_TEST_TOTAL');
assert(Number(totalMatch[1])===planned,`diagnostics SELF_TEST_TOTAL ${totalMatch[1]} != ${planned} planned tests`);
assert(SRC.includes("+total+'/'+SELF_TEST_TOTAL+' complete'"),'diagnostics summary must use SELF_TEST_TOTAL');
assert(!SRC.includes("+total+'/12 complete'"),'diagnostics summary must not retain stale /12 literal');
