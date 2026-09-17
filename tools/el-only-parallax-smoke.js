#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const css=fs.readFileSync(path.join(ASSETS,'parallax-3d.css'),'utf8');
const js=fs.readFileSync(path.join(ASSETS,'parallax-3d.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

assert(!/rotate[XY]\(/.test(css),'small and large EL views must stay flat');
assert(!/translateZ\(/.test(css),'EL presentation must not use Z translation');
assert(!/perspective\s*:/.test(css),'EL presentation must not create perspective');
assert(!js.includes('scheduleFrame')&&!js.includes('setTarget('),'motion animation loop must be gone');
assert(!js.includes('nativeBaseQ')&&!js.includes('orientationBase'),'attitude-to-presentation mapping must be gone');
assert(css.includes('transform:none!important'),'fixed glass layers must explicitly stay untransformed');
assert(css.includes('body.parallax-3d.screen-only .elpanel{transform:translate(-50%,-50%)!important}'),'stale restored motion class must still leave large EL flat and centered');

console.log('flat EL presentation smoke: PASS');
console.log('  small EL: fixed');
console.log('  large EL: fixed');
