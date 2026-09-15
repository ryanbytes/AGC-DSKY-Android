'use strict';

// Application shell/configuration authority. Subsystem implementations live in
// dedicated runtime files; mutable cross-runtime session fields live in
// app-state-runtime.js instead of implicit classic-script globals.
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
let controlsTimer=0;

function shellCore(){const session=window.AGCDSKY_CORE_SESSION;return session?session.core:null}
function show(v,n){shellState.verb=v;shellState.noun=n;set2('verb',v.padStart(2,' '));set2('noun',n.padStart(2,' '))}

function accurateTime(){return Date.now()+(Number(shellState.ntpStatus.offsetMs)||0)}
function accurateDate(){return new Date(accurateTime())}
function clockTimeLabel(){return shellState.ntpStatus.state==='synced'?'PHONE CLOCK · NTP TIME':shellState.ntpStatus.state==='stale'?'PHONE CLOCK · NTP OFFSET STALE':'PHONE CLOCK · ANDROID WALL TIME'}
function updateNtpStatus(value){try{const parsed=typeof value==='string'?JSON.parse(value):value;if(parsed&&typeof parsed==='object'){shellState.ntpStatus={...shellState.ntpStatus,...parsed};if(shellState.mode==='clock')$('mode').textContent=clockTimeLabel()}}catch(_){/* malformed bridge data must not affect the DSKY */}}
function loadNativeNtpStatus(){try{if(window.TimeBridge&&typeof TimeBridge.getStatus==='function')updateNtpStatus(TimeBridge.getStatus())}catch(_){/* bridge is unavailable outside Android */}}

function missionSpec(){return MISSIONS[shellState.selectedMission]}
function applyMissionButton(){const b=$('mission');if(b)b.textContent=missionSpec().short}
function rememberRunMode(next){if(!shellState.dream)store.set('runMode',next)}
function cycleMission(){shellState.selectedMission='comanche055';store.set('agcMission','comanche055');applyMissionButton()}

function showControls(){if(shellState.dream||shellState.displayOnly)return;document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5500)}

let appShellInitialized=false;
function initializeAppShell(){
  if(appShellInitialized)return false;
  appShellInitialized=true;
  let holdTimer=0;
  document.addEventListener('pointerdown',e=>{
    if(shellState.dream)return;
    if(shellState.displayOnly){holdTimer=setTimeout(()=>{shellState.displayOnly=false;applyDisplayOnly();showControls()},1800);return}
    if(e.target.closest('[data-key],.app-controls'))return;
    holdTimer=setTimeout(showControls,620);
  },{passive:true});
  document.addEventListener('pointerup',()=>clearTimeout(holdTimer),{passive:true});
  document.addEventListener('pointercancel',()=>clearTimeout(holdTimer),{passive:true});
  document.addEventListener('visibilitychange',()=>setAppVisible(!document.hidden));
  addEventListener('pagehide',()=>{const core=shellCore();if(shellState.mode==='agc'&&core){core.stop();saveAgcState('page hide')}});
  $('dim').addEventListener('click',()=>{shellState.dim=!shellState.dim;applyDim();showControls()});
  $('dreambright').addEventListener('click',()=>{cycleDreamMode();showControls()});
  $('sound').addEventListener('click',()=>{ensureAudio();shellState.tickSound=!shellState.tickSound;applyTickSound();if(shellState.tickSound)playRelayBurst(1);showControls()});
  $('display').addEventListener('click',()=>{shellState.displayOnly=true;applyDisplayOnly()});
  $('agc').addEventListener('click',()=>{enterAgc();showControls()});
  $('clock').addEventListener('click',()=>{enterClock(clockTimeLabel(),true);showControls()});
  document.addEventListener('pointerdown',()=>{if(shellState.tickSound)ensureAudio()},{passive:true});

  document.body.classList.toggle('dream',shellState.dream);
  if(!shellState.dream&&!shellState.displayOnly&&store.get('hinted')!=='1'){
    document.body.classList.add('first-run');
    setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200);
  }
  loadNativeNtpStatus();applyDim();applyDreamMode();applyDisplayOnly();applyTickSound();applyMissionButton();clearLamps();set2('prog','00');show(shellState.verb,shellState.noun);syncClockFace();
  setInterval(tick,20);
  setInterval(loadNativeNtpStatus,60000);
  setInterval(()=>{const core=shellCore();if(shellState.mode==='agc'&&core&&core.running&&shellState.appVisible&&Date.now()-lastAutosaveAt>15000)saveAgcState('periodic autosave')},5000);
  if(!shellState.dream&&!restoreAgcOnLoad)rememberRunMode('clock');
  if(restoreAgcOnLoad)setTimeout(()=>enterAgc(),0);
  if(shellState.dream){
    updateDreamEnvironment();setInterval(updateDreamEnvironment,15000);
    const pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],dsky=$('dsky');let i=0;
    setInterval(()=>{const p=pos[i++%pos.length];dsky.style.setProperty('--drift-x',p[0]+'px');dsky.style.setProperty('--drift-y',p[1]+'px')},60000);
  }
  return true;
}
