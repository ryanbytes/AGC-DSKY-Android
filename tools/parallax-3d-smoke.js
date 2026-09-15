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
  '@media (prefers-reduced-motion:reduce)',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .elpanel',
  'body.parallax-3d.screen-only:not(.dream):not(.display-only) .el-glass-sheen',
  'var(--dsky-el-x,0px)',
  'var(--dsky-glass-x,0px)',
  'var(--dsky-fs-el-x,0px)',
  'var(--dsky-fs-glass-x,0px)'
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
  "setPx('--dsky-fs-el-x'",
  "setPx('--dsky-fs-glass-x'",
  "const elPanel = document.getElementById('elpanel')",
  "const phosphorX = -x * 24.0",
  "const glassX = x * 34.0",
  "elPanel.style.setProperty(",
  "glassSheen.style.setProperty(",
  "'important'",
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
assert(js.includes("elPanel.style.setProperty(\n        'transform'"),'fullscreen phosphor must use direct inline transform');
assert(js.includes("glassSheen.style.setProperty(\n        'transform'"),'fullscreen glass must use direct inline transform');

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
const sensor=Number((js.match(/MAX_SENSOR_DELTA_DEG\s*=\s*([0-9.]+)/)||[])[1]);
assert(Number.isFinite(rx)&&rx>=3&&rx<=5,'X parallax tilt must stay in visible 3–5 degree envelope');
assert(Number.isFinite(ry)&&ry>=3&&ry<=5,'Y parallax tilt must stay in visible 3–5 degree envelope');
assert(Number.isFinite(sensor)&&sensor>=6&&sensor<=10,'sensor response must reach full parallax within 6–10 degrees');
assert(!/calc\(var\(--dsky-parallax-[xy]\)\s*\*/.test(css),'WebView-unsafe CSS multiplication returned to parallax layer');
assert(css.includes('.el-glass-sheen::before'),'EL glass edge occlusion layer missing');
assert(!css.includes('animation:'),'parallax layer must not introduce autonomous looping animation');

console.log('parallax 3D smoke: PASS');
console.log(`  visible tilt envelope: X ${rx.toFixed(2)} deg / Y ${ry.toFixed(2)} deg; full sensor response by ${sensor.toFixed(1)} deg`);
console.log('  fullscreen EL bypasses stylesheet transforms with direct inline !important phosphor/glass motion');
