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
const EXPECTED_SET=new Set(EXPECTED);
const NON_LATE=new Set([
  'AGCDSKY_APP_STATE','AGCDSKY_CORE_SESSION','AGCDSKY_COMPAT','AGCDSKY_SHELL','AGCDSKY_RENDERER',
  'AGCDSKY_ENVIRONMENT','AGCDSKY_AUDIO','AGCDSKY_CLOCK','AGCDSKY_DISPLAY','AGCDSKY_SNAPSHOT',
  'AGCDSKY_LIFECYCLE','AGCDSKY_KEY_CODES','AGCDSKY_SERVICES','AGCDSKY_DREAM_SILENT'
]);
function assert(c,m){if(!c)throw new Error(m)}
function same(a,b,m){assert(JSON.stringify(a)===JSON.stringify(b),`${m}\n actual: ${JSON.stringify(a)}\n expected: ${JSON.stringify(b)}`)}
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
const owner=read(OWNER),html=read('index.html');
const start=owner.indexOf('const LATE_SERVICE_GLOBALS=');
const end=owner.indexOf('const apiServices=');
assert(start>=0&&end>start,'late service registry bootstrap block missing');
const registrySource=owner.slice(start,end);
for(const marker of [
  'function createLateServiceRegistry()',
  "Object.defineProperty(window,name,{configurable:false,enumerable:false,get:()=>values[name]||null})",
  "throw new Error(`Late AGC service already published: ${name}`)",
  "Object.defineProperty(window,'AGCDSKY_SERVICE_REGISTRY'"
])assert(registrySource.includes(marker),`late service registry marker missing: ${marker}`);
assert(!registrySource.includes('set:service=>publish('),'late service globals must not retain a compatibility publication setter');
assert(!registrySource.includes('compatibility global publication:'),'late service registry retained compatibility-setter provenance');

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
  assert(descriptor&&!descriptor.configurable&&typeof descriptor.get==='function'&&descriptor.set===undefined,`registry does not own getter-only slot ${name}`);
  assert(window[name]===null,`${name} must be null before publication`);
}

const first=Object.freeze({kind:'runtime'});
let threw=false;try{window.AGCDSKY_RUNTIME=first}catch(_){threw=true}
assert(threw&&window.AGCDSKY_RUNTIME===null&&registry.get('AGCDSKY_RUNTIME')===null,'getter-only runtime view accepted direct publication');
registry.publish('AGCDSKY_RUNTIME',first,'smoke explicit runtime publication');
assert(window.AGCDSKY_RUNTIME===first&&registry.get('AGCDSKY_RUNTIME')===first,'explicit runtime publication did not drive read-only compatibility view');
threw=false;try{window.AGCDSKY_RUNTIME=Object.freeze({kind:'replacement'})}catch(_){threw=true}
assert(threw&&window.AGCDSKY_RUNTIME===first,'read-only runtime view allowed direct replacement');
threw=false;try{registry.publish('AGCDSKY_RUNTIME',Object.freeze({kind:'replacement'}),'replacement')}catch(_){threw=true}
assert(threw&&window.AGCDSKY_RUNTIME===first,'registry allowed a published service to be replaced');
const explicit=Object.freeze({kind:'input'});
registry.publish('AGCDSKY_INPUT',explicit,'smoke explicit publication');
assert(window.AGCDSKY_INPUT===explicit&&registry.require('AGCDSKY_INPUT')===explicit,'explicit publication did not drive compatibility accessor');
threw=false;try{registry.get('AGCDSKY_NOT_REAL')}catch(_){threw=true}assert(threw,'unknown late service name was accepted');
const described=registry.describe();
assert(described.find(x=>x.name==='AGCDSKY_RUNTIME').reason==='smoke explicit runtime publication','explicit runtime publication reason missing');
assert(described.find(x=>x.name==='AGCDSKY_INPUT').reason==='smoke explicit publication','explicit input publication reason missing');

const priorOptics=Object.freeze({kind:'preexisting-optics'}),preWindow={AGCDSKY_OPTICS:priorOptics};
const preRegistry=boot(preWindow);
const preDescriptor=Object.getOwnPropertyDescriptor(preWindow,'AGCDSKY_OPTICS');
assert(preRegistry.get('AGCDSKY_OPTICS')===priorOptics&&preWindow.AGCDSKY_OPTICS===priorOptics,'registry failed to absorb configurable pre-bootstrap service');
assert(preDescriptor&&!preDescriptor.configurable&&typeof preDescriptor.get==='function'&&preDescriptor.set===undefined,'absorbed pre-bootstrap service did not become a getter-only view');
assert(preRegistry.describe().find(x=>x.name==='AGCDSKY_OPTICS').reason==='pre-bootstrap publication: AGCDSKY_OPTICS','pre-bootstrap provenance changed');

const explicitPublishers=new Map(EXPECTED.map(name=>[name,[]]));
const violations=[];
const compatibilityReads=[];
for(const file of fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort()){
  if(file===OWNER)continue;
  const source=read(file);
  let match;

  const direct=/\bwindow\.(AGCDSKY_[A-Z0-9_]+)\s*=\s*(?!=|>)/g;
  while((match=direct.exec(source))){
    const name=match[1];
    if(EXPECTED_SET.has(name))violations.push(`${file}:${name} uses direct assignment instead of registry.publish`);
    else if(!NON_LATE.has(name))violations.push(`${file}:${name} is an unregistered AGCDSKY global publication`);
  }

  const define=/Object\.defineProperty\(window\s*,\s*['"](AGCDSKY_[A-Z0-9_]+)['"]/g;
  while((match=define.exec(source))){
    const name=match[1];
    if(EXPECTED_SET.has(name))violations.push(`${file}:${name} redefines registry-owned accessor`);
  }

  const registryAliases=new Set(['AGCDSKY_SERVICE_REGISTRY']);
  const aliasDecl=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*window\.AGCDSKY_SERVICE_REGISTRY\s*;/g;
  while((match=aliasDecl.exec(source)))registryAliases.add(match[1]);
  for(const alias of registryAliases){
    const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const publish=new RegExp(`\\b(?:window\\.)?${escaped}\\.publish\\(\\s*['\"](AGCDSKY_[A-Z0-9_]+)['\"]`,'g');
    while((match=publish.exec(source))){
      const name=match[1];
      if(EXPECTED_SET.has(name))explicitPublishers.get(name).push(file);
      else violations.push(`${file}:${name} explicitly publishes an unregistered late service`);
    }
  }

  const readCompat=/\bwindow\.(AGCDSKY_[A-Z0-9_]+)\b/g;
  while((match=readCompat.exec(source))){
    const name=match[1];
    if(EXPECTED_SET.has(name))compatibilityReads.push(`${file}:${name}`);
  }
}
assert(!violations.length,`late service publication boundary violation: ${violations.join(', ')}`);
assert(!compatibilityReads.length,`internal late-service compatibility read: ${[...new Set(compatibilityReads)].join(', ')}`);
const bootstrapIndex=html.indexOf('<script src="agc-api-runtime.js"></script>');
assert(bootstrapIndex>=0,'agc-api-runtime.js parser tag missing');
for(const [name,files] of explicitPublishers){
  const unique=[...new Set(files)];
  assert(unique.length===1,`${name} expected one explicit registry publisher, found ${unique.length}: ${unique.join(', ')||'none'}`);
  const file=unique[0],publisherIndex=html.indexOf(`src="${file}"`);
  assert(publisherIndex>bootstrapIndex,`${name} publisher ${file} must parser-load after agc-api-runtime.js owns the registry`);
}

console.log('late service publication smoke: PASS');
console.log(`  ${EXPECTED.length} getter-only late-service views have exactly one post-bootstrap explicit publisher; direct registry aliases are accepted while compatibility globals remain consumer-free`);
