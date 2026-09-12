'use strict';

const fs = require('fs');
const path = require('path');

const outRoot = process.argv[2];
if (!outRoot) throw new Error('usage: node generate-el-second-frames.js <generated-res-dir>');
const drawable = path.join(outRoot, 'drawable');
const values = path.join(outRoot, 'values');
fs.rmSync(outRoot, {recursive: true, force: true});
fs.mkdirSync(drawable, {recursive: true});
fs.mkdirSync(values, {recursive: true});

// MIT/IL SCD 1006315G plus the metric DSKY V2 segment trace.  The trace is
// already dimensionally faithful to Detail C; use one physical mm->panel scale.
const FACE_W_IN=2.360, U=106/FACE_W_IN, MM_TO_U=U/25.4;
const SRC_X=88.116524, SRC_Y=85.303059, SRC_W=11.685430;
const MIRROR_X=2*SRC_X+SRC_W;
const DATUM_X=MIRROR_X-96.244524;
const DIGIT_H=.500*U;
const REG_ADV=.410*U, FIRST_DIGIT_X=.400*U;
const SOURCE=[
 [[95.137274,86.827056],[96.244524,85.303059],[90.088724,85.303059],[90.497084,86.827056]],
 [[91.361734,91.526056],[89.694284,85.303059],[88.116524,85.303059],[89.783974,91.526056]],
 [[89.886064,91.907059],[91.463824,91.907059],[92.620814,96.224998],[91.456914,97.769549]],
 [[93.002124,96.352056],[91.758014,98.003059],[99.570014,98.003059],[97.418394,96.352056]],
 [[95.390774,87.126332],[96.543434,85.539832],[98.147444,91.526056],[96.569684,91.526056]],
 [[96.671774,91.907059],[98.249534,91.907059],[99.801954,97.700791],[97.815844,96.176791]],
 [[96.005094,90.891059],[96.447474,92.542059],[92.028414,92.542059],[91.586024,90.891059]],
];
const MAP=[0,1,2,3,5,4,6];

// Comanche RELTAB low-five-bit relay codes.  Settled widget frames and the
// stretched lock-screen timeline both use the same K1..K5 contact matrix as the
// WebView/native relay model.
const DIGIT_RELAY=[21,3,25,27,15,30,28,19,29,31];
function segmentsForRelayCode(value){
  const code=Number(value)&0x1f;
  const k1=(code>>0)&1,k2=(code>>1)&1,k3=(code>>2)&1,k4=(code>>3)&1,k5=(code>>4)&1;
  const E=!!k5,F=!!k3,H=!!k1,J=!!k4;
  const K=!k2&&E;
  const M=!k2?F:true;
  const internal=!k3?J:true;
  const N=!!k5&&internal;
  let segments='';
  if(E)segments+='a';
  if(H)segments+='b';
  if(M)segments+='c';
  if(N)segments+='d';
  if(K)segments+='e';
  if(F)segments+='f';
  if(J)segments+='g';
  return segments;
}
function maskForRelayCode(value){
  const seg=segmentsForRelayCode(value);
  let mask=0;
  for(let i=0;i<7;i++)if(seg.includes('abcdefg'[i]))mask|=(1<<i);
  return mask&0x7f;
}
function segmentsForMask(mask){
  let out='';
  for(let i=0;i<7;i++)if(mask&(1<<i))out+='abcdefg'[i];
  return out;
}

// Widget STRETCHED presentation. RemoteViews cannot run the app's 60-Hz
// requestAnimationFrame loop, so the launcher gets a deterministic 20-Hz
// minute-long timeline. It samples the exact same stretched relay schedule and
// preserves the build-20067 monotonic segment rule: once a segment commits
// toward the target it cannot reverse before the final K1..K5 state arrives.
const STRETCHED_FRAME_MS=50;
const STRETCHED_FRAMES_PER_SECOND=1000/STRETCHED_FRAME_MS;
const STRETCHED_FRAME_COUNT=60*STRETCHED_FRAMES_PER_SECOND;
const STRETCH_FIRST_BASE_MS=20;
const STRETCH_MIN_GAP_MS=18;
const STRETCH_MAX_GAP_MS=28;
const LATCHING_RELAY_COUNT=132;
const SET_TRAVEL_MIN_MS=5.1,SET_TRAVEL_MAX_MS=13.6;
const RESET_TRAVEL_MIN_MS=4.7,RESET_TRAVEL_MAX_MS=12.8;
const MAX_CONTACT_STABLE_MS=19.65;
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function hash32(text){
  let h=0x811c9dc5;
  for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193);}
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return h>>>0;
}
function xorshift32(seed){let state=(seed>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
function bitName(bit){if(bit===10)return'B';if(bit>=5)return`C-K${bit-4}`;return`D-K${bit+1}`;}
function profileFor(row,bit){
  const id=`ROW-${String(row).padStart(2,'0')}:${bitName(bit)}`;
  const ordinal=(row-1)*11+bit;
  const rnd=xorshift32(hash32(`${id}:manufacture`));
  const positionPhase=((ordinal*73+17)%LATCHING_RELAY_COUNT)/Math.max(1,LATCHING_RELAY_COUNT-1);
  const setTravelMs=clamp(SET_TRAVEL_MIN_MS+(SET_TRAVEL_MAX_MS-SET_TRAVEL_MIN_MS)*clamp(.58*positionPhase+.42*rnd(),0,1),SET_TRAVEL_MIN_MS,SET_TRAVEL_MAX_MS);
  const resetTravelMs=clamp(RESET_TRAVEL_MIN_MS+(RESET_TRAVEL_MAX_MS-RESET_TRAVEL_MIN_MS)*clamp(.52*(1-positionPhase)+.48*rnd(),0,1),RESET_TRAVEL_MIN_MS,RESET_TRAVEL_MAX_MS);
  const poleSkewUs=Math.round((rnd()*2-1)*185);
  const setBounceCount=2+Math.floor(rnd()*5),resetBounceCount=1+Math.floor(rnd()*4);
  const setBounceWindowMs=.55+rnd()*2.35,resetBounceWindowMs=.35+rnd()*1.85;
  // Stretched scheduling only needs stable-contact tail/count, not individual
  // bounce events. Consume the same deterministic bounce jitter sequence as
  // relay-identity-audio before drawing the fixed stable-contact tail.
  function bounceLast(count,windowMs){
    let last=0;const slot=windowMs/(count+1);
    for(let i=1;i<=count;i++){const jitter=(rnd()*2-1)*slot*.24;last=clamp(i*slot+jitter,.05,windowMs-.03);}
    return last;
  }
  const setLast=bounceLast(setBounceCount,setBounceWindowMs);
  const resetLast=bounceLast(resetBounceCount,resetBounceWindowMs);
  const setTailMs=.12+rnd()*.34,resetTailMs=.10+rnd()*.28;
  const setStableMs=Math.min(MAX_CONTACT_STABLE_MS,setTravelMs+setLast+setTailMs);
  const resetStableMs=Math.min(MAX_CONTACT_STABLE_MS,resetTravelMs+resetLast+resetTailMs);
  return{setTravelMs,resetTravelMs,setStableMs,resetStableMs,setBounceCount,resetBounceCount,poleSkewUs};
}
function collectMotions(row,prior,target){
  const out=[],diff=(prior^target)&0x7ff;
  for(let bit=0;bit<11;bit++){
    const mask=1<<bit;if(!(diff&mask))continue;
    const on=!!(target&mask),p=profileFor(row,bit);
    const physicalMs=on?p.setTravelMs:p.resetTravelMs;
    const stableMs=on?p.setStableMs:p.resetStableMs;
    const bounceCount=on?p.setBounceCount:p.resetBounceCount;
    out.push({bit,mask,on,physicalMs,stableMs,bounceCount,poleSkewUs:p.poleSkewUs});
  }
  out.sort((a,b)=>a.physicalMs-b.physicalMs||a.bit-b.bit);
  return out;
}
function stretchedGapMs(m){
  const tailMs=Math.max(0,m.stableMs-m.physicalMs);
  const signature=tailMs*2+Math.min(5,Math.abs(m.poleSkewUs)/35)+Math.min(4,m.bounceCount*.55)+(m.physicalMs-4.7)*.45;
  return clamp(STRETCH_MIN_GAP_MS+signature,STRETCH_MIN_GAP_MS,STRETCH_MAX_GAP_MS);
}
function stretchedSchedule(motions){
  let at=0;
  return motions.map((m,i)=>{
    if(i===0)at=STRETCH_FIRST_BASE_MS+m.physicalMs*1.25+Math.min(8,Math.abs(m.poleSkewUs)/32);
    else at+=stretchedGapMs(m);
    return{...m,stretchedMs:Math.round(at*10)/10};
  });
}
function low11ForSecond(sec){
  const text=String(sec).padStart(2,'0');
  return ((DIGIT_RELAY[Number(text[0])]&0x1f)<<5)|(DIGIT_RELAY[Number(text[1])]&0x1f);
}
function requestedWordAt(prior,target,elapsedMs){
  let word=prior;
  for(const m of stretchedSchedule(collectMotions(1,prior,target))){
    if(elapsedMs<m.stretchedMs)break;
    if(m.on)word|=m.mask;else word&=~m.mask;
  }
  return word&0x7ff;
}
function monotonicMask(shown,targetMask,changedMask,requestedMask){
  const pending=changedMask&(shown^targetMask);
  const atTarget=(~(requestedMask^targetMask))&0x7f;
  const commit=pending&atTarget;
  return((shown&~commit)|(targetMask&commit))&0x7f;
}

// 1006315G Detail A, position 6: three luminous islands.  Top and bottom are
// both segment A; the center horizontal is segment B.  A plus lights A+B.
const SIGN_W=.265*U, SIGN_H=.338*U, SIGN_T=.065*U, SIGN_X=.025*U, SIGN_GAP=.010*U;
const SIGN_TOP=(DIGIT_H-SIGN_H)/2;
const SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)/2;
const SIGN_A_H=(SIGN_H-SIGN_T-2*SIGN_GAP)/2;
const SIGN_HY=SIGN_TOP+SIGN_A_H+SIGN_GAP;
const SIGN_LOWER_Y=SIGN_HY+SIGN_T+SIGN_GAP;

const n=v=>Number(v).toFixed(3).replace(/\.000$/,'');
const poly=pts=>'M'+pts.map(([x,y])=>`${n(x)},${n(y)}`).join(' L')+' Z';
const rect=(x,y,w,h)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
const digitPoly=(logical,ox)=>SOURCE[MAP[logical]].map(([x,y])=>[
  ox+(MIRROR_X-x-DATUM_X)*MM_TO_U,
  (y-SRC_Y)*MM_TO_U,
]);

// User-tuned blue-green EL while retaining the green-dominant 530-nm look.
const EL_COLOR='#6DECB4';
function writeFrame(name,segmentsByDigit){
  const paths=[
    rect(SIGN_VX,SIGN_TOP,SIGN_T,SIGN_A_H),
    rect(SIGN_X,SIGN_HY,SIGN_W,SIGN_T),
    rect(SIGN_VX,SIGN_LOWER_Y,SIGN_T,SIGN_A_H),
  ];
  segmentsByDigit.forEach((lit,i)=>{
    const ox=FIRST_DIGIT_X+i*REG_ADV;
    [...'abcdefg'].forEach((seg,logical)=>{if(lit.includes(seg))paths.push(poly(digitPoly(logical,ox)));});
  });
  const body=paths.map(p=>`    <path android:fillColor="${EL_COLOR}" android:pathData="${p}" />`).join('\n');
  const xml=`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="106dp"\n    android:height="23dp"\n    android:viewportWidth="106"\n    android:viewportHeight="23">\n${body}\n</vector>\n`;
  fs.writeFileSync(path.join(drawable,`${name}.xml`),xml);
}

for(let sec=0;sec<60;sec++){
  const text=`000${String(sec).padStart(2,'0')}`;
  writeFrame(`el_sec_${String(sec).padStart(2,'0')}`,[...text].map(ch=>segmentsForRelayCode(DIGIT_RELAY[Number(ch)])));
}

const stretchNames=[];
for(let sec=0;sec<60;sec++){
  const priorSec=(sec+59)%60;
  const priorWord=low11ForSecond(priorSec),targetWord=low11ForSecond(sec);
  const targetTens=(targetWord>>5)&0x1f,targetOnes=targetWord&0x1f;
  const priorTens=(priorWord>>5)&0x1f,priorOnes=priorWord&0x1f;
  const targetTensMask=maskForRelayCode(targetTens),targetOnesMask=maskForRelayCode(targetOnes);
  let shownTens=maskForRelayCode(priorTens),shownOnes=maskForRelayCode(priorOnes);
  const changedTens=(shownTens^targetTensMask)&0x7f,changedOnes=(shownOnes^targetOnesMask)&0x7f;
  for(let phase=0;phase<STRETCHED_FRAMES_PER_SECOND;phase++){
    const elapsed=phase*STRETCHED_FRAME_MS;
    const requested=requestedWordAt(priorWord,targetWord,elapsed);
    const requestedTens=(requested>>5)&0x1f,requestedOnes=requested&0x1f;
    shownTens=monotonicMask(shownTens,targetTensMask,changedTens,maskForRelayCode(requestedTens));
    shownOnes=monotonicMask(shownOnes,targetOnesMask,changedOnes,maskForRelayCode(requestedOnes));
    if(requestedTens===targetTens)shownTens=targetTensMask;
    if(requestedOnes===targetOnes)shownOnes=targetOnesMask;
    const slot=sec*STRETCHED_FRAMES_PER_SECOND+phase;
    const name=`el_stretch_${String(slot).padStart(3,'0')}`;
    stretchNames.push(name);
    writeFrame(name,[
      segmentsForRelayCode(DIGIT_RELAY[0]),segmentsForRelayCode(DIGIT_RELAY[0]),segmentsForRelayCode(DIGIT_RELAY[0]),
      segmentsForMask(shownTens),segmentsForMask(shownOnes)
    ]);
  }
}
const arrayXml=`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <array name="el_stretched_frames">\n${stretchNames.map(name=>`    <item>@drawable/${name}</item>`).join('\n')}\n  </array>\n</resources>\n`;
fs.writeFileSync(path.join(values,'el_stretched_frames.xml'),arrayXml);

console.log(`generated 60 settled + ${STRETCHED_FRAME_COUNT} stretched Apollo relay-matrix EL frames in ${outRoot}`);
