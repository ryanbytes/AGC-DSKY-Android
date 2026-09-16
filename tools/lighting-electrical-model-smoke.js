#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {installServiceRegistry} = require('./test-service-registry');
const source = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/lighting-electrical-model.js'),'utf8');
function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tolerance=1e-5){return Math.abs(actual-expected)<=tolerance}
let observerCallback=null,derivedWrites=0;
const properties=new Map([['--integral-level','1']]);
const root={style:{getPropertyValue(name){return properties.get(name)||''},setProperty(name,value){const text=String(value),prior=properties.get(name)||'';properties.set(name,text);if(name==='--integral-incandescent-level'&&prior!==text)derivedWrites++;if(observerCallback&&prior!==text)observerCallback([{type:'attributes',attributeName:'style'}])}}};
const elements=new Map();
const head={appendChild(node){if(node.id)elements.set(node.id,node)}};
const document={documentElement:root,head,getElementById(id){return elements.get(id)||null},createElement(tag){return{tagName:String(tag).toUpperCase(),id:'',textContent:''}}};
class MutationObserver{constructor(callback){this.callback=callback}observe(target,options){assert(target===root,'lighting observer must watch root');assert(options&&options.attributes&&options.attributeFilter.includes('style'),'lighting observer must be limited to root style changes');observerCallback=this.callback}}
const AGCDSKY={};
const context={console,Math,Number,Object,document,MutationObserver,getComputedStyle(){return{getPropertyValue(name){return properties.get(name)||''}}},AGCDSKY,window:null};context.window=context;installServiceRegistry(context);
Object.defineProperty(AGCDSKY,'lightingElectrical',{enumerable:true,get(){return context.AGCDSKY_LIGHTING_ELECTRICAL||null}});
vm.createContext(context);vm.runInContext(source,context,{filename:'lighting-electrical-model.js'});
const model=AGCDSKY.lightingElectrical;
assert(model&&model===context.AGCDSKY_LIGHTING_ELECTRICAL,'bootstrap lightingElectrical getter did not resolve dedicated service');
assert(Object.isFrozen(model),'lighting electrical service must be frozen');
assert(source.includes("window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_LIGHTING_ELECTRICAL',controller"),'lighting electrical explicit registry publication missing');
assert(!source.includes('window.AGCDSKY.lightingElectrical ='),'lighting model regained late public-facade mutation');
assert(near(model.incandescentFlux(1),1),'full-voltage output must normalize to 1');
assert(near(model.incandescentFlux(0),0),'zero-voltage output must be 0');
assert(near(model.incandescentFlux(.5),Math.pow(.5,3.4)),'half-voltage response does not use V^3.4');
assert(near(model.incandescentFlux(.75),Math.pow(.75,3.4)),'three-quarter response does not use V^3.4');
const style=elements.get('dsky-lighting-electrical-model');
assert(style&&style.textContent.includes('--integral-incandescent-level'),'incandescent override style missing');
assert(style.textContent.includes('var(--lamp-gain,1)'),'override discarded lamp gain');
root.style.setProperty('--integral-level','.75');const state75=model.state();
assert(near(state75.integralVoltageRatio,.75),'model did not observe INTEGRAL voltage');
assert(near(state75.incandescentFluxRatio,Math.pow(.75,3.4)),'derived flux wrong at .75');
assert(properties.get('--integral-level')==='.75','model altered EL control');
root.style.setProperty('--integral-level','.25');const state25=model.state();
assert(state25.incandescentFluxRatio<.02,'quarter-voltage branch is still approximately linear');
assert(state25.keyBranch.includes('115 VAC')&&state25.indicatorBranch.includes('0-5 VAC'),'branch metadata missing');
assert(state25.curveSource.includes('estimate'),'estimated curve not labeled');
assert(derivedWrites===3,`derived style wrote ${derivedWrites} times; expected 3`);
console.log('lighting electrical model smoke: PASS');
console.log('  explicit registry publication, dedicated frozen service, bootstrap compatibility getter, separate EL/incandescent branches, and V^3.4 response verified');
