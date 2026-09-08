'use strict';

/*
 * Apollo CM sextant camera proxy.
 *
 * The camera is only the user's visual scene. Optical shaft/trunnion motion is
 * injected through the actual Comanche CDU counters (CDUS=036, CDUT=035), and
 * MARK / MARK REJECT use navigation-keyboard channel 016 + KEYRUPT2. Nothing
 * here writes nouns, display fields, or AGC guidance state directly.
 */
(() => {
  const api = window.AGCDSKY = window.AGCDSKY || {};
  const COUNTS_PER_REV = 32768;
  const COUNTS_PER_DEG = COUNTS_PER_REV / 360;
  const SHAFT_CH = 0o200 | 0o36;
  const TRUNNION_CH = 0o200 | 0o35;
  const PCDU = 0o01;
  const MCDU = 0o03;
  const MARK_BIT = 0o40;       // channel 016 bit 6
  const REJECT_BIT = 0o100;    // channel 016 bit 7
  const SXT_FOV_DEG = 1.8;     // Block II sextant field of view.
  const MAX_PULSES_PER_PUMP = 8;
  let opticsWriteRejected=0,lastOpticsAccept=0;

  let stream = null;
  let track = null;
  let pending = [0, 0]; // shaft, trunnion counts
  let fraction = [0, 0];
  let lastPhoneAngles = null;
  let cameraZoom = 1;
  let readoutTimer = 0;
  let aimScale = 1;
  let finderEnabled = false;
  let skyLocation = null;
  let selectedStar = null;
  let selectedPair = null;
  let pairCandidates = [];
  let pairIndex = 0;
  let pairMeta = null;
  let pairComputedAt = 0;
  const CENTER_TOL_DEG = 0.08;

  function core(){ return typeof api.getCore === 'function' ? api.getCore() : null; }

  function buildUi(){
    if (document.getElementById('sxt-view')) return;
    const wrap = document.createElement('div');
    wrap.id = 'sxt-view';
    wrap.innerHTML = `
      <div id="sxt-status">SXT · CAMERA OFF</div>
      <div id="sxt-eyepiece" aria-label="Apollo CM sextant camera view">
        <video id="sxt-video" playsinline muted></video>
        <svg id="sxt-reticle" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="field" cx="50" cy="50" r="49.1"/>
          <!-- Flight/vacuum SXT pattern: R line and perpendicular M line. -->
          <line class="ret" x1="50" y1="8" x2="50" y2="92"/>
          <line class="ret" x1="8" y1="50" x2="92" y2="50"/>
          <!-- The M-line runs through the two reference hash marks. -->
          <line class="ret fine" x1="34" y1="47.4" x2="34" y2="52.6"/>
          <line class="ret fine" x1="66" y1="47.4" x2="66" y2="52.6"/>
          <circle class="ret fine" cx="50" cy="50" r="0.72"/>
        </svg>
        <div id="sxt-star-cue" aria-hidden="true"><span>✦</span></div>
      </div>
      <div id="sxt-ui">
        <button id="sxt-close">DSKY</button>
        <button id="sxt-mark" class="mark">MARK</button>
        <button id="sxt-reject" class="reject">MARK REJECT</button>
        <button id="sxt-center">SIGHT ZERO</button>
        <button id="sxt-aim-scale">AIM SCALE 1:1</button>
        <button id="sxt-star-toggle">STAR FINDER OFF</button>
        <button id="sxt-calibrate">CALIBRATE POINTING ON STAR</button>
        <button id="sxt-cal-clear">CLEAR POINTING CALIBRATION</button>
        <span id="sxt-readout">SHAFT ---<br>TRUNNION ---</span>
        <label>RET <input id="sxt-reticle-bright" type="range" min="5" max="100" value="90"></label>
      </div>
      <div id="sxt-starbox" aria-live="polite">
        <div class="sxt-star-title">PHONE-SIDE STAR FINDER · AGC INPUT UNCHANGED</div>
        <div id="sxt-star-location">LOCATION WAITING</div>
        <div id="sxt-star-pair">PAIR WAITING</div>
        <div id="sxt-star-conditions"></div>
        <div id="sxt-star-buttons"></div>
        <div id="sxt-star-cal">POINTING CALIBRATION: NONE</div>
        <div id="sxt-star-target">SELECT A STAR</div>
        <div class="sxt-arrow-wrap"><span id="sxt-star-arrow">↑</span><span id="sxt-star-error">POINTING WAITING</span></div>
        <div id="sxt-star-command"></div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('sxt-close').addEventListener('click', close);
    document.getElementById('sxt-mark').addEventListener('click', () => navPulse(MARK_BIT));
    document.getElementById('sxt-reject').addEventListener('click', () => navPulse(REJECT_BIT));
    document.getElementById('sxt-center').addEventListener('click', zeroSight);
    document.getElementById('sxt-aim-scale').addEventListener('click', cycleAimScale);
    document.getElementById('sxt-star-toggle').addEventListener('click', toggleStarFinder);
    document.getElementById('sxt-calibrate').addEventListener('click', calibratePointing);
    document.getElementById('sxt-cal-clear').addEventListener('click', clearPointingCalibration);
    document.getElementById('sxt-reticle-bright').addEventListener('input', e => {
      wrap.style.setProperty('--reticle-opacity', String(Math.max(.05, Number(e.target.value)/100)));
    });
  }

  async function open(){
    buildUi();
    const view = document.getElementById('sxt-view');
    view.classList.add('open');
    lastPhoneAngles = null;
    if (typeof api.setOpticsCaptureActive === 'function') api.setOpticsCaptureActive(true);
    requestSkyLocation();
    updateReadout();
    // Keep the pointing display alive independently of camera permission or
    // camera startup. The star cue is phone-sensor driven, not video driven.
    if (!readoutTimer) readoutTimer = setInterval(updateReadout, 100);
    document.getElementById('sxt-status').textContent = 'SXT · REQUESTING CAMERA';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      document.getElementById('sxt-status').textContent = 'SXT · CAMERA UNAVAILABLE';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}
      });
      const video = document.getElementById('sxt-video');
      video.srcObject = stream;
      await video.play();
      track = stream.getVideoTracks()[0] || null;
      document.getElementById('sxt-status').textContent = 'SXT · MOVE PHONE TO AIM · 1.8°';
      configureCameraZoom();
      updateReadout();
    } catch (err) {
      document.getElementById('sxt-status').textContent = 'SXT · CAMERA DENIED';
      console.error('SXT camera', err);
    }
  }

  function close(){
    const view = document.getElementById('sxt-view');
    if (view) view.classList.remove('open');
    if (stream) for (const t of stream.getTracks()) t.stop();
    stream = null; track = null;
    const video = document.getElementById('sxt-video');
    if (video) video.srcObject = null;
    if (readoutTimer) { clearInterval(readoutTimer); readoutTimer = 0; }
    lastPhoneAngles = null;
    if (typeof api.setOpticsCaptureActive === 'function') api.setOpticsCaptureActive(false);
  }

  function configureCameraZoom(){
    cameraZoom = 1;
    if (!track || typeof track.getCapabilities !== 'function') { applyCameraTransform(); return; }
    try {
      const caps = track.getCapabilities();
      if (caps && caps.zoom && Number.isFinite(caps.zoom.max)) {
        // Use optical/device zoom when available, but never fabricate a 28x
        // claim when the phone cannot provide it.
        const z = Math.min(caps.zoom.max, Math.max(caps.zoom.min || 1, 4));
        track.applyConstraints({advanced:[{zoom:z}]}).catch(()=>{});
      } else {
        // Mild crop keeps the reticle usable without pretending the phone has
        // the SXT's 28-power optics.
        cameraZoom = 1.8;
      }
    } catch (_) {}
    applyCameraTransform();
  }

  const wrap180 = a => ((a + 180) % 360 + 360) % 360 - 180;

  function applyCameraTransform(){
    const video = document.getElementById('sxt-video');
    if (!video) return;
    video.style.setProperty('--pan-x', '0px');
    video.style.setProperty('--pan-y', '0px');
    video.style.setProperty('--cam-zoom', String(cameraZoom));
  }

  function cycleAimScale(){
    aimScale = aimScale === 1 ? .25 : (aimScale === .25 ? .10 : 1);
    const b=document.getElementById('sxt-aim-scale');
    if(b)b.textContent=aimScale===1?'AIM SCALE 1:1':('FINE AIM '+aimScale.toFixed(2)+'×');
    lastPhoneAngles=null;
  }

  function setSkyLocation(lat,lon,alt=0,accuracy=NaN){
    lat=Number(lat);lon=Number(lon);alt=Number(alt);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return false;
    skyLocation={lat,lon,alt:Number.isFinite(alt)?alt:0,accuracy:Number(accuracy),timestamp:Date.now()};
    try{localStorage.setItem('sxtSkyLocation',JSON.stringify(skyLocation))}catch(_){ }
    try{if(window.SkyBridge&&typeof SkyBridge.setLocation==='function')SkyBridge.setLocation(lat,lon,skyLocation.alt)}catch(_){ }
    selectedPair=null;pairCandidates=[];pairIndex=0;pairMeta=null;pairComputedAt=0;updateStarFinder();return true;
  }

  function requestSkyLocation(){
    try{const c=JSON.parse(localStorage.getItem('sxtSkyLocation')||'null');if(c)setSkyLocation(c.lat,c.lon,c.alt,c.accuracy)}catch(_){ }
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(p=>setSkyLocation(p.coords.latitude,p.coords.longitude,p.coords.altitude||0,p.coords.accuracy),()=>updateStarFinder(),{enableHighAccuracy:true,maximumAge:300000,timeout:12000});
  }

  function toggleStarFinder(){
    finderEnabled=!finderEnabled;
    const box=document.getElementById('sxt-starbox'),b=document.getElementById('sxt-star-toggle');
    if(box)box.classList.toggle('visible',finderEnabled);
    if(b)b.textContent=finderEnabled?'STAR FINDER ON':'STAR FINDER OFF';
    if(finderEnabled){requestSkyLocation();updateStarFinder()}
  }

  function chooseStar(star){selectedStar=star;updateStarFinder()}

  function computePair(){
    const cat=window.AGCDSKY_APOLLO_STARS;if(!cat||!skyLocation)return null;
    const now=Date.now();
    if(selectedPair&&now-pairComputedAt<5000)return selectedPair;
    pairMeta=typeof cat.candidatePairs==='function'?cat.candidatePairs(skyLocation.lat,skyLocation.lon,new Date(),12,6):null;
    pairCandidates=pairMeta?.pairs||[];
    if(pairIndex>=pairCandidates.length)pairIndex=0;
    selectedPair=pairCandidates[pairIndex]||cat.bestPair(skyLocation.lat,skyLocation.lon,new Date(),12);pairComputedAt=now;
    if(selectedPair&&(!selectedStar||![selectedPair.a.star,selectedPair.b.star].includes(selectedStar)))selectedStar=selectedPair.a.star;
    return selectedPair;
  }

  function cyclePair(){
    if(!pairCandidates.length)return;
    pairIndex=(pairIndex+1)%pairCandidates.length;selectedPair=pairCandidates[pairIndex];selectedStar=selectedPair.a.star;pairComputedAt=Date.now();updateStarFinder();
  }

  function currentTargetPosition(){
    const cat=window.AGCDSKY_APOLLO_STARS;if(!cat||!skyLocation||!selectedStar)return null;
    return cat.horizontal(selectedStar,skyLocation.lat,skyLocation.lon,new Date());
  }

  function calibratePointing(){
    const pos=currentTargetPosition(),st=document.getElementById('sxt-status');
    if(!pos||!selectedStar){if(st)st.textContent='SXT · SELECT STAR FIRST';return}
    if(typeof api.calibrateSkyBoresight!=='function'){if(st)st.textContent='SXT · POINTING CAL UNAVAILABLE';return}
    const r=api.calibrateSkyBoresight(pos.az,pos.alt,`${selectedStar.code} ${selectedStar.name}`);
    if(st)st.textContent=r&&r.ok?'SXT · POINTING CALIBRATED':'SXT · '+String(r?.error||'CALIBRATION FAILED');
    updateStarFinder();
  }
  function clearPointingCalibration(){
    if(typeof api.clearSkyBoresightCalibration==='function')api.clearSkyBoresightCalibration();
    const st=document.getElementById('sxt-status');if(st)st.textContent='SXT · POINTING CALIBRATION CLEARED';updateStarFinder();
  }

  function updateStarFinder(){
    const box=document.getElementById('sxt-starbox');if(!box)return;
    box.classList.toggle('visible',finderEnabled);if(!finderEnabled)return;
    const loc=document.getElementById('sxt-star-location'),pairEl=document.getElementById('sxt-star-pair'),cond=document.getElementById('sxt-star-conditions'),buttons=document.getElementById('sxt-star-buttons');
    const targ=document.getElementById('sxt-star-target'),err=document.getElementById('sxt-star-error'),arrow=document.getElementById('sxt-star-arrow'),cmd=document.getElementById('sxt-star-command'),cal=document.getElementById('sxt-star-cal');
    const cat=window.AGCDSKY_APOLLO_STARS;
    if(!cat){loc.textContent='STAR CATALOG UNAVAILABLE';return}
    const cs=typeof api.skyCalibrationStatus==='function'?api.skyCalibrationStatus():null;
    if(cal){
      if(cs?.calibrated){const when=cs.calibration?.timestamp?new Date(cs.calibration.timestamp).toLocaleTimeString():'';cal.textContent=`POINTING CALIBRATED · ${cs.calibration?.label||'STAR'}${when?' · '+when:''}`}
      else cal.textContent='POINTING CALIBRATION: NONE · CENTER A KNOWN STAR VISUALLY, THEN CALIBRATE';
    }
    if(!skyLocation){loc.textContent='LOCATION REQUIRED · ALLOW LOCATION';pairEl.textContent='PAIR WAITING';if(cond)cond.textContent='';buttons.innerHTML='';return}
    const ac=Number.isFinite(skyLocation.accuracy)?(' ±'+Math.round(skyLocation.accuracy)+' m'):'';
    const age=Math.max(0,Date.now()-(skyLocation.timestamp||0));
    loc.textContent=`${skyLocation.lat.toFixed(4)}°, ${skyLocation.lon.toFixed(4)}°${ac} · LOCATION ${Math.round(age/1000)} s OLD`;
    const pair=computePair();
    if(!pair){pairEl.textContent='NO 40–66° APOLLO PAIR ABOVE 12°';if(cond&&pairMeta?.conditions)cond.textContent=`${pairMeta.conditions.label} · SUN ${pairMeta.conditions.sunAlt.toFixed(1)}°`;buttons.innerHTML='';return}
    const meta=pairMeta,conditions=meta?.conditions||pair.conditions;
    pairEl.textContent=`P51 PAIR ${pairIndex+1}/${Math.max(1,pairCandidates.length)} · ${pair.a.star.code} ${pair.a.star.name} / ${pair.b.star.code} ${pair.b.star.name} · ${pair.sep.toFixed(1)}°`;
    if(cond&&conditions)cond.textContent=`${conditions.label} · SUN ${conditions.sunAlt.toFixed(1)}° · ${meta?.strict===false?'GEOMETRIC FALLBACK':'LIKELY VISIBLE'} · ${meta?.visibleCount??'--'} CATALOG STARS ABOVE THRESHOLD`;
    buttons.innerHTML='';
    for(const x of [pair.a,pair.b]){const b=document.createElement('button');b.type='button';b.textContent=`${x.star.code} ${x.star.name}`;b.className=selectedStar===x.star?'selected':'';b.onclick=()=>chooseStar(x.star);buttons.appendChild(b)}
    if(pairCandidates.length>1){const nb=document.createElement('button');nb.type='button';nb.textContent='NEXT STAR PAIR';nb.onclick=cyclePair;buttons.appendChild(nb)}
    if(!selectedStar)selectedStar=pair.a.star;
    const targetPos=cat.horizontal(selectedStar,skyLocation.lat,skyLocation.lon,new Date());
    targ.textContent=`TARGET ${selectedStar.code} ${selectedStar.name} · MAG ${selectedStar.mag.toFixed(2)} · AZ ${targetPos.az.toFixed(1)}° · ALT ${targetPos.alt.toFixed(1)}°`;
    cmd.textContent=`AFTER MARK: V21 N71 E 000${selectedStar.code} E`;
    const cue=document.getElementById('sxt-star-cue');
    const pointing=typeof api.phoneSkyPointing==='function'?api.phoneSkyPointing():null;
    if(!pointing||!pointing.seen||Date.now()-(pointing.timestamp||0)>1500){
      err.textContent='PHONE TRUE POINTING WAITING';arrow.style.transform='rotate(0deg)';
      if(cue){cue.classList.remove('active','outside','centered');cue.style.removeProperty('--cue-x');cue.style.removeProperty('--cue-y')}
      return
    }
    const projected=typeof api.projectSkyTarget==='function'?api.projectSkyTarget(targetPos.az,targetPos.alt):null;
    const d=projected?{distance:projected.distance,angle:projected.screenAngle}:cat.bearingDelta(pointing,targetPos);
    arrow.style.transform=`rotate(${d.angle.toFixed(1)}deg)`;
    // Project into the 1.8-degree eyepiece. Outside targets clamp to the rim.
    if(cue){
      const eye=document.getElementById('sxt-eyepiece');
      const radius=Math.max(20,Math.min(eye?.clientWidth||200,eye?.clientHeight||200)*.43);
      const edge=SXT_FOV_DEG/2,rr=Math.min(radius,radius*(d.distance/edge)),aa=d.angle*Math.PI/180;
      cue.style.setProperty('--cue-x',(Math.sin(aa)*rr).toFixed(1)+'px');
      cue.style.setProperty('--cue-y',(-Math.cos(aa)*rr).toFixed(1)+'px');
      cue.classList.add('active');cue.classList.toggle('outside',d.distance>edge);cue.classList.toggle('centered',d.distance<=CENTER_TOL_DEG);
    }
    const src=pointing.source?` · ${String(pointing.source).toUpperCase()}`:'';
    err.textContent=d.distance<=CENTER_TOL_DEG
      ?`CENTERED · ${d.distance.toFixed(3)}°${src}`
      :(d.distance<=SXT_FOV_DEG/2
        ?`IN FIELD · ${d.distance.toFixed(2)}°${src}`
        :`MOVE ${d.distance.toFixed(1)}° · PHONE AZ ${pointing.az.toFixed(1)} ALT ${pointing.alt.toFixed(1)}${src}`);
  }

  function zeroSight(){
    lastPhoneAngles = null;
    const ok = typeof api.zeroOpticsCapture === 'function' && api.zeroOpticsCapture();
    const st = document.getElementById('sxt-status');
    if (st) st.textContent = ok ? 'SXT · SIGHT ZERO' : 'SXT · IMU WAIT';
    if (ok) setTimeout(()=>{
      if(st && document.getElementById('sxt-view')?.classList.contains('open'))
        st.textContent='SXT · MOVE PHONE TO AIM · 1.8°';
    },500);
  }

  function updateFromPhone(){
    if (typeof api.phoneOpticsAngles !== 'function') return;
    const a = api.phoneOpticsAngles();
    if (!a || !a.active || !a.sensorSeen || ![a.roll,a.pitch,a.yaw].every(Number.isFinite)) {
      lastPhoneAngles = null;
      return;
    }

    // With the rear camera aimed forward, turning the handset left/right is
    // principally rotation about the screen Y axis; tilting it up/down is
    // rotation about screen X.  Map those motions to SXT shaft/trunnion.
    const current = [a.pitch, -a.roll];
    if (!lastPhoneAngles) { lastPhoneAngles = current; return; }
    const dShaft = wrap180(current[0] - lastPhoneAngles[0]);
    const dTrunnion = wrap180(current[1] - lastPhoneAngles[1]);
    lastPhoneAngles = current;
    if (Math.abs(dShaft) < 25 && Math.abs(dTrunnion) < 25)
      addOpticsDegrees(dShaft*aimScale, dTrunnion*aimScale);
  }

  function addOpticsDegrees(shaftDeg, trunnionDeg){
    const vals=[shaftDeg,trunnionDeg];
    for(let i=0;i<2;i++){
      fraction[i] += vals[i] * COUNTS_PER_DEG;
      const whole = fraction[i] < 0 ? Math.ceil(fraction[i]) : Math.floor(fraction[i]);
      if (whole) { pending[i]+=whole; fraction[i]-=whole; }
    }
  }

  function pump(){
    updateFromPhone();
    const c=core();
    if(!c || !c.running) return;
    const ch=[SHAFT_CH,TRUNNION_CH];
    for(let axis=0;axis<2;axis++){
      const left=pending[axis]|0;
      if(!left) continue;
      const sign=left>0?1:-1;
      const n=Math.min(Math.abs(left),MAX_PULSES_PER_PUMP);
      for(let i=0;i<n;i++){
        const rc=c.writeIo(ch[axis],sign>0?PCDU:MCDU);
        if(!(rc>0)){opticsWriteRejected++;break}
        lastOpticsAccept=Date.now();
        pending[axis]-=sign;
      }
    }
  }

  function navPulse(bit){
    const c=core();
    if(!c || !c.running || typeof c.navKeyPulse!=='function') {
      const st=document.getElementById('sxt-status'); if(st) st.textContent='SXT · AGC NOT RUNNING';
      return;
    }
    const ok=c.navKeyPulse(bit,90);
    const st=document.getElementById('sxt-status');
    if(st) st.textContent=ok?(bit===MARK_BIT?'SXT · MARK':'SXT · MARK REJECT'):'SXT · INPUT BUSY';
    if(ok){if(typeof api.scheduleAgcAutosave==='function')api.scheduleAgcAutosave(bit===MARK_BIT?'SXT MARK':'SXT MARK REJECT');setTimeout(()=>{if(st&&document.getElementById('sxt-view')?.classList.contains('open'))st.textContent='SXT · MOVE PHONE TO AIM · 1.8°';},500)}
  }

  function cduDegrees(word){ return ((word & 0x7fff) * 360 / COUNTS_PER_REV + 360) % 360; }
  function updateReadout(){
    const el=document.getElementById('sxt-readout'); if(!el) return;
    const c=core();
    if(!c || typeof c.readErasable!=='function'){el.innerHTML='SHAFT ---<br>TRUNNION ---';return;}
    const shaft=c.readErasable(0,0o36), trun=c.readErasable(0,0o35);
    if(shaft==null||trun==null){el.innerHTML='SHAFT ---<br>TRUNNION ---';return;}
    el.innerHTML=`SHAFT ${cduDegrees(shaft).toFixed(2)}°<br>TRUNNION ${cduDegrees(trun).toFixed(2)}°`;
    updateStarFinder();
  }

  addEventListener('agcdsky-skypointing',()=>{
    if(finderEnabled && document.getElementById('sxt-view')?.classList.contains('open')) updateStarFinder();
  });

  addEventListener('DOMContentLoaded',()=>{
    buildUi();
    const b=document.getElementById('sxt');
    if(b) b.addEventListener('click',()=>{open(); if(typeof window.showControls==='function') window.showControls();});
  });
  setInterval(pump,4);

  api.openSextant = open;
  api.closeSextant = close;
  api.sextantStatus = () => ({open:document.getElementById('sxt-view')?.classList.contains('open')||false,pending:{shaft:pending[0],trunnion:pending[1]},camera:!!stream,aimScale,finderEnabled,location:skyLocation,target:selectedStar?{code:selectedStar.code,name:selectedStar.name,mag:selectedStar.mag}:null,pair:selectedPair?{a:selectedPair.a.star.code,b:selectedPair.b.star.code,sep:selectedPair.sep,index:pairIndex,count:pairCandidates.length}:null,pointingCalibration:typeof api.skyCalibrationStatus==='function'?api.skyCalibrationStatus():null,health:{writeRejected:opticsWriteRejected,lastAccept:lastOpticsAccept}});
})();
