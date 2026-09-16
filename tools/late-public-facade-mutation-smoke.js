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
    writes.push(`${name}: ${form}${key}`);
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

if(writes.length)throw new Error(`late AGCDSKY public-facade mutation outside ${OWNER}: ${writes.join(', ')}`);
console.log('late public facade mutation smoke: PASS');
console.log(`  zero direct late AGCDSKY assignments outside ${OWNER}; phone accessor seam audited separately`);
