#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNER='agc-api-runtime.js';
const files=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const creators=[];
const fallback=/\bwindow\.AGCDSKY\s*=\s*window\.AGCDSKY\s*\|\|\s*\{\s*\}/m;
for(const name of files){
  if(name===OWNER)continue;
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  if(fallback.test(source))creators.push(name);
}
if(creators.length)throw new Error(`root AGCDSKY facade recreated outside ${OWNER}: ${creators.join(', ')}`);
const owner=fs.readFileSync(path.join(ASSETS,OWNER),'utf8');
if(!owner.includes('window.AGCDSKY={services:apiServices'))throw new Error('public API runtime no longer owns root AGCDSKY creation');
console.log('root facade creation smoke: PASS');
console.log(`  root AGCDSKY creation confined to ${OWNER}`);
