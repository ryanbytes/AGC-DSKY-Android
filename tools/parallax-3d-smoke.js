#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
const html=read('index.html'),css=read('parallax-3d.css'),js=read('parallax-3d.js');
function assert(c,m){if(!c)throw new Error(m)}

assert((html.match(/href="parallax-3d\.css"/g)||[]).length===1,'parallax stylesheet must load exactly once');
assert((html.match(/src="parallax-3d\.js"/g)||[]).length===1,'parallax controller must load exactly once');
const parallaxIndex=html.indexOf('<script src="parallax-3d.js"></script>');
const phoneImuIndex=html.indexOf('<script src="phone-icdu.js"></script>');
const dreamIndex=html.indexOf('<script src="dream-agc.js"></script>');
assert(phoneImuIndex>=0&&parallaxIndex>phoneImuIndex,'parallax must observe the already-installed native phone quaternion bridge');
assert(parallaxIndex>=0&&dreamIndex>parallaxIndex,'parallax presentation must initialize before final Dream readiness layer');

for(const token of [
  'perspective:1050px',
  'rotateX(var(--dsky-tilt-x)) rotateY(var(--dsky-tilt-y))',
  'body.parallax-3d.display-only:not(.dream):not(.screen-only) .dsky',
  'transform:translate(-50%,-29.57%) rotateX(var(--dsky-tilt-x)) rotateY(var(--dsky-tilt-y))',
  '.ann-well',
  '.display-well',
  '.ann-grid',
  '.elpanel',
  '.el-glass-sheen',
  '.key.pressed',
  'translateY(var(--key-travel,.42vmin))',
  'left:57.5000%',
  'top:5.1075%',
  'width:33.125%',
  'height:49.0204%',
  '@media (prefers-reduced-motion:reduce)'
]) assert(css.includes(token),`parallax CSS missing ${token}`);
for(const mode of [':not(.dream)',':not(.screen-only)'])
  assert(css.includes(mode),`parallax CSS does not exclude ${mode}`);
assert(!css.includes(':not(.display-only)'),'FULL DSKY DISPLAY must not disable parallax in CSS');

for(const token of [
  "matchMedia('(prefers-reduced-motion: reduce)')",
  "matchMedia('(hover: hover) and (pointer: fine)')",
  "dsky.addEventListener('pointermove'",
  "dsky.addEventListener('pointerdown'",
  "window.addEventListener('deviceorientation'",
  "const original = api.nativePhoneQuaternion",
  "return original.apply(this, args)",
  "nativeBridgeObserved:() => nativeBridgeObserved",
  "source = 'static'",
  "setTarget(dx * 0.88, dy * 0.78, 'native')",
  "document.body.classList.contains('dream')",
  "document.body.classList.contains('screen-only')",
  "glassSheen.className = 'el-glass-sheen'",
  'window.AGCDSKY_PARALLAX = controller',
  'api.parallax3d = controller'
]) assert(js.includes(token),`parallax controller missing ${token}`);
assert(!js.includes("document.body.classList.contains('display-only')"),'FULL DSKY DISPLAY must remain parallax-enabled in JS');

for(const forbidden of [
  'preventDefault(',
  'stopPropagation(',
  'stopImmediatePropagation(',
  'AGCDSKY_APP_STATE',
  'AGCDSKY_CORE_SESSION',
  '.keyPress(',
  '.keyRelease(',
  '.proceedKey(',
  'writeIo(',
  'decodeChannel10(',
  'onAgcChannel(',
  'localStorage',
  'sessionStorage'
]) assert(!js.includes(forbidden),`parallax controller crossed presentation boundary: ${forbidden}`);

const rx=Number((js.match(/MAX_ROTATE_X_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const ry=Number((js.match(/MAX_ROTATE_Y_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const translation=Number((js.match(/PARALLAX_TRANSLATION\s*=\s*([0-9.]+)/)||[])[1]);
assert(Number.isFinite(rx)&&rx>0&&rx<=2,'X parallax tilt escaped restrained <=2 degree envelope');
assert(Number.isFinite(ry)&&ry>0&&ry<=2,'Y parallax tilt escaped restrained <=2 degree envelope');
assert(Number.isFinite(translation)&&translation>=3&&translation<=6,'parallax layer translation must stay visible but bounded');
assert(!css.includes('animation:'),'parallax layer must not introduce autonomous looping animation');

// The Android bridge observer is deliberately a transparent wrapper. Ensure the
// source keeps the try/catch presentation observer before one exact passthrough
// call and never suppresses/replaces the native IMU handler's return value.
const wrapper=js.match(/const observed = function dskyParallaxNativeQuaternion\(\.\.\.args\) \{([\s\S]*?)\n    \};/);
assert(wrapper,'native quaternion observer wrapper missing');
assert((wrapper[1].match(/original\.apply\(this, args\)/g)||[]).length===1,'native quaternion bridge must call its original exactly once');
assert(wrapper[1].indexOf('onNativeQuaternion(...args)')>=0,'native quaternion observer must feed parallax');
assert(wrapper[1].indexOf('return original.apply(this, args)')>wrapper[1].indexOf('onNativeQuaternion(...args)'),'native quaternion observer must preserve the original bridge return path');

// Behavioral probe: run the production controller in a tiny DOM/WebView model,
// deliver the same [w,x,y,z,displayAngle] shape used by SensorMainActivity, and
// prove the wrapper both preserves the native bridge and moves presentation.
const classes=new Set(),vars=new Map(),raf=[];
const body={classList:{
  contains:name=>classes.has(name),
  toggle(name,on){if(on===undefined)on=!classes.has(name);on?classes.add(name):classes.delete(name);return on},
  add:name=>classes.add(name),remove:name=>classes.delete(name)
}};
const dsky={
  style:{setProperty:(name,value)=>vars.set(name,value)},
  querySelector:()=>null,appendChild:()=>{},addEventListener:()=>{},
  getBoundingClientRect:()=>({left:0,top:0,width:320,height:372})
};
const document={
  body,hidden:false,getElementById:id=>id==='dsky'?dsky:null,
  createElement:()=>({className:'',setAttribute(){}}),addEventListener:()=>{}
};
let originalCalls=0,lastArgs=null,lastThis=null;
const original=function(...args){originalCalls++;lastArgs=args;lastThis=this;return 73};
const window={
  AGCDSKY:{nativePhoneQuaternion:original},addEventListener:()=>{},
  requestAnimationFrame:fn=>{raf.push(fn);return raf.length}
};
const context={
  window,document,console,
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
  MutationObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){}
};
vm.runInNewContext(js,context,{filename:'parallax-3d.js'});
const controller=window.AGCDSKY_PARALLAX,native=window.AGCDSKY.nativePhoneQuaternion;
assert(controller&&controller.nativeBridgeObserved(),'production controller did not observe native quaternion bridge');
assert(native!==original,'native quaternion bridge was not wrapped');
const receiver={kind:'native-receiver'},first=[1,0,0,0,0];
assert(native.apply(receiver,first)===73,'parallax wrapper changed native bridge return value');
assert(originalCalls===1&&lastThis===receiver,'parallax wrapper did not preserve native bridge this/call count');
assert(JSON.stringify(lastArgs)===JSON.stringify(first),'parallax wrapper changed native bridge arguments');
const half=8*Math.PI/180/2,second=[Math.cos(half),Math.sin(half),0,0,0];
assert(native.apply(receiver,second)===73&&originalCalls===2,'second native quaternion did not pass through exactly once');
let guard=0;while(raf.length){const batch=raf.splice(0);for(const fn of batch)fn();if(++guard>200)throw new Error('parallax RAF did not settle')}
const state=controller.state();
assert(state.source==='native','native quaternion did not become parallax source');
assert(state.targetX>0.55&&state.targetX<0.65,`unexpected 8-degree native tilt target ${state.targetX}`);
assert(Math.abs(state.targetY)<0.01,`unexpected native pitch target ${state.targetY}`);
assert(parseFloat(vars.get('--dsky-parallax-x'))>2,'native tilt did not produce visible layer translation');
assert(parseFloat(vars.get('--dsky-tilt-y'))>0.8,'native tilt did not produce visible panel rotation');
classes.add('display-only');
assert(controller.enabled(),'FULL DSKY DISPLAY disabled parallax at runtime');
classes.add('screen-only');
assert(!controller.enabled(),'screen-only must remain flat');

console.log('parallax 3D smoke: PASS');
console.log(`  restrained tilt envelope: X ${rx.toFixed(2)} deg / Y ${ry.toFixed(2)} deg; translation ${translation.toFixed(2)} px scale`);
console.log(`  native 8-degree probe: targetX ${state.targetX.toFixed(3)} / layer ${vars.get('--dsky-parallax-x')} / tiltY ${vars.get('--dsky-tilt-y')}`);
console.log('  Android native quaternion passthrough, FULL DSKY DISPLAY crop preservation, pointer fallback, depth layers, and flat Dream/reduced-motion modes verified');
