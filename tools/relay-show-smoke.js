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
const html=read('app/src/main/assets/index.html');
const cm=read('app/src/main/assets/cm-mode.js');
const perceptual=read('app/src/main/assets/relay-perceptual-personality.js');

try{new vm.Script(show,{filename:'relay-show.js'});}catch(error){fail(`relay-show syntax error: ${error.message}`);}
try{new vm.Script(perceptual,{filename:'relay-perceptual-personality.js'});}catch(error){fail(`relay personality syntax error: ${error.message}`);}

// CM configuration no longer injects presentation features. The button and
// scripts are parser-owned by index.html, so test the actual owner and order.
req(cm,'this module owns configuration only and performs no script injection','CM parser-ownership contract');
req(html,'<button id="relay-show">RELAY SHOW</button>','controls button');
req(html,'<script src="relay-perceptual-personality.js" data-feature="relay-perceptual-personality"></script>','perceptible relay personality parser entry');
req(html,'<script src="relay-show.js" data-feature="relay-show"></script>','relay show parser entry');
const personalityInstall=html.indexOf('<script src="relay-perceptual-personality.js"');
const relayShowInstall=html.indexOf('<script src="relay-show.js"');
if(!(personalityInstall>=0&&relayShowInstall>personalityInstall)) {
  fail('relay personality layer must load before RELAY SHOW');
}

// Runtime-service refactor: RELAY SHOW must use the explicit shared services,
// not reach back into the retired page globals that those services replaced.
for(const token of [
  'window.AGCDSKY_APP_STATE',
  'window.AGCDSKY_CORE_SESSION',
  'window.AGCDSKY_COMPAT',
  'window.AGCDSKY_SHELL',
  'window.AGCDSKY_AUDIO',
  'window.AGCDSKY_CLOCK',
  'window.AGCDSKY_DISPLAY',
  'window.AGCDSKY_SNAPSHOT',
  'window.AGCDSKY_HARDWARE'
]) req(show,token,'runtime service dependency');

req(show,"showState.mode='relay-show'",'exclusive demo mode');
req(show,'core.stop()','AGC task pause');
req(show,"snapshot.save('relay show checkpoint')",'durable pre-show checkpoint');
req(show,"const core=showCore.core,coreWasRunning=!!(showState.mode==='agc'&&core&&core.running);",'pre-stop AGC scheduler-state capture');
req(show,'saved.coreRunning=coreWasRunning;','saved AGC scheduler-state restoration marker');
req(show,'pausedForVisibility:!!showCore.pausedForVisibility','visibility pause-state snapshot');
req(show,"compat.get('decodeChannel10')",'physical bank drive path');
req(show,'NON_DECIMAL_CODES','contact-matrix burst');
req(show,'for(let digit=0;digit<=9;digit++)','digit chase');
req(show,'SHOW_TEMPO=2.0','slower presentation tempo');
req(show,'showSleep=ms=>sleep(ms*SHOW_TEMPO)','presentation-only timing scale');
req(show,'function relayOperationTiming(row,low11)','per-bank mechanical timing lookup');
req(show,'model.profileFor(row,bit)','individual relay travel profiles');
req(show,'function personalityGapMs(baseMs,timing)','non-metronomic presentation pacing');
req(show,'timing.meanTravelMs','mean travel timing contribution');
req(show,'timing.spreadMs','within-bank travel spread contribution');
req(show,'personalityGapMs(52,timing)','bank sweep personality pacing');
req(show,'personalityGapMs(28,timing)','digit chase personality pacing');
req(show,'personalityGapMs(26,timing)','contact matrix personality pacing');
req(show,'personalityGapMs(54,timing)','finale personality pacing');
req(show,'decode11(0o46)','finale auxiliary relay drive');
req(show,'decode163(0o730)','finale annunciator relay drive');
req(show,'await showSleep(1000)','slowed full-panel finale hold');
req(show,'saved.latches[row]','physical state restoration');
req(show,'showState.mode=saved.mode','previous mode restoration');
req(show,'core.start(1)','previous AGC task resume');
req(show,"compat.replace('clockRelayWords',{...saved.clockRelayWords},'relay show restore')",'previous clock task restoration');
req(show,"compat.replace('lampTestActive',false,'relay show restore')",'lamp-test ownership release');
req(show,"status('RELAY SHOW · RESTORING PREVIOUS TASK')",'restore status');
req(show,'showState.tickSound=saved.tickSound','sound preference restoration');

// Regression: a long relay show can span an Activity visibility transition.
// Core-session visibility ownership must survive the demo and either resume the
// previously-running AGC immediately or leave a deferred foreground marker.
req(show,'if(showState.appVisible){','visibility-aware AGC restore');
req(show,'showCore.pausedForVisibility=true;','deferred foreground resume marker');
req(show,'showCore.pausedForVisibility=!!saved.pausedForVisibility;','intentional prior pause restoration');
no(show,'saved.coreRunning&&appVisible','old visibility-racy AGC resume condition');
no(show,'agcPausedForVisibility','retired visibility global');

// Regression: any physical/render return-cascade failure must be degraded, not
// fatal to logical ownership restoration. The app must leave relay-show mode,
// release lamp-test ownership, and restore scheduler state even after an error.
req(show,'let restoreError=null;','degraded physical restore accumulator');
req(show,"console.error('Relay show physical restore degraded',restoreError)",'degraded restore logging');
const restoreFn=show.indexOf('async function restorePreviousTask()');
const physicalTry=show.indexOf('let restoreError=null;',restoreFn);
const physicalCatch=show.indexOf('}catch(error){restoreError=error}',physicalTry);
const releaseLamp=show.indexOf("compat.replace('lampTestActive',false,'relay show restore')",physicalCatch);
const restoreMode=show.indexOf('showState.mode=saved.mode;',releaseLamp);
const schedulerBranch=show.indexOf("if(saved.mode==='clock')",restoreMode);
if(!(restoreFn>=0&&physicalTry>restoreFn&&physicalCatch>physicalTry&&releaseLamp>physicalCatch&&restoreMode>releaseLamp&&schedulerBranch>restoreMode)) {
  fail('logical task ownership must be restored after the physical-cascade catch path');
}

// Stretched visual callbacks are asynchronous and may otherwise repaint a demo
// contact after scheduler ownership has returned. Toggle the visual mode only
// in memory to invoke its cancellation barrier without changing user settings.
req(show,'function quiesceRelayPresentation()','stretched presentation cancellation helper');
req(show,"visual.setTimingMode('authentic',false);",'stretched presentation cancellation barrier');
req(show,"visual.setTimingMode('stretched',false);",'stretched mode non-persistent restore');
const quiesceCall=show.indexOf('quiesceRelayPresentation()',restoreFn);
if(!(quiesceCall>physicalCatch&&quiesceCall<releaseLamp)) {
  fail('stretched presentation must be quiesced before logical task ownership is returned');
}

// CLOCK uses a permanent service interval, but an immediate face resync
// prevents a restored equal relay state from appearing frozen until a later
// time digit changes.
req(show,'clock.syncFace();','immediate clock catch-up after relay show');
const clockBranch=show.indexOf("if(saved.mode==='clock')",restoreFn);
const clockSync=show.indexOf('clock.syncFace();',clockBranch);
const agcBranch=show.indexOf("}else if(saved.mode==='agc'&&showCore.core){",clockBranch);
if(!(clockSync>clockBranch&&agcBranch>clockSync)) fail('clock face must resync inside the clock restore branch');

// Perceptual personality was also moved behind explicit services. Keep the
// deterministic installed-unit identity and authoritative physical travel
// profiles, but do not require the retired direct-global spelling.
for(const token of [
  'window.AGCDSKY_COMPAT',
  'window.AGCDSKY_ENVIRONMENT',
  'window.AGCDSKY_HARDWARE',
  'const audioModel=window.DSKY_RELAY_AUDIO;'
]) req(perceptual,token,'relay personality service dependency');
req(perceptual,'audioModel.profileFor(row,bit)','authoritative individual-relay profile source');
req(perceptual,"localStorage.getItem('dskyHardwareUnitSeedV1')",'stable installed-unit identity');
req(perceptual,'p.setTravelMs','set travel controls audible impact timing');
req(perceptual,'p.resetTravelMs','reset travel controls audible impact timing');
req(perceptual,'pitchScale=.86+serial*.28','phone-audible relay timbre spread');
req(perceptual,"model:'deterministic-installed-unit-audible-spread-v1'",'diagnostic model marker');
no(perceptual,'Math.random(','non-deterministic relay identity');

const runningCapture=show.indexOf("const core=showCore.core,coreWasRunning=!!(showState.mode==='agc'&&core&&core.running);");
const agcStop=show.indexOf('core.stop()',runningCapture);
const settledCapture=show.indexOf('saved=captureSettledState();',agcStop);
const runningRestore=show.indexOf('saved.coreRunning=coreWasRunning;',settledCapture);
if(!(runningCapture>=0&&agcStop>runningCapture&&settledCapture>agcStop&&runningRestore>settledCapture)) {
  fail('AGC running state must be captured before stop and restored onto the settled snapshot');
}

// The refactored module must not regain ownership through its retired globals.
for(const retired of [
  'saveAgcState(',
  'agcCore.',
  'agcPausedForVisibility',
  'mode = saved.mode',
  'tickSound = saved.tickSound'
]) no(show,retired,'retired relay-show global');

// User explicitly rejected a brightness flare. The demo may change only relay
// driven DSKY state; it must not add transient optical enhancement effects.
no(show,'brightness(','brightness flare');
no(show,'filter:','CSS/filter flare');
no(show,"classList.add('relay-flare'",'relay flare class');

console.log('Relay show smoke: PASS');
console.log('  parser-owned loading, runtime-service ownership, relay identities, visibility-safe resume, exception-safe restore, and stretched-callback cancellation verified');
