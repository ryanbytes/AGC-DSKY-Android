#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/geomagnetic-model.js'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
let publishedName=null,service=null;
const window={AGCDSKY_SERVICE_REGISTRY:{publish(name,value){publishedName=name;service=value}}};
const context={window,Math,Date,Number,Object,Array,String};
vm.createContext(context);
vm.runInContext(source,context,{filename:'geomagnetic-model.js'});
assert(publishedName==='AGCDSKY_WMM2025','WMM implementation must publish through the explicit service registry');
assert(Object.isFrozen(service),'published WMM service must be immutable');

function instant(decimalYear){
  const year=Math.floor(decimalYear),start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1);
  return new Date(start+(decimalYear-year)*(end-start));
}
function vector(label,year,altitudeMeters,lat,lon,declination,horizontal,toleranceDeg=.01){
  const result=service.field(lat,lon,altitudeMeters,instant(year));
  assert(result,`${label}: valid NOAA test point returned no field`);
  assert(Math.abs(result.declinationDeg-declination)<=toleranceDeg,
    `${label}: declination ${result.declinationDeg}° differs from NOAA ${declination}°`);
  if(horizontal!==null)assert(Math.abs(result.horizontalIntensityNt-horizontal)<=2,
    `${label}: horizontal intensity ${result.horizontalIntensityNt} nT differs from NOAA ${horizontal} nT`);
  return result;
}

// NOAA NCEI WMM2025 TEST_VALUES, rounded to the published 0.01° / 0.1 nT.
vector('2025.0 80N 0E',2025,0,80,0,1.28,6523.2);
vector('2025.0 equator 120E',2025,0,0,120,-.16,39677.9);
vector('2025.0 80S 120W',2025,0,-80,-120,68.78,16898.1);
vector('2025.0 100 km 80N 0E',2025,100000,80,0,.85,6216.7);
vector('2026.5 1042 m 70.3N 30.8E',2026.5,1042,70.3,30.8,17+58/60,10229.6,.01);

const indianapolis=vector('Indianapolis 2026.75566',2026.75566,250,39.77,-86.16,-5.0254,20419.4,.001);
assert(!indianapolis.blackout&&!indianapolis.caution,'Indianapolis should be outside WMM compass warning zones');
assert(Math.abs(indianapolis.uncertaintyDeg-Math.sqrt(.26**2+(5417/indianapolis.horizontalIntensityNt)**2))<1e-12,
  'declination uncertainty must follow the published WMM2025 error formula');

const caution=service.field(80,-110,250,instant(2026.75));
assert(caution&&caution.caution&&!caution.blackout,'WMM caution-zone horizontal field classification changed');
const blackout=service.field(80,110,250,instant(2026.75));
assert(blackout&&blackout.blackout&&blackout.caution,'WMM blackout-zone horizontal field classification changed');
for(const args of [
  [90,0,0,instant(2026.5)],[-90,0,0,instant(2026.5)],[0,181,0,instant(2026.5)],
  [91,0,0,instant(2026.5)],[0,0,0,instant(2024.999)],[0,0,0,instant(2030)],
  [0,0,NaN,instant(2026.5)],[NaN,0,0,instant(2026.5)]
])assert(service.field(...args)===null,`unsupported WMM input was accepted: ${args.map(String).join(', ')}`);

assert(Math.abs(service.decimalYear(instant(2026.5))-2026.5)<1e-9,'UTC decimal-year conversion changed');
console.log('WMM2025 smoke: PASS');
console.log('  NOAA test vectors, secular variation, altitude, uncertainty, date limits, and caution/blackout classification verified');
