'use strict';

// Application shell/configuration authority. Core runtimes consume the explicit
// AGCDSKY_SHELL service; classic helper bindings remain temporarily available to
// late presentation/fidelity layers until that separate compatibility pass.
const shellState=window.AGCDSKY_APP_STATE;
if(!shellState)throw new Error('Shared application state unavailable');
const q=new URLSearchParams(location.search);
shellState.dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},remove(k){try{localStorage.removeItem(k);return true}catch(e){return false}}};
const oldDreamBright=store.get('dreamBright')==='1';
const MISSIONS=Object.freeze({
  comanche055:{label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'}
});
shellState.selectedMission='comanche055';
shellState.dreamMode=store.get('dreamMode')||(oldDreamBright?'bright':'dim');
shellState.dim=store.get('dim')==='1';
shellState.tickSound=store.get('audioTickV4')!=='0';
shellState.displayOnly=shellState.dream||store.get('displayOnly')==='1';
store.set('agcMission','comanche055');
const restoreAgcOnLoad=!shellState.dream&&store.get('runMode')!=='clock';

function shellCore(){const session=window.AGCDSKY_CORE_SESSION;return session?session.core:null}
function show(v,n){
  shellState.verb=v;shellState.noun=n;
  const renderer=window.AGCDSKY_RENDERER;
  if(renderer){renderer.set2('verb',v.padStart(2,' '));renderer.set2('noun',n.padStart(2,' '));return}
  if(typeof set2==='function'){set2('verb',v.padStart(2,' '));set2('noun',n.padStart(2,' '))}
}

function accurateTime(){return Date.now()+(Number(shellState.ntpStatus.offsetMs)||0)}
function accurateDate(){return new Date(accurateTime())}
function clockTimeLabel(){return shellState.ntpStatus.state==='synced'?'PHONE CLOCK · NTP TIME':shellState.ntpStatus.state==='stale'?'PHONE CLOCK · NTP OFFSET STALE':'PHONE CLOCK · ANDROID WALL TIME'}
function updateNtpStatus(value){try{const parsed=typeof value==='string'?JSON.parse(value):value;if(parsed&&typeof parsed==='object'){shellState.ntpStatus={...shellState.ntpStatus,...parsed};if(shellState.mode==='clock')$('mode').textContent=clockTimeLabel()}}catch(_){/* malformed bridge data must not affect the DSKY */}}
function loadNativeNtpStatus(){try{if(window.TimeBridge&&typeof TimeBridge.getStatus==='function')updateNtpStatus(TimeBridge.getStatus())}catch(_){/* bridge is unavailable outside Android */}}

function missionSpec(){return MISSIONS[shellState.selectedMission]}
function applyMissionButton(){const b=$('mission');if(b)b.textContent=missionSpec().short}
function rememberRunMode(next){if(!shellState.dream)store.set('runMode',next)}
function cycleMission(){shellState.selectedMission='comanche055';store.set('agcMission','comanche055');applyMissionButton()}
function showControls(){if(shellState.dream||shellState.displayOnly)return;document.body.classList.add('controls-visible')}
function hideControls(){document.body.classList.remove('controls-visible')}

let appShellInitialized=false;
function initializeAppShell(api,services){
  if(appShellInitialized)return false;
  const renderer=services&&services.renderer;
  const environment=services&&services.environment;
  const audio=services&&services.audio;
  const clock=services&&services.clock;
  const snapshot=services&&services.snapshot;
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
  document.addEventListener('visibilitychange',()=>api.setAppVisible(!document.hidden));
  addEventListener('pagehide',()=>{const core=shellCore();if(shellState.mode==='agc'&&core){core.stop();api.saveAgcState('page hide')}});
  $('dim').addEventListener('click',()=>{shellState.dim=!shellState.dim;environment.applyDim();showControls()});
  $('dreambright').addEventListener('click',()=>{environment.cycleDreamMode();showControls()});
  $('sound').addEventListener('click',()=>{audio.ensure();shellState.tickSound=!shellState.tickSound;audio.applySetting();if(shellState.tickSound)audio.playBurst(1);showControls()});
  $('display').addEventListener('click',()=>{shellState.displayOnly=true;environment.applyDisplayOnly()});
  $('agc').addEventListener('click',()=>{void api.enterAgc();showControls()});
  $('clock').addEventListener('click',()=>{void api.enterClock();showControls()});
  document.addEventListener('pointerdown',()=>{if(shellState.tickSound)audio.ensure()},{passive:true});

  document.body.classList.toggle('dream',shellState.dream);
  if(!shellState.dream&&!shellState.displayOnly&&store.get('hinted')!=='1'){
    document.body.classList.add('first-run');
    setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200);
  }
  loadNativeNtpStatus();environment.applyDim();environment.applyDreamMode();environment.applyDisplayOnly();audio.applySetting();applyMissionButton();renderer.clearLamps();renderer.set2('prog','00');show(shellState.verb,shellState.noun);clock.syncFace();
  setInterval(clock.tick,20);
  setInterval(loadNativeNtpStatus,60000);
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
  missionSpec,
  rememberRunMode,
  cycleMission,
  showControls,
  initialize:initializeAppShell
});
