#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const asset = name => fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets', name), 'utf8');
const keycodeSource = asset('dsky-keycodes.js');
const transitionSource = asset('runtime-transitions.js');
const clockSource = asset('clock-behavior.js');
const fail = message => { console.error('CLOCK MODE BEHAVIOR FAIL: ' + message); process.exit(1); };
const KEY_CODES = Object.freeze({
  '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
  V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
});

for (const marker of [
  'const baseEnterAgc = api.enterAgc','function beginAgc(','await baseEnterAgc()',
  'if (transitionPromise) return transitionPromise','ready:next.mode === MODES.AGC',
  'window.enterAgc = sharedEnterAgc','api.enterAgc = sharedEnterAgc','api.runtimeTransitions = runtime'
]) if (!transitionSource.includes(marker)) fail('missing runtime-transition marker: ' + marker);
for (const forbidden of ['waitForAgcReady','LOAD_POLL_MS','MAX_LOAD_POLLS']) {
  if (transitionSource.includes(forbidden)) fail('runtime transition service still contains polling fallback: ' + forbidden);
}
for (const marker of [
  'const AGC_KEY = window.AGCDSKY_KEY_CODES;',"requestAgc('clock keypad fallback')",
  'core.keyPress(code)',"scheduleAgcAutosave('clock keypad handoff')",'api.clockBehavior = clockBehavior'
]) if (!clockSource.includes(marker)) fail('missing clock-fallback marker: ' + marker);
for (const forbidden of ['[data-lamp="comp"]','Math.random','randomBetween','startClockCompBurst','scheduleClockCompIdle']) {
  if (clockSource.includes(forbidden)) fail('clock COMP ACTY synthesis must remain disabled: ' + forbidden);
}
if (/fetch\s*\(/.test(keycodeSource + transitionSource + clockSource) || /XMLHttpRequest/.test(keycodeSource + transitionSource + clockSource)) {
  fail('clock transition behavior must not be tied to network activity');
}

function createHarness(initialMode = 'clock') {
  let mode = initialMode;
  let enterCount = 0;
  let enterImpl = async () => {
    enterCount++;
    if (mode === 'agc-loading') return;
    mode = 'agc-loading'; await Promise.resolve(); mode = 'agc';
  };
  const keyPresses = [], handlers = {}, timers = [];
  const core = {keyPress(code){ keyPresses.push(code); }};
  const AGCDSKY = {
    appStatus(){ return {mode}; }, enterAgc(){ return enterImpl(); }, getCore(){ return core; },
    scheduleAgcAutosave(reason){ AGCDSKY.savedReason = reason; }
  };
  const context = {
    AGC_KEY:KEY_CODES, AGCDSKY, document:{addEventListener(name,fn){ handlers[name] = fn; }},
    console, setTimeout(fn,delay){ timers.push({fn,delay}); return timers.length; }, clearTimeout(){}, Promise, window:null
  };
  context.window = context;
  context.enterAgc = AGCDSKY.enterAgc;
  const baseEnterAgc = context.enterAgc;
  vm.createContext(context);
  vm.runInContext(keycodeSource, context, {filename:'dsky-keycodes.js'});
  if (!context.AGCDSKY_KEY_CODES || !Object.isFrozen(context.AGCDSKY_KEY_CODES)) fail('shared DSKY keycodes did not initialize frozen');
  if (context.AGCDSKY_KEY_CODES === KEY_CODES) fail('shared DSKY keycodes must be a frozen copy');
  vm.runInContext(transitionSource, context, {filename:'runtime-transitions.js'});
  if (context.enterAgc === baseEnterAgc || context.AGCDSKY.enterAgc !== context.enterAgc) {
    fail('runtime service did not replace both global/API AGC entry references');
  }
  vm.runInContext(clockSource, context, {filename:'clock-behavior.js'});
  if (!AGCDSKY.clockBehavior) fail('clock fallback did not initialize with shared keycodes');
  return {AGCDSKY, context, handlers, timers, keyPresses,
    get mode(){return mode;}, set mode(v){mode=v;}, get enterCount(){return enterCount;}, setEnterImpl(fn){enterImpl=fn;}};
}
function key(name){return {dataset:{key:name},classList:{add(){},remove(){}},closest(s){return s==='[data-key]'?this:null;}};}
function press(h,name){let prevented=false,stopped=false;h.handlers.pointerdown({target:key(name),preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});if(!prevented||!stopped)fail(`${name} clock keypad event was not intercepted`);}
async function flush(n=20){for(let i=0;i<n;i++)await Promise.resolve();}

(async()=>{
  const fresh=createHarness();
  if(fresh.timers.length)fail('clock mode started an unsolicited timer before keypad input');
  press(fresh,'V'); await flush();
  if(fresh.mode!=='agc'||fresh.enterCount!==1)fail('first-key handoff did not start exactly one AGC transition');
  if(fresh.keyPresses.length!==1||fresh.keyPresses[0]!==0o21)fail('original VERB key was not forwarded to the AGC');
  if(fresh.AGCDSKY.savedReason!=='clock keypad handoff')fail('handoff did not schedule AGC autosave');
  if(fresh.timers.length!==1||fresh.timers[0].delay!==90)fail('only keypad press animation timer should remain');
  const rs=fresh.AGCDSKY.runtimeTransitions.snapshot(),cs=fresh.AGCDSKY.clockBehavior.snapshot();
  if(rs.mode!=='agc'||rs.transitionInFlight||!rs.lastTransition||rs.lastTransition.reason!=='clock keypad fallback'||!rs.lastTransition.ready)fail('runtime transition did not settle after fallback handoff');
  if(cs.promotionInFlight||cs.pendingKeys.length)fail('clock fallback queue did not settle');

  const queued=createHarness(); let releaseLoad;
  queued.setEnterImpl(()=>{queued.mode='agc-loading';return new Promise(resolve=>{releaseLoad=()=>{queued.mode='agc';resolve();};});});
  press(queued,'V'); press(queued,'N'); await flush(2);
  if(queued.AGCDSKY.clockBehavior.snapshot().pendingKeys.join(',')!=='V,N')fail('fallback contacts were not queued in order');
  releaseLoad(); await flush();
  if(queued.keyPresses.join(',')!==`${0o21},${0o37}`)fail('queued fallback contacts were not forwarded in order');

  const loading=createHarness(); let releaseDirectLoad,directStarts=0;
  loading.setEnterImpl(()=>{directStarts++;loading.mode='agc-loading';return new Promise(resolve=>{releaseDirectLoad=()=>{loading.mode='agc';resolve();};});});
  const directPromise=loading.context.enterAgc(); await flush(2); press(loading,'V'); await flush(3);
  if(directStarts!==1)fail('keypad handoff restarted the underlying AGC loader');
  if(loading.timers.some(t=>t.delay===10))fail('shared app entry unexpectedly fell back to polling');
  releaseDirectLoad(); await directPromise; await flush();
  if(loading.keyPresses.length!==1||loading.keyPresses[0]!==0o21)fail('key was dropped while direct app AGC load was in flight');
  if(loading.AGCDSKY.runtimeTransitions.snapshot().lastTransition?.reason!=='app enterAgc')fail('direct app transition ownership was not retained');

  const failed=createHarness(); let finishFailure;
  failed.setEnterImpl(()=>{failed.mode='agc-loading';return new Promise(resolve=>{finishFailure=()=>{failed.mode='clock';resolve();};});});
  const appFailure=failed.context.enterAgc();
  const required=failed.AGCDSKY.runtimeTransitions.requestAgc('keyboard readiness test');
  await flush(2); finishFailure();
  const appResult=await appFailure;
  if(!appResult||appResult.mode!=='clock')fail('direct app entry no longer resolves with clock fallback state');
  let rejected=false;try{await required;}catch(error){rejected=/ended in clock mode/.test(String(error?.message||error));}
  if(!rejected)fail('AGC-required caller did not reject after app fallback to clock');

  console.log('Clock mode behavior: PASS');
  console.log('  shared keycodes, shared entry, fallback queue, no polling, and app-failure compatibility verified');
})().catch(error=>fail(error.stack||String(error)));
