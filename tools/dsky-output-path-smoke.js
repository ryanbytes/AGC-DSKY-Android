#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const display=fs.readFileSync(path.join(ASSETS,'agc-display-runtime.js'),'utf8');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
const hw=fs.readFileSync(path.join(ASSETS,'hardware-fidelity.js'),'utf8');
const index=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
assert(display.includes("setLamp('comp',!!(agcCh11&0o00002));"),'COMP ACTY must follow channel 011 bit 2 directly');
assert(display.includes('function decodeChannel11(value){agcCh11=value;updateAgcCompActy();'),'channel 011 decoder must immediately update COMP ACTY');
assert(!shell.includes('function decodeChannel11(value)')&&!api.includes('function decodeChannel11(value)'),'non-display runtime regained channel decoder ownership');
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');
assert(!index.includes('relay-output-sync.js'),'relay-output-sync presentation shim must not be loaded');
assert(!hw.includes('audioPresentationLatencyMs'),'hardware fidelity must not delay EL presentation for audio latency');
assert(!hw.includes('AUDIO_PRESENTATION_'),'audio presentation timing constants must remain removed');
const driveStart=hw.indexOf('function beginRelayDrive'),driveEnd=hw.indexOf('\n\n\n  // Real yaAGC output',driveStart);assert(driveStart>=0&&driveEnd>driveStart,'could not isolate beginRelayDrive');const drive=hw.slice(driveStart,driveEnd);assert(drive.includes('if (render) applyRelayLow11(relay, low11);'),'settled relay state must paint in 20-ms commit callback');assert(drive.includes('}, RELAY_DRIVE_MS);'),'relay latch/display commit must remain on 20-ms physical boundary');
console.log('DSKY output path smoke: PASS');
console.log('  AGC display runtime owns direct channel-011 edges; EL rows remain visible at the documented 20-ms settled boundary');
