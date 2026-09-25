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
  "clock.lampTest()",
  "appState.mode!=='clock'",
  "'Clock DSKY self-test'",
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
  'id="diag-full-test"',
  "document.getElementById('diag-full-test').onclick=runFullSelfTest",
  'SELF_TEST_ASSETS',
  "gitBlobSha1:'713685680492098d05437b99c26403f683d56009'",
  "gitBlobSha1:'9e4ec167dc99ac12b233df07b6b91fef585e5015'",
  "WebAssembly.compile(wasmBytes.slice(0))",
  "'Relay-to-digit matrix'",
  "'EL segment renderer'",
  "'Annunciator lamps'",
  "'Keypad wiring'",
  "'Key tactile model'",
  "'Native/browser bridges'",
  "'Sensor plumbing'",
  "'Network time'",
  "'Saved-state read/write'",
  "'Audio subsystem'",
  "'Packaged assets'",
  "section('KEY MECHANICS / TACTILE')",
  "'Total finger force'",
  "'Tactile cue'",
  "'Vibrator amplitude control'",
  'id="diag-haptic-test"',
  "document.getElementById('diag-haptic-test').onclick",
  "tactile.test()",
  "fullSelfTestRunning?'RUNNING':(failed?'FAIL':'PASS')",
  "Object.freeze({open,close,runFullSelfTest})"
]) assert(SRC.includes(marker),'diagnostics contract missing: '+marker);
assert(!/startDskyTest[\s\S]{0,900}(?:keyMake|writeIo|proceed)/.test(SRC),
  'diagnostics self-test must not inject AGC inputs; AGC-mode V35 stays user-driven');
console.log('diagnostics self-test / network-time smoke: PASS');

assert(!SRC.includes('onclick=startFullSelfTest'),'diagnostics full self-test handler must reference the implemented runFullSelfTest function');
const planned=(SRC.match(/await run\('/g)||[]).length;
const totalMatch=SRC.match(/const SELF_TEST_TOTAL=(\d+);/);
assert(totalMatch,'diagnostics must declare SELF_TEST_TOTAL');
assert(Number(totalMatch[1])===planned,`diagnostics SELF_TEST_TOTAL ${totalMatch[1]} != ${planned} planned tests`);
assert(SRC.includes("+total+'/'+SELF_TEST_TOTAL+' complete'"),'diagnostics summary must use SELF_TEST_TOTAL');
assert(!SRC.includes("+total+'/12 complete'"),'diagnostics summary must not retain stale /12 literal');
