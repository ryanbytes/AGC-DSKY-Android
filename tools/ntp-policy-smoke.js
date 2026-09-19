#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const fail=m=>{throw new Error(`NTP POLICY FAIL: ${m}`)};
const requireText=(text,needle,label)=>{if(!text.includes(needle))fail(`${label} missing ${needle}`)};
const forbid=(text,needle,label)=>{if(text.includes(needle))fail(`${label} must not contain ${needle}`)};

const ntp=read('app/src/main/java/org/apollo/agcdsky/NtpTime.java');
const client=read('app/src/main/java/org/apollo/agcdsky/SntpClient.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const state=read('app/src/main/assets/app-state-runtime.js');
const shell=read('app/src/main/assets/app-shell-runtime.js');
const clock=read('app/src/main/assets/phone-clock-runtime.js');
const api=read('app/src/main/assets/agc-api-runtime.js');
const main=read('app/src/main/java/org/apollo/agcdsky/MainActivity.java');
const sensor=read('app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');
const dream=read('app/src/main/java/org/apollo/agcdsky/AgcDreamService.java');

for(const needle of [
  'time.cloudflare.com',
  'scheduleAtFixedRate',
  'onAvailable(Network network)',
  'SystemClock.elapsedRealtime()',
  'Math.abs(sample.offsetMs - median) <= 2_000L',
  'System.currentTimeMillis() + readStatus'
]) requireText(ntp,needle,'NtpTime');

for(const needle of [
  'DatagramSocket',
  'short NTP response',
  'NTP originate timestamp mismatch',
  'invalid NTP response'
]) requireText(client,needle,'SntpClient');

forbid(ntp+client+manifest,'android.permission.SET_TIME','native NTP implementation/manifest');
forbid(ntp+client,'setTime(','native NTP implementation');
requireText(manifest,'android.permission.INTERNET','manifest');
requireText(manifest,'android.permission.ACCESS_NETWORK_STATE','manifest');
requireText(state,"server:'time.cloudflare.com'",'shared app state');

requireText(shell,'function accurateTime(){return Date.now()+(Number(shellState.ntpStatus.offsetMs)||0)}','app shell clock');
requireText(shell,'function loadNativeNtpStatus()','app shell native NTP bridge');
requireText(shell,'function syncBrowserNetworkTime(force=false)','app shell browser network-time fallback');
requireText(shell,"method:'HEAD',cache:'no-store'","browser network-time request");
requireText(shell,"response.headers.get('date')","browser network-time Date header");
requireText(shell,"source:'http-date'","browser network-time status");
requireText(shell,"setInterval(refreshTimeStatus,60000)",'time-status refresh');
requireText(shell,'window.AGCDSKY_SHELL=Object.freeze({','shell service');

for(const [label,text] of [['MainActivity',main],['SensorMainActivity',sensor],['AgcDreamService',dream]]){
  requireText(text,'NtpTime.start(this)',label);
  requireText(text,'NtpTime.addListener(ntpListener)',label);
  requireText(text,'new TimeBridge(),"TimeBridge"',label);
  requireText(text,'NtpTime.removeListener(ntpListener)',label);
}
requireText(main,'WebViewTeardown.destroy(doomed,"DebugBridge","TimeBridge","PrintBridge")','MainActivity TimeBridge teardown');

requireText(clock,'function desiredClockDigitsImpl(){const d=clockShell.accurateDate()','phone clock shell-time service');
requireText(api,'accurateTime:apiShell.accurateTime','public AGCDSKY time facade');
requireText(api,'ntpStatus:()=>({...apiState.ntpStatus})','public AGCDSKY NTP status facade');
requireText(api,'nativeNtpStatus:apiShell.updateNtpStatus','public AGCDSKY bridge');
forbid(api,'function accurateTime()','thin API bootstrap');
forbid(api,'function desiredClockDigits','thin API bootstrap');
if(fs.existsSync(path.join(root,'app/src/main/assets/app.js')))fail('legacy app.js unexpectedly exists');

console.log('ntp policy smoke: PASS');
console.log('  Android Activity/Sensor/Dream SNTP bridges and browser HTTP-Date fallback are source-gated');
