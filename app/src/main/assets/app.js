const q=new URLSearchParams(location.search),dream=q.get('dream')==='1';
const $=x=>document.getElementById(x);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},remove(k){try{localStorage.removeItem(k);return true}catch(e){return false}}};
const oldDreamBright=store.get('dreamBright')==='1';
const MISSIONS=Object.freeze({
  comanche055:{label:'COMANCHE055',short:'CM C55',rope:'Comanche055.bin'}
});
let selectedMission='comanche055'; store.set('agcMission','comanche055');
const restoreAgcOnLoad=!dream&&store.get('runMode')!=='clock';
let dreamMode=store.get('dreamMode')||(oldDreamBright?'bright':'dim');
let verb='16',noun='65',mode='clock',
    dim=store.get('dim')==='1',
    tickSound=store.get('audioTickV4')!=='0',
    displayOnly=dream||store.get('displayOnly')==='1',
    controlsTimer=0;
const agcRelayWords={};
let agcCh11=0,agcCh13=0,agcCh163=0,agcSuspendedForClock=false;
let agcCore=null,agcLoadedMission='',appVisible=!document.hidden,agcPausedForVisibility=false;
const SNAPSHOT_KEY='agcSnapshotV1',SNAPSHOT_META_KEY='agcSnapshotMetaV1';
let lastSnapshotError='',lastSnapshotAction='none',lastSnapshotVerify=null,autosaveTimer=0,lastAutosaveAt=0;

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
function enterClock(status=clockTimeLabel(),preserveAgc=false){
  cancelLampTest();
  const canResume=preserveAgc&&mode==='agc'&&agcCore&&agcLoadedMission===selectedMission;
  if(agcCore)agcCore.stop();
  if(canResume)saveAgcState('suspend for clock');
  agcSuspendedForClock=!!canResume;
  agcPausedForVisibility=false;mode='clock';rememberRunMode('clock');
  $('agc').textContent='AGC MODE';$('mode').textContent=status;clearLamps();set2('prog','00');verb='16';noun='65';show(verb,noun);stopClockQueue();syncClockFace();
}

const RELAY_DIGIT={0:' ',21:'0',3:'1',25:'2',27:'3',15:'4',30:'5',28:'6',19:'7',29:'8',31:'9'};
const agcDisplay={
  prog:[' ',' '],verb:[' ',' '],noun:[' ',' '],
  r1:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},
  r2:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},
  r3:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false}
};
function relayDigit(code){return RELAY_DIGIT[code]??' '}
function regSign(reg){return reg.plus?'+':reg.minus?'-':' '}
function renderAgcReg(name){const r=agcDisplay[name];setReg(name,regSign(r),r.digits.join(''))}
function resetAgcFace(){
  agcDisplay.prog.fill(' ');agcDisplay.verb.fill(' ');agcDisplay.noun.fill(' ');
  ['r1','r2','r3'].forEach(name=>{agcDisplay[name].digits.fill(' ');agcDisplay[name].plus=false;agcDisplay[name].minus=false});
  Object.keys(agcRelayWords).forEach(key=>delete agcRelayWords[key]);
  agcCh11=0;agcCh13=0;agcCh163=0;
  set2('prog','  ');set2('verb','  ');set2('noun','  ');['r1','r2','r3'].forEach(renderAgcReg);clearLamps();
}
function decodeChannel10(value){
  const relay=(value>>11)&0o17,b=(value>>10)&1,c=(value>>5)&0o37,d=value&0o37,low11=value&0o3777;
  if(relay>=1&&relay<=12){const prior=agcRelayWords[relay];if(prior!==undefined&&tickSound){const n=popcount11(prior^low11);if(n)playRelayBurst(n)}agcRelayWords[relay]=low11}
  switch(relay){
    case 12:setLamp('vel',value&0o00004);setLamp('noatt',value&0o00010);setLamp('alt',value&0o00020);setLamp('gimbal',value&0o00040);setLamp('tracker',value&0o00200);setLamp('prog',value&0o00400);break;
    case 11:agcDisplay.prog[0]=relayDigit(c);agcDisplay.prog[1]=relayDigit(d);set2('prog',agcDisplay.prog.join(''));break;
    case 10:agcDisplay.verb[0]=relayDigit(c);agcDisplay.verb[1]=relayDigit(d);set2('verb',agcDisplay.verb.join(''));break;
    case 9:agcDisplay.noun[0]=relayDigit(c);agcDisplay.noun[1]=relayDigit(d);set2('noun',agcDisplay.noun.join(''));break;
    case 8:agcDisplay.r1.digits[0]=relayDigit(d);renderAgcReg('r1');break;
    case 7:agcDisplay.r1.plus=!!b;agcDisplay.r1.digits[1]=relayDigit(c);agcDisplay.r1.digits[2]=relayDigit(d);renderAgcReg('r1');break;
    case 6:agcDisplay.r1.minus=!!b;agcDisplay.r1.digits[3]=relayDigit(c);agcDisplay.r1.digits[4]=relayDigit(d);renderAgcReg('r1');break;
    case 5:agcDisplay.r2.plus=!!b;agcDisplay.r2.digits[0]=relayDigit(c);agcDisplay.r2.digits[1]=relayDigit(d);renderAgcReg('r2');break;
    case 4:agcDisplay.r2.minus=!!b;agcDisplay.r2.digits[2]=relayDigit(c);agcDisplay.r2.digits[3]=relayDigit(d);renderAgcReg('r2');break;
    case 3:agcDisplay.r2.digits[4]=relayDigit(c);agcDisplay.r3.digits[0]=relayDigit(d);renderAgcReg('r2');renderAgcReg('r3');break;
    case 2:agcDisplay.r3.plus=!!b;agcDisplay.r3.digits[1]=relayDigit(c);agcDisplay.r3.digits[2]=relayDigit(d);renderAgcReg('r3');break;
    case 1:agcDisplay.r3.minus=!!b;agcDisplay.r3.digits[3]=relayDigit(c);agcDisplay.r3.digits[4]=relayDigit(d);renderAgcReg('r3');break;
  }
}
function updateAgcCompActy(){
  setLamp('comp',!!(agcCh11&0o00002));
}
function decodeChannel11(value){agcCh11=value;updateAgcCompActy();setLamp('uplink',value&0o00004)}
function decodeChannel13(value){agcCh13=value}
function decodeChannel163(value){
  agcCh163=value;setLamp('temp',value&0o00010);setLamp('keyrel',value&0o00020);document.body.classList.toggle('vn-flash-off',!!(value&0o00040));setLamp('oprerr',value&0o00100);setLamp('restart',value&0o00200);setLamp('stby',value&0o00400);document.body.classList.toggle('el-off',!!(value&0o01000));
}
function onAgcChannel(channel,value){
  if(mode!=='agc'&&mode!=='agc-loading')return;
  if(channel===0o10)decodeChannel10(value);else if(channel===0o11)decodeChannel11(value);else if(channel===0o13)decodeChannel13(value);else if(channel===0o163)decodeChannel163(value);
}
function agcFailure(error){
  agcSuspendedForClock=false;console.error('AGC core stopped',error);enterClock('AGC ERROR · PHONE CLOCK',false);
}
function renderAgcSnapshot(){
  clearLamps();
  set2('prog',agcDisplay.prog.join(''));set2('verb',agcDisplay.verb.join(''));set2('noun',agcDisplay.noun.join(''));
  ['r1','r2','r3'].forEach(renderAgcReg);
  const l12=agcRelayWords[12]||0;
  setLamp('vel',l12&0o00004);setLamp('noatt',l12&0o00010);setLamp('alt',l12&0o00020);setLamp('gimbal',l12&0o00040);setLamp('tracker',l12&0o00200);setLamp('prog',l12&0o00400);
  updateAgcCompActy();setLamp('uplink',agcCh11&0o00004);decodeChannel163(agcCh163);
}
function snapshotUiState(){
  return {
    display:JSON.parse(JSON.stringify(agcDisplay)),
    relayWords:{...agcRelayWords},ch11:agcCh11,ch13:agcCh13,ch163:agcCh163
  };
}
function applySnapshotUi(ui){
  if(!ui||!ui.display)return;
  for(const k of ['prog','verb','noun'])if(Array.isArray(ui.display[k]))agcDisplay[k]=ui.display[k].slice(0,2);
  for(const k of ['r1','r2','r3'])if(ui.display[k])agcDisplay[k]={digits:(ui.display[k].digits||[]).slice(0,5),plus:!!ui.display[k].plus,minus:!!ui.display[k].minus};
  Object.keys(agcRelayWords).forEach(k=>delete agcRelayWords[k]);Object.assign(agcRelayWords,ui.relayWords||{});
  agcCh11=Number(ui.ch11)||0;agcCh13=Number(ui.ch13)||0;agcCh163=Number(ui.ch163)||0;
}
function savedSnapshotInfo(){
  try{const x=JSON.parse(store.get(SNAPSHOT_META_KEY)||'null');return x&&x.schema===1?x:null}catch(_){return null}
}
function saveAgcState(reason='manual'){
  if(mode!=='agc'){lastSnapshotError='AGC mode required';lastSnapshotAction='save ignored';return false}
  if(!agcCore||agcLoadedMission!==selectedMission||typeof agcCore.exportSnapshot!=='function')return false;
  try{
    const timestamp=Date.now(),payload={schema:1,mission:selectedMission,coreVersion:agcCore.version(),timestamp,reason,ui:snapshotUiState(),core:agcCore.exportSnapshot()};
    if(!store.set(SNAPSHOT_KEY,JSON.stringify(payload)))throw new Error('local storage rejected snapshot');
    store.set(SNAPSHOT_META_KEY,JSON.stringify({schema:1,mission:selectedMission,timestamp,reason,sourceMode:'agc',coreVersion:payload.coreVersion,bytes:payload.core.byteLength,fingerprint:payload.core.fingerprint||null}));
    if(reason.startsWith('autosave:')||reason==='periodic autosave')lastAutosaveAt=timestamp;
    lastSnapshotError='';lastSnapshotAction='saved';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='save failed';console.error('AGC snapshot save',error);return false}
}
function restoreSavedAgcState(){
  if(!agcCore||typeof agcCore.importSnapshot!=='function')return false;
  const raw=store.get(SNAPSHOT_KEY);if(!raw)return false;
  try{
    const payload=JSON.parse(raw);
    if(!payload||payload.schema!==1||payload.mission!==selectedMission)throw new Error('snapshot mission/schema mismatch');
    agcCore.importSnapshot(payload.core);applySnapshotUi(payload.ui);
    lastSnapshotError='';lastSnapshotAction='restored';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='restore failed';store.remove(SNAPSHOT_KEY);store.remove(SNAPSHOT_META_KEY);console.error('AGC snapshot restore',error);return false}
}
function clearSavedAgcState(){store.remove(SNAPSHOT_KEY);store.remove(SNAPSHOT_META_KEY);lastSnapshotError='';lastSnapshotAction='cleared';return true}
function verifySnapshotRoundTrip(){
  if(!agcCore||agcLoadedMission!==selectedMission||typeof agcCore.exportSnapshot!=='function'||typeof agcCore.importSnapshot!=='function')return {ok:false,error:'AGC core not ready'};
  const wasRunning=!!agcCore.running,ui=snapshotUiState();
  try{
    if(wasRunning)agcCore.stop();
    const snap=agcCore.exportSnapshot(),before=snap.fingerprint||agcCore.snapshotFingerprint?.();
    agcCore.importSnapshot(snap);applySnapshotUi(ui);const after=agcCore.snapshotFingerprint?.();
    const ok=!before||before===after;lastSnapshotVerify={ok,before,after,timestamp:Date.now()};
    if(wasRunning&&appVisible)agcCore.start(1);renderAgcSnapshot();
    return {...lastSnapshotVerify};
  }catch(error){
    lastSnapshotVerify={ok:false,error:String(error&&error.message||error),timestamp:Date.now()};
    if(wasRunning&&appVisible&&!agcCore.running)agcCore.start(1);
    return {...lastSnapshotVerify};
  }
}
function scheduleAgcAutosave(reason='activity'){
  if(mode!=='agc'||!agcCore)return;
  clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=0;if(mode==='agc'&&agcCore&&agcCore.running)saveAgcState('autosave: '+reason)},1800);
}
function agcAppStatus(){
  const meta=savedSnapshotInfo();
  return {mode,mission:selectedMission,missionLabel:missionSpec().label,loadedMission:agcLoadedMission,coreLoaded:!!agcCore,
    coreRunning:!!(agcCore&&agcCore.running),coreVersion:agcCore?agcCore.version():'not loaded',appVisible,
    channels:{ch011:agcCh11,ch013:agcCh13,ch0163:agcCh163},display:JSON.parse(JSON.stringify(agcDisplay)),
    snapshot:{saved:!!meta,meta,lastAction:lastSnapshotAction,error:lastSnapshotError,lastVerify:lastSnapshotVerify,currentFingerprint:agcCore&&typeof agcCore.snapshotFingerprint==='function'?agcCore.snapshotFingerprint():null,lastAutosaveAt}};
}
async function enterAgc(){
  if(dream||mode==='agc-loading'||mode==='agc')return;
  cancelLampTest();
  const selected=missionSpec();
  if(agcSuspendedForClock&&agcCore&&agcLoadedMission===selectedMission){
    mode='agc';agcSuspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${agcCore.version()}`;renderAgcSnapshot();
    if(appVisible){agcCore.start(1);agcPausedForVisibility=false}else{agcPausedForVisibility=true}
    return;
  }
  mode='agc-loading';stopClockQueue();$('agc').textContent='...';$('mode').textContent=`LOADING ${selected.label} · AGC`;resetAgcFace();
  try{
    if(!agcCore||agcLoadedMission!==selectedMission){
      if(agcCore)agcCore.stop();
      agcCore=new AgcCore({onChannelUpdate:onAgcChannel,onError:agcFailure});
      await agcCore.load({wasmUrl:'yaAGC.wasm',ropeUrl:selected.rope});
      agcLoadedMission=selectedMission;
    }else{
      agcCore.reset();agcCore.configureInputMasks();
    }
    const restored=restoreSavedAgcState();
    mode='agc';agcSuspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${agcCore.version()}${restored?' · STATE RESTORED':''}`;
    if(restored)renderAgcSnapshot();
    if(appVisible){agcCore.start(1);agcPausedForVisibility=false}else{agcPausedForVisibility=true}
  }catch(error){agcFailure(error)}
}
function cycleMission(){selectedMission='comanche055';store.set('agcMission','comanche055');applyMissionButton()}
function setAppVisible(visible){
  appVisible=!!visible;
  if(mode!=='agc'||!agcCore)return;
  if(!appVisible){if(agcCore.running){agcCore.stop();agcPausedForVisibility=true}saveAgcState('app background');return}
  if(agcPausedForVisibility){agcPausedForVisibility=false;agcCore.start(1)}
}
function showControls(){if(dream||displayOnly)return;document.body.classList.add('controls-visible');clearTimeout(controlsTimer);controlsTimer=setTimeout(()=>document.body.classList.remove('controls-visible'),5500)}
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
window.AGCDSKY={agcChannel:onAgcChannel,getCore:()=>agcCore,setAppVisible,getMission:()=>selectedMission,enterClock:()=>enterClock(clockTimeLabel(),true),enterAgc,appStatus:agcAppStatus,saveAgcState,clearSavedAgcState,savedSnapshotInfo,verifySnapshotRoundTrip,scheduleAgcAutosave,accurateTime,accurateDate,ntpStatus:()=>({...ntpStatus}),nativeNtpStatus:updateNtpStatus};
document.body.classList.toggle('dream',dream);
if(!dream&&!displayOnly&&store.get('hinted')!=='1'){document.body.classList.add('first-run');setTimeout(()=>{document.body.classList.remove('first-run');store.set('hinted','1')},3200)}
loadNativeNtpStatus();applyDim();applyDreamMode();applyDisplayOnly();applyTickSound();applyMissionButton();clearLamps();set2('prog','00');show(verb,noun);syncClockFace();setInterval(tick,20);setInterval(loadNativeNtpStatus,60000);setInterval(()=>{if(mode==='agc'&&agcCore&&agcCore.running&&appVisible&&Date.now()-lastAutosaveAt>15000)saveAgcState('periodic autosave')},5000);
if(!dream&&!restoreAgcOnLoad)rememberRunMode('clock');
if(restoreAgcOnLoad)setTimeout(()=>enterAgc(),0);
if(dream){
  updateDreamEnvironment();setInterval(updateDreamEnvironment,15000);
  const pos=[[0,0],[3,-2],[-3,2],[2,3],[-2,-3],[1,-1]],dsky=$('dsky');let i=0;
  setInterval(()=>{const p=pos[i++%pos.length];dsky.style.setProperty('--drift-x',p[0]+'px');dsky.style.setProperty('--drift-y',p[1]+'px')},60000);
}
