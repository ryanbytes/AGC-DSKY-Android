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
  if(!audio||!environment||!hardware||!identityState)throw new Error('Relay identity service dependencies unavailable');
  const fallbackEmitTick=audio.implementation('emitTick');
  if(typeof fallbackEmitTick!=='function')throw new Error('Relay audio implementation unavailable');
  const bufferCache=new Map(),contactBufferCache=new Map();

  const LATCHING_RELAY_COUNT = 132;
  const DRIVE_ENVELOPE_MS = 20;
  const CONTACT_GUARD_MS = 0.35;
  const MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS;
  const SET_TRAVEL_MIN_MS=5.1,SET_TRAVEL_MAX_MS=13.6,RESET_TRAVEL_MIN_MS=4.7,RESET_TRAVEL_MAX_MS=12.8;
  const AUX_ORDER=Object.freeze(['comp','uplink','temp','keyrel','oprerr','flash','restart','stby']);
  const AUX_LABEL=Object.freeze({comp:'COMP-ACTY',uplink:'UPLINK-ACTY',temp:'TEMP',keyrel:'KEY-REL',oprerr:'OPR-ERR',flash:'FLASH',restart:'RESTART',stby:'STBY'});

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
  function bitName(bit){if(bit===10)return'B';if(bit>=5)return`C-K${bit-4}`;return`D-K${bit+1}`}
  function relayIdentity(row,bit){return`ROW-${String(row).padStart(2,'0')}:${bitName(bit)}`}
  function relayOrdinal(row,bit){return(row-1)*11+bit}
  function auxOrdinal(name){const i=AUX_ORDER.indexOf(name);return LATCHING_RELAY_COUNT+Math.max(0,i)}

  function bouncePattern(rnd,count,windowMs){
    if(count<=0||windowMs<=0)return Object.freeze([]);const out=[],slot=windowMs/(count+1);
    for(let i=1;i<=count;i++){const jitter=(rnd()*2-1)*slot*.24;out.push(clamp(i*slot+jitter,.05,windowMs-.03))}
    out.sort((a,b)=>a-b);return Object.freeze(out);
  }
  function manufacturingProfile(id,ordinal){
    const rnd=xorshift32(hash32(`${id}:manufacture`));
    const positionPhase=((ordinal*73+17)%LATCHING_RELAY_COUNT)/Math.max(1,LATCHING_RELAY_COUNT-1);
    const setTravelMs=clamp(SET_TRAVEL_MIN_MS+(SET_TRAVEL_MAX_MS-SET_TRAVEL_MIN_MS)*clamp(.58*positionPhase+.42*rnd(),0,1),SET_TRAVEL_MIN_MS,SET_TRAVEL_MAX_MS);
    const resetTravelMs=clamp(RESET_TRAVEL_MIN_MS+(RESET_TRAVEL_MAX_MS-RESET_TRAVEL_MIN_MS)*clamp(.52*(1-positionPhase)+.48*rnd(),0,1),RESET_TRAVEL_MIN_MS,RESET_TRAVEL_MAX_MS);
    const poleSkewUs=Math.round((rnd()*2-1)*185);
    const setBounceCount=2+Math.floor(rnd()*5),resetBounceCount=1+Math.floor(rnd()*4);
    const setBounceWindowMs=.55+rnd()*2.35,resetBounceWindowMs=.35+rnd()*1.85;
    const setBounceTimesMs=bouncePattern(rnd,setBounceCount,setBounceWindowMs),resetBounceTimesMs=bouncePattern(rnd,resetBounceCount,resetBounceWindowMs);
    const setTailMs=.12+rnd()*.34,resetTailMs=.10+rnd()*.28;
    const setLastBounce=setBounceTimesMs.length?setBounceTimesMs[setBounceTimesMs.length-1]:0,resetLastBounce=resetBounceTimesMs.length?resetBounceTimesMs[resetBounceTimesMs.length-1]:0;
    const setStableMs=Math.min(MAX_CONTACT_STABLE_MS,setTravelMs+setLastBounce+setTailMs),resetStableMs=Math.min(MAX_CONTACT_STABLE_MS,resetTravelMs+resetLastBounce+resetTailMs);
    return Object.freeze({setTravelMs,resetTravelMs,setStableMs,resetStableMs,setBounceCount,resetBounceCount,setBounceTimesMs,resetBounceTimesMs,setBounceWindowMs,resetBounceWindowMs,poleSkewUs});
  }
  function contactTraceFromProfile(p,engaging){
    const travelMs=engaging?p.setTravelMs:p.resetTravelMs,stableMs=engaging?p.setStableMs:p.resetStableMs,bounceTimes=engaging?p.setBounceTimesMs:p.resetBounceTimesMs,finalState=!!engaging;
    let state=finalState;const events=[{atMs:travelMs,state,kind:'armature'}];
    for(const offset of bounceTimes){state=!state;events.push({atMs:travelMs+offset,state,kind:'bounce'})}events.push({atMs:stableMs,state:finalState,kind:'settled'});return events;
  }
  function profile(id,ordinal){
    const m=manufacturingProfile(id,ordinal),rnd=xorshift32(hash32(`${id}:acoustic`)),centered=()=>rnd()*2-1,serialOffset=(ordinal-69.5)*.00034,bodyScale=1+serialOffset+centered()*.0035;
    return Object.freeze({id,ordinal,...m,settleMs:Math.max(m.setStableMs,m.resetStableMs),f1:5600*bodyScale*(1+centered()*.0040),f2:8300*bodyScale*(1+centered()*.0045),f3:11600*bodyScale*(1+centered()*.0050),f4:14200*bodyScale*(1+centered()*.0055),d1:.00155*(1+centered()*.09),d2:.00185*(1+centered()*.09),d3:.00135*(1+centered()*.10),d4:.00095*(1+centered()*.11),strikeDecay:.00033*(1+centered()*.12),strikeMix:.14*(1+centered()*.10),ringMix:1+centered()*.045,level:1+centered()*.050,phaseSeed:hash32(`${id}:phase`),contactSeed:hash32(`${id}:contact`)});
  }
  const profileCache=new Map();
  function profileFor(id,ordinal){const key=`${id}|${ordinal}`;if(!profileCache.has(key))profileCache.set(key,profile(id,ordinal));return profileCache.get(key)}

  // Perceptual haptic identity follows the same deterministic mechanical profile
  // as relay travel/bounce/audio. Device testing showed the original 4-8 ms /
  // low-amplitude range collapsed perceptually on Pixel hardware, so this mapping
  // preserves the same identity inputs with a wider perceptual range. This is not
  // a claim that surviving Apollo documentation specifies handset vibration force.
  function hapticSignatureFromProfile(p,engaging){
    const on=!!engaging,travel=on?p.setTravelMs:p.resetTravelMs,stable=on?p.setStableMs:p.resetStableMs,bounces=on?p.setBounceCount:p.resetBounceCount;
    const travelMin=on?SET_TRAVEL_MIN_MS:RESET_TRAVEL_MIN_MS,travelMax=on?SET_TRAVEL_MAX_MS:RESET_TRAVEL_MAX_MS;
    const travelNorm=clamp((travel-travelMin)/Math.max(.001,travelMax-travelMin),0,1),tailNorm=clamp((stable-travel)/3.0,0,1),skewNorm=clamp(Math.abs(p.poleSkewUs)/185,0,1),ordinalPhase=((p.ordinal*37+11)%140)/139;
    const durationMs=Math.round(clamp((on?10.5:6.5)+travelNorm*(on?3.5:2.4)+tailNorm*(on?1.2:1.0)+ordinalPhase*(on?.8:.6),on?11:7,on?16:10));
    const amplitude=Math.round(clamp((on?112:60)+travelNorm*(on?40:28)+tailNorm*(on?16:10)+skewNorm*(on?8:6)+Math.min(4,bounces)*(on?2.5:2.0)+(ordinalPhase-.5)*(on?16:12),on?110:60,on?180:115));
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
        const gapMs=(on?7:6)+Math.round(normalized*(on?12:9))+i*(on?2:1);
        const durationMs=Math.max(3,Math.min(6,Math.round((on?4.5:3.5)+(Math.abs(p.poleSkewUs)/185)*.8-i*.45)));
        const amplitude=Math.round(clamp(signature.amplitude*(on?.44:.38)*Math.pow(.72,i),on?48:40,on?92:72));
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
      const row=Number(event.row),bit=Number(event.bit);if(row<1||row>12||bit<0||bit>10)continue;
      patterns.push(hapticPatternFromProfile(profileFor(relayIdentity(row,bit),relayOrdinal(row,bit)),!!event.on,Math.max(0,Number(event.arrivalMs)||0)));
    }
    return waveformFromPatterns(patterns);
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
    if(auxChanges.length){auxChanges.forEach((change,i)=>{const id=`AUX:${AUX_LABEL[change.name]||change.name.toUpperCase()}`,ordinal=auxOrdinal(change.name),p=profileFor(id,ordinal),individualStrength=change.on?.66:.58,travelMs=change.on?p.setTravelMs:p.resetTravelMs;playIdentity(ctx,when+travelMs/1000+i*.00008,individualStrength,id,ordinal,change.on)});return}
    const row=Number(state.activeDrive)||0,baseSettle=Array.isArray(state.armatureSettleMs)?state.armatureSettleMs:[];
    if(row>=1&&row<=12&&baseSettle.length===11){
      const deltaMs=Math.max(0,(when-ctx.currentTime)*1000),bit=closestBit(deltaMs,baseSettle);
      if(bit>=0){const target=state.lastWrite?Number(state.lastWrite.low11)&0o3777:0,engaging=!!(target&(1<<bit)),id=relayIdentity(row,bit),ordinal=relayOrdinal(row,bit),p=profileFor(id,ordinal),travelMs=engaging?p.setTravelMs:p.resetTravelMs;playIdentity(ctx,ctx.currentTime+travelMs/1000,strength,id,ordinal,engaging);return}
    }
    fallbackEmitTick(ctx,when,strength);
  }
  function playRelayHaptic(row,bit,engaging){
    row=Number(row);bit=Number(bit);if(row<1||row>12||bit<0||bit>10)return false;
    return playHapticProfile(profileFor(relayIdentity(row,bit),relayOrdinal(row,bit)),!!engaging);
  }
  function playAuxHaptic(name,engaging){
    if(!AUX_ORDER.includes(name))return false;
    return playHapticProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging);
  }
  function playRelayImpact(row,bit,engaging,strength=.66){
    if(!identityState.tickSound)return false;
    row=Number(row);bit=Number(bit);if(row<1||row>12||bit<0||bit>10)return false;
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

  const RELAY_SETTLE_MS=Object.freeze(Array.from({length:12},(_,rowIndex)=>Object.freeze(Array.from({length:11},(_,bit)=>{const p=profileFor(relayIdentity(rowIndex+1,bit),relayOrdinal(rowIndex+1,bit));return Math.max(p.setStableMs,p.resetStableMs)}))));
  const allStable=RELAY_SETTLE_MS.flat();
  hardware.registerSnapshotExtension('relay-identity-audio',state=>{
    const next={...state};next.relaySettleMs=RELAY_SETTLE_MS.map(row=>row.slice());next.relaySettleMinMs=Math.min(...allStable);next.relaySettleMaxMs=Math.max(...allStable);next.relayManufacturingModel='deterministic-per-relay-set-reset-bounce-v1';return next;
  });

  window.DSKY_RELAY_AUDIO=Object.freeze({
    latchingRelayCount:LATCHING_RELAY_COUNT,auxiliaryRelayCount:AUX_ORDER.length,totalIndividualRelays:LATCHING_RELAY_COUNT+AUX_ORDER.length,driveEnvelopeMs:DRIVE_ENVELOPE_MS,maxContactStableMs:MAX_CONTACT_STABLE_MS,relayIdentity,
    settleMsFor:(row,bit)=>{const p=profileFor(relayIdentity(row,bit),relayOrdinal(row,bit));return Math.max(p.setStableMs,p.resetStableMs)},
    profileFor:(row,bit)=>profileFor(relayIdentity(row,bit),relayOrdinal(row,bit)),
    contactTraceFor:(row,bit,engaging)=>contactTraceFromProfile(profileFor(relayIdentity(row,bit),relayOrdinal(row,bit)),!!engaging),
    hapticSignatureFor:(row,bit,engaging)=>hapticSignatureFromProfile(profileFor(relayIdentity(row,bit),relayOrdinal(row,bit)),!!engaging),
    hapticPatternFor:(row,bit,engaging)=>hapticPatternFromProfile(profileFor(relayIdentity(row,bit),relayOrdinal(row,bit)),!!engaging,0),
    relayBankHapticPatternFor:events=>relayBankHapticPattern(events),
    playRelayImpact,playRelayHaptic,playRelayBankHaptic,
    auxiliaryNames:Object.freeze(AUX_ORDER.slice()),
    auxiliaryProfileFor:name=>profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),
    auxiliaryContactTraceFor:(name,engaging)=>contactTraceFromProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging),
    auxiliaryHapticSignatureFor:(name,engaging)=>hapticSignatureFromProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging),
    auxiliaryHapticPatternFor:(name,engaging)=>hapticPatternFromProfile(profileFor(`AUX:${AUX_LABEL[name]||String(name).toUpperCase()}`,auxOrdinal(name)),!!engaging,0),
    playAuxImpact,playAuxHaptic
  });
})();