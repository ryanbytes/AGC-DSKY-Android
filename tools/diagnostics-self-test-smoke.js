#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
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
  "gitBlobSha1:'713685680492098d05437b99c26403f683d56009'",
  "gitBlobSha1:'9e4ec167dc99ac12b233df07b6b91fef585e5015'",
  "WebAssembly.compile(wasmBytes.slice(0))",
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
  "CHANNEL 015 → yaAGC / COMANCHE",
  "CHANNEL 032 ACTIVE-LOW → yaAGC / COMANCHE",
  "yaAGC → CHANNELS 010 / 011 / 013 / 0163 → HARDWARE / DISPLAY",
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
assert(!/startDskyTest[\s\S]{0,1200}(?:keyMake|keyReset|writeIo|proceed|lampTest)/.test(SRC),
  'diagnostics V35 must not inject AGC inputs or synthesize display state; V35 stays user-driven through physical DSKY keys');
assert(!SRC.includes('RUN CLOCK DSKY SELF-TEST')&&!SRC.includes('V35 HARDWARE SEQUENCE STARTED'),'synthetic CLOCK V35 wording returned');
console.log('diagnostics self-test / network-time smoke: PASS');

assert(!SRC.includes('onclick=startFullSelfTest'),'diagnostics full self-test handler must reference the implemented runFullSelfTest function');
const planned=(SRC.match(/await run\('/g)||[]).length;
const totalMatch=SRC.match(/const SELF_TEST_TOTAL=(\d+);/);
assert(totalMatch,'diagnostics must declare SELF_TEST_TOTAL');
assert(Number(totalMatch[1])===planned,`diagnostics SELF_TEST_TOTAL ${totalMatch[1]} != ${planned} planned tests`);
assert(SRC.includes("+total+'/'+SELF_TEST_TOTAL+' complete'"),'diagnostics summary must use SELF_TEST_TOTAL');
assert(!SRC.includes("+total+'/12 complete'"),'diagnostics summary must not retain stale /12 literal');
