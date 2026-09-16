#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNERS=new Set([
  'app-state-runtime.js',
  'dsky-display-renderer.js',
  'relay-audio-runtime.js',
  'phone-clock-runtime.js',
  'agc-display-runtime.js'
]);
const token='AGCDSKY_COMPAT';
const js=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const consumers=[];
for(const name of js){
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  if(source.includes(token))consumers.push(name);
}
const unexpected=consumers.filter(name=>!OWNERS.has(name));
const missing=[...OWNERS].filter(name=>!consumers.includes(name));
if(unexpected.length)throw new Error(`compatibility registry escaped owning runtimes: ${unexpected.join(', ')}`);
if(missing.length)throw new Error(`expected compatibility boundary owner no longer registers aliases: ${missing.join(', ')}`);
if(consumers.length!==OWNERS.size)throw new Error(`compatibility owner count changed: ${consumers.join(', ')}`);
for(const name of consumers){
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  if(name==='app-state-runtime.js'){
    if(!source.includes('window.AGCDSKY_COMPAT = Object.freeze({mutable,accessor,readonly,get,replace,describe});'))throw new Error('compatibility registry publication changed');
    continue;
  }
  if(!source.includes('const compat=window.AGCDSKY_COMPAT;'))throw new Error(`${name} does not bind registry only at its service boundary`);
  if(!source.includes('window.AGCDSKY_'))throw new Error(`${name} no longer publishes an owning service`);
}
console.log('compat boundary smoke: PASS');
console.log(`  registry confined to ${consumers.join(', ')}`);
