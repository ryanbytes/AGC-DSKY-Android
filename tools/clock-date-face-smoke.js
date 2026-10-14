'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const read=n=>fs.readFileSync(path.join(assets,n),'utf8');
function assert(ok,message){if(!ok)throw new Error('CLOCK date header: '+message)}
const html=read('index.html'),css=read('style.css');
for(const [id,text] of [['prog','PROG'],['verb','VERB'],['noun','NOUN']]){
  assert(html.includes('<text id="'+id+'-label" class="el-label"'),'original SVG label and typeface lost: '+id);
  assert(html.includes('>'+text+'</text>'),'original static label missing: '+text);
}
assert(css.includes('.el-label{')&&css.includes('font-size:5.1px'),'label typeface/style changed');
assert(html.includes('id="dreamdate"')&&html.includes('data-panel-legend="DREAM DATE"'),'Dream toggle unavailable');
const values={},labels={},attrs=new Map(),prefs=new Map();
for(const name of ['prog','verb','noun'])labels[name+'-label']={textContent:''};
const panel={setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k)||null,removeAttribute:k=>attrs.delete(k)};
let wall=new Date(2026,9,14,13,7,5);
const renderer={set2:(id,value)=>values[id]=value,setReg:()=>{}};
const shell={accurateDate:()=>new Date(wall),store:{get:k=>prefs.get(k)||null}};
const doc={hidden:false,getElementById:id=>id==='elpanel'?panel:labels[id]||null};
const context={window:null,document:doc,AGCDSKY_SHELL:shell,AGCDSKY_RENDERER:renderer,AGCDSKY_AUDIO:{playBurst:()=>{}},
  setTimeout:()=>0,clearTimeout:()=>{},Date,Math,Number,String,Set,Map,Object,TypeError};
context.window=context;vm.createContext(context);
vm.runInContext(read('app-state-runtime.js'),context,{filename:'app-state-runtime.js'});
vm.runInContext(read('phone-clock-runtime.js'),context,{filename:'phone-clock-runtime.js'});
const state=context.AGCDSKY_APP_STATE,clock=context.AGCDSKY_CLOCK;
const verify=(expectedLabels,expectedValues,mode)=>{
  for(let i=0;i<3;i++){const f=['prog','verb','noun'][i];assert(labels[f+'-label'].textContent===expectedLabels[i],f+' label mismatched');assert(values[f]===expectedValues[i],f+' digits mismatched')}
  assert(panel.getAttribute('data-clock-header')===mode,'header mode mismatch');
};
clock.syncFace();
verify(['YEAR','MONTH','DAY'],['26','10','14'],'date');
values.prog='00';clock.syncHeader();
assert(values.prog==='26','delayed geometry redraw overwrote YEAR digits');
assert(clock.digits().r1.join('')==='00013'&&clock.digits().r2.join('')==='00007','time registers changed');
wall=new Date(2026,10,1,13,7,5);clock.tick();
verify(['YEAR','MONTH','DAY'],['26','11','01'],'date');
state.mode='agc-loading';clock.restoreAgcHeader();
assert(labels['prog-label'].textContent==='PROG'&&labels['verb-label'].textContent==='VERB'&&labels['noun-label'].textContent==='NOUN','AGC did not recover Apollo labels');
assert(panel.getAttribute('data-clock-header')===null,'AGC retained date aria mode');
state.mode='clock';state.dream=true;clock.syncFace();
verify(['PROG','VERB','NOUN'],['00','16','65'],'legacy');
prefs.set('dreamDateFace','1');clock.tick();
verify(['YEAR','MONTH','DAY'],['26','11','01'],'date');
prefs.set('dreamDateFace','0');clock.tick();
verify(['PROG','VERB','NOUN'],['00','16','65'],'legacy');
const lifecycle=read('agc-lifecycle-runtime.js'),geometry=read('dsky-geometry.js'),dreamAgc=read('dream-agc.js'),shellSource=read('app-shell-runtime.js'),rendererSource=read('dsky-display-renderer.js');
assert(lifecycle.includes("lifecycleClock.restoreAgcHeader()"),'AGC transition did not restore Apollo labels');
assert(dreamAgc.includes("dreamClock.restoreAgcHeader()"),'Dream AGC did not restore Apollo labels');
assert(geometry.includes("clock.syncFace();"),'geometry reflow overwrote date');
assert(geometry.includes('clock.syncHeader();')&&!geometry.includes("renderer.renderDigits(prog,'00')"),'delayed geometry redraw still resets YEAR to 00');
assert(shellSource.includes("store.set('dreamDateFace'"),'Dream preference not persisted');
assert(rendererSource.includes("dateHeader?'Year':'Program'"),'accessible date headings missing');
console.log('clock date header smoke: PASS (clock/date rollover, Dream on/off, AGC restoration, time registers)');
