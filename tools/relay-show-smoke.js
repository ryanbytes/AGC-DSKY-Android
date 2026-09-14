'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error(`RELAY SHOW FAIL: ${m}`);process.exit(1);};
const req=(t,n,l)=>{if(!t.includes(n))fail(`${l} missing: ${n}`);};
const no=(t,n,l)=>{if(t.includes(n))fail(`${l} must not contain: ${n}`);};

const show=read('app/src/main/assets/relay-show.js');
const cm=read('app/src/main/assets/cm-mode.js');
const perceptual=read('app/src/main/assets/relay-perceptual-personality.js');

try{new vm.Script(show,{filename:'relay-show.js'});}catch(error){fail(`relay-show syntax error: ${error.message}`);}
try{new vm.Script(perceptual,{filename:'relay-perceptual-personality.js'});}catch(error){fail(`relay personality syntax error: ${error.message}`);}

req(cm,"button.id = 'relay-show'",'controls button');
req(cm,"button.textContent = 'RELAY SHOW'",'controls button label');
req(cm,"script.src = 'relay-show.js'",'feature loader');
req(cm,"script.src = 'relay-perceptual-personality.js'",'perceptible relay personality loader');
req(cm,'installRelayPerceptualPersonality();','perceptible relay personality install order');

req(show,"mode = 'relay-show'",'exclusive demo mode');
req(show,"agcCore.stop()",'AGC task pause');
req(show,"saveAgcState('relay show checkpoint')",'durable pre-show checkpoint');
req(show,'const coreWasRunning = !!(mode === \'agc\' && agcCore && agcCore.running);','pre-stop AGC scheduler-state capture');
req(show,'saved.coreRunning = coreWasRunning;','saved AGC scheduler-state restoration marker');
req(show,'pausedForVisibility: !!agcPausedForVisibility','visibility pause-state snapshot');
req(show,'decodeChannel10','physical bank drive path');
req(show,'NON_DECIMAL_CODES','contact-matrix burst');
req(show,'for (let digit = 0; digit <= 9; digit++)','digit chase');
req(show,'const SHOW_TEMPO = 2.0','slower presentation tempo');
req(show,'const showSleep = ms => sleep(ms * SHOW_TEMPO)','presentation-only timing scale');
req(show,'function relayOperationTiming(row, low11)','per-bank mechanical timing lookup');
req(show,'model.profileFor(row, bit)','individual relay travel profiles');
req(show,'function personalityGapMs(baseMs, timing)','non-metronomic presentation pacing');
req(show,'timing.meanTravelMs','mean travel timing contribution');
req(show,'timing.spreadMs','within-bank travel spread contribution');
req(show,'personalityGapMs(52, timing)','bank sweep personality pacing');
req(show,'personalityGapMs(28, timing)','digit chase personality pacing');
req(show,'personalityGapMs(26, timing)','contact matrix personality pacing');
req(show,'personalityGapMs(54, timing)','finale personality pacing');
req(show,"decodeChannel11(0o46)",'finale auxiliary relay drive');
req(show,"decodeChannel163(0o730)",'finale annunciator relay drive');
req(show,'await showSleep(1000)','slowed full-panel finale hold');
req(show,'saved.latches[row]','physical state restoration');
req(show,'mode = saved.mode','previous mode restoration');
req(show,'agcCore.start(1)','previous AGC task resume');
req(show,'clockRelayWords = {...saved.clockRelayWords}','previous clock task restoration');
req(show,"status('RELAY SHOW · RESTORING PREVIOUS TASK')",'restore status');
req(show,'tickSound = saved.tickSound','sound preference restoration');

// Regression: a long relay show can span an Activity visibility transition.
// setAppVisible() deliberately ignores non-AGC modes, so restore itself must
// mark a hidden, previously-running AGC as visibility-paused. Otherwise the
// core remains stopped forever when the app returns to the foreground.
req(show,"if (appVisible) {",'visibility-aware AGC restore');
req(show,'agcPausedForVisibility = true;','deferred foreground resume marker');
req(show,'agcPausedForVisibility = !!saved.pausedForVisibility;','intentional prior pause restoration');
no(show,'saved.coreRunning && appVisible','old visibility-racy AGC resume condition');

// Regression: any physical/render return-cascade failure must be degraded, not
// fatal to logical ownership restoration. The app must leave relay-show mode,
// release lamp-test ownership, and restore scheduler state even after an error.
req(show,'let restoreError = null;','degraded physical restore accumulator');
req(show,"console.error('Relay show physical restore degraded', restoreError)",'degraded restore logging');
const restoreFn=show.indexOf('async function restorePreviousTask()');
const physicalTry=show.indexOf('let restoreError = null;',restoreFn);
const physicalCatch=show.indexOf('} catch (error) {',physicalTry);
const releaseLamp=show.indexOf('lampTestActive = false;',physicalCatch);
const restoreMode=show.indexOf('mode = saved.mode;',releaseLamp);
const schedulerBranch=show.indexOf("if (saved.mode === 'clock')",restoreMode);
if(!(restoreFn>=0&&physicalTry>restoreFn&&physicalCatch>physicalTry&&releaseLamp>physicalCatch&&restoreMode>releaseLamp&&schedulerBranch>restoreMode)) {
  fail('logical task ownership must be restored after the physical-cascade catch path');
}

// Stretched visual callbacks are asynchronous and may otherwise repaint a demo
// contact after scheduler ownership has returned. Toggle the visual mode only
// in memory to invoke its cancellation barrier without changing user settings.
req(show,'function quiesceRelayPresentation()','stretched presentation cancellation helper');
req(show,"visual.setTimingMode('authentic', false);",'stretched presentation cancellation barrier');
req(show,"visual.setTimingMode('stretched', false);",'stretched mode non-persistent restore');
const quiesceCall=show.indexOf('quiesceRelayPresentation();',restoreFn);
if(!(quiesceCall>physicalCatch&&quiesceCall<releaseLamp)) {
  fail('stretched presentation must be quiesced before logical task ownership is returned');
}

// CLOCK uses a permanent 20-ms service interval, but an immediate face resync
// prevents a restored equal relay state from appearing frozen until a later
// time digit changes.
req(show,'syncClockFace();','immediate clock catch-up after relay show');
const clockBranch=show.indexOf("if (saved.mode === 'clock')",restoreFn);
const clockSync=show.indexOf('syncClockFace();',clockBranch);
const agcBranch=show.indexOf("} else if (saved.mode === 'agc' && agcCore) {",clockBranch);
if(!(clockSync>clockBranch&&agcBranch>clockSync)) fail('clock face must resync inside the clock restore branch');

req(perceptual,'window.DSKY_RELAY_AUDIO.profileFor','authoritative individual-relay profile source');
req(perceptual,"localStorage.getItem('dskyHardwareUnitSeedV1')",'stable installed-unit identity');
req(perceptual,'p.setTravelMs','set travel controls audible impact timing');
req(perceptual,'p.resetTravelMs','reset travel controls audible impact timing');
req(perceptual,'const pitchScale = 0.86 + serial * 0.28','phone-audible relay timbre spread');
req(perceptual,"model: 'deterministic-installed-unit-audible-spread-v1'",'diagnostic model marker');
no(perceptual,'Math.random(','non-deterministic relay identity');

const runningCapture=show.indexOf("const coreWasRunning = !!(mode === 'agc' && agcCore && agcCore.running);");
const agcStop=show.indexOf('\n      agcCore.stop();');
const settledCapture=show.indexOf('saved = captureSettledState();');
const runningRestore=show.indexOf('saved.coreRunning = coreWasRunning;');
if(!(runningCapture >= 0 && agcStop > runningCapture && settledCapture > agcStop && runningRestore > settledCapture)) {
  fail('AGC running state must be captured before stop and restored onto the settled snapshot');
}

const personalityInstall=cm.indexOf('installRelayPerceptualPersonality();');
const relayShowInstall=cm.indexOf('installRelayShow();');
if(!(personalityInstall >= 0 && relayShowInstall > personalityInstall)) {
  fail('relay personality layer must load before RELAY SHOW is installed');
}

// User explicitly rejected a brightness flare. The demo may change only relay
// driven DSKY state; it must not add transient optical enhancement effects.
no(show,'brightness(','brightness flare');
no(show,'filter:','CSS/filter flare');
no(show,'classList.add(\'relay-flare\'','relay flare class');

console.log('Relay show smoke: PASS');
console.log('  relay identities, visibility-safe resume, exception-safe ownership restore, and stretched-callback cancellation verified');
