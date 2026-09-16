#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=name=>fs.readFileSync(path.join(ASSETS,name),'utf8');
const html=read('index.html'),css=read('parallax-3d.css'),js=read('parallax-3d.js');
function assert(c,m){if(!c)throw new Error(m)}

assert((html.match(/href="parallax-3d\.css"/g)||[]).length===1,'parallax stylesheet must load exactly once');
assert((html.match(/src="parallax-3d\.js"/g)||[]).length===1,'parallax controller must load exactly once');
const parallaxIndex=html.indexOf('<script src="parallax-3d.js"></script>');
const dreamIndex=html.indexOf('<script src="dream-agc.js"></script>');
assert(parallaxIndex>=0&&dreamIndex>parallaxIndex,'parallax presentation must initialize before final Dream readiness layer');

for(const token of [
  'perspective:680px',
  'rotateX(var(--dsky-tilt-x)) rotateY(var(--dsky-tilt-y))',
  '.ann-well',
  '.display-well',
  '.ann-grid',
  '.elpanel',
  '.el-glass-rear',
  '.el-glass-sheen',
  '.key.pressed',
  'translateY(var(--key-travel,.42vmin))',
  'left:57.5000%',
  'top:5.1075%',
  'width:33.125%',
  'height:49.0204%',
  'var(--dsky-el-z,-6.034px)',
  'var(--dsky-glass-rear-z,-6.034px)',
  'clip-path:polygon(',
  '@media (prefers-reduced-motion:reduce)',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .elpanel',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .el-glass-rear',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .el-glass-sheen'
]) assert(css.includes(token),`parallax CSS missing ${token}`);
for(const mode of [':not(.dream)',':not(.display-only)'])
  assert(css.includes(mode),`parallax CSS does not exclude ${mode}`);

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
  'api.parallax3d = controller'
]) assert(js.includes(token),`parallax controller missing ${token}`);

const allowedBody=js.match(/function presentationAllowed\(\) \{([\s\S]*?)\n  \}/)?.[1]||'';
assert(!allowedBody.includes("classList.contains('screen-only')"),'screen-only must keep parallax enabled outside Dream mode');
assert(js.indexOf('installNativeQuaternionTap();')>js.indexOf("window.addEventListener('deviceorientation'"),'native quaternion wrapper must install after fallback listener registration');
assert(js.includes('performance.now() - nativeSeenAt < NATIVE_PRIORITY_MS'),'native quaternion must suppress WebView orientation fallback while active');

for(const forbidden of [
  '--dsky-el-x',
  '--dsky-el-y',
  '--dsky-glass-x',
  '--dsky-glass-y',
  '--dsky-fs-el-x',
  '--dsky-fs-el-y',
  '--dsky-fs-glass-x',
  '--dsky-fs-glass-y',
  'DISPLAY_PACKAGE_DEPTH_IN',
  'FRAME_DEPTH_IN',
  'const phosphorX = -x * 24.0',
  'const glassX = x * 34.0',
  "elPanel.style.setProperty(\n        'transform'",
  "glassFront.style.setProperty(\n        'transform'",
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
]) assert(!js.includes(forbidden),`parallax controller crossed fidelity/presentation boundary: ${forbidden}`);

for(const forbidden of [
  'var(--dsky-el-x,0px)',
  'var(--dsky-el-y,0px)',
  'var(--dsky-glass-x,0px)',
  'var(--dsky-glass-y,0px)',
  'var(--dsky-fs-el-x,0px)',
  'var(--dsky-fs-glass-x,0px)',
  'translate3d(\n      var(--dsky-fs-glass-x',
  'var(--dsky-el-z,-11.678px)',
  'translateZ(34px)',
  'translateZ(42px)'
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
assert(css.includes('.el-glass-sheen::before'),'front glass AR reflection layer missing');
assert(css.includes('.el-glass-rear::after'),'rear glass interface layer missing');
assert(!css.includes('animation:'),'parallax layer must not introduce autonomous looping animation');

console.log('parallax 3D smoke: PASS');
console.log(`  visible tilt envelope: X ${rx.toFixed(2)} deg / Y ${ry.toFixed(2)} deg; full sensor response by ${sensor.toFixed(1)} deg`);
console.log(`  2004745 clear-view width: ${clearWidth.toFixed(3)} in`);
console.log(`  2004745 viewing thickness: ${edgeDepth.toFixed(3)} + ${centerRise.toFixed(3)} = ${viewDepth.toFixed(3)} in -> ${baseGlassPx.toFixed(3)} px at 106-unit width`);
