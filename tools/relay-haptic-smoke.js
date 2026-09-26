#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const inventorySource=read('app/src/main/assets/dsky-relay-inventory.js');
const identity=read('app/src/main/assets/relay-identity-audio.js');
const coupling=read('app/src/main/assets/relay-visual-coupling.js');
const bridge=read('app/src/main/java/org/apollo/agcdsky/KeyHapticBridge.java');
function assert(c,m){if(!c)throw new Error(m)}

for(const marker of [
  'hapticSignatureFromProfile','hapticPatternFromProfile','contactHapticSignatureFromProfile','waveformFromPatterns',
  'hapticPatternFor:','contactHapticSignatureFor:','relayBankHapticPatternFor:','playRelayContactHaptic','playRelayBankHaptic',
  'auxiliaryHapticPatternFor:',"typeof native.relayWaveform==='function'"
])assert(identity.includes(marker),'relay identity haptic path missing: '+marker);

for(const marker of [
  'audioModel.playRelayBankHaptic?.(','audioModel.playAuxHaptic?.(name,on)',
  'hapticBankComposed:true','stretchedHapticFrameLocked:true'
])assert(coupling.includes(marker),'relay bank/haptic coupling missing: '+marker);
assert(!coupling.includes('audioModel.playRelayHaptic?.(motion.row,motion.bit,motion.on)'),
  'per-relay native vibration dispatch returned and can overwrite earlier pulses');

for(const marker of [
  'RELAY_MIN_MS = 2L','RELAY_MAX_MS = 8L','RELAY_MIN_AMPLITUDE = 12','RELAY_MAX_AMPLITUDE = 96',
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
vm.runInContext(inventorySource,context,{filename:'dsky-relay-inventory.js'});
vm.runInContext(identity,context,{filename:'relay-identity-audio.js'});
const inv=context.DSKY_RELAY_INVENTORY,model=context.DSKY_RELAY_AUDIO;
assert(model&&typeof model.hapticPatternFor==='function'&&typeof model.playRelayBankHaptic==='function','relay haptic waveform API missing');

const setPatterns=[],resetPatterns=[];
assert(inv.matrixRelays.length===120&&model.latchingRelayCount===120,'latching physical population mismatch');
assert(inv.auxiliaryRelays.length===12&&model.auxiliaryRelayCount===12&&model.totalIndividualRelays===132,'total physical relay population mismatch');
for(const relay of inv.matrixRelays){
  const {row,bit,id}=relay,profile=model.profileFor(row,bit);
  assert(profile&&profile.id===id,'physical latching relay profile missing: '+id);
  assert(profile.setTravelMs>0&&profile.setTravelMs<=3,'SCD 1006282 SET operate time exceeded: '+id);
  assert(profile.resetTravelMs>0&&profile.resetTravelMs<=3,'SCD 1006282 RESET release time exceeded: '+id);
  assert(profile.setBounceWindowMs<=2&&profile.resetBounceWindowMs<=2,'SCD 1006282 bounce window exceeded: '+id);
  assert(profile.setStableMs-profile.setTravelMs<=2&&profile.resetStableMs-profile.resetTravelMs<=2,'SCD 1006282 contact settle tail exceeded: '+id);
  assert(profile.timingEvidence==='SCD-1006282-bounded','latching timing provenance missing: '+id);
  const set=model.hapticPatternFor(row,bit,true),reset=model.hapticPatternFor(row,bit,false);
  setPatterns.push(set);resetPatterns.push(reset);
  assert(set&&reset,'physical relay haptic pattern missing: '+id);
  assert(set.pulses.length>=2&&set.pulses.length<=4,'set rebound pulse count escaped bounds: '+id);
  assert(reset.pulses.length>=2&&reset.pulses.length<=3,'reset rebound pulse count escaped bounds: '+id);
  assert(set.pulses[0].kind==='armature'&&reset.pulses[0].kind==='armature','armature pulse missing: '+id);
  assert(set.pulses[0].durationMs>=3&&set.pulses[0].durationMs<=5,'set armature escaped micro-switch duration: '+id);
  assert(set.pulses[0].amplitude>=40&&set.pulses[0].amplitude<=72,'set armature escaped micro-switch amplitude: '+id);
  assert(reset.pulses[0].durationMs>=2&&reset.pulses[0].durationMs<=4,'reset armature escaped micro-switch duration: '+id);
  assert(reset.pulses[0].amplitude>=28&&reset.pulses[0].amplitude<=56,'reset armature escaped micro-switch amplitude: '+id);
  assert(set.pulses.slice(1).every(p=>p.durationMs>=1&&p.durationMs<=2&&p.amplitude>=14&&p.amplitude<=30),'set rebound escaped micro-switch bounds: '+id);
  assert(reset.pulses.slice(1).every(p=>p.durationMs>=1&&p.durationMs<=2&&p.amplitude>=12&&p.amplitude<=24),'reset rebound escaped micro-switch bounds: '+id);
  assert(JSON.stringify(set)===JSON.stringify(model.hapticPatternFor(row,bit,true)),'set haptic pattern is not deterministic: '+id);
  assert(JSON.stringify(reset)===JSON.stringify(model.hapticPatternFor(row,bit,false)),'reset haptic pattern is not deterministic: '+id);
  for(const phase of ['armature','bounce','settled']){
    const sig=model.contactHapticSignatureFor(row,bit,true,phase);
    assert(sig&&sig.id===id,'contact haptic signature missing: '+id+' '+phase);
  }
}
assert(new Set(setPatterns.map(p=>JSON.stringify(p.pulses))).size>=70,'set tactile identities collapsed');
assert(new Set(resetPatterns.map(p=>JSON.stringify(p.pulses))).size>=60,'reset tactile identities collapsed');

for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
  if(inv.isMatrixRelay(row,bit))continue;
  assert(model.profileFor(row,bit)===null,'nonexistent matrix relay received a profile');
  assert(model.hapticPatternFor(row,bit,true)===null,'nonexistent matrix relay received haptics');
  assert(model.contactTraceFor(row,bit,true).length===0,'nonexistent matrix relay received contact motion');
  assert(model.playRelayHaptic(row,bit,true)===false,'nonexistent matrix relay dispatched haptic output');
}
for(const relay of inv.auxiliaryRelays){
  const p=model.auxiliaryProfileFor(relay.name);
  assert(p&&p.id===relay.id,'non-latching relay profile missing: '+relay.name);
  assert(p.timingEvidence==='1010784-timing-unverified','non-latching relay must not claim unsourced timing: '+relay.name);
  const set=model.auxiliaryHapticPatternFor(relay.name,true),reset=model.auxiliaryHapticPatternFor(relay.name,false);
  assert(set&&reset&&set.pulses.length>=2&&reset.pulses.length>=2,'non-latching relay haptic identity missing: '+relay.name);
}

const bankEvents=[
  {row:4,bit:7,on:true,arrivalMs:6},
  {row:4,bit:2,on:false,arrivalMs:11},
  {row:4,bit:10,on:true,arrivalMs:14}
];
const bank=model.relayBankHapticPatternFor(bankEvents);
assert(bank.pulseCount>=6,'bank waveform lost relay rebound pulses');
assert(bank.timings.length===bank.amplitudes.length&&bank.timings.length>3,'bank waveform was not run-length composed');
assert(bank.totalMs>15&&bank.totalMs<60,'bank micro-switch envelope escaped expected range');
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

waveformCalls.length=0;impactCalls.length=0;
const contactExpected=model.contactHapticSignatureFor(4,7,true,'bounce');
assert(model.playRelayContactHaptic(4,7,true,'bounce')===true,'exact contact-event haptic dispatch failed');
assert(impactCalls.length===1&&impactCalls[0].durationMs===contactExpected.durationMs&&impactCalls[0].amplitude===contactExpected.amplitude,'exact contact-event haptic did not use deterministic signature');

waveformCalls.length=0;impactCalls.length=0;
const aux=model.auxiliaryHapticPatternFor('comp',true);
assert(aux.pulses.length>=2,'aux relay rebound pattern missing');
assert(model.playAuxHaptic('comp',true)===true&&waveformCalls.length===1,'aux waveform dispatch failed');

console.log('relay haptic smoke: PASS');
console.log('  exhaustive 120 latching + 12 non-latching inventory covered; nonexistent matrix holes emit no relay event; SCD 1006282 timing bounds enforced for every latching relay');
