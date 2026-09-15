#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'dsky-display-renderer.js'),'utf8'),shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8'),api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(...n){n.forEach(x=>this.values.delete(x))}toggle(n,f){f?this.values.add(n):this.values.delete(n)}contains(n){return this.values.has(n)}}
class Element{constructor(){this.innerHTML='';this.classList=new Classes()}}
const elements={prog:new Element(),verb:new Element(),noun:new Element(),r1:new Element(),r2:new Element(),r3:new Element(),lamp:new Element()},body=new Element();
const context={window:null,document:{body,getElementById:id=>elements[id]||null,querySelector:s=>s==='[data-lamp="test"]'?elements.lamp:null,querySelectorAll:s=>s==='[data-lamp]'?[elements.lamp]:[]},String,Object};context.window=context;
vm.createContext(context);new vm.Script(source,{filename:'dsky-display-renderer.js'}).runInContext(context);
const renderer=context.AGCDSKY_RENDERER;assert(renderer&&Object.isFrozen(renderer),'renderer service missing or mutable');
renderer.set2('prog','16');renderer.setReg('r1','+','12345');renderer.setLamp('test',true);
assert(elements.prog.innerHTML.includes('data-seg="a"'),'two-digit renderer did not emit EL segment paths');assert(elements.r1.innerHTML.includes('el-sign')&&elements.r1.innerHTML.includes('el-glyph'),'register renderer did not emit sign and digit geometry');assert(elements.lamp.classList.contains('on'),'renderer service did not assert annunciator class');
body.classList.add('vn-flash-off');body.classList.add('el-off');renderer.clearLamps();assert(!elements.lamp.classList.contains('on'),'renderer service did not clear annunciator class');assert(!body.classList.contains('vn-flash-off')&&!body.classList.contains('el-off'),'renderer service did not restore display visibility classes');
// The service must follow later geometry replacement instead of capturing the old renderer.
vm.runInContext("renderDigits=function(el,text){el.innerHTML='replacement:'+text}",context);renderer.set2('prog','88');assert(elements.prog.innerHTML==='replacement:88','renderer service captured stale pre-geometry function binding');
for(const token of ['const SEG=','const PATH=','function renderDigits(','function set2(','function setLamp(','window.AGCDSKY_RENDERER=Object.freeze({']){assert(source.includes(token),`renderer missing ${token}`);if(!token.startsWith('window.AGCDSKY_RENDERER'))assert(!shell.includes(token)&&!api.includes(token),`non-renderer runtime regained renderer ownership: ${token}`)}
console.log('display runtime smoke: PASS');console.log('  EL primitives and frozen dynamic renderer service execute independently and follow later geometry replacement');
