#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const source=fs.readFileSync(path.join(ASSETS,'dsky-geometry.js'),'utf8');
function fail(message){throw new Error('DSKY RENDER STABILITY FAIL: '+message)}
function assert(condition,message){if(!condition)fail(message)}

class Element{
  constructor(){this.attrs=new Map();this.children=[];this.parentNode=null;this._innerHTML='';this.innerHtmlWrites=0;}
  setAttribute(name,value){this.attrs.set(String(name),String(value))}
  getAttribute(name){return this.attrs.has(String(name))?this.attrs.get(String(name)):null}
  appendChild(node){node.parentNode=this;this.children.push(node);return node}
  removeChild(node){const index=this.children.indexOf(node);if(index<0)throw new Error('child not found');this.children.splice(index,1);node.parentNode=null;return node}
  get firstChild(){return this.children[0]||null}
  set innerHTML(value){this._innerHTML=String(value);this.innerHtmlWrites++}
  get innerHTML(){return this._innerHTML}
}

const ids=['prog','verb','noun','r1','r2','r3'],elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const SEG={0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg'};
const implementations={glyph:null,signGlyph:null,renderDigits:null,renderReg:null};
const versions={glyph:0,signGlyph:0,renderDigits:0,renderReg:0};
const renderer={
  segmentPattern:ch=>SEG[ch]||'',
  implementation:name=>implementations[name],
  installImplementation(name,fn){if(!(name in implementations))throw new Error('unknown implementation '+name);implementations[name]=fn;versions[name]++;return fn},
  compatibilityVersions:()=>({...versions}),
  set2(id,text){implementations.renderDigits(elements[id],String(text).padEnd(2,' ').slice(0,2))},
  setReg(id,sign,digits){implementations.renderReg(elements[id],(sign||' ')+String(digits).padEnd(5,' ').slice(0,5))},
  renderDigits(el,text){implementations.renderDigits(el,text)}
};
const context={
  console,window:null,document:{
    getElementById:id=>elements[id]||null,
    createElementNS:(_ns,_tag)=>new Element()
  },
  Object,Array,String,Number,Map,Set,Math,
  setTimeout:()=>1
};
context.window=context;
context.window.addEventListener=()=>{};
context.AGCDSKY_APP_STATE={mode:'agc-loading',verb:'16',noun:'65'};
context.AGCDSKY_RENDERER=renderer;
context.AGCDSKY_SHELL={show(){}};
context.AGCDSKY_CLOCK={lampTestActive:()=>false,renderReg(){}};
context.AGCDSKY_DISPLAY={renderSnapshot(){}};
vm.createContext(context);
new vm.Script(source,{filename:'dsky-geometry.js'}).runInContext(context);

renderer.setReg('r3','+','00000');
const initial=elements.r3.children.slice();
assert(initial.length===6,'register did not create one persistent sign slot plus five digit slots');
const firstWrites=initial.map(slot=>slot.innerHtmlWrites);

renderer.setReg('r3','-','00000');
assert(elements.r3.children.every((slot,index)=>slot===initial[index]),'register slot identity changed when only sign changed');
assert(initial[0].innerHtmlWrites===firstWrites[0]+1,'changed sign slot was not repainted');
for(let index=1;index<6;index++)assert(initial[index].innerHtmlWrites===firstWrites[index],`unchanged zero slot ${index} repainted when sign changed`);

renderer.setReg('r3','-','80000');
assert(initial[1].innerHtmlWrites===firstWrites[1]+1,'changed first digit slot was not repainted');
for(let index=2;index<6;index++)assert(initial[index].innerHtmlWrites===firstWrites[index],`neighboring zero slot ${index} repainted when first digit changed`);

renderer.setReg('r3','-','80001');
assert(initial[5].innerHtmlWrites===firstWrites[5]+1,'changed last digit slot was not repainted');
for(let index=2;index<5;index++)assert(initial[index].innerHtmlWrites===firstWrites[index],`middle zero slot ${index} repainted when last digit changed`);
const beforeRepeat=initial.map(slot=>slot.innerHtmlWrites);
renderer.setReg('r3','-','80001');
initial.forEach((slot,index)=>assert(slot.innerHtmlWrites===beforeRepeat[index],`identical register repaint mutated slot ${index}`));

renderer.set2('prog','00');
const prog=elements.prog.children.slice(),progWrites=prog.map(slot=>slot.innerHtmlWrites);
renderer.set2('prog','01');
assert(elements.prog.children[0]===prog[0]&&elements.prog.children[1]===prog[1],'upper-field slot identity changed');
assert(prog[0].innerHtmlWrites===progWrites[0],'unchanged upper zero repainted when neighbor changed');
assert(prog[1].innerHtmlWrites===progWrites[1]+1,'changed upper digit did not repaint');

console.log('DSKY render stability smoke: PASS');
console.log('  unchanged register/upper glyph slots retain SVG node identity and are not repainted when neighboring elements change');
