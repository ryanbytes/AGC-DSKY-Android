'use strict';

// Public application API/bootstrap. Lifecycle implementation is published by
// AGCDSKY_LIFECYCLE; once runtime-transitions.js loads, public transition calls
// dynamically delegate to that coordinator without replacing API functions.
const apiState=window.AGCDSKY_APP_STATE;
const apiCore=window.AGCDSKY_CORE_SESSION;
const apiLifecycle=window.AGCDSKY_LIFECYCLE;
if(!apiState)throw new Error('Shared application state unavailable');
if(!apiCore)throw new Error('Shared AGC core session unavailable');
if(!apiLifecycle)throw new Error('AGC lifecycle service unavailable');

function publicEnterAgc(){
  const runtime=window.AGCDSKY_RUNTIME;
  return runtime&&typeof runtime.enterAgc==='function'
    ? runtime.enterAgc('public AGCDSKY.enterAgc')
    : apiLifecycle.enterAgc();
}
function publicEnterClock(){
  const status=clockTimeLabel();
  const runtime=window.AGCDSKY_RUNTIME;
  return runtime&&typeof runtime.enterClock==='function'
    ? runtime.enterClock(status,true,'public AGCDSKY.enterClock')
    : apiLifecycle.enterClock(status,true);
}

window.AGCDSKY={
  lifecycle:apiLifecycle,
  agcChannel:onAgcChannel,
  getCore:()=>apiCore.core,
  setAppVisible:apiLifecycle.setAppVisible,
  getMission:()=>apiState.selectedMission,
  enterClock:publicEnterClock,
  enterAgc:publicEnterAgc,
  appStatus:apiLifecycle.status,
  saveAgcState,
  clearSavedAgcState,
  savedSnapshotInfo,
  verifySnapshotRoundTrip,
  scheduleAgcAutosave,
  accurateTime,
  accurateDate,
  ntpStatus:()=>({...apiState.ntpStatus}),
  nativeNtpStatus:updateNtpStatus
};
initializeAppShell();
