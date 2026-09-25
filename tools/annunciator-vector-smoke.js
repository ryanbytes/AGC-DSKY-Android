#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fail=m=>{throw new Error('ANNUNCIATOR VECTOR FAIL: '+m)};
const req=(src,needle,label)=>{if(!src.includes(needle))fail(label+' missing: '+needle)};
const no=(src,needle,label)=>{if(src.includes(needle))fail(label+' must not contain: '+needle)};

const html=read('app/src/main/assets/index.html');
const finish=read('app/src/main/assets/cm-dsky-finish.css');
const ui=read('app/src/main/assets/flight-hardware-ui.js');
const third=read('THIRD_PARTY.md');
const notices=read('app/src/main/assets/THIRD_PARTY_NOTICES.txt');

req(html,'source/Gorton-Condensed.sfd','Gorton source provenance');
req(html,'15fdfc7ac3507c79fb6bfdb2102acd14d35b0e76','Gorton source blob');
req(html,'SIL Open Font License 1.1','Gorton license marker');
req(html,'class="gorton-defs"','Gorton SVG defs');
req(html,'viewBox="0 0 7318.590 3339.007"','physical annunciator cell viewBox');

const labels={
  uplink:'UPLINK ACTY',temp:'TEMP',noatt:'NO ATT',gimbal:'GIMBAL LOCK',
  stby:'STBY',prog:'PROG',keyrel:'KEY REL',restart:'RESTART',
  oprerr:'OPR ERR',tracker:'TRACKER'
};
for(const [name,label] of Object.entries(labels)){
  const marker=`data-lamp="${name}" aria-label="${label}"><svg class="lamp-legend"`;
  req(html,marker,'fixed vector legend '+name);
}
for(const raw of ['>UPLINK<br>ACTY<','>GIMBAL<br>LOCK<','>KEY REL<','>RESTART<','>TRACKER<'])no(html,raw,'runtime text annunciator');

const vectorCount=(html.match(/<svg class="lamp-legend"/g)||[]).length;
const legendBlocks=[...html.matchAll(/<svg class="lamp-legend"[\s\S]*?<\/svg>/g)].map(m=>m[0]);
if(legendBlocks.length!==10)fail('expected 10 vector legend blocks, found '+legendBlocks.length);
for(const [i,legend] of legendBlocks.entries())no(legend,'scale(1 -1)','legend '+(i+1)+' vertical inversion');
const legendTransforms=[...legendBlocks.join('\n').matchAll(/transform="translate\(([-0-9.]+)\s+([-0-9.]+)\)"/g)];
if(legendTransforms.length!==63)fail('expected 63 Gorton glyph transforms, found '+legendTransforms.length);
const uprightY=new Set(['619.504','1209.503','1799.503']);
for(const m of legendTransforms){if(!uprightY.has(m[2]))fail('unexpected upright legend Y offset '+m[2]);}
req(html,'id="gorton-T" d="M95,60','pre-oriented Gorton SVG outline');
if(vectorCount!==10)fail('expected 10 vector legends, found '+vectorCount);
const blankCount=(html.match(/class="lamp (?:white|yellow) blank"/g)||[]).length;
if(blankCount!==4)fail('expected four blank CM cells, found '+blankCount);
for(const ch of ['A','B','C','E','G','I','K','L','M','N','O','P','R','S','T','U','Y'])req(html,`id="gorton-${ch}"`,'required Gorton glyph');

const strokeMatch=finish.match(/\.gorton-glyph\{[\s\S]*?stroke-width:\s*([0-9.]+);/);
if(!strokeMatch)fail('fixed-vector stroke width missing');
const outlineUnits=Number(strokeMatch[1]);
const CHAR_HEIGHT_IN=.156;
const GORTON_CAP_UNITS=920;
const GORTON_STRAIGHT_STEM_UNITS=120;
const effectiveStraightStemIn=((GORTON_STRAIGHT_STEM_UNITS+outlineUnits)/GORTON_CAP_UNITS)*CHAR_HEIGHT_IN;
if(!(effectiveStraightStemIn>=.025-1e-9 && effectiveStraightStemIn<=.030+1e-9)){
  fail('derived straight-stem width '+effectiveStraightStemIn.toFixed(6)+' in is outside SCD .025-.030 in envelope');
}

for(const marker of [
  'paint-order:stroke fill',
  '.gorton-defs{position:absolute;width:0;height:0',
  '.lamp .lamp-legend .gorton-glyph',
  'position:absolute;',
  'width:100%;',
  'height:100%;'
])req(finish,marker,'fixed vector CSS');
no(finish,'"Roboto Condensed"','annunciator runtime font fallback');
no(finish,'"Arial Narrow"','annunciator runtime font fallback');

for(const marker of [
  "let legend = lamp.querySelector('.lamp-legend')",
  'never replace a vector legend',
  'lamp.insertBefore(source, legend)',
  'lamp.appendChild(legend)'
])req(ui,marker,'lamp hardware/vector preservation');

for(const marker of [
  'source/Gorton-Condensed.sfd',
  '15fdfc7ac3507c79fb6bfdb2102acd14d35b0e76',
  'SIL Open Font License 1.1',
  'Copyright (c) 2019 Eugene Dorr'
])req(third+'\n'+notices,marker,'Gorton attribution');

console.log('annunciator fixed-vector smoke: PASS');
console.log('  ten CM Gorton legends, four blanks, OFL attribution, and deterministic vector construction are source-gated');
console.log('  derived nominal straight-stem width: '+effectiveStraightStemIn.toFixed(6)+' in at .156-in character height');
