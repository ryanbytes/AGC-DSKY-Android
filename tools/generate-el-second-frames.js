'use strict';

const fs = require('fs');
const path = require('path');

const outRoot = process.argv[2];
if (!outRoot) throw new Error('usage: node generate-el-second-frames.js <generated-res-dir>');
const drawable = path.join(outRoot, 'drawable');
fs.rmSync(outRoot, {recursive: true, force: true});
fs.mkdirSync(drawable, {recursive: true});

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
const SEG=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];

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

for (let sec=0; sec<60; sec++) {
  const paths=[
    rect(SIGN_VX,SIGN_TOP,SIGN_T,SIGN_A_H),
    rect(SIGN_X,SIGN_HY,SIGN_W,SIGN_T),
    rect(SIGN_VX,SIGN_LOWER_Y,SIGN_T,SIGN_A_H),
  ];
  const text=`000${String(sec).padStart(2,'0')}`;
  [...text].forEach((ch,i)=>{
    const lit=SEG[Number(ch)];
    const ox=FIRST_DIGIT_X+i*REG_ADV;
    [...'abcdefg'].forEach((name,logical)=>{
      if (lit.includes(name)) paths.push(poly(digitPoly(logical,ox)));
    });
  });
  const body=paths.map(p=>`    <path android:fillColor="${EL_COLOR}" android:pathData="${p}" />`).join('\n');
  const xml=`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="106dp"\n    android:height="23dp"\n    android:viewportWidth="106"\n    android:viewportHeight="23">\n${body}\n</vector>\n`;
  fs.writeFileSync(path.join(drawable,`el_sec_${String(sec).padStart(2,'0')}.xml`),xml);
}
console.log(`generated 60 physical-datum Apollo EL second frames in ${drawable}`);
