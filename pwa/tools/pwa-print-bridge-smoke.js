#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const source=fs.readFileSync(path.resolve(__dirname,'../static/pwa-print-bridge.js'),'utf8');
const fail=message=>{console.error('PWA PRINT BRIDGE FAIL: '+message);process.exit(1)};
const assert=(ok,message)=>{if(!ok)fail(message)};

const sourceChecks=[{checked:true},{checked:false}];
const cloneChecks=[
  {checkedAttr:false,setAttribute(name){if(name==='checked')this.checkedAttr=true},removeAttribute(name){if(name==='checked')this.checkedAttr=false}},
  {checkedAttr:false,setAttribute(name){if(name==='checked')this.checkedAttr=true},removeAttribute(name){if(name==='checked')this.checkedAttr=false}}
];
const clone={
  classList:{add(){},remove(){}},
  querySelectorAll(selector){return selector==='[data-cheat-check]'?cloneChecks:[]},
  get outerHTML(){
    return '<section id="agc-cheat-sheet" class="open">'
      +'<input data-cheat-check="1"'+(cloneChecks[0].checkedAttr?' checked':'')+'>'
      +'<input data-cheat-check="2"'+(cloneChecks[1].checkedAttr?' checked':'')+'>'
      +'</section>';
  }
};
const sourceNode={
  cloneNode(){return clone},
  querySelectorAll(selector){return selector==='[data-cheat-check]'?sourceChecks:[]}
};

let written='';
let openCalls=0;
let focused=false;
const popup={
  document:{
    open(){},
    write(html){written=html},
    close(){}
  },
  focus(){focused=true},
  close(){}
};
const windowObject={
  AGCDSKYPWA:{},
  open(url,target){openCalls++;assert(url==='','print bridge must open a blank document');assert(target==='_blank','print bridge must open a separate browser context');return popup}
};
const documentObject={
  getElementById(id){return id==='agc-cheat-sheet'?sourceNode:null}
};
const context={
  window:windowObject,
  document:documentObject,
  navigator:{userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 9a) AppleWebKit/537.36 Chrome/152.0 Mobile Safari/537.36'},
  location:{href:'https://example.test/AGC-DSKY-Android/'},
  URL,
  Array,
  Object,
  String,
  Error,
  console
};

try{vm.runInNewContext(source,context,{filename:'pwa-print-bridge.js'})}
catch(error){fail('script execution failed: '+error.stack)}

assert(windowObject.PrintBridge&&typeof windowObject.PrintBridge.printChecklist==='function','PrintBridge.printChecklist was not installed');
assert(windowObject.AGCDSKYPWA.printChecklist===windowObject.PrintBridge.printChecklist,'PWA print API does not share the PrintBridge implementation');
assert(windowObject.PrintBridge.printChecklist()===true,'printChecklist did not report success');
assert(openCalls===1,'printChecklist did not synchronously open exactly one print window');
assert(focused,'print window was not focused');
assert(written.includes('Apollo CMC / DSKY Checklist'),'print document title missing');
assert(written.includes('cheatsheet.css'),'print document does not load checklist print stylesheet');
assert(written.includes('PRINT / SAVE PDF'),'print/PDF action missing');
assert(written.includes('ANDROID PRINT FIX · 2 LARGE CHECKLIST PAGES FILL EACH LETTER SHEET'),'Android fill-sheet guidance missing');
assert(written.includes('<body class="pwa-android-imposed">'),'Android print document must activate portrait-imposition fallback');
assert(written.includes('@page{size:Letter portrait;margin:.20in}'),'Android print document must force portrait Letter media for reliable system-print sizing');
assert(written.includes('grid-auto-rows:5.20in!important'),'Android fallback must reserve two full-height model slots');
assert(written.includes('width:5.20in!important') && written.includes('height:7.70in!important'),'Android fallback model card dimensions missing');
assert(written.includes('transform:rotate(90deg)!important'),'Android fallback must rotate cards to fill portrait printer pages');
assert(written.includes('data-cheat-check="1" checked'),'checked checklist state was not preserved');
assert(!written.includes('data-cheat-check="2" checked'),'unchecked checklist state was incorrectly printed as checked');
assert(written.includes('<main id="app"><section id="agc-cheat-sheet"'),'print document does not preserve checklist print-layout wrapper');

windowObject.open=()=>null;
assert(windowObject.PrintBridge.printChecklist()===false,'blocked print window should report failure');
assert(windowObject.AGCDSKYPWA.lastChecklistPrint?.error==='print window blocked','blocked print window diagnostic missing');

console.log('PWA checklist print bridge behavior: PASS');
console.log('  Android portrait-driver landscape imposition, checked-state preservation, popup failure telemetry verified');
