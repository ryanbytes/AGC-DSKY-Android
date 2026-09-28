#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const topologySource=read('app/src/main/assets/dsky-relay-topology.js');
const identity=read('app/src/main/assets/relay-identity-audio.js');
const coupling=read('app/src/main/assets/relay-visual-coupling.js');
const bridge=read('app/src/main/java/org/apollo/agcdsky/KeyHapticBridge.java');
function assert(c,m){if(!c)throw new Error(m)}

for(const marker of [
  'hapticSignatureFromProfile','hapticPatternFromProfile','contactHapticSignatureFromProfile','waveformFromPatterns',
  'hapticPatternFor:','contactHapticSignatureFor:','relayBankHapticPatternFor:','hapticsEnabled:','playRelayContactHaptic','playRelayBankHaptic',
  'auxiliaryHapticPatternFor:',"typeof native.relayWaveform==='function'"
])assert(identity.includes(marker),'relay identity haptic path missing: '+marker);
assert(identity.includes('const PHYSICAL_RELAY_COUNT = topology.physicalRelayCount;'),'relay identity must derive total physical relay count from topology');
assert(identity.includes('const LATCHING_PRESENTATION_REFERENCE_MS = 3;'),'latching timing must use the source-bounded 3-ms predecessor reference');
assert(identity.includes('const NON_LATCHING_PRESENTATION_REFERENCE_MS = 5;'),'non-latching timing must use the source-bounded 5-ms predecessor reference');
assert(identity.includes('production-2004688-exact-timing-unresolved'),'production 2004688 timing uncertainty must be explicit');
assert(identity.includes('production-2004689-exact-timing-unresolved'),'production 2004689 timing uncertainty must be explicit');
assert(!identity.includes('manufacturingProfile('),'synthetic relay manufacturing timing returned');
assert(!identity.includes('positionPhase'),'synthetic per-ordinal timing phase returned');
assert(!identity.includes('serialOffset='),'synthetic per-relay acoustic serial offset returned');

for(const marker of [
  'audioModel.playRelayBankHaptic?.(','audioModel.playAuxHaptic?.(name,on)',
  'hapticBankComposed:true','stretchedHapticFrameLocked:true'
])assert(coupling.includes(marker),'relay bank/haptic coupling missing: '+marker);
assert(!coupling.includes('audioModel.playRelayHaptic?.(motion.row,motion.bit,motion.on)'),
  'per-relay native vibration dispatch returned and can overwrite earlier pulses');

for(const marker of [
  'RELAY_MIN_MS = 1L','RELAY_MAX_MS = 1L','RELAY_MIN_AMPLITUDE = 1','RELAY_MAX_AMPLITUDE = 3',
  'RELAY_MAX_WAVEFORM_SEGMENTS = 192','RELAY_MAX_WAVEFORM_MS = 750L',
  'relayWaveform(String timingsCsv, String amplitudesCsv)',
  'VibrationEffect.createWaveform(timings, amplitudes, -1)',
  'vibrator.hasAmplitudeControl()'
])assert(bridge.includes(marker),'native relay waveform bridge missing: '+marker);
assert(bridge.includes('performRelayOneShot'),'minimum relay one-shot path missing');
assert(!bridge.includes('amplitudes[i] == 0 ? 0 : 255'),'relay waveform must not promote tiny pulses to full-strength 255 fallback');

const waveformCalls=[],impactCalls=[];let browserCalls=0;
const hardware={snapshot(){return {auxRelays:{}}},registerSnapshotExtension(){}};
const context={
  console,Math,Date,Object,Array,Number,String,Map,Set,
  setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},
  navigator:{userActivation:{hasBeenActive:false},vibrate(){browserCalls++;return true}},
  document:{getElementById(){return null}},
  AGCDSKY_APP_STATE:{tickSound:false,relayHaptics:true},
  AGCDSKY_ENVIRONMENT:{tickLevel(){return 1}},
  AGCDSKY_AUDIO:{implementation(){return()=>true},installImplementation(){},ensure(){return null}},
  AGCDSKY_SERVICE_REGISTRY:{get(name){return name==='AGCDSKY_HARDWARE'?hardware:null}},
  HapticBridge:{
    available(){return true},
    relayImpact(durationMs,amplitude){impactCalls.push({durationMs,amplitude});return true},
    relayWaveform(timingsCsv,amplitudesCsv){waveformCalls.push({timingsCsv,amplitudesCsv});return true}
  }
};
context.window=context;vm.createContext(context);
vm.runInContext(topologySource,context,{filename:'dsky-relay-topology.js'});
const topology=context.DSKY_RELAY_TOPOLOGY;
vm.runInContext(identity,context,{filename:'relay-identity-audio.js'});
const model=context.DSKY_RELAY_AUDIO;
assert(model&&typeof model.hapticPatternFor==='function'&&typeof model.playRelayBankHaptic==='function','relay haptic waveform API missing');

const setPatterns=[],resetPatterns=[];
for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
  const physical=topology.isLatchingRelay(row,bit);
  const set=model.hapticPatternFor(row,bit,true),reset=model.hapticPatternFor(row,bit,false);
  if(!physical){
    assert(set===null&&reset===null,`unpopulated relay row ${row} bit ${bit} received a haptic profile`);
    assert(model.playRelayHaptic(row,bit,true)===false,`unpopulated relay row ${row} bit ${bit} dispatched a haptic`);
    continue;
  }
  setPatterns.push(set);resetPatterns.push(reset);
  assert(set.pulses.length===1,'set haptic must contain exactly one armature tick');
  assert(reset.pulses.length===1,'reset haptic must contain exactly one armature tick');
  assert(set.pulses[0].kind==='armature'&&reset.pulses[0].kind==='armature','armature pulse missing');
  assert(set.pulses[0].durationMs===1&&set.pulses[0].amplitude===1,'set armature tick must stay at 1 ms / 1 of 255');
  assert(reset.pulses[0].durationMs===1&&reset.pulses[0].amplitude===1,'reset armature tick must stay at 1 ms / 1 of 255');
  assert(JSON.stringify(set)===JSON.stringify(model.hapticPatternFor(row,bit,true)),'set haptic pattern is not deterministic');
  assert(JSON.stringify(reset)===JSON.stringify(model.hapticPatternFor(row,bit,false)),'reset haptic pattern is not deterministic');
}
assert(setPatterns.length===120,'physical haptic inventory must contain exactly 120 latching relays');
assert(setPatterns.every(p=>p.pulses.length===1),'set contact bounce leaked into haptics');
assert(resetPatterns.every(p=>p.pulses.length===1),'reset contact bounce leaked into haptics');

for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
  const arm=model.contactHapticSignatureFor(row,bit,true,'armature');
  const bounce=model.contactHapticSignatureFor(row,bit,true,'bounce');
  const settled=model.contactHapticSignatureFor(row,bit,true,'settled');
  if(!topology.isLatchingRelay(row,bit)){
    assert(arm===null&&bounce===null&&settled===null,`unpopulated relay row ${row} bit ${bit} received contact haptic identity`);
    assert(model.playRelayContactHaptic(row,bit,true,'armature')===false,`unpopulated relay row ${row} bit ${bit} dispatched contact haptic`);
    continue;
  }
  assert(arm.durationMs===1&&arm.amplitude===1,'stretched armature tick escaped absolute minimum haptic bounds');
  assert(bounce===null,'contact bounce must not have a haptic signature');
  assert(settled===null,'settled contact state must not have a haptic signature');
  assert(model.playRelayContactHaptic(row,bit,true,'bounce')===false,'contact bounce dispatched a haptic');
  assert(model.playRelayContactHaptic(row,bit,true,'settled')===false,'settled contact state dispatched a haptic');
}

const bankEvents=[
  {row:4,bit:7,on:true,arrivalMs:6},
  {row:4,bit:2,on:false,arrivalMs:11},
  {row:4,bit:10,on:true,arrivalMs:14}
];
const bank=model.relayBankHapticPatternFor(bankEvents);
assert(bank.pulseCount===bankEvents.length,'bank waveform must contain one pulse per physical armature movement');
assert(bank.timings.length===bank.amplitudes.length&&bank.timings.length>3,'bank waveform was not run-length composed');
assert(bank.totalMs>15&&bank.totalMs<60,'bank micro-switch envelope escaped expected range');
assert(bank.amplitudes.some(a=>a===0)&&bank.amplitudes.some(a=>a>0),'bank waveform needs active and quiet segments');
assert(JSON.stringify(bank)===JSON.stringify(model.relayBankHapticPatternFor(bankEvents)),'bank waveform is not deterministic');

const isolated=model.relayBankHapticPatternFor([{row:4,bit:7,on:true,arrivalMs:6}]);
assert(Math.max(...isolated.amplitudes)===1,'isolated relay haptic must remain at absolute minimum 1/255');
const exactOverlap=model.relayBankHapticPatternFor([
  {row:4,bit:7,on:true,arrivalMs:6},
  {row:4,bit:8,on:true,arrivalMs:6},
  {row:4,bit:9,on:true,arrivalMs:6}
]);
assert(Math.max(...exactOverlap.amplitudes)>=2&&Math.max(...exactOverlap.amplitudes)<=3,'overlapping relay haptics must strengthen slightly and stay capped');
assert(exactOverlap.amplitudes.some(a=>a===3),'three-way exact overlap should reach the capped 3/255 segment');

assert(model.playRelayBankHaptic(bankEvents)===true,'native bank waveform dispatch failed');
assert(waveformCalls.length===1,'relay bank must issue exactly one native vibration call');
assert(impactCalls.length===0,'relay bank fell back to overwrite-prone one-shots despite waveform support');
const sentTimings=waveformCalls[0].timingsCsv.split(',').map(Number),sentAmplitudes=waveformCalls[0].amplitudesCsv.split(',').map(Number);
assert(JSON.stringify(sentTimings)===JSON.stringify(Array.from(bank.timings)),'native timings differ from composed bank waveform');
assert(JSON.stringify(sentAmplitudes)===JSON.stringify(Array.from(bank.amplitudes)),'native amplitudes differ from composed bank waveform');

waveformCalls.length=0;
assert(model.playRelayHaptic(4,7,true)===true,'single relay waveform dispatch failed');
assert(waveformCalls.length===1&&impactCalls.length===0,'single relay did not use native waveform path');

waveformCalls.length=0;impactCalls.length=0;
const contactExpected=model.contactHapticSignatureFor(4,7,true,'armature');
assert(model.playRelayContactHaptic(4,7,true,'armature')===true,'exact armature haptic dispatch failed');
assert(impactCalls.length===1&&impactCalls[0].durationMs===contactExpected.durationMs&&impactCalls[0].amplitude===contactExpected.amplitude,'exact armature haptic did not use deterministic signature');
assert(model.playRelayContactHaptic(4,7,true,'bounce')===false,'contact bounce haptic unexpectedly dispatched');
assert(impactCalls.length===1,'contact bounce added a second native tactile event');

waveformCalls.length=0;impactCalls.length=0;
const aux=model.auxiliaryHapticPatternFor('comp',true);
assert(aux.pulses.length===1&&aux.pulses[0].kind==='armature','aux relay haptic must contain one armature tick only');
assert(model.playAuxHaptic('comp',true)===true&&waveformCalls.length===1,'aux waveform dispatch failed');

assert(browserCalls===0,'native Android haptic path leaked into navigator.vibrate');
context.HapticBridge=null;
browserCalls=0;
assert(model.playRelayHaptic(4,7,true)===false,'pre-gesture browser haptic should be suppressed');
assert(browserCalls===0,'pre-gesture navigator.vibrate was called');
context.navigator.userActivation.hasBeenActive=true;
assert(model.playRelayHaptic(4,7,true)===true,'post-gesture browser haptic fallback did not run');
assert(browserCalls===1,'post-gesture browser haptic fallback should issue exactly one vibrate call');
context.HapticBridge={available(){return false},relayImpact(){throw new Error('unavailable Android bridge must not dispatch')}};
browserCalls=0;
assert(model.playRelayHaptic(4,7,true)===false,'Android bridge presence must suppress browser fallback when native haptics are unavailable');
assert(browserCalls===0,'Android WebView fell through to navigator.vibrate despite HapticBridge presence');

context.AGCDSKY_APP_STATE.relayHaptics=false;
waveformCalls.length=0;impactCalls.length=0;
assert(model.hapticsEnabled()===false,'relay haptic enabled state did not reflect OFF');
assert(model.playRelayBankHaptic(bankEvents)===false,'disabled relay bank haptic must be suppressed');
assert(model.playRelayHaptic(4,7,true)===false,'disabled single relay haptic must be suppressed');
assert(model.playRelayContactHaptic(4,7,true,'armature')===false,'disabled contact relay haptic must be suppressed');
assert(model.playAuxHaptic('comp',true)===false,'disabled auxiliary relay haptic must be suppressed');
assert(waveformCalls.length===0&&impactCalls.length===0,'disabled relay haptics reached native vibration');
context.AGCDSKY_APP_STATE.relayHaptics=true;
assert(model.hapticsEnabled()===true,'relay haptic enabled state did not restore ON');

console.log('relay haptic smoke: PASS');
console.log('  authentic mode uses one non-overwriting bank waveform; Android never falls through to pre-gesture navigator.vibrate; browser fallback requires prior user activation');
