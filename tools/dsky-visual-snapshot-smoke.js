#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const norm=s=>s.replace(/\s+/g,' ').trim();
function fnv(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0')}
function grab(src,re,name){const m=src.match(re);if(!m)throw new Error('visual snapshot block missing: '+name);return norm(m[0])}
function expect(name,actual,want){if(actual!==want)throw new Error(name+' visual snapshot changed: '+actual+' != '+want)}

const renderer=read('app/src/main/assets/dsky-display-renderer.js');
const geometry=read('app/src/main/assets/dsky-geometry.js');
const style=read('app/src/main/assets/style.css');
const cheat=read('app/src/main/assets/cheatsheet.css');

expect('EL renderer',fnv(grab(renderer,/const SEG=\{[\s\S]*?function baseClearLamps\(\)\{[\s\S]*?\}/,'renderer')),'909c8096');
expect('Apollo geometry',fnv(grab(geometry,/const FACE_W_IN=2\.360[\s\S]*?const REGISTER_Y=BAR_CENTER_Y\.map\(c=>c\+\(BAR_H_IN\*\.5\+REGISTER_GAP_IN\)\*U\);/,'geometry')),'a493b6d4');
expect('display-only crop/seam',fnv(grab(style,/\/\* Display-only mode[\s\S]*?@media \(orientation:landscape\)\{[^\n]*\}/,'display-only')),'1479ef1e');
expect('checklist print',fnv(grab(cheat,/\/\* Compact model-checklist print layout[\s\S]*$/,'print')),'4967632a');

if(!renderer.includes('Unlit electrodes are deliberately absent'))throw new Error('unlit EL absence contract missing');
if(!style.includes('body.display-only .dsky:before{border-top-color:transparent}'))throw new Error('display-only top seam suppression missing');
if(!cheat.includes('size:Letter landscape')||!cheat.includes('grid-template-columns:repeat(2,5.10in)'))throw new Error('landscape 4-up checklist print contract missing');
console.log('DSKY visual snapshot smoke: PASS');
