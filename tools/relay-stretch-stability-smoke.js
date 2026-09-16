#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function fail(m){console.error(`RELAY STRETCH STABILITY FAIL: ${m}`);process.exit(1)}
try{
  const source=read('relay-stretch-stability.js');new vm.Script(source,{filename:'relay-stretch-stability.js'});
  let timingMode='stretched';const SEG={},chars=Array.from({length:32},(_,i)=>String.fromCharCode(0xe000+i)),segmentsByCode={0:'',1:'a',2:'',3:'a',4:'b',5:'ab'};for(let i=0;i<32;i++)SEG[chars[i]]=segmentsByCode[i]||'';
  const pairRenders=[],regRenders=[],hardware={latches:{10:0}},agcDisplay={prog:[chars[0],chars[0]],verb:[chars[0],chars[0]],noun:[chars[0],chars[0]],r1:{digits:Array(5).fill(chars[0]),plus:false,minus:false},r2:{digits:Array(5).fill(chars[0]),plus:false,minus:false},r3:{digits:Array(5).fill(chars[0]),plus:false,minus:false}};
  const context={console,window:null,globalThis:null,document:{hidden:false,querySelector:()=>null},Object,Map,Set,Number,String,Math,TypeError,setTimeout:(fn,ms)=>{fn();return 1}};context.window=context;context.globalThis=context;vm.createContext(context);
  new vm.Script(read('app-state-runtime.js'),{filename:'app-state-runtime.js'}).runInContext(context);const compat=context.AGCDSKY_COMPAT,isFn=v=>typeof v==='function';
  compat.readonly('SEG',()=>SEG);compat.mutable('relayDigit',code=>chars[Number(code)&31],isFn);compat.mutable('set2',(id,text)=>pairRenders.push({id,text:String(text)}),isFn);compat.mutable('setReg',(id,sign,digits)=>regRenders.push({id,sign:String(sign),digits:String(digits)}),isFn);
  let decodeChannel10=()=>{};
  context.AGCDSKY_DISPLAY={
    relayDigit:code=>compat.get('relayDigit')(code),
    status:()=>({display:agcDisplay,relayWords:{10:hardware.latches[10]}}),
    implementation:name=>{if(name==='decodeChannel10')return decodeChannel10;throw new Error(`unknown display implementation ${name}`)},
    installImplementation:(name,next)=>{if(name!=='decodeChannel10'||typeof next!=='function')throw new Error(`invalid display implementation ${name}`);decodeChannel10=next;return next}
  };
  context.AGCDSKY_HARDWARE={snapshot:()=>({latches:{...hardware.latches}})};
  context.DSKY_RELAY_MATRIX={segmentsForCode:code=>segmentsByCode[Number(code)&31]||''};
  context.DSKY_RELAY_VISUAL={finalSettleMs:20,getTimingMode:()=>timingMode,renderWord:()=>{},withSettledWordOverride:(row,word,fn)=>fn()};
  new vm.Script(source,{filename:'relay-stretch-stability.js'}).runInContext(context);
  const api=context.DSKY_RELAY_STRETCH_STABILITY;if(!api||api.eventDrivenDomWrites!==true||api.monotonicSegments!==true)fail('stability diagnostic API missing required guarantees');
  if(!source.includes("display.implementation('decodeChannel10')")||!source.includes("display.installImplementation('decodeChannel10'"))fail('channel-10 wrapper is not owned by AGCDSKY_DISPLAY');
  if(source.includes("compat.get('decodeChannel10'")||source.includes("compat.replace('decodeChannel10'"))fail('channel-10 wrapper bypassed AGCDSKY_DISPLAY');
  const set2=(id,text)=>compat.get('set2')(id,text),decode=value=>context.AGCDSKY_DISPLAY.implementation('decodeChannel10')(value),maskForChar=ch=>{let mask=0,order='abcdefg',segments=SEG[ch]||'';for(let i=0;i<order.length;i++)if(segments.includes(order[i]))mask|=1<<i;return mask};
  decode((10<<11)|3);set2('verb',chars[0]+chars[1]);set2('verb',chars[0]+chars[2]);set2('verb',chars[0]+chars[3]);if(pairRenders.length!==1)fail(`on-off-on produced ${pairRenders.length} DOM paints instead of 1`);if(maskForChar([...pairRenders[0].text][1])!==1)fail('target segment a did not remain monotonic-on');
  pairRenders.length=0;hardware.latches[10]=0;agcDisplay.verb=[chars[0],chars[0]];decode((10<<11)|0);set2('verb',chars[0]+chars[1]);set2('verb',chars[0]+chars[0]);if(pairRenders.length!==1)fail(`unchanged-off segment produced ${pairRenders.length} paints`);if(maskForChar([...pairRenders[0].text][1])!==0)fail('unchanged-off segment flashed on');
  pairRenders.length=0;set2('verb',chars[0]+chars[0]);set2('verb',chars[0]+chars[0]);if(pairRenders.length!==0)fail('identical stretched frame rebuilt DOM');
  timingMode='authentic';set2('verb',chars[0]+chars[1]);set2('verb',chars[0]+chars[2]);if(pairRenders.length!==2)fail('authentic mode was filtered/deduplicated');
  if(source.includes('host.setTimeout =')||source.includes('window.AGCDSKY.hardware ='))fail('global timer/hardware monkey-patching returned');
  console.log('relay stretch stability smoke: PASS');console.log('  display-owned channel wrapper plus compat renderer wrappers preserve monotonic stretched segments, same-state DOM suppression, and authentic pass-through');
}catch(error){fail(error.stack||error.message||String(error))}
