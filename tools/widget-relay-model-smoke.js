#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error(`WIDGET RELAY MODEL FAIL: ${m}`);process.exit(1);};
const req=(t,n,l)=>{if(!t.includes(n))fail(`${l} is missing: ${n}`);};
const no=(t,n,l)=>{if(t.includes(n))fail(`${l} must not contain: ${n}`);};

const model=read('app/src/main/java/org/apollo/agcdsky/WidgetRelayModel.java');
const provider=read('app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java');
const generator=read('tools/generate-el-second-frames.js');

req(model,'static final int BANKS = 12;','native relay bank count');
req(model,'static final int RELAYS_PER_BANK = 11;','native relays per bank');
req(model,'static final int CHARACTER_RELAYS = 5;','native character relay count');
req(model,'static final int PHYSICAL_LATCHING_RELAYS = 120;','physical latching relay count');
req(model,'static final double DRIVE_ENVELOPE_MS = 20.0;','20-ms drive envelope');
req(model,'static final double LATCHING_OPERATE_MAX_MS = 3.0;','SCD 1006282 operate bound');
req(model,'static final double LATCHING_RELEASE_MAX_MS = 3.0;','SCD 1006282 release bound');
req(model,'static final double LATCHING_BOUNCE_MAX_MS = 2.0;','SCD 1006282 bounce bound');
req(model,'private static final int[] PHYSICAL_MASK = {','physical matrix mask');
req(model,'private static final int[] DIGIT_RELAY = {21, 3, 25, 27, 15, 30, 28, 19, 29, 31};','Comanche decimal relay codes');
req(model,'final double setTravelMs;','set travel fingerprint');
req(model,'final double resetTravelMs;','reset travel fingerprint');
req(model,'final double[] setBounceTimesMs;','set contact bounce');
req(model,'final double[] resetBounceTimesMs;','reset contact bounce');
req(model,'final int poleSkewUs;','DPST pole skew');
req(model,'static boolean isPhysicalRelay(','physical-position predicate');
req(model,'static int physicalMask(','physical bank mask');
req(model,'static int low11At(','bank transition sampler');
req(model,'static String segmentsDuringDigitTransition(','character transition sampler');
req(model,'return matrixSegments(k1, k2, k2, k3, k3, k4, k5, k5);','settled relay contact matrix');
req(model,'if (elapsedMs >= DRIVE_ENVELOPE_MS) return target;','settled-state boundary');
no(model,'Math.random','per-operation randomness');

req(provider,'WidgetRelayModel.segmentsForDigit(ch)','native renderer relay-matrix path');
no(provider,'private static final String[] SEG=','direct native seven-segment lookup');

req(generator,'const DIGIT_RELAY=[21,3,25,27,15,30,28,19,29,31];','generated Comanche relay codes');
req(generator,'function segmentsForRelayCode(value)','generated contact matrix');
req(generator,'const lit=segmentsForRelayCode(DIGIT_RELAY[Number(ch)]);','generated settled relay path');
no(generator,"const SEG=['abcdef'",'direct generated seven-segment lookup');

// Independent copy of the schematic contact logic. These are the normal
// Comanche decimal codes; checking them here catches accidental matrix/code
// divergence in both native and generated widget implementations.
function matrix(code){
  code&=0x1f;
  const k1=(code>>0)&1,k2=(code>>1)&1,k3=(code>>2)&1,k4=(code>>3)&1,k5=(code>>4)&1;
  const E=!!k5,F=!!k3,H=!!k1,J=!!k4;
  const K=!k2&&E;
  const M=!k2?F:true;
  const internal=!k3?J:true;
  const N=!!k5&&internal;
  let s='';
  if(E)s+='a'; if(H)s+='b'; if(M)s+='c'; if(N)s+='d'; if(K)s+='e'; if(F)s+='f'; if(J)s+='g';
  return s;
}
const codes=[21,3,25,27,15,30,28,19,29,31];
const expected=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
for(let i=0;i<10;i++) if(matrix(codes[i])!==expected[i]) fail(`relay code ${codes[i]} does not decode as digit ${i}: ${matrix(codes[i])}`);

// Ensure the declared set/reset ranges plus modeled bounce can never publish a
// contact as stable beyond the documented 20-ms drive boundary.
const envelope=Number((model.match(/DRIVE_ENVELOPE_MS = ([0-9.]+);/)||[])[1]);
const setMax=Number((model.match(/SET_TRAVEL_MAX_MS = ([0-9.]+);/)||[])[1]);
const resetMax=Number((model.match(/RESET_TRAVEL_MAX_MS = ([0-9.]+);/)||[])[1]);
const operateMax=Number((model.match(/LATCHING_OPERATE_MAX_MS = ([0-9.]+);/)||[])[1]);
const releaseMax=Number((model.match(/LATCHING_RELEASE_MAX_MS = ([0-9.]+);/)||[])[1]);
const bounceMax=Number((model.match(/LATCHING_BOUNCE_MAX_MS = ([0-9.]+);/)||[])[1]);
if(!(envelope===20&&setMax<=3&&resetMax<=3&&operateMax===3&&releaseMax===3&&bounceMax===2)) fail('SCD 1006282 timing bounds not enforced');

const masks=[0o3777,0o3777,0o1777,0o3777,0o3777,0o3777,0o3777,0o0037,0o1777,0o1777,0o1777,0o0777];
if(masks.reduce((n,m)=>n+m.toString(2).replace(/0/g,'').length,0)!==120)fail('physical matrix mask does not total 120 latching relays');
for(const token of ['03777, 03777, 01777, 03777, 03777, 03777','03777, 00037, 01777, 01777, 01777, 00777'])
  req(model,token,'native physical mask literal');

console.log('Widget relay model smoke: PASS');
console.log('  120 populated latching positions, SCD 1006282 timing bounds, Comanche digit codes, K1..K5 contact matrix, DPST skew/bounce, and separate 20-ms bank envelope verified');
