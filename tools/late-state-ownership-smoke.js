#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const explicit=[
  ['hardware-fidelity.js','fidelityState'],
  ['background-audio-guard.js','guardState'],
  ['relay-show.js','showState'],
  ['screen-only.js','screenState'],
  ['dream-agc.js','dreamState'],
  ['relay-identity-audio.js','identityState'],
  ['relay-visual-coupling.js','visualState']
];
for(const [name,alias] of explicit){const source=read(name);assert(source.includes(alias)&&source.includes('window.AGCDSKY_APP_STATE'),`${name} is not an explicit shared-state consumer`)}
const hardware=read('hardware-fidelity.js'),guard=read('background-audio-guard.js'),show=read('relay-show.js'),screen=read('screen-only.js'),dream=read('dream-agc.js'),identity=read('relay-identity-audio.js'),visual=read('relay-visual-coupling.js');
for(const [name,source,forbidden] of [
  ['hardware-fidelity.js',hardware,["if (!tickSound)","mode !== 'clock'","mode === 'clock'","currentClockLatchState(verb, noun)","verb = '16'; noun = '65';"]],
  ['background-audio-guard.js',guard,["!dream &&","!tickSound","if (tickSound &&","typeof mode !== 'undefined'","!dream && typeof"]],
  ['relay-show.js',show,["mode = 'relay-show'","tickSound = true","verb = saved.verb","noun = saved.noun","if (appVisible)","mode === 'agc-loading'","|| dream)"]],
  ['screen-only.js',screen,["tickSound=!tickSound","if(tickSound)playRelayBurst"]],
  ['dream-agc.js',dream,["payload.mission !== selectedMission","mode = 'dream-agc","agcLoadedMission = selectedMission","mode !== 'dream-agc'"]],
  ['relay-identity-audio.js',identity,["typeof tickSound === 'boolean' && !tickSound"]],
  ['relay-visual-coupling.js',visual,["typeof tickSound === 'boolean' && !tickSound"]]
])for(const token of forbidden)assert(!source.includes(token),`${name} retained implicit state expression: ${token}`);
assert(identity.includes('!identityState.tickSound'),'relay identity audio does not read shared audio preference');
assert(visual.includes('!visualState.tickSound'),'relay visual layer does not read shared audio preference');
const appState=read('app-state-runtime.js');
assert(!appState.includes("'tickSound','displayOnly'"),'tickSound compatibility global still present');
assert(!/['"]tickSound['"]\s*,/.test(appState.split('for (const name of [')[1]||''),'tickSound remains in Window bridge');
console.log('late state ownership smoke: PASS');
console.log('  late presentation/relay layers use explicit shared state and the tickSound compatibility global is gone');
