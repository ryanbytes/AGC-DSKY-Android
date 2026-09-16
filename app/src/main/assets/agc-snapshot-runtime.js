'use strict';

// AGC snapshot persistence/autosave authority. The runtime consumes explicit
// shell/display services instead of reaching sideways through classic globals.
const snapshotState=window.AGCDSKY_APP_STATE;
const snapshotCore=window.AGCDSKY_CORE_SESSION;
const snapshotShell=window.AGCDSKY_SHELL;
const snapshotDisplay=window.AGCDSKY_DISPLAY;
if(!snapshotState)throw new Error('Shared application state unavailable');
if(!snapshotCore)throw new Error('Shared AGC core session unavailable');
if(!snapshotShell)throw new Error('Application shell service unavailable');
if(!snapshotDisplay)throw new Error('AGC display service unavailable');
const SNAPSHOT_KEY='agcSnapshotV1',SNAPSHOT_META_KEY='agcSnapshotMetaV1';
let lastSnapshotError='',lastSnapshotAction='none',lastSnapshotVerify=null,autosaveTimer=0,lastAutosaveAt=0;

function savedSnapshotInfo(){
  try{const x=JSON.parse(snapshotShell.store.get(SNAPSHOT_META_KEY)||'null');return x&&x.schema===1?x:null}catch(_){return null}
}
function saveAgcState(reason='manual'){
  const core=snapshotCore.core;
  if(snapshotState.mode!=='agc'){lastSnapshotError='AGC mode required';lastSnapshotAction='save ignored';return false}
  if(!core||snapshotCore.loadedMission!==snapshotState.selectedMission||typeof core.exportSnapshot!=='function')return false;
  try{
    const timestamp=Date.now(),payload={schema:1,mission:snapshotState.selectedMission,coreVersion:core.version(),timestamp,reason,ui:snapshotDisplay.snapshotUi(),core:core.exportSnapshot()};
    if(!snapshotShell.store.set(SNAPSHOT_KEY,JSON.stringify(payload)))throw new Error('local storage rejected snapshot');
    snapshotShell.store.set(SNAPSHOT_META_KEY,JSON.stringify({schema:1,mission:snapshotState.selectedMission,timestamp,reason,sourceMode:'agc',coreVersion:payload.coreVersion,bytes:payload.core.byteLength,fingerprint:payload.core.fingerprint||null}));
    if(reason.startsWith('autosave:')||reason==='periodic autosave')lastAutosaveAt=timestamp;
    lastSnapshotError='';lastSnapshotAction='saved';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='save failed';console.error('AGC snapshot save',error);return false}
}
function restoreSavedAgcState(){
  const core=snapshotCore.core;
  if(!core||typeof core.importSnapshot!=='function')return false;
  const raw=snapshotShell.store.get(SNAPSHOT_KEY);if(!raw)return false;
  try{
    const payload=JSON.parse(raw);
    if(!payload||payload.schema!==1||payload.mission!==snapshotState.selectedMission)throw new Error('snapshot mission/schema mismatch');
    core.importSnapshot(payload.core);snapshotDisplay.applySnapshotUi(payload.ui);
    lastSnapshotError='';lastSnapshotAction='restored';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='restore failed';snapshotShell.store.remove(SNAPSHOT_KEY);snapshotShell.store.remove(SNAPSHOT_META_KEY);console.error('AGC snapshot restore',error);return false}
}
function clearSavedAgcState(){snapshotShell.store.remove(SNAPSHOT_KEY);snapshotShell.store.remove(SNAPSHOT_META_KEY);lastSnapshotError='';lastSnapshotAction='cleared';return true}
function verifySnapshotRoundTrip(){
  const core=snapshotCore.core;
  if(!core||snapshotCore.loadedMission!==snapshotState.selectedMission||typeof core.exportSnapshot!=='function'||typeof core.importSnapshot!=='function')return {ok:false,error:'AGC core not ready'};
  const wasRunning=!!core.running,ui=snapshotDisplay.snapshotUi();
  try{
    if(wasRunning)core.stop();
    const snap=core.exportSnapshot(),before=snap.fingerprint||core.snapshotFingerprint?.();
    core.importSnapshot(snap);snapshotDisplay.applySnapshotUi(ui);const after=core.snapshotFingerprint?.();
    const ok=!before||before===after;lastSnapshotVerify={ok,before,after,timestamp:Date.now()};
    if(wasRunning&&snapshotState.appVisible)core.start(1);snapshotDisplay.renderSnapshot();
    return {...lastSnapshotVerify};
  }catch(error){
    lastSnapshotVerify={ok:false,error:String(error&&error.message||error),timestamp:Date.now()};
    if(wasRunning&&snapshotState.appVisible&&!core.running)core.start(1);
    return {...lastSnapshotVerify};
  }
}
function scheduleAgcAutosave(reason='activity'){
  if(snapshotState.mode!=='agc'||!snapshotCore.core)return;
  clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=0;const core=snapshotCore.core;if(snapshotState.mode==='agc'&&core&&core.running)saveAgcState('autosave: '+reason)},1800);
}
function snapshotRuntimeStatus(){
  const meta=savedSnapshotInfo(),core=snapshotCore.core;
  return {
    saved:!!meta,
    meta,
    lastAction:lastSnapshotAction,
    error:lastSnapshotError,
    lastVerify:lastSnapshotVerify?{...lastSnapshotVerify}:null,
    currentFingerprint:core&&typeof core.snapshotFingerprint==='function'?core.snapshotFingerprint():null,
    lastAutosaveAt
  };
}

window.AGCDSKY_SNAPSHOT=Object.freeze({
  savedInfo:(...args)=>savedSnapshotInfo(...args),
  save:(...args)=>saveAgcState(...args),
  restore:(...args)=>restoreSavedAgcState(...args),
  clear:(...args)=>clearSavedAgcState(...args),
  verifyRoundTrip:(...args)=>verifySnapshotRoundTrip(...args),
  scheduleAutosave:(...args)=>scheduleAgcAutosave(...args),
  status:()=>snapshotRuntimeStatus(),
  lastAutosaveAt:()=>lastAutosaveAt
});
