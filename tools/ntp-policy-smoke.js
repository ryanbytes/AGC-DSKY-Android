#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = message => { throw new Error(`NTP POLICY FAIL: ${message}`); };
const requireText = (text, needle, label) => { if (!text.includes(needle)) fail(`${label} missing ${needle}`); };
const forbid = (text, needle, label) => { if (text.includes(needle)) fail(`${label} must not contain ${needle}`); };

const ntp = read('app/src/main/java/org/apollo/agcdsky/NtpTime.java');
const client = read('app/src/main/java/org/apollo/agcdsky/SntpClient.java');
const manifest = read('app/src/main/AndroidManifest.xml');
const app = read('app/src/main/assets/app.js');
const sensor = read('app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');

for (const needle of ['time.cloudflare.com', 'scheduleAtFixedRate', 'onAvailable(Network network)', 'SystemClock.elapsedRealtime()', 'Math.abs(sample.offsetMs - median) <= 2_000L', 'System.currentTimeMillis() + readStatus']) requireText(ntp, needle, 'NtpTime');
for (const needle of ['DatagramSocket', 'short NTP response', 'NTP originate timestamp mismatch', 'invalid NTP response']) requireText(client, needle, 'SntpClient');
forbid(ntp + client + manifest, 'android.permission.SET_TIME', 'native NTP implementation/manifest');
forbid(ntp + client, 'setTime(', 'native NTP implementation');
requireText(manifest, 'android.permission.INTERNET', 'manifest');
requireText(manifest, 'android.permission.ACCESS_NETWORK_STATE', 'manifest');
requireText(app, 'function accurateTime(){return Date.now()+(Number(ntpStatus.offsetMs)||0)}', 'phone clock');
requireText(app, 'function desiredClockDigits(){const d=accurateDate()', 'phone clock');
requireText(app, 'nativeNtpStatus:updateNtpStatus', 'phone clock bridge');
requireText(sensor, 'new TimeBridge(),"TimeBridge"', 'SensorMainActivity');
console.log('ntp policy smoke: PASS');
console.log('  native-only SNTP, no clock-setting privilege, outlier rejection, recovery scheduling, and corrected DSKY clock source verified');
