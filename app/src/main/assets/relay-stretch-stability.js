'use strict';

/*
 * STRETCHED presentation stability layer.
 *
 * Physical relay/latch state still settles at 20 ms. Hardware suppresses only
 * its crew-facing settled paint while STRETCHED is active; this layer keeps the
 * slowed optical projection monotonic and event-driven without monkey-patching
 * global timers or the public hardware diagnostics function.
 */
(() => {
  const visual=window.DSKY_RELAY_VISUAL;
  const display=window.AGCDSKY_DISPLAY;
  const renderer=window.AGCDSKY_RENDERER;
  const hardware=window.AGCDSKY_HARDWARE;
  const relayMatrix=window.DSKY_RELAY_MATRIX;
  if(!visual||!display||!renderer||!hardware||!relayMatrix)throw new Error('Relay stretch stability dependencies unavailable');
  const baseDecodeChannel10=display.implementation('decodeChannel10');
  if(typeof baseDecodeChannel10!=='function'||typeof visual.withSettledWordOverride!=='function')throw new Error('Relay stretch implementation hooks unavailable');

  const MODE_STRETCHED='stretched',FINAL_SETTLE_MS=Number(visual.finalSettleMs)||20,SEGMENT_ORDER='abcdefg',SEGMENT_FULL_MASK=0x7f;
  let suppressCrewFacingWrite=0,lastObservedStretched=null;
  const codeForChar=new Map(),pseudoCharForMask=new Map(),shownMaskByPosition=new Map(),guardByPosition=new Map(),lastSurfaceSignature=new Map();
  for(let code=0;code<32;code++)codeForChar.set(display.relayDigit(code),code);
  const pairPositions=Object.freeze({prog:['prog0','prog1'],verb:['verb0','verb1'],noun:['noun0','noun1']});
  const regPositions=Object.freeze({r1:['r1d0','r1d1','r1d2','r1d3','r1d4'],r2:['r2d0','r2d1','r2d2','r2d3','r2d4'],r3:['r3d0','r3d1','r3d2','r3d3','r3d4']});

  function isStretched(){const stretched=visual.getTimingMode()===MODE_STRETCHED;if(lastObservedStretched!==stretched){guardByPosition.clear();lastSurfaceSignature.clear();lastObservedStretched=stretched}return stretched}
  function codeOf(ch){return codeForChar.has(ch)?codeForChar.get(ch):0}
  function hardwareLatch(row){const state=hardware.snapshot();if(state&&state.latches&&state.latches[row]!==undefined)return Number(state.latches[row])&0o3777;return Number(display.status().relayWords[row]??0)&0o3777}
  function pairWord(chars){return((codeOf(chars[0])&0o37)<<5)|(codeOf(chars[1])&0o37)}
  function mergeVisible(base,mask,visible){return((base&~mask)|(visible&mask))&0o3777}
  function lampState(name){const el=document&&typeof document.querySelector==='function'?document.querySelector(`[data-lamp="${name}"]`):null;return el&&el.classList&&typeof el.classList.contains==='function'?el.classList.contains('on'):null}

  function capturePresentedWord(row){
    const status=display.status(),agcDisplay=status.display,base=hardwareLatch(row);
    try{
      switch(row){
        case 12:{let mask=0,visible=0;for(const [bit,name] of [[0o00004,'vel'],[0o00010,'noatt'],[0o00020,'alt'],[0o00040,'gimbal'],[0o00200,'tracker'],[0o00400,'prog']]){const on=lampState(name);if(on===null)continue;mask|=bit;if(on)visible|=bit}return mergeVisible(base,mask,visible)}
        case 11:return mergeVisible(base,0o1777,pairWord(agcDisplay.prog));
        case 10:return mergeVisible(base,0o1777,pairWord(agcDisplay.verb));
        case 9:return mergeVisible(base,0o1777,pairWord(agcDisplay.noun));
        case 8:return mergeVisible(base,0o0037,codeOf(agcDisplay.r1.digits[0]));
        case 7:return((agcDisplay.r1.plus?0o2000:0)|((codeOf(agcDisplay.r1.digits[1])&0o37)<<5)|(codeOf(agcDisplay.r1.digits[2])&0o37))&0o3777;
        case 6:return((agcDisplay.r1.minus?0o2000:0)|((codeOf(agcDisplay.r1.digits[3])&0o37)<<5)|(codeOf(agcDisplay.r1.digits[4])&0o37))&0o3777;
        case 5:return((agcDisplay.r2.plus?0o2000:0)|((codeOf(agcDisplay.r2.digits[0])&0o37)<<5)|(codeOf(agcDisplay.r2.digits[1])&0o37))&0o3777;
        case 4:return((agcDisplay.r2.minus?0o2000:0)|((codeOf(agcDisplay.r2.digits[2])&0o37)<<5)|(codeOf(agcDisplay.r2.digits[3])&0o37))&0o3777;
        case 3:return mergeVisible(base,0o1777,((codeOf(agcDisplay.r2.digits[4])&0o37)<<5)|(codeOf(agcDisplay.r3.digits[0])&0o37));
        case 2:return((agcDisplay.r3.plus?0o2000:0)|((codeOf(agcDisplay.r3.digits[1])&0o37)<<5)|(codeOf(agcDisplay.r3.digits[2])&0o37))&0o3777;
        case 1:return((agcDisplay.r3.minus?0o2000:0)|((codeOf(agcDisplay.r3.digits[3])&0o37)<<5)|(codeOf(agcDisplay.r3.digits[4])&0o37))&0o3777;
        default:return base;
      }
    }catch(_){return base}
  }

  function maskForSegments(value){let mask=0,text=String(value||'');for(let i=0;i<SEGMENT_ORDER.length;i++)if(text.includes(SEGMENT_ORDER[i]))mask|=1<<i;return mask&SEGMENT_FULL_MASK}
  function maskForChar(ch){return maskForSegments(renderer.segmentPattern(ch))}
  function maskForRelayCode(code){return maskForSegments(relayMatrix.segmentsForCode(Number(code)&0x1f))}
  function charForMask(mask){
    const normalized=Number(mask)&SEGMENT_FULL_MASK;if(pseudoCharForMask.has(normalized))return pseudoCharForMask.get(normalized);
    const ch=String.fromCharCode(0xe100+normalized);let value='';for(let i=0;i<SEGMENT_ORDER.length;i++)if(normalized&(1<<i))value+=SEGMENT_ORDER[i];renderer.registerSegmentPattern(ch,value);pseudoCharForMask.set(normalized,ch);return ch;
  }
  function rowCharacterPositions(row,low11){const c=(low11>>5)&0o37,d=low11&0o37;switch(row){case 11:return[['prog0',c],['prog1',d]];case 10:return[['verb0',c],['verb1',d]];case 9:return[['noun0',c],['noun1',d]];case 8:return[['r1d0',d]];case 7:return[['r1d1',c],['r1d2',d]];case 6:return[['r1d3',c],['r1d4',d]];case 5:return[['r2d0',c],['r2d1',d]];case 4:return[['r2d2',c],['r2d3',d]];case 3:return[['r2d4',c],['r3d0',d]];case 2:return[['r3d1',c],['r3d2',d]];case 1:return[['r3d3',c],['r3d4',d]];default:return[]}}

  function beginMonotonicTransition(row,priorWord,targetWord){
    if(!isStretched()||row<1||row>11)return;const priorCodes=new Map(rowCharacterPositions(row,priorWord));
    for(const [position,targetCode] of rowCharacterPositions(row,targetWord)){const fallbackPrior=maskForRelayCode(priorCodes.get(position)||0),priorMask=shownMaskByPosition.has(position)?shownMaskByPosition.get(position):fallbackPrior,targetMask=maskForRelayCode(targetCode);shownMaskByPosition.set(position,priorMask);guardByPosition.set(position,{targetCode:Number(targetCode)&0x1f,targetMask,changedMask:(priorMask^targetMask)&SEGMENT_FULL_MASK})}
  }
  function filteredMask(position,requestedMask,requestedCode){
    const requested=Number(requestedMask)&SEGMENT_FULL_MASK;if(!isStretched()){shownMaskByPosition.set(position,requested);return requested}
    const guard=guardByPosition.get(position);if(!guard){shownMaskByPosition.set(position,requested);return requested}
    let shown=shownMaskByPosition.has(position)?shownMaskByPosition.get(position):requested;const pending=guard.changedMask&(shown^guard.targetMask),atTarget=(~(requested^guard.targetMask))&SEGMENT_FULL_MASK,commit=pending&atTarget;shown=((shown&~commit)|(guard.targetMask&commit))&SEGMENT_FULL_MASK;shownMaskByPosition.set(position,shown);if((Number(requestedCode)&0x1f)===guard.targetCode)guardByPosition.delete(position);return shown;
  }
  function stabilizePairText(id,text){const keys=pairPositions[id];if(!keys)return null;const chars=String(text||'').padEnd(2,' ').slice(0,2).split(''),masks=chars.map((ch,i)=>filteredMask(keys[i],maskForChar(ch),codeOf(ch)));return{text:masks.map(charForMask).join(''),signature:`${id}:${masks.join(',')}`}}
  function stabilizeRegisterText(id,sign,digits){const keys=regPositions[id];if(!keys)return null;const chars=String(digits||'').padEnd(5,' ').slice(0,5).split(''),masks=chars.map((ch,i)=>filteredMask(keys[i],maskForChar(ch),codeOf(ch)));return{digits:masks.map(charForMask).join(''),signature:`${id}:${String(sign||' ')}:${masks.join(',')}`}}

  const baseSet2=renderer.implementation('set2');
  function stableStretchedSet2(id,text){if(suppressCrewFacingWrite>0)return;if(!isStretched())return baseSet2(id,text);const stable=stabilizePairText(id,text);if(!stable)return baseSet2(id,text);if(lastSurfaceSignature.get(id)===stable.signature)return;lastSurfaceSignature.set(id,stable.signature);return baseSet2(id,stable.text)}
  renderer.installImplementation('set2',stableStretchedSet2,'stretched EL pair stability');
  const baseSetReg=renderer.implementation('setReg');
  function stableStretchedSetReg(id,sign,digits){if(suppressCrewFacingWrite>0)return;if(!isStretched())return baseSetReg(id,sign,digits);const stable=stabilizeRegisterText(id,sign,digits);if(!stable)return baseSetReg(id,sign,digits);if(lastSurfaceSignature.get(id)===stable.signature)return;lastSurfaceSignature.set(id,stable.signature);return baseSetReg(id,sign,stable.digits)}
  renderer.installImplementation('setReg',stableStretchedSetReg,'stretched EL register stability');

  function stableStretchedRelayDecode(value){
    const word=Number(value)&0o77777,row=(word>>11)&0o17;
    if(row<1||row>12||visual.getTimingMode()!==MODE_STRETCHED)return baseDecodeChannel10(value);
    const presentedWord=capturePresentedWord(row);beginMonotonicTransition(row,presentedWord,word&0o3777);
    const result=visual.withSettledWordOverride(row,presentedWord,()=>baseDecodeChannel10(value));
    visual.renderWord(row,presentedWord);return result;
  }
  display.installImplementation('decodeChannel10',stableStretchedRelayDecode,'stretched relay settle stability');

  window.DSKY_RELAY_STRETCH_STABILITY=Object.freeze({mode:'same-task-settle-shield',settleShieldMs:FINAL_SETTLE_MS,settleRepaintSameTask:true,settleCrewFacingWriteSuppressed:true,eventDrivenDomWrites:true,monotonicSegments:true,capturePresentedWord});
})();