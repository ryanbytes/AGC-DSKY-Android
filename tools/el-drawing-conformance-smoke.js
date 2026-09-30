#!/usr/bin/env node
'use strict';

/*
 * Primary-source dimensional conformance gate for the Apollo Block II DSKY
 * seven-segment EL geometry.
 *
 * Authority: MIT/IL SCD 1006315G, sheet 1, Detail C.
 * This deliberately checks drawing callouts rather than freezing one CAD
 * reconstruction. el-geometry-lock-smoke.js separately guards exact vertices.
 */

const fs=require('fs');
const src=fs.readFileSync('app/src/main/assets/dsky-geometry.js','utf8');
const fail=m=>{throw new Error('EL DRAWING CONFORMANCE FAIL: '+m)};
const near=(v,target,eps,label)=>{if(Math.abs(v-target)>eps)fail(`${label}: ${v} vs ${target} ± ${eps}`)};
const between=(v,lo,hi,label)=>{if(v<lo||v>hi)fail(`${label}: ${v} outside [${lo}, ${hi}]`)};

const block=(src.match(/const SEGMENT_PATH_IN=Object\.freeze\(\{([\s\S]*?)\}\);/)||[])[1];
if(!block)fail('SEGMENT_PATH_IN block not found');

const paths={};
for(const m of block.matchAll(/\b([a-g]):'([^']+)'/g)){
  const nums=[...m[2].matchAll(/[-+]?(?:\d*\.\d+|\d+\.?\d*)/g)].map(x=>Number(x[0]));
  if(nums.length!==8)fail(`segment ${m[1]} expected 4 vertices, got ${nums.length/2}`);
  paths[m[1]]=[[nums[0],nums[1]],[nums[2],nums[3]],[nums[4],nums[5]],[nums[6],nums[7]]];
}
if(Object.keys(paths).length!==7)fail('expected seven segment polygons');

const edge=(p,i)=>{
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1];
  return {a,b,dx,dy,len:Math.hypot(dx,dy),angle:Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI};
};
const edges=p=>p.map((_,i)=>edge(p,i));
const all=Object.values(paths).flat();
const minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));

// .505/.495 overall digit height.
between(maxY-minY,.495,.505,'Detail C overall digit height');

// .325/.315 upper outside width: horizontal distance between the topmost
// outer vertices of the upper side electrodes H and F.
const topmost=p=>p.reduce((best,v)=>v[1]<best[1]?v:best,p[0]);
const upperOutside=topmost(paths.b)[0]-topmost(paths.f)[0];
between(upperOutside,.315,.325,'Detail C upper outside width');

// .225/.215 from top datum to upper edge of middle segment J (logical g).
const middleTop=Math.min(...paths.g.map(p=>p[1]));
between(middleTop-minY,.215,.225,'Detail C top-to-middle datum');

// .070/.060 TYP horizontal electrode thickness.
for(const name of ['a','g','d']){
  const ys=paths[name].map(p=>p[1]);
  between(Math.max(...ys)-Math.min(...ys),.060,.070,`segment ${name} thickness`);
}

// 14°30'-15°30' TYP side-electrode slant from vertical and .060-.070
// normal width. The two longest edges are the parallel sides of each electrode.
for(const name of ['b','c','e','f']){
  const es=edges(paths[name]).sort((x,y)=>y.len-x.len);
  const side1=es[0],side2=es[1];
  const slant=Math.abs(90-side1.angle);
  between(slant,14.5,15.5,`segment ${name} slant from vertical`);
  const vx=side1.dx,vy=side1.dy;
  const px=side2.a[0]-side1.a[0],py=side2.a[1]-side1.a[1];
  const normalWidth=Math.abs(vx*py-vy*px)/side1.len;
  between(normalWidth,.060,.070,`segment ${name} normal width`);
}

// .010 MIN TYP callout in Detail C is the center split between the upper and
// lower side electrodes. It is a vertical dimension, not a global Euclidean
// nearest-distance requirement at the diagonal top/bottom junctions.
const leftCenterGap=Math.min(...paths.e.map(p=>p[1]))-Math.max(...paths.f.map(p=>p[1]));
const rightCenterGap=Math.min(...paths.c.map(p=>p[1]))-Math.max(...paths.b.map(p=>p[1]));
if(leftCenterGap<.010-1e-6)fail(`left center split below .010 MIN: ${leftCenterGap}`);
if(rightCenterGap<.010-1e-6)fail(`right center split below .010 MIN: ${rightCenterGap}`);
near(leftCenterGap,.010,1e-6,'left center split');
near(rightCenterGap,.010,1e-6,'right center split');

// 59°30'-60°30' TYP bevels preserved on the drawing-constrained free ends.
// The opposite clipped ends are straight-edge intersections and are not forced
// into a generic symmetric seven-segment bevel.
const fBevel=edge(paths.f,2).angle;
const cBevel=edge(paths.c,1).angle;
between(fBevel,59.5,60.5,'upper-left free-end bevel');
between(cBevel,59.5,60.5,'lower-right free-end bevel');

// Handedness sanity: the digit's top envelope is right-shifted relative to its
// bottom envelope as depicted by the Detail C front view.
const upperCenter=(Math.max(...paths.b.map(p=>p[0]))+Math.min(...paths.f.map(p=>p[0])))/2;
const lowerCenter=(Math.max(...paths.c.map(p=>p[0]))+Math.min(...paths.e.map(p=>p[0])))/2;
if(!(upperCenter>lowerCenter))fail('digit handedness/slant reversed');

console.log('EL drawing conformance: PASS');
console.log(`  height=${(maxY-minY).toFixed(9)} in upperWidth=${upperOutside.toFixed(9)} in topToMiddle=${(middleTop-minY).toFixed(9)} in`);
console.log(`  centerGaps L/R=${leftCenterGap.toFixed(9)}/${rightCenterGap.toFixed(9)} in bevels=${fBevel.toFixed(6)}/${cBevel.toFixed(6)} deg`);
