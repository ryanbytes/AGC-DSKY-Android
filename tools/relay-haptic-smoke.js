#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const identity=read('app/src/main/assets/relay-identity-audio.js');
const coupling=read('app/src/main/assets/relay-visual-coupling.js');
const bridge=read('app/src/main/java/org/apollo/agcdsky/KeyHapticBridge.java');
function assert(c,m){if(!c)throw new Error(m)}

for(const marker of [
  'hapticSignatureFromProfile','hapticPatternFromProfile','waveformFromPatterns',
  'hapticPatternFor:','relayBankHapticPatternFor:','playRelayBankHaptic',
  'auxiliaryHapticPatternFor:',"typeof native.relayWaveform==='function'"
])assert(identity.includes(marker),'relay identity haptic path missing: '+marker);

for(const marker of [
  'audioModel.playRelayBankHaptic?.(','audioModel.playAuxHaptic?.(name,on)',
  'hapticBankComposed:true','stretchedHapticFrameLocked:true'
])assert(coupling.includes(marker),'relay bank/haptic coupling missing: '+marker);
assert(!coupling.includes('audioModel.playRelayHaptic?.(motion.row,motion.bit,motion.on)'),
  'per-relay native vibration dispatch returned and can overwrite earlier pulses');

for(const marker of [
  'RELAY_MAX_WAVEFORM_SEGMENTS = 192','RELAY_MAX_WAVEFORM_MS = 750L',
  'relayWaveform(String timingsCsv, String amplitudesCsv)',
  'VibrationEffect.createWaveform(timings, effectAmplitudes, -1)',
  'vibrator.hasAmplitudeControl()'
])assert(bridge.includes(marker),'native relay waveform bridge missing: '+marker);

const waveformCalls=[],impactCalls=[];
const hardware={snapshot(){return {auxRelays:{}}},registerSnapshotExtension(){}};
const context={
  console,Math,Date,Object,Array,Number,String,Map,Set,
  setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},
  navigator:{vibrate(){throw new Error('native waveform bridge should win')}},
  document:{getElementById(){return null}},
  AGCDSKY_APP_STATE:{tickSound:false},
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
vm.runInContext(identity,context,{filename:'relay-identity-audio.js'});
const model=context.DSKY_RELAY_AUDIO;
assert(model&&typeof model.hapticPatternFor==='function'&&typeof model.playRelayBankHaptic==='function','relay haptic waveform API missing');

const setPatterns=[],resetPatterns=[];
for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
  const set=model.hapticPatternFor(row,bit,true),reset=model.hapticPatternFor(row,bit,false);
  setPatterns.push(set);resetPatterns.push(reset);
  assert(set.pulses.length>=2&&set.pulses.length<=4,'set rebound pulse count escaped bounds');
  assert(reset.pulses.length>=2&&reset.pulses.length<=3,'reset rebound pulse count escaped bounds');
  assert(set.pulses[0].kind==='armature'&&reset.pulses[0].kind==='armature','armature pulse missing');
  assert(set.pulses.slice(1).every(p=>p.kind==='rebound'),'set rebound labeling changed');
  assert(reset.pulses.slice(1).every(p=>p.kind==='rebound'),'reset rebound labeling changed');
  assert(JSON.stringify(set)===JSON.stringify(model.hapticPatternFor(row,bit,true)),'set haptic pattern is not deterministic');
  assert(JSON.stringify(reset)===JSON.stringify(model.hapticPatternFor(row,bit,false)),'reset haptic pattern is not deterministic');
}
assert(new Set(setPatterns.map(p=>JSON.stringify(p.pulses))).size>=80,'set tactile identities collapsed');
assert(new Set(resetPatterns.map(p=>JSON.stringify(p.pulses))).size>=70,'reset tactile identities collapsed');

const bankEvents=[
  {row:4,bit:7,on:true,arrivalMs:6},
  {row:4,bit:2,on:false,arrivalMs:11},
  {row:4,bit:10,on:true,arrivalMs:14}
];
const bank=model.relayBankHapticPatternFor(bankEvents);
assert(bank.pulseCount>=6,'bank waveform lost relay rebound pulses');
assert(bank.timings.length===bank.amplitudes.length&&bank.timings.length>3,'bank waveform was not run-length composed');
assert(bank.totalMs>20&&bank.totalMs<100,'bank waveform perceptual envelope escaped expected range');
assert(bank.amplitudes.some(a=>a===0)&&bank.amplitudes.some(a=>a>0),'bank waveform needs active and quiet segments');
assert(JSON.stringify(bank)===JSON.stringify(model.relayBankHapticPatternFor(bankEvents)),'bank waveform is not deterministic');

assert(model.playRelayBankHaptic(bankEvents)===true,'native bank waveform dispatch failed');
assert(waveformCalls.length===1,'relay bank must issue exactly one native vibration call');
assert(impactCalls.length===0,'relay bank fell back to overwrite-prone one-shots despite waveform support');
const sentTimings=waveformCalls[0].timingsCsv.split(',').map(Number),sentAmplitudes=waveformCalls[0].amplitudesCsv.split(',').map(Number);
assert(JSON.stringify(sentTimings)===JSON.stringify(Array.from(bank.timings)),'native timings differ from composed bank waveform');
assert(JSON.stringify(sentAmplitudes)===JSON.stringify(Array.from(bank.amplitudes)),'native amplitudes differ from composed bank waveform');

waveformCalls.length=0;
assert(model.playRelayHaptic(4,7,true)===true,'single relay waveform dispatch failed');
assert(waveformCalls.length===1&&impactCalls.length===0,'single relay did not use native waveform path');

waveformCalls.length=0;
const aux=model.auxiliaryHapticPatternFor('comp',true);
assert(aux.pulses.length>=2,'aux relay rebound pattern missing');
assert(model.playAuxHaptic('comp',true)===true&&waveformCalls.length===1,'aux waveform dispatch failed');

console.log('relay haptic smoke: PASS');
console.log('  140 relay identities encode armature + manufactured rebound character; each latching relay bank is sent as one non-overwriting native waveform');
