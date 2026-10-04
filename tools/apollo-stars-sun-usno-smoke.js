#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/apollo-stars.js'),'utf8');
let catalog;
const context={window:{AGCDSKY_SERVICE_REGISTRY:{publish(name,value){assert.strictEqual(name,'AGCDSKY_APOLLO_STARS');catalog=value}}}};
vm.runInNewContext(source,context,{filename:'apollo-stars.js'});
assert(catalog,'Apollo star catalog did not publish');

// USNO CelNav API Sun Hc/Zn fixtures. Hc is geometric center altitude and Zn
// is true azimuth; times are supplied as UT1 by the API. Test dates, seasons,
// and latitudes so the low-order solar model is checked independently of the
// brightness-tier and phase-label branch logic below.
const samples=[
  ['2026-10-03T12:00:00Z',39.77,-86.16,2.432022,97.350400],
  ['2026-03-20T13:00:00Z',0,0,76.856116,269.872617],
  ['2026-03-20T16:00:00Z',69.65,18.96,4.467503,257.899883],
  ['2026-06-21T12:00:00Z',70,20,42.027315,204.407469],
  ['2026-12-21T09:00:00Z',-33.9,151.2,0.172317,241.499317]
];
const d2r=Math.PI/180;
function direction(pos){const az=pos.az*d2r,alt=pos.alt*d2r,c=Math.cos(alt);return[c*Math.sin(az),c*Math.cos(az),Math.sin(alt)]}
function separationArcsec(a,b){
  const va=direction(a),vb=direction(b),cross=[va[1]*vb[2]-va[2]*vb[1],va[2]*vb[0]-va[0]*vb[2],va[0]*vb[1]-va[1]*vb[0]];
  return Math.atan2(Math.hypot(...cross),va.reduce((sum,x,i)=>sum+x*vb[i],0))/d2r*3600;
}
let maxError=0;
for(const [iso,lat,lon,hc,zn] of samples){
  const date=new Date(iso),sun=catalog.sunEquatorial(date),actual=catalog.horizontalRaDec(sun.ra,sun.dec,lat,lon,date),error=separationArcsec(actual,{alt:hc,az:zn});
  maxError=Math.max(maxError,error);
  assert(error<45,`${iso} at ${lat},${lon}: solar direction differs from USNO by ${error.toFixed(2)} arcsec`);
}

// Indianapolis, 2026-10-03. The USNO one-day service gives beginning of
// civil twilight at 11:16 UT1 and sunrise at 11:43 UT1 (minute precision).
// Verify all named twilight bands and ensure the visual star-magnitude gate
// stays at its original -2-degree threshold while the label changes at the
// conventional sunrise center-altitude limit of -50 arcminutes.
const phases=[
  ['09:30','NIGHT',3.4],
  ['10:30','ASTRONOMICAL TWILIGHT',2.8],
  ['11:00','NAUTICAL TWILIGHT',1.8],
  ['11:30','CIVIL TWILIGHT',.5],
  ['11:42','CIVIL TWILIGHT',-.3],
  ['11:43','DAYLIGHT',-.3]
];
for(const [time,label,maxMag] of phases){
  const conditions=catalog.skyConditions(39.77,-86.16,new Date(`2026-10-03T${time}:00Z`));
  assert.strictEqual(conditions.label,label,`${time} UT1 phase label`);
  assert.strictEqual(conditions.maxMag,maxMag,`${time} UT1 star-visibility magnitude gate`);
}
assert.strictEqual(samples.length,5,'USNO solar-position sample coverage changed');
console.log('Apollo Sun USNO cross-check: PASS');
console.log(`  ${samples.length} USNO Sun positions pass; max direction error ${maxError.toFixed(2)} arcsec`);
console.log(`  ${phases.length} solar-phase/magnitude-gate cases pass, including USNO civil twilight and sunrise boundary`);
