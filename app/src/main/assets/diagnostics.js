'use strict';
(() => {
  const appState=window.AGCDSKY_APP_STATE;
  const coreSession=window.AGCDSKY_CORE_SESSION;
  const lifecycle=window.AGCDSKY_LIFECYCLE;
  const snapshot=window.AGCDSKY_SNAPSHOT;
  const registry=window.AGCDSKY_SERVICE_REGISTRY;
  if(!appState)throw new Error('Shared application state unavailable');
  if(!coreSession)throw new Error('Shared AGC core session unavailable');
  if(!lifecycle)throw new Error('AGC lifecycle service unavailable');
  if(!snapshot)throw new Error('AGC snapshot service unavailable');
  if(!registry)throw new Error('AGC late-service registry unavailable');
  let timer=0,pipaTest=null,pipaTestTimer=0,dskyTest=null,fullSelfTest=null,fullSelfTestRunning=false;
  const oct=(v,n=5)=>v==null?'-----':((Number(v)>>>0)&0x7fff).toString(8).padStart(n,'0');
  const cduDeg=v=>v==null?NaN:((v&0x7fff)*360/32768+360)%360;
  const s15=v=>{if(v==null)return null;v&=0x7fff;return (v&0x4000)?-((~v)&0x7fff):v};
  const f=(v,d=3)=>Number.isFinite(Number(v))?Number(v).toFixed(d):'---';
  const lateService=name=>registry.get(name);
  function phoneStatus(){const phone=lateService('AGCDSKY_PHONE'),impl=phone&&typeof phone.implementation==='function'?phone.implementation('phoneIcduStatus'):null;return typeof impl==='function'?impl():null}
  function opticsStatus(){const optics=lateService('AGCDSKY_OPTICS');return optics&&typeof optics.status==='function'?optics.status():null}
  function build(){
    if(document.getElementById('diag-view'))return;
    const el=document.createElement('section');el.id='diag-view';el.setAttribute('aria-label','AGC diagnostics');
    el.innerHTML=`<div id="diag-head"><strong>NON-FLIGHT DIAGNOSTICS</strong><button id="diag-close">CLOSE</button></div><div id="diag-scroll"><table id="diag-table"></table><div id="diag-actions"><button id="diag-full-test">RUN FULL DSKY SELF-TEST</button><button id="diag-save">SAVE AGC STATE NOW</button><button id="diag-verify">VERIFY SNAPSHOT ROUND-TRIP</button><button id="diag-ntp-sync">SYNC NETWORK TIME NOW</button><button id="diag-pipa-test">ARM 5-SECOND PIPA MOTION TEST</button><button id="diag-dsky-test">RUN CLOCK DSKY SELF-TEST</button><button id="diag-haptic-test">TEST KEY HAPTIC</button><button id="diag-clear">CLEAR SAVED STATE</button></div><div id="diag-note">Diagnostic readout is phone-side only. It does not write flight-software erasable memory except through the same physical input paths being tested.</div></div>`;
    document.body.appendChild(el);
    document.getElementById('diag-close').onclick=close;
    document.getElementById('diag-full-test').onclick=runFullSelfTest;
    document.getElementById('diag-save').onclick=()=>{snapshot.save('diagnostics');update()};
    document.getElementById('diag-verify').onclick=()=>{snapshot.verifyRoundTrip();update()};
    document.getElementById('diag-ntp-sync').onclick=syncNetworkTimeNow;
    document.getElementById('diag-pipa-test').onclick=startPipaTest;
    document.getElementById('diag-dsky-test').onclick=startDskyTest;
    document.getElementById('diag-haptic-test').onclick=()=>{
      const tactile=lateService('AGCDSKY_KEY_TACTILE');
      if(tactile&&typeof tactile.test==='function') tactile.test();
      update();
    };
    document.getElementById('diag-clear').onclick=()=>{snapshot.clear();update()};
  }
  function row(k,v){return `<tr><td>${k}</td><td>${v}</td></tr>`}
  function section(name){return `<tr><th colspan="2">${name}</th></tr>`}
  function pipaWords(core){if(!core||typeof core.readErasable!=='function')return null;return [0o37,0o40,0o41].map(a=>core.readErasable(0,a)&0x7fff)}
  function syncNetworkTimeNow(){
    const request=window.AGCDSKY_SHELL&&window.AGCDSKY_SHELL.requestNetworkTimeSync;
    if(typeof request!=='function')return;
    try{Promise.resolve(request()).catch(()=>false).finally(()=>setTimeout(update,100))}catch(_){}
    update();
  }
  const SELF_TEST_ASSETS=Object.freeze([
    Object.freeze({name:'yaAGC.wasm',size:132617,gitBlobSha1:'713685680492098d05437b99c26403f683d56009'}),
    Object.freeze({name:'Comanche055.bin',size:73728,gitBlobSha1:'9e4ec167dc99ac12b233df07b6b91fef585e5015'})
  ]);
  const SELF_TEST_KEYS=Object.freeze({'1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37});
  const SELF_TEST_RELAY_CODES=Object.freeze({'0':21,'1':3,'2':25,'3':27,'4':15,'5':30,'6':28,'7':19,'8':29,'9':31});
  const SELF_TEST_TOTAL=14;
  function selfTestResult(name,ok,detail){return Object.freeze({name:String(name),ok:!!ok,detail:String(detail||'')})}
  function hex(bytes){return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')}
  async function gitBlobSha1(bytes){
    if(!(window.crypto&&crypto.subtle&&typeof crypto.subtle.digest==='function'))throw new Error('WebCrypto unavailable');
    const payload=new Uint8Array(bytes),prefix=new TextEncoder().encode('blob '+payload.byteLength+'\0'),joined=new Uint8Array(prefix.length+payload.length);
    joined.set(prefix,0);joined.set(payload,prefix.length);
    return hex(await crypto.subtle.digest('SHA-1',joined));
  }
  async function fetchCheckedAsset(spec){
    const response=await fetch(spec.name,{cache:'no-store'});
    if(!response.ok)throw new Error(spec.name+' HTTP '+response.status);
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==spec.size)throw new Error(spec.name+' size '+bytes.byteLength+' != '+spec.size);
    const digest=await gitBlobSha1(bytes);
    if(digest.toLowerCase()!==spec.gitBlobSha1)throw new Error(spec.name+' checksum '+digest);
    return bytes;
  }
  async function runFullSelfTest(){
    if(fullSelfTestRunning)return;
    fullSelfTestRunning=true;fullSelfTest={startedAt:Date.now(),finishedAt:0,results:[]};update();
    const run=async(name,test)=>{
      try{
        const detail=await test();
        fullSelfTest.results.push(selfTestResult(name,true,detail||'OK'));
      }catch(error){
        fullSelfTest.results.push(selfTestResult(name,false,error?.message||error||'failed'));
      }
      update();
    };
    let wasmBytes=null,ropeBytes=null;
    await run('Core services',async()=>{
      const required=[['renderer',window.AGCDSKY_RENDERER],['display',window.AGCDSKY_DISPLAY],['clock',window.AGCDSKY_CLOCK],['snapshot',window.AGCDSKY_SNAPSHOT],['shell',window.AGCDSKY_SHELL]];
      const missing=required.filter(([,value])=>!value).map(([name])=>name);
      if(missing.length)throw new Error('missing '+missing.join(', '));
      if(typeof window.AgcCore!=='function')throw new Error('AgcCore constructor unavailable');
      return 'service graph and AgcCore constructor present';
    });
    await run('AGC WASM asset',async()=>{
      wasmBytes=await fetchCheckedAsset(SELF_TEST_ASSETS[0]);
      await WebAssembly.compile(wasmBytes.slice(0));
      return SELF_TEST_ASSETS[0].size+' bytes · pinned Git blob SHA-1 verified · compiles';
    });
    await run('Comanche 055 rope',async()=>{
      ropeBytes=await fetchCheckedAsset(SELF_TEST_ASSETS[1]);
      return SELF_TEST_ASSETS[1].size+' bytes · pinned Git blob SHA-1 verified';
    });
    await run('Relay-to-digit matrix',async()=>{
      const matrix=window.DSKY_RELAY_MATRIX,display=window.AGCDSKY_DISPLAY,renderer=window.AGCDSKY_RENDERER;
      if(!matrix||typeof matrix.segmentsForCode!=='function'||!display||!renderer)throw new Error('relay matrix unavailable');
      for(const [digit,code] of Object.entries(SELF_TEST_RELAY_CODES)){
        if(display.relayDigit(code)!==digit)throw new Error('relay code '+code+' decoded as '+display.relayDigit(code)+' not '+digit);
        if(matrix.segmentsForCode(code)!==renderer.segmentPattern(digit))throw new Error('segment mismatch for '+digit);
      }
      return '10 numeric relay codes match renderer segment patterns';
    });
    await run('EL segment renderer',async()=>{
      const renderer=window.AGCDSKY_RENDERER;if(!renderer||typeof renderer.renderDigits!=='function')throw new Error('renderer unavailable');
      const probe=document.createElement('div');renderer.renderDigits(probe,'8');
      const segments=[...probe.querySelectorAll('[data-seg]')].map(x=>x.getAttribute('data-seg')).sort().join('');
      if(segments!=='abcdefg')throw new Error('digit 8 rendered segments '+segments);
      return 'all seven EL segments a–g render through the active renderer';
    });
    await run('Annunciator lamps',async()=>{
      const renderer=window.AGCDSKY_RENDERER,expected=['uplink','temp','noatt','gimbal','stby','prog','keyrel','restart','oprerr','tracker','comp'];
      if(!renderer||typeof renderer.setLamp!=='function')throw new Error('lamp renderer unavailable');
      const nodes=expected.map(name=>[name,document.querySelector('[data-lamp="'+name+'"]')]);
      const missing=nodes.filter(([,node])=>!node).map(([name])=>name);if(missing.length)throw new Error('missing '+missing.join(', '));
      const prior=nodes.map(([name,node])=>[name,node.classList.contains('on')]);
      try{
        for(const [name,node] of nodes){renderer.setLamp(name,true);if(!node.classList.contains('on'))throw new Error(name+' failed ON');renderer.setLamp(name,false);if(node.classList.contains('on'))throw new Error(name+' failed OFF')}
      }finally{for(const [name,on] of prior)renderer.setLamp(name,on)}
      return expected.length+' annunciator/COMP outputs toggle and restore';
    });
    await run('Keypad wiring',async()=>{
      const map=window.AGCDSKY_KEY_CODES,input=lateService('AGCDSKY_INPUT');if(!map)throw new Error('keycode table unavailable');
      for(const [key,code] of Object.entries(SELF_TEST_KEYS))if(map[key]!==code)throw new Error(key+' code mismatch');
      const keys=[...document.querySelectorAll('button[data-key]')].map(x=>x.dataset.key);
      for(const key of [...Object.keys(SELF_TEST_KEYS),'P'])if(keys.filter(x=>x===key).length!==1)throw new Error('key '+key+' DOM wiring count != 1');
      if(!input||typeof input.keyMake!=='function'||typeof input.keyReset!=='function'||typeof input.proceed!=='function')throw new Error('input runtime unavailable');
      return '18 Pinball keycodes + separate PRO contact wired';
    });
    await run('Key tactile model',async()=>{
      const tactile=lateService('AGCDSKY_KEY_TACTILE');
      if(!tactile||typeof tactile.status!=='function'||typeof tactile.make!=='function'||typeof tactile.release!=='function')throw new Error('key tactile service unavailable');
      const status=tactile.status();
      if(status.policy!=='event-cue-only; default-amplitude timed pulses; no force-to-vibration amplitude mapping')throw new Error('tactile force policy changed');
      if(status.actuationTravelIn!==3/16||status.overtravelToBottomIn!==1/16||status.totalTravelIn!==1/4)throw new Error('R-700 key travel metadata mismatch');
      if(status.springForceIncreaseToActuationOzMin!==9||status.springForceIncreaseToActuationOzMax!==10.5)throw new Error('spring actuation ΔF envelope mismatch');
      if(status.springForceIncreaseToBottomOzMin!==12||status.springForceIncreaseToBottomOzMax!==14)throw new Error('spring bottom ΔF envelope mismatch');
      if(status.totalFingerForceOz!==null)throw new Error('total finger force must remain unresolved');
      if(window.TimeBridge&&(!window.HapticBridge||typeof HapticBridge.keyMake!=='function'||typeof HapticBridge.keyRelease!=='function'))throw new Error('Android HapticBridge unavailable');
      return status.nativeBridge?'Android '+(status.nativeBackend||'native haptics')+' · '+status.makeDurationMs+' ms make / '+status.releaseDurationMs+' ms release':'source-backed tactile model active · native haptics unavailable on this surface';
    });
    await run('Native/browser bridges',async()=>{
      const native=!!window.TimeBridge;
      if(native){
        if(typeof TimeBridge.getStatus!=='function'||typeof TimeBridge.syncNow!=='function')throw new Error('TimeBridge incomplete');
        if(!window.PrintBridge||typeof PrintBridge.printChecklist!=='function')throw new Error('PrintBridge unavailable');
        return 'Android TimeBridge and PrintBridge present'+(window.SkyBridge?' · SkyBridge present':'');
      }
      const parity=window.AGCDSKYPWA&&typeof window.AGCDSKYPWA.parityStatus==='function';
      if(!parity)throw new Error('no native bridge or PWA parity bridge');
      return 'browser/PWA bridge active';
    });
    await run('Sensor plumbing',async()=>{
      const phone=phoneStatus(),pwa=window.AGCDSKYPWA&&typeof window.AGCDSKYPWA.parityStatus==='function'?window.AGCDSKYPWA.parityStatus():null;
      if(phone)return 'phone sensor service active · '+(phone.sensorSource||phone.nativeSensorName||'sensor status available');
      if(pwa){
        const values=[pwa.orientation,pwa.absoluteOrientation,pwa.genericAbsolute,pwa.motion].filter(Boolean);
        if(!values.length)throw new Error('PWA sensor status empty');
        return 'PWA sensor bridge reports '+values.join(' / ');
      }
      throw new Error('sensor bridge unavailable');
    });
    await run('Network time',async()=>{
      const ntp={...appState.ntpStatus};
      if(ntp.state!=='synced'||!ntp.lastSyncUtcMs)throw new Error('network time '+String(ntp.state||'unavailable'));
      return (ntp.source==='http-date'?'HTTP Date':'SNTP')+' synced · offset '+Math.round(ntp.offsetMs||0)+' ms · RTT '+Math.round(ntp.roundTripMs||0)+' ms';
    });
    await run('Saved-state read/write',async()=>{
      const key='__agcdsky_diag_probe__',value='probe-'+Date.now();
      if(!window.AGCDSKY_SHELL?.store?.set(key,value))throw new Error('storage write rejected');
      const read=window.AGCDSKY_SHELL.store.get(key);window.AGCDSKY_SHELL.store.remove(key);
      if(read!==value)throw new Error('storage readback mismatch');
      if(coreSession.core){
        const verify=snapshot.verifyRoundTrip();
        if(!verify?.ok)throw new Error('AGC snapshot round-trip '+(verify?.error||'failed'));
        return 'storage probe PASS · AGC snapshot '+(verify.before||'---')+' → '+(verify.after||'---');
      }
      return 'storage probe PASS · AGC core not loaded, snapshot memory test not required';
    });
    await run('Audio subsystem',async()=>{
      const audio=window.AGCDSKY_AUDIO;if(!audio||typeof audio.ensure!=='function')throw new Error('audio service unavailable');
      const ctx=audio.ensure();if(!ctx)throw new Error('Web Audio unavailable');
      if(ctx.state==='suspended'&&typeof ctx.resume==='function')try{await ctx.resume()}catch(_){}
      if(ctx.state==='closed')throw new Error('audio context closed');
      return 'AudioContext '+ctx.state+' · '+Math.round(ctx.sampleRate||0)+' Hz';
    });
    await run('Packaged assets',async()=>{
      if(!wasmBytes||!ropeBytes)throw new Error('pinned AGC assets did not verify');
      const required=['index.html','diagnostics.js','dsky-geometry.js','Comanche055.bin','yaAGC.wasm'];
      for(const name of required){const response=await fetch(name,{cache:'no-store'});if(!response.ok)throw new Error(name+' HTTP '+response.status)}
      return required.length+' critical packaged assets readable';
    });
    fullSelfTest.finishedAt=Date.now();fullSelfTestRunning=false;update();
  }
  function startPipaTest(){
    const core=coreSession.core,start=pipaWords(core),b=document.getElementById('diag-pipa-test');
    if(!core||!core.running||!start){pipaTest={ok:false,message:'AGC MUST BE RUNNING'};update();return}
    pipaTest={running:true,start,timestamp:Date.now(),message:'MOVE PHONE NOW'};if(b)b.textContent='MOVE PHONE · TEST RUNNING';
    clearTimeout(pipaTestTimer);pipaTestTimer=setTimeout(()=>{const end=pipaWords(core),delta=end?end.map((v,i)=>((v-start[i]+16384)&0x7fff)-16384):null;const moved=delta&&delta.some(v=>v!==0);pipaTest={running:false,ok:!!moved,start,end,delta,timestamp:Date.now(),message:moved?'PIPA COUNTERS RESPONDED':'NO PIPA COUNTER CHANGE'};if(b)b.textContent='ARM 5-SECOND PIPA MOTION TEST';update()},5000);update();
  }
  function startDskyTest(){
    const clock=window.AGCDSKY_CLOCK;
    if(appState.mode!=='clock'||!clock||typeof clock.lampTest!=='function'){
      dskyTest={ok:false,message:'CLOCK MODE REQUIRED'};update();return;
    }
    try{
      clock.lampTest();
      dskyTest={ok:true,message:'V35 HARDWARE SEQUENCE STARTED',timestamp:Date.now()};
    }catch(error){
      dskyTest={ok:false,message:String(error?.message||error||'SELF-TEST FAILED'),timestamp:Date.now()};
    }
    update();
  }
  function ageText(ms){return ms==null?'---':(ms<1000?Math.round(ms)+' ms':(ms/1000).toFixed(1)+' s')}
  function hzText(h){return Number.isFinite(Number(h))?Number(h).toFixed(1)+' Hz':'---'}
  function update(){
    const t=document.getElementById('diag-table');if(!t)return;
    const app=lifecycle.status();
    const ntp={...appState.ntpStatus};
    const core=coreSession.core;
    const phone=phoneStatus();
    const sxt=opticsStatus();
    const tactile=lateService('AGCDSKY_KEY_TACTILE');
    const tactileStatus=tactile&&typeof tactile.status==='function'?tactile.status():null;
    const pwa=window.AGCDSKYPWA&&typeof window.AGCDSKYPWA.parityStatus==='function'?window.AGCDSKYPWA.parityStatus():null;
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
    if(fullSelfTest){
      const passed=fullSelfTest.results.filter(x=>x.ok).length,failed=fullSelfTest.results.filter(x=>!x.ok).length,total=fullSelfTest.results.length;
      const overall=fullSelfTestRunning?'RUNNING':(failed?'FAIL':'PASS');
      h+=row('Full DSKY self-test',overall+' · '+passed+' PASS'+(failed?' · '+failed+' FAIL':'')+' · '+total+'/'+SELF_TEST_TOTAL+' complete');
      for(const result of fullSelfTest.results)h+=row('↳ '+result.name,(result.ok?'PASS':'FAIL')+' · '+result.detail);
    }
    h+=row('Mode',String(app.mode||'---').toUpperCase());
    h+=row('Core',app.coreLoaded?`${app.coreVersion||'---'} · ${app.coreRunning?'RUNNING':'SUSPENDED'}`:'not loaded');
    if(dskyTest)h+=row('Clock DSKY self-test',`${dskyTest.ok?'STARTED':'BLOCKED'} · ${dskyTest.message}${dskyTest.timestamp?' · '+ageText(Date.now()-dskyTest.timestamp)+' ago':''}`);
    h+=row('PROG / VERB / NOUN',`${(d.prog||[]).join('')||'--'} / ${(d.verb||[]).join('')||'--'} / ${(d.noun||[]).join('')||'--'}`);
    const ch=app.channels||{};h+=row('Channels 011 / 013 / 0163',`${oct(ch.ch011)} / ${oct(ch.ch013)} / ${oct(ch.ch0163)}`);
    h+=section('KEY MECHANICS / TACTILE');
    if(tactileStatus){
      h+=row('Key travel',`${f(tactileStatus.actuationTravelIn,4)} in to contact · +${f(tactileStatus.overtravelToBottomIn,4)} in overtravel · ${f(tactileStatus.totalTravelIn,4)} in total · PANEL-NORMAL`);
      h+=row('Compression spring',`${f(tactileStatus.springRateLbPerInMin,1)}–${f(tactileStatus.springRateLbPerInMax,1)} lb/in · ΔF contact ${f(tactileStatus.springForceIncreaseToActuationOzMin,1)}–${f(tactileStatus.springForceIncreaseToActuationOzMax,1)} oz · bottom ${f(tactileStatus.springForceIncreaseToBottomOzMin,1)}–${f(tactileStatus.springForceIncreaseToBottomOzMax,1)} oz`);
      h+=row('Sensitive switch',`actuate ≤${f(tactileStatus.switchActuatingForceOzMax,1)} oz · release ≥${f(tactileStatus.switchReleaseForceOzMin,1)} oz`);
      h+=row('Total finger force','UNKNOWN · installed preload / leaf-spring leverage / friction unresolved');
      h+=row('Tactile cue',tactileStatus.nativeBridge?('ANDROID '+(tactileStatus.nativeBackend||'NATIVE')+' · '+tactileStatus.makeDurationMs+' ms MAKE / '+tactileStatus.releaseDurationMs+' ms RELEASE · DEFAULT AMPLITUDE'):'NO NATIVE HAPTIC BRIDGE ON THIS SURFACE');
      h+=row('Vibrator amplitude control',tactileStatus.amplitudeControl?'YES':'NO / NOT REPORTED');
      h+=row('Tactile events',`${tactileStatus.makeCount} make · ${tactileStatus.releaseCount} release`);
    }else{
      h+=row('Key tactile model','UNAVAILABLE');
    }
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
    if(pwa)h+=row('Web sensor bridge',`${pwa.browser||'unknown'} · orient ${pwa.orientation||'---'} · absolute ${pwa.absoluteOrientation||'---'} · generic ${pwa.genericAbsolute||'---'} · motion ${pwa.motion||'---'}${pwa.sensorBlock?' · '+pwa.sensorBlock:''}`);
    if(phone&&phone.magnetic)h+=row('Mag yaw correction',`${phone.magnetic.enabled?'ON':'OFF'} · accuracy ${phone.magnetic.accuracy} · correction ${f(phone.magnetic.yawCorrection,2)}° · ${hzText(phone.health?.mag?.hz)} · age ${ageText(phone.health?.mag?.ageMs)}`);else h+=row('Mag yaw correction','---');
    const sky=phone&&phone.sky;h+=row('Camera true pointing',sky&&sky.seen?`AZ ${f(sky.az,1)}° · ALT ${f(sky.alt,1)}° · decl ${f(sky.declination,1)}° · ${sky.source||'---'} · age ${ageText(Date.now()-(sky.timestamp||0))}`:'WAITING');
    const sc=phone?.skyCalibration||sxt?.pointingCalibration;h+=row('Camera boresight calibration',sc?.calibrated?`CALIBRATED · ${sc.calibration?.label||'star'} · ${sc.calibration?.timestamp?new Date(sc.calibration.timestamp).toLocaleString():''}`:'NONE');
    if(sc?.rawNative?.seen)h+=row('Raw native pointing',`AZ ${f(sc.rawNative.az,1)}° · ALT ${f(sc.rawNative.alt,1)}° · age ${ageText(Date.now()-(sc.rawNative.timestamp||0))}`);
    if(sxt?.location)h+=row('Star-finder location',`${f(sxt.location.lat,4)}, ${f(sxt.location.lon,4)} · ±${Number.isFinite(sxt.location.accuracy)?Math.round(sxt.location.accuracy):'---'} m · age ${ageText(Date.now()-(sxt.location.timestamp||0))}`);
    h+=section('TIME');
    if(ntp){
      const state=String(ntp.state||'unavailable').toUpperCase();
      const native=!!(window.TimeBridge&&typeof window.TimeBridge.getStatus==='function');
      const using=ntp.state==='synced';
      const source=using?(ntp.source==='http-date'?'HTTP DATE NETWORK TIME':'SNTP NETWORK TIME'):(native?'ANDROID WALL CLOCK':'BROWSER WALL CLOCK');
      const dynamicAge=ntp.lastSyncUtcMs?Math.max(0,Date.now()+(Number(ntp.offsetMs)||0)-Number(ntp.lastSyncUtcMs)):-1;
      const lastSuccess=ntp.lastSyncUtcMs?new Date(ntp.lastSyncUtcMs).toLocaleString():'NEVER';
      const attempt=ntp.lastAttemptUtcMs?new Date(ntp.lastAttemptUtcMs).toLocaleString():'NEVER';
      const offset=Number(ntp.offsetMs)||0;
      const offsetText=(offset>0?'+':'')+Math.round(offset)+' ms';
      const rtt=Number(ntp.roundTripMs)>=0?Math.round(ntp.roundTripMs)+' ms':'---';
      const attemptResult=String(ntp.lastAttemptResult||'never').toUpperCase();
      const reason=ntp.lastAttemptReason?' · '+ntp.lastAttemptReason:'';
      const error=ntp.lastError?' · '+ntp.lastError:'';
      const timeSourceLabel=ntp.source==='http-date'?'HTTP time source / origin host':'NTP server';
      h+=row('Clock source',source);
      h+=row(timeSourceLabel,ntp.server||'time.cloudflare.com');
      h+=row('Network time state',state+(ntp.syncInFlight?' · SYNC IN PROGRESS':''));
      h+=row('Measured clock offset',offsetText+(using?' · APPLIED':' · NOT APPLIED'));
      h+=row('Round-trip time',rtt);
      h+=row('Last successful sync',lastSuccess+(dynamicAge>=0?' · '+ageText(dynamicAge)+' ago':''));
      h+=row('Last sync attempt',attempt+' · '+attemptResult+reason+error);
    }
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
    const saveBtn=document.getElementById('diag-save'),verifyBtn=document.getElementById('diag-verify'),dskyBtn=document.getElementById('diag-dsky-test'),ntpBtn=document.getElementById('diag-ntp-sync'),fullBtn=document.getElementById('diag-full-test');
    const canSave=app.mode==='agc'&&app.coreLoaded;
    if(saveBtn){saveBtn.disabled=!canSave;saveBtn.textContent=canSave?'SAVE AGC STATE NOW':'SAVE AGC STATE · AGC MODE ONLY'}
    if(verifyBtn)verifyBtn.disabled=!app.coreLoaded;
    if(dskyBtn){dskyBtn.disabled=app.mode!=='clock';dskyBtn.textContent=app.mode==='clock'?'RUN CLOCK DSKY SELF-TEST':'DSKY SELF-TEST · CLOCK MODE ONLY'}
    if(ntpBtn){ntpBtn.disabled=!!ntp.syncInFlight;ntpBtn.textContent=ntp.syncInFlight?'NETWORK TIME SYNCING…':'SYNC NETWORK TIME NOW'}
    if(fullBtn){fullBtn.disabled=fullSelfTestRunning;fullBtn.textContent=fullSelfTestRunning?'FULL SELF-TEST RUNNING…':'RUN FULL DSKY SELF-TEST'}
  }
  function open(){build();document.getElementById('diag-view').classList.add('open');update();if(!timer)timer=setInterval(update,250)}
  function close(){document.getElementById('diag-view')?.classList.remove('open');if(timer){clearInterval(timer);timer=0}}
  addEventListener('DOMContentLoaded',()=>{build();const b=document.getElementById('diagnostics');if(b)b.addEventListener('click',open)});
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_DIAGNOSTICS',Object.freeze({open,close,runFullSelfTest}),'diagnostics publication');
})();
