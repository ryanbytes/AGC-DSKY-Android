#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const display = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/agc-display-runtime.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/app.js'), 'utf8');
const hw = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/hardware-fidelity.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/index.html'), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(display.includes("setLamp('comp',!!(agcCh11&0o00002));"),
  'COMP ACTY must follow channel 011 bit 2 directly');
assert(display.includes('function decodeChannel11(value){agcCh11=value;updateAgcCompActy();'),
  'channel 011 decoder must immediately update COMP ACTY');
assert(!app.includes('function decodeChannel11(value)'),
  'app.js regained channel decoder ownership');
assert(!index.includes('relay-output-sync.js'),
  'relay-output-sync presentation shim must not be loaded');

assert(!hw.includes('audioPresentationLatencyMs'),
  'hardware fidelity must not delay EL presentation for audio latency');
assert(!hw.includes('AUDIO_PRESENTATION_'),
  'audio presentation timing constants must remain removed');
const driveStart = hw.indexOf('function beginRelayDrive');
const driveEnd = hw.indexOf('\n\n\n  // Real yaAGC output', driveStart);
assert(driveStart >= 0 && driveEnd > driveStart, 'could not isolate beginRelayDrive');
const drive = hw.slice(driveStart, driveEnd);
assert(drive.includes('if (render) applyRelayLow11(relay, low11);'),
  'settled relay state must paint in the 20-ms commit callback');
assert(drive.includes('}, RELAY_DRIVE_MS);'),
  'relay latch/display commit must remain on the 20-ms physical boundary');

console.log('DSKY output path smoke: PASS');
console.log('  authoritative AGC display runtime owns direct channel-011 COMP ACTY edges');
console.log('  EL rows remain visible at the documented 20-ms settled boundary');
