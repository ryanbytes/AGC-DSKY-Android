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
  'ntp.syncInFlight'
]) assert(SRC.includes(marker),'diagnostics contract missing: '+marker);
assert(!/startDskyTest[\s\S]{0,900}(?:keyMake|writeIo|proceed)/.test(SRC),
  'diagnostics self-test must not inject AGC inputs; AGC-mode V35 stays user-driven');
console.log('diagnostics self-test / network-time smoke: PASS');
