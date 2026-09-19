#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const stateSource=fs.readFileSync(path.join(ASSETS,'app-state-runtime.js'),'utf8'),source=fs.readFileSync(path.join(ASSETS,'dsky-display-renderer.js'),'utf8'),shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8'),api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8'),style=fs.readFileSync(path.join(ASSETS,'style.css'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(...n){n.forEach(x=>this.values.delete(x))}toggle(n,f){f?this.values.add(n):this.values.delete(n)}contains(n){return this.values.has(n)}}
class Element{constructor(){this.innerHTML='';this.classList=new Classes()}}
const elements={prog:new Element(),verb:new Element(),noun:new Element(),r1:new Element(),r2:new Element(),r3:new Element(),lamp:new Element()},body=new Element();
const context={window:null,document:{hidden:false,body,getElementById:id=>elements[id]||null,querySelector:s=>s==='[data-lamp="test"]'?elements.lamp:null,querySelectorAll:s=>s==='[data-lamp]'?[elements.lamp]:[]},String,Object,Map,TypeError};context.window=context;
vm.createContext(context);new vm.Script(stateSource,{filename:'app-state-runtime.js'}).runInContext(context);new vm.Script(source,{filename:'dsky-display-renderer.js'}).runInContext(context);
const renderer=context.AGCDSKY_RENDERER;assert(renderer&&Object.isFrozen(renderer),'renderer service missing or mutable');assert(context.AGCDSKY_COMPAT&&Object.isFrozen(context.AGCDSKY_COMPAT),'compatibility registry missing');
renderer.set2('prog','16');renderer.setReg('r1','+','12345');renderer.setLamp('test',true);
assert(elements.prog.innerHTML.includes('data-seg="a"'),'two-digit renderer did not emit EL segment paths');assert(elements.r1.innerHTML.includes('el-sign')&&elements.r1.innerHTML.includes('el-glyph'),'register renderer did not emit sign and digit geometry');assert(!elements.prog.innerHTML.includes('el-seg off')&&!elements.r1.innerHTML.includes('el-seg off'),'renderer emitted unlit EL segment geometry');assert(elements.lamp.classList.contains('on'),'renderer service did not assert annunciator class');
assert(style.includes('.el-seg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;'),'base CSS must hide every EL segment unless explicitly energized');
assert(style.includes('.el-seg.on{\n  display:inline;\n  fill:var(--el);'),'energized EL segment CSS missing');
assert(style.includes('.el-comp-bg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;'),'COMP ACTY phosphor must be absent while off');
assert(style.includes('.comp-el.on .el-comp-bg{\n  display:block;\n  fill:var(--el);'),'COMP ACTY phosphor must require energized state');
renderer.set2('prog','  ');assert(!elements.prog.innerHTML.includes('<path'),'blank EL digits must render no segment paths');renderer.set2('prog','16');
body.classList.add('vn-flash-off');body.classList.add('el-off');renderer.clearLamps();assert(!elements.lamp.classList.contains('on'),'renderer service did not clear annunciator class');assert(!body.classList.contains('vn-flash-off')&&!body.classList.contains('el-off'),'renderer service did not restore display visibility classes');
const before=renderer.compatibilityVersions().renderDigits;vm.runInContext("renderDigits=function(el,text){el.innerHTML='replacement:'+text}",context);renderer.set2('prog','88');assert(elements.prog.innerHTML==='replacement:88','legacy renderer assignment did not forward into renderer-owned slot');assert(renderer.compatibilityVersions().renderDigits===before+1,'renderer-owned replacement version did not advance');assert(context.AGCDSKY_COMPAT.describe().find(x=>x.name==='renderDigits').version===before+1,'compatibility diagnostics did not mirror renderer-owned version');
for(const token of ['const compat=window.AGCDSKY_COMPAT;','const SEG=','const PATH=','function createImplementationSlot(name,initial,validate=null)',"digitsSlot=createImplementationSlot('renderDigits'","set2Slot=createImplementationSlot('set2'","setLampSlot=createImplementationSlot('setLamp'",'compat.alias(name,slot.get','window.AGCDSKY_RENDERER=Object.freeze({'])assert(source.includes(token),`renderer missing ${token}`);
for(const token of ["compat.mutable('renderDigits'","compat.mutable('set2'","compat.mutable('setLamp'"])assert(!source.includes(token),`renderer compatibility registry still owns implementation slot: ${token}`);
for(const token of ['const SEG=','const PATH='])assert(!shell.includes(token)&&!api.includes(token),`non-renderer runtime regained renderer ownership: ${token}`);
console.log('display runtime smoke: PASS');console.log('  EL primitives, frozen renderer service, owner-held implementation slots, forwarded legacy assignments, and mirrored compatibility diagnostics verified');
