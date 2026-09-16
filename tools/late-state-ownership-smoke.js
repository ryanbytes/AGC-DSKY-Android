#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function hasUnqualified(source,token){
  let index=source.indexOf(token);
  while(index>=0){
    const previous=index>0?source[index-1]:'';
    if(previous!=='.'&&!/[A-Za-z0-9_$]/.test(previous))return true;
    index=source.indexOf(token,index+1);
  }
  return false;
}
const explicit=[
  ['app-shell-runtime.js','shellState'],['dsky-geometry.js','geometryState'],['hardware-fidelity.js','fidelityState'],
  ['background-audio-guard.js','guardState'],['relay-show.js','showState'],['screen-only.js','screenState'],
  ['dream-agc.js','dreamState'],['relay-identity-audio.js','identityState'],['relay-visual-coupling.js','visualState']
];
for(const [name,alias] of explicit){const source=read(name);assert(source.includes(alias)&&source.includes('window.AGCDSKY_APP_STATE'),`${name} is not an explicit shared-state consumer`)}
const shell=read('app-shell-runtime.js'),geometry=read('dsky-geometry.js'),hardware=read('hardware-fidelity.js'),guard=read('background-audio-guard.js'),show=read('relay-show.js'),screen=read('screen-only.js'),dream=read('dream-agc.js'),identity=read('relay-identity-audio.js'),visual=read('relay-visual-coupling.js'),snapshot=read('agc-snapshot-runtime.js'),life=read('agc-lifecycle-runtime.js'),api=read('agc-api-runtime.js'),renderer=read('dsky-display-renderer.js'),clock=read('phone-clock-runtime.js'),display=read('agc-display-runtime.js');
for(const [name,source,forbidden] of [
  ['app-shell-runtime.js',shell,["&&appVisible&&","if(appVisible)","if(!appVisible)","agcCore"]],
  ['dsky-geometry.js',geometry,["typeof mode!==","mode==='agc'","mode!=='clock'","show(verb,noun)"]],
  ['hardware-fidelity.js',hardware,["if (!tickSound)","mode !== 'clock'","mode === 'clock'","currentClockLatchState(verb, noun)","verb = '16'; noun = '65';"]],
  ['background-audio-guard.js',guard,["!dream &&","!tickSound","if (tickSound &&","typeof mode !== 'undefined'","!dream && typeof"]],
  ['relay-show.js',show,["mode = 'relay-show'","tickSound = true","verb = saved.verb","noun = saved.noun","if (appVisible)","mode === 'agc-loading'","|| dream)","agcCore","agcPausedForVisibility"]],
  ['screen-only.js',screen,["tickSound=!tickSound","if(tickSound)playRelayBurst"]],
  ['dream-agc.js',dream,["payload.mission !== selectedMission","mode = 'dream-agc","agcLoadedMission = selectedMission","mode !== 'dream-agc'","agcCore","agcLoadedMission"]],
  ['relay-identity-audio.js',identity,["typeof tickSound === 'boolean' && !tickSound"]],
  ['relay-visual-coupling.js',visual,["typeof tickSound === 'boolean' && !tickSound"]],
  ['agc-snapshot-runtime.js',snapshot,["agcCore","agcLoadedMission"]],
  ['agc-lifecycle-runtime.js',life,["agcCore","agcLoadedMission","agcSuspendedForClock","agcPausedForVisibility"]],
  ['agc-api-runtime.js',api,["agcCore"]]
])for(const token of forbidden)assert(!hasUnqualified(source,token),`${name} retained implicit state/core expression: ${token}`);
assert(shell.includes('shellState.appVisible')&&shell.includes('function shellCore()')&&shell.includes('window.AGCDSKY_CORE_SESSION'),'shell does not use explicit visibility/core session');
assert(geometry.includes("geometryState.mode==='agc'")&&geometry.includes('shell.show(geometryState.verb,geometryState.noun)')&&geometry.includes("geometryState.mode!=='clock'"),'geometry startup/repaint does not use explicit shared mode/command state through shell service');
assert(identity.includes('!identityState.tickSound'),'relay identity audio does not read shared audio preference');
assert(visual.includes('!visualState.tickSound'),'relay visual layer does not read shared audio preference');
for(const [name,source,alias] of [['snapshot',snapshot,'snapshotCore'],['lifecycle',life,'lifecycleCore'],['API',api,'apiCore'],['relay show',show,'showCore'],['Dream AGC',dream,'dreamCore']])assert(source.includes(alias)&&source.includes('window.AGCDSKY_CORE_SESSION'),`${name} does not bind explicit core session`);
const appState=read('app-state-runtime.js');
assert(appState.includes('window.AGCDSKY_CORE_SESSION = Object.seal({'),'core session bootstrap is missing or unsealed');
assert(appState.includes('window.AGCDSKY_COMPAT = Object.freeze({alias,readonly,get,replace,describe});'),'audited forwarding/read-only compatibility registry API missing');
assert(!appState.includes('function mutable(')&&!appState.includes('function accessor('),'compatibility registry retained mutable ownership primitives');
assert(appState.includes('Object.defineProperty(window, name'),'compatibility registry accessor boundary missing');
for(const name of ['mode','selectedMission','verb','noun','dream','dreamMode','dim','tickSound','displayOnly','appVisible','ntpStatus','agcCore','agcLoadedMission','agcSuspendedForClock','agcPausedForVisibility']){
  assert(!appState.includes(`alias('${name}'`),`state field ${name} must not be registered as a compatibility alias`);
}
assert(renderer.includes('function createImplementationSlot(name,initial,validate=null)'),'renderer owner-backed slot primitive missing');
assert(renderer.includes('compat.alias(name,slot.get'),'renderer compatibility globals are not forwarding aliases');
for(const token of ["compat.mutable('glyph'","compat.mutable('renderDigits'","compat.mutable('set2'","compat.mutable('setLamp'"])assert(!renderer.includes(token),`renderer live implementation state escaped back into compatibility registry: ${token}`);
assert(clock.includes('function createImplementationSlot(name,initial,validate=null)')&&clock.includes('function createStateSlot(name,getter,setter)'),'clock owner-backed slot primitives missing');
assert(clock.includes("digitsStateSlot=createStateSlot('clockDigits'")&&clock.includes("busyStateSlot=createStateSlot('relayBusy'")&&clock.includes('compat.alias(name,slot.get'),'clock backing state is not owner-held behind forwarded aliases');
for(const token of ["compat.accessor('clockDigits'","compat.accessor('clockRelayWords'","compat.accessor('relayQueue'","compat.accessor('relayBusy'","compat.accessor('lampTestActive'","compat.accessor('lampTestTimer'","compat.mutable('renderClockReg'","compat.mutable('runRelayQueue'","compat.mutable('tick'","compat.mutable('lampTest'"])assert(!clock.includes(token),`clock live state escaped back into compatibility registry: ${token}`);
assert(display.includes('function createImplementationSlot(name,initial,validate=null)')&&display.includes('function createStateSlot(name,getter,setter)'),'display owner-backed slot primitives missing');
assert(display.includes("ch11StateSlot=createStateSlot('agcCh11'")&&display.includes("ch13StateSlot=createStateSlot('agcCh13'")&&display.includes("ch163StateSlot=createStateSlot('agcCh163'")&&display.includes('compat.alias(name,slot.get'),'display channel state is not owner-held behind forwarded aliases');
for(const token of ["compat.accessor('agcCh11'","compat.accessor('agcCh13'","compat.accessor('agcCh163'","compat.mutable('relayDigit'","compat.mutable('decodeChannel10'","compat.mutable('decodeChannel11'","compat.mutable('decodeChannel163'","compat.mutable('applySnapshotUi'"])assert(!display.includes(token),`display live state escaped back into compatibility registry: ${token}`);
console.log('late state ownership smoke: PASS');
console.log('  app/core state remains explicit; forwarding/read-only compatibility registry cannot own mutable state; renderer, clock, and display live state stays owner-held behind aliases');