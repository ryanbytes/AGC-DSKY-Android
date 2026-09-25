#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'app/src/main/assets/style.css'),'utf8');
const fail=m=>{throw new Error('KEY GEOMETRY FAIL: '+m)};
const near=(a,b,t=5e-6)=>{if(Math.abs(a-b)>t)fail(`${a} != ${b}`)};

const PITCH_IN=.970;
const CAP_IN=.860;
const CAP_RADIUS_IN=.065;
const PITCH_UNITS=45;
const FACE_W_UNITS=320;
const FACE_H_UNITS=372;
const OLD_CAP_UNITS=42;
const capUnits=PITCH_UNITS*CAP_IN/PITCH_IN;
const shift=(OLD_CAP_UNITS-capUnits)/2;
const expectedWidthPct=capUnits/FACE_W_UNITS*100;
const expectedHeightPct=capUnits/FACE_H_UNITS*100;
const expectedRadiusPct=CAP_RADIUS_IN/CAP_IN*100;

const key=css.match(/\.key\{position:absolute;width:([0-9.]+)%;height:([0-9.]+)%;z-index:6;border:[^;]+;border-radius:([0-9.]+)%/);
if(!key)fail('key cap geometry rule missing');
near(Number(key[1]),expectedWidthPct);
near(Number(key[2]),expectedHeightPct);
near(Number(key[3]),expectedRadiusPct);

if(css.includes('width:13.125%;height:11.2903%'))fail('obsolete 42-unit cap envelope returned');
if(css.includes('border-radius:4.2%'))fail('obsolete undersized cap radius returned');

const expectedLeft=[4,49,94,139,184,229,274].map(x=>(x+shift)/FACE_W_UNITS*100);
const expectedTop=[235,280,325,257.5,302.5].map(y=>(y+shift)/FACE_H_UNITS*100);
for(const v of expectedLeft){
  const marker=`left:${v.toFixed(6)}%`;
  if(!css.includes(marker))fail('center-preserving horizontal origin missing: '+marker);
}
for(const v of expectedTop){
  const marker=`top:${v.toFixed(6)}%`;
  if(!css.includes(marker))fail('center-preserving vertical origin missing: '+marker);
}

const centers=expectedLeft.map(left=>left/100*FACE_W_UNITS+capUnits/2);
[25,70,115,160,205,250,295].forEach((want,i)=>near(centers[i],want,1e-5));
[
  [expectedTop[0],256],
  [expectedTop[1],301],
  [expectedTop[2],346],
  [expectedTop[3],278.5],
  [expectedTop[4],323.5]
].forEach(([top,want])=>near(top/100*FACE_H_UNITS+capUnits/2,want,1e-5));

console.log('key geometry smoke: PASS');
console.log('  cap envelope: '+capUnits.toFixed(6)+' units = '+CAP_IN.toFixed(3)+' in on '+PITCH_IN.toFixed(3)+' in pitch');
console.log('  corner radius: '+CAP_RADIUS_IN.toFixed(3)+' in; switch centers unchanged');
