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
req(model,'static boolean isPhysicalRelay(int row, int bit)','physical population mask');
req(model,'if (row == 3 && bit == 10) return false;','ROW-03:B unpopulated');
req(model,'if (row == 8 && bit >= 5) return false;','ROW-08 C/B positions unpopulated');
req(model,'if ((row == 9 || row == 10 || row == 11) && bit == 10) return false;','ROW-09..11:B unpopulated');
req(model,'if (row == 12 && (bit == 9 || bit == 10)) return false;','ROW-12 C-K5/B unpopulated');
req(model,'requireLogicalPosition(row, 0);','widget row samplers validate logical row range');
req(model,'if (!isPhysicalRelay(row, bit)) continue;','profile creation skips unpopulated logical positions');
req(model,'if ((diff & (1 << bit)) == 0 || !isPhysicalRelay(row, bit)) continue;','settle timing skips unpopulated logical positions');
req(model,'if (!isPhysicalRelay(row, bit)) {','logical transition bypasses physical model for unpopulated positions');
req(model,'physicalOrdinal < 0 || physicalOrdinal >= PHYSICAL_LATCHING_RELAYS','physical ordinal is validation-only');
no(model,'physicalOrdinal * 73 + 17','synthetic manufacturing phase');
no(model,'every one of the 12 x 11','stale 132-latching-relay claim');
req(model,'static final double DRIVE_ENVELOPE_MS = 20.0;','20-ms drive envelope');
req(model,'static final double LATCHING_PRESENTATION_REFERENCE_MS = 3.0;','source-bounded latching timing reference');
req(model,'private static final int[] DIGIT_RELAY = {21, 3, 25, 27, 15, 30, 28, 19, 29, 31};','Comanche decimal relay codes');
req(model,'final double setTravelMs;','set travel field');
req(model,'final double resetTravelMs;','reset travel field');
req(model,'final double[] setBounceTimesMs;','set contact trace field');
req(model,'final double[] resetBounceTimesMs;','reset contact trace field');
req(model,'final int poleSkewUs;','pole skew field');
no(model,'XorShift32','synthetic relay variation generator');
no(model,'bouncePattern(','synthetic contact bounce generator');
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

// The widget must retain the 20-ms bank boundary while using only the
// explicitly labeled predecessor-spec timing reference. No pseudo-random
// mechanical fingerprint may return.
const envelope=Number((model.match(/DRIVE_ENVELOPE_MS = ([0-9.]+);/)||[])[1]);
const reference=Number((model.match(/LATCHING_PRESENTATION_REFERENCE_MS = ([0-9.]+);/)||[])[1]);
if(!(envelope===20&&reference===3&&reference<envelope)) fail('source-bounded relay timing reference changed');
if(!model.includes('new double[0], new double[0], 0')) fail('widget profile must suppress fabricated bounce and pole skew');

console.log('Widget relay model smoke: PASS');
console.log('  120 populated latching positions, Comanche digit codes, K1..K5 contact matrix, source-bounded 3-ms presentation reference, no fabricated per-relay mechanics, and 20-ms settled boundary verified');
