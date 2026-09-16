#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNER='agc-api-runtime.js';
// phone-icdu.js writes through the accessor-backed phone API seam and
// phone-api-runtime.js owns that seam; tools/phone-api-runtime-smoke.js audits it.
const EXEMPT=new Set(['phone-icdu.js','phone-api-runtime.js']);
// Exact quarantine inventory. Every later refactor phase must shrink this set;
// CI fails both on a new late mutation and when an entry disappears without the
// inventory being updated in the same change.
const KNOWN_LEGACY=new Set([
  'flight-hardware-ui.js:lighting',
  'flight-hardware-ui.js:hardwarePersonality',
  'key-mechanical-spec.js:hardwarePersonality',
  'key-mechanical-spec.js:keyMechanicalSpec',
  'keyboard-electrical-interlock.js:keyboardElectrical',
  'sextant-tap-mark.js:sextantTapMark'
]);
const files=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const writes=[];

for(const name of files){
  if(name===OWNER||EXEMPT.has(name))continue;
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  const seen=new Set();
  const record=(key,form)=>{
    if(!key)return;
    const id=`${name}:${key}`;
    if(seen.has(id))return;
    seen.add(id);
    writes.push({id,display:`${name}: ${form}${key}`});
  };

  let match;
  const direct=/\bwindow\.AGCDSKY\.([A-Za-z_$][\w$]*)\s*=\s*(?!=|>)/g;
  while((match=direct.exec(source)))record(match[1],'window.AGCDSKY.');
  const bracket=/\bwindow\.AGCDSKY\[['\"]([^'\"]+)['\"]\]\s*=\s*(?!=|>)/g;
  while((match=bracket.exec(source)))record(match[1],'window.AGCDSKY.');

  const aliases=[];
  const aliasDecl=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*window\.AGCDSKY\s*;/g;
  while((match=aliasDecl.exec(source)))aliases.push(match[1]);
  for(const alias of aliases){
    const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const dot=new RegExp(`\\b${escaped}\\.([A-Za-z_$][\\w$]*)\\s*=\\s*(?!=|>)`,'g');
    while((match=dot.exec(source)))record(match[1],`${alias}.`);
    const viaBracket=new RegExp(`\\b${escaped}\\[['\"]([^'\"]+)['\"]\\]\\s*=\\s*(?!=|>)`,'g');
    while((match=viaBracket.exec(source)))record(match[1],`${alias}.`);
  }
}

const observed=new Set(writes.map(item=>item.id));
const unexpected=writes.filter(item=>!KNOWN_LEGACY.has(item.id));
const missing=[...KNOWN_LEGACY].filter(id=>!observed.has(id));
if(unexpected.length)throw new Error(`new late AGCDSKY public-facade mutation outside ${OWNER}: ${unexpected.map(item=>item.display).join(', ')}`);
if(missing.length)throw new Error(`late facade quarantine inventory is stale; remove migrated entries: ${missing.join(', ')}`);
console.log('late public facade mutation inventory: PASS');
console.log(`  ${KNOWN_LEGACY.size} quarantined late assignments remain; CM/color/lighting-electrical/rheostat/PRO ownership now bootstrap-backed; phone accessor seam audited separately`);
