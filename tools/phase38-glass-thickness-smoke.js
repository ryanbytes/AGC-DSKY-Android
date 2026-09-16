#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets');
const read=n=>fs.readFileSync(path.join(assets,n),'utf8');
const cm=read('cm-mode.js'),js=read('phase38-glass-thickness.js'),css=read('phase38-glass-thickness.css');
const assert=(c,m)=>{if(!c)throw new Error(m)};
assert(cm.includes("script.src = 'phase38-glass-thickness.js'"),'phase38 loader missing');
assert(cm.includes("script.addEventListener('load', loadPhase38GlassThickness"),'phase38 must load after phase37');
assert(js.includes("glassBack.className = 'el-glass-back'"),'rear glass surface missing');
assert(js.includes("link.href = 'phase38-glass-thickness.css'"),'phase38 stylesheet loader missing');
for(const token of [
  'translate3d(calc(var(--dsky-el-parallax-x) * .30px)',
  'translate3d(calc(var(--dsky-el-parallax-x) * .68px)',
  'translate3d(calc(var(--dsky-el-parallax-x) * 1.24px)',
  '17px)',
  'background:transparent!important',
  '.el-glass-back'
]) assert(css.includes(token),`glass thickness CSS missing ${token}`);
const gains=[.30,.68,1.24];
assert(gains[0]<gains[1]&&gains[1]<gains[2],'glass depth planes must increase toward viewer');
assert((gains[2]-gains[0])>=.9,'front-to-substrate differential is too weak to read as thickness');
assert(!css.includes('linear-gradient(180deg,rgba(255,255,255,.045),transparent 15%'),'broad top reflection band returned');
console.log('phase38 glass thickness smoke: PASS');
console.log(`  substrate ${gains[0].toFixed(2)} / rear glass ${gains[1].toFixed(2)} / front glass ${gains[2].toFixed(2)} motion gain`);
