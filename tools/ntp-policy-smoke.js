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
const state = read('app/src/main/assets/app-state-runtime.js');
const shell = read('app/src/main/assets/app-shell-runtime.js');
const clock = read('app/src/main/assets/phone-clock-runtime.js');
const api = read('app/src/main/assets/agc-api-runtime.js');
const sensor = read('app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');

for (const needle of ['time.cloudflare.com', 'scheduleAtFixedRate', 'onAvailable(Network network)', 'SystemClock.elapsedRealtime()', 'Math.abs(sample.offsetMs - median) <= 2_000L', 'System.currentTimeMillis() + readStatus']) requireText(ntp, needle, 'NtpTime');
for (const needle of ['DatagramSocket', 'short NTP response', 'NTP originate timestamp mismatch', 'invalid NTP response']) requireText(client, needle, 'SntpClient');
forbid(ntp + client + manifest, 'android.permission.SET_TIME', 'native NTP implementation/manifest');
forbid(ntp + client, 'setTime(', 'native NTP implementation');
requireText(manifest, 'android.permission.INTERNET', 'manifest');
requireText(manifest, 'android.permission.ACCESS_NETWORK_STATE', 'manifest');
requireText(state, "server:'time.cloudflare.com'", 'shared app state');
requireText(shell, 'function accurateTime(){return Date.now()+(Number(shellState.ntpStatus.offsetMs)||0)}', 'app shell clock');
requireText(shell, 'function updateNtpStatus(value)', 'app shell NTP bridge');
requireText(shell, 'shellState.ntpStatus={...shellState.ntpStatus,...parsed}', 'shared NTP state update');
requireText(clock, 'function desiredClockDigits(){const d=accurateDate()', 'phone clock runtime');
requireText(api, 'ntpStatus:()=>({...apiState.ntpStatus})', 'public AGCDSKY NTP status facade');
requireText(api, 'nativeNtpStatus:updateNtpStatus', 'public AGCDSKY bridge');
forbid(api, 'function accurateTime()', 'thin API bootstrap');
forbid(api, 'function desiredClockDigits()', 'thin API bootstrap');
if (fs.existsSync(path.join(root,'app/src/main/assets/app.js'))) fail('legacy app.js unexpectedly exists');
requireText(sensor, 'new TimeBridge(),"TimeBridge"', 'SensorMainActivity');
console.log('ntp policy smoke: PASS');
console.log('  native-only SNTP, no clock-setting privilege, shared NTP state, API copy facade, and corrected DSKY clock source verified');
