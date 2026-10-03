#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const screenOnly=fs.readFileSync(path.join(root,'app/src/main/assets/screen-only.js'),'utf8');
const service=fs.readFileSync(path.join(root,'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java'),'utf8');
function assert(c,m){if(!c)throw new Error(`DREAM INTERACTION FAIL: ${m}`)}

function makeDream(){
  const documentListeners={},timers=new Map(),published={};let nextTimer=0,now=0,finishCalls=0,ensureCalls=0,applyCalls=0,burstCalls=0;
  class Element{
    constructor(){this.textContent='';this.style={setProperty(){}};this.offsetWidth=320;this.listeners={};this.classes=new Set();this.classList={
      toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),
      remove:name=>this.classes.delete(name),
      contains:name=>this.classes.has(name)
    }}
    addEventListener(name,fn){this.listeners[name]=fn}
    getBoundingClientRect(){return{width:320}}
    querySelector(){return{}}
  }
  const elements={display:new Element(),elpanel:new Element(),comp:new Element(),dsky:new Element()};
  const document={body:new Element(),hidden:false,getElementById:id=>elements[id]||null,addEventListener:(name,fn)=>{documentListeners[name]=fn}};
  const state={tickSound:false};
  const context={document,location:{search:'?dream=1&clock=1&display=1'},URLSearchParams,performance:{now:()=>now},
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay,cleared:false});return id},
    clearTimeout(id){const timer=timers.get(id);if(timer)timer.cleared=true},
    addEventListener(){},requestAnimationFrame(){return 1},
    AGCDSKY_APP_STATE:state,
    AGCDSKY_SHELL:{showControls(){throw new Error('Dream mode must not show interactive app controls')}},
    AGCDSKY_AUDIO:{ensure(){ensureCalls++},applySetting(){applyCalls++},playBurst(n){burstCalls+=n}},
    AGCDSKY_SERVICE_REGISTRY:{publish(name,value){published[name]=value}},
    DreamBridge:{finishDream(){finishCalls++}},
    console
  };
  context.window=context;vm.createContext(context);new vm.Script(screenOnly,{filename:'screen-only.js'}).runInContext(context);
  return{context,documentListeners,document,elements,state,timers,published,get counts(){return{finishCalls,ensureCalls,applyCalls,burstCalls}},setNow(value){now=value}};
}

assert(service.includes('setInteractive(true);'),'DreamService must accept the touch gestures handled by its WebView');
assert(service.includes('@JavascriptInterface public void finishDream()'),'native bridge must expose DreamService exit to the packaged page');
const dream=makeDream();
assert(dream.document.body.classList.contains('screen-only'),'Dream URL must start in screen-only DSKY mode');
const down=dream.documentListeners.pointerdown,up=dream.documentListeners.pointerup;
assert(typeof down==='function'&&typeof up==='function','screen-only page did not register touch gesture handlers');

down({target:dream.elements.elpanel});dream.setNow(120);up();
assert(dream.state.tickSound===true,'brief Dream tap must toggle relay ticking on');
assert(dream.counts.ensureCalls===1&&dream.counts.applyCalls===1&&dream.counts.burstCalls===1,'brief Dream tap must apply and start the selected relay-tick setting');
assert(dream.counts.finishCalls===0,'brief tap must not exit the DreamService');

down({target:dream.elements.elpanel});
const hold=Array.from(dream.timers.values()).find(timer=>timer.delay===1800&&!timer.cleared);
assert(hold,'long-hold exit timer was not scheduled at 1800 ms');
dream.setNow(1800);hold.fn();
assert(dream.counts.finishCalls===1,'long hold must request native DreamService finish');
dream.setNow(1900);up();
assert(dream.counts.finishCalls===1&&dream.counts.ensureCalls===1,'release after long hold must not synthesize a tap or duplicate exit');

console.log('Dream interaction smoke: PASS');
console.log('  interactive native Dream contract matches the packaged tap-to-toggle and 1.8-second hold-to-exit behavior');
