#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'app/src/main/assets/apollo-stars.js'),'utf8');
let catalog;
const context={window:{AGCDSKY_SERVICE_REGISTRY:{publish(name,value){assert.strictEqual(name,'AGCDSKY_APOLLO_STARS');catalog=value}}}};
vm.runInNewContext(source,context,{filename:'apollo-stars.js'});
assert(catalog,'Apollo star catalog did not publish');

// USNO CelNav API sample for 2026-10-03 12:00:00 UT1, 39.77 N, 86.16 W.
// Hc/Zn are unrefracted geocentric altitude/true azimuth; Refr is a negative
// altitude correction, so predicted apparent altitude is Hc - Refr.
// Codes were matched to the USNO entries by computed sky position, not name:
// USNO and the Comanche display catalog use different star names/aliases.
const samples=[
  ['01',8.905905,300.855861,-0.098995],
  ['05',40.090921,359.298583,-0.019657],
  ['07',25.384129,253.171250,-0.034663],
  ['10',50.990048,303.703821,-0.013422],
  ['11',50.644017,244.537629,-0.013588],
  ['12',35.907848,213.814329,-0.022830],
  ['13',69.799928,296.700609,-0.006093],
  ['15',33.327610,185.118908,-0.025119],
  ['16',54.421770,164.243576,-0.011855],
  ['21',31.039125,137.091143,-0.027422],
  ['22',40.543348,111.144809,-0.019346],
  ['23',23.258022,90.285391,-0.038195],
  ['27',22.794597,44.090521,-0.039044]
];
const date=new Date('2026-10-03T12:00:00.000Z');
const lat=39.77,lon=-86.16,d2r=Math.PI/180;
function direction(pos){
  const az=pos.az*d2r,alt=pos.alt*d2r,c=Math.cos(alt);
  return [c*Math.sin(az),c*Math.cos(az),Math.sin(alt)];
}
function separationArcsec(a,b){
  const va=direction(a),vb=direction(b),cross=[
    va[1]*vb[2]-va[2]*vb[1],va[2]*vb[0]-va[0]*vb[2],va[0]*vb[1]-va[1]*vb[0]
  ];
  const crossNorm=Math.hypot(...cross),dot=va.reduce((sum,x,i)=>sum+x*vb[i],0);
  return Math.atan2(crossNorm,dot)/d2r*3600;
}
let maxGeometricError=0,maxApparentError=0,maxRefractionError=0;
for(const [code,hc,zn,refr] of samples){
  const star=catalog.stars.find(item=>item.code===code);
  assert(star,`Comanche star code ${code} is missing`);
  const geometric=catalog.horizontal(star,lat,lon,date);
  const apparent=catalog.apparentHorizontal(star,lat,lon,date);
  const geocentricReference={az:zn,alt:hc};
  const apparentReference={az:zn,alt:hc-refr};
  const geometricError=separationArcsec(geometric,geocentricReference);
  const apparentError=separationArcsec(apparent,apparentReference);
  const refractionError=Math.abs((apparent.alt-geometric.alt)-(-refr))*3600;
  maxGeometricError=Math.max(maxGeometricError,geometricError);
  maxApparentError=Math.max(maxApparentError,apparentError);
  maxRefractionError=Math.max(maxRefractionError,refractionError);
  assert(geometricError<30,`${star.name} geometric direction differs from USNO Hc/Zn by ${geometricError.toFixed(2)} arcsec`);
  assert(apparentError<30,`${star.name} refracted direction differs from USNO prediction by ${apparentError.toFixed(2)} arcsec`);
  assert(refractionError<5,`${star.name} Bennett refraction differs from USNO correction by ${refractionError.toFixed(2)} arcsec`);
}
assert.strictEqual(samples.length,13,'USNO cross-check sample coverage changed');
assert.strictEqual(catalog.standardRefractionDeg(90),0,'zenith refraction must approach zero safely');
assert.strictEqual(catalog.standardRefractionDeg(-1),0,'below-horizon refraction is outside the finder model');

console.log('Apollo star USNO cross-check: PASS');
console.log(`  ${samples.length} independent USNO CelNav star positions pass; max geometric ${maxGeometricError.toFixed(2)} arcsec, apparent ${maxApparentError.toFixed(2)} arcsec, refraction ${maxRefractionError.toFixed(2)} arcsec`);
