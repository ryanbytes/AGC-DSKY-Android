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
  '.el-glass-sheen',
  '.key.pressed',
  'translateY(var(--key-travel,.42vmin))',
  'left:57.5000%',
  'top:5.1075%',
  'width:33.125%',
  'height:49.0204%',
  'var(--dsky-el-z,-11.678px)',
  '@media (prefers-reduced-motion:reduce)',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .elpanel',
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
  "const DISPLAY_FACE_WIDTH_IN = 2.360",
  "const DISPLAY_PACKAGE_DEPTH_IN = 0.260",
  "const FRAME_DEPTH_IN = 0.300",
  "function updatePhysicalDepth()",
  "elPanel.offsetWidth",
  "'--dsky-el-z'",
  "'--dsky-package-depth-px'",
  "'--dsky-frame-depth-px'",
  "new ResizeObserver(updatePhysicalDepth).observe(elPanel)",
  "geometry:() => Object.freeze({",
  "displayFaceWidthIn:DISPLAY_FACE_WIDTH_IN",
  "displayPackageDepthIn:DISPLAY_PACKAGE_DEPTH_IN",
  "frameDepthIn:FRAME_DEPTH_IN",
  "{passive:true}",
  "body.classList.contains('dream')",
  "body.classList.contains('display-only')",
  "glassSheen.className = 'el-glass-sheen'",
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
  'const phosphorX = -x * 24.0',
  'const glassX = x * 34.0',
  "elPanel.style.setProperty(\n        'transform'",
  "glassSheen.style.setProperty(\n        'transform'",
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
  'translate3d(\n      var(--dsky-fs-glass-x'
]) assert(!css.includes(forbidden),`legacy fake EL/glass counter-motion returned: ${forbidden}`);

const rx=Number((js.match(/MAX_ROTATE_X_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const ry=Number((js.match(/MAX_ROTATE_Y_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const sensor=Number((js.match(/MAX_SENSOR_DELTA_DEG\s*=\s*([0-9.]+)/)||[])[1]);
const face=Number((js.match(/DISPLAY_FACE_WIDTH_IN\s*=\s*([0-9.]+)/)||[])[1]);
const packageDepth=Number((js.match(/DISPLAY_PACKAGE_DEPTH_IN\s*=\s*([0-9.]+)/)||[])[1]);
const frameDepth=Number((js.match(/FRAME_DEPTH_IN\s*=\s*([0-9.]+)/)||[])[1]);
assert(Number.isFinite(rx)&&rx>=3&&rx<=5,'X parallax tilt must stay in visible 3–5 degree envelope');
assert(Number.isFinite(ry)&&ry>=3&&ry<=5,'Y parallax tilt must stay in visible 3–5 degree envelope');
assert(Number.isFinite(sensor)&&sensor>=6&&sensor<=10,'sensor response must reach full parallax within 6–10 degrees');
assert(face===2.360,'EL face width must remain tied to SCD 1006315G 2.360-in reference');
assert(packageDepth===0.260,'EL package visual depth envelope must remain at .263/.257 midpoint');
assert(frameDepth===0.300,'cover-frame depth cross-check must remain 0.300 in');
assert(packageDepth>0&&packageDepth<=frameDepth,'EL package depth must fit inside cover-frame depth envelope');
const basePackagePx=106*packageDepth/face;
const baseFramePx=106*frameDepth/face;
assert(basePackagePx>11&&basePackagePx<12,'base 106-unit EL package depth should scale to about 11.68 px');
assert(baseFramePx>13&&baseFramePx<14,'base 106-unit cover-frame depth should scale to about 13.47 px');
assert(!/calc\(var\(--dsky-parallax-[xy]\)\s*\*/.test(css),'WebView-unsafe CSS multiplication returned to parallax layer');
assert(css.includes('.el-glass-sheen::before'),'EL glass edge occlusion layer missing');
assert(!css.includes('animation:'),'parallax layer must not introduce autonomous looping animation');

console.log('parallax 3D smoke: PASS');
console.log(`  visible tilt envelope: X ${rx.toFixed(2)} deg / Y ${ry.toFixed(2)} deg; full sensor response by ${sensor.toFixed(1)} deg`);
console.log(`  dimension-scaled EL package depth: ${packageDepth.toFixed(3)} in -> ${basePackagePx.toFixed(3)} px at 106-unit face width`);
console.log(`  indicator-cover frame envelope: ${frameDepth.toFixed(3)} in -> ${baseFramePx.toFixed(3)} px at 106-unit face width`);
