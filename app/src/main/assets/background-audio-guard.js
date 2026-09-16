'use strict';

// Late WebAudio lifecycle/recovery service. Display snapshot authority and
// PHONE CLOCK rendering now live in their owning services, so this layer only
// replaces audio implementations through AGCDSKY_AUDIO and handles background
// queue/lifecycle policy.
(() => {
  const guardState=window.AGCDSKY_APP_STATE;
  const audio=window.AGCDSKY_AUDIO;
  const clock=window.AGCDSKY_CLOCK;
  if(!guardState||!audio||!clock)throw new Error('Audio recovery service dependencies unavailable');
  const audibleNow=()=>!guardState.dream&&!document.hidden&&guardState.appVisible;
  const AUDIO_STABLE_MS=8000,AUDIO_FAILURE_LIMIT=2;
  let audioFailureCount=0,audioCircuitOpen=false,audioFailureReported=false,audioStableTimer=0;
  const observedAudioContexts=new WeakSet(),retiredAudioContexts=new WeakSet();
  const getContext=()=>audio.context();
  const setContext=value=>audio.setContext(value,'audio recovery context');

  function audioErrorText(error){if(!error)return'unknown error';if(typeof error==='string')return error;const name=error.name?String(error.name):'',message=error.message?String(error.message):String(error);return name&&message&&!message.startsWith(name)?`${name}: ${message}`:(message||name||'unknown error')}
  function reportAudioFailure(reason,error){if(audioFailureReported)return;audioFailureReported=true;const detail=`WebAudio recovery failed after ${audioFailureCount} consecutive failures: ${reason}; ${audioErrorText(error)}`;try{if(window.DebugBridge&&typeof window.DebugBridge.report==='function')window.DebugBridge.report(detail)}catch(_){}}
  function updateAudioButtonForFailure(){const button=document.getElementById('sound');if(button)button.textContent='RELAY CLICKS ERROR · OFF/ON TO RETRY'}
  function clearStableTimer(){if(!audioStableTimer)return;clearTimeout(audioStableTimer);audioStableTimer=0}
  function markAudioStable(ctx){if(!ctx||ctx!==getContext()||ctx.state!=='running'||audioFailureCount===0||audioStableTimer)return;audioStableTimer=setTimeout(()=>{audioStableTimer=0;if(ctx===getContext()&&ctx.state==='running'){audioFailureCount=0;audioCircuitOpen=false;audioFailureReported=false}},AUDIO_STABLE_MS)}
  function retireAudioContext(ctx,reason,error,countFailure=true){
    if(!ctx||retiredAudioContexts.has(ctx))return;retiredAudioContexts.add(ctx);if(ctx===getContext())setContext(null);clearStableTimer();
    if(countFailure){audioFailureCount++;if(audioFailureCount>=AUDIO_FAILURE_LIMIT){audioCircuitOpen=true;updateAudioButtonForFailure();reportAudioFailure(reason,error)}}
    try{if(ctx.state!=='closed'&&typeof ctx.close==='function'){const closing=ctx.close();if(closing&&typeof closing.catch==='function')closing.catch(()=>{})}}catch(_){}
  }
  function adoptAudioContext(ctx){
    if(!ctx||observedAudioContexts.has(ctx))return ctx;observedAudioContexts.add(ctx);
    if(typeof ctx.addEventListener==='function'){
      ctx.addEventListener('error',event=>retireAudioContext(ctx,'renderer/device error event',event&&event.error));
      ctx.addEventListener('statechange',()=>{if(ctx===getContext()&&ctx.state==='running')markAudioStable(ctx)});
    }
    if(ctx.state==='running')markAudioStable(ctx);return ctx;
  }
  function resetAudioCircuit(){audioFailureCount=0;audioCircuitOpen=false;audioFailureReported=false;clearStableTimer()}

  try{if(getContext())adoptAudioContext(getContext())}catch(_){}
  function resilientEnsureAudio(){
    if(!audibleNow()||!guardState.tickSound||audioCircuitOpen)return null;
    let ctx=getContext();
    if(ctx&&ctx.state==='closed'){retireAudioContext(ctx,'context already closed',null,false);ctx=null}
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(typeof AC!=='function')return null;
      try{ctx=adoptAudioContext(new AC());setContext(ctx)}catch(error){audioFailureCount++;if(audioFailureCount>=AUDIO_FAILURE_LIMIT){audioCircuitOpen=true;updateAudioButtonForFailure();reportAudioFailure('context construction failed',error)}return null}
    }else adoptAudioContext(ctx);
    if(ctx.state==='running'){markAudioStable(ctx);return ctx}
    if(ctx.state==='closed'){retireAudioContext(ctx,'context closed during acquisition',null,false);return null}
    if(ctx.state==='suspended'&&typeof ctx.resume==='function'){
      try{const resumed=ctx.resume();if(resumed&&typeof resumed.then==='function')resumed.then(()=>markAudioStable(ctx)).catch(error=>{if(error&&error.name==='NotAllowedError')return;retireAudioContext(ctx,'resume rejected',error)})}
      catch(error){if(!error||error.name!=='NotAllowedError'){retireAudioContext(ctx,'resume threw',error);return null}}
    }
    return ctx;
  }
  audio.installImplementation('ensure',resilientEnsureAudio,'WebAudio recovery guard');

  const baseApplyTickSound=audio.implementation('applySetting');
  function resilientApplyTickSound(){if(guardState.tickSound&&audioCircuitOpen)resetAudioCircuit();return baseApplyTickSound()}
  audio.installImplementation('applySetting',resilientApplyTickSound,'WebAudio circuit reset');

  const audibleEmitTick=audio.implementation('emitTick');
  function guardedRelayTick(ctx,when,strength){if(!audibleNow()||!ctx||ctx!==getContext()||ctx.state==='closed')return;return audibleEmitTick(ctx,when,strength)}
  audio.installImplementation('emitTick',guardedRelayTick,'background audio visibility guard');

  const audiblePlayRelayBurst=audio.implementation('playBurst');
  function guardedRelayBurst(count){if(!audibleNow()||audioCircuitOpen)return;return audiblePlayRelayBurst(count)}
  audio.installImplementation('playBurst',guardedRelayBurst,'background relay burst guard');

  function status(){const ctx=getContext();return{state:ctx?ctx.state:'none',failures:audioFailureCount,circuitOpen:audioCircuitOpen}}
  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_AUDIO_RECOVERY',Object.freeze({status,resetCircuit:resetAudioCircuit}),'background-audio-guard publication');

  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!guardState.dream)clock.stopQueue()});
})();