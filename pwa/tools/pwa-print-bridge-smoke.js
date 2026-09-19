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
const paneIds=['p51','p51real','p51real-cont','quick','sxt','verify'];
const panes=paneIds.map((id,index)=>({
  get outerHTML(){
    const checks=index===0
      ? '<input data-cheat-check="1"'+(cloneChecks[0].checkedAttr?' checked':'')+'>'
        +'<input data-cheat-check="2"'+(cloneChecks[1].checkedAttr?' checked':'')+'>'
      : '';
    return '<div class="cheat-pane" data-cheat-pane="'+id+'">'+checks+'PAGE '+(index+1)+'</div>';
  }
}));
const clone={
  classList:{add(){},remove(){}},
  querySelectorAll(selector){
    if(selector==='[data-cheat-check]')return cloneChecks;
    if(selector==='.cheat-pane')return panes;
    return [];
  },
  get outerHTML(){
    return '<section id="agc-cheat-sheet" class="open">'+panes.map(p=>p.outerHTML).join('')+'</section>';
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
  document:{open(){},write(html){written=html},close(){}},
  focus(){focused=true},
  close(){}
};
const windowObject={
  AGCDSKYPWA:{},
  open(url,target){
    openCalls++;
    assert(url==='','print bridge must open a blank document');
    assert(target==='_blank','print bridge must open a separate browser context');
    return popup;
  }
};
const context={
  window:windowObject,
  document:{getElementById(id){return id==='agc-cheat-sheet'?sourceNode:null}},
  navigator:{userAgent:'Mozilla/5.0 (Linux; Android 17; Pixel 9a) AppleWebKit/537.36 Chrome/152.0 Mobile Safari/537.36'},
  location:{href:'https://example.test/AGC-DSKY-Android/'},
  URL,Array,Object,String,Error,Math,console
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
assert(written.includes('ANDROID · 3 MODEL CHECKLIST PAGES PER LETTER SHEET'),'Android three-up guidance missing');
assert(written.includes('<body class="pwa-android-imposed">'),'Android print document must activate explicit-sheet mode');
assert(written.includes('@page{size:8.5in 11in;margin:.20in}'),'Android print document must use explicit portrait Letter dimensions');
assert(written.includes('grid-template-columns:7.85in!important'),'Android sheet must reserve one rotated-card column');
assert(written.includes('grid-template-rows:repeat(3,3.40in)!important'),'Android sheet must reserve three rotated-card rows');
assert(written.includes('width:8.10in!important')&&written.includes('height:10.60in!important'),'Android physical sheet dimensions missing');
assert(written.includes('width:3.40in!important')&&written.includes('height:7.65in!important'),'Android model page dimensions missing');
assert(written.includes('transform:translate(-50%,-50%) rotate(90deg)!important'),'Android model cards must be centered and rotated inside fixed slots');

for(const sheet of [1,2])assert(written.includes('data-model-sheet="'+sheet+'"'),'missing explicit print sheet '+sheet);
assert((written.match(/class="pwa-model-sheet(?: single)?"/g)||[]).length===2,'six checklist pages must create exactly two full physical sheets');
assert((written.match(/class="pwa-model-slot"/g)||[]).length===6,'all six checklist pages must get a fixed physical slot');

assert(written.includes('data-cheat-check="1" checked'),'checked checklist state was not preserved');
assert(!written.includes('data-cheat-check="2" checked'),'unchecked checklist state was incorrectly printed as checked');
assert(windowObject.AGCDSKYPWA.lastChecklistPrint?.mode==='android-explicit-sheet-imposition','Android print mode telemetry wrong');
assert(windowObject.AGCDSKYPWA.lastChecklistPrint?.sheets===2,'Android print telemetry must report two physical sheets');

windowObject.open=()=>null;
assert(windowObject.PrintBridge.printChecklist()===false,'blocked print window should report failure');
assert(windowObject.AGCDSKYPWA.lastChecklistPrint?.error==='print window blocked','blocked print window diagnostic missing');

console.log('PWA checklist print bridge behavior: PASS');
console.log('  Android three-up physical-sheet pagination, six-page imposition, checked-state preservation verified');
