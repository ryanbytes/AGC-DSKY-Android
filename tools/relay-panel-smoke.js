#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
function fail(message){throw new Error(`RELAY PANEL FAIL: ${message}`)}
function assert(condition,message){if(!condition)fail(message)}

const source=read('relay-panel.js'),css=read('relay-panel.css'),html=read('index.html'),identity=read('relay-identity-audio.js');
new vm.Script(source,{filename:'relay-panel.js'});
assert(html.includes('<section id="relay-panel" class="relay-rack"'),'relay rack host missing above DSKY');
assert(html.indexOf('id="relay-panel"')<html.indexOf('id="dsky"'),'relay rack must precede DSKY');
assert(html.includes('<link rel="stylesheet" href="relay-panel.css">'),'relay panel stylesheet missing');
assert(!source.includes('textContent=')&&!source.includes('innerHTML='),'relay rack must not add a decorative heading/label block');
assert(identity.includes('const LATCHING_RELAY_COUNT = 132;'),'production identity model must retain 132 latching relays');
assert(identity.includes("const AUX_ORDER=Object.freeze(['comp','uplink','temp','keyrel','oprerr','flash','restart','stby']);"),'production identity model must retain 8 auxiliary relays');
assert(identity.includes('totalIndividualRelays:LATCHING_RELAY_COUNT+AUX_ORDER.length'),'production identity total must remain derived as 140');
for(const token of ['function playRelayImpact(','function playAuxImpact(','contactTraceFor:','auxiliaryContactTraceFor:','auxiliaryNames:Object.freeze(AUX_ORDER.slice())'])assert(identity.includes(token),`production identity event API missing ${token}`);
for(const token of ['repeat(11','repeat(13','body.dream .relay-rack','body.display-only .relay-rack'])assert(css.includes(token),`relay panel CSS missing ${token}`);

class FakeClassList{
  constructor(owner){this.owner=owner;this.values=new Set()}
  add(...names){names.forEach(n=>this.values.add(n))}
  remove(...names){names.forEach(n=>this.values.delete(n))}
  toggle(name,force){if(force===undefined){if(this.values.has(name)){this.values.delete(name);return false}this.values.add(name);return true}if(force)this.values.add(name);else this.values.delete(name);return !!force}
  contains(name){return this.values.has(name)}
}
class FakeStyle{
  constructor(){this.values=new Map()}
  setProperty(name,value){this.values.set(name,String(value))}
  getPropertyValue(name){return this.values.get(name)||''}
}
class FakeElement{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.style=new FakeStyle();this.classList=new FakeClassList(this);this.className='';this.title='';this.offsetWidth=10}
  setAttribute(name,value){this.attrs[name]=String(value)}
  appendChild(child){this.children.push(child);return child}
  append(...children){children.forEach(child=>this.appendChild(child))}
  replaceChildren(...children){this.children=[...children]}
}
const host=new FakeElement('section');
const document={getElementById:id=>id==='relay-panel'?host:null,createElement:tag=>new FakeElement(tag)};
const context={console,window:null,document,Object,Map,Set,Number,String,Math,TypeError};context.window=context;vm.createContext(context);
const registry=installServiceRegistry(context);
const latches={10:1},auxRelays={comp:true,uplink:false,temp:false,keyrel:false,oprerr:false,flash:false,restart:false,stby:false};
registry.publish('AGCDSKY_HARDWARE',{snapshot:()=>({latches:{...latches},auxRelays:{...auxRelays}})},'relay panel smoke');
let listener=null;
context.DSKY_RELAY_VISUAL={subscribe:fn=>{listener=fn;return()=>{listener=null}}};
const auxNames=['comp','uplink','temp','keyrel','oprerr','flash','restart','stby'];
const profile={setTravelMs:5.5,resetTravelMs:6.5,poleSkewUs:73,level:1};
context.DSKY_RELAY_AUDIO={
  relayIdentity:(row,bit)=>`ROW-${row}:BIT-${bit}`,
  profileFor:()=>profile,
  auxiliaryNames:auxNames.slice(),
  auxiliaryProfileFor:()=>profile
};
new vm.Script(source,{filename:'relay-panel.js'}).runInContext(context);
const api=context.DSKY_RELAY_PANEL;
assert(api&&Object.isFrozen(api),'relay panel API missing/mutable');
assert(api.latchingCells===132,'relay rack must depict all 132 latching relays');
assert(api.auxiliaryCells===8,'relay rack must depict all 8 auxiliary relays');
assert(api.totalCells===140,'relay rack must depict exactly 140 simulated relays');
assert(host.children.length===143,'relay rack should contain 140 relays plus 3 invisible grid fillers');
assert(typeof listener==='function','relay rack did not subscribe to physical presentation events');

const target=host.children.find(cell=>cell.dataset&&cell.dataset.relayId==='ROW-10:BIT-0');
assert(target,'ROW-10:BIT-0 cell missing');
assert(target.classList.contains('on'),'initial hardware latch state not reflected in rack');
listener({type:'relay-drive',row:10,bit:0,targetOn:false,durationMs:6.5});
assert(target.classList.contains('moving')&&!target.classList.contains('target-on'),'relay drive did not begin manufactured reset animation');
assert(target.style.getPropertyValue('--relay-travel-ms')==='6.5ms','relay animation duration did not use manufactured travel time');
listener({type:'relay-contact',row:10,bit:0,state:false,phase:'armature'});
assert(!target.classList.contains('on')&&!target.classList.contains('moving'),'armature contact event did not finish rack motion/state');

const aux=host.children.find(cell=>cell.dataset&&cell.dataset.relayId==='AUX:COMP');
assert(aux&&aux.classList.contains('on'),'initial auxiliary relay state missing');
listener({type:'aux-drive',name:'comp',targetOn:false,durationMs:6.5});
listener({type:'aux-contact',name:'comp',state:false,phase:'armature'});
assert(!aux.classList.contains('on'),'auxiliary relay contact event did not update rack');

console.log('relay panel smoke: PASS');
console.log('  132 latching + 8 auxiliary relays rendered with no heading block; manufactured travel events drive rack motion/state');
