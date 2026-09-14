'use strict';

// Display-environment state shared by interactive and DreamService modes.
// The AGC loader/decoder/snapshot model deliberately does not live here.
let tickLevel=1,solarFactor=0;
const DAY_MS=86400000,J1970=2440588,J2000=2451545,J0=.0009,RAD=Math.PI/180,SOLAR_FADE_HALF_MS=30*60*1000;
function toJulian(date){return date.valueOf()/DAY_MS-.5+J1970}
function fromJulian(j){return new Date((j+.5-J1970)*DAY_MS)}
function toDays(date){return toJulian(date)-J2000}
function solarMeanAnomaly(d){return RAD*(357.5291+.98560028*d)}
function eclipticLongitude(M){const C=RAD*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M)),P=RAD*102.9372;return M+C+P+Math.PI}
function declination(l){const e=RAD*23.4397;return Math.asin(Math.sin(e)*Math.sin(l))}
function julianCycle(d,lw){return Math.round(d-J0-lw/(2*Math.PI))}
function approxTransit(Ht,lw,n){return J0+(Ht+lw)/(2*Math.PI)+n}
function solarTransitJ(ds,M,L){return J2000+ds+.0053*Math.sin(M)-.0069*Math.sin(2*L)}
function hourAngle(h,phi,d){const x=(Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d));if(x<-1||x>1)return null;return Math.acos(x)}
function solarTimes(date,lat,lng){
  const lw=RAD*-lng,phi=RAD*lat,d=toDays(date),n=julianCycle(d,lw),ds=approxTransit(0,lw,n),M=solarMeanAnomaly(ds),L=eclipticLongitude(M),dec=declination(L),Jnoon=solarTransitJ(ds,M,L),w=hourAngle(RAD*-.833,phi,dec);
  if(w===null)return null;
  const a=approxTransit(w,lw,n),Jset=solarTransitJ(a,M,L),Jrise=Jnoon-(Jset-Jnoon);
  return {sunrise:fromJulian(Jrise),sunset:fromJulian(Jset)};
}
function smoothstep(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
function currentSolarFactor(){
  const lat=parseFloat(store.get('solarLat')),lon=parseFloat(store.get('solarLon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return 0;
  const now=typeof accurateDate==='function'?accurateDate():new Date(),times=solarTimes(now,lat,lon);
  if(!times)return 0;
  const half=SOLAR_FADE_HALF_MS,t=now.getTime(),rise=times.sunrise.getTime(),set=times.sunset.getTime();
  if(t<rise-half||t>set+half)return 0;
  if(t<=rise+half)return smoothstep(rise-half,rise+half,t);
  if(t<set-half)return 1;
  return 1-smoothstep(set-half,set+half,t);
}
function requestSolarLocation(){
  if(!navigator.geolocation){$('mode').textContent='SOLAR LOCATION UNAVAILABLE';dreamMode='dim';applyDreamMode();return}
  $('mode').textContent='REQUESTING LOCAL SOLAR POSITION';
  navigator.geolocation.getCurrentPosition(p=>{
    store.set('solarLat',String(p.coords.latitude));store.set('solarLon',String(p.coords.longitude));
    dreamMode='solar';applyDreamMode();$('mode').textContent='SUN AUTO · 60 MIN SUNRISE/SUNSET FADE';
  },()=>{
    dreamMode='dim';applyDreamMode();$('mode').textContent='SOLAR NEEDS LOCATION PERMISSION';
  },{enableHighAccuracy:false,maximumAge:2592000000,timeout:12000});
}
function applyDim(){
  if(!dream){document.body.classList.toggle('dim',dim);$('dsky').style.filter='';store.set('dim',dim?'1':'0')}
}
function setDreamWindowBrightness(v){try{if(window.DreamBridge&&DreamBridge.setBrightness)DreamBridge.setBrightness(v)}catch(e){}}
function updateDreamEnvironment(){
  if(!dream){tickLevel=1;return}
  if(dreamMode==='bright')solarFactor=1;
  else if(dreamMode==='solar')solarFactor=currentSolarFactor();
  else solarFactor=0;
  const visual=.20+.80*solarFactor,sat=.62+.38*solarFactor;
  $('dsky').style.filter=`brightness(${visual.toFixed(3)}) saturate(${sat.toFixed(3)})`;
  tickLevel=.08+.92*solarFactor;
  setDreamWindowBrightness(.05+.80*solarFactor);
}
function applyDreamMode(){
  store.set('dreamMode',dreamMode);store.set('dreamBright',dreamMode==='bright'?'1':'0');
  const b=$('dreambright');if(b)b.textContent=dreamMode==='solar'?'DREAM BRIGHTNESS AUTO':'DREAM BRIGHTNESS '+dreamMode.toUpperCase();
  if(dream)updateDreamEnvironment();
}
function cycleDreamMode(){
  if(dreamMode==='dim'){dreamMode='bright';applyDreamMode()}
  else if(dreamMode==='bright'){
    const have=Number.isFinite(parseFloat(store.get('solarLat')))&&Number.isFinite(parseFloat(store.get('solarLon')));
    if(have){dreamMode='solar';applyDreamMode();$('mode').textContent='SUN AUTO · 60 MIN SUNRISE/SUNSET FADE'}else requestSolarLocation();
  }else{dreamMode='dim';applyDreamMode()}
}
function applyDisplayOnly(){document.body.classList.toggle('display-only',displayOnly);if(!dream)store.set('displayOnly',displayOnly?'1':'0');const b=$('display');if(b)b.textContent=displayOnly?'EXIT FULL DSKY DISPLAY':'FULL DSKY DISPLAY'}
