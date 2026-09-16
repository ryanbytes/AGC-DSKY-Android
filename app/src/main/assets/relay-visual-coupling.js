'use strict';

/*
 * Couple visible EL/contact output to the individual relay that drives it.
 * AUTHENTIC mode follows modeled per-relay travel inside the 20-ms bank settle.
 * STRETCHED is presentation-only: AGC/latch timing stays authentic while contact
 * transitions are frame-separated for visibility. Channel-010 interception and
 * rendering flow through AGCDSKY_DISPLAY; audio/state use their owning services.
 */
(() => {
  const visualState=window.AGCDSKY_APP_STATE;
  const display=window.AGCDSKY_DISPLAY;
  const audio=window.AGCDSKY_AUDIO;
  const environment=window.AGCDSKY_ENVIRONMENT;
  const shell=window.AGCDSKY_SHELL;
  const hardware=window.AGCDSKY_HARDWARE;
  const audioModel=window.DSKY_RELAY_AUDIO;
  const relayMatrix=window.DSKY_RELAY_MATRIX;
  if(!visualState||!display||!audio||!environment||!shell||!hardware||!audioModel||!relayMatrix)throw new Error('Relay visual service dependencies unavailable');
  const baseDecodeChannel10=display.implementation('decodeChannel10');
  const baseIdentityEmitTick=audio.implementation('emitTick');
  if(typeof baseDecodeChannel10!=='function'||typeof baseIdentityEmitTick!=='function')throw new Error('Relay visual implementation hooks unavailable');

  const STORAGE_KEY='relayVisualTimingV1',MODE_AUTHENTIC='authentic',MODE_STRETCHED='stretched',FINAL_SETTLE_MS=20;
  const STRETCH_FIRST_BASE_MS=20,STRETCH_MIN_GAP_MS=18,STRETCH_MAX_GAP_MS=28,STRETCH_RELEASE_HOLD_MS=24;
  const generation=Object.create(null),presentation=Object.create(null),settledWordOverride=Object.create(null),presentationBufferCache=new Map();
  let frameLoopRunning=false,lastPresentationClick=null;

  function getStoredMode(){const value=shell.store.get(STORAGE_KEY);return value===MODE_STRETCHED?MODE_STRETCHED:MODE_AUTHENTIC}
  function saveMode(value){shell.store.set(STORAGE_KEY,value)}
  let timingMode=getStoredMode();

  function relayVisualTimingAwareTick(ctx,when=ctx.currentTime,strength=1){
    if(timingMode===MODE_STRETCHED){
      const state=hardware.snapshot(),row=Number(state&&state.activeDrive)||0,deltaMs=Math.max(0,(Number(when)-Number(ctx.currentTime))*1000);
      if(row>=1&&row<=12&&deltaMs>=4)return;
    }
    return baseIdentityEmitTick(ctx,when,strength);
  }
  audio.installImplementation('emitTick',relayVisualTimingAwareTick,'relay visual timing audio gate');

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
  function contactDelayMs(row,bit,engaging){const profile=profileFor(row,bit);if(profile){const value=engaging?profile.setTravelMs:profile.resetTravelMs;if(Number.isFinite(value))return Math.max(0,Math.min(19.5,value))}const fallback=[6.2,11.7,8.4,13.6,7.1,15.0,9.5,12.5,5.6,14.3,10.5];return fallback[bit]||10}
  function collectMotions(row,prior,target){
    const motions=[],diff=(prior^target)&0o3777;
    for(let bit=0;bit<11;bit++){
      const mask=1<<bit;if(!(diff&mask))continue;const on=!!(target&mask),profile=profileFor(row,bit),physicalMs=contactDelayMs(row,bit,on),stableCandidate=profile?(on?profile.setStableMs:profile.resetStableMs):physicalMs,stableMs=Number.isFinite(stableCandidate)?Math.max(physicalMs,stableCandidate):physicalMs,bounceCountCandidate=profile?(on?profile.setBounceCount:profile.resetBounceCount):0,bounceCount=Number.isFinite(bounceCountCandidate)?Math.max(0,bounceCountCandidate):0,poleSkewUs=profile&&Number.isFinite(profile.poleSkewUs)?profile.poleSkewUs:0;motions.push({bit,mask,on,physicalMs,stableMs,bounceCount,poleSkewUs});
    }
    motions.sort((a,b)=>a.physicalMs-b.physicalMs||a.bit-b.bit);return motions;
  }
  function stretchedGapMs(motion){const tailMs=Math.max(0,motion.stableMs-motion.physicalMs),signature=tailMs*2+Math.min(5,Math.abs(motion.poleSkewUs)/35)+Math.min(4,motion.bounceCount*.55)+(motion.physicalMs-4.7)*.45;return Math.max(STRETCH_MIN_GAP_MS,Math.min(STRETCH_MAX_GAP_MS,STRETCH_MIN_GAP_MS+signature))}
  function stretchedSchedule(motions){let at=0;return motions.map((motion,index)=>{if(index===0)at=STRETCH_FIRST_BASE_MS+motion.physicalMs*1.25+Math.min(8,Math.abs(motion.poleSkewUs)/32);else at+=stretchedGapMs(motion);return{...motion,stretchedMs:Math.round(at*10)/10}})}
  function xorshift32(seed){let state=(Number(seed)>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}}
  function presentationBuffer(ctx,row,bit,engaging,p){
    const key=`${ctx.sampleRate}|${row}|${bit}|${engaging?'set':'reset'}`,cached=presentationBufferCache.get(key);if(cached)return cached;
    const sr=ctx.sampleRate,duration=engaging?.0105:.0097,n=Math.max(32,Math.floor(sr*duration)),buffer=ctx.createBuffer(1,n,sr),data=buffer.getChannelData(0),rnd=xorshift32((p.phaseSeed>>>0)^(engaging?0x53455421:0x52535421)),phase=[rnd(),rnd(),rnd(),rnd()].map(v=>v*Math.PI*2),resetScale=engaging?1:.93,decayScale=engaging?1:.90;let prevNoise=0,prevDiff=0;
    for(let i=0;i<n;i++){const t=i/sr,noise=rnd()*2-1,diff=noise-prevNoise,highNoise=diff-prevDiff;prevNoise=noise;prevDiff=diff;const strike=highNoise*Math.exp(-t/p.strikeDecay)*p.strikeMix*resetScale,ring=p.ringMix*(Math.sin(2*Math.PI*p.f1*t+phase[0])*Math.exp(-t/(p.d1*decayScale))*.24+Math.sin(2*Math.PI*p.f2*t+phase[1])*Math.exp(-t/(p.d2*decayScale))*.34+Math.sin(2*Math.PI*p.f3*t+phase[2])*Math.exp(-t/(p.d3*decayScale))*.25+Math.sin(2*Math.PI*p.f4*t+phase[3])*Math.exp(-t/(p.d4*decayScale))*.13);data[i]=(strike+ring)*Math.min(1,t/.00009)}
    let mean=0;for(let i=0;i<n;i++)mean+=data[i];mean/=n;let peak=0;for(let i=0;i<n;i++){data[i]-=mean;peak=Math.max(peak,Math.abs(data[i]))}if(peak>0){const scale=.82/peak;for(let i=0;i<n;i++)data[i]*=scale}presentationBufferCache.set(key,buffer);return buffer;
  }
  function playPresentationClick(row,bit,engaging){
    lastPresentationClick={row,bit,engaging:!!engaging};if(!visualState.tickSound)return;const p=profileFor(row,bit),ctx=audio.ensure();if(!p||!ctx)return;
    const play=()=>{const start=ctx.currentTime+.00005,source=ctx.createBufferSource(),gain=ctx.createGain(),level=environment.tickLevel(),setReset=engaging?1.035:.915;source.buffer=presentationBuffer(ctx,row,bit,engaging,p);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(.43*level*.66*p.level*setReset,start+.00008);gain.gain.exponentialRampToValueAtTime(.0001,start+(engaging?.0062:.0055));source.connect(gain);gain.connect(ctx.destination);source.start(start);source.stop(start+.0115)};
    if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});
  }
  function activePresentations(){for(let row=1;row<=12;row++){const state=presentation[row];if(state&&state.active)return true}return false}
  function frameStep(){
    frameLoopRunning=false;if(timingMode!==MODE_STRETCHED)return;
    for(let row=1;row<=12;row++){const state=presentation[row];if(!state||!state.active)continue;if(generation[row]!==state.token){state.active=false;continue}renderWord(row,state.contactWord);if(state.pendingClicks&&state.pendingClicks.length){const pending=state.pendingClicks.splice(0);for(const motion of pending)playPresentationClick(row,motion.bit,motion.on)}}
    if(activePresentations())requestFrameLoop();
  }
  function requestFrameLoop(){if(frameLoopRunning||timingMode!==MODE_STRETCHED)return;frameLoopRunning=true;if(typeof requestAnimationFrame==='function')requestAnimationFrame(frameStep);else setTimeout(frameStep,16)}
  function releasePresentation(row,token,target){setTimeout(()=>{const state=presentation[row];if(!state||!state.active||state.token!==token||generation[row]!==token)return;state.contactWord=target&0o3777;renderWord(row,state.contactWord);state.active=false},STRETCH_RELEASE_HOLD_MS)}
  function scheduleContactVisuals(row,prior,target){
    const token=(generation[row]||0)+1;generation[row]=token;const motions=collectMotions(row,prior,target);if(!motions.length)return;
    if(timingMode===MODE_STRETCHED){
      const scheduled=stretchedSchedule(motions),state=presentation[row]={token,active:true,contactWord:prior&0o3777,target:target&0o3777,scheduled,pendingClicks:[]};renderWord(row,state.contactWord);requestFrameLoop();
      scheduled.forEach((motion,index)=>setTimeout(()=>{const live=presentation[row];if(!live||!live.active||live.token!==token||generation[row]!==token||timingMode!==MODE_STRETCHED)return;if(motion.on)live.contactWord|=motion.mask;else live.contactWord&=~motion.mask;live.pendingClicks.push(motion);requestFrameLoop();if(index===scheduled.length-1)releasePresentation(row,token,target)},motion.stretchedMs));return;
    }
    let contactWord=prior&0o3777;for(const motion of motions)setTimeout(()=>{if(generation[row]!==token||timingMode!==MODE_AUTHENTIC)return;if(motion.on)contactWord|=motion.mask;else contactWord&=~motion.mask;renderWord(row,contactWord)},motion.physicalMs);
  }
  function cancelPendingVisuals(){for(let row=1;row<=12;row++){generation[row]=(generation[row]||0)+1;if(presentation[row])presentation[row].active=false}}
  function syncSettledVisuals(){for(let row=1;row<=12;row++)renderWord(row,currentSettledWord(row))}
  function setTimingMode(next,persist=true){const normalized=next===MODE_STRETCHED?MODE_STRETCHED:MODE_AUTHENTIC;if(normalized===timingMode){updateButton();return timingMode}cancelPendingVisuals();timingMode=normalized;if(persist)saveMode(timingMode);syncSettledVisuals();updateButton();return timingMode}
  function presentationDurationMs(row,prior,target){if(timingMode!==MODE_STRETCHED)return FINAL_SETTLE_MS;const schedule=stretchedSchedule(collectMotions(row,prior,target));return schedule.length?schedule[schedule.length-1].stretchedMs+STRETCH_RELEASE_HOLD_MS:0}

  const button=document.getElementById('relay-timing');
  function updateButton(){if(!button)return;const stretched=timingMode===MODE_STRETCHED;button.textContent=stretched?'RELAY VISUAL STRETCHED':'RELAY VISUAL AUTHENTIC';button.setAttribute('aria-pressed',stretched?'true':'false');button.title=stretched?'Frame-synchronized per-relay stretched visuals and clicks; AGC timing remains authentic':'Authentic modeled relay contact timing'}
  if(button)button.addEventListener('click',()=>{setTimingMode(timingMode===MODE_AUTHENTIC?MODE_STRETCHED:MODE_AUTHENTIC,true);shell.showControls()});updateButton();

  function relayContactVisualDecode(value){
    const word=Number(value)&0o77777,row=(word>>11)&0o17,target=word&0o3777;
    if(row>=1&&row<=12){const prior=currentSettledWord(row);scheduleContactVisuals(row,prior,target)}
    return baseDecodeChannel10(value);
  }
  display.installImplementation('decodeChannel10',relayContactVisualDecode,'relay contact visual coupling');
  hardware.registerSettledPaintPolicy('relay-visual-coupling',()=>timingMode!==MODE_STRETCHED);

  window.DSKY_RELAY_VISUAL=Object.freeze({
    mode:'individual-contact-coupled',finalSettleMs:FINAL_SETTLE_MS,contactBounceVisible:false,authenticTiming:true,stretchedVisualOnly:true,stretchedAudioFrameLocked:true,stretchedBounceAudio:false,stretchFirstBaseMs:STRETCH_FIRST_BASE_MS,stretchMinGapMs:STRETCH_MIN_GAP_MS,stretchMaxGapMs:STRETCH_MAX_GAP_MS,stretchReleaseHoldMs:STRETCH_RELEASE_HOLD_MS,getTimingMode:()=>timingMode,setTimingMode,contactDelayMs,stretchedGapMs,stretchedScheduleFor:(row,prior,target)=>stretchedSchedule(collectMotions(row,prior,target)).map(item=>({...item})),presentationDurationMs,lastPresentationClick:()=>lastPresentationClick?{...lastPresentationClick}:null,renderWord,currentSettledWord,withSettledWordOverride
  });
})();