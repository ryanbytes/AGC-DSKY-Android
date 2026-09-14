'use strict';

// Public application API/bootstrap. All mutable subsystem state lives in the
// dedicated runtimes loaded before this file.
const apiState=window.AGCDSKY_APP_STATE;
if(!apiState)throw new Error('Shared application state unavailable');
window.AGCDSKY={
  agcChannel:onAgcChannel,
  getCore:()=>agcCore,
  setAppVisible,
  getMission:()=>apiState.selectedMission,
  enterClock:()=>enterClock(clockTimeLabel(),true),
  enterAgc,
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
