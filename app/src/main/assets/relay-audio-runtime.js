'use strict';

// Shared relay-contact audio primitives. Core runtimes consume AGCDSKY_AUDIO;
// late fidelity/recovery layers may still replace the classic function bindings,
// so the service uses dynamic wrappers rather than stale captured references.
const audioState=window.AGCDSKY_APP_STATE;
const audioShell=window.AGCDSKY_SHELL;
const audioEnvironment=window.AGCDSKY_ENVIRONMENT;
if(!audioState)throw new Error('Shared application state unavailable');
if(!audioShell)throw new Error('Application shell service unavailable');
if(!audioEnvironment)throw new Error('Display environment service unavailable');
const RELAY_CLICK_SPREAD_MS=2.5;
let audioCtx=null;
function ensureAudio(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;audioCtx=new AC()}if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});return audioCtx}
function emitTick(ctx,when=ctx.currentTime){
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
function playRelayBurst(count){const ctx=ensureAudio();if(!ctx||count<1)return;const go=()=>{const base=ctx.currentTime+.002;for(let i=0;i<count;i++)emitTick(ctx,base+i*1.7/1000)};if(ctx.state==='running')go();else ctx.resume().then(go).catch(()=>{})}
function applyTickSound(){audioShell.store.set('audioTickV4',audioState.tickSound?'1':'0');const b=audioShell.element('sound');if(b)b.textContent=audioState.tickSound?'RELAY CLICKS ON':'RELAY CLICKS OFF'}

window.AGCDSKY_AUDIO=Object.freeze({
  ensure:(...args)=>ensureAudio(...args),
  emitTick:(...args)=>emitTick(...args),
  playBurst:(...args)=>playRelayBurst(...args),
  applySetting:(...args)=>applyTickSound(...args),
  context:()=>audioCtx
});
