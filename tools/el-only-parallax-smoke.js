#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'app/src/main/assets/parallax-3d.css'),'utf8');

function assert(condition,message){if(!condition)throw new Error(message)}
function block(selector){
  const start=css.indexOf(selector);
  if(start<0)return '';
  const open=css.indexOf('{',start);
  const close=css.indexOf('}',open);
  return open>=0&&close>open?css.slice(open+1,close):'';
}

const normalDsky=block('body.parallax-3d:not(.dream):not(.display-only):not(.screen-only) .dsky');
const normalEl=block('body.parallax-3d:not(.dream):not(.display-only):not(.screen-only) .elpanel');
const screenApp=block('body.parallax-3d.screen-only:not(.dream):not(.display-only) #app');
const screenDsky=block('body.parallax-3d.screen-only:not(.dream):not(.display-only) .dsky');
const screenEl=block('body.parallax-3d.screen-only:not(.dream):not(.display-only) .elpanel');

assert(normalDsky.includes('transform:none'),'normal DSKY face must remain rigid');
assert(!normalDsky.includes('rotateX(')&&!normalDsky.includes('rotateY('),'normal DSKY face must not rotate for parallax');
assert(normalEl.includes('rotateX(var(--dsky-tilt-x))')&&normalEl.includes('rotateY(var(--dsky-tilt-y))'),'small EL must own tilt parallax');
assert(normalEl.includes('var(--dsky-recess-x,0px)')&&normalEl.includes('var(--dsky-recess-y,0px)'),'small EL must own translational parallax');

assert(screenApp.includes('perspective:none'),'screen-only app must not create a full-viewport 3D compositor layer');
assert(screenDsky.includes('left:0')&&screenDsky.includes('top:0'),'screen-only DSKY must use viewport coordinates without centering transform');
assert(screenDsky.includes('transform:none'),'screen-only container must remain untransformed');
assert(screenDsky.includes('perspective:520px'),'screen-only fixed DSKY must own perspective for its EL children');
assert(screenDsky.includes('transform-style:flat'),'screen-only full viewport must stay flat to prevent compositor seams');
assert(!screenDsky.includes('rotateX(')&&!screenDsky.includes('rotateY('),'screen-only container must not rotate for parallax');
assert(!screenDsky.includes('preserve-3d'),'screen-only full viewport must never become a preserve-3d layer');
assert(screenEl.includes('rotateX(var(--dsky-tilt-x))')&&screenEl.includes('rotateY(var(--dsky-tilt-y))'),'large EL must own tilt parallax');
assert(screenEl.includes('var(--dsky-fs-shadow-light-x,0px)')&&screenEl.includes('var(--dsky-fs-shadow-light-y,0px)'),'large EL must own translational parallax');
assert(screenEl.includes('transform-style:preserve-3d'),'large EL may retain its own 3D transform context');

assert(css.includes('.key.pressed')&&css.includes('transform:translateY(var(--key-travel,.42vmin))'),'mechanical key travel must remain without parallax');
assert(css.includes('.el-indicator-back')&&css.includes('var(--dsky-screen-indicator-back-z,-17.712px)'),'large EL package rear must move with the EL package');

console.log('EL-only parallax smoke: PASS');
console.log('  small EL: motion enabled; DSKY face fixed');
console.log('  large EL: motion enabled; screen-only viewport flat and seam-safe');
