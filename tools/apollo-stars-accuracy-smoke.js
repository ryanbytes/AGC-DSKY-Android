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

function angularErrorArcsec(actual,expected){
  const r=Math.PI/180,ra1=actual.ra*r,dec1=actual.dec*r,ra2=expected.ra*r,dec2=expected.dec*r;
  const sd=Math.sin((dec2-dec1)/2),sr=Math.sin((ra2-ra1)/2);
  const h=sd*sd+Math.cos(dec1)*Math.cos(dec2)*sr*sr;
  return 2*Math.atan2(Math.sqrt(Math.max(0,h)),Math.sqrt(Math.max(0,1-h)))*180/Math.PI*3600;
}

assert.strictEqual(catalog.stars.length,37,'Comanche 055 star catalog entry count changed');
const expectedHipByCode=['677','3419','4427','7588','11767','13847','14135','15863','21421','24436','24608','30438','32349','37279','39953','44127','46390','49669','57632','59803','60718','65474','67301','68933','69673','76267','80763','82273','86032','91262','92855','97649','100345','100751','102098','107315','113368'];
assert.strictEqual(new Set(expectedHipByCode).size,37,'Hipparcos star cross-identifiers must be unique');
for(const star of catalog.stars){
  assert.strictEqual(star.coordinateEpoch,1970,'Apollo star catalog epoch is missing or inconsistent');
  const expectedHip=expectedHipByCode[Number(star.internal)-1];
  assert(star.astrometry,`${star.name} lacks a modern astrometric entry`);
  assert.strictEqual(String(star.astrometry.hip),expectedHip,`${star.name} maps to the wrong Hipparcos entry`);
  assert.strictEqual(star.astrometry.catalog,'Hipparcos New Reduction (I/311)',`${star.name} astrometry source is missing`);
  assert.strictEqual(star.astrometry.referenceEpoch,1991.25,`${star.name} Hipparcos epoch is missing or inconsistent`);
  assert(Number.isFinite(star.astrometry.ra)&&Number.isFinite(star.astrometry.dec)&&
    Number.isFinite(star.astrometry.pmRaCosDec)&&Number.isFinite(star.astrometry.pmDec),
    `${star.name} Hipparcos position or proper motion is invalid`);
  const norm=Math.hypot(star.x,star.y,star.z);
  assert(Math.abs(norm-1)<1e-8,`${star.name} AGC direction vector is not unit length`);
  const current=catalog.equatorialOfDate(star,new Date('2026-10-03T00:00:00.000Z'));
  assert(Number.isFinite(current.ra)&&Number.isFinite(current.dec)&&current.dec>=-90&&current.dec<=90,
    `${star.name} did not produce a finite observation-date direction`);
}
let maxApolloEpochError=0,worstApolloEpochStar='';
for(const star of catalog.stars){
  const atApolloEpoch=catalog.equatorialOfDate(star,new Date(0));
  const error=angularErrorArcsec(atApolloEpoch,{ra:star.ra,dec:star.dec});
  if(error>maxApolloEpochError){maxApolloEpochError=error;worstApolloEpochStar=star.name}
  assert(error<5,
    `${star.name} Hipparcos astrometry does not recover its Comanche 1970 reference vector within the documented 5-arcsecond envelope`);
}
const deneb=catalog.stars.find(star=>star.name==='DENEB');
assert(deneb,'Comanche 055 Deneb entry missing');
assert.strictEqual(deneb.coordinateEpoch,1970,'Apollo 11 star-vector epoch must remain explicit');

// The retained vector-only fallback still preserves the Apollo catalog epoch;
// phone-side pointing uses the independently sourced Hipparcos astrometry.
const historicDeneb={...deneb,astrometry:null};
const b1970=catalog.equatorialOfDate(historicDeneb,new Date('1970-01-01T00:00:00.000Z'));
assert(angularErrorArcsec(b1970,{ra:deneb.ra,dec:deneb.dec})<0.01,
  'star-vector conversion changed coordinates at the Apollo catalog epoch');

// Independent J2000 cross-check against the named star's SIMBAD ICRS/J2000
// position (catalog lookup 2026-10-04 UTC); Deneb has low proper motion.
const j2000=catalog.equatorialOfDate(deneb,new Date('2000-01-01T12:00:00.000Z'));
assert(angularErrorArcsec(j2000,{ra:310.35797975307673,dec:45.280338806527574})<10,
  'Apollo Deneb vector was not precessed from the 1970 frame into J2000');
const polaris=catalog.stars.find(star=>star.name==='POLARIS');
assert(polaris,'Comanche 055 Polaris entry missing');
const j2000Polaris=catalog.equatorialOfDate(polaris,new Date('2000-01-01T12:00:00.000Z'));
assert(angularErrorArcsec(j2000Polaris,{ra:37.954560670189856,dec:89.26410896994187})<10,
  'near-pole Polaris conversion did not retain the correct physical direction');

// Arcturus has large proper motion. This independent SIMBAD J2000 checkpoint
// catches omission or sign/axis errors in the tangent-plane propagation.
const arcturus=catalog.stars.find(star=>star.name==='ARCTURUS');
assert(arcturus,'Comanche 055 Arcturus entry missing');
const j2000Arcturus=catalog.equatorialOfDate(arcturus,new Date('2000-01-01T12:00:00.000Z'));
assert(angularErrorArcsec(j2000Arcturus,{ra:213.915300306,dec:19.182409181})<1,
  'high-proper-motion Arcturus does not match the independent J2000 position');

const modern=catalog.equatorialOfDate(deneb,new Date('2026-10-03T00:00:00.000Z'));
assert(angularErrorArcsec(modern,j2000)>600,
  'current-date star coordinates did not advance beyond J2000 precession');
const arcturusDate=new Date('2026-10-03T00:00:00.000Z');
const arcturusWithNoMotion=catalog.equatorialOfDate({...arcturus,astrometry:{...arcturus.astrometry,pmRaCosDec:0,pmDec:0}},arcturusDate);
assert(angularErrorArcsec(catalog.equatorialOfDate(arcturus,arcturusDate),arcturusWithNoMotion)>75,
  'high-proper-motion star was not advanced from the Hipparcos reference epoch');
const actual=catalog.horizontal(deneb,39.77,-86.16,new Date('2026-10-03T00:00:00.000Z'));
const expected=catalog.horizontalRaDec(modern.ra,modern.dec,39.77,-86.16,new Date('2026-10-03T00:00:00.000Z'));
assert(Math.abs(actual.alt-expected.alt)<1e-10&&Math.abs(actual.az-expected.az)<1e-10,
  'horizontal star position did not use equatorial coordinates precessed to date');

const pairDate=new Date('2026-10-03T12:00:00.000Z');
const currentPairs=catalog.candidatePairs(39.77,-86.16,pairDate,0,6).pairs;
assert(currentPairs.length>0,'current-date Apollo star-pair search returned no candidates');
function unitVector(position){
  const ra=position.ra*Math.PI/180,dec=position.dec*Math.PI/180;
  return {x:Math.cos(dec)*Math.cos(ra),y:Math.cos(dec)*Math.sin(ra),z:Math.sin(dec)};
}
for(const pair of currentPairs){
  const a=catalog.equatorialOfDate(pair.a.star,pairDate),b=catalog.equatorialOfDate(pair.b.star,pairDate);
  const expectedSeparation=catalog.angularSeparation(unitVector(a),unitVector(b));
  assert(Math.abs(pair.sep-expectedSeparation)<1e-8,
    `${pair.a.star.name}/${pair.b.star.name} pair score uses stale rather than observation-date separation`);
}
assert(currentPairs.some(pair=>pair.a.star.name==='CAPELLA'&&pair.b.star.name==='SIRIUS'),
  'proper-motion pair regression fixture changed');

console.log('Apollo star accuracy smoke: PASS');
console.log('  37 Apollo vectors retain their 1970.0 epoch; phone positions use Hipparcos ICRS astrometry, proper motion, and date precession');
console.log(`  all 37 Hipparcos paths recover their 1970 Comanche vectors within 5 arcseconds (max ${maxApolloEpochError.toFixed(2)} arcsec: ${worstApolloEpochStar})`);
console.log('  P51 candidate-pair angles use the same observation-date directions as the star finder');
