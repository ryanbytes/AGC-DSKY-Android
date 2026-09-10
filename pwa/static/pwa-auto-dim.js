(() => {
  'use strict';

  const api = window.AGCDSKYPWA = window.AGCDSKYPWA || {};
  const MODE_KEY = 'pwaAutoDimModeV1';
  const LAT_KEY = 'solarLat';
  const LON_KEY = 'solarLon';
  const LOCATION_AGE_KEY = 'pwaSolarLocationAtV1';
  const MAX_LOCATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_LUX_AGE_MS = 30000;
  const DAY_MS = 86400000;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const J0 = .0009;
  const RAD = Math.PI / 180;
  const SOLAR_FADE_HALF_MS = 30 * 60 * 1000;

  let mode = localStorage.getItem(MODE_KEY) || 'auto';
  if (!['auto','bright','dim'].includes(mode)) mode = 'auto';
  let ambientSensor = null;
  let ambientStarted = false;
  let ambientLux = NaN;
  let ambientFactor = NaN;
  let ambientAt = 0;
  let locationRequested = false;
  let lastApplied = null;

  const status = {
    mode,
    source:'waiting',
    factor:1,
    brightness:1,
    lux:null,
    ambientLight:('AmbientLightSensor' in window) ? 'available' : 'unsupported',
    geolocation:('geolocation' in navigator) ? 'available' : 'unsupported'
  };

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const smoothstep = (a,b,x) => {
    const t = clamp((x-a)/(b-a),0,1);
    return t*t*(3-2*t);
  };
  const toJulian = date => date.valueOf()/DAY_MS-.5+J1970;
  const fromJulian = j => new Date((j+.5-J1970)*DAY_MS);
  const toDays = date => toJulian(date)-J2000;
  const solarMeanAnomaly = d => RAD*(357.5291+.98560028*d);
  const eclipticLongitude = M => {
    const C=RAD*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M));
    return M+C+RAD*102.9372+Math.PI;
  };
  const declination = l => Math.asin(Math.sin(RAD*23.4397)*Math.sin(l));
  const julianCycle = (d,lw) => Math.round(d-J0-lw/(2*Math.PI));
  const approxTransit = (Ht,lw,n) => J0+(Ht+lw)/(2*Math.PI)+n;
  const solarTransitJ = (ds,M,L) => J2000+ds+.0053*Math.sin(M)-.0069*Math.sin(2*L);
  function hourAngle(h,phi,d) {
    const x=(Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d));
    return x < -1 || x > 1 ? null : Math.acos(x);
  }
  function solarTimes(date,lat,lng) {
    const lw=RAD*-lng,phi=RAD*lat,d=toDays(date),n=julianCycle(d,lw),ds=approxTransit(0,lw,n),M=solarMeanAnomaly(ds),L=eclipticLongitude(M),dec=declination(L),Jnoon=solarTransitJ(ds,M,L),w=hourAngle(RAD*-.833,phi,dec);
    if(w===null)return null;
    const a=approxTransit(w,lw,n),Jset=solarTransitJ(a,M,L),Jrise=Jnoon-(Jset-Jnoon);
    return {sunrise:fromJulian(Jrise),sunset:fromJulian(Jset)};
  }
  function solarFactor(now=new Date()) {
    const lat=parseFloat(localStorage.getItem(LAT_KEY));
    const lon=parseFloat(localStorage.getItem(LON_KEY));
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return NaN;
    const times=solarTimes(now,lat,lon);
    if(!times)return NaN;
    const half=SOLAR_FADE_HALF_MS,t=now.getTime(),rise=times.sunrise.getTime(),set=times.sunset.getTime();
    if(t<rise-half||t>set+half)return 0;
    if(t<=rise+half)return smoothstep(rise-half,rise+half,t);
    if(t<set-half)return 1;
    return 1-smoothstep(set-half,set+half,t);
  }

  // Human-perceived brightness is roughly logarithmic. 0 lx maps to the same
  // 20% minimum as the Android dream dim state; ~1000 lx reaches full output.
  function luxToFactor(lux) {
    lux = Math.max(0,Number(lux));
    if(!Number.isFinite(lux))return NaN;
    return clamp(Math.log10(lux+1)/Math.log10(1001),0,1);
  }

  function effectiveFactor() {
    if(mode==='bright')return {factor:1,source:'bright'};
    if(mode==='dim')return {factor:0,source:'dim'};
    if(Number.isFinite(ambientFactor) && Date.now()-ambientAt <= MAX_LUX_AGE_MS) {
      return {factor:ambientFactor,source:'ambient'};
    }
    const solar=solarFactor();
    if(Number.isFinite(solar))return {factor:solar,source:'solar'};
    return {factor:1,source:'waiting'};
  }

  function buttonText() {
    if(mode==='bright')return 'AUTO DIM · BRIGHT';
    if(mode==='dim')return 'AUTO DIM · DIM';
    if(status.source==='ambient' && Number.isFinite(ambientLux))return `AUTO DIM · ${Math.round(ambientLux)} LX`;
    if(status.source==='solar')return 'AUTO DIM · SUN';
    return 'AUTO DIM · WAITING';
  }

  function apply() {
    const panel=document.getElementById('dsky');
    if(!panel)return;
    const selected=effectiveFactor();
    const factor=clamp(selected.factor,0,1);
    const visual=.20+.80*factor;
    status.mode=mode;
    status.source=selected.source;
    status.factor=factor;
    status.brightness=visual;
    status.lux=Number.isFinite(ambientLux)?ambientLux:null;
    panel.style.setProperty('filter',`brightness(${visual.toFixed(3)})`,'important');
    const button=document.getElementById('dreambright');
    if(button)button.textContent=buttonText();
    if(lastApplied!==`${mode}:${selected.source}:${visual.toFixed(3)}`) {
      lastApplied=`${mode}:${selected.source}:${visual.toFixed(3)}`;
      try{window.dispatchEvent(new CustomEvent('agcdsky-pwa-auto-dim',{detail:{...status}}))}catch(_){}
    }
  }

  function ingestLux(lux) {
    const raw=Number(lux);
    if(!Number.isFinite(raw)||raw<0)return;
    ambientLux=raw;
    const next=luxToFactor(raw);
    ambientFactor=Number.isFinite(ambientFactor)?ambientFactor*.72+next*.28:next;
    ambientAt=Date.now();
    status.ambientLight='active';
    apply();
  }

  function startAmbientSensor() {
    if(ambientStarted||!('AmbientLightSensor' in window))return;
    ambientStarted=true;
    try {
      ambientSensor=new window.AmbientLightSensor({frequency:1});
      ambientSensor.addEventListener('reading',()=>ingestLux(ambientSensor.illuminance));
      ambientSensor.addEventListener('error',event=>{
        status.ambientLight='error';
        status.ambientLightError=String(event?.error?.name||event?.error||'sensor error');
        apply();
      });
      ambientSensor.start();
      status.ambientLight='starting';
    } catch(error) {
      status.ambientLight='error';
      status.ambientLightError=String(error&&error.name?error.name:error);
    }
    apply();
  }

  function requestSolarLocation(force=false) {
    if(!navigator.geolocation||locationRequested)return;
    const savedAt=Number(localStorage.getItem(LOCATION_AGE_KEY)||0);
    const have=Number.isFinite(parseFloat(localStorage.getItem(LAT_KEY)))&&Number.isFinite(parseFloat(localStorage.getItem(LON_KEY)));
    if(!force&&have&&savedAt&&Date.now()-savedAt<MAX_LOCATION_AGE_MS){status.geolocation='cached';apply();return;}
    locationRequested=true;
    status.geolocation='requesting';
    navigator.geolocation.getCurrentPosition(position=>{
      localStorage.setItem(LAT_KEY,String(position.coords.latitude));
      localStorage.setItem(LON_KEY,String(position.coords.longitude));
      localStorage.setItem(LOCATION_AGE_KEY,String(Date.now()));
      status.geolocation='active';
      locationRequested=false;
      apply();
    },error=>{
      status.geolocation='denied';
      status.geolocationError=String(error&&error.message?error.message:'location unavailable');
      locationRequested=false;
      apply();
    },{enableHighAccuracy:false,maximumAge:MAX_LOCATION_AGE_MS,timeout:12000});
  }

  function setMode(next) {
    if(!['auto','bright','dim'].includes(next))return false;
    mode=next;
    localStorage.setItem(MODE_KEY,mode);
    if(mode==='auto'){
      startAmbientSensor();
      requestSolarLocation(false);
    }
    apply();
    return true;
  }

  function cycleMode(event) {
    if(event){event.preventDefault();event.stopImmediatePropagation();}
    setMode(mode==='auto'?'bright':mode==='bright'?'dim':'auto');
  }

  const button=document.getElementById('dreambright');
  if(button)button.addEventListener('click',cycleMode,true);
  document.addEventListener('click',event=>{
    // The shared PANEL DIMMER can clear the inline filter; restore the selected
    // PWA auto-brightness on the same event turn without changing its own state.
    if(event.target&&event.target.id==='dim')queueMicrotask(apply);
  });

  function completedGesture() {
    if(mode!=='auto')return;
    startAmbientSensor();
    requestSolarLocation(false);
  }
  for(const eventName of ['pointerup','touchend','click']) {
    document.addEventListener(eventName,completedGesture,{capture:true,passive:true,once:true});
  }

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&mode==='auto'){
      startAmbientSensor();
      requestSolarLocation(false);
      apply();
    }
  },{passive:true});

  api.autoDimStatus=()=>({...status});
  api.setAutoDimMode=setMode;
  api.ingestAmbientLux=ingestLux;
  api.solarDimFactor=()=>solarFactor();
  api.luxDimFactor=luxToFactor;

  if(mode==='auto'){
    startAmbientSensor();
    requestSolarLocation(false);
  }
  apply();
  setInterval(apply,15000);
})();
