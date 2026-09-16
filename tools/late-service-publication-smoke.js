#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNER='agc-api-runtime.js';
const EXPECTED=[
  'AGCDSKY_PHONE','AGCDSKY_RUNTIME','AGCDSKY_INPUT','AGCDSKY_CLOCK_BEHAVIOR',
  'AGCDSKY_OPTICS','AGCDSKY_SEXTANT_TAP_MARK','AGCDSKY_CM_MODE','AGCDSKY_HARDWARE',
  'AGCDSKY_PROCEED','AGCDSKY_AUDIO_RECOVERY','AGCDSKY_FLIGHT_HARDWARE_UI',
  'AGCDSKY_LIGHTING_RHEOSTAT_STOP','AGCDSKY_KEY_MECHANICAL_SPEC','AGCDSKY_KEYBOARD_ELECTRICAL',
  'AGCDSKY_LIGHTING_ELECTRICAL','AGCDSKY_RELAY_SHOW','AGCDSKY_HARDWARE_COLOR_MODE','AGCDSKY_DIAGNOSTICS',
  'AGCDSKY_APOLLO_STARS','AGCDSKY_PARALLAX','AGCDSKY_SCREEN_ONLY_GEOMETRY'
];
const NON_LATE=new Set([
  'AGCDSKY_APP_STATE','AGCDSKY_CORE_SESSION','AGCDSKY_COMPAT','AGCDSKY_SHELL','AGCDSKY_RENDERER',
  'AGCDSKY_ENVIRONMENT','AGCDSKY_AUDIO','AGCDSKY_CLOCK','AGCDSKY_DISPLAY','AGCDSKY_SNAPSHOT',
  'AGCDSKY_LIFECYCLE','AGCDSKY_KEY_CODES','AGCDSKY_SERVICES','AGCDSKY_DREAM_SILENT'
]);
function assert(c,m){if(!c)throw new Error(m)}
function same(a,b,m){assert(JSON.stringify(a)===JSON.stringify(b),`${m}\n actual: ${JSON.stringify(a)}\n expected: ${JSON.stringify(b)}`)}
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
const owner=read(OWNER);
const start=owner.indexOf('const LATE_SERVICE_GLOBALS=');
const end=owner.indexOf('const apiServices=');
assert(start>=0&&end>start,'late service registry bootstrap block missing');
const registrySource=owner.slice(start,end);
for(const marker of [
  'function createLateServiceRegistry()',
  "Object.defineProperty(window,name,{configurable:false,enumerable:false,get:()=>values[name]||null,set:service=>publish(name,service,`compatibility global publication: ${name}`)})",
  "throw new Error(`Late AGC service already published: ${name}`)",
  "Object.defineProperty(window,'AGCDSKY_SERVICE_REGISTRY'"
])assert(registrySource.includes(marker),`late service registry marker missing: ${marker}`);

function boot(window){
  const context={window,Object,Set,String,Error,TypeError};
  vm.createContext(context);
  vm.runInContext(registrySource,context,{filename:'late-service-registry-bootstrap.js'});
  return window.AGCDSKY_SERVICE_REGISTRY;
}
const window={};
const registry=boot(window);
assert(registry&&Object.isFrozen(registry),'late service registry missing or mutable');
same(Array.from(registry.names()),EXPECTED,'late service registry name set changed');
for(const name of EXPECTED){
  const descriptor=Object.getOwnPropertyDescriptor(window,name);
  assert(descriptor&&!descriptor.configurable&&typeof descriptor.get==='function'&&typeof descriptor.set==='function',`registry does not own accessor slot ${name}`);
  assert(window[name]===null,`${name} must be null before publication`);
}
const first=Object.freeze({kind:'runtime'});
window.AGCDSKY_RUNTIME=first;
assert(window.AGCDSKY_RUNTIME===first&&registry.get('AGCDSKY_RUNTIME')===first,'compatibility assignment did not publish through registry');
window.AGCDSKY_RUNTIME=first;
let threw=false;try{window.AGCDSKY_RUNTIME=Object.freeze({kind:'replacement'})}catch(_){threw=true}
assert(threw&&window.AGCDSKY_RUNTIME===first,'registry allowed a published service to be replaced');
const explicit=Object.freeze({kind:'input'});
registry.publish('AGCDSKY_INPUT',explicit,'smoke explicit publication');
assert(window.AGCDSKY_INPUT===explicit&&registry.require('AGCDSKY_INPUT')===explicit,'explicit publication did not drive compatibility accessor');
threw=false;try{registry.get('AGCDSKY_NOT_REAL')}catch(_){threw=true}assert(threw,'unknown late service name was accepted');
const described=registry.describe();
assert(described.find(x=>x.name==='AGCDSKY_RUNTIME').published,'published runtime missing from registry diagnostics');
assert(described.find(x=>x.name==='AGCDSKY_INPUT').reason==='smoke explicit publication','explicit publication reason missing');

const priorOptics=Object.freeze({kind:'preexisting-optics'}),preWindow={AGCDSKY_OPTICS:priorOptics};
const preRegistry=boot(preWindow);
assert(preRegistry.get('AGCDSKY_OPTICS')===priorOptics&&preWindow.AGCDSKY_OPTICS===priorOptics,'registry failed to absorb configurable pre-bootstrap service');

const writers=new Map(EXPECTED.map(name=>[name,[]])),unknown=[];
for(const file of fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort()){
  if(file===OWNER)continue;
  const source=read(file);
  let match;
  const direct=/\bwindow\.(AGCDSKY_[A-Z0-9_]+)\s*=\s*(?!=|>)/g;
  while((match=direct.exec(source))){
    const name=match[1];
    if(writers.has(name))writers.get(name).push(file);
    else if(!NON_LATE.has(name))unknown.push(`${file}:${name}`);
  }
  const define=/Object\.defineProperty\(window\s*,\s*['"](AGCDSKY_[A-Z0-9_]+)['"]/g;
  while((match=define.exec(source))){
    const name=match[1];
    if(writers.has(name))unknown.push(`${file}:${name} redefines registry accessor`);
  }
}
assert(!unknown.length,`unregistered or conflicting AGCDSKY service publication: ${unknown.join(', ')}`);
for(const [name,files] of writers){
  const unique=[...new Set(files)];
  assert(unique.length===1,`${name} expected one compatibility publisher, found ${unique.length}: ${unique.join(', ')||'none'}`);
}

console.log('late service publication smoke: PASS');
console.log(`  ${EXPECTED.length} late services use bootstrap-owned non-configurable publication slots; first publication wins and every producer is inventoried`);
