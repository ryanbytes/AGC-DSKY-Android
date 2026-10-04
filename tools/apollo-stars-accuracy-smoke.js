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
  const dot=Math.sin(dec1)*Math.sin(dec2)+Math.cos(dec1)*Math.cos(dec2)*Math.cos(ra1-ra2);
  return Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI*3600;
}

assert.strictEqual(catalog.stars.length,37,'Comanche 055 star catalog entry count changed');
for(const star of catalog.stars){
  assert.strictEqual(star.coordinateEpoch,1970,'Apollo star catalog epoch is missing or inconsistent');
  const norm=Math.hypot(star.x,star.y,star.z);
  assert(Math.abs(norm-1)<1e-8,`${star.name} AGC direction vector is not unit length`);
  const current=catalog.equatorialOfDate(star,new Date('2026-10-03T00:00:00.000Z'));
  assert(Number.isFinite(current.ra)&&Number.isFinite(current.dec)&&current.dec>=-90&&current.dec<=90,
    `${star.name} did not produce a finite observation-date direction`);
}
const deneb=catalog.stars.find(star=>star.name==='DENEB');
assert(deneb,'Comanche 055 Deneb entry missing');
assert.strictEqual(deneb.coordinateEpoch,1970,'Apollo 11 star-vector epoch must remain explicit');

const b1970=catalog.equatorialOfDate(deneb,new Date('1970-01-01T00:00:00.000Z'));
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

const modern=catalog.equatorialOfDate(deneb,new Date('2026-10-03T00:00:00.000Z'));
assert(angularErrorArcsec(modern,j2000)>600,
  'current-date star coordinates did not advance beyond J2000 precession');
const actual=catalog.horizontal(deneb,39.77,-86.16,new Date('2026-10-03T00:00:00.000Z'));
const expected=catalog.horizontalRaDec(modern.ra,modern.dec,39.77,-86.16,new Date('2026-10-03T00:00:00.000Z'));
assert(Math.abs(actual.alt-expected.alt)<1e-10&&Math.abs(actual.az-expected.az)<1e-10,
  'horizontal star position did not use equatorial coordinates precessed to date');

console.log('Apollo star accuracy smoke: PASS');
console.log('  37 Apollo vectors retain their 1970.0 epoch and are precessed into the requested observation-date frame');
