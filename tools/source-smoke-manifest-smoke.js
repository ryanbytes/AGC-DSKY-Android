#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),TOOLS=path.join(ROOT,'tools');
function assert(c,m){if(!c)throw new Error(m)}
function entries(file){return fs.readFileSync(path.join(TOOLS,file),'utf8').split(/\r?\n/).map(line=>line.replace(/#.*/,'').trim()).filter(Boolean)}
const included=entries('source-smoke-tests.txt');
const exclusions=entries('source-smoke-exclusions.txt').map(line=>{const at=line.indexOf('|');assert(at>0,`source smoke exclusion missing reason separator: ${line}`);const name=line.slice(0,at).trim(),reason=line.slice(at+1).trim();assert(reason.length>=12,`source smoke exclusion reason too weak: ${name}`);return{name,reason}});
const includedSet=new Set(included),excludedSet=new Set(exclusions.map(x=>x.name));
assert(includedSet.size===included.length,'canonical source smoke manifest contains duplicate entries');assert(excludedSet.size===exclusions.length,'source smoke exclusions contain duplicate entries');
for(const name of included){assert(name.endsWith('-smoke.js'),`canonical source entry is not a Node smoke: ${name}`);assert(fs.existsSync(path.join(TOOLS,name)),`canonical source smoke missing: ${name}`);assert(!excludedSet.has(name),`source smoke is both included and excluded: ${name}`)}
for(const {name} of exclusions){assert(name.endsWith('-smoke.js'),`excluded source entry is not a Node smoke: ${name}`);assert(fs.existsSync(path.join(TOOLS,name)),`excluded smoke missing: ${name}`)}
const all=fs.readdirSync(TOOLS).filter(name=>name.endsWith('-smoke.js')).sort();
const unclassified=all.filter(name=>!includedSet.has(name)&&!excludedSet.has(name));assert(!unclassified.length,`unclassified smoke programs: ${unclassified.join(', ')}`);
const unexpected=Array.from(new Set([...included,...exclusions.map(x=>x.name)])).filter(name=>!all.includes(name));assert(!unexpected.length,`classified entries are not smoke programs: ${unexpected.join(', ')}`);
console.log('source smoke manifest smoke: PASS');
console.log(`  ${included.length} canonical source smokes + ${exclusions.length} explicit device/retired exclusions classify all ${all.length} tools/*-smoke.js programs`);