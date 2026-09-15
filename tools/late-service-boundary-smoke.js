#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const files=['dsky-geometry.js','dsky-relay-matrix.js','hardware-fidelity.js','relay-identity-audio.js','relay-visual-coupling.js','relay-stretch-stability.js','background-audio-guard.js','relay-perceptual-personality.js','relay-show.js','screen-only.js','relay-audio-refine.js','dream-silence.js'];
const mutableNames=['glyph','signGlyph','renderDigits','renderReg','set2','setReg','setLamp','clearLamps','ensureAudio','emitTick','playRelayBurst','applyTickSound','renderClockReg','syncClockFace','stopClockQueue','runRelayQueue','tick','cancelLampTest','lampTest','relayDigit','renderAgcReg','resetAgcFace','decodeChannel10','decodeChannel11','decodeChannel13','decodeChannel163','applySnapshotUi'];
function directAssign(source,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(^|[;{}\\n])\\s*${escaped}\\s*=\\s*(?!=)`,'m').test(source)}
for(const name of files){const source=read(name);for(const slot of mutableNames)assert(!directAssign(source,slot),`${name} directly assigns compatibility slot ${slot}`)}
const geometry=read('dsky-geometry.js'),hardware=read('hardware-fidelity.js'),identity=read('relay-identity-audio.js'),visual=read('relay-visual-coupling.js'),stretch=read('relay-stretch-stability.js'),guard=read('background-audio-guard.js'),perceptual=read('relay-perceptual-personality.js'),relayShow=read('relay-show.js'),screen=read('screen-only.js'),api=read('agc-api-runtime.js'),display=read('agc-display-runtime.js');
for(const [name,source,markers] of [
 ['geometry',geometry,["compat.replace('glyph'","compat.replace('renderDigits'",'const renderer=window.AGCDSKY_RENDERER;','const clock=window.AGCDSKY_CLOCK;','const display=window.AGCDSKY_DISPLAY;']],
 ['hardware',hardware,['window.AGCDSKY_HARDWARE=Object.freeze({',"compat.replace('decodeChannel10'","compat.replace('runRelayQueue'",'registerSnapshotExtension','registerSettledPaintPolicy','display.commitRelayWord']],
 ['identity',identity,["compat.replace('emitTick'",'hardware.registerSnapshotExtension','const environment=window.AGCDSKY_ENVIRONMENT;']],
 ['visual',visual,["compat.replace('emitTick'","compat.replace('decodeChannel10'",'hardware.registerSettledPaintPolicy','display.renderRelayWord']],
 ['stretch',stretch,["compat.replace('set2'","compat.replace('setReg'","compat.replace('decodeChannel10'",'visual.withSettledWordOverride']],
 ['guard',guard,["compat.replace('ensureAudio'","compat.replace('applyTickSound'","compat.replace('emitTick'","compat.replace('playRelayBurst'",'window.AGCDSKY_AUDIO_RECOVERY=Object.freeze({']],
 ['perceptual',perceptual,["compat.replace('emitTick'",'const hardware=window.AGCDSKY_HARDWARE;','const environment=window.AGCDSKY_ENVIRONMENT;']],
 ['relay show',relayShow,['hardware=window.AGCDSKY_HARDWARE',"compat.get('decodeChannel10')",'display.setChannelState',"compat.replace('clockDigits'",'window.AGCDSKY_RELAY_SHOW=Object.freeze({']],
 ['screen only',screen,['const shell=window.AGCDSKY_SHELL;','const audio=window.AGCDSKY_AUDIO;','audio.applySetting()']]
])for(const marker of markers)assert(source.includes(marker),`${name} explicit service marker missing: ${marker}`);
for(const source of [hardware,identity,visual,stretch,guard,perceptual])assert(!source.includes('window.AGCDSKY.hardware ='),'late layer monkey-patches public hardware API');assert(!stretch.includes('host.setTimeout =')&&!stretch.includes('window.AGCDSKY.hardware ='),'stretch stability regained global timer/hardware monkey-patching');assert(!guard.includes('applySnapshotUi =')&&!guard.includes('renderAgcReg =')&&!guard.includes('agcDisplay.')&&!guard.includes('agcRelayWords'),'audio recovery guard regained display/snapshot ownership');assert(!relayShow.includes('entryMode')&&!/\bentry\s*=/.test(relayShow),'relay show retained dead pre-service entry state');assert(!relayShow.includes('window.AGCDSKY.relayShow ='),'relay show must not replace stable public facade delegate');
assert(api.includes('hardware:publicHardware')&&api.includes('audioStatus:publicAudioStatus')&&api.includes('relayShow:publicRelayShow'),'public facade late-service delegates missing');assert(display.includes('function projectRelayWord(')&&display.includes('function commitRelayWord(')&&display.includes('setChannelState'),'display service does not own relay projection/channel backing state');
console.log('late service boundary smoke: PASS');console.log('  late geometry/hardware/audio/visual/show layers use explicit services or compat get/replace; no bare slot, timer, or public-API monkey-patching remains');
