#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(ROOT,'app/src/main/assets/parallax-3d.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'app/src/main/assets/parallax-3d.css'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

assert(js.includes("let userMotionOverride = hasStoredPercent(TILT_STORAGE_KEY) || hasStoredPercent(DEPTH_STORAGE_KEY);"),
  'stored parallax controls must become an explicit motion override');
assert(js.includes('reduceMotion && reduceMotion.matches && !userMotionOverride'),
  'reduced-motion gate must yield to explicit in-app parallax choice');
assert(js.includes("document.body.classList.toggle('parallax-user-motion', userMotionOverride)"),
  'explicit parallax override must be reflected into CSS state');
assert(js.includes('userMotionOverride = true;'),
  'changing a parallax slider must immediately become an explicit override');
assert(js.includes('reducedMotion:!!(reduceMotion && reduceMotion.matches)')&&js.includes('userMotionOverride,'),
  'diagnostic state must expose reduced-motion and override state');

const media=css.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/)?.[1]||'';
assert(media.includes('body.parallax-3d:not(.parallax-user-motion) .dsky'),
  'reduced-motion CSS must exempt an explicit in-app parallax override');
assert(!media.includes('body.parallax-3d .dsky'),
  'unqualified reduced-motion CSS would flatten explicit parallax motion');

console.log('parallax reduced-motion override smoke: PASS');
