#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNER='agc-api-runtime.js';
const files=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const writes=[];

for(const name of files){
  if(name===OWNER)continue;
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  const seen=new Set();
  const record=(key,form)=>{
    if(!key)return;
    const id=`${name}:${form}${key}`;
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
    const defineProperty=new RegExp(`\\bObject\\.defineProperty\\(\\s*${escaped}\\s*,`,'g');
    if(defineProperty.test(source))record('*',`Object.defineProperty(${alias},`);
    const assign=new RegExp(`\\bObject\\.assign\\(\\s*${escaped}\\s*,`,'g');
    if(assign.test(source))record('*',`Object.assign(${alias},`);
    const reflectSet=new RegExp(`\\bReflect\\.set\\(\\s*${escaped}\\s*,`,'g');
    if(reflectSet.test(source))record('*',`Reflect.set(${alias},`);
  }
  if(/\bObject\.defineProperty\(\s*window\.AGCDSKY\s*,/.test(source))record('*','Object.defineProperty(window.AGCDSKY,');
  if(/\bObject\.assign\(\s*window\.AGCDSKY\s*,/.test(source))record('*','Object.assign(window.AGCDSKY,');
  if(/\bReflect\.set\(\s*window\.AGCDSKY\s*,/.test(source))record('*','Reflect.set(window.AGCDSKY,');
}

if(writes.length)throw new Error(`late AGCDSKY public-facade mutation outside ${OWNER}: ${writes.join(', ')}`);
console.log('late public facade mutation smoke: PASS');
console.log(`  zero direct late AGCDSKY assignments, defineProperty calls, Object.assign calls, or Reflect.set calls outside ${OWNER}`);
