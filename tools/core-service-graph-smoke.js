#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function forbidBare(source,name,label){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),re=new RegExp(`(^|[^.$\\w])${escaped}\\s*\\(`,'m');assert(!re.test(source),`${label} retained ambient call: ${name}()`)}
const html=read('index.html'),renderer=read('dsky-display-renderer.js'),shell=read('app-shell-runtime.js'),env=read('display-environment.js'),audio=read('relay-audio-runtime.js'),clock=read('phone-clock-runtime.js'),display=read('agc-display-runtime.js'),snapshot=read('agc-snapshot-runtime.js'),life=read('agc-lifecycle-runtime.js'),api=read('agc-api-runtime.js');
const order=['app-shell-runtime.js','dsky-display-renderer.js','display-environment.js','relay-audio-runtime.js','phone-clock-runtime.js','agc-display-runtime.js','agc-snapshot-runtime.js','agc-lifecycle-runtime.js','dsky-keycodes.js','agc-api-runtime.js'],positions=order.map(n=>html.indexOf(`<script src="${n}"></script>`));assert(positions.every(x=>x>=0),'core service file missing from parser chain');for(let i=1;i<positions.length;i++)assert(positions[i]>positions[i-1],`core service parser order broken at ${order[i]}`);
for(const [name,source,markers] of [
  ['renderer',renderer,['window.AGCDSKY_RENDERER=Object.freeze({','renderDigits:(...args)=>renderDigits(...args)','set2:(...args)=>set2(...args)']],
  ['shell',shell,['window.AGCDSKY_SHELL=Object.freeze({','function initializeAppShell(api,services)','services&&services.renderer','services&&services.snapshot']],
  ['environment',env,['const environmentShell=window.AGCDSKY_SHELL;','window.AGCDSKY_ENVIRONMENT=Object.freeze({','tickLevel:()=>tickLevel']],
  ['audio',audio,['const audioShell=window.AGCDSKY_SHELL;','const audioEnvironment=window.AGCDSKY_ENVIRONMENT;','window.AGCDSKY_AUDIO=Object.freeze({','playBurst:(...args)=>playRelayBurst(...args)']],
  ['clock',clock,['const clockShell=window.AGCDSKY_SHELL;','const clockRenderer=window.AGCDSKY_RENDERER;','const clockAudio=window.AGCDSKY_AUDIO;','window.AGCDSKY_CLOCK=Object.freeze({']],
  ['display',display,['const displayRenderer=window.AGCDSKY_RENDERER;','const displayAudio=window.AGCDSKY_AUDIO;','window.AGCDSKY_DISPLAY=Object.freeze({']],
  ['snapshot',snapshot,['const snapshotShell=window.AGCDSKY_SHELL;','const snapshotDisplay=window.AGCDSKY_DISPLAY;','window.AGCDSKY_SNAPSHOT=Object.freeze({']],
  ['lifecycle',life,['const lifecycleShell=window.AGCDSKY_SHELL;','const lifecycleRenderer=window.AGCDSKY_RENDERER;','const lifecycleClock=window.AGCDSKY_CLOCK;','const lifecycleDisplay=window.AGCDSKY_DISPLAY;','const lifecycleSnapshot=window.AGCDSKY_SNAPSHOT;']],
  ['api',api,['const apiServices=Object.freeze({','window.AGCDSKY_SERVICES=apiServices;','services:apiServices','apiShell.initialize(window.AGCDSKY,apiServices);']]
])for(const marker of markers)assert(source.includes(marker),`${name} service graph marker missing: ${marker}`);
for(const name of ['applyDim','applyDreamMode','applyDisplayOnly','applyTickSound','syncClockFace','tick'])forbidBare(shell,name,'shell');
for(const name of ['accurateDate','setReg','playRelayBurst','ensureAudio','clearLamps','set2','show'])forbidBare(clock,name,'clock');
for(const name of ['popcount11','playRelayBurst','setLamp','set2','setReg','clearLamps'])forbidBare(display,name,'display');
for(const name of ['snapshotUiState','applySnapshotUi','renderAgcSnapshot'])forbidBare(snapshot,name,'snapshot');
for(const name of ['cancelLampTest','saveAgcState','savedSnapshotInfo','clearLamps','set2','stopClockQueue','syncClockFace','missionSpec','renderAgcSnapshot','resetAgcFace','restoreSavedAgcState'])forbidBare(life,name,'lifecycle');
assert(!snapshot.includes('const store='),'snapshot regained shell storage authority');assert(snapshot.includes('snapshotShell.store.get(SNAPSHOT_KEY)')&&snapshot.includes('snapshotShell.store.set(SNAPSHOT_KEY'),'snapshot does not use shell storage service');assert(!shell.includes('lastAutosaveAt>')&&shell.includes('snapshot.lastAutosaveAt()'),'shell autosave does not consume snapshot service');assert(api.includes('agcChannel:apiDisplay.onChannel')&&api.includes('saveAgcState:apiSnapshot.save')&&api.includes('accurateTime:apiShell.accurateTime'),'public facade is not routed through services');for(const token of ['onAgcChannel','saveAgcState,','clearSavedAgcState,','verifySnapshotRoundTrip,','initializeAppShell('])assert(!api.includes(token),`API retained ambient implementation binding: ${token}`);
console.log('core service graph smoke: PASS');console.log('  renderer -> environment/audio -> clock/display -> snapshot -> lifecycle -> public API graph is explicit; core modules no longer depend on ambient helper calls');
