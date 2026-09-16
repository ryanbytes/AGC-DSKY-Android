#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const read=n=>fs.readFileSync(path.join(assets,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
const cm=read('cm-mode.js'),js=read('phase37-presentation.js'),css=read('phase37-presentation.css');
assert(cm.includes("script.src = 'phase37-presentation.js'"),'phase37 presentation loader missing');
for(const token of ["localStorage.removeItem('dskyHardwareColorMode')","body.classList.add('authentic-colors')",'authentic:()=>true','1.55','1.70','--dsky-el-tilt-x','--dsky-el-parallax-x'])assert(js.includes(token),`phase37 JS missing ${token}`);
assert(!js.includes("createElement('button')"),'retired color toggle is still created');
assert(!js.includes('COLOR · DEFAULT')&&!js.includes('COLOR · FS595'),'retired color-toggle labels remain');
for(const token of ['#7c8183','#4e535a','.el-glass-sheen::before','.el-glass-sheen::after','perspective:760px','var(--dsky-el-tilt-x)'])assert(css.includes(token),`phase37 CSS missing ${token}`);
assert(!js.includes('AGCDSKY_CORE_SESSION')&&!js.includes('writeIo(')&&!js.includes('keyPress('),'presentation layer crossed AGC boundary');
console.log('phase37 presentation smoke: PASS');
console.log('  forced FS595 palette, stronger EL-only parallax, and glass treatment present; color toggle removed');
