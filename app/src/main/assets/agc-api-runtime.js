'use strict';

// Public application API/bootstrap. All mutable subsystem state lives in the
// dedicated runtimes loaded before this file.
window.AGCDSKY={
  agcChannel:onAgcChannel,
  getCore:()=>agcCore,
  setAppVisible,
  getMission:()=>selectedMission,
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
  ntpStatus:()=>({...ntpStatus}),
  nativeNtpStatus:updateNtpStatus
};
initializeAppShell();
