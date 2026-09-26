'use strict';

/*
 * One presentation authority for every modeled DSKY relay transition.
 *
 * A single per-relay contact event drives all crew-facing consequences:
 *   1. the relay-rack armature/contact visualization,
 *   2. that exact relay's deterministic manufactured click/bounce identity,
 *   3. that relay's subtle deterministic haptic identity where supported,
 *   4. the DSKY EL/annunciator contact projection.
 *
 * AUTHENTIC mode follows the deterministic per-relay set/reset travel and
 * contact trace inside the unchanged 20-ms bank envelope. STRETCHED mode only
 * separates armature arrivals for human visibility; AGC/latch timing remains
 * authentic and sound + relay rack + DSKY projection stay frame-coupled.
 */
(() => {
  const display=window.AGCDSKY_DISPLAY;
  const shell=window.AGCDSKY_SHELL;
  const hardware=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE');
  const audioModel=window.DSKY_RELAY_AUDIO;
  const relayMatrix=window.DSKY_RELAY_MATRIX;
  if(!display||!shell||!hardware||!audioModel||!relayMatrix)throw new Error('Relay visual service dependencies unavailable');
  const baseDecodeChannel10=display.implementation('decodeChannel10');
  if(typeof baseDecodeChannel10!=='function')throw new Error('Relay visual implementation hook unavailable');

  const STORAGE_KEY='relayVisualTimingV1',MODE_AUTHENTIC='authentic',MODE_STRETCHED='stretched',FINAL_SETTLE_MS=20;
  const STRETCH_FIRST_BASE_MS=20,STRETCH_MIN_GAP_MS=18,STRETCH_MAX_GAP_MS=28,STRETCH_RELEASE_HOLD_MS=24;
  const generation=Object.create(null),auxGeneration=Object.create(null),presentation=Object.create(null),settledWordOverride=Object.create(null);
  const listeners=new Set();
  let frameLoopRunning=false,lastPresentationClick=null;

  function getStoredMode(){const value=shell.store.get(STORAGE_KEY);return value===MODE_STRETCHED?MODE_STRETCHED:MODE_AUTHENTIC}
  function saveMode(value){shell.store.set(STORAGE_KEY,value)}
  let timingMode=getStoredMode();

  function emit(event){
    const frozen=Object.freeze({...event,timingMode});
    for(const listener of Array.from(listeners)){try{listener(frozen)}catch(error){console.error('DSKY relay presentation listener',error)}}
    return frozen;
  }
  function subscribe(listener){if(typeof listener!=='function')throw new TypeError('Relay presentation listener must be a function');listeners.add(listener);return()=>listeners.delete(listener)}

  function currentSettledWord(row){
    if(Object.prototype.hasOwnProperty.call(settledWordOverride,row))return settledWordOverride[row]&0o3777;
    const state=hardware.snapshot();
    if(state&&state.latches&&state.latches[row]!==undefined)return Number(state.latches[row])&0o3777;
    const relayWords=display.status().relayWords;return Number(relayWords[row]??0)&0o3777;
  }
  function withSettledWordOverride(row,word,fn){
    const had=Object.prototype.hasOwnProperty.call(settledWordOverride,row),prior=settledWordOverride[row];settledWordOverride[row]=Number(word)&0o3777;
    try{return fn()}finally{if(had)settledWordOverride[row]=prior;else delete settledWordOverride[row]}
  }
  function renderWord(row,low11){display.renderRelayWord(row,Number(low11)&0o3777)}
  function profileFor(row,bit){try{return audioModel.profileFor(row,bit)||null}catch(_){return null}}
  function contactDelayMs(row,bit,engaging){const p=profileFor(row,bit);if(p){const value=engaging?p.setTravelMs:p.resetTravelMs;if(Number.isFinite(value))return Math.max(0,Math.min(19.5,value))}return 10}
  function contactTrace(row,bit,engaging){
    try{const trace=audioModel.contactTraceFor(row,bit,!!engaging);if(Array.isArray(trace)&&trace.length)return trace.map(item=>({...item}))}catch(_){}
    const atMs=contactDelayMs(row,bit,engaging);return[{atMs,state:!!engaging,kind:'armature'},{atMs,state:!!engaging,kind:'settled'}];
  }
  function collectMotions(row,prior,target){
    const motions=[],diff=(prior^target)&0o3777;
    for(let bit=0;bit<11;bit++){
      const mask=1<<bit;if(!(diff&mask))continue;const on=!!(target&mask),profile=profileFor(row,bit),physicalMs=contactDelayMs(row,bit,on),trace=contactTrace(row,bit,on),stableEvent=trace[trace.length-1],stableMs=Number(stableEvent&&stableEvent.atMs)||physicalMs,bounceCount=trace.filter(item=>item.kind==='bounce').length,poleSkewUs=profile&&Number.isFinite(profile.poleSkewUs)?profile.poleSkewUs:0;
      motions.push({row,bit,mask,on,physicalMs,stableMs,bounceCount,poleSkewUs,profile,trace});
    }
    motions.sort((a,b)=>a.physicalMs-b.physicalMs||a.bit-b.bit);return motions;
  }
  function stretchedGapMs(motion){const tailMs=Math.max(0,motion.stableMs-motion.physicalMs),signature=tailMs*2+Math.min(5,Math.abs(motion.poleSkewUs)/35)+Math.min(4,motion.bounceCount*.55)+(motion.physicalMs-4.7)*.45;return Math.max(STRETCH_MIN_GAP_MS,Math.min(STRETCH_MAX_GAP_MS,STRETCH_MIN_GAP_MS+signature))}
  function stretchedSchedule(motions){let at=0;return motions.map((motion,index)=>{if(index===0)at=STRETCH_FIRST_BASE_MS+motion.physicalMs*1.25+Math.min(8,Math.abs(motion.poleSkewUs)/32);else at+=stretchedGapMs(motion);return{...motion,stretchedMs:Math.round(at*10)/10}})}

  function applyRelayContact(state,motion,traceEvent){
    if(motion.row<1||motion.row>12)return;
    const priorWord=state.contactWord;
    if(traceEvent.state)state.contactWord|=motion.mask;else state.contactWord&=~motion.mask;
    const contactChanged=priorWord!==state.contactWord;
    renderWord(motion.row,state.contactWord);
    if(timingMode===MODE_STRETCHED&&contactChanged)audioModel.playRelayContactHaptic?.(motion.row,motion.bit,motion.on,traceEvent.kind);
    if(traceEvent.kind==='armature'){
      lastPresentationClick={row:motion.row,bit:motion.bit,engaging:motion.on};
      audioModel.playRelayImpact?.(motion.row,motion.bit,motion.on,.66);
    }
    emit({type:'relay-contact',row:motion.row,bit:motion.bit,id:audioModel.relayIdentity(motion.row,motion.bit),state:!!traceEvent.state,targetOn:motion.on,phase:traceEvent.kind,contactWord:state.contactWord,physicalMs:motion.physicalMs,stableMs:motion.stableMs,poleSkewUs:motion.poleSkewUs,bounceCount:motion.bounceCount});
  }
  function scheduleContactTail(motion,token,armatureTraceMs,requiredMode){
    for(const item of motion.trace){
      if(item.kind==='armature')continue;
      const relative=Math.max(0,Number(item.atMs)-armatureTraceMs);
      setTimeout(()=>{
        if(generation[motion.row]!==token||timingMode!==requiredMode)return;
        const live=presentation[motion.row];if(!live||!live.active||live.token!==token)return;
        applyRelayContact(live,motion,item);
      },relative);
    }
  }
  function scheduleTraceFromArmature(state,motion,token,armatureAtMs){
    const armature=motion.trace.find(item=>item.kind==='armature')||motion.trace[0];
    const armatureTraceMs=Number(armature&&armature.atMs)||motion.physicalMs;
    if(timingMode===MODE_STRETCHED){
      const armatureEvent={...armature,atMs:armatureAtMs};
      setTimeout(()=>{
        if(generation[motion.row]!==token||timingMode!==MODE_STRETCHED)return;
        const live=presentation[motion.row];if(!live||!live.active||live.token!==token)return;
        live.frameQueue.push({motion,item:armatureEvent,armatureTraceMs,token});requestFrameLoop();
      },armatureAtMs);return;
    }
    setTimeout(()=>{
      if(generation[motion.row]!==token||timingMode!==MODE_AUTHENTIC)return;
      const live=presentation[motion.row];if(!live||!live.active||live.token!==token)return;
      applyRelayContact(live,motion,armature);
      scheduleContactTail(motion,token,armatureTraceMs,MODE_AUTHENTIC);
    },Math.max(0,armatureAtMs));
  }
  function activePresentations(){for(let row=1;row<=12;row++){const state=presentation[row];if(state&&state.active)return true}return false}
  function frameStep(){
    frameLoopRunning=false;if(timingMode!==MODE_STRETCHED)return;
    for(let row=1;row<=12;row++){
      const state=presentation[row];if(!state||!state.active)continue;if(generation[row]!==state.token){state.active=false;continue}
      const queued=state.frameQueue.splice(0);for(const entry of queued){applyRelayContact(state,entry.motion,entry.item);scheduleContactTail(entry.motion,entry.token,entry.armatureTraceMs,MODE_STRETCHED)}
    }
    if(activePresentations())requestFrameLoop();
  }
  function requestFrameLoop(){if(frameLoopRunning||timingMode!==MODE_STRETCHED)return;frameLoopRunning=true;if(typeof requestAnimationFrame==='function')requestAnimationFrame(frameStep);else setTimeout(frameStep,16)}
  function releasePresentation(row,token,target,afterMs){setTimeout(()=>{const state=presentation[row];if(!state||!state.active||state.token!==token||generation[row]!==token)return;state.contactWord=target&0o3777;renderWord(row,state.contactWord);state.active=false;emit({type:'relay-bank-settled',row,contactWord:state.contactWord})},Math.max(0,afterMs))}

  function presentDrive(row,prior,target,{renderContact=true}={}){
    row=Number(row);prior=Number(prior)&0o3777;target=Number(target)&0o3777;
    if(row<1||row>12)return 0;
    const token=(generation[row]||0)+1;generation[row]=token;const motions=collectMotions(row,prior,target);
    const state=presentation[row]={token,active:motions.length>0,contactWord:prior,target,frameQueue:[],renderContact:!!renderContact};
    if(!motions.length){renderWord(row,target);emit({type:'relay-bank-settled',row,contactWord:target});return 0}
    const stretched=timingMode===MODE_STRETCHED?stretchedSchedule(motions):null;
    const scheduled=motions.map(motion=>({motion,arrival:stretched?(stretched.find(item=>item.bit===motion.bit)?.stretchedMs??motion.physicalMs):motion.physicalMs}));
    if(timingMode===MODE_AUTHENTIC)audioModel.playRelayBankHaptic?.(scheduled.map(item=>({row:item.motion.row,bit:item.motion.bit,on:item.motion.on,arrivalMs:item.arrival})));
    for(const item of scheduled){
      const motion=item.motion,arrival=item.arrival;
      emit({type:'relay-drive',row,bit:motion.bit,id:audioModel.relayIdentity(row,motion.bit),fromOn:!!(prior&motion.mask),targetOn:motion.on,durationMs:arrival,physicalMs:motion.physicalMs,stableMs:motion.stableMs,poleSkewUs:motion.poleSkewUs,bounceCount:motion.bounceCount});
      scheduleTraceFromArmature(state,motion,token,arrival);
    }
    const end=timingMode===MODE_STRETCHED?Math.max(...scheduled.map(item=>item.arrival+Math.max(0,item.motion.stableMs-item.motion.physicalMs)))+STRETCH_RELEASE_HOLD_MS:FINAL_SETTLE_MS;
    releasePresentation(row,token,target,end);return end;
  }

  function presentAux(next,{render=true,commit}={}){
    if(typeof commit!=='function')throw new TypeError('Aux relay presentation requires commit callback');
    const snapshot=hardware.snapshot(),prior=snapshot&&snapshot.auxRelays?snapshot.auxRelays:{};
    for(const [name,requested] of Object.entries(next||{})){
      if(!audioModel.auxiliaryNames?.includes(name)){commit(name,!!requested,render);continue}
      const on=!!requested,before=!!prior[name];if(before===on){commit(name,on,render);continue}
      const token=(auxGeneration[name]||0)+1;auxGeneration[name]=token;
      const p=audioModel.auxiliaryProfileFor(name),trace=audioModel.auxiliaryContactTraceFor(name,on),armature=trace.find(item=>item.kind==='armature')||trace[0],travel=Number(armature&&armature.atMs)||(on?p.setTravelMs:p.resetTravelMs);
      emit({type:'aux-drive',name,id:`AUX:${name.toUpperCase()}`,fromOn:before,targetOn:on,durationMs:travel,physicalMs:travel,stableMs:on?p.setStableMs:p.resetStableMs,poleSkewUs:p.poleSkewUs,bounceCount:trace.filter(item=>item.kind==='bounce').length});
      for(const item of trace)setTimeout(()=>{
        if(auxGeneration[name]!==token)return;commit(name,!!item.state,render);
        if(item.kind==='armature'){audioModel.playAuxImpact?.(name,on,.62);audioModel.playAuxHaptic?.(name,on)}
        emit({type:'aux-contact',name,id:`AUX:${name.toUpperCase()}`,state:!!item.state,targetOn:on,phase:item.kind,physicalMs:travel,stableMs:on?p.setStableMs:p.resetStableMs,poleSkewUs:p.poleSkewUs,bounceCount:trace.filter(e=>e.kind==='bounce').length});
      },Math.max(0,Number(item.atMs)||0));
    }
    return true;
  }

  function cancelPendingVisuals(){for(let row=1;row<=12;row++){generation[row]=(generation[row]||0)+1;if(presentation[row])presentation[row].active=false}for(const name of Object.keys(auxGeneration))auxGeneration[name]++}
  function resetPresentation(){cancelPendingVisuals();emit({type:'reset'})}
  function syncSettledVisuals(){for(let row=1;row<=12;row++)renderWord(row,currentSettledWord(row))}
  function setTimingMode(next,persist=true){const normalized=next===MODE_STRETCHED?MODE_STRETCHED:MODE_AUTHENTIC;if(normalized===timingMode){updateButton();return timingMode}cancelPendingVisuals();timingMode=normalized;if(persist)saveMode(timingMode);syncSettledVisuals();emit({type:'timing-mode',mode:timingMode});updateButton();return timingMode}
  function presentationDurationMs(row,prior,target){if(timingMode!==MODE_STRETCHED)return FINAL_SETTLE_MS;const schedule=stretchedSchedule(collectMotions(row,prior,target));return schedule.length?schedule[schedule.length-1].stretchedMs+STRETCH_RELEASE_HOLD_MS:0}

  const button=document.getElementById('relay-timing');
  function updateButton(){if(!button)return;const stretched=timingMode===MODE_STRETCHED;button.textContent=stretched?'RELAY VISUAL STRETCHED':'RELAY VISUAL AUTHENTIC';button.setAttribute('aria-pressed',stretched?'true':'false');button.title=stretched?'Frame-coupled relay motion, sound and DSKY contacts; AGC timing remains authentic':'Authentic manufactured per-relay travel/contact timing'}
  if(button)button.addEventListener('click',()=>{setTimingMode(timingMode===MODE_AUTHENTIC?MODE_STRETCHED:MODE_AUTHENTIC,true);shell.showControls()});updateButton();

  function relayContactVisualDecode(value){
    const word=Number(value)&0o77777,row=(word>>11)&0o17,target=word&0o3777;
    if(row>=1&&row<=12){const prior=currentSettledWord(row);presentDrive(row,prior,target,{renderContact:true})}
    return baseDecodeChannel10(value);
  }
  display.installImplementation('decodeChannel10',relayContactVisualDecode,'relay contact/audio/rack coupling');
  hardware.registerSettledPaintPolicy('relay-visual-coupling',()=>timingMode!==MODE_STRETCHED);

  window.DSKY_RELAY_VISUAL=Object.freeze({
    mode:'single-event-relay-contact-coupled',finalSettleMs:FINAL_SETTLE_MS,contactBounceVisible:true,authenticTiming:true,stretchedVisualOnly:true,stretchedAudioFrameLocked:true,stretchedHapticFrameLocked:true,stretchedContactHapticLocked:true,hapticBankComposed:true,stretchedBounceAudio:true,
    stretchFirstBaseMs:STRETCH_FIRST_BASE_MS,stretchMinGapMs:STRETCH_MIN_GAP_MS,stretchMaxGapMs:STRETCH_MAX_GAP_MS,stretchReleaseHoldMs:STRETCH_RELEASE_HOLD_MS,
    getTimingMode:()=>timingMode,setTimingMode,contactDelayMs,stretchedGapMs,stretchedScheduleFor:(row,prior,target)=>stretchedSchedule(collectMotions(row,prior,target)).map(item=>({...item})),presentationDurationMs,lastPresentationClick:()=>lastPresentationClick?{...lastPresentationClick}:null,
    renderWord,currentSettledWord,withSettledWordOverride,presentDrive,presentAux,subscribe,resetPresentation
  });
})();
