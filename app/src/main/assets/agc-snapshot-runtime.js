'use strict';

// AGC snapshot persistence/autosave authority. Core construction and mission
// lifecycle are separate; display backing state stays in agc-display-runtime.
const appState=window.AGCDSKY_APP_STATE;
if(!appState)throw new Error('Shared application state unavailable');
const SNAPSHOT_KEY='agcSnapshotV1',SNAPSHOT_META_KEY='agcSnapshotMetaV1';
let lastSnapshotError='',lastSnapshotAction='none',lastSnapshotVerify=null,autosaveTimer=0,lastAutosaveAt=0;

function savedSnapshotInfo(){
  try{const x=JSON.parse(store.get(SNAPSHOT_META_KEY)||'null');return x&&x.schema===1?x:null}catch(_){return null}
}
function saveAgcState(reason='manual'){
  if(appState.mode!=='agc'){lastSnapshotError='AGC mode required';lastSnapshotAction='save ignored';return false}
  if(!agcCore||agcLoadedMission!==appState.selectedMission||typeof agcCore.exportSnapshot!=='function')return false;
  try{
    const timestamp=Date.now(),payload={schema:1,mission:appState.selectedMission,coreVersion:agcCore.version(),timestamp,reason,ui:snapshotUiState(),core:agcCore.exportSnapshot()};
    if(!store.set(SNAPSHOT_KEY,JSON.stringify(payload)))throw new Error('local storage rejected snapshot');
    store.set(SNAPSHOT_META_KEY,JSON.stringify({schema:1,mission:appState.selectedMission,timestamp,reason,sourceMode:'agc',coreVersion:payload.coreVersion,bytes:payload.core.byteLength,fingerprint:payload.core.fingerprint||null}));
    if(reason.startsWith('autosave:')||reason==='periodic autosave')lastAutosaveAt=timestamp;
    lastSnapshotError='';lastSnapshotAction='saved';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='save failed';console.error('AGC snapshot save',error);return false}
}
function restoreSavedAgcState(){
  if(!agcCore||typeof agcCore.importSnapshot!=='function')return false;
  const raw=store.get(SNAPSHOT_KEY);if(!raw)return false;
  try{
    const payload=JSON.parse(raw);
    if(!payload||payload.schema!==1||payload.mission!==appState.selectedMission)throw new Error('snapshot mission/schema mismatch');
    agcCore.importSnapshot(payload.core);applySnapshotUi(payload.ui);
    lastSnapshotError='';lastSnapshotAction='restored';return true;
  }catch(error){lastSnapshotError=String(error&&error.message||error);lastSnapshotAction='restore failed';store.remove(SNAPSHOT_KEY);store.remove(SNAPSHOT_META_KEY);console.error('AGC snapshot restore',error);return false}
}
function clearSavedAgcState(){store.remove(SNAPSHOT_KEY);store.remove(SNAPSHOT_META_KEY);lastSnapshotError='';lastSnapshotAction='cleared';return true}
function verifySnapshotRoundTrip(){
  if(!agcCore||agcLoadedMission!==appState.selectedMission||typeof agcCore.exportSnapshot!=='function'||typeof agcCore.importSnapshot!=='function')return {ok:false,error:'AGC core not ready'};
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
  if(appState.mode!=='agc'||!agcCore)return;
  clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=0;if(appState.mode==='agc'&&agcCore&&agcCore.running)saveAgcState('autosave: '+reason)},1800);
}
