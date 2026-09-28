'use strict';

/*
 * Block II DSKY relay presentation.
 * hardware-fidelity.js owns the documented 20-ms bank-drive/settle envelope.
 * Surviving production documentation proves the physical relay population but
 * does not provide measured unit-by-unit timing for 2004688/2004689. Therefore
 * this service must not invent per-relay mechanical travel, bounce, pole skew,
 * or "manufacturing fingerprints". The contact timing below uses explicitly
 * documented predecessor presentation references. The latching 3-ms value is
 * from initial-release 1006282; later Rev C permits 10 ms and includes dash -2.
 * Neither reference is a measured production 2004688/2004689 calibration.
 */
(() => {
  const audio=window.AGCDSKY_AUDIO;
  const environment=window.AGCDSKY_ENVIRONMENT;
  const hardware=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE');
  const identityState=window.AGCDSKY_APP_STATE;
  const topology=window.DSKY_RELAY_TOPOLOGY;
  if(!audio||!environment||!hardware||!identityState||!topology)throw new Error('Relay identity service dependencies unavailable');
  const fallbackEmitTick=audio.implementation('emitTick');
  if(typeof fallbackEmitTick!=='function')throw new Error('Relay audio implementation unavailable');
  const bufferCache=new Map(),contactBufferCache=new Map();

  const LATCHING_RELAY_COUNT = topology.latchingRelayCount;
  const PHYSICAL_RELAY_COUNT = topology.physicalRelayCount;
  const DRIVE_ENVELOPE_MS = 20;
  // Keep the public diagnostic boundary and the documented 20-ms bank envelope
  // separate from the relay-unit presentation reference.
  const CONTACT_GUARD_MS = 0;
  const MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS;
  // NASA/MIT SCD 1006282 is revision-sensitive. Initial release specifies
  // operate/release <=3 ms at the suggested source voltage, transfer <=1 ms,
  // bounce <=2 ms; Rev C later permits operate <=10 ms under all Table I
  // conditions and includes dash -2. Production 2004688 timing is unrecovered.
  // Keep 3 ms only as the existing initial-release presentation reference; it
  // is not a conservative family-wide upper bound or a production measurement.
  const LATCHING_PRESENTATION_REFERENCE_MS = 3;
  // NASA/MIT SCD 1010784 (predecessor general-purpose relay): operate/release
  // <=5 ms and contact bounce <=2 ms. Production DSKYs use 2004689; 5 ms is a
  // predecessor-spec presentation reference, not a claimed 2004689 measurement.
  const NON_LATCHING_PRESENTATION_REFERENCE_MS = 5;
  const AUX_ORDER=topology.nonLatchingNames;
  const AUX_LABEL=Object.freeze(Object.fromEntries(topology.nonLatchingRelays.map(item=>[item.name,item.id.replace(/^AUX:/,'')])));

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
  function relayIdentity(row,bit){return topology.relayIdentity(row,bit)}
  function relayOrdinal(row,bit){return topology.latchingOrdinal(row,bit)}
  function auxOrdinal(name){return topology.nonLatchingOrdinal(name)}

  function sourceBoundTimingProfile(id){
    const auxiliary=String(id).startsWith('AUX:');
    const travelMs=auxiliary?NON_LATCHING_PRESENTATION_REFERENCE_MS:LATCHING_PRESENTATION_REFERENCE_MS;
    const timingBasis=auxiliary
      ?'predecessor-1010784-upper-bound-reference; production-2004689-exact-timing-unresolved'
      :'predecessor-1006282-initial-release-reference; rev-c-10ms-dash-2; production-2004688-exact-timing-unresolved';
    // Do not fabricate bounce timing or pole-to-pole skew. The predecessor SCDs
    // specify maxima but do not provide an individual unit trace, and the later
    // production relay SCDs are not presently readable in the recovered archive.
    return Object.freeze({
      setTravelMs:travelMs,resetTravelMs:travelMs,
      setStableMs:travelMs,resetStableMs:travelMs,
      setBounceCount:0,resetBounceCount:0,
      setBounceTimesMs:Object.freeze([]),resetBounceTimesMs:Object.freeze([]),
      setBounceWindowMs:0,resetBounceWindowMs:0,poleSkewUs:0,timingBasis
    });
  }
  function contactTraceFromProfile(p,engaging){
    const travelMs=engaging?p.setTravelMs:p.resetTravelMs,stableMs=engaging?p.setStableMs:p.resetStableMs,bounceTimes=engaging?p.setBounceTimesMs:p.resetBounceTimesMs,finalState=!!engaging;
    let state=finalState;const events=[{atMs:travelMs,state,kind:'armature'}];
    for(const offset of bounceTimes){state=!state;events.push({atMs:travelMs+offset,state,kind:'bounce'})}events.push({atMs:stableMs,state:finalState,kind:'settled'});return events;
  }
  function profile(id,ordinal){
    const m=sourceBoundTimingProfile(id),auxiliary=String(id).startsWith('AUX:');
    // Audio is a generic perceptual click for the relay class. The D1-D6/K1-K20
    // crosswalk is now source-proven, but no flown-unit acoustic data supports
    // per-package acoustic individuality.
    const bodyScale=auxiliary?.985:1;
    return Object.freeze({
      id,ordinal,...m,settleMs:Math.max(m.setStableMs,m.resetStableMs),
      acousticBasis:'generic-perceptual-relay-class-cue; not measured Apollo audio',
      f1:5600*bodyScale,f2:8300*bodyScale,f3:11600*bodyScale,f4:14200*bodyScale,
      d1:.00155,d2:.00185,d3:.00135,d4:.00095,
      strikeDecay:.00033,strikeMix:.14,ringMix:1,level:1,
      phaseSeed:hash32(auxiliary?'AUX:generic:phase':'LATCHING:generic:phase'),
      contactSeed:hash32(auxiliary?'AUX:generic:contact':'LATCHING:generic:contact')
    });
  }
  const profileCache=new Map();
  function profileFor(id,ordinal){if(!id||!Number.isInteger(ordinal)||ordinal<0)return null;const key=`${id}|${ordinal}`;if(!profileCache.has(key))profileCache.set(key,profile(id,ordinal));return profileCache.get(key)}
  function relayProfile(row,bit){if(!topology.isLatchingRelay(row,bit))return null;return profileFor(relayIdentity(row,bit),relayOrdinal(row,bit))}

  // Haptics are an explicitly non-historical handset presentation cue tied only
  // to the modeled physical armature event. Apollo documentation does not specify
  // phone vibration force or per-relay tactile individuality.
  function hapticSignatureFromProfile(p,engaging){
    const on=!!engaging;
    // Absolute minimum non-zero Android relay pulse: 1 ms at 1/255.
    // No per-package tactile individuality is claimed: production unit-to-unit
    // mechanical variation is unresolved. The handset cue is intentionally uniform.
    return Object.freeze({id:p.id,engaging:on,durationMs:1,amplitude:1});
  }
  function hapticPatternFromProfile(p,engaging,atMs=0){
    const on=!!engaging,signature=hapticSignatureFromProfile(p,on),baseAt=Math.max(0,Number(atMs)||0);
    // One tactile indication per physical armature movement. Contact bounce remains
    // modeled in sound/visual contact behavior, but is intentionally not sent to
    // the handset vibrator.
    const pulses=Object.freeze([Object.freeze({atMs:baseAt,durationMs:signature.durationMs,amplitude:signature.amplitude,kind:'armature'})]);
    return Object.freeze({id:p.id,engaging:on,pulses});
  }
  function waveformFromPatterns(patterns){
    const pulses=[];for(const pattern of patterns||[])for(const pulse of pattern&&pattern.pulses||[])pulses.push(pulse);
    if(!pulses.length)return Object.freeze({timings:Object.freeze([]),amplitudes:Object.freeze([]),totalMs:0,pulseCount:0});
    const totalMs=Math.min(720,Math.max(...pulses.map(p=>Math.ceil(p.atMs+p.durationMs)))+1),levels=new Array(totalMs).fill(0);
    for(const pulse of pulses){
      const start=Math.max(0,Math.min(totalMs-1,Math.floor(pulse.atMs))),end=Math.max(start+1,Math.min(totalMs,Math.ceil(pulse.atMs+pulse.durationMs))),amplitude=Math.max(1,Math.round(pulse.amplitude));
      for(let t=start;t<end;t++)levels[t]=levels[t]===0?amplitude:Math.min(3,levels[t]+amplitude);
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
    if(!identityState.relayHaptics)return false;
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
      const row=Number(event.row),bit=Number(event.bit);if(row<1||row>12||bit<0||bit>10||!topology.isLatchingRelay(row,bit))continue;
      patterns.push(hapticPatternFromProfile(relayProfile(row,bit),!!event.on,Math.max(0,Number(event.arrivalMs)||0)));
    }
    return waveformFromPatterns(patterns);
  }
  function contactHapticSignatureFromProfile(p,engaging,phase){
    const kind=String(phase||'armature');
    if(kind!=='armature')return null;
    const base=hapticSignatureFromProfile(p,engaging);
    return Object.freeze({id:p.id,engaging:!!engaging,phase:kind,durationMs:base.durationMs,amplitude:base.amplitude});
  }
  function playRelayContactHaptic(row,bit,engaging,phase){
    if(!identityState.relayHaptics)return false;
    row=Number(row);bit=Number(bit);if(row<1||row>12||bit<0||bit>10||!topology.isLatchingRelay(row,bit))return false;
    const p=relayProfile(row,bit),signature=contactHapticSignatureFromProfile(p,!!engaging,phase);
    if(!signature)return false;
    const native=nativeHapticBridge();
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
  function closestBit(deltaMs,settle,row=0){let best=-1,error=Infinity;for(let bit=0;bit<settle.length;bit++){if(row&&!topology.isLatchingRelay(row,bit))continue;const e=Math.abs(deltaMs-Number(settle[bit]));if(e<error){error=e;best=bit}}return error<=1.2?best:-1}

  function individualDskyRelayClick(ctx,when=ctx.currentTime,strength=1){
    const state=snapshot();if(!state)return fallbackEmitTick(ctx,when,strength);
    const auxChanges=changedAux(state);
    if(auxChanges.length){auxChanges.forEach((change,i)=>{const id=`AUX:${AUX_LABEL[change.name]||change.name.toUpperCase()}`,ordinal=auxOrdinal(change.name),p=profileFor(id,ordinal),individualStrength=change.on?.66:.58,travelMs=change.on?p.setTravelMs:p.resetTravelMs;playIdentity(ctx,when+travelMs/1000+i*.00008,individualStrength,id,ordinal,change.on)});return}
    const row=Number(state.activeDrive)||0,baseSettle=Array.isArray(state.armatureSettleMs)?state.armatureSettleMs:[];
    if(row>=1&&row<=12&&baseSettle.length===11){
      const deltaMs=Math.max(0,(when-ctx.currentTime)*1000),bit=closestBit(deltaMs,baseSettle,row);
      if(bit>=0&&topology.isLatchingRelay(row,bit)){const target=state.lastWrite?Number(state.lastWrite.low11)&0o3777:0,engaging=!!(target&(1<<bit)),id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit),p=relayProfile(row,bit),travelMs=engaging?p.setTravelMs:p.resetTravelMs;playIdentity(ctx,ctx.currentTime+travelMs/1000,strength,id,ordinal,engaging);return}
    }
    fallbackEmitTick(ctx,when,strength);
  }
  function playRelayHaptic(row,bit,engaging){
    row=Number(row);bit=Number(bit);if(row<1||row>12||bit<0||bit>10)return false;
    if(!topology.isLatchingRelay(row,bit))return false;
    return playHapticProfile(relayProfile(row,bit),!!engaging);
  }
  function playAuxHaptic(name,engaging){
    if(!AUX_ORDER.includes(name))return false;
    return playHapticProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging);
  }
  function playRelayImpact(row,bit,engaging,strength=.66){
    if(!identityState.tickSound)return false;
    row=Number(row);bit=Number(bit);if(row<1||row>12||bit<0||bit>10)return false;
    if(!topology.isLatchingRelay(row,bit))return false;
    const ctx=audio.ensure();if(!ctx)return false;const id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit),on=!!engaging;
    const play=()=>playIdentity(ctx,ctx.currentTime+.00005,Number(strength)||.66,id,ordinal,on);
    if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});return true;
  }
  function playAuxImpact(name,engaging,strength=.62){
    if(!identityState.tickSound||!AUX_ORDER.includes(name))return false;
    const ctx=audio.ensure();if(!ctx)return false;const id=`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,ordinal=auxOrdinal(name),on=!!engaging;
    const play=()=>playIdentity(ctx,ctx.currentTime+.00005,Number(strength)||.62,id,ordinal,on);
    if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});return true;
  }

  audio.installImplementation('emitTick',individualDskyRelayClick,'individual relay identity audio');

  const RELAY_SETTLE_MS=Object.freeze(Array.from({length:12},(_,rowIndex)=>Object.freeze(Array.from({length:11},(_,bit)=>{if(!topology.isLatchingRelay(rowIndex+1,bit))return null;const p=relayProfile(rowIndex+1,bit);return Math.max(p.setStableMs,p.resetStableMs)}))));
  const allStable=RELAY_SETTLE_MS.flat().filter(Number.isFinite);
  hardware.registerSnapshotExtension('relay-identity-audio',state=>{
    const next={...state};next.relaySettleMs=RELAY_SETTLE_MS.map(row=>row.slice());next.relaySettleMinMs=Math.min(...allStable);next.relaySettleMaxMs=Math.max(...allStable);next.relayManufacturingModel='source-bounded-topology-with-unresolved-production-relay-unit-timing-v2';return next;
  });

  window.DSKY_RELAY_AUDIO=Object.freeze({
    latchingRelayCount:LATCHING_RELAY_COUNT,auxiliaryRelayCount:AUX_ORDER.length,totalIndividualRelays:LATCHING_RELAY_COUNT+AUX_ORDER.length,driveEnvelopeMs:DRIVE_ENVELOPE_MS,maxContactStableMs:MAX_CONTACT_STABLE_MS,relayIdentity,
    settleMsFor:(row,bit)=>{const p=relayProfile(row,bit);return p?Math.max(p.setStableMs,p.resetStableMs):null},
    profileFor:(row,bit)=>relayProfile(row,bit),
    contactTraceFor:(row,bit,engaging)=>{const p=relayProfile(row,bit);return p?contactTraceFromProfile(p,!!engaging):[]},
    hapticSignatureFor:(row,bit,engaging)=>{const p=relayProfile(row,bit);return p?hapticSignatureFromProfile(p,!!engaging):null},
    hapticPatternFor:(row,bit,engaging)=>{const p=relayProfile(row,bit);return p?hapticPatternFromProfile(p,!!engaging,0):null},
    contactHapticSignatureFor:(row,bit,engaging,phase)=>{const p=relayProfile(row,bit);return p?contactHapticSignatureFromProfile(p,!!engaging,phase):null},
    relayBankHapticPatternFor:events=>relayBankHapticPattern(events),
    hapticsEnabled:()=>!!identityState.relayHaptics,
    playRelayImpact,playRelayHaptic,playRelayContactHaptic,playRelayBankHaptic,
    auxiliaryNames:Object.freeze(AUX_ORDER.slice()),
    auxiliaryProfileFor:name=>profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),
    auxiliaryContactTraceFor:(name,engaging)=>contactTraceFromProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging),
    auxiliaryHapticSignatureFor:(name,engaging)=>hapticSignatureFromProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging),
    auxiliaryHapticPatternFor:(name,engaging)=>hapticPatternFromProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging,0),
    playAuxImpact,playAuxHaptic
  });
})();