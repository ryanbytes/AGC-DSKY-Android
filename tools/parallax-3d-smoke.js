#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const js=fs.readFileSync(path.join(ASSETS,'parallax-3d.js'),'utf8');
const css=fs.readFileSync(path.join(ASSETS,'parallax-3d.css'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

assert((html.match(/src="parallax-3d\.js"/g)||[]).length===1,'static glass compatibility asset must load once');
assert((html.match(/href="parallax-3d\.css"/g)||[]).length===1,'static glass compatibility stylesheet must load once');
assert(js.includes('GLASS_VIEW_THICKNESS_IN'),'drawing-backed static glass geometry must remain');
assert(js.includes("registry.publish('AGCDSKY_DISPLAY_GLASS'"),'static display-glass service must publish');
assert(js.includes("enabled:false, source:'removed', nativeActive:false"),'retired parallax compatibility state must remain explicitly disabled');
assert(js.includes("localStorage.removeItem('dskyParallaxTiltPct')")&&js.includes("localStorage.removeItem('dskyParallaxDepthPct')"),'retired motion preferences must be cleared');

for(const forbidden of [
  'deviceorientation','agcdsky-phonequaternion','pointermove','pointerdown',
  'parallax-tilt-intensity','parallax-depth-intensity','buildIntensityControl',
  'MAX_ROTATE_X_DEG','MAX_ROTATE_Y_DEG','MAX_SENSOR_DELTA_DEG'
]) assert(!js.includes(forbidden),`retired visual parallax runtime returned: ${forbidden}`);

assert(!/perspective\s*:/.test(css),'static glass CSS must not create perspective');
assert(!/transform-style\s*:\s*preserve-3d/.test(css),'static glass CSS must not create preserve-3d layers');
assert(!/rotate[XY]\(/.test(css),'static glass CSS must not rotate display layers');
assert(!/translateZ\(/.test(css),'static glass CSS must not translate display layers in Z');
assert(css.includes('body:not(.screen-only) .el-glass-rear'),'small display must retain fixed glass rear styling');
assert(css.includes('body.screen-only .el-glass-rear'),'large display must retain fixed glass styling');
assert(css.includes('inset:0!important')&&css.includes('margin:auto!important'),'large glass must center without 3D compositor transforms');

console.log('static display glass regression: PASS');
console.log('  visual parallax removed; drawing-backed glass geometry retained');
