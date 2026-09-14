#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const asset=name=>path.join(ASSETS,name);
const APP_JS=asset('app.js');
const INDEX_HTML=asset('index.html');
const MANIFEST=path.join(ROOT,'app/src/main/AndroidManifest.xml');
const APP_GRADLE=path.join(ROOT,'app/build.gradle');
const SENSOR_ACTIVITY=path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');
const DREAM_SERVICE=path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java');
const NET_CLIENT=path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/NetClient.java');
const DEBUG_REPORTER=path.join(ROOT,'app/src/main/java/org/apollo/agcdsky/DebugReporter.java');
const PRE_APP=[
  'dsky-display-renderer.js','display-environment.js','relay-audio-runtime.js',
  'phone-clock-runtime.js','agc-display-runtime.js','dsky-keycodes.js'
];

class Classes{
  constructor(){this.values=new Set()}
  add(...n){n.forEach(x=>this.values.add(x))}
  remove(...n){n.forEach(x=>this.values.delete(x))}
  toggle(n,f){if(f===undefined)f=!this.values.has(n);f?this.values.add(n):this.values.delete(n);return f}
  contains(n){return this.values.has(n)}
}
class Element{
  constructor(id=''){this.id=id;this.textContent='';this.innerHTML='';this.dataset={};this.classList=new Classes();this.listeners={};this.style={filter:'',setProperty(){}}}
  addEventListener(n,cb){this.listeners[n]=cb}
  closest(s){return s==='[data-key]'&&this.dataset.key?this:null}
  setPointerCapture(){} releasePointerCapture(){}
}
class FakeAgcCore{
  constructor(options={}){this.options=options;this.running=false;this.keyCodes=[];this.keyReleaseCount=0;this.exportCount=0;this.snapshotSerial=0}
  async load(o){this.rope=o.ropeUrl;this.wasm=o.wasmUrl}
  reset(){} configureInputMasks(){}
  start(){this.running=true} stop(){this.running=false}
  version(){return 'fake-test-core'}
  keyPress(c){this.keyCodes.push(c);return 1}
  keyRelease(){this.keyReleaseCount++;return true}
  proceedKey(){return 1}
  exportSnapshot(){this.exportCount++;const serial=++this.snapshotSerial;return{schema:1,byteLength:64,fingerprint:`fake-${serial}`,memoryB64:''}}
  importSnapshot(s){this.lastImported=s;return true}
  snapshotFingerprint(){return`fake-${this.snapshotSerial}`}
}
function createEnvironment({search='',initialStorage={}}={}){
  const ids=['prog','verb','noun','r1','r2','r3','mode','agc','clock','dim','dreambright','sound','display','dsky','controls','hint','comp','imu-zero','mag-lock','pipa-cal','sxt','cheat','diagnostics'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  for(const name of ['uplink','temp','noatt','gimbal','stby','prog','keyrel','restart','oprerr','tracker','alt','vel','comp']){const e=new Element();e.dataset.lamp=name;elements[`lamp-${name}`]=e}
  const keyElements='V + 7 8 9 C E N - 4 5 6 P R 0 1 2 3 K'.split(' ').map(key=>{const e=new Element();e.dataset.key=key;return e});
  const allLamps=Object.values(elements).filter(e=>e.dataset.lamp);
  const document={hidden:false,body:new Element('body'),listeners:{},getElementById:id=>elements[id]||null,
    querySelector(s){let m=s.match(/^\[data-lamp="(.+)"\]$/);if(m)return elements[`lamp-${m[1]}`];m=s.match(/^\[data-key="(.+)"\]$/);return m?keyElements.find(e=>e.dataset.key===m[1])||null:null},
    querySelectorAll(s){if(s==='[data-lamp]')return allLamps;if(s==='[data-key]')return keyElements;return[]},addEventListener(n,cb){this.listeners[n]=cb}};
  const storage=new Map(Object.entries(initialStorage).map(([k,v])=>[k,String(v)]));
  const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const windowListeners={};
  const context={console,document,localStorage,location:{search},navigator:{},window:null,AgcCore:FakeAgcCore,URLSearchParams,Date,Math,Number,JSON,Object,Promise,Set,Array,String,parseFloat,
    performance:{now:()=>0},setInterval:()=>1,clearInterval(){},setTimeout(cb){cb();return 1},clearTimeout(){},addEventListener(n,cb){windowListeners[n]=cb}};
  context.window=context;vm.createContext(context);
  for(const name of PRE_APP)vm.runInContext(fs.readFileSync(asset(name),'utf8'),context,{filename:name});
  for(const name of ['app.js','runtime-transitions.js','dsky-input-runtime.js','keyboard-electrical-interlock.js'])vm.runInContext(fs.readFileSync(asset(name),'utf8'),context,{filename:name});
  return{context,document,elements,keyElements,storage,windowListeners};
}
function assert(c,m){if(!c)throw new Error(m)}
function flushAsync(){return new Promise(r=>setImmediate(r))}
function webview(source,label){assert(source.includes('setBlockNetworkLoads(true)'),`${label} network loads not blocked`);assert(source.includes('setAllowFileAccess(false)'),`${label} file access enabled`);assert(source.includes('setAllowContentAccess(false)'),`${label} content access enabled`)}
function debugGate(source,label){assert(source.indexOf('WebView.setWebContentsDebuggingEnabled(true)')>source.indexOf('ApplicationInfo.FLAG_DEBUGGABLE'),`${label} debugging not gated`)}
function sourceInvariants(){
  const manifest=fs.readFileSync(MANIFEST,'utf8');
  for(const token of ['android.permission.INTERNET','android:allowBackup="false"','android.webkit.WebView.MetricsOptOut','android:name=".SensorMainActivity"','android:targetActivity=".SensorMainActivity"','android.permission.CAMERA','android.permission.ACCESS_COARSE_LOCATION','android.permission.ACCESS_FINE_LOCATION','android.permission.BIND_DREAM_SERVICE'])assert(manifest.includes(token),`manifest missing ${token}`);
  const gradle=fs.readFileSync(APP_GRADLE,'utf8');
  for(const token of ["file('../vendor/webAGC/src/yaAGC.wasm')","file('../vendor/webAGC/demo/agc/Comanche055.bin')",'verifyPinnedAgcAssets',"tasks.register('stagePinnedAgcAssets', Sync)","it.name == 'preBuild'"])assert(gradle.includes(token),`Gradle missing ${token}`);
  assert(!gradle.includes('Luminary099.bin'),'CM build stages LM rope');
  const html=fs.readFileSync(INDEX_HTML,'utf8');
  assert(!html.includes('id="mission"'),'mission selector returned');
  const order=['agc-core.js',...PRE_APP,'app.js','dream-silence.js','runtime-transitions.js','dsky-input-runtime.js'].map(n=>html.indexOf(`<script src="${n}"></script>`));
  assert(order.every(x=>x>=0),'required runtime script missing');for(let i=1;i<order.length;i++)assert(order[i]>order[i-1],'runtime parser order regressed');
  const app=fs.readFileSync(APP_JS,'utf8');
  for(const token of ['AGCDSKY_KEY_CODES','.keyPress(','.keyRelease(','.proceedKey(','const SEG=','const DIGIT_RELAY=','const CLOCK_GROUPS=','function lampTest()','const DAY_MS=86400000','function solarTimes(','function ensureAudio()','function playRelayBurst(','const agcDisplay={','const agcRelayWords={};','function decodeChannel10(value)','function snapshotUiState()'])assert(!app.includes(token),`app.js regained extracted ownership: ${token}`);
  const agcDisplay=fs.readFileSync(asset('agc-display-runtime.js'),'utf8');
  assert(agcDisplay.includes('function decodeChannel10(value)')&&agcDisplay.includes('function snapshotUiState()'),'AGC display authority missing');
  const sensor=fs.readFileSync(SENSOR_ACTIVITY,'utf8');webview(sensor,'SensorMainActivity');debugGate(sensor,'SensorMainActivity');assert(sensor.includes('isLocalAssetOrigin(origin)')&&sensor.includes('isLocalAssetOrigin(request.getOrigin().toString())'),'native permissions not origin-restricted');
  const dream=fs.readFileSync(DREAM_SERVICE,'utf8');webview(dream,'AgcDreamService');debugGate(dream,'AgcDreamService');
  const net=fs.readFileSync(NET_CLIENT,'utf8');for(const t of ['shouldOverrideUrlLoading','isPackagedAssetUri','headers.put("Cache-Control", "no-store")','headers.put("X-Content-Type-Options", "nosniff")'])assert(net.includes(t),`NetClient missing ${t}`);
  const reporter=fs.readFileSync(DEBUG_REPORTER,'utf8');for(const t of ['packageVersion(context)','WebView.getCurrentWebViewPackage()','location coordinates are intentionally not included'])assert(reporter.includes(t),`DebugReporter missing ${t}`);
  assert(fs.readFileSync(asset('dream-agc.js'),'utf8').includes("bridge.ready('app')"),'final readiness marker missing');
}
function pointerEvent(target,pointerId){return{target,pointerId,prevented:false,immediate:false,preventDefault(){this.prevented=true},stopPropagation(){},stopImmediatePropagation(){this.immediate=true}}}
(async()=>{
  sourceInvariants();
  const fresh=createEnvironment();await flushAsync();const core=fresh.context.AGCDSKY.getCore();
  assert(core&&core.running,'fresh frontend did not start AGC');assert(core.rope==='Comanche055.bin'&&core.wasm==='yaAGC.wasm','wrong AGC assets');assert(fresh.storage.get('runMode')==='agc','AGC mode not persisted');
  assert(fresh.elements.r1.innerHTML.includes('el-glyph'),'extracted display stack did not render initial face');
  fresh.context.AGCDSKY.agcChannel(0o10,(10<<11)|(3<<5)|25);
  assert(fresh.elements.verb.innerHTML.includes('el-glyph'),'extracted AGC decoder did not render channel 010');
  assert(fresh.context.AGCDSKY.appStatus().display.verb.join('')==='12','app status lost authoritative AGC display state');
  const key=fresh.keyElements.find(e=>e.dataset.key==='1');const down=pointerEvent(key,41);fresh.windowListeners.pointerdown(down);assert(down.prevented&&down.immediate&&core.keyCodes.includes(0o01),'physical key route failed');
  fresh.elements.clock.listeners.click();assert(core.keyReleaseCount===1&&!core.running,'CLOCK transition did not release key and suspend AGC');assert(fresh.storage.has('agcSnapshotV1'),'clock suspend did not save snapshot');
  const exports=core.exportCount;fresh.elements.agc.listeners.click();await flushAsync();assert(fresh.context.AGCDSKY.getCore()===core&&core.running&&core.exportCount===exports,'AGC resume replaced core');
  const before=core.exportCount;fresh.context.AGCDSKY.setAppVisible(false);assert(!core.running&&core.exportCount>before,'background did not pause/save');fresh.context.AGCDSKY.setAppVisible(true);assert(core.running,'foreground did not resume');
  const clock=createEnvironment({initialStorage:{runMode:'clock'}});await flushAsync();assert(clock.context.AGCDSKY.getCore()===null&&clock.context.AGCDSKY.appStatus().mode==='clock','remembered clock mode booted AGC');
  const dream=createEnvironment({search:'?dream=1&clock=1&display=1',initialStorage:{runMode:'agc'}});await flushAsync();assert(dream.context.AGCDSKY.getCore()===null&&dream.document.body.classList.contains('dream')&&dream.document.body.classList.contains('display-only'),'dream isolation failed');
  console.log('frontend/source smoke: PASS');
  console.log('  extracted renderer/environment/audio/clock/AGC-display stack, AGC lifecycle, physical input, snapshots, and dream isolation verified');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
