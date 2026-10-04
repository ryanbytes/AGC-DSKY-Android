'use strict';

// Application shell/configuration authority. Core runtimes consume the explicit
// AGCDSKY_SHELL service; classic helper bindings remain temporarily available to
// late presentation/fidelity layers until that separate compatibility pass.
const shellState=window.AGCDSKY_APP_STATE;
let networkTimeAnchor=null;
if(!shellState)throw new Error('Shared application state unavailable');
const q=new URLSearchParams(location.search);
shellState.dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},remove(k){try{localStorage.removeItem(k);return true}catch(e){return false}}};
const oldDreamBright=store.get('dreamBright')==='1';
const MISSION=Object.freeze({label:'COMANCHE055',short:'CM',rope:'Comanche055.bin'});
shellState.selectedMission='comanche055';
store.set('agcMission',shellState.selectedMission);
store.remove('agcMissionPreferenceV1');
shellState.dreamMode=store.get('dreamMode')||(oldDreamBright?'bright':'dim');
shellState.dim=store.get('dim')==='1';
shellState.tickSound=store.get('audioTickV4')!=='0';
shellState.relayHaptics=store.get('relayHapticsV1')!=='0';
shellState.displayOnly=shellState.dream||store.get('displayOnly')==='1';
const restoreAgcOnLoad=!shellState.dream&&store.get('runMode')!=='clock';

function shellCore(){const session=window.AGCDSKY_CORE_SESSION;return session?session.core:null}
function show(v,n){
  shellState.verb=v;shellState.noun=n;
  const renderer=window.AGCDSKY_RENDERER;
  if(renderer){renderer.set2('verb',v.padStart(2,' '));renderer.set2('noun',n.padStart(2,' '));return}
  if(typeof set2==='function'){set2('verb',v.padStart(2,' '));set2('noun',n.padStart(2,' '))}
}

const BROWSER_TIME_RESYNC_MS=10*60*1000;
const BROWSER_TIME_STALE_MS=2*60*60*1000;
const BROWSER_TIME_REQUEST_TIMEOUT_MS=5000;
let browserTimeLastAttemptMs=0,browserTimeInFlight=null,browserVisibilityClockSample=null;
function hasNativeTimeBridge(){return !!(window.TimeBridge&&typeof TimeBridge.getStatus==='function')}
function accurateTime(){if(shellState.ntpStatus.state==='synced'&&networkTimeAnchor)return Math.round(networkTimeAnchor.utcMs+(performance.now()-networkTimeAnchor.elapsedMs));return Date.now()+(shellState.ntpStatus.state==='synced'?(Number(shellState.ntpStatus.offsetMs)||0):0)}
function accurateDate(){return new Date(accurateTime())}
function clockTimeLabel(){
  if(shellState.ntpStatus.state==='synced')return shellState.ntpStatus.source==='http-date'?'PHONE CLOCK · NETWORK TIME':'PHONE CLOCK · NTP TIME';
  if(shellState.ntpStatus.state==='stale')return hasNativeTimeBridge()?'PHONE CLOCK · ANDROID WALL TIME · NTP STALE':'PHONE CLOCK · BROWSER WALL TIME · NETWORK STALE';
  return hasNativeTimeBridge()?'PHONE CLOCK · ANDROID WALL TIME':'PHONE CLOCK · BROWSER WALL TIME';
}
function updateNtpStatus(value){try{const parsed=typeof value==='string'?JSON.parse(value):value;if(parsed&&typeof parsed==='object'){shellState.ntpStatus={...shellState.ntpStatus,...parsed};if(parsed.state&&parsed.state!=='synced')networkTimeAnchor=null;else if(parsed.state==='synced'&&Number.isFinite(Number(parsed.lastSyncUtcMs))&&Number(parsed.lastSyncUtcMs)>0&&Number.isFinite(Number(parsed.ageMs))&&Number(parsed.ageMs)>=0)networkTimeAnchor={utcMs:Number(parsed.lastSyncUtcMs)+Number(parsed.ageMs),elapsedMs:performance.now(),source:parsed.source};if(shellState.mode==='clock')$('mode').textContent=clockTimeLabel()}}catch(_){/* malformed bridge data must not affect the DSKY */}}
function loadNativeNtpStatus(){try{if(hasNativeTimeBridge()){updateNtpStatus(TimeBridge.getStatus());return true}}catch(_){/* native bridge failure falls back to existing/wall time */}return false}
function browserTimeUrl(){const url=new URL('manifest.webmanifest',location.href);url.searchParams.set('_agcdsky_time',String(Date.now()));return url.toString()}
async function sampleBrowserNetworkTime(){
  const sent=Date.now();
  const sentElapsed=performance.now();
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timeout=0;
  let response;
  try{
    const options={method:'HEAD',cache:'no-store',credentials:'same-origin'};
    if(controller)options.signal=controller.signal;
    const request=fetch(browserTimeUrl(),options);
    response=await Promise.race([request,new Promise((_,reject)=>{
      timeout=setTimeout(()=>{if(controller)controller.abort();reject(new Error('network time request timed out'))},BROWSER_TIME_REQUEST_TIMEOUT_MS);
    })]);
  }finally{clearTimeout(timeout)}
  const receivedElapsed=performance.now();
  const received=Date.now();
  const monotonicElapsed=receivedElapsed-sentElapsed;
  const wallElapsed=received-sent;
  if(Math.abs(wallElapsed-monotonicElapsed)>250)throw new Error('device wall clock changed during network time request');
  if(!response||!response.ok)throw new Error('network time HTTP failure');
  const serverMs=Date.parse(response.headers.get('date')||'');
  if(!Number.isFinite(serverMs))throw new Error('network time Date header unavailable');
  const midpoint=sent+(monotonicElapsed/2);
  return{offsetMs:Math.round((serverMs+500)-midpoint),roundTripMs:Math.max(0,monotonicElapsed)};
}
function refreshBrowserTimeAge(){
  if(shellState.ntpStatus.source!=='http-date'||!shellState.ntpStatus.lastSyncUtcMs)return;
  if(!networkTimeAnchor||networkTimeAnchor.source!=='http-date')return;
  const age=Math.max(0,performance.now()-networkTimeAnchor.elapsedMs);
  const state=age>BROWSER_TIME_STALE_MS?'stale':'synced';
  updateNtpStatus({ageMs:age,state,usingNetworkTime:state==='synced'});
}
function syncBrowserNetworkTime(force=false){
  if(hasNativeTimeBridge())return Promise.resolve(false);
  const now=Date.now();
  if(browserTimeInFlight)return browserTimeInFlight;
  if(!force&&browserTimeLastAttemptMs&&now-browserTimeLastAttemptMs<BROWSER_TIME_RESYNC_MS){refreshBrowserTimeAge();return Promise.resolve(false)}
  browserTimeLastAttemptMs=now;
  updateNtpStatus({syncInFlight:true,lastAttemptUtcMs:now,lastAttemptResult:'syncing',lastAttemptReason:force?'manual':'automatic',lastError:''});
  browserTimeInFlight=(async()=>{
    const samples=[];
    const syncStartedElapsed=performance.now();
    const syncStartedWall=Date.now();
    for(let i=0;i<3;i++){try{samples.push(await sampleBrowserNetworkTime())}catch(_){}}
    const syncElapsed=performance.now()-syncStartedElapsed;
    const syncWallElapsed=Date.now()-syncStartedWall;
    if(Math.abs(syncWallElapsed-syncElapsed)>250){
      refreshBrowserTimeAge();
      updateNtpStatus({syncInFlight:false,lastAttemptResult:'failed',lastError:'Device wall clock changed during network time sync'});
      return false;
    }
    if(!samples.length){
      refreshBrowserTimeAge();
      updateNtpStatus({syncInFlight:false,lastAttemptResult:'failed',lastError:'HTTP Date network-time samples failed'});
      return false;
    }
    const offsets=samples.map(sample=>sample.offsetMs).sort((a,b)=>a-b);
    const offsetMs=offsets[Math.floor(offsets.length/2)];
    const roundTripMs=Math.min(...samples.map(sample=>sample.roundTripMs));
    updateNtpStatus({
      server:location.host||'same-origin',
      source:'http-date',
      usingNetworkTime:true,
      syncInFlight:false,
      offsetMs,
      lastSyncUtcMs:Date.now()+offsetMs,
      roundTripMs,
      ageMs:0,
      lastAttemptUtcMs:now,
      lastAttemptResult:'success',
      lastAttemptReason:force?'manual':'automatic',
      lastError:'',
      state:'synced'
    });
    return true;
  })().finally(()=>{browserTimeInFlight=null});
  return browserTimeInFlight;
}
function requestNetworkTimeSync(){
  if(hasNativeTimeBridge()&&typeof TimeBridge.syncNow==='function'){
    try{const accepted=!!TimeBridge.syncNow();loadNativeNtpStatus();return Promise.resolve(accepted)}
    catch(_){loadNativeNtpStatus();return Promise.resolve(false)}
  }
  return syncBrowserNetworkTime(true);
}
function refreshTimeStatus(){if(loadNativeNtpStatus())return true;refreshBrowserTimeAge();void syncBrowserNetworkTime(false);return false}
function refreshNetworkTimeOnVisibility(visible){
  if(hasNativeTimeBridge()){
    if(visible)loadNativeNtpStatus();
    return;
  }
  if(!visible){browserVisibilityClockSample={wallMs:Date.now(),elapsedMs:performance.now()};return;}
  const before=browserVisibilityClockSample;browserVisibilityClockSample=null;
  if(!before||shellState.ntpStatus.source!=='http-date'||shellState.ntpStatus.state!=='synced')return;
  const wallElapsed=Date.now()-before.wallMs,monotonicElapsed=performance.now()-before.elapsedMs;
  if(Math.abs(wallElapsed-monotonicElapsed)<=250)return;
  updateNtpStatus({state:'stale',usingNetworkTime:false,lastError:'Wall and monotonic clocks diverged while app was backgrounded'});
  browserTimeLastAttemptMs=0;
  void syncBrowserNetworkTime(true).then(ok=>{
    if(!ok&&shellState.ntpStatus.state==='stale'){browserTimeLastAttemptMs=0;void syncBrowserNetworkTime(true);}
  });
}

function missionSpec(){return MISSION}
function applyMissionButton(){document.body.classList.add('spacecraft-cm')}
function rememberRunMode(next){if(!shellState.dream)store.set('runMode',next)}
function updateModeButton(){
  const b=$('mode-toggle');if(!b)return;
  const mode=String(shellState.mode||'clock');
  const busy=mode==='agc-loading'||mode==='relay-show';
  b.textContent=mode==='agc'?'CM':(mode==='agc-loading'?'CM LOAD':(mode==='relay-show'?'RLY TEST':'CLOCK'));
  b.disabled=busy;
  b.setAttribute('aria-pressed',mode==='agc'?'true':'false');
}
function updateHapticsButton(){
  const b=$('haptics');if(!b)return;
  b.textContent=shellState.relayHaptics?'ON':'OFF';
  b.setAttribute('aria-pressed',shellState.relayHaptics?'true':'false');
}
function updateDreamOptionVisibility(){
  const b=$('dreambright');if(!b)return;
  b.hidden=!(window.TimeBridge&&!shellState.dream);
}
let updateButtonHeld=false,lastUpdateStatus='CHECK FOR UPDATE';
function renderUpdateStatus(){
  const b=$('update'),talkback=$('update-talkback');if(!b||!talkback)return;
  const text=lastUpdateStatus;
  const active=text==='CHECKING'||text.startsWith('DOWNLOADING')||text.startsWith('READY TO INSTALL')||text==='UPDATE CHECK BUSY';
  const current=text.startsWith('UP TO DATE')||text.startsWith('UPDATED TO')||text==='CHECK FOR UPDATE';
  const state=updateButtonHeld?'barber':(current?'gray':(active?'barber':'red'));
  talkback.dataset.state=state;
  talkback.setAttribute('aria-label','Software: '+(updateButtonHeld?'CHECK PRESSED':text));
  talkback.title=updateButtonHeld?'CHECK PRESSED':text;
  b.textContent='CHECK';
  b.disabled=text==='CHECKING'||text.startsWith('DOWNLOADING');
}
function nativeUpdateStatus(value){
  lastUpdateStatus=String(value||'UPDATE ERROR').toUpperCase();
  renderUpdateStatus();
}
function showControls(){
  if(shellState.dream||shellState.displayOnly)return;
  updateModeButton();updateHapticsButton();updateDreamOptionVisibility();
  document.body.classList.add('controls-visible');
}
function hideControls(){document.body.classList.remove('controls-visible')}
let appShellInitialized=false;
function initializeAppShell(api,services){
  if(appShellInitialized)return false;
  const renderer=services&&services.renderer;
  const environment=services&&services.environment;
  const audio=services&&services.audio;
  const clock=services&&services.clock;
  const snapshot=services&&services.snapshot;
  function requestRelayAudioStart(playConfirmation=false){
    const ctx=audio.ensure();if(!ctx)return;
    const confirm=()=>{if(playConfirmation&&shellState.tickSound&&ctx.state==='running')audio.playBurst(1)};
    if(ctx.state==='running'){confirm();return}
    if(typeof ctx.resume!=='function')return;
    try{
      const resumed=ctx.resume();
      if(resumed&&typeof resumed.then==='function')resumed.then(confirm).catch(()=>{});
      else confirm();
    }catch(_){}
  }
  if(!api
      || typeof api.enterAgc!=='function'
      || typeof api.enterClock!=='function'
      || typeof api.setAppVisible!=='function'
      || typeof api.saveAgcState!=='function'
      || !renderer||typeof renderer.set2!=='function'||typeof renderer.clearLamps!=='function'
      || !environment||typeof environment.applyDim!=='function'||typeof environment.updateDreamEnvironment!=='function'
      || !audio||typeof audio.ensure!=='function'||typeof audio.applySetting!=='function'||typeof audio.playBurst!=='function'
      || !clock||typeof clock.tick!=='function'||typeof clock.syncFace!=='function'
      || !snapshot||typeof snapshot.lastAutosaveAt!=='function'){
    throw new Error('Application service graph unavailable during shell initialization');
  }
  appShellInitialized=true;
  let holdTimer=0,tapHideControls=false;
  const controlsPanel=$('controls'),auxTools=document.querySelector('.options-tools');
  if(controlsPanel&&auxTools){
    function syncAuxToolsPosition(){
      if(!auxTools.open){controlsPanel.classList.remove('aux-menu-below');return}
      const summary=auxTools.querySelector('summary'),popup=auxTools.querySelector('.options-tools-menu');
      if(!summary||!popup)return;
      const panelRect=controlsPanel.getBoundingClientRect(),summaryRect=summary.getBoundingClientRect(),popupHeight=popup.getBoundingClientRect().height;
      const aboveSpace=summaryRect.top-panelRect.top,belowSpace=panelRect.bottom-summaryRect.bottom;
      controlsPanel.classList.toggle('aux-menu-below',aboveSpace+0.5<popupHeight&&belowSpace+0.5>=popupHeight);
    }
    auxTools.addEventListener('toggle',syncAuxToolsPosition);
    controlsPanel.addEventListener('scroll',syncAuxToolsPosition,{passive:true});
    addEventListener('resize',syncAuxToolsPosition,{passive:true});
  }
  document.addEventListener('pointerdown',e=>{
    tapHideControls=false;
    if(shellState.dream)return;
    if(shellState.displayOnly){holdTimer=setTimeout(()=>{shellState.displayOnly=false;environment.applyDisplayOnly();showControls()},1800);return}
    if(e.target.closest('.app-controls'))return;
    if(document.body.classList.contains('controls-visible')){
      if(!e.target.closest('[data-key]'))tapHideControls=true;
      return;
    }
    if(e.target.closest('[data-key]'))return;
    holdTimer=setTimeout(()=>{tapHideControls=false;showControls()},620);
  },{passive:true});
  document.addEventListener('pointerup',()=>{clearTimeout(holdTimer);if(tapHideControls)hideControls();tapHideControls=false},{passive:true});
  document.addEventListener('pointercancel',()=>{clearTimeout(holdTimer);tapHideControls=false},{passive:true});
  document.addEventListener('visibilitychange',()=>{const visible=!document.hidden;api.setAppVisible(visible);refreshNetworkTimeOnVisibility(visible)});
  addEventListener('pagehide',()=>{const core=shellCore();if(shellState.mode==='agc'&&core){core.stop();api.saveAgcState('page hide')}});
  $('dim').addEventListener('click',()=>{shellState.dim=!shellState.dim;environment.applyDim();showControls()});
  $('dreambright').addEventListener('click',()=>{environment.cycleDreamMode();showControls()});
  $('sound').addEventListener('click',()=>{shellState.tickSound=!shellState.tickSound;audio.applySetting();if(shellState.tickSound)requestRelayAudioStart(true);showControls()});
  const hapticsButton=$('haptics');if(hapticsButton)hapticsButton.addEventListener('click',()=>{shellState.relayHaptics=!shellState.relayHaptics;store.set('relayHapticsV1',shellState.relayHaptics?'1':'0');updateHapticsButton();showControls()});
  $('display').addEventListener('click',()=>{shellState.displayOnly=true;environment.applyDisplayOnly()});
  $('mode-toggle').addEventListener('click',()=>{
    if(shellState.mode==='agc-loading'||shellState.mode==='relay-show')return;
    const request=shellState.mode==='agc'?api.enterClock():api.enterAgc();
    updateModeButton();
    Promise.resolve(request).catch(error=>console.error('Mode transition failed',error)).finally(()=>{updateModeButton();showControls()});
  });
  const updateButton=$('update');if(updateButton){
    const releaseUpdateCheck=()=>{if(!updateButtonHeld)return;updateButtonHeld=false;renderUpdateStatus()};
    updateButton.addEventListener('pointerdown',event=>{
      if(updateButton.disabled)return;
      updateButtonHeld=true;
      renderUpdateStatus();
      try{updateButton.setPointerCapture(event.pointerId)}catch(_){}
    });
    updateButton.addEventListener('pointerup',releaseUpdateCheck);
    updateButton.addEventListener('pointercancel',releaseUpdateCheck);
    updateButton.addEventListener('lostpointercapture',releaseUpdateCheck);
    updateButton.addEventListener('click',()=>{
      nativeUpdateStatus('CHECKING');
      try{
        if(window.UpdateBridge&&typeof UpdateBridge.checkNow==='function')UpdateBridge.checkNow();
        else nativeUpdateStatus('ANDROID ONLY');
      }catch(_){nativeUpdateStatus('UPDATE ERROR')}
      showControls();
    });
  }
  document.addEventListener('pointerdown',()=>{if(shellState.tickSound)requestRelayAudioStart(false)},{passive:true});

  document.body.classList.toggle('dream',shellState.dream);
  if(!shellState.dream&&!shellState.displayOnly&&store.get('optionsHintV1')!=='1'){
    document.body.classList.add('first-run');
    setTimeout(()=>{document.body.classList.remove('first-run');store.set('optionsHintV1','1')},4500);
  }
  updateModeButton();updateHapticsButton();updateDreamOptionVisibility();refreshTimeStatus();environment.applyDim();environment.applyDreamMode();environment.applyDisplayOnly();audio.applySetting();applyMissionButton();renderer.clearLamps();renderer.set2('prog','00');show(shellState.verb,shellState.noun);clock.syncFace();
  setInterval(clock.tick,20);
  setInterval(refreshTimeStatus,60000);
  addEventListener('online',()=>{browserTimeLastAttemptMs=0;void syncBrowserNetworkTime(true)},{passive:true});
  setInterval(()=>{const core=shellCore();if(shellState.mode==='agc'&&core&&core.running&&shellState.appVisible&&Date.now()-snapshot.lastAutosaveAt()>15000)api.saveAgcState('periodic autosave')},5000);
  if(!shellState.dream&&!restoreAgcOnLoad)rememberRunMode('clock');
  if(restoreAgcOnLoad)setTimeout(()=>{void api.enterAgc()},0);
  if(shellState.dream){
    environment.updateDreamEnvironment();setInterval(environment.updateDreamEnvironment,15000);
    const pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],dsky=$('dsky');let i=0;
    setInterval(()=>{const p=pos[i++%pos.length];dsky.style.setProperty('--drift-x',p[0]+'px');dsky.style.setProperty('--drift-y',p[1]+'px')},60000);
  }
  return true;
}

window.AGCDSKY_SHELL=Object.freeze({
  element:$,
  store,
  show,
  accurateTime,
  accurateDate,
  clockTimeLabel,
  updateNtpStatus,
  loadNativeNtpStatus,
  refreshTimeStatus,
  syncBrowserNetworkTime,
  requestNetworkTimeSync,
  missionSpec,
  rememberRunMode,
  updateModeControl:updateModeButton,
  updateHapticsControl:updateHapticsButton,
  nativeUpdateStatus,
  showControls,
  initialize:initializeAppShell
});
