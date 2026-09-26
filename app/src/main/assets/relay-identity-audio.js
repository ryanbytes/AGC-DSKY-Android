'use strict';

/*
 * Stable per-relay mechanical fingerprints for the Block II DSKY.
 * hardware-fidelity.js owns the 20-ms bank-drive/settle model; this service
 * supplies deterministic per-relay set/reset travel, pole skew, contact bounce,
 * and acoustic response without changing latch/display state.
 */
(() => {
  const audio=window.AGCDSKY_AUDIO;
  const environment=window.AGCDSKY_ENVIRONMENT;
  const hardware=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE');
  const identityState=window.AGCDSKY_APP_STATE;
  const inventory=window.DSKY_RELAY_INVENTORY;
  if(!audio||!environment||!hardware||!identityState||!inventory)throw new Error('Relay identity service dependencies unavailable');
  const fallbackEmitTick=audio.implementation('emitTick');
  if(typeof fallbackEmitTick!=='function')throw new Error('Relay audio implementation unavailable');
  const bufferCache=new Map(),contactBufferCache=new Map();

  const LATCHING_RELAY_COUNT=inventory.latchingRelayCount;
  const AUX_RELAY_COUNT=inventory.nonLatchingRelayCount;
  const TOTAL_RELAY_COUNT=inventory.physicalRelayCount;
  const DRIVE_ENVELOPE_MS=20;
  // SCD 1006282: operate <=3 ms, release <=3 ms, transfer <=1 ms,
  // contact bounce <=2 ms.  The deterministic spread below represents
  // unit-to-unit presentation variation inside those hard limits; it is not
  // claimed to be serial-number-specific measured flight hardware.
  const SET_TRAVEL_MIN_MS=1.75,SET_TRAVEL_MAX_MS=2.95;
  const RESET_TRAVEL_MIN_MS=1.65,RESET_TRAVEL_MAX_MS=2.90;
  const LATCH_BOUNCE_MAX_MS=2.0;
  // Exact 1010784/2004689 non-latching timing remains separately auditable.
  // Until its SCD timing table is sourced, preserve the prior bounded
  // presentation timing but mark it explicitly as unverified mechanical data.
  const AUX_SET_TRAVEL_MIN_MS=5.1,AUX_SET_TRAVEL_MAX_MS=13.6;
  const AUX_RESET_TRAVEL_MIN_MS=4.7,AUX_RESET_TRAVEL_MAX_MS=12.8;
  const AUX_ORDER=inventory.auxiliaryNames;
  const AUX_LABEL=Object.freeze(Object.fromEntries(AUX_ORDER.map(name=>[name,inventory.auxiliaryByName[name].label])));
  const MATRIX_ORDINAL=new Map(inventory.matrixRelays.map((relay,index)=>[`${relay.row}:${relay.bit}`,index]));

  function snapshot(){try{return hardware.snapshot()}catch(_){return null}}
  const firstSnapshot=snapshot();
  let lastAux=Object.assign({},firstSnapshot&&firstSnapshot.auxRelays||{});
  function syncAuxSnapshot(){const state=snapshot();if(state&&state.auxRelays)lastAux=Object.assign({},state.auxRelays)}
  const soundButton=document.getElementById('sound');
  if(soundButton){soundButton.addEventListener('click',syncAuxSnapshot,true);soundButton.addEventListener('click',()=>setTimeout(syncAuxSnapshot,0))}
  setInterval(()=>{try{if(!identityState.tickSound)syncAuxSnapshot()}catch(_){}},250);

  function hash32(text){let h=0x811c9dc5;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0}
  function xorshift32(seed){let state=(seed>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}}
  function clamp(value,low,high){return Math.max(low,Math.min(high,value))}
  function relayIdentity(row,bit){return inventory.matrixIdentity(row,bit)}
  function relayOrdinal(row,bit){const value=MATRIX_ORDINAL.get(`${Number(row)}:${Number(bit)}`);return value===undefined?-1:value}
  function auxOrdinal(name){const i=AUX_ORDER.indexOf(name);return i<0?-1:LATCHING_RELAY_COUNT+i}

  function bouncePattern(rnd,count,windowMs){
    if(count<=0||windowMs<=0)return Object.freeze([]);const out=[],slot=windowMs/(count+1);
    for(let i=1;i<=count;i++){const jitter=(rnd()*2-1)*slot*.24;out.push(clamp(i*slot+jitter,.05,windowMs-.03))}
    out.sort((a,b)=>a-b);return Object.freeze(out);
  }
  function manufacturingProfile(id,ordinal){
    const latching=ordinal>=0&&ordinal<LATCHING_RELAY_COUNT;
    const rnd=xorshift32(hash32(`${id}:manufacture`));
    const localOrdinal=latching?ordinal:Math.max(0,ordinal-LATCHING_RELAY_COUNT);
    const population=latching?LATCHING_RELAY_COUNT:AUX_RELAY_COUNT;
    const positionPhase=((localOrdinal*73+17)%Math.max(1,population))/Math.max(1,population-1);
    const setMin=latching?SET_TRAVEL_MIN_MS:AUX_SET_TRAVEL_MIN_MS,setMax=latching?SET_TRAVEL_MAX_MS:AUX_SET_TRAVEL_MAX_MS;
    const resetMin=latching?RESET_TRAVEL_MIN_MS:AUX_RESET_TRAVEL_MIN_MS,resetMax=latching?RESET_TRAVEL_MAX_MS:AUX_RESET_TRAVEL_MAX_MS;
    const setTravelMs=clamp(setMin+(setMax-setMin)*clamp(.58*positionPhase+.42*rnd(),0,1),setMin,setMax);
    const resetTravelMs=clamp(resetMin+(resetMax-resetMin)*clamp(.52*(1-positionPhase)+.48*rnd(),0,1),resetMin,resetMax);
    const poleSkewUs=Math.round((rnd()*2-1)*(latching?185:260));
    const setBounceCount=latching?1+Math.floor(rnd()*3):2+Math.floor(rnd()*5),resetBounceCount=latching?1+Math.floor(rnd()*3):1+Math.floor(rnd()*4);
    const setBounceWindowMs=latching?.25+rnd()*1.55:.55+rnd()*2.35,resetBounceWindowMs=latching?.20+rnd()*1.50:.35+rnd()*1.85;
    const setBounceTimesMs=bouncePattern(rnd,setBounceCount,setBounceWindowMs),resetBounceTimesMs=bouncePattern(rnd,resetBounceCount,resetBounceWindowMs);
    const setTailMs=latching?.04+rnd()*.11:.12+rnd()*.34,resetTailMs=latching?.04+rnd()*.11:.10+rnd()*.28;
    const setLastBounce=setBounceTimesMs.length?setBounceTimesMs[setBounceTimesMs.length-1]:0,resetLastBounce=resetBounceTimesMs.length?resetBounceTimesMs[resetBounceTimesMs.length-1]:0;
    const setStableMs=latching?Math.min(setTravelMs+LATCH_BOUNCE_MAX_MS,setTravelMs+setLastBounce+setTailMs):Math.min(DRIVE_ENVELOPE_MS-.35,setTravelMs+setLastBounce+setTailMs);
    const resetStableMs=latching?Math.min(resetTravelMs+LATCH_BOUNCE_MAX_MS,resetTravelMs+resetLastBounce+resetTailMs):Math.min(DRIVE_ENVELOPE_MS-.35,resetTravelMs+resetLastBounce+resetTailMs);
    return Object.freeze({setTravelMs,resetTravelMs,setStableMs,resetStableMs,setBounceCount,resetBounceCount,setBounceTimesMs,resetBounceTimesMs,setBounceWindowMs,resetBounceWindowMs,poleSkewUs,timingEvidence:latching?'SCD-1006282-bounded':'1010784-timing-unverified'});
  }
  function contactTraceFromProfile(p,engaging){
    const travelMs=engaging?p.setTravelMs:p.resetTravelMs,stableMs=engaging?p.setStableMs:p.resetStableMs,bounceTimes=engaging?p.setBounceTimesMs:p.resetBounceTimesMs,finalState=!!engaging;
    let state=finalState;const events=[{atMs:travelMs,state,kind:'armature'}];
    for(const offset of bounceTimes){state=!state;events.push({atMs:travelMs+offset,state,kind:'bounce'})}events.push({atMs:stableMs,state:finalState,kind:'settled'});return events;
  }
  function profile(id,ordinal){
    const m=manufacturingProfile(id,ordinal),rnd=xorshift32(hash32(`${id}:acoustic`)),centered=()=>rnd()*2-1,serialOffset=(ordinal-(TOTAL_RELAY_COUNT-1)/2)*.00034,bodyScale=1+serialOffset+centered()*.0035;
    return Object.freeze({id,ordinal,...m,settleMs:Math.max(m.setStableMs,m.resetStableMs),f1:5600*bodyScale*(1+centered()*.0040),f2:8300*bodyScale*(1+centered()*.0045),f3:11600*bodyScale*(1+centered()*.0050),f4:14200*bodyScale*(1+centered()*.0055),d1:.00155*(1+centered()*.09),d2:.00185*(1+centered()*.09),d3:.00135*(1+centered()*.10),d4:.00095*(1+centered()*.11),strikeDecay:.00033*(1+centered()*.12),strikeMix:.14*(1+centered()*.10),ringMix:1+centered()*.045,level:1+centered()*.050,phaseSeed:hash32(`${id}:phase`),contactSeed:hash32(`${id}:contact`)});
  }
  const profileCache=new Map();
  function profileFor(id,ordinal){const key=`${id}|${ordinal}`;if(!profileCache.has(key))profileCache.set(key,profile(id,ordinal));return profileCache.get(key)}

  // Perceptual haptic identity follows the same deterministic mechanical profile
  // as relay travel/bounce/audio. With bank-level waveform composition preventing
  // overwrite, the tactile mapping can stay intentionally small and crisp instead
  // of notification-like. This is not a claim that surviving Apollo documentation
  // specifies handset vibration force.
  function hapticSignatureFromProfile(p,engaging){
    const on=!!engaging,travel=on?p.setTravelMs:p.resetTravelMs,stable=on?p.setStableMs:p.resetStableMs,bounces=on?p.setBounceCount:p.resetBounceCount;
    const latching=p.ordinal<LATCHING_RELAY_COUNT;
    const travelMin=latching?(on?SET_TRAVEL_MIN_MS:RESET_TRAVEL_MIN_MS):(on?AUX_SET_TRAVEL_MIN_MS:AUX_RESET_TRAVEL_MIN_MS);
    const travelMax=latching?(on?SET_TRAVEL_MAX_MS:RESET_TRAVEL_MAX_MS):(on?AUX_SET_TRAVEL_MAX_MS:AUX_RESET_TRAVEL_MAX_MS);
    const travelNorm=clamp((travel-travelMin)/Math.max(.001,travelMax-travelMin),0,1),tailNorm=clamp((stable-travel)/(latching?LATCH_BOUNCE_MAX_MS:3.0),0,1),skewNorm=clamp(Math.abs(p.poleSkewUs)/(latching?185:260),0,1),ordinalPhase=((p.ordinal*37+11)%TOTAL_RELAY_COUNT)/Math.max(1,TOTAL_RELAY_COUNT-1);
    const durationMs=Math.round(clamp((on?3.0:2.0)+travelNorm*(on?1.15:.8)+tailNorm*.35+ordinalPhase*.30,on?3:2,on?5:4));
    const amplitude=Math.round(clamp((on?44:32)+travelNorm*(on?16:12)+tailNorm*(on?6:5)+skewNorm*4+Math.min(4,bounces)*(on?1.4:1.1)+(ordinalPhase-.5)*(on?10:8),on?40:28,on?72:56));
    return Object.freeze({id:p.id,engaging:on,durationMs,amplitude});
  }
  function hapticPatternFromProfile(p,engaging,atMs=0){
    const on=!!engaging,signature=hapticSignatureFromProfile(p,on),source=on?p.setBounceTimesMs:p.resetBounceTimesMs,windowMs=on?p.setBounceWindowMs:p.resetBounceWindowMs,pulses=[];
    const baseAt=Math.max(0,Number(atMs)||0);
    pulses.push(Object.freeze({atMs:baseAt,durationMs:signature.durationMs,amplitude:signature.amplitude,kind:'armature'}));
    if(source&&source.length){
      const reboundCount=Math.min(on?3:2,Math.max(1,Math.ceil(source.length/2)));
      for(let i=0;i<reboundCount;i++){
        const index=reboundCount===1?source.length-1:Math.round(i*(source.length-1)/(reboundCount-1));
        const physicalOffset=Math.max(0,Number(source[index])||0),normalized=clamp(physicalOffset/Math.max(.01,windowMs),0,1);
        const gapMs=(on?3:3)+Math.round(normalized*(on?7:5))+i;
        const durationMs=Math.max(1,Math.min(2,Math.round((on?1.35:1.15)+(Math.abs(p.poleSkewUs)/185)*.55-i*.20)));
        const amplitude=Math.round(clamp(signature.amplitude*(on?.42:.36)*Math.pow(.70,i),on?14:12,on?30:24));
        pulses.push(Object.freeze({atMs:baseAt+signature.durationMs+gapMs,durationMs,amplitude,kind:'rebound',sourceBounceIndex:index,physicalOffsetMs:physicalOffset}));
      }
    }
    return Object.freeze({id:p.id,engaging:on,pulses:Object.freeze(pulses)});
  }
  function waveformFromPatterns(patterns){
    const pulses=[];for(const pattern of patterns||[])for(const pulse of pattern&&pattern.pulses||[])pulses.push(pulse);
    if(!pulses.length)return Object.freeze({timings:Object.freeze([]),amplitudes:Object.freeze([]),totalMs:0,pulseCount:0});
    const totalMs=Math.min(720,Math.max(...pulses.map(p=>Math.ceil(p.atMs+p.durationMs)))+1),levels=new Array(totalMs).fill(0);
    for(const pulse of pulses){
      const start=Math.max(0,Math.min(totalMs-1,Math.floor(pulse.atMs))),end=Math.max(start+1,Math.min(totalMs,Math.ceil(pulse.atMs+pulse.durationMs)));
      for(let t=start;t<end;t++)levels[t]=Math.max(levels[t],Math.round(pulse.amplitude));
    }
    const timings=[],amplitudes=[];let current=levels[0],run=1;
    for(let i=1;i<levels.length;i++){
      if(levels[i]===current){run++;continue}
      timings.push(run);amplitudes.push(current);current=levels[i];run=1;
    }
    timings.push(run);amplitudes.push(current);
    return Object.freeze({timings:Object.freeze(timings),amplitudes:Object.freeze(amplitudes),totalMs,pulseCount:pulses.length});
  }
  function browserPatternFromWaveform(waveform){
    const out=[];let active=false,run=0;
    for(let i=0;i<waveform.timings.length;i++){
      const next=waveform.amplitudes[i]>0,duration=Math.max(0,Number(waveform.timings[i])||0);
      if(next===active)run+=duration;
      else{out.push(run);run=duration;active=next}
    }
    out.push(run);if(!out.length||out[0]!==0)out.unshift(0);return out;
  }
  function nativeHapticBridge(){
    try{const candidate=window.HapticBridge;if(!candidate||typeof candidate.relayImpact!=='function')return null;if(typeof candidate.available==='function'&&!candidate.available())return null;return candidate}catch(_){return null}
  }
  function playWaveform(waveform,fallbackSignature){
    const native=nativeHapticBridge();
    if(native&&typeof native.relayWaveform==='function'&&waveform.timings.length){
      try{return native.relayWaveform(waveform.timings.join(','),waveform.amplitudes.join(','))!==false}catch(_){}
    }
    if(native&&fallbackSignature){try{return native.relayImpact(fallbackSignature.durationMs,fallbackSignature.amplitude)!==false}catch(_){}}
    try{if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'&&waveform.timings.length)return navigator.vibrate(browserPatternFromWaveform(waveform))!==false}catch(_){}
    return false;
  }
  function playHapticProfile(p,engaging){
    const pattern=hapticPatternFromProfile(p,engaging,0),waveform=waveformFromPatterns([pattern]);
    return playWaveform(waveform,hapticSignatureFromProfile(p,engaging));
  }
  function relayBankHapticPattern(events){
    const patterns=[];
    for(const event of events||[]){
      const row=Number(event.row),bit=Number(event.bit),id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit);if(!id||ordinal<0)continue;
      patterns.push(hapticPatternFromProfile(profileFor(id,ordinal),!!event.on,Math.max(0,Number(event.arrivalMs)||0)));
    }
    return waveformFromPatterns(patterns);
  }
  function contactHapticSignatureFromProfile(p,engaging,phase){
    const base=hapticSignatureFromProfile(p,engaging),kind=String(phase||'armature');
    if(kind==='armature')return Object.freeze({id:p.id,engaging:!!engaging,phase:kind,durationMs:base.durationMs,amplitude:base.amplitude});
    const ordinalPhase=((p.ordinal*29+7)%TOTAL_RELAY_COUNT)/Math.max(1,TOTAL_RELAY_COUNT-1);
    if(kind==='bounce'){
      const amplitude=Math.round(clamp(base.amplitude*.54+(ordinalPhase-.5)*4,engaging?26:22,engaging?40:34));
      return Object.freeze({id:p.id,engaging:!!engaging,phase:kind,durationMs:2,amplitude});
    }
    const amplitude=Math.round(clamp(base.amplitude*.46+(ordinalPhase-.5)*3,engaging?24:20,engaging?36:31));
    return Object.freeze({id:p.id,engaging:!!engaging,phase:kind,durationMs:2,amplitude});
  }
  function playRelayContactHaptic(row,bit,engaging,phase){
    row=Number(row);bit=Number(bit);const id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit);if(!id||ordinal<0)return false;
    const p=profileFor(id,ordinal),signature=contactHapticSignatureFromProfile(p,!!engaging,phase),native=nativeHapticBridge();
    if(native){try{return native.relayImpact(signature.durationMs,signature.amplitude)!==false}catch(_){}}
    try{if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')return navigator.vibrate(signature.durationMs)!==false}catch(_){}
    return false;
  }
  function playRelayBankHaptic(events){
    const waveform=relayBankHapticPattern(events);if(!waveform.timings.length)return false;
    return playWaveform(waveform,null);
  }

  function buildRelayBuffer(ctx,p,engaging){
    const key=`${ctx.sampleRate}|${p.id}|${engaging?'set':'reset'}`,cached=bufferCache.get(key);if(cached)return cached;
    const sr=ctx.sampleRate,duration=engaging?.0105:.0097,n=Math.max(32,Math.floor(sr*duration)),buffer=ctx.createBuffer(1,n,sr),data=buffer.getChannelData(0),rnd=xorshift32(p.phaseSeed^(engaging?0x53455421:0x52535421));
    const phase=[rnd(),rnd(),rnd(),rnd()].map(v=>v*Math.PI*2),resetScale=engaging?1:.93,decayScale=engaging?1:.90;let prevNoise=0,prevDiff=0;
    for(let i=0;i<n;i++){
      const t=i/sr,noise=rnd()*2-1,diff=noise-prevNoise,highNoise=diff-prevDiff;prevNoise=noise;prevDiff=diff;
      const strike=highNoise*Math.exp(-t/p.strikeDecay)*p.strikeMix*resetScale;
      const ring=p.ringMix*(Math.sin(2*Math.PI*p.f1*t+phase[0])*Math.exp(-t/(p.d1*decayScale))*.24+Math.sin(2*Math.PI*p.f2*t+phase[1])*Math.exp(-t/(p.d2*decayScale))*.34+Math.sin(2*Math.PI*p.f3*t+phase[2])*Math.exp(-t/(p.d3*decayScale))*.25+Math.sin(2*Math.PI*p.f4*t+phase[3])*Math.exp(-t/(p.d4*decayScale))*.13);
      data[i]=(strike+ring)*Math.min(1,t/.00009);
    }
    let mean=0;for(let i=0;i<n;i++)mean+=data[i];mean/=n;let peak=0;for(let i=0;i<n;i++){data[i]-=mean;peak=Math.max(peak,Math.abs(data[i]))}if(peak>0){const scale=.82/peak;for(let i=0;i<n;i++)data[i]*=scale}bufferCache.set(key,buffer);return buffer;
  }
  function buildContactBuffer(ctx,p,engaging){
    const key=`${ctx.sampleRate}|${p.id}|contact|${engaging?'set':'reset'}`,cached=contactBufferCache.get(key);if(cached)return cached;
    const sr=ctx.sampleRate,duration=.00135,n=Math.max(24,Math.floor(sr*duration)),buffer=ctx.createBuffer(1,n,sr),data=buffer.getChannelData(0),rnd=xorshift32(p.contactSeed^(engaging?0x434d414b:0x4342524b)),f=10500+rnd()*5200,phase=rnd()*Math.PI*2;let previous=0;
    for(let i=0;i<n;i++){const t=i/sr,noise=rnd()*2-1,high=noise-previous;previous=noise;const envelope=Math.exp(-t/.00019),ring=Math.sin(2*Math.PI*f*t+phase)*Math.exp(-t/.00034);data[i]=(high*.72+ring*.28)*envelope}
    let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(data[i]));if(peak>0){const scale=.66/peak;for(let i=0;i<n;i++)data[i]*=scale}contactBufferCache.set(key,buffer);return buffer;
  }
  function playContactBounce(ctx,impactWhen,strength,p,engaging){
    const times=engaging?p.setBounceTimesMs:p.resetBounceTimesMs;if(!times.length)return;
    times.forEach((offsetMs,index)=>{const source=ctx.createBufferSource(),gain=ctx.createGain(),start=Math.max(ctx.currentTime+.00005,impactWhen+offsetMs/1000),decay=Math.pow(.68,index),level=environment.tickLevel();source.buffer=buildContactBuffer(ctx,p,engaging);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(.13*level*strength*p.level*decay,start+.000025);gain.gain.exponentialRampToValueAtTime(.0001,start+.00072);source.connect(gain);gain.connect(ctx.destination);source.start(start);source.stop(start+.0015)});
  }
  function playIdentity(ctx,impactWhen,strength,id,ordinal,engaging){
    const p=profileFor(id,ordinal),source=ctx.createBufferSource(),gain=ctx.createGain(),start=Math.max(ctx.currentTime+.00005,impactWhen),level=environment.tickLevel(),setReset=engaging?1.035:.915;
    source.buffer=buildRelayBuffer(ctx,p,engaging);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(.43*level*strength*p.level*setReset,start+.00008);gain.gain.exponentialRampToValueAtTime(.0001,start+(engaging?.0062:.0055));source.connect(gain);gain.connect(ctx.destination);source.start(start);source.stop(start+.0115);playContactBounce(ctx,start,strength,p,engaging);
  }
  function changedAux(current){const changes=[],next=current&&current.auxRelays||{};for(const name of AUX_ORDER){const before=!!lastAux[name],after=!!next[name];if(before!==after)changes.push({name,on:after})}lastAux=Object.assign({},next);return changes}
  function closestBit(deltaMs,settle){let best=-1,error=Infinity;for(let bit=0;bit<settle.length;bit++){const e=Math.abs(deltaMs-Number(settle[bit]));if(e<error){error=e;best=bit}}return error<=1.2?best:-1}

  function individualDskyRelayClick(ctx,when=ctx.currentTime,strength=1){
    const state=snapshot();if(!state)return fallbackEmitTick(ctx,when,strength);
    const auxChanges=changedAux(state);
    if(auxChanges.length){auxChanges.forEach((change,i)=>{const id=`AUX:${AUX_LABEL[change.name]}`,ordinal=auxOrdinal(change.name),p=profileFor(id,ordinal),individualStrength=change.on?.66:.58,travelMs=change.on?p.setTravelMs:p.resetTravelMs;playIdentity(ctx,when+travelMs/1000+i*.00008,individualStrength,id,ordinal,change.on)});return}
    const row=Number(state.activeDrive)||0,baseSettle=Array.isArray(state.armatureSettleMs)?state.armatureSettleMs:[];
    if(row>=1&&row<=12&&baseSettle.length===11){
      const deltaMs=Math.max(0,(when-ctx.currentTime)*1000),bit=closestBit(deltaMs,baseSettle);
      if(bit>=0){const target=state.lastWrite?Number(state.lastWrite.low11)&0o3777:0,engaging=!!(target&(1<<bit)),id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit);if(id&&ordinal>=0){const p=profileFor(id,ordinal),travelMs=engaging?p.setTravelMs:p.resetTravelMs;playIdentity(ctx,ctx.currentTime+travelMs/1000,strength,id,ordinal,engaging);return}}
    }
    fallbackEmitTick(ctx,when,strength);
  }
  function playRelayHaptic(row,bit,engaging){
    row=Number(row);bit=Number(bit);const id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit);if(!id||ordinal<0)return false;
    return playHapticProfile(profileFor(id,ordinal),!!engaging);
  }
  function playAuxHaptic(name,engaging){
    const p=auxProfile(name);if(!p)return false;
    return playHapticProfile(p,!!engaging);
  }
  function playRelayImpact(row,bit,engaging,strength=.66){
    if(!identityState.tickSound)return false;
    row=Number(row);bit=Number(bit);const id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit);if(!id||ordinal<0)return false;
    const ctx=audio.ensure();if(!ctx)return false;const on=!!engaging;
    const play=()=>playIdentity(ctx,ctx.currentTime+.00005,Number(strength)||.66,id,ordinal,on);
    if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});return true;
  }
  function playAuxImpact(name,engaging,strength=.62){
    if(!identityState.tickSound||!AUX_ORDER.includes(name))return false;
    const ctx=audio.ensure();if(!ctx)return false;const id=`AUX:${AUX_LABEL[name]}`,ordinal=auxOrdinal(name),on=!!engaging;
    const play=()=>playIdentity(ctx,ctx.currentTime+.00005,Number(strength)||.62,id,ordinal,on);
    if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});return true;
  }

  audio.installImplementation('emitTick',individualDskyRelayClick,'individual relay identity audio');

  const matrixProfile=(row,bit)=>{const id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit);return id&&ordinal>=0?profileFor(id,ordinal):null};
  const auxProfile=name=>{const ordinal=auxOrdinal(name);return ordinal>=LATCHING_RELAY_COUNT?profileFor(`AUX:${AUX_LABEL[name]}`,ordinal):null};
  const RELAY_SETTLE_MS=Object.freeze(Array.from({length:12},(_,rowIndex)=>Object.freeze(Array.from({length:11},(_,bit)=>{const p=matrixProfile(rowIndex+1,bit);return p?Math.max(p.setStableMs,p.resetStableMs):0}))));
  const allStable=RELAY_SETTLE_MS.flat().filter(value=>value>0);
  hardware.registerSnapshotExtension('relay-identity-audio',state=>{
    const next={...state};next.relaySettleMs=RELAY_SETTLE_MS.map(row=>row.slice());next.relaySettleMinMs=Math.min(...allStable);next.relaySettleMaxMs=Math.max(...allStable);next.relayManufacturingModel='physical-inventory-scd1006282-bounded-v2';next.relayTimingEvidence={latching:'SCD 1006282 <=3ms operate/release, <=1ms transfer, <=2ms bounce',nonLatching:'1010784 timing not yet independently sourced'};return next;
  });

  window.DSKY_RELAY_AUDIO=Object.freeze({
    latchingRelayCount:LATCHING_RELAY_COUNT,auxiliaryRelayCount:AUX_RELAY_COUNT,totalIndividualRelays:TOTAL_RELAY_COUNT,driveEnvelopeMs:DRIVE_ENVELOPE_MS,latchingOperateMaxMs:3,latchingReleaseMaxMs:3,latchingBounceMaxMs:LATCH_BOUNCE_MAX_MS,relayIdentity,
    settleMsFor:(row,bit)=>{const p=matrixProfile(row,bit);return p?Math.max(p.setStableMs,p.resetStableMs):null},
    profileFor:(row,bit)=>matrixProfile(row,bit),
    contactTraceFor:(row,bit,engaging)=>{const p=matrixProfile(row,bit);return p?contactTraceFromProfile(p,!!engaging):[]},
    hapticSignatureFor:(row,bit,engaging)=>{const p=matrixProfile(row,bit);return p?hapticSignatureFromProfile(p,!!engaging):null},
    hapticPatternFor:(row,bit,engaging)=>{const p=matrixProfile(row,bit);return p?hapticPatternFromProfile(p,!!engaging,0):null},
    contactHapticSignatureFor:(row,bit,engaging,phase)=>{const p=matrixProfile(row,bit);return p?contactHapticSignatureFromProfile(p,!!engaging,phase):null},
    relayBankHapticPatternFor:events=>relayBankHapticPattern(events),
    playRelayImpact,playRelayHaptic,playRelayContactHaptic,playRelayBankHaptic,
    auxiliaryNames:Object.freeze(AUX_ORDER.slice()),
    auxiliaryProfileFor:name=>auxProfile(name),
    auxiliaryContactTraceFor:(name,engaging)=>{const p=auxProfile(name);return p?contactTraceFromProfile(p,!!engaging):[]},
    auxiliaryHapticSignatureFor:(name,engaging)=>{const p=auxProfile(name);return p?hapticSignatureFromProfile(p,!!engaging):null},
    auxiliaryHapticPatternFor:(name,engaging)=>{const p=auxProfile(name);return p?hapticPatternFromProfile(p,!!engaging,0):null},
    playAuxImpact,playAuxHaptic
  });
})();