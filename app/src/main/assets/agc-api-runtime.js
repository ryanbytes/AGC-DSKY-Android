'use strict';

// Public application facade/bootstrap. This is the root of the explicit core
// service graph; public transition methods retain stable identity and delegate
// to runtime-transitions.js once that coordinator is published.
const apiState=window.AGCDSKY_APP_STATE;
const apiCore=window.AGCDSKY_CORE_SESSION;
const apiShell=window.AGCDSKY_SHELL;
const apiRenderer=window.AGCDSKY_RENDERER;
const apiEnvironment=window.AGCDSKY_ENVIRONMENT;
const apiAudio=window.AGCDSKY_AUDIO;
const apiClock=window.AGCDSKY_CLOCK;
const apiDisplay=window.AGCDSKY_DISPLAY;
const apiSnapshot=window.AGCDSKY_SNAPSHOT;
const apiLifecycle=window.AGCDSKY_LIFECYCLE;
if(!apiState)throw new Error('Shared application state unavailable');
if(!apiCore)throw new Error('Shared AGC core session unavailable');
for(const [name,service] of Object.entries({shell:apiShell,renderer:apiRenderer,environment:apiEnvironment,audio:apiAudio,clock:apiClock,display:apiDisplay,snapshot:apiSnapshot,lifecycle:apiLifecycle})){
  if(!service)throw new Error(`AGC ${name} service unavailable`);
}

const apiServices=Object.freeze({
  shell:apiShell,
  renderer:apiRenderer,
  environment:apiEnvironment,
  audio:apiAudio,
  clock:apiClock,
  display:apiDisplay,
  snapshot:apiSnapshot,
  lifecycle:apiLifecycle
});
window.AGCDSKY_SERVICES=apiServices;

function publicEnterAgc(){
  const runtime=window.AGCDSKY_RUNTIME;
  return runtime&&typeof runtime.enterAgc==='function'
    ? runtime.enterAgc('public AGCDSKY.enterAgc')
    : apiLifecycle.enterAgc();
}
function publicEnterClock(){
  const status=apiShell.clockTimeLabel();
  const runtime=window.AGCDSKY_RUNTIME;
  return runtime&&typeof runtime.enterClock==='function'
    ? runtime.enterClock(status,true,'public AGCDSKY.enterClock')
    : apiLifecycle.enterClock(status,true);
}

window.AGCDSKY={
  services:apiServices,
  lifecycle:apiLifecycle,
  agcChannel:apiDisplay.onChannel,
  getCore:()=>apiCore.core,
  setAppVisible:apiLifecycle.setAppVisible,
  getMission:()=>apiState.selectedMission,
  enterClock:publicEnterClock,
  enterAgc:publicEnterAgc,
  appStatus:apiLifecycle.status,
  saveAgcState:apiSnapshot.save,
  clearSavedAgcState:apiSnapshot.clear,
  savedSnapshotInfo:apiSnapshot.savedInfo,
  verifySnapshotRoundTrip:apiSnapshot.verifyRoundTrip,
  scheduleAgcAutosave:apiSnapshot.scheduleAutosave,
  accurateTime:apiShell.accurateTime,
  accurateDate:apiShell.accurateDate,
  ntpStatus:()=>({...apiState.ntpStatus}),
  nativeNtpStatus:apiShell.updateNtpStatus
};
apiShell.initialize(window.AGCDSKY,apiServices);
