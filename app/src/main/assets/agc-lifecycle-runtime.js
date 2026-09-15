'use strict';

// Authoritative AGC core/mode lifecycle. Shared session/presentation fields
// live in AGCDSKY_APP_STATE; mutable core lifecycle fields live in the separate
// sealed AGCDSKY_CORE_SESSION object. The implementation is private to this
// module and is published only through the frozen AGCDSKY_LIFECYCLE service.
(() => {
  const lifecycleState=window.AGCDSKY_APP_STATE;
  const lifecycleCore=window.AGCDSKY_CORE_SESSION;
  if(!lifecycleState)throw new Error('Shared application state unavailable');
  if(!lifecycleCore)throw new Error('Shared AGC core session unavailable');
  if(window.AGCDSKY_LIFECYCLE)return;

  function enterClock(status=clockTimeLabel(),preserveAgc=false){
    cancelLampTest();
    const canResume=preserveAgc&&lifecycleState.mode==='agc'&&lifecycleCore.core&&lifecycleCore.loadedMission===lifecycleState.selectedMission;
    if(lifecycleCore.core)lifecycleCore.core.stop();
    if(canResume)saveAgcState('suspend for clock');
    lifecycleCore.suspendedForClock=!!canResume;
    lifecycleCore.pausedForVisibility=false;lifecycleState.mode='clock';rememberRunMode('clock');
    $('agc').textContent='AGC MODE';$('mode').textContent=status;clearLamps();set2('prog','00');lifecycleState.verb='16';lifecycleState.noun='65';show(lifecycleState.verb,lifecycleState.noun);stopClockQueue();syncClockFace();
  }
  function status(){
    const meta=savedSnapshotInfo(),core=lifecycleCore.core;
    return {mode:lifecycleState.mode,mission:lifecycleState.selectedMission,missionLabel:missionSpec().label,loadedMission:lifecycleCore.loadedMission,coreLoaded:!!core,
      coreRunning:!!(core&&core.running),coreVersion:core?core.version():'not loaded',appVisible:lifecycleState.appVisible,
      channels:{ch011:agcCh11,ch013:agcCh13,ch0163:agcCh163},display:JSON.parse(JSON.stringify(agcDisplay)),
      snapshot:{saved:!!meta,meta,lastAction:lastSnapshotAction,error:lastSnapshotError,lastVerify:lastSnapshotVerify,currentFingerprint:core&&typeof core.snapshotFingerprint==='function'?core.snapshotFingerprint():null,lastAutosaveAt}};
  }
  async function enterAgc(){
    if(lifecycleState.dream||lifecycleState.mode==='agc-loading'||lifecycleState.mode==='agc')return;
    cancelLampTest();
    const selected=missionSpec();
    if(lifecycleCore.suspendedForClock&&lifecycleCore.core&&lifecycleCore.loadedMission===lifecycleState.selectedMission){
      lifecycleState.mode='agc';lifecycleCore.suspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${lifecycleCore.core.version()}`;renderAgcSnapshot();
      if(lifecycleState.appVisible){lifecycleCore.core.start(1);lifecycleCore.pausedForVisibility=false}else{lifecycleCore.pausedForVisibility=true}
      return;
    }
    lifecycleState.mode='agc-loading';stopClockQueue();$('agc').textContent='...';$('mode').textContent=`LOADING ${selected.label} · AGC`;resetAgcFace();
    try{
      if(!lifecycleCore.core||lifecycleCore.loadedMission!==lifecycleState.selectedMission){
        if(lifecycleCore.core)lifecycleCore.core.stop();
        lifecycleCore.core=new AgcCore({onChannelUpdate:onAgcChannel,onError:fail});
        await lifecycleCore.core.load({wasmUrl:'yaAGC.wasm',ropeUrl:selected.rope});
        lifecycleCore.loadedMission=lifecycleState.selectedMission;
      }else{
        lifecycleCore.core.reset();lifecycleCore.core.configureInputMasks();
      }
      const restored=restoreSavedAgcState();
      lifecycleState.mode='agc';lifecycleCore.suspendedForClock=false;rememberRunMode('agc');$('agc').textContent='AGC MODE';$('mode').textContent=`${selected.label} · ${lifecycleCore.core.version()}${restored?' · STATE RESTORED':''}`;
      if(restored)renderAgcSnapshot();
      if(lifecycleState.appVisible){lifecycleCore.core.start(1);lifecycleCore.pausedForVisibility=false}else{lifecycleCore.pausedForVisibility=true}
    }catch(error){fail(error)}
  }
  function fail(error){
    lifecycleCore.suspendedForClock=false;console.error('AGC core stopped',error);enterClock('AGC ERROR · PHONE CLOCK',false);
  }
  function setAppVisible(visible){
    lifecycleState.appVisible=!!visible;
    if(lifecycleState.mode!=='agc'||!lifecycleCore.core)return;
    if(!lifecycleState.appVisible){
      if(lifecycleCore.core.running){lifecycleCore.core.stop();lifecycleCore.pausedForVisibility=true}
      saveAgcState('app background');
      return;
    }
    if(lifecycleCore.pausedForVisibility){lifecycleCore.pausedForVisibility=false;lifecycleCore.core.start(1)}
  }

  window.AGCDSKY_LIFECYCLE=Object.freeze({enterAgc,enterClock,setAppVisible,status,fail});
})();
