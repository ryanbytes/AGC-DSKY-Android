'use strict';
(() => {
  const api=window.AGCDSKY=window.AGCDSKY||{};
  let timer=0,pipaTest=null,pipaTestTimer=0;
  const oct=(v,n=5)=>v==null?'-----':((Number(v)>>>0)&0x7fff).toString(8).padStart(n,'0');
  const cduDeg=v=>v==null?NaN:((v&0x7fff)*360/32768+360)%360;
  const s15=v=>{if(v==null)return null;v&=0x7fff;return (v&0x4000)?-((~v)&0x7fff):v};
  const f=(v,d=3)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'---';
  function build(){
    if(document.getElementById('diag-view'))return;
    const el=document.createElement('section');el.id='diag-view';el.setAttribute('aria-label','AGC diagnostics');
    el.innerHTML=`<div id="diag-head"><strong>NON-FLIGHT DIAGNOSTICS</strong><button id="diag-close">CLOSE</button></div><div id="diag-scroll"><table id="diag-table"></table><div id="diag-actions"><button id="diag-save">SAVE AGC STATE NOW</button><button id="diag-verify">VERIFY SNAPSHOT ROUND-TRIP</button><button id="diag-pipa-test">ARM 5-SECOND PIPA MOTION TEST</button><button id="diag-clear">CLEAR SAVED STATE</button></div><div id="diag-note">Diagnostic readout is phone-side only. It does not write flight-software erasable memory except through the same physical input paths being tested.</div></div>`;
    document.body.appendChild(el);
    document.getElementById('diag-close').onclick=close;
    document.getElementById('diag-save').onclick=()=>{if(typeof api.saveAgcState==='function')api.saveAgcState('diagnostics');update()};
    document.getElementById('diag-verify').onclick=()=>{if(typeof api.verifySnapshotRoundTrip==='function')api.verifySnapshotRoundTrip();update()};
    document.getElementById('diag-pipa-test').onclick=startPipaTest;
    document.getElementById('diag-clear').onclick=()=>{if(typeof api.clearSavedAgcState==='function')api.clearSavedAgcState();update()};
  }
  function row(k,v){return `<tr><td>${k}</td><td>${v}</td></tr>`}
  function section(name){return `<tr><th colspan="2">${name}</th></tr>`}
  function pipaWords(core){if(!core||typeof core.readErasable!=='function')return null;return [0o37,0o40,0o41].map(a=>core.readErasable(0,a)&0x7fff)}
  function startPipaTest(){
    const core=typeof api.getCore==='function'?api.getCore():null,start=pipaWords(core),b=document.getElementById('diag-pipa-test');
    if(!core||!core.running||!start){pipaTest={ok:false,message:'AGC MUST BE RUNNING'};update();return}
    pipaTest={running:true,start,timestamp:Date.now(),message:'MOVE PHONE NOW'};if(b)b.textContent='MOVE PHONE · TEST RUNNING';
    clearTimeout(pipaTestTimer);pipaTestTimer=setTimeout(()=>{const end=pipaWords(core),delta=end?end.map((v,i)=>((v-start[i]+16384)&0x7fff)-16384):null;const moved=delta&&delta.some(v=>v!==0);pipaTest={running:false,ok:!!moved,start,end,delta,timestamp:Date.now(),message:moved?'PIPA COUNTERS RESPONDED':'NO PIPA COUNTER CHANGE'};if(b)b.textContent='ARM 5-SECOND PIPA MOTION TEST';update()},5000);update();
  }
  function ageText(ms){return ms==null?'---':(ms<1000?Math.round(ms)+' ms':(ms/1000).toFixed(1)+' s')}
  function hzText(h){return Number.isFinite(Number(h))?Number(h).toFixed(1)+' Hz':'---'}
  function update(){
    const t=document.getElementById('diag-table');if(!t)return;
    const app=typeof api.appStatus==='function'?api.appStatus():{};
    const core=typeof api.getCore==='function'?api.getCore():null;
    const phone=typeof api.phoneIcduStatus==='function'?api.phoneIcduStatus():null;
    const sxt=typeof api.sextantStatus==='function'?api.sextantStatus():null;
    const r=(bank,addr)=>core&&typeof core.readErasable==='function'?core.readErasable(bank,addr):null;
    const state3=r(0,0o77),imodes30=r(2,0o320);
    const refsm=state3==null?'---':((state3&0o10000)?'VALID':'UNKNOWN');
    const iss=imodes30==null?'---':((imodes30&0o00400)?'NOT OPERATING':'OPERATING');
    const ix=r(0,0o32),iy=r(0,0o33),iz=r(0,0o34),it=r(0,0o35),is=r(0,0o36);
    const px=r(0,0o37),py=r(0,0o40),pz=r(0,0o41);
    const alarm=[r(0,0o375),r(0,0o376),r(0,0o377)];
    const d=app.display||{};
    let h='';
    h+=section('CORE / DSKY');
    h+=row('Mode',String(app.mode||'---').toUpperCase());
    h+=row('Core',app.coreLoaded?`${app.coreVersion||'---'} · ${app.coreRunning?'RUNNING':'SUSPENDED'}`:'not loaded');
    h+=row('PROG / VERB / NOUN',`${(d.prog||[]).join('')||'--'} / ${(d.verb||[]).join('')||'--'} / ${(d.noun||[]).join('')||'--'}`);
    const ch=app.channels||{};h+=row('Channels 011 / 013 / 0163',`${oct(ch.ch011)} / ${oct(ch.ch013)} / ${oct(ch.ch0163)}`);
    h+=section('ISS / ALIGNMENT');
    h+=row('IMODES30',`${oct(imodes30)} · ${iss}`);
    h+=row('REFSMFLG',`${refsm} · STATE+3 ${oct(state3)}`);
    h+=section('ICDU / OPTICS');
    h+=row('CDUX / Y / Z',`${oct(ix)} ${f(cduDeg(ix),2)}° · ${oct(iy)} ${f(cduDeg(iy),2)}° · ${oct(iz)} ${f(cduDeg(iz),2)}°`);
    h+=row('CDUS / CDUT',`${oct(is)} ${f(cduDeg(is),2)}° · ${oct(it)} ${f(cduDeg(it),2)}°`);
    if(phone){
      h+=row('Phone ICDU pending',`${phone.pending?.x??0}, ${phone.pending?.y??0}, ${phone.pending?.z??0}`);
      h+=row('Phone IMU source',`${phone.sensorSource||'none'} / ${phone.nativeSensorName||'none'}`);
      h+=row('IMU update health',`${hzText(phone.health?.imu?.hz)} · age ${ageText(phone.health?.imu?.ageMs)} · rejected CDU writes ${phone.health?.cduWriteRejected??0}`);
    }
    if(sxt){h+=row('Sextant',`${sxt.open?'OPEN':'CLOSED'} · aim ${sxt.aimScale??1}× · shaft/trun pending ${sxt.pending?.shaft??0}/${sxt.pending?.trunnion??0}`);h+=row('Optics input health',`rejected writes ${sxt.health?.writeRejected??0} · last accepted ${sxt.health?.lastAccept?ageText(Date.now()-sxt.health.lastAccept):'---'} ago`)}
    h+=section('PIPAS');
    h+=row('PIPAX / Y / Z',`${oct(px)} (${s15(px)??'---'}) · ${oct(py)} (${s15(py)??'---'}) · ${oct(pz)} (${s15(pz)??'---'})`);
    if(phone&&phone.pipa){const p=phone.pipa,a=p.acceleration||{};h+=row('Phone accel stable frame',`${f(a.x)} / ${f(a.y)} / ${f(a.z)} m/s²`);h+=row('PIPA sensor / calibration',`${p.sensorName||'none'} · ${p.calibrated?'CALIBRATED':(p.calRemaining>0?'CALIBRATING '+p.calRemaining:'WAIT')}`);h+=row('PIPA update health',`${hzText(phone.health?.pipa?.hz)} · age ${ageText(phone.health?.pipa?.ageMs)} · rejected writes ${phone.health?.pipaWriteRejected??0}`);h+=row('PIPA pending',`${p.pending?.x??0}, ${p.pending?.y??0}, ${p.pending?.z??0}`)}
    if(pipaTest)h+=row('5-second PIPA device test',`${pipaTest.running?'RUNNING':(pipaTest.ok?'PASS':'FAIL/WAIT')} · ${pipaTest.message||''}${pipaTest.delta?' · Δ '+pipaTest.delta.join('/') : ''}`);
    h+=section('MAG / STAR AID');
    if(phone&&phone.magnetic)h+=row('Mag yaw correction',`${phone.magnetic.enabled?'ON':'OFF'} · accuracy ${phone.magnetic.accuracy} · correction ${f(phone.magnetic.yawCorrection,2)}° · ${hzText(phone.health?.mag?.hz)} · age ${ageText(phone.health?.mag?.ageMs)}`);else h+=row('Mag yaw correction','---');
    const sky=phone&&phone.sky;h+=row('Camera true pointing',sky&&sky.seen?`AZ ${f(sky.az,1)}° · ALT ${f(sky.alt,1)}° · decl ${f(sky.declination,1)}° · ${sky.source||'---'} · age ${ageText(Date.now()-(sky.timestamp||0))}`:'WAITING');
    const sc=phone?.skyCalibration||sxt?.pointingCalibration;h+=row('Camera boresight calibration',sc?.calibrated?`CALIBRATED · ${sc.calibration?.label||'star'} · ${sc.calibration?.timestamp?new Date(sc.calibration.timestamp).toLocaleString():''}`:'NONE');
    if(sc?.rawNative?.seen)h+=row('Raw native pointing',`AZ ${f(sc.rawNative.az,1)}° · ALT ${f(sc.rawNative.alt,1)}° · age ${ageText(Date.now()-(sc.rawNative.timestamp||0))}`);
    if(sxt?.location)h+=row('Star-finder location',`${f(sxt.location.lat,4)}, ${f(sxt.location.lon,4)} · ±${Number.isFinite(sxt.location.accuracy)?Math.round(sxt.location.accuracy):'---'} m · age ${ageText(Date.now()-(sxt.location.timestamp||0))}`);
    h+=section('ALARMS / STATE SAVE');
    h+=row('FAILREG 1 / 2 / 3',`${oct(alarm[0])} / ${oct(alarm[1])} / ${oct(alarm[2])}`);
    const snap=app.snapshot||{},meta=snap.meta;
    const savedReason=meta?.reason==='clock mode'?'suspend for clock (legacy)':(meta?.reason||'');
    const savedSource=meta?.sourceMode?` · from ${String(meta.sourceMode).toUpperCase()}`:'';
    h+=row('Saved AGC snapshot',snap.saved&&meta?`${new Date(meta.timestamp).toLocaleString()}${savedSource}${savedReason?' · '+savedReason:''}`:'NONE');
    h+=row('Snapshot fingerprint',`saved ${meta?.fingerprint||'---'} · current ${snap.currentFingerprint||'---'}`);
    const sv=snap.lastVerify;h+=row('Snapshot round-trip self-test',sv?`${sv.ok?'PASS':'FAIL'} · ${sv.before||'---'} → ${sv.after||'---'}${sv.error?' · '+sv.error:''}`:'NOT RUN');
    h+=row('Autosave this session',snap.lastAutosaveAt?`${ageText(Date.now()-snap.lastAutosaveAt)} ago`:'NOT YET');
    h+=row('Snapshot action',`${snap.lastAction||'none'}${snap.error?' · '+snap.error:''}`);
    t.innerHTML=h;
    const saveBtn=document.getElementById('diag-save'),verifyBtn=document.getElementById('diag-verify');
    const canSave=app.mode==='agc'&&app.coreLoaded;
    if(saveBtn){saveBtn.disabled=!canSave;saveBtn.textContent=canSave?'SAVE AGC STATE NOW':'SAVE AGC STATE · AGC MODE ONLY'}
    if(verifyBtn)verifyBtn.disabled=!app.coreLoaded;
  }
  function open(){build();document.getElementById('diag-view').classList.add('open');update();if(!timer)timer=setInterval(update,250)}
  function close(){document.getElementById('diag-view')?.classList.remove('open');if(timer){clearInterval(timer);timer=0}}
  addEventListener('DOMContentLoaded',()=>{build();const b=document.getElementById('diagnostics');if(b)b.addEventListener('click',open)});
  api.openDiagnostics=open;api.closeDiagnostics=close;
})();
