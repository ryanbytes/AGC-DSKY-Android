#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const style=fs.readFileSync(path.join(ROOT,'app/src/main/assets/style.css'),'utf8');
const fail=m=>{throw new Error('keycap fidelity smoke FAIL: '+m)};
const grab=(re,label)=>{const m=style.match(re);if(!m)fail(label+' missing');return Number(m[1]);};
const near=(a,b,tol,label)=>{if(Math.abs(a-b)>tol)fail(label+': '+a+' != '+b);};

const W=320,H=372;
const PITCH_IN=.970,CAP_IN=.860,RADIUS_IN=.065;
const pitchU=45;
const capU=pitchU*(CAP_IN/PITCH_IN);
const expectedW=capU/W*100;
const expectedH=capU/H*100;
const expectedRadius=RADIUS_IN/CAP_IN*100;

near(grab(/\.key\{[^}]*width:([0-9.]+)%/,'key width'),expectedW,1e-6,'SCD cap width');
near(grab(/\.key\{[^}]*height:([0-9.]+)%/,'key height'),expectedH,1e-6,'SCD cap height');
near(grab(/\.key\{[^}]*border-radius:([0-9.]+)%/,'corner radius'),expectedRadius,1e-6,'SCD corner radius');

const leftPct=[1.5786082,15.6411082,29.7036082,43.7661082,57.8286082,71.8911082,85.9536082];
const centers=leftPct.map(l=>l/100*W+capU/2);
for(let i=1;i<centers.length;i++)near(centers[i]-centers[i-1],pitchU,1e-5,'horizontal .970-in pitch');
near(centers[0],25,1e-5,'left function-key center');
near(centers[6],295,1e-5,'right function-key center');

const rowTop=[63.4547168,69.5031039,75.551491,81.5998781,87.6482652];
const rowCenter=rowTop.map(v=>v/100*H+capU/2);
const expectedRows=[256,278.5,301,323.5,346];
for(let i=0;i<expectedRows.length;i++)near(rowCenter[i],expectedRows[i],1e-5,'row/stagger center '+i);
for(let i=1;i<rowCenter.length;i++)near(rowCenter[i]-rowCenter[i-1],22.5,1e-5,'half-pitch vertical sequence');

if(!style.includes('SCD 1006353 rev B'))fail('primary cap drawing provenance missing');
if(!style.includes('SCD 2004968E front housing'))fail('housing pitch provenance missing');
console.log('keycap fidelity smoke: PASS');
console.log('  cap midpoint '+CAP_IN.toFixed(3)+' in within SCD .855-.865 in limits');
console.log('  center pitch '+PITCH_IN.toFixed(3)+' in; outer stagger '+(PITCH_IN/2).toFixed(3)+' in');
console.log('  corner radius '+RADIUS_IN.toFixed(3)+' in');
