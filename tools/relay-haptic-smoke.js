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
  'hapticSignatureFromProfile',
  'hapticSignatureFor:',
  'auxiliaryHapticSignatureFor:',
  'playRelayHaptic',
  'playAuxHaptic',
  "typeof candidate.relayImpact!=='function'",
  "navigator.vibrate(signature.durationMs)"
])assert(identity.includes(marker),'relay identity haptic path missing: '+marker);

for(const marker of [
  'audioModel.playRelayHaptic?.(motion.row,motion.bit,motion.on)',
  'audioModel.playAuxHaptic?.(name,on)',
  'stretchedHapticFrameLocked:true'
])assert(coupling.includes(marker),'relay armature/haptic coupling missing: '+marker);

for(const marker of [
  'RELAY_MIN_MS = 6L',
  'RELAY_MAX_MS = 18L',
  'RELAY_MIN_AMPLITUDE = 48',
  'RELAY_MAX_AMPLITUDE = 192',
  'relayImpact(int durationMs, int amplitude)',
  'vibrator.hasAmplitudeControl()',
  'HapticFeedbackConstants.CLOCK_TICK'
])assert(bridge.includes(marker),'native relay haptic bridge missing: '+marker);

const calls=[];
const hardware={
  snapshot(){return {auxRelays:{}};},
  registerSnapshotExtension(){}
};
const context={
  console,
  Math,
  Date,
  Object,
  Array,
  Number,
  String,
  Map,
  Set,
  setTimeout(){return 0;},
  clearTimeout(){},
  setInterval(){return 0;},
  clearInterval(){},
  navigator:{vibrate(){throw new Error('native bridge should win');}},
  document:{getElementById(){return null;}},
  AGCDSKY_APP_STATE:{tickSound:false},
  AGCDSKY_ENVIRONMENT:{tickLevel(){return 1;}},
  AGCDSKY_AUDIO:{
    implementation(){return ()=>true;},
    installImplementation(){},
    ensure(){return null;}
  },
  AGCDSKY_SERVICE_REGISTRY:{get(name){return name==='AGCDSKY_HARDWARE'?hardware:null;}},
  HapticBridge:{
    available(){return true;},
    relayImpact(durationMs,amplitude){calls.push({durationMs,amplitude});return true;}
  }
};
context.window=context;
vm.createContext(context);
vm.runInContext(identity,context,{filename:'relay-identity-audio.js'});
const model=context.DSKY_RELAY_AUDIO;
assert(model&&typeof model.hapticSignatureFor==='function','relay haptic profile API missing');

const setSignatures=[],resetSignatures=[];
for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
  const set=model.hapticSignatureFor(row,bit,true);
  const reset=model.hapticSignatureFor(row,bit,false);
  setSignatures.push(set);resetSignatures.push(reset);
  assert(set.durationMs>=11&&set.durationMs<=16,'set duration escaped perceptible bounds');
  assert(set.amplitude>=110&&set.amplitude<=180,'set amplitude escaped perceptible bounds');
  assert(reset.durationMs>=7&&reset.durationMs<=10,'reset duration escaped perceptible bounds');
  assert(reset.amplitude>=60&&reset.amplitude<=115,'reset amplitude escaped perceptible bounds');
  assert(set.durationMs-reset.durationMs>=2,'same-relay set/reset duration separation collapsed');
  assert(set.amplitude-reset.amplitude>=40,'same-relay set/reset amplitude separation collapsed');
  assert(JSON.stringify(set)===JSON.stringify(model.hapticSignatureFor(row,bit,true)),'relay set haptic is not deterministic');
  assert(JSON.stringify(reset)===JSON.stringify(model.hapticSignatureFor(row,bit,false)),'relay reset haptic is not deterministic');
}
const setDur=setSignatures.map(x=>x.durationMs),setAmp=setSignatures.map(x=>x.amplitude);
const resetDur=resetSignatures.map(x=>x.durationMs),resetAmp=resetSignatures.map(x=>x.amplitude);
assert(Math.max(...setDur)-Math.min(...setDur)<=5,'set haptic duration variation is too broad');
assert(Math.max(...setAmp)-Math.min(...setAmp)<=70,'set haptic amplitude variation is too broad');
assert(Math.max(...resetDur)-Math.min(...resetDur)<=4,'reset haptic duration variation is too broad');
assert(Math.max(...resetAmp)-Math.min(...resetAmp)<=55,'reset haptic amplitude variation is too broad');
assert(new Set(setSignatures.map(x=>x.durationMs+':'+x.amplitude)).size>=40,'relay set haptic identities are not meaningfully varied');
assert(new Set(resetSignatures.map(x=>x.durationMs+':'+x.amplitude)).size>=35,'relay reset haptic identities are not meaningfully varied');

const expected=model.hapticSignatureFor(4,7,true);
assert(model.playRelayHaptic(4,7,true)===true,'native relay haptic dispatch failed');
assert(calls.length===1,'native relay haptic dispatched wrong number of pulses');
assert(calls[0].durationMs===expected.durationMs&&calls[0].amplitude===expected.amplitude,'native relay haptic did not use deterministic identity');

const aux=model.auxiliaryHapticSignatureFor('comp',true);
assert(aux.durationMs>=11&&aux.durationMs<=16&&aux.amplitude>=110&&aux.amplitude<=180,'aux haptic escaped shared bounds');
assert(model.playAuxHaptic('comp',true)===true&&calls.length===2,'aux native haptic dispatch failed');

console.log('relay haptic smoke: PASS');
console.log('  140 relay identities use deterministic, perceptibly separated set/reset haptic signatures coupled to armature events');
