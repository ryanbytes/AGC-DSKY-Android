'use strict';

// Application shell/configuration authority. Subsystem implementations live in
// the dedicated runtime files loaded after this one; this file owns the shared
// app configuration, NTP clock facade, controls, and startup scheduling.
const q=new URLSearchParams(location.search),dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},remove(k){try{localStorage.removeItem(k);return true}catch(e){return false}}};
const oldDreamBright=store.get('dreamBright')==='1';
const MISSIONS=Object.freeze({
  comanche055:{label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'}
});
let selectedMission='comanche055';store.set('agcMission','comanche055');
const restoreAgcOnLoad=!dream&&store.get('runMode')!=='clock';
let dreamMode=store.get('dreamMode')||(oldDreamBright?'bright':'dim');
let verb='16',noun='65',mode='clock',
    dim=store.get('dim')==='1',
    tickSound=store.get('audioTickV4')!=='0',
    displayOnly=dream||store.get('displayOnly')==='1',
    controlsTimer=0;

function show(v,n){verb=v;noun=n;set2('verb',v.padStart(2,' '));set2('noun',n.padStart(2,' '))}

let ntpStatus={server:'time.cloudflare.com',offsetMs:0,lastSyncUtcMs:0,roundTripMs:-1,ageMs:-1,state:'unavailable'};
function accurateTime(){return Date.now()+(Number(ntpStatus.offsetMs)||0)}
function accurateDate(){return new Date(accurateTime())}
function clockTimeLabel(){return ntpStatus.state==='synced'?'PHONE CLOCK · NTP TIME':ntpStatus.state==='stale'?'PHONE CLOCK · NTP OFFSET STALE':'PHONE CLOCK · ANDROID WALL TIME'}
function updateNtpStatus(value){try{const parsed=typeof value==='string'?JSON.parse(value):value;if(parsed&&typeof parsed==='object'){ntpStatus={...ntpStatus,...parsed};if(mode==='clock')$('mode').textContent=clockTimeLabel()}}catch(_){/* malformed bridge data must not affect the DSKY */}}
function loadNativeNtpStatus(){try{if(window.TimeBridge&&typeof TimeBridge.getStatus==='function')updateNtpStatus(TimeBridge.getStatus())}catch(_){/* bridge is unavailable outside Android */}}

function missionSpec(){return MISSIONS[selectedMission]}
function applyMissionButton(){const b=$('mission');if(b)b.textContent=missionSpec().short}
function rememberRunMode(next){if(!dream)store.set('runMode',next)}
function cycleMission(){selectedMission='comanche055';store.set('agcMission','comanche055');applyMissionButton()}

function showControls(){if(dream||displayOnly)return;document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5500)}

let appShellInitialized=false;
function initializeAppShell(){
  if(appShellInitialized)return false;
  appShellInitialized=true;
  let holdTimer=0;
  document.addEventListener('pointerdown',e=>{
    if(dream)return;
    if(displayOnly){holdTimer=setTimeout(()=>{displayOnly=false;applyDisplayOnly();showControls()},1800);return}
    if(e.target.closest('[data-key],.app-controls'))return;
    holdTimer=setTimeout(showControls,620);
  },{passive:true});
  document.addEventListener('pointerup',()=>clearTimeout(holdTimer),{passive:true});
  document.addEventListener('pointercancel',()=>clearTimeout(holdTimer),{passive:true});
  document.addEventListener('visibilitychange',()=>setAppVisible(!document.hidden));
  addEventListener('pagehide',()=>{if(mode==='agc'&&agcCore){agcCore.stop();saveAgcState('page hide')}});
  $('dim').addEventListener('click',()=>{dim=!dim;applyDim();showControls()});
  $('dreambright').addEventListener('click',()=>{cycleDreamMode();showControls()});
  $('sound').addEventListener('click',()=>{ensureAudio();tickSound=!tickSound;applyTickSound();if(tickSound)playRelayBurst(1);showControls()});
  $('display').addEventListener('click',()=>{displayOnly=true;applyDisplayOnly()});
  $('agc').addEventListener('click',()=>{enterAgc();showControls()});
  $('clock').addEventListener('click',()=>{enterClock(clockTimeLabel(),true);showControls()});
  document.addEventListener('pointerdown',()=>{if(tickSound)ensureAudio()},{passive:true});

  document.body.classList.toggle('dream',dream);
  if(!dream&&!displayOnly&&store.get('hinted')!=='1'){
    document.body.classList.add('first-run');
    setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200);
  }
  loadNativeNtpStatus();applyDim();applyDreamMode();applyDisplayOnly();applyTickSound();applyMissionButton();clearLamps();set2('prog','00');show(verb,noun);syncClockFace();
  setInterval(tick,20);
  setInterval(loadNativeNtpStatus,60000);
  setInterval(()=>{if(mode==='agc'&&agcCore&&agcCore.running&&appVisible&&Date.now()-lastAutosaveAt>15000)saveAgcState('periodic autosave')},5000);
  if(!dream&&!restoreAgcOnLoad)rememberRunMode('clock');
  if(restoreAgcOnLoad)setTimeout(()=>enterAgc(),0);
  if(dream){
    updateDreamEnvironment();setInterval(updateDreamEnvironment,15000);
    const pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],dsky=$('dsky');let i=0;
    setInterval(()=>{const p=pos[i++%pos.length];dsky.style.setProperty('--drift-x',p[0]+'px');dsky.style.setProperty('--drift-y',p[1]+'px')},60000);
  }
  return true;
}
