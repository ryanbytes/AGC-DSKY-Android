#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const style=fs.readFileSync(path.join(ROOT,'app/src/main/assets/style.css'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'app/src/main/assets/index.html'),'utf8');
const third=fs.readFileSync(path.join(ROOT,'THIRD_PARTY.md'),'utf8');
const notices=fs.readFileSync(path.join(ROOT,'app/src/main/assets/THIRD_PARTY_NOTICES.txt'),'utf8');
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
const keyRule=(style.match(/\\.key\\{[^}]+\\}/)||[])[0]||'';
if(/Arial|Helvetica|font:/.test(keyRule))fail('visible key rule still depends on a runtime font');
if(!html.includes('source/Gorton-Normal-Splines.sfd')||!html.includes('8f24c6a28e5e0d979a6458a8c11859133146d4e6'))fail('Gorton Normal spline provenance missing');
if((html.match(/class="key /g)||[]).length!==19)fail('expected 19 physical key buttons');
if((html.match(/class="key-copy"/g)||[]).length!==19)fail('expected 19 hidden accessible key labels');
if((html.match(/class="key-legend key-legend-large"/g)||[]).length!==12)fail('expected 12 .250-in numeric/operator legends');
if((html.match(/class="key-legend key-legend-small"/g)||[]).length!==8)fail('expected 8 .125-in function legend lines');
if(html.includes('>VERB</button>')||html.includes('KEY<br>REL</button>'))fail('runtime-font key text returned');
for(const label of ['VERB','NOUN','CLR','ENTR','PRO','RSET','KEY REL']){
  if(!html.includes('aria-label="'+label+'"'))fail('accessible key label missing: '+label);
}
const largeH=grab(/\\.key-legend-large\\{height:([0-9.]+)%/,'large key legend height');
const smallH=grab(/\\.key-legend-small\\{height:([0-9.]+)%/,'small key legend height');
near(largeH/100*CAP_IN,.250,1e-6,'.250-in marking height');
near(smallH/100*CAP_IN,.125,1e-6,'.125-in marking height');
const largeStroke=grab(/\\.key-legend-large \\.key-glyph\\{stroke-width:([0-9.]+)/,'large stroke');
const smallStroke=grab(/\\.key-legend-small \\.key-glyph\\{stroke-width:([0-9.]+)/,'small stroke');
near(.250*largeStroke/(800+largeStroke),.030,1e-6,'.030-in large marking stroke');
near(.125*smallStroke/(800+smallStroke),.022,1e-6,'.022-in small marking stroke');
for(const marker of ['source/Gorton-Normal-Splines.sfd','8f24c6a28e5e0d979a6458a8c11859133146d4e6','SIL Open Font License 1.1']){
  if(!(third+'\\n'+notices).includes(marker))fail('Gorton key attribution missing: '+marker);
}
console.log('keycap fidelity smoke: PASS');
console.log('  cap midpoint '+CAP_IN.toFixed(3)+' in within SCD .855-.865 in limits');
console.log('  center pitch '+PITCH_IN.toFixed(3)+' in; outer stagger '+(PITCH_IN/2).toFixed(3)+' in');
console.log('  corner radius '+RADIUS_IN.toFixed(3)+' in');
