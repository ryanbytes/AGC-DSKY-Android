#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),TOOLS=path.join(ROOT,'tools'),CANONICAL_SHELL=['ntp-time-smoke.sh'];
function assert(c,m){if(!c)throw new Error(m)}
function entries(file){return fs.readFileSync(path.join(TOOLS,file),'utf8').split(/\r?\n/).map(line=>line.replace(/#.*/,'').trim()).filter(Boolean)}
function isSmoke(name){return name.endsWith('-smoke.js')||name.endsWith('-smoke.sh')}
const included=entries('source-smoke-tests.txt'),canonical=[...included,...CANONICAL_SHELL];
const exclusions=entries('source-smoke-exclusions.txt').map(line=>{const at=line.indexOf('|');assert(at>0,`source smoke exclusion missing reason separator: ${line}`);const name=line.slice(0,at).trim(),reason=line.slice(at+1).trim();assert(reason.length>=12,`source smoke exclusion reason too weak: ${name}`);return{name,reason}});
const canonicalSet=new Set(canonical),excludedSet=new Set(exclusions.map(x=>x.name));
assert(canonicalSet.size===canonical.length,'canonical source smoke classification contains duplicate entries');assert(excludedSet.size===exclusions.length,'source smoke exclusions contain duplicate entries');
for(const name of included){assert(name.endsWith('-smoke.js'),`canonical manifest entry is not a Node smoke: ${name}`);assert(fs.existsSync(path.join(TOOLS,name)),`canonical source smoke missing: ${name}`)}
for(const name of CANONICAL_SHELL)assert(fs.existsSync(path.join(TOOLS,name)),`canonical shell smoke missing: ${name}`);
for(const name of canonical)assert(!excludedSet.has(name),`source smoke is both canonical and excluded: ${name}`);
for(const {name} of exclusions){assert(isSmoke(name),`excluded entry is not a smoke program: ${name}`);assert(fs.existsSync(path.join(TOOLS,name)),`excluded smoke missing: ${name}`)}
const all=fs.readdirSync(TOOLS).filter(isSmoke).sort();
const unclassified=all.filter(name=>!canonicalSet.has(name)&&!excludedSet.has(name));assert(!unclassified.length,`unclassified smoke programs: ${unclassified.join(', ')}`);
const unexpected=Array.from(new Set([...canonical,...exclusions.map(x=>x.name)])).filter(name=>!all.includes(name));assert(!unexpected.length,`classified entries are not smoke programs: ${unexpected.join(', ')}`);
console.log('source smoke manifest smoke: PASS');
console.log(`  ${included.length} canonical Node smokes + ${CANONICAL_SHELL.length} canonical shell smoke + ${exclusions.length} explicit device/retired exclusions classify all ${all.length} tools/*-smoke.{js,sh} programs`);