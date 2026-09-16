'use strict';

// Shared relay-contact audio authority. Legacy global names remain forwarded
// compatibility aliases at this boundary; live context and implementation
// authority stays local to AGCDSKY_AUDIO.
(() => {
  const audioState=window.AGCDSKY_APP_STATE;
  const audioShell=window.AGCDSKY_SHELL;
  const audioEnvironment=window.AGCDSKY_ENVIRONMENT;
  const compat=window.AGCDSKY_COMPAT;
  if(!audioState)throw new Error('Shared application state unavailable');
  if(!audioShell)throw new Error('Application shell service unavailable');
  if(!audioEnvironment)throw new Error('Display environment service unavailable');
  if(!compat)throw new Error('Runtime compatibility bridge unavailable');

  const RELAY_CLICK_SPREAD_MS_VALUE=2.5;
  let audioCtxValue=null;
  let contextSlot,ensureSlot,emitSlot,burstSlot,applySlot;

  function createOwnedSlot(name,initial,validate=null){
    let value=initial,version=0;
    if(validate&&!validate(value))throw new TypeError(`Invalid initial audio slot value: ${name}`);
    const history=[];
    return Object.freeze({
      get:()=>value,
      set(next,reason='explicit audio slot replacement'){
        if(validate&&!validate(next))throw new TypeError(`Invalid audio slot value: ${name}`);
        const prior=value;value=next;version++;history.push(Object.freeze({version,reason:String(reason)}));return prior;
      },
      version:()=>version,
      history:()=>history.map(item=>({...item}))
    });
  }
  function createContextSlot(){
    let version=0;
    const history=[];
    return Object.freeze({
      get:()=>audioCtxValue,
      set(next,reason='explicit audio context'){
        const prior=audioCtxValue;audioCtxValue=next||null;version++;history.push(Object.freeze({version,reason:String(reason)}));return prior;
      },
      version:()=>version,
      history:()=>history.map(item=>({...item}))
    });
  }

  function baseEnsureAudio(){
    if(!audioCtxValue){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioCtxValue=new AC()}
    if(audioCtxValue.state==='suspended')audioCtxValue.resume().catch(()=>{});
    return audioCtxValue;
  }
  function baseEmitTick(ctx,when=ctx.currentTime){
    const sr=ctx.sampleRate,n=Math.max(1,Math.floor(sr*.0065)),buf=ctx.createBuffer(1,n,sr),data=buf.getChannelData(0);
    for(let i=0;i<n;i++){
      const tm=i/sr;
      let env=Math.exp(-tm/.00075);
      if(tm>=.00155)env+=.30*Math.exp(-(tm-.00155)/.00048);
      if(tm>=.00305)env+=.13*Math.exp(-(tm-.00305)/.00038);
      data[i]=(Math.random()*2-1)*env;
    }
    const level=audioEnvironment.tickLevel();
    const src=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),snap=ctx.createGain();src.buffer=buf;
    high.type='highpass';high.frequency.setValueAtTime(760,when);high.Q.setValueAtTime(.65,when);
    low.type='lowpass';low.frequency.setValueAtTime(5600,when);low.Q.setValueAtTime(.55,when);
    snap.gain.setValueAtTime(.52*level,when);snap.gain.exponentialRampToValueAtTime(.0001,when+.0075);
    src.connect(high);high.connect(low);low.connect(snap);snap.connect(ctx.destination);src.start(when);
    const osc=ctx.createOscillator(),body=ctx.createGain();osc.type='triangle';osc.frequency.setValueAtTime(610,when);osc.frequency.exponentialRampToValueAtTime(270,when+.007);body.gain.setValueAtTime(.045*level,when);body.gain.exponentialRampToValueAtTime(.0001,when+.010);osc.connect(body);body.connect(ctx.destination);osc.start(when);osc.stop(when+.011);
  }
  function basePlayRelayBurst(count){
    const ctx=ensureSlot.get()();if(!ctx||count<1)return;
    const go=()=>{const base=ctx.currentTime+.002;for(let i=0;i<count;i++)emitSlot.get()(ctx,base+i*1.7/1000)};
    if(ctx.state==='running')go();else ctx.resume().then(go).catch(()=>{});
  }
  function baseApplyTickSound(){audioShell.store.set('audioTickV4',audioState.tickSound?'1':'0');const b=audioShell.element('sound');if(b)b.textContent=audioState.tickSound?'RELAY CLICKS ON':'RELAY CLICKS OFF'}

  const isFn=value=>typeof value==='function';
  contextSlot=createContextSlot();
  ensureSlot=createOwnedSlot('ensureAudio',baseEnsureAudio,isFn);
  emitSlot=createOwnedSlot('emitTick',baseEmitTick,isFn);
  burstSlot=createOwnedSlot('playRelayBurst',basePlayRelayBurst,isFn);
  applySlot=createOwnedSlot('applyTickSound',baseApplyTickSound,isFn);

  compat.readonly('RELAY_CLICK_SPREAD_MS',()=>RELAY_CLICK_SPREAD_MS_VALUE);
  compat.alias('audioCtx',contextSlot.get,(next,reason)=>contextSlot.set(next,reason),contextSlot.version,contextSlot.history);
  for(const [name,slot] of Object.entries({ensureAudio:ensureSlot,emitTick:emitSlot,playRelayBurst:burstSlot,applyTickSound:applySlot})){
    compat.alias(name,slot.get,(next,reason)=>slot.set(next,reason),slot.version,slot.history);
  }

  const implementationSlots=Object.freeze({
    ensure:ensureSlot,
    emitTick:emitSlot,
    playBurst:burstSlot,
    applySetting:applySlot
  });
  function implementation(name){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown audio implementation: ${String(name)}`);
    return slot.get();
  }
  function installImplementation(name,next,reason='explicit audio implementation'){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown audio implementation: ${String(name)}`);
    if(typeof next!=='function')throw new TypeError(`Audio implementation must be a function: ${String(name)}`);
    return slot.set(next,reason);
  }
  function setContext(next,reason='explicit audio context'){
    contextSlot.set(next,reason);
    return audioCtxValue;
  }

  window.AGCDSKY_AUDIO=Object.freeze({
    ensure:(...args)=>ensureSlot.get()(...args),
    emitTick:(...args)=>emitSlot.get()(...args),
    playBurst:(...args)=>burstSlot.get()(...args),
    applySetting:(...args)=>applySlot.get()(...args),
    context:()=>audioCtxValue,
    setContext,
    implementation,
    installImplementation,
    relayClickSpreadMs:()=>RELAY_CLICK_SPREAD_MS_VALUE,
    compatibilityVersions:()=>({ensure:ensureSlot.version(),emitTick:emitSlot.version(),playBurst:burstSlot.version(),applySetting:applySlot.version()})
  });
})();