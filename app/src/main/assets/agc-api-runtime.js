'use strict';

// Public application API/bootstrap. Lifecycle functions are the base transition
// implementation; once runtime-transitions.js loads, public transition calls
// delegate to that coordinator without the API object itself being monkey-patched.
const apiState=window.AGCDSKY_APP_STATE;
const apiCore=window.AGCDSKY_CORE_SESSION;
if(!apiState)throw new Error('Shared application state unavailable');
if(!apiCore)throw new Error('Shared AGC core session unavailable');

function publicEnterAgc(){
  const runtime=window.AGCDSKY_RUNTIME;
  return runtime&&typeof runtime.enterAgc==='function'
    ? runtime.enterAgc('public AGCDSKY.enterAgc')
    : enterAgc();
}
function publicEnterClock(){
  const status=clockTimeLabel();
  const runtime=window.AGCDSKY_RUNTIME;
  return runtime&&typeof runtime.enterClock==='function'
    ? runtime.enterClock(status,true,'public AGCDSKY.enterClock')
    : enterClock(status,true);
}

window.AGCDSKY={
  agcChannel:onAgcChannel,
  getCore:()=>apiCore.core,
  setAppVisible,
  getMission:()=>apiState.selectedMission,
  enterClock:publicEnterClock,
  enterAgc:publicEnterAgc,
  appStatus:agcAppStatus,
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
