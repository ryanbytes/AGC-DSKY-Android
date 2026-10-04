#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const stateSource=fs.readFileSync(path.join(ASSETS,'app-state-runtime.js'),'utf8'),source=fs.readFileSync(path.join(ASSETS,'dsky-display-renderer.js'),'utf8'),shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8'),api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8'),style=fs.readFileSync(path.join(ASSETS,'style.css'),'utf8'),html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
class Classes{constructor(){this.values=new Set()}add(n){this.values.add(n)}remove(...n){n.forEach(x=>this.values.delete(x))}toggle(n,f){f?this.values.add(n):this.values.delete(n)}contains(n){return this.values.has(n)}}
class Element{
  constructor(){this.attrs=new Map();this.children=[];this.parentNode=null;this._innerHTML='';this.innerHtmlWrites=0;this.classList=new Classes()}
  setAttribute(n,v){this.attrs.set(String(n),String(v))}
  getAttribute(n){return this.attrs.has(String(n))?this.attrs.get(String(n)):null}
  appendChild(node){node.parentNode=this;this.children.push(node);return node}
  removeChild(node){const i=this.children.indexOf(node);if(i<0)throw new Error('child not found');this.children.splice(i,1);node.parentNode=null;return node}
  get firstChild(){return this.children[0]||null}
  set innerHTML(v){this._innerHTML=String(v);this.innerHtmlWrites++}
  get innerHTML(){return this._innerHTML}
}
const lamps=new Map(Object.entries({uplink:'UPLINK ACTY',temp:'TEMP',noatt:'NO ATT',gimbal:'GIMBAL LOCK',stby:'STBY',prog:'PROG',keyrel:'KEY REL',restart:'RESTART',oprerr:'OPR ERR',tracker:'TRACKER',comp:'COMP ACTY'}).map(([name,label])=>{const el=new Element();el.setAttribute('aria-label',label+' off');return[name,el]}));
const elements={prog:new Element(),verb:new Element(),noun:new Element(),r1:new Element(),r2:new Element(),r3:new Element(),elpanel:new Element(),lamp:new Element()},body=new Element();
const context={window:null,document:{hidden:false,body,getElementById:id=>elements[id]||null,createElementNS:()=>new Element(),querySelector:s=>{const match=/^\[data-lamp="([^"]+)"\]$/.exec(s);return match?lamps.get(match[1])||(match[1]==='test'?elements.lamp:null):null},querySelectorAll:s=>s==='[data-lamp]'?[...lamps.values(),elements.lamp]:[]},String,Object,Array,Map,TypeError};context.window=context;
vm.createContext(context);new vm.Script(stateSource,{filename:'app-state-runtime.js'}).runInContext(context);new vm.Script(source,{filename:'dsky-display-renderer.js'}).runInContext(context);
const renderer=context.AGCDSKY_RENDERER;assert(renderer&&Object.isFrozen(renderer),'renderer service missing or mutable');assert(context.AGCDSKY_COMPAT&&Object.isFrozen(context.AGCDSKY_COMPAT),'compatibility registry missing');
renderer.set2('prog','16');renderer.setReg('r1','+','12345');renderer.setLamp('test',true);
assert(elements.prog.children.length===2&&elements.prog.children.every(slot=>slot.firstChild&&slot.firstChild.getAttribute('data-el-base-glyph')==='1'),'two-digit renderer did not create stable EL glyph slots');
assert(elements.r1.children.length===6&&elements.r1.children[0].firstChild.getAttribute('data-el-base-sign')==='1'&&elements.r1.children.slice(1).every(slot=>slot.firstChild.getAttribute('data-el-base-glyph')==='1'),'register renderer did not create stable sign/digit geometry');
assert(elements.prog.innerHtmlWrites===0&&elements.r1.innerHtmlWrites===0&&elements.prog.children.every(slot=>slot.innerHtmlWrites===0)&&elements.r1.children.every(slot=>slot.innerHtmlWrites===0),'base EL renderer used innerHTML subtree replacement');
assert(elements.lamp.classList.contains('on'),'renderer service did not assert annunciator class');
renderer.setLamp('prog',true);assert(lamps.get('prog').getAttribute('aria-label')==='PROG on','annunciator accessibility name did not report its lit state');
assert(elements.elpanel.getAttribute('aria-label').includes('Program 1 6')&&elements.elpanel.getAttribute('aria-label').includes('Register 1 plus 1 2 3 4 5')&&elements.elpanel.getAttribute('aria-label').includes('Annunciators on: PROG'),'accessible DSKY display summary missed rendered fields or lamp state');
body.classList.add('vn-flash-off');renderer.refreshAccessibleState();assert(elements.elpanel.getAttribute('aria-label').startsWith('Verb and noun are blanked by AGC modulation'),'accessible display summary missed V/N blanking');
body.classList.remove('vn-flash-off');body.classList.add('el-off');renderer.refreshAccessibleState();assert(elements.elpanel.getAttribute('aria-label').startsWith('EL display off; values below are last latched.'),'accessible display summary missed EL power-off');
renderer.clearLamps();assert(lamps.get('prog').getAttribute('aria-label')==='PROG off'&&!elements.elpanel.getAttribute('aria-label').includes('Annunciators on: PROG'),'lamp clear did not update its accessible state');
for(const [name,label] of Object.entries({uplink:'UPLINK ACTY',temp:'TEMP',noatt:'NO ATT',gimbal:'GIMBAL LOCK',stby:'STBY',prog:'PROG',keyrel:'KEY REL',restart:'RESTART',oprerr:'OPR ERR',tracker:'TRACKER',comp:'COMP ACTY'}))assert(new RegExp(`data-lamp="${name}" role="img" aria-label="${label} off"`).test(html),`${name} lamp is not an initially named accessible image`);
assert(/id="elpanel"[^>]*role="group" aria-label="DSKY electroluminescent display/.test(html),'EL panel must expose a named display group');
assert(!/id="elpanel"[^>]*aria-live/.test(html),'rapid AGC display changes must not become automatic live announcements');
for(const id of ['prog','verb','noun','r1','r2','r3'])assert(new RegExp(`id="${id}" class="el-field" aria-hidden="true"`).test(html),`${id} SVG segments must be hidden behind the text alternative`);
assert(/id="comp" class="comp-el" data-lamp="comp" role="img" aria-label="COMP ACTY off"/.test(html),'COMP ACTY must remain an independently exposed image within the display group');
assert(style.includes('.el-seg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;'),'base CSS must hide every EL segment unless explicitly energized');
assert(style.includes('.el-seg.on{\n  display:inline;\n  fill:var(--el);'),'energized EL segment CSS missing');
assert(style.includes('.el-comp-bg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;'),'COMP ACTY phosphor must be absent while off');
assert(style.includes('.comp-el.on .el-comp-bg{\n  display:block;\n  fill:var(--el);'),'COMP ACTY phosphor must require energized state');
const progSlots=elements.prog.children.slice(),progGroups=progSlots.map(s=>s.firstChild),progPaths=progGroups.map(g=>g.children.slice());
renderer.set2('prog','  ');assert(progSlots.every(slot=>slot.firstChild.children.every(path=>!path.classList.contains('on')&&path.getAttribute('class')==='el-seg')),'blank EL digits must de-energize all existing segment paths');
renderer.set2('prog','16');assert(elements.prog.children.every((slot,i)=>slot===progSlots[i]&&slot.firstChild===progGroups[i]&&slot.firstChild.children.every((path,j)=>path===progPaths[i][j])),'base EL renderer replaced stable nodes after blank/repaint');
body.classList.add('vn-flash-off');body.classList.add('el-off');renderer.clearLamps();assert(!elements.lamp.classList.contains('on'),'renderer service did not clear annunciator class');assert(!body.classList.contains('vn-flash-off')&&!body.classList.contains('el-off'),'renderer service did not restore display visibility classes');
const before=renderer.compatibilityVersions().renderDigits;vm.runInContext("renderDigits=function(el,text){el.innerHTML='replacement:'+text}",context);renderer.set2('prog','88');assert(elements.prog.innerHTML==='replacement:88','legacy renderer assignment did not forward into renderer-owned slot');assert(renderer.compatibilityVersions().renderDigits===before+1,'renderer-owned replacement version did not advance');assert(context.AGCDSKY_COMPAT.describe().find(x=>x.name==='renderDigits').version===before+1,'compatibility diagnostics did not mirror renderer-owned version');
for(const token of ['const compat=window.AGCDSKY_COMPAT;','const SEG=','const PATH=','function createImplementationSlot(name,initial,validate=null)',"digitsSlot=createImplementationSlot('renderDigits'","set2Slot=createImplementationSlot('set2'","setLampSlot=createImplementationSlot('setLamp'",'refreshAccessibleState:()=>syncAccessibleDisplay()','compat.alias(name,slot.get','window.AGCDSKY_RENDERER=Object.freeze({'])assert(source.includes(token),`renderer missing ${token}`);
for(const token of ["compat.mutable('renderDigits'","compat.mutable('set2'","compat.mutable('setLamp'"])assert(!source.includes(token),`renderer compatibility registry still owns implementation slot: ${token}`);
for(const token of ['const SEG=','const PATH='])assert(!shell.includes(token)&&!api.includes(token),`non-renderer runtime regained renderer ownership: ${token}`);
console.log('display runtime smoke: PASS');console.log('  EL primitives, frozen renderer service, owner-held implementation slots, forwarded legacy assignments, and mirrored compatibility diagnostics verified');
