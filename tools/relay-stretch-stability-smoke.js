#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets'),read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function fail(m){console.error(`RELAY STRETCH STABILITY FAIL: ${m}`);process.exit(1)}
try{
  const source=read('relay-stretch-stability.js');new vm.Script(source,{filename:'relay-stretch-stability.js'});
  let timingMode='stretched';const SEG={},chars=Array.from({length:32},(_,i)=>String.fromCharCode(0xe000+i)),segmentsByCode={0:'',1:'a',2:'',3:'a',4:'b',5:'ab'};for(let i=0;i<32;i++)SEG[chars[i]]=segmentsByCode[i]||'';
  const pairRenders=[],regRenders=[],hardware={latches:{10:0}},agcDisplay={prog:[chars[0],chars[0]],verb:[chars[0],chars[0]],noun:[chars[0],chars[0]],r1:{digits:Array(5).fill(chars[0]),plus:false,minus:false},r2:{digits:Array(5).fill(chars[0]),plus:false,minus:false},r3:{digits:Array(5).fill(chars[0]),plus:false,minus:false}};
  const context={console,window:null,globalThis:null,document:{hidden:false,querySelector:()=>null},Object,Map,Set,Number,String,Math,TypeError,setTimeout:(fn,ms)=>{fn();return 1}};context.window=context;context.globalThis=context;vm.createContext(context);
  const registry=installServiceRegistry(context);
  let set2Impl=(id,text)=>pairRenders.push({id,text:String(text)}),setRegImpl=(id,sign,digits)=>regRenders.push({id,sign:String(sign),digits:String(digits)}),decodeChannel10=()=>{};
  context.AGCDSKY_RENDERER={
    implementation:name=>{if(name==='set2')return set2Impl;if(name==='setReg')return setRegImpl;throw new Error(`unknown renderer implementation ${name}`)},
    installImplementation:(name,next)=>{if(typeof next!=='function')throw new Error(`invalid renderer implementation ${name}`);if(name==='set2')set2Impl=next;else if(name==='setReg')setRegImpl=next;else throw new Error(`unknown renderer implementation ${name}`);return next},
    segmentPattern:ch=>SEG[ch]||'',
    registerSegmentPattern:(ch,pattern)=>(SEG[ch]=String(pattern||''))
  };
  context.AGCDSKY_DISPLAY={
    relayDigit:code=>chars[Number(code)&31],
    status:()=>({display:agcDisplay,relayWords:{10:hardware.latches[10]}}),
    implementation:name=>{if(name==='decodeChannel10')return decodeChannel10;throw new Error(`unknown display implementation ${name}`)},
    installImplementation:(name,next)=>{if(name!=='decodeChannel10'||typeof next!=='function')throw new Error(`invalid display implementation ${name}`);decodeChannel10=next;return next}
  };
  registry.publish('AGCDSKY_HARDWARE',{snapshot:()=>({latches:{...hardware.latches}})},'relay stretch stability smoke');
  context.DSKY_RELAY_MATRIX={segmentsForCode:code=>segmentsByCode[Number(code)&31]||''};
  context.DSKY_RELAY_VISUAL={finalSettleMs:20,getTimingMode:()=>timingMode,renderWord:()=>{},withSettledWordOverride:(row,word,fn)=>fn()};
  new vm.Script(source,{filename:'relay-stretch-stability.js'}).runInContext(context);
  const api=context.DSKY_RELAY_STRETCH_STABILITY;if(!api||api.eventDrivenDomWrites!==true||api.monotonicSegments!==true)fail('stability diagnostic API missing required guarantees');
  for(const token of ["display.implementation('decodeChannel10')","display.installImplementation('decodeChannel10'","renderer.implementation('set2')","renderer.installImplementation('set2'","renderer.implementation('setReg')","renderer.installImplementation('setReg'",'renderer.segmentPattern(ch)','renderer.registerSegmentPattern(ch,value)',"window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')"])if(!source.includes(token))fail(`explicit service ownership missing: ${token}`);
  if(source.includes('AGCDSKY_COMPAT')||source.includes('compat.')||source.includes('window.AGCDSKY_HARDWARE'))fail('stretch stability regained direct compatibility dependency');
  const set2=(id,text)=>context.AGCDSKY_RENDERER.implementation('set2')(id,text),decode=value=>context.AGCDSKY_DISPLAY.implementation('decodeChannel10')(value),maskForChar=ch=>{let mask=0,order='abcdefg',segments=SEG[ch]||'';for(let i=0;i<order.length;i++)if(segments.includes(order[i]))mask|=1<<i;return mask};
  decode((10<<11)|3);set2('verb',chars[0]+chars[1]);set2('verb',chars[0]+chars[2]);set2('verb',chars[0]+chars[3]);if(pairRenders.length!==1)fail(`on-off-on produced ${pairRenders.length} DOM paints instead of 1`);if(maskForChar([...pairRenders[0].text][1])!==1)fail('target segment a did not remain monotonic-on');
  pairRenders.length=0;hardware.latches[10]=0;agcDisplay.verb=[chars[0],chars[0]];decode((10<<11)|0);set2('verb',chars[0]+chars[1]);set2('verb',chars[0]+chars[0]);if(pairRenders.length!==1)fail(`unchanged-off segment produced ${pairRenders.length} paints`);if(maskForChar([...pairRenders[0].text][1])!==0)fail('unchanged-off segment flashed on');
  pairRenders.length=0;set2('verb',chars[0]+chars[0]);set2('verb',chars[0]+chars[0]);if(pairRenders.length!==0)fail('identical stretched frame rebuilt DOM');
  timingMode='authentic';set2('verb',chars[0]+chars[1]);set2('verb',chars[0]+chars[2]);if(pairRenders.length!==2)fail('authentic mode was filtered/deduplicated');
  if(source.includes('host.setTimeout =')||source.includes('window.AGCDSKY.hardware ='))fail('global timer/hardware monkey-patching returned');
  console.log('relay stretch stability smoke: PASS');console.log('  registry-backed hardware plus renderer/display-owned wrappers preserve monotonic stretched segments, same-state DOM suppression, and authentic pass-through with no direct compat dependency');
}catch(error){fail(error.stack||error.message||String(error))}
