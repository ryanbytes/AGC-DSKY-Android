'use strict';

/*
 * Perceptual relay-identity layer. Keeps physical timing from DSKY_RELAY_AUDIO
 * while widening only the audible timbre envelope enough for phone speakers.
 */
(() => {
  const compat=window.AGCDSKY_COMPAT;
  const environment=window.AGCDSKY_ENVIRONMENT;
  const hardware=window.AGCDSKY_HARDWARE;
  const audioModel=window.DSKY_RELAY_AUDIO;
  if(!compat||!environment||!hardware||!audioModel)throw new Error('Relay perceptual service dependencies unavailable');
  // Optional phone-speaker exaggeration. Keep the source-faithful relay model
  // as the default; enable only for deliberate diagnostics/experiments.
  let perceptualEnabled=false;
  try{perceptualEnabled=localStorage.getItem('relayPerceptualAudioV1')==='1'}catch(_){}
  if(!perceptualEnabled){
    window.DSKY_RELAY_PERCEPTUAL=Object.freeze({enabled:false,model:'source-faithful-default',timingSource:'DSKY_RELAY_AUDIO set/reset travel profiles'});
    return;
  }
  const fallbackEmitTick=compat.get('emitTick');
  if(typeof fallbackEmitTick!=='function')throw new Error('Relay audio implementation unavailable');
  const buffers=new Map();

  function hash32(text){let h=0x811c9dc5;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0}h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;return(h^(h>>>16))>>>0}
  function xorshift32(seed){let state=(seed>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}}
  function unitSeed(){try{return localStorage.getItem('dskyHardwareUnitSeedV1')||'6d2b79f5'}catch(_){return'6d2b79f5'}}
  function closestBit(deltaMs,settle){let best=-1,error=Infinity;for(let bit=0;bit<settle.length;bit++){const e=Math.abs(deltaMs-Number(settle[bit]));if(e<error){error=e;best=bit}}return error<=1.2?best:-1}
  function activeIdentity(ctx,when){
    let state;try{state=hardware.snapshot()}catch(_){return null}if(!state)return null;
    const row=Number(state.activeDrive)||0,settle=Array.isArray(state.armatureSettleMs)?state.armatureSettleMs:[];if(row<1||row>12||settle.length!==11)return null;
    const deltaMs=Math.max(0,(when-ctx.currentTime)*1000),bit=closestBit(deltaMs,settle);if(bit<0)return null;
    const target=state.lastWrite?Number(state.lastWrite.low11)&0o3777:0,engaging=!!(target&(1<<bit)),p=audioModel.profileFor(row,bit);return{row,bit,engaging,p};
  }
  function buildBuffer(ctx,identity){
    const{row,bit,engaging,p}=identity,seedText=`${unitSeed()}|${row}|${bit}|${engaging?'set':'reset'}`,key=`${ctx.sampleRate}|${seedText}`;if(buffers.has(key))return buffers.get(key);
    const rnd=xorshift32(hash32(seedText)),serial=((p.ordinal*37+11)%131)/130,pitchScale=.86+serial*.28+(rnd()-.5)*.035,brightScale=.90+rnd()*.22,decayScale=.78+rnd()*.48,duration=(engaging?.0125:.0115)*decayScale,sr=ctx.sampleRate,n=Math.max(64,Math.floor(sr*duration)),buffer=ctx.createBuffer(1,n,sr),data=buffer.getChannelData(0),f1=3600*pitchScale,f2=5350*pitchScale*brightScale,f3=7600*pitchScale*brightScale,ph1=rnd()*Math.PI*2,ph2=rnd()*Math.PI*2,ph3=rnd()*Math.PI*2;let prev=0;
    for(let i=0;i<n;i++){const t=i/sr,noise=rnd()*2-1,edge=noise-prev;prev=noise;const strike=edge*Math.exp(-t/(.00024*decayScale))*(.16+rnd()*.035),ring=Math.sin(2*Math.PI*f1*t+ph1)*Math.exp(-t/(.00175*decayScale))*.31+Math.sin(2*Math.PI*f2*t+ph2)*Math.exp(-t/(.00135*decayScale))*.36+Math.sin(2*Math.PI*f3*t+ph3)*Math.exp(-t/(.00092*decayScale))*.23;data[i]=(strike+ring)*Math.min(1,t/.000075)}
    let mean=0,peak=0;for(let i=0;i<n;i++)mean+=data[i];mean/=n;for(let i=0;i<n;i++){data[i]-=mean;peak=Math.max(peak,Math.abs(data[i]))}if(peak>0){const scale=.84/peak;for(let i=0;i<n;i++)data[i]*=scale}buffers.set(key,buffer);return buffer;
  }
  function playPerceptibleIdentity(ctx,identity,strength){
    const{engaging,p}=identity,source=ctx.createBufferSource(),gain=ctx.createGain(),travelMs=engaging?p.setTravelMs:p.resetTravelMs,when=Math.max(ctx.currentTime+.00005,ctx.currentTime+travelMs/1000),level=environment.tickLevel(),relayGain=.92+(((p.ordinal*19)%29)/28)*.18;
    source.buffer=buildBuffer(ctx,identity);gain.gain.setValueAtTime(.0001,when);gain.gain.linearRampToValueAtTime(.48*level*strength*relayGain*(engaging?1.04:.92),when+.00007);gain.gain.exponentialRampToValueAtTime(.0001,when+(engaging?.0072:.0063));source.connect(gain);gain.connect(ctx.destination);source.start(when);source.stop(when+.015);
    const bounceTimes=engaging?p.setBounceTimesMs:p.resetBounceTimesMs;for(let i=0;i<bounceTimes.length;i++){const bounce=ctx.createOscillator(),bg=ctx.createGain(),bt=when+bounceTimes[i]/1000,freq=(6200+((p.ordinal*97+i*311)%2600))*(.96+i*.015);bounce.type='triangle';bounce.frequency.setValueAtTime(freq,bt);bg.gain.setValueAtTime(.055*level*strength*Math.pow(.58,i),bt);bg.gain.exponentialRampToValueAtTime(.0001,bt+.00055);bounce.connect(bg);bg.connect(ctx.destination);bounce.start(bt);bounce.stop(bt+.00075)}
  }
  function perceptibleIndividualRelay(ctx,when=ctx.currentTime,strength=1){const identity=activeIdentity(ctx,when);if(!identity)return fallbackEmitTick(ctx,when,strength);playPerceptibleIdentity(ctx,identity,strength)}
  compat.replace('emitTick',perceptibleIndividualRelay,'relay perceptual personality');

  window.DSKY_RELAY_PERCEPTUAL=Object.freeze({enabled:true,model:'deterministic-installed-unit-audible-spread-v1',unitSeed:unitSeed(),pitchSpread:Object.freeze({minScale:.86,maxScale:1.14}),timingSource:'DSKY_RELAY_AUDIO set/reset travel profiles'});
})();
