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
const diagnostics=read('app/src/main/assets/diagnostics.js');

new vm.Script(show,{filename:'relay-show.js'});

/* Parser ownership. cm-mode is configuration-only now. */
req(cm,'performs no script injection','CM parser-ownership contract');
forbid(cm,'relay-show.js','CM configuration boundary');
forbid(html,'id="relay-show"','primary options relay-show control');
req(diagnostics,'id="diag-relay-show"','diagnostics relay-show control');
req(diagnostics,"lateService('AGCDSKY_RELAY_SHOW')",'diagnostics relay-show service action');
forbid(show,"document.getElementById('relay-show')",'relay-show menu-button ownership');
forbid(html,'relay-perceptual-personality.js','unsupported per-package relay personality layer');
ordered(html,[
  '<script src="relay-identity-audio.js"',
  '<script src="relay-visual-coupling.js"',
  '<script src="relay-show.js"',
  '<script src="parallax-3d.js"'
],'source-bounded relay presentation parser order');

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

/* Relay-show choreography must not synthesize package-specific mechanics or acoustic identity. */
for(const token of ['profileFor(', 'personalityGapMs', 'meanTravelMs', 'spreadMs', 'dskyHardwareUnitSeedV1', 'deterministic-installed-unit-audible-spread-v1'])
  forbid(show,token,'relay-show synthetic per-package personality');
req(html,'<script src="relay-identity-audio.js"','source-bounded relay audio model');
req(html,'<script src="relay-visual-coupling.js"','single relay presentation-event authority');

/* User explicitly rejected synthetic brightness/glare effects. */
for(const token of ['brightness(','relay-flare','filter:']) forbid(show,token,'relay-show optical hack');

console.log('Relay show smoke: PASS');
console.log('  diagnostics-owned launch control, registry-backed service ownership, fixed show choreography, source-bounded relay event authority, checkpoint/restore sequencing, visibility-safe resume, and no synthetic package personality verified');
