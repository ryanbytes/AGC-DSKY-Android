'use strict';

// Authoritative AGC core/mode lifecycle. Shared session mode/mission/command
// fields live in app-state-runtime.js; this module owns core loading and run
// lifecycle only.
const lifecycleState=window.AGCDSKY_APP_STATE;
if(!lifecycleState)throw new Error('Shared application state unavailable');
let agcSuspendedForClock=false;
let agcCore=null,agcLoadedMission='',appVisible=!document.hidden,agcPausedForVisibility=false;

function enterClock(status=clockTimeLabel(),preserveAgc=false){
  cancelLampTest();
  const canResume=preserveAgc&&lifecycleState.mode==='agc'&&agcCore&&agcLoadedMission===lifecycleState.selectedMission;
  if(agcCore)agcCore.stop();
  if(canResume)saveAgcState('suspend for clock');
  agcSuspendedForClock=!!canResume;
  agcPausedForVisibility=false;lifecycleState.mode='clock';rememberRunMode('clock');
  $('agc').textContent='AGC MODE';$('mode').textContent=status;clearLamps();set2('prog','00');lifecycleState.verb='16';lifecycleState.noun='65';show(lifecycleState.verb,lifecycleState.noun);stopClockQueue();syncClockFace();
}
function agcAppStatus(){
  const meta=savedSnapshotInfo();
  return {mode:lifecycleState.mode,mission:lifecycleState.selectedMission,missionLabel:missionSpec().label,loadedMission:agcLoadedMission,coreLoaded:!!agcCore,
    coreRunning:!!(agcCore&&agcCore.running),coreVersion:agcCore?agcCore.version():'not loaded',appVisible,
    channels:{ch011:agcCh11,ch013:agcCh13,ch0163:agcCh163},display:JSON.parse(JSON.stringify(agcDisplay)),
    snapshot:{saved:!!meta,meta,lastAction:lastSnapshotAction,error:lastSnapshotError,lastVerify:lastSnapshotVerify,currentFingerprint:agcCore&&typeof agcCore.snapshotFingerprint==='function'?agcCore.snapshotFingerprint():null,lastAutosaveAt}};
}
async function enterAgc(){
  if(dream||lifecycleState.mode==='agc-loading'||lifecycleState.mode==='agc')return;
  cancelLampTest();
  const selected=missionSpec();
  if(agcSuspendedForClock&&agcCore&&agcLoadedMission===lifecycleState.selectedMission){
    lifecycleState.mode='agc';agcSuspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${agcCore.version()}`;renderAgcSnapshot();
    if(appVisible){agcCore.start(1);agcPausedForVisibility=false}else{agcPausedForVisibility=true}
    return;
  }
  lifecycleState.mode='agc-loading';stopClockQueue();$('agc').textContent='...';$('mode').textContent=`LOADING ${selected.label} · AGC`;resetAgcFace();
  try{
    if(!agcCore||agcLoadedMission!==lifecycleState.selectedMission){
      if(agcCore)agcCore.stop();
      agcCore=new AgcCore({onChannelUpdate:onAgcChannel,onError:agcFailure});
      await agcCore.load({wasmUrl:'yaAGC.wasm',ropeUrl:selected.rope});
      agcLoadedMission=lifecycleState.selectedMission;
    }else{
      agcCore.reset();agcCore.configureInputMasks();
    }
    const restored=restoreSavedAgcState();
    lifecycleState.mode='agc';agcSuspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${agcCore.version()}${restored?' · STATE RESTORED':''}`;
    if(restored)renderAgcSnapshot();
    if(appVisible){agcCore.start(1);agcPausedForVisibility=false}else{agcPausedForVisibility=true}
  }catch(error){agcFailure(error)}
}
function agcFailure(error){
  agcSuspendedForClock=false;console.error('AGC core stopped',error);enterClock('AGC ERROR · PHONE CLOCK',false);
}
function setAppVisible(visible){
  appVisible=!!visible;
  if(lifecycleState.mode!=='agc'||!agcCore)return;
  if(!appVisible){
    if(agcCore.running){agcCore.stop();agcPausedForVisibility=true}
    saveAgcState('app background');
    return;
  }
  if(agcPausedForVisibility){agcPausedForVisibility=false;agcCore.start(1)}
}
