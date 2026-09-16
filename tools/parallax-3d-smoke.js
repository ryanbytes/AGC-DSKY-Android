#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
const html=read('index.html'),css=read('parallax-3d.css'),js=read('parallax-3d.js'),controls=read('controls-layout.css');
function assert(c,m){if(!c)throw new Error(m)}

assert((html.match(/href="parallax-3d\.css"/g)||[]).length===1,'parallax stylesheet must load exactly once');
assert((html.match(/src="parallax-3d\.js"/g)||[]).length===1,'parallax controller must load exactly once');
const phoneIcduIndex=html.indexOf('<script src="phone-icdu.js"></script>');
const parallaxIndex=html.indexOf('<script src="parallax-3d.js"></script>');
const dreamIndex=html.indexOf('<script src="dream-agc.js"></script>');
assert(phoneIcduIndex>=0&&parallaxIndex>phoneIcduIndex,'phone sensor callback must exist before parallax wraps it');
assert(parallaxIndex>=0&&dreamIndex>parallaxIndex,'parallax presentation must initialize before final Dream readiness layer');

for(const token of [
  'perspective:680px',
  'rotateX(var(--dsky-tilt-x)) rotateY(var(--dsky-tilt-y))',
  '.ann-well','.display-well','.ann-grid','.elpanel','.el-glass-rear','.el-glass-sheen','.key.pressed',
  'translateY(var(--key-travel,.42vmin))',
  'left:57.5000%','top:5.1075%','width:33.125%','height:49.0204%',
  'var(--dsky-el-z,-6.034px)','var(--dsky-glass-rear-z,-6.034px)',
  '@media (prefers-reduced-motion:reduce)',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .elpanel',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .el-glass-rear',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .el-glass-sheen',
  'content:none!important','mix-blend-mode:normal'
]) assert(css.includes(token),`parallax CSS missing ${token}`);

for(const mode of [':not(.dream)',':not(.display-only)'])
  assert(css.includes(mode),`parallax CSS does not exclude ${mode}`);

/* Parallax must be geometric. Synthetic glare/reflection layers are forbidden. */
for(const forbidden of [
  'mix-blend-mode:screen',
  'clip-path:polygon(',
  'background:linear-gradient(112deg',
  'rgba(255,255,255,.20)',
  'rgba(255,255,255,.24)',
  'radial-gradient(circle at var(--dsky-light-x)',
  'radial-gradient(ellipse at var(--dsky-light-x)'
]) assert(!css.includes(forbidden),`synthetic glint/reflection returned: ${forbidden}`);

for(const token of [
  "matchMedia('(prefers-reduced-motion: reduce)')",
  "matchMedia('(hover: hover) and (pointer: fine)')",
  "dsky.addEventListener('pointermove'",
  "dsky.addEventListener('pointerdown'",
  "window.addEventListener('deviceorientation'",
  "installNativeQuaternionTap()",
  "api.nativePhoneQuaternion = wrapped",
  "'native-quaternion'",
  "nativeActive:() => performance.now() - nativeSeenAt < NATIVE_PRIORITY_MS",
  "const GLASS_CLEAR_WIDTH_IN = 2.354",
  "const GLASS_EDGE_THICKNESS_IN = 0.109",
  "const GLASS_CENTER_RISE_IN = 0.025",
  "const GLASS_VIEW_THICKNESS_IN = GLASS_EDGE_THICKNESS_IN + GLASS_CENTER_RISE_IN",
  "function updatePhysicalDepth()",
  "glassFront || elPanel",
  "'--dsky-glass-rear-z'",
  "'--dsky-el-z'",
  "'--dsky-glass-depth-px'",
  "glassRear.className = 'el-glass-rear'",
  "dsky.insertBefore(glassRear, glassFront)",
  "new ResizeObserver(updatePhysicalDepth).observe(glassFront)",
  "geometry:() => Object.freeze({",
  "glassClearWidthIn:GLASS_CLEAR_WIDTH_IN",
  "glassEdgeThicknessIn:GLASS_EDGE_THICKNESS_IN",
  "glassCenterRiseIn:GLASS_CENTER_RISE_IN",
  "glassViewThicknessIn:GLASS_VIEW_THICKNESS_IN",
  "{passive:true}",
  "body.classList.contains('dream')",
  "body.classList.contains('display-only')",
  "glassFront.className = 'el-glass-sheen'",
  'window.AGCDSKY_PARALLAX = controller',
  'api.parallax3d = controller',
  "const TILT_STORAGE_KEY = 'dskyParallaxTiltPct'",
  "const DEPTH_STORAGE_KEY = 'dskyParallaxDepthPct'",
  'const MAX_INTENSITY_PERCENT = 200',
  'function installIntensityControls()',
  'parallax-tilt-intensity','parallax-depth-intensity',
  "input.type = 'range'","input.step = '5'",
  'const tiltScale = tiltPercent / 100',
  'const depthScale = depthPercent / 100',
  'setTiltPercent:value => updateTiltPercent(value, true)',
  'setDepthPercent:value => updateDepthPercent(value, true)',
  'installIntensityControls()'
]) assert(js.includes(token),`parallax controller missing ${token}`);

for(const token of [
  '.app-controls .parallax-controls',
  '.app-controls .parallax-control',
  '.app-controls .parallax-control span',
  '.app-controls .parallax-control input[type="range"]',
  'width:126px','accent-color:#e8eee3'
]) assert(controls.includes(token),`parallax slider styling missing ${token}`);

const allowedBody=js.match(/function presentationAllowed\(\) \{([\s\S]*?)\n  \}/)?.[1]||'';
assert(!allowedBody.includes("classList.contains('screen-only')"),'screen-only must keep parallax enabled outside Dream mode');
assert(js.indexOf('installNativeQuaternionTap();')>js.indexOf("window.addEventListener('deviceorientation'"),'native quaternion wrapper must install after fallback listener registration');
assert(js.includes('performance.now() - nativeSeenAt < NATIVE_PRIORITY_MS'),'native quaternion must suppress WebView orientation fallback while active');

for(const forbidden of [
  '--dsky-el-x','--dsky-el-y','--dsky-glass-x','--dsky-glass-y',
  '--dsky-fs-el-x','--dsky-fs-el-y','--dsky-fs-glass-x','--dsky-fs-glass-y',
  'DISPLAY_PACKAGE_DEPTH_IN','FRAME_DEPTH_IN',
  'const phosphorX = -x * 24.0','const glassX = x * 34.0',
  "elPanel.style.setProperty(\n        'transform'",
  "glassFront.style.setProperty(\n        'transform'",
  'preventDefault(','stopPropagation(','stopImmediatePropagation(',
  'AGCDSKY_APP_STATE','AGCDSKY_CORE_SESSION',
  '.keyPress(','.keyRelease(','.proceedKey(','writeIo(','decodeChannel10(','onAgcChannel(','sessionStorage'
]) assert(!js.includes(forbidden),`parallax controller crossed fidelity/presentation boundary: ${forbidden}`);

assert(js.includes("localStorage.getItem(key)")&&js.includes("localStorage.setItem(key, String(value))"),
  'restored slider values must persist using only their dedicated localStorage keys');
assert(!/glassDepthPx\s*\*\s*depthScale/.test(js),'DEPTH slider must not change physical glass thickness');
assert(!/edgeDepthPx\s*\*\s*depthScale/.test(js),'DEPTH slider must not change physical glass edge thickness');
assert(!/centerRisePx\s*\*\s*depthScale/.test(js),'DEPTH slider must not change physical center rise');

for(const forbidden of [
  'var(--dsky-el-x,0px)','var(--dsky-el-y,0px)','var(--dsky-glass-x,0px)','var(--dsky-glass-y,0px)',
  'var(--dsky-fs-el-x,0px)','var(--dsky-fs-glass-x,0px)',
  'translate3d(\n      var(--dsky-fs-glass-x',
  'var(--dsky-el-z,-11.678px)','translateZ(34px)','translateZ(42px)'
]) assert(!css.includes(forbidden),`legacy fake EL/glass depth returned: ${forbidden}`);

const rx=Number((js.match(/MAX_ROTATE_X_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const ry=Number((js.match(/MAX_ROTATE_Y_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const sensor=Number((js.match(/MAX_SENSOR_DELTA_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const clearWidth=Number((js.match(/GLASS_CLEAR_WIDTH_IN\s*=\s*([0-9.]+)/)||[])[1]);
const edgeDepth=Number((js.match(/GLASS_EDGE_THICKNESS_IN\s*=\s*([0-9.]+)/)||[])[1]);
const centerRise=Number((js.match(/GLASS_CENTER_RISE_IN\s*=\s*([0-9.]+)/)||[])[1]);
const viewDepth=edgeDepth+centerRise;
assert(Number.isFinite(rx)&&rx>=3&&rx<=5,'X parallax tilt must stay in visible 3–5 degree envelope');
assert(Number.isFinite(ry)&&ry>=3&&ry<=5,'Y parallax tilt must stay in visible 3–5 degree envelope');
assert(Number.isFinite(sensor)&&sensor>=6&&sensor<=10,'sensor response must reach full parallax within 6–10 degrees');
assert(clearWidth===2.354,'glass clear-view width must remain tied to the 2004745 reconstruction');
assert(edgeDepth===0.109,'2004745 rear-face to edge/front datum must remain 0.109 in');
assert(centerRise===0.025,'2004745 raised central face must remain 0.025 in above edge/front datum');
assert(Math.abs(viewDepth-0.134)<1e-9,'central 2004745 viewing thickness must resolve to 0.134 in');
const baseGlassPx=106*viewDepth/clearWidth;
const baseEdgePx=106*edgeDepth/clearWidth;
const baseRisePx=106*centerRise/clearWidth;
assert(baseGlassPx>6&&baseGlassPx<6.1,'base 106-unit glass viewing depth should scale to about 6.034 px');
assert(baseEdgePx>4.9&&baseEdgePx<5,'base 106-unit glass edge thickness should scale to about 4.908 px');
assert(baseRisePx>1.1&&baseRisePx<1.2,'base 106-unit glass center rise should scale to about 1.126 px');
assert(!/calc\(var\(--dsky-parallax-[xy]\)\s*\*/.test(css),'WebView-unsafe CSS multiplication returned to parallax layer');
assert(css.includes('.el-glass-rear::after'),'rear glass interface edge layer missing');
assert(!css.includes('animation:'),'parallax layer must not introduce autonomous looping animation');

/* Execute the real controller in a tiny DOM harness. Static token checks alone
   previously allowed a native path that could exist in source without proving
   that Android quaternion samples actually changed the presentation state. */
function runtimeNativeParallaxSmoke(){
  const vars=new Map(),listeners=new Map(),raf=[];
  let now=1000,rafId=0,priorCalls=0;
  const style={setProperty:(k,v)=>vars.set(k,String(v)),getPropertyValue:k=>vars.get(k)||''};
  const classNames=new Set();
  const classList={
    contains:n=>classNames.has(n),
    toggle:(n,on)=>{if(on===undefined)on=!classNames.has(n);if(on)classNames.add(n);else classNames.delete(n);return !!on;},
    add:n=>classNames.add(n),remove:n=>classNames.delete(n)
  };
  const element=(id='')=>({
    id,className:'',style:{setProperty(){},getPropertyValue(){return ''}},children:[],offsetWidth:106,
    setAttribute(){},appendChild(x){this.children.push(x);return x;},insertBefore(){},
    addEventListener(){},querySelector(){return null;},
    getBoundingClientRect(){return {left:0,top:0,width:106,height:182.356};}
  });
  const glassFront=element(),glassRear=element(),elPanel=element('elpanel'),controlsEl=element('controls');
  glassFront.offsetWidth=106;glassFront.getBoundingClientRect=()=>({left:0,top:0,width:106,height:182.356});
  const dsky=element('dsky');dsky.style=style;
  dsky.querySelector=sel=>sel==='.el-glass-sheen'?glassFront:sel==='.el-glass-rear'?glassRear:null;
  const body={classList};
  const document={
    body,
    getElementById:id=>id==='dsky'?dsky:id==='elpanel'?elPanel:id==='controls'?controlsEl:null,
    createElement:()=>element(),
    addEventListener(){}
  };
  controlsEl.querySelector=()=>null;
  const prior=function(){priorCalls++;};
  const api={nativePhoneQuaternion:prior};
  const window={
    AGCDSKY:api,
    requestAnimationFrame:cb=>{raf.push(cb);return ++rafId;},
    addEventListener:(name,fn)=>listeners.set(name,fn)
  };
  const localStorage={data:new Map(),getItem(k){return this.data.has(k)?this.data.get(k):null;},setItem(k,v){this.data.set(k,String(v));}};
  const context={
    window,document,localStorage,
    performance:{now:()=>now},
    matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
    setTimeout:()=>1,clearTimeout(){},console,
    Object,Number,Math,Map,Set,Array,String,Boolean,Error
  };
  vm.runInNewContext(js,context,{filename:'parallax-3d.js'});
  assert(window.AGCDSKY_PARALLAX,'runtime controller was not published');
  assert(api.nativePhoneQuaternion!==prior,'native quaternion callback was not wrapped at runtime');
  const drain=()=>{let guard=0;while(raf.length&&guard++<100){const cb=raf.shift();cb(now+=16);}assert(guard<100,'parallax RAF failed to converge');};
  const qY=degrees=>{const h=degrees*Math.PI/360;return [Math.cos(h),0,Math.sin(h),0];};
  api.nativePhoneQuaternion(1,0,0,0,0);
  now+=10;
  const q=qY(4);
  api.nativePhoneQuaternion(q[0],q[1],q[2],q[3],0);
  drain();
  const state=window.AGCDSKY_PARALLAX.state();
  assert(priorCalls===2,'parallax wrapper must preserve the phone-ICDU native callback');
  assert(state.source==='native-quaternion','native quaternion sample did not become active parallax source');
  assert(state.nativeActive===true,'native quaternion source should report active after a fresh sample');
  assert(state.targetX>0.45&&state.targetX<0.55,'4-degree native pitch should map to about 50% horizontal parallax target');
  assert(Math.abs(state.targetY)<1e-6,'pure native pitch should not create roll target');
  const tiltY=parseFloat(vars.get('--dsky-tilt-y'));
  assert(tiltY>1.9&&tiltY<2.2,'native quaternion did not produce the expected visible Y tilt');
  const physicalDepthBefore=vars.get('--dsky-el-z');
  assert(physicalDepthBefore==='-6.034px','runtime physical glass depth must resolve to 6.034 px at the 106-unit reference width');
  window.AGCDSKY_PARALLAX.setDepthPercent(200);drain();
  assert(vars.get('--dsky-el-z')===physicalDepthBefore,'DEPTH intensity must not alter physical glass spacing at runtime');
  return {targetX:state.targetX,tiltY,physicalDepthBefore};
}
const runtime=runtimeNativeParallaxSmoke();

console.log('parallax 3D smoke: PASS');
console.log(`  geometric tilt: X ${rx.toFixed(2)} deg / Y ${ry.toFixed(2)} deg; full sensor response by ${sensor.toFixed(1)} deg`);
console.log('  synthetic glint/reflection: forbidden');
console.log('  controls: TILT 0–200% + DEPTH 0–200%, persisted independently');
console.log(`  physical glass: ${edgeDepth.toFixed(3)} + ${centerRise.toFixed(3)} = ${viewDepth.toFixed(3)} in -> ${baseGlassPx.toFixed(3)} px at 106-unit width`);
console.log(`  runtime native path: 4.0 deg pitch -> targetX ${runtime.targetX.toFixed(3)}, tiltY ${runtime.tiltY.toFixed(3)} deg; EL Z ${runtime.physicalDepthBefore}`);
