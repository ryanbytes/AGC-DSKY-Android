'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{throw new Error(`RELAY SHOW FAIL: ${m}`)};
const req=(text,token,label)=>{if(!text.includes(token))fail(`${label} missing: ${token}`)};
const forbid=(text,token,label)=>{if(text.includes(token))fail(`${label} must not contain: ${token}`)};
const ordered=(text,tokens,label)=>{
  let at=-1;
  for(const token of tokens){const next=text.indexOf(token,at+1);if(next<0||next<=at)fail(`${label} order broken at: ${token}`);at=next;}
};

const html=read('app/src/main/assets/index.html');
const cm=read('app/src/main/assets/cm-mode.js');
const show=read('app/src/main/assets/relay-show.js');
const perceptual=read('app/src/main/assets/relay-perceptual-personality.js');

new vm.Script(show,{filename:'relay-show.js'});
new vm.Script(perceptual,{filename:'relay-perceptual-personality.js'});

/* Parser ownership. cm-mode is configuration-only now. */
req(cm,'performs no script injection','CM parser-ownership contract');
forbid(cm,'relay-show.js','CM configuration boundary');
req(html,'<button id="relay-show">RELAY SHOW</button>','relay-show control');
ordered(html,[
  '<script src="relay-perceptual-personality.js"',
  '<script src="relay-show.js"',
  '<script src="parallax-3d.js"'
],'presentation parser order');

/* Explicit runtime-service ownership. */
for(const token of [
  'window.AGCDSKY_APP_STATE','window.AGCDSKY_CORE_SESSION',
  'window.AGCDSKY_SHELL','window.AGCDSKY_AUDIO','window.AGCDSKY_CLOCK',
  'window.AGCDSKY_DISPLAY','window.AGCDSKY_SNAPSHOT',
  "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')"
]) req(show,token,'relay-show service dependency');
forbid(show,'AGCDSKY_COMPAT','relay-show direct compatibility dependency');
forbid(show,'window.AGCDSKY_HARDWARE','relay-show late-service compatibility read');
for(const retired of ['agcCore.','agcPausedForVisibility','saveAgcState('])
  forbid(show,retired,'retired relay-show global');

/* Preflight must checkpoint a running AGC before taking relay ownership. */
ordered(show,[
  "const core=showCore.core,coreWasRunning=!!(showState.mode==='agc'&&core&&core.running)",
  "snapshot.save('relay show checkpoint')",
  'core.stop()',
  'clock.stopQueue()',
  'clock.setLampTestActive(true)',
  'saved=captureSettledState()',
  'saved.coreRunning=coreWasRunning',
  "showState.mode='relay-show'"
],'relay-show preflight');

/* Choreography uses display-owned decoders and clock-owned relay codes/state. */
for(const token of [
  "display.implementation('decodeChannel10')","display.implementation('decodeChannel11')","display.implementation('decodeChannel163')",
  'clock.digitRelayCode(digit)','clock.snapshotBackingState()',
  'model.profileFor(row,bit)','timing.meanTravelMs','timing.spreadMs',
  'NON_DECIMAL_CODES','for(let digit=0;digit<=9;digit++)','decode11(0o46)','decode163(0o730)',
  'await showSleep(1000)'
]) req(show,token,'physical relay choreography');
for(const token of ["compat.get('decodeChannel10')","compat.get('decodeChannel11')","compat.get('decodeChannel163')","compat.get('clockDigits')","compat.get('clockRelayWords')"])
  forbid(show,token,'relay-show ownership bypass');

/* Restore physical state first, quiesce delayed visual callbacks, then return ownership. */
const restoreStart=show.indexOf('async function restorePreviousTask()');
if(restoreStart<0)fail('restorePreviousTask missing');
const restore=show.slice(restoreStart);
ordered(restore,[
  'let restoreError=null',
  'saved.latches[row]',
  'quiesceRelayPresentation()',
  'clock.restoreBackingState({digits:saved.clockDigits,relayWords:saved.clockRelayWords})',
  'clock.setLampTestActive(false)',
  'showState.mode=saved.mode'
],'relay-show restore ownership');
for(const token of [
  "visual.setTimingMode('authentic',false)","visual.setTimingMode('stretched',false)",
  'clock.syncFace()','core.start(1)','if(showState.appVisible){',
  'showCore.pausedForVisibility=true','showCore.pausedForVisibility=!!saved.pausedForVisibility',
  "console.error('Relay show physical restore degraded',restoreError)"
]) req(show,token,'safe relay-show restore');
forbid(show,'saved.coreRunning&&appVisible','old visibility-racy resume path');

/* Relay personality stays deterministic and derives timing from the physical model. */
for(const token of [
  'window.AGCDSKY_AUDIO','window.AGCDSKY_ENVIRONMENT',
  "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')",
  'const audioModel=window.DSKY_RELAY_AUDIO','audioModel.profileFor(row,bit)',
  "audio.implementation('emitTick')","audio.installImplementation('emitTick'",
  "localStorage.getItem('dskyHardwareUnitSeedV1')",'p.setTravelMs','p.resetTravelMs',
  "model:'deterministic-installed-unit-audible-spread-v1'"
]) req(perceptual,token,'relay personality contract');
forbid(perceptual,'AGCDSKY_COMPAT','relay personality direct compatibility dependency');
forbid(perceptual,'window.AGCDSKY_HARDWARE','relay personality late-service compatibility read');
forbid(perceptual,'Math.random(','non-deterministic relay identity');

/* User explicitly rejected synthetic brightness/glare effects. */
for(const token of ['brightness(','relay-flare','filter:']) forbid(show,token,'relay-show optical hack');

console.log('Relay show smoke: PASS');
console.log('  parser order, registry-backed service ownership, display/clock-owned choreography, checkpoint/restore sequencing, visibility-safe resume, physical relay timing, deterministic identity, and no synthetic flare verified');
