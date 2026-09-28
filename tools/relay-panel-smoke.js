#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
function fail(message){throw new Error(`RELAY PANEL FAIL: ${message}`)}
function assert(condition,message){if(!condition)fail(message)}

const source=read('relay-panel.js'),css=read('relay-panel.css'),html=read('index.html'),topologySource=read('dsky-relay-topology.js');
new vm.Script(source,{filename:'relay-panel.js'});
new vm.Script(topologySource,{filename:'dsky-relay-topology.js'});

assert(html.includes('<section id="relay-panel" class="relay-rack"'),'relay rack host missing above DSKY');
assert(html.indexOf('id="relay-panel"')<html.indexOf('id="dsky"'),'relay rack must precede DSKY');
assert(html.includes('<link rel="stylesheet" href="relay-panel.css">'),'relay panel stylesheet missing');
assert(html.includes('<script src="relay-panel.js"></script>'),'relay panel script missing');
assert(html.indexOf('<script src="relay-visual-coupling.js"></script>')<html.indexOf('<script src="relay-panel.js"></script>'),'relay panel must subscribe after relay visual authority exists');
assert(!html.includes('relay-perceptual-personality.js'),'unsupported package personality layer returned');

for(const token of ['topology.packageSlots','topology.latchingRelay(row,bit)','topology.nonLatchingRelay(name)','visual.subscribe(event=>'])assert(source.includes(token),`relay panel source missing ${token}`);
for(const forbidden of ['setTimeout(','setInterval(','requestAnimationFrame(','Math.random(','profileFor(','dskyHardwareUnitSeedV1'])assert(!source.includes(forbidden),`relay panel must not synthesize timing/personality: ${forbidden}`);
for(const token of ['repeat(11','repeat(12','body.dream .relay-rack','body.display-only .relay-rack','body.screen-only .relay-rack','.relay-non-latching'])assert(css.includes(token),`relay panel CSS missing ${token}`);

class FakeClassList{
  constructor(){this.values=new Set()}
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
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.style=new FakeStyle();this.classList=new FakeClassList();this.className='';this.title=''}
  setAttribute(name,value){this.attrs[name]=String(value)}
  appendChild(child){this.children.push(child);return child}
  append(...children){children.forEach(child=>this.appendChild(child))}
  replaceChildren(...children){this.children=[...children]}
}
const host=new FakeElement('section');
const document={getElementById:id=>id==='relay-panel'?host:null,createElement:tag=>new FakeElement(tag)};
const context={console,window:null,document,Object,Map,Set,Number,String,Math,TypeError,Array};context.window=context;
vm.createContext(context);
new vm.Script(topologySource,{filename:'dsky-relay-topology.js'}).runInContext(context);
const topology=context.DSKY_RELAY_TOPOLOGY;
assert(topology.physicalRelayCount===132,'production topology must expose 132 physical packages');
assert(topology.latchingRelayCount===120,'production topology must expose 120 latching packages');
assert(topology.nonLatchingRelayCount===12,'production topology must expose 12 non-latching packages');

const registry=installServiceRegistry(context);
const latches={10:1},auxRelays={comp:true};
registry.publish('AGCDSKY_HARDWARE',{snapshot:()=>({latches:{...latches},auxRelays:{...auxRelays}})},'relay panel smoke');
let listener=null;
context.DSKY_RELAY_VISUAL={subscribe:fn=>{listener=fn;return()=>{listener=null}}};
new vm.Script(source,{filename:'relay-panel.js'}).runInContext(context);

const api=context.DSKY_RELAY_PANEL;
assert(api&&Object.isFrozen(api),'relay panel API missing/mutable');
assert(api.latchingCells===120,'relay rack must depict exactly 120 latching packages');
assert(api.nonLatchingCells===12,'relay rack must depict exactly 12 non-latching packages');
assert(api.totalCells===132,'relay rack must depict exactly 132 physical packages');
assert(host.children.length===132,'relay rack DOM must contain exactly 132 cells');
assert(new Set(host.children.map(cell=>cell.dataset.relaySlot)).size===132,'every physical package slot must appear exactly once');
assert(typeof listener==='function','relay rack did not subscribe to shared relay presentation events');

const latchingSlot=topology.latchingRelay(10,0).packageSlot;
const target=host.children.find(cell=>cell.dataset.relaySlot===latchingSlot);
assert(target&&target.classList.contains('on'),`initial latching snapshot missing at ${latchingSlot}`);
listener({type:'relay-drive',row:10,bit:0,targetOn:false,durationMs:6.5});
assert(target.classList.contains('moving')&&!target.classList.contains('target-on'),'relay drive did not begin shared reset motion');
assert(target.style.getPropertyValue('--relay-travel-ms')==='6.5ms','relay rack did not use shared event duration');
listener({type:'relay-contact',row:10,bit:0,state:false,phase:'armature'});
assert(!target.classList.contains('on')&&!target.classList.contains('moving'),'armature event did not settle latching cell');

const compSlot=topology.nonLatchingRelay('comp').packageSlot;
const comp=host.children.find(cell=>cell.dataset.relaySlot===compSlot);
assert(comp&&comp.classList.contains('on'),`initial COMP relay state missing at ${compSlot}`);
listener({type:'aux-drive',name:'comp',targetOn:false,durationMs:5});
assert(comp.classList.contains('moving'),'non-latching drive did not begin shared motion');
listener({type:'aux-contact',name:'comp',state:false,phase:'armature'});
assert(!comp.classList.contains('on')&&!comp.classList.contains('moving'),'non-latching armature event did not settle cell');

console.log('relay panel smoke: PASS');
console.log('  132 physical packages rendered exactly once; D1-D6/K1-K22 state follows the shared relay event stream with no independent scheduler or synthetic personality');
