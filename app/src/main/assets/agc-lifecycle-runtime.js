'use strict';

// Authoritative AGC core/mode lifecycle. It composes explicit shell, renderer,
// clock, display, and snapshot services rather than relying on parser-global
// helper names. Core/session mutation remains private to this module.
(() => {
  const lifecycleState=window.AGCDSKY_APP_STATE;
  const lifecycleCore=window.AGCDSKY_CORE_SESSION;
  const lifecycleShell=window.AGCDSKY_SHELL;
  const lifecycleRenderer=window.AGCDSKY_RENDERER;
  const lifecycleClock=window.AGCDSKY_CLOCK;
  const lifecycleDisplay=window.AGCDSKY_DISPLAY;
  const lifecycleSnapshot=window.AGCDSKY_SNAPSHOT;
  if(!lifecycleState)throw new Error('Shared application state unavailable');
  if(!lifecycleCore)throw new Error('Shared AGC core session unavailable');
  if(!lifecycleShell)throw new Error('Application shell service unavailable');
  if(!lifecycleRenderer)throw new Error('DSKY renderer service unavailable');
  if(!lifecycleClock)throw new Error('Phone clock service unavailable');
  if(!lifecycleDisplay)throw new Error('AGC display service unavailable');
  if(!lifecycleSnapshot)throw new Error('AGC snapshot service unavailable');
  if(window.AGCDSKY_LIFECYCLE)return;

  function enterClock(status=lifecycleShell.clockTimeLabel(),preserveAgc=false){
    lifecycleClock.cancelLampTest();
    const canResume=preserveAgc&&lifecycleState.mode==='agc'&&lifecycleCore.core&&lifecycleCore.loadedMission===lifecycleState.selectedMission;
    if(lifecycleCore.core)lifecycleCore.core.stop();
    if(canResume)lifecycleSnapshot.save('suspend for clock');
    lifecycleCore.suspendedForClock=!!canResume;
    lifecycleCore.pausedForVisibility=false;lifecycleState.mode='clock';lifecycleShell.rememberRunMode('clock');
    lifecycleShell.element('agc').textContent='AGC MODE';lifecycleShell.element('mode').textContent=status;lifecycleRenderer.clearLamps();lifecycleRenderer.set2('prog','00');lifecycleState.verb='16';lifecycleState.noun='65';lifecycleShell.show(lifecycleState.verb,lifecycleState.noun);lifecycleClock.stopQueue();lifecycleClock.syncFace();
  }
  function status(){
    const display=lifecycleDisplay.status(),snapshot=lifecycleSnapshot.status(),core=lifecycleCore.core;
    return {mode:lifecycleState.mode,mission:lifecycleState.selectedMission,missionLabel:lifecycleShell.missionSpec().label,loadedMission:lifecycleCore.loadedMission,coreLoaded:!!core,
      coreRunning:!!(core&&core.running),coreVersion:core?core.version():'not loaded',appVisible:lifecycleState.appVisible,
      channels:{...display.channels},display:display.display,snapshot};
  }
  async function enterAgc(){
    if(lifecycleState.dream||lifecycleState.mode==='agc-loading'||lifecycleState.mode==='agc')return;
    lifecycleClock.cancelLampTest();
    const selected=lifecycleShell.missionSpec();
    if(lifecycleCore.suspendedForClock&&lifecycleCore.core&&lifecycleCore.loadedMission===lifecycleState.selectedMission){
      lifecycleState.mode='agc';lifecycleCore.suspendedForClock=false;lifecycleShell.rememberRunMode('agc');lifecycleShell.element('agc').textContent='AGC MODE';lifecycleShell.element('mode').textContent=`${selected.label} · ${lifecycleCore.core.version()}`;lifecycleDisplay.renderSnapshot();
      if(lifecycleState.appVisible){lifecycleCore.core.start(1);lifecycleCore.pausedForVisibility=false}else{lifecycleCore.pausedForVisibility=true}
      return;
    }
    lifecycleState.mode='agc-loading';lifecycleClock.stopQueue();lifecycleShell.element('agc').textContent='...';lifecycleShell.element('mode').textContent=`LOADING ${selected.label} · AGC`;lifecycleDisplay.resetFace();
    try{
      if(!lifecycleCore.core||lifecycleCore.loadedMission!==lifecycleState.selectedMission){
        if(lifecycleCore.core)lifecycleCore.core.stop();
        lifecycleCore.core=new AgcCore({onChannelUpdate:lifecycleDisplay.onChannel,onError:fail});
        await lifecycleCore.core.load({wasmUrl:'yaAGC.wasm',ropeUrl:selected.rope});
        lifecycleCore.loadedMission=lifecycleState.selectedMission;
      }else{
        lifecycleCore.core.reset();lifecycleCore.core.configureInputMasks();
      }
      const restored=lifecycleSnapshot.restore();
      lifecycleState.mode='agc';lifecycleCore.suspendedForClock=false;lifecycleShell.rememberRunMode('agc');lifecycleShell.element('agc').textContent='AGC MODE';lifecycleShell.element('mode').textContent=`${selected.label} · ${lifecycleCore.core.version()}${restored?' · STATE RESTORED':''}`;
      if(restored)lifecycleDisplay.renderSnapshot();
      if(lifecycleState.appVisible){lifecycleCore.core.start(1);lifecycleCore.pausedForVisibility=false}else{lifecycleCore.pausedForVisibility=true}
    }catch(error){fail(error)}
  }
  function fail(error){
    lifecycleCore.suspendedForClock=false;console.error('AGC core stopped',error);enterClock('AGC ERROR · PHONE CLOCK',false);
  }
  function nativeLiveWidgetActive(){
    try{
      return !!(window.WidgetBridge&&typeof window.WidgetBridge.getMode==='function'
        &&String(window.WidgetBridge.getMode()).toLowerCase()==='live');
    }catch(_){return false}
  }
  function setAppVisible(visible){
    lifecycleState.appVisible=!!visible;
    if(lifecycleState.mode!=='agc'||!lifecycleCore.core)return;
    if(!lifecycleState.appVisible){
      if(nativeLiveWidgetActive()){
        lifecycleCore.pausedForVisibility=false;
        if(!lifecycleCore.core.running)lifecycleCore.core.start(1);
        lifecycleSnapshot.save('app background live widget');
        return;
      }
      if(lifecycleCore.core.running){lifecycleCore.core.stop();lifecycleCore.pausedForVisibility=true}
      lifecycleSnapshot.save('app background');
      return;
    }
    if(lifecycleCore.pausedForVisibility){lifecycleCore.pausedForVisibility=false;lifecycleCore.core.start(1)}
  }

  window.AGCDSKY_LIFECYCLE=Object.freeze({enterAgc,enterClock,setAppVisible,status,fail});
})();
