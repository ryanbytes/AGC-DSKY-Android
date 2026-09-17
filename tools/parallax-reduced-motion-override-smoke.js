#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(ROOT,'app/src/main/assets/parallax-3d.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'app/src/main/assets/parallax-3d.css'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

assert(!js.includes("matchMedia('(prefers-reduced-motion: reduce)')"),'removed parallax must not depend on reduced-motion state');
assert(!js.includes('userMotionOverride'),'removed parallax must not retain motion override state');
assert(!css.includes('@media (prefers-reduced-motion:reduce)'),'static glass needs no reduced-motion exception');
assert(js.includes("document.body.classList.remove('parallax-3d', 'parallax-user-motion')"),'startup must clear stale motion classes');

console.log('retired parallax reduced-motion regression: PASS');
