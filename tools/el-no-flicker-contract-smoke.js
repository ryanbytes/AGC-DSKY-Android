#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
function fail(message){throw new Error('EL NO-FLICKER CONTRACT FAIL: '+message)}
function assert(condition,message){if(!condition)fail(message)}
function section(source,start,end){
  const a=source.indexOf(start);if(a<0)fail('missing section start '+start);
  const b=end?source.indexOf(end,a+start.length):-1;
  return source.slice(a,b>=0?b:source.length);
}

const renderer=read('dsky-display-renderer.js');
const geometry=read('dsky-geometry.js');
const display=read('agc-display-runtime.js');
const stateCss=read('agc-state.css');
const cmCss=read('cm-dsky-finish.css');

const baseRender=section(renderer,'function baseRenderDigits(','function baseSet2(');
assert(!baseRender.includes('innerHTML'),'base EL renderer still performs live subtree replacement');
for(const token of ['stableSlots(','paintBaseDigit(','paintBaseSign('])assert(baseRender.includes(token)||renderer.includes(token),'base stable EL primitive missing: '+token);

const apolloRender=section(geometry,'function apolloRenderDigits(','renderer.installImplementation(');
assert(!apolloRender.includes('innerHTML'),'Apollo EL renderer still performs live subtree replacement');
for(const token of ['paintApolloDigitSlot(','paintApolloSignSlot('])assert(apolloRender.includes(token),'Apollo stable EL primitive missing: '+token);

const jsFiles=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js'));
for(const cls of ['vn-flash-off','el-off']){
  const mutation=new RegExp(`\\.classList\\.(?:add|remove|toggle)\\([^)]*['\"]${cls}['\"]`);
  const owners=jsFiles.filter(name=>mutation.test(read(name)));
  const allowed=['agc-display-runtime.js','dsky-display-renderer.js','hardware-fidelity.js'];
  for(const owner of owners)assert(allowed.includes(owner),`unexpected ${cls} mutation path in ${owner}`);
}
assert(display.includes("document.body.classList.toggle('vn-flash-off',!!(agcCh163Value&0o00040))"),'VERB/NOUN blanking is no longer tied only to channel 0163 bit 040');
assert(display.includes("document.body.classList.toggle('el-off',!!(agcCh163Value&0o01000))"),'EL power blanking is no longer tied only to channel 0163 bit 01000');
assert(renderer.includes("document.body.classList.remove('vn-flash-off','el-off')"),'display reset no longer clears only the intentional blanking classes');
const hardware=read('hardware-fidelity.js');
assert(hardware.includes("function hardwareDecodeChannel163(value)")&&hardware.includes("document.body.classList.toggle('el-off',!!(word&0o01000))"),'hardware EL-off path is not owned by channel 0163');
assert(hardware.includes("if(render&&name==='flash'){document.body.classList.toggle('vn-flash-off',on);renderer.refreshAccessibleState()}"),'hardware V/N flash path is not owned by the modeled FLASH relay or leaves its accessible state stale');

assert(stateCss.includes('.vn-flash-off #verb')&&stateCss.includes('.vn-flash-off #noun'),'intentional VERB/NOUN flash CSS missing');
for(const selector of ['.el-off .el-legend-bg','.el-off .el-rule','.el-off .el-field .el-seg.on','.el-off .comp-el.on .el-comp-bg'])assert(stateCss.includes(selector),'EL supply-off lost luminous selector '+selector);
assert(!stateCss.includes('.el-off .el-static')&&!stateCss.includes('.el-off .comp-el {'),'EL supply-off must not hide printed legend groups');
for(const selector of ['body.apollo-block-ii .el-legend-bg','body.apollo-block-ii .el-rule','body.apollo-block-ii .el-field .el-seg.on','body.apollo-block-ii .comp-el.on .el-comp-bg'])assert(cmCss.includes(selector),'NUMERICS dimmer lost phosphor-only selector '+selector);
assert(!cmCss.includes('body.apollo-block-ii .el-static{opacity:')&&!cmCss.includes('body.apollo-block-ii .comp-el{opacity:'),'NUMERICS dimmer must not dim printed legend groups');
for(const selector of ['body.apollo-block-ii.el-off .el-legend-bg','body.apollo-block-ii.el-off .el-rule','body.apollo-block-ii.el-off .el-field .el-seg.on','body.apollo-block-ii.el-off .comp-el.on .el-comp-bg'])assert(cmCss.includes(selector),'CM EL-off cascade override missing '+selector);
assert(!stateCss.includes('transition'),'EL blanking CSS must not animate/fade and create unintended intermediate frames');

const geometryNormal=section(geometry,'function ensureApolloDigitSlot(','renderer.installImplementation(');
assert(!geometryNormal.includes('requestAnimationFrame'),'EL segment renderer must not add animation-frame repaint loops');
assert(!geometryNormal.includes('setTimeout'),'EL segment renderer must not add deferred repaint loops');

console.log('EL no-flicker contract smoke: PASS');
console.log('  base + Apollo EL renderers keep stable live subtrees; only channel-0163 intentional V/N flash and EL-off signals may blank EL content');
