#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const explicit=[
  ['app-shell-runtime.js','shellState'],
  ['dsky-geometry.js','geometryState'],
  ['hardware-fidelity.js','fidelityState'],
  ['background-audio-guard.js','guardState'],
  ['relay-show.js','showState'],
  ['screen-only.js','screenState'],
  ['dream-agc.js','dreamState'],
  ['relay-identity-audio.js','identityState'],
  ['relay-visual-coupling.js','visualState']
];
for(const [name,alias] of explicit){const source=read(name);assert(source.includes(alias)&&source.includes('window.AGCDSKY_APP_STATE'),`${name} is not an explicit shared-state consumer`)}
const shell=read('app-shell-runtime.js'),geometry=read('dsky-geometry.js'),hardware=read('hardware-fidelity.js'),guard=read('background-audio-guard.js'),show=read('relay-show.js'),screen=read('screen-only.js'),dream=read('dream-agc.js'),identity=read('relay-identity-audio.js'),visual=read('relay-visual-coupling.js');
for(const [name,source,forbidden] of [
  ['app-shell-runtime.js',shell,["&&appVisible&&","if(appVisible)","if(!appVisible)"]],
  ['dsky-geometry.js',geometry,["typeof mode!==","mode==='agc'","mode!=='clock'","show(verb,noun)"]],
  ['hardware-fidelity.js',hardware,["if (!tickSound)","mode !== 'clock'","mode === 'clock'","currentClockLatchState(verb, noun)","verb = '16'; noun = '65';"]],
  ['background-audio-guard.js',guard,["!dream &&","!tickSound","if (tickSound &&","typeof mode !== 'undefined'","!dream && typeof"]],
  ['relay-show.js',show,["mode = 'relay-show'","tickSound = true","verb = saved.verb","noun = saved.noun","if (appVisible)","mode === 'agc-loading'","|| dream)"]],
  ['screen-only.js',screen,["tickSound=!tickSound","if(tickSound)playRelayBurst"]],
  ['dream-agc.js',dream,["payload.mission !== selectedMission","mode = 'dream-agc","agcLoadedMission = selectedMission","mode !== 'dream-agc'"]],
  ['relay-identity-audio.js',identity,["typeof tickSound === 'boolean' && !tickSound"]],
  ['relay-visual-coupling.js',visual,["typeof tickSound === 'boolean' && !tickSound"]]
])for(const token of forbidden)assert(!source.includes(token),`${name} retained implicit state expression: ${token}`);
assert(shell.includes('shellState.appVisible'),'shell periodic lifecycle work does not read shared visibility');
assert(geometry.includes("geometryState.mode==='agc'")&&geometry.includes('show(geometryState.verb,geometryState.noun)')&&geometry.includes("geometryState.mode!=='clock'"),'geometry startup/repaint does not read shared mode/command state');
assert(identity.includes('!identityState.tickSound'),'relay identity audio does not read shared audio preference');
assert(visual.includes('!visualState.tickSound'),'relay visual layer does not read shared audio preference');
const appState=read('app-state-runtime.js');
assert(!appState.includes('Object.defineProperty(window'),'app-state Window compatibility bridge still present');
assert(!appState.includes('for (const name of ['),'app-state compatibility-name loop still present');
console.log('late state ownership smoke: PASS');
console.log('  shell, geometry, and late presentation/relay layers use explicit shared state; Window app-state bridge is gone');
