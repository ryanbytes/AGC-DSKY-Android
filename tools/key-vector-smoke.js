#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fail=m=>{throw new Error('KEY VECTOR FAIL: '+m)};
const req=(s,n,l)=>{if(!s.includes(n))fail(l+' missing: '+n)};
const no=(s,n,l)=>{if(s.includes(n))fail(l+' must not contain: '+n)};
const near=(a,b,t=1e-9)=>{if(Math.abs(a-b)>t)fail(`${a} != ${b}`)};

const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/style.css');
const finish=read('app/src/main/assets/cm-dsky-finish.css');
const ui=read('app/src/main/assets/flight-hardware-ui.js');
const third=read('THIRD_PARTY.md');
const notices=read('app/src/main/assets/THIRD_PARTY_NOTICES.txt');

const expected=[
 ['V','VERB','small'],['+','PLUS','big'],['7','7','big'],['8','8','big'],['9','9','big'],['C','CLR','small'],['E','ENTR','small'],
 ['N','NOUN','small'],['-','MINUS','big'],['4','4','big'],['5','5','big'],['6','6','big'],['P','PRO','small'],['R','RSET','small'],
 ['0','0','big'],['1','1','big'],['2','2','big'],['3','3','big'],['K','KEY REL','small']
];
const buttons=[...html.matchAll(/<button class="key [^"]*" data-key="([^"]+)" aria-label="([^"]+)">([\s\S]*?)<\/button>/g)];
if(buttons.length!==19)fail('expected 19 keyed vector buttons, found '+buttons.length);
buttons.forEach((m,i)=>{
 const [key,label,kind]=expected[i];
 if(m[1]!==key||m[2]!==label)fail(`button ${i+1} identity mismatch: ${m[1]}/${m[2]}`);
 const body=m[3];
 req(body,`class="key-legend key-legend-${kind}"`,'button '+label+' vector');
 if(body.replace(/<[^>]+>/g,'').trim())fail('visible runtime text survived in '+label);
});

const defs=[...html.matchAll(/id="(key-g(?:120|180)-[^"]+)"/g)].map(m=>m[1]);
if(defs.length!==26)fail('expected 26 Gorton key definitions, found '+defs.length);
if(new Set(defs).size!==defs.length)fail('duplicate Gorton key definition id');
if(defs.filter(x=>x.startsWith('key-g120-')).length!==12)fail('expected 12 Gorton-120 definitions');
if(defs.filter(x=>x.startsWith('key-g180-')).length!==14)fail('expected 14 Gorton-180 definitions');
if((html.match(/href="#key-g120-/g)||[]).length!==12)fail('expected 12 large-key uses');
if((html.match(/href="#key-g180-/g)||[]).length!==28)fail('expected 28 function-letter uses');

for(const marker of [
 'source/Gorton-Normal-120.sfd blob 33028992cb971f4045b8c5e9ffac720f8307588c',
 'Gorton-Normal-180.sfd blob 9356a37a8c9aed5a7471a5559a9a9c8ac13c1ad1',
 'SIL Open Font License 1.1',
 'id="key-erode-big"',
 '<feMorphology in="SourceGraphic" operator="erode" radius="1.5"/>',
 'id="key-erode-small"',
 '<feMorphology in="SourceGraphic" operator="erode" radius=".5875"/>',
 'scale(0.271739130435 -0.271739130435)',
 'scale(0.127551020408 -0.127551020408)',
 'translate(430 430) scale(1.012) translate(-430 -430)',
 'translate(430 430) scale(1.0094) translate(-430 -430)',
 'translate(430 336.5) scale(1.0094) translate(-430 -336.5)',
 'translate(430 523.5) scale(1.0094) translate(-430 -523.5)'
])req(html,marker,'fixed Gorton key construction');

const bigScale=.271739130435*1.012;
const smallScale=.127551020408*1.0094;
near(bigScale,.275,3e-13);
near(smallScale,.12875,3e-13);
near((800+120)*bigScale-2*1.5,250,3e-10);
near(120*bigScale-2*1.5,30,3e-10);
near((800+180)*smallScale-2*.5875,125,3e-10);
near(180*smallScale-2*.5875,22,3e-10);

const keyRule=css.match(/\.key\{[^}]+\}/)?.[0]||'';
no(keyRule,'font:','keycap runtime font');
no(keyRule,'font-family','keycap runtime font');
no(keyRule,'text-shadow','keycap text rendering');
for(const marker of [
 '.gorton-key-defs{position:absolute;width:0;height:0',
 '.key-legend{position:absolute;inset:0;width:100%;height:100%',
 'fill:var(--key-el-color)',
 'filter:var(--key-el-filter)'
])req(css,marker,'key vector CSS');
for(const marker of [
 '--key-el-filter:drop-shadow(',
 'body.spacecraft-cm .key .key-legend',
 'fill:var(--key-el-color)',
 'filter:var(--key-el-filter)'
])req(finish,marker,'key integral-light styling');
for(const marker of [
 "root.style.setProperty('--key-el-color'",
 "root.style.setProperty('--key-el-filter'"
])req(ui,marker,'key integral-light runtime');
no(finish,'--key-el-shadow','obsolete key text shadow');
no(ui,'--key-el-shadow','obsolete runtime key text shadow');

for(const marker of [
 'Gorton Normal key vector outlines',
 '33028992cb971f4045b8c5e9ffac720f8307588c',
 '9356a37a8c9aed5a7471a5559a9a9c8ac13c1ad1',
 '314500f5587b5afe27f52c5069efeb12262909c2',
 '1f2b149a9916433bef3cde56e4b8dd16aa1b7241',
 'SIL Open Font License 1.1'
])req(third+'\n'+notices,marker,'Gorton Normal attribution');

console.log('key vector smoke: PASS');
console.log('  19 fixed SVG key legends; no runtime key font');
console.log('  normalized big marking: .250 in overall / .030 in stroke');
console.log('  normalized small marking: .125 in overall / .022 in stroke');
console.log('  KEY/REL rows retain .062-in inter-row clearance');
