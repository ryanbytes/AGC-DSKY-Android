#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const source=fs.readFileSync(path.resolve(__dirname,'../static/pwa-network-time.js'),'utf8');
const fail=message=>{console.error('PWA NETWORK TIME FAIL: '+message);process.exit(1)};
const assert=(ok,message)=>{if(!ok)fail(message)};

let wall=1_700_000_000_480;
let mono=10_000;
const updates=[];
const requests=[];
const intervals=[];
const listeners={window:{},document:{}};

class FixedDate extends Date {
  constructor(...args){super(...(args.length?args:[wall]))}
  static now(){return wall}
}
FixedDate.parse=Date.parse.bind(Date);

function addListener(target,name,fn){(listeners[target][name]||(listeners[target][name]=[])).push(fn)}
function fakeHeaders(serverMs){return {get(name){return String(name).toLowerCase()==='date'?new Date(serverMs).toUTCString():null}}}

async function fetchStub(url,options={}){
  requests.push({url,options:{...options}});
  const desiredOffset=1200;
  mono+=40;
  wall+=40;
  return {
    ok:true,
    status:200,
    headers:fakeHeaders(wall+desiredOffset)
  };
}

const windowObject={
  AGCDSKYPWA:{},
  AGCDSKY:{nativeNtpStatus(value){updates.push({...value})}},
  addEventListener(name,fn){addListener('window',name,fn)},
  dispatchEvent(){}
};
const documentObject={
  hidden:false,
  addEventListener(name,fn){addListener('document',name,fn)}
};
const context={
  window:windowObject,
  document:documentObject,
  navigator:{onLine:true},
  location:{href:'https://example.test/AGC-DSKY-Android/index.html',host:'example.test'},
  URL,
  Date:FixedDate,
  performance:{now:()=>mono},
  fetch:fetchStub,
  AbortController:undefined,
  CustomEvent:function(type,init){this.type=type;this.detail=init?.detail},
  setTimeout(){return 1},
  clearTimeout(){},
  setInterval(fn,ms){intervals.push({fn,ms});return intervals.length},
  clearInterval(){},
  Math,Number,String,Object,Array,Promise,Error,console
};
Object.assign(windowObject,{window:windowObject,document:documentObject,navigator:context.navigator,location:context.location});

vm.createContext(context);
try{new vm.Script(source,{filename:'pwa-network-time.js'}).runInContext(context)}
catch(error){fail('script execution failed: '+error.stack)}

(async()=>{
  assert(typeof windowObject.AGCDSKYPWA.syncNetworkTime==='function','syncNetworkTime API missing');
  assert(typeof windowObject.AGCDSKYPWA.networkTimeStatus==='function','networkTimeStatus API missing');

  const status=await windowObject.AGCDSKYPWA.syncNetworkTime('test');
  assert(status.state==='synced','network time did not reach synced state');
  assert(status.transport==='http-date','network time transport must be http-date');
  assert(status.server==='example.test','same-origin network time server label wrong');
  assert(status.samples===3,'network time must retain three best samples');
  assert(status.roundTripMs===40,'best round-trip time wrong');
  assert(Math.abs(status.offsetMs-1000)<=600,'HTTP Date offset outside expected quantization range: '+status.offsetMs);
  assert(status.lastSyncUtcMs>0,'network time last-sync timestamp missing');

  assert(requests.length===5,'startup sync should take five samples');
  for(const request of requests){
    assert(request.options.method==='HEAD','network time should use HEAD when available');
    assert(request.options.cache==='no-store','network time requests must bypass HTTP cache');
    assert(request.options.credentials==='omit','network time request must omit credentials');
    assert(String(request.url).includes('agcdsky_time_probe='),'network time request must carry a unique cache-buster');
  }

  assert(updates.some(u=>u.state==='syncing'),'startup syncing status was not published');
  assert(updates.some(u=>u.state==='synced'&&u.transport==='http-date'),'synced HTTP-Date status was not sent through AGCDSKY.nativeNtpStatus');
  assert(intervals.some(x=>x.ms===30000),'network-time age refresh interval missing');
  assert(intervals.some(x=>x.ms===15*60*1000),'periodic network resync interval missing');

  console.log('PWA network time behavior: PASS');
  console.log('  five same-origin HTTP Date probes, midpoint correction, shared NTP-status bridge, and resync cadence verified');
})().catch(error=>fail(error.stack||String(error)));
