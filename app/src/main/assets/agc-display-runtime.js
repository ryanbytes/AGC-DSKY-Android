'use strict';

// Authoritative real-AGC DSKY output/display state. Core and late fidelity
// layers consume the frozen service; compatibility names remain versioned slots
// only at this boundary for external/parser-legacy interoperability.
(() => {
  const displayState=window.AGCDSKY_APP_STATE;
  const displayRenderer=window.AGCDSKY_RENDERER;
  const displayAudio=window.AGCDSKY_AUDIO;
  const compat=window.AGCDSKY_COMPAT;
  if(!displayState)throw new Error('Shared application state unavailable');
  if(!displayRenderer)throw new Error('DSKY renderer service unavailable');
  if(!displayAudio)throw new Error('Relay audio service unavailable');
  if(!compat)throw new Error('Runtime compatibility bridge unavailable');

  const agcRelayWordsValue={};
  let agcCh11Value=0,agcCh13Value=0,agcCh163Value=0;
  const RELAY_DIGIT={0:' ',21:'0',3:'1',25:'2',27:'3',15:'4',30:'5',28:'6',19:'7',29:'8',31:'9'};
  const agcDisplayValue={prog:[' ',' '],verb:[' ',' '],noun:[' ',' '],r1:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},r2:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},r3:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false}};
  let relayDigitSlot,renderRegSlot,resetSlot,decode10Slot,decode11Slot,decode13Slot,decode163Slot,applySnapshotSlot;

  function relayDigitImpl(code){return RELAY_DIGIT[code]??' '}
  function displayPopcount11(v){v&=0x7ff;let n=0;while(v){v&=v-1;n++}return n}
  function regSign(reg){return reg.plus?'+':reg.minus?'-':' '}
  function baseRenderAgcReg(name){const r=agcDisplayValue[name];displayRenderer.setReg(name,regSign(r),r.digits.join(''))}
  function clearDisplayProjection(){agcDisplayValue.prog.fill(' ');agcDisplayValue.verb.fill(' ');agcDisplayValue.noun.fill(' ');for(const name of ['r1','r2','r3']){agcDisplayValue[name].digits.fill(' ');agcDisplayValue[name].plus=false;agcDisplayValue[name].minus=false}}
  function baseResetAgcFace(){clearDisplayProjection();Object.keys(agcRelayWordsValue).forEach(key=>delete agcRelayWordsValue[key]);agcCh11Value=0;agcCh13Value=0;agcCh163Value=0;displayRenderer.set2('prog','  ');displayRenderer.set2('verb','  ');displayRenderer.set2('noun','  ');['r1','r2','r3'].forEach(name=>renderRegSlot.get()(name));displayRenderer.clearLamps()}
  function projectRelayWord(relay,low11,render=true){
    low11=Number(low11)&0o3777;const b=(low11>>10)&1,c=(low11>>5)&0o37,d=low11&0o37,digit=code=>relayDigitSlot.get()(code);
    switch(Number(relay)){
      case 12:if(render){displayRenderer.setLamp('vel',low11&0o00004);displayRenderer.setLamp('noatt',low11&0o00010);displayRenderer.setLamp('alt',low11&0o00020);displayRenderer.setLamp('gimbal',low11&0o00040);displayRenderer.setLamp('tracker',low11&0o00200);displayRenderer.setLamp('prog',low11&0o00400)}break;
      case 11:agcDisplayValue.prog[0]=digit(c);agcDisplayValue.prog[1]=digit(d);if(render)displayRenderer.set2('prog',agcDisplayValue.prog.join(''));break;
      case 10:agcDisplayValue.verb[0]=digit(c);agcDisplayValue.verb[1]=digit(d);if(render)displayRenderer.set2('verb',agcDisplayValue.verb.join(''));break;
      case 9:agcDisplayValue.noun[0]=digit(c);agcDisplayValue.noun[1]=digit(d);if(render)displayRenderer.set2('noun',agcDisplayValue.noun.join(''));break;
      case 8:agcDisplayValue.r1.digits[0]=digit(d);if(render)renderRegSlot.get()('r1');break;
      case 7:agcDisplayValue.r1.plus=!!b;agcDisplayValue.r1.digits[1]=digit(c);agcDisplayValue.r1.digits[2]=digit(d);if(render)renderRegSlot.get()('r1');break;
      case 6:agcDisplayValue.r1.minus=!!b;agcDisplayValue.r1.digits[3]=digit(c);agcDisplayValue.r1.digits[4]=digit(d);if(render)renderRegSlot.get()('r1');break;
      case 5:agcDisplayValue.r2.plus=!!b;agcDisplayValue.r2.digits[0]=digit(c);agcDisplayValue.r2.digits[1]=digit(d);if(render)renderRegSlot.get()('r2');break;
      case 4:agcDisplayValue.r2.minus=!!b;agcDisplayValue.r2.digits[2]=digit(c);agcDisplayValue.r2.digits[3]=digit(d);if(render)renderRegSlot.get()('r2');break;
      case 3:agcDisplayValue.r2.digits[4]=digit(c);agcDisplayValue.r3.digits[0]=digit(d);if(render){renderRegSlot.get()('r2');renderRegSlot.get()('r3')}break;
      case 2:agcDisplayValue.r3.plus=!!b;agcDisplayValue.r3.digits[1]=digit(c);agcDisplayValue.r3.digits[2]=digit(d);if(render)renderRegSlot.get()('r3');break;
      case 1:agcDisplayValue.r3.minus=!!b;agcDisplayValue.r3.digits[3]=digit(c);agcDisplayValue.r3.digits[4]=digit(d);if(render)renderRegSlot.get()('r3');break;
    }
  }
  function commitRelayWord(relay,low11,{render=true}={}){relay=Number(relay);if(relay<1||relay>12)return false;const word=Number(low11)&0o3777;agcRelayWordsValue[relay]=word;projectRelayWord(relay,word,!!render);return true}
  function baseDecodeChannel10(value){const relay=(value>>11)&0o17,low11=value&0o3777;if(relay<1||relay>12)return;const prior=agcRelayWordsValue[relay];if(prior!==undefined&&displayState.tickSound){const n=displayPopcount11(prior^low11);if(n)displayAudio.playBurst(n)}commitRelayWord(relay,low11,{render:true})}
  function updateAgcCompActy(){displayRenderer.setLamp('comp',!!(agcCh11Value&0o00002))}
  function baseDecodeChannel11(value){agcCh11Value=Number(value)&0o77777;updateAgcCompActy();displayRenderer.setLamp('uplink',agcCh11Value&0o00004)}
  function baseDecodeChannel13(value){agcCh13Value=Number(value)&0o77777}
  function baseDecodeChannel163(value){agcCh163Value=Number(value)&0o77777;displayRenderer.setLamp('temp',agcCh163Value&0o00010);displayRenderer.setLamp('keyrel',agcCh163Value&0o00020);document.body.classList.toggle('vn-flash-off',!!(agcCh163Value&0o00040));displayRenderer.setLamp('oprerr',agcCh163Value&0o00100);displayRenderer.setLamp('restart',agcCh163Value&0o00200);displayRenderer.setLamp('stby',agcCh163Value&0o00400);document.body.classList.toggle('el-off',!!(agcCh163Value&0o01000))}
  function setChannelState(channel,value,{render=false}={}){value=Number(value)&0o77777;if(channel===0o11){if(render)return decode11Slot.get()(value);agcCh11Value=value;return true}if(channel===0o13){agcCh13Value=value;return true}if(channel===0o163){if(render)return decode163Slot.get()(value);agcCh163Value=value;return true}return false}
  function onAgcChannelImpl(channel,value){if(displayState.mode!=='agc'&&displayState.mode!=='agc-loading')return;if(channel===0o10)decode10Slot.get()(value);else if(channel===0o11)decode11Slot.get()(value);else if(channel===0o13)decode13Slot.get()(value);else if(channel===0o163)decode163Slot.get()(value)}
  function renderAgcSnapshotImpl(){displayRenderer.clearLamps();displayRenderer.set2('prog',agcDisplayValue.prog.join(''));displayRenderer.set2('verb',agcDisplayValue.verb.join(''));displayRenderer.set2('noun',agcDisplayValue.noun.join(''));['r1','r2','r3'].forEach(name=>renderRegSlot.get()(name));projectRelayWord(12,agcRelayWordsValue[12]||0,true);updateAgcCompActy();displayRenderer.setLamp('uplink',agcCh11Value&0o00004);decode163Slot.get()(agcCh163Value)}
  function snapshotUiStateImpl(){return{display:JSON.parse(JSON.stringify(agcDisplayValue)),relayWords:{...agcRelayWordsValue},ch11:agcCh11Value,ch13:agcCh13Value,ch163:agcCh163Value}}
  function snapshotWord(words,row){if(!words||typeof words!=='object')throw new Error('snapshot UI is missing authoritative relay words');const has=Object.prototype.hasOwnProperty.call(words,row)||Object.prototype.hasOwnProperty.call(words,String(row));if(!has)return 0;const value=Number(Object.prototype.hasOwnProperty.call(words,row)?words[row]:words[String(row)]);if(!Number.isFinite(value))throw new Error(`snapshot relay row ${row} is invalid`);return value&0o3777}
  function baseApplySnapshotUi(ui){if(!ui||typeof ui!=='object'||!ui.relayWords||typeof ui.relayWords!=='object')throw new Error('snapshot UI is missing authoritative relay words');clearDisplayProjection();Object.keys(agcRelayWordsValue).forEach(k=>delete agcRelayWordsValue[k]);for(let row=1;row<=12;row++){if(Object.prototype.hasOwnProperty.call(ui.relayWords,row)||Object.prototype.hasOwnProperty.call(ui.relayWords,String(row))){const word=snapshotWord(ui.relayWords,row);agcRelayWordsValue[row]=word;projectRelayWord(row,word,false)}}agcCh11Value=Number(ui.ch11)&0o77777;agcCh13Value=Number(ui.ch13)&0o77777;agcCh163Value=Number(ui.ch163)&0o77777;return true}
  function agcDisplayStatus(){return{channels:{ch011:agcCh11Value,ch013:agcCh13Value,ch0163:agcCh163Value},display:JSON.parse(JSON.stringify(agcDisplayValue)),relayWords:{...agcRelayWordsValue}}}

  const isFn=value=>typeof value==='function';
  compat.readonly('agcDisplay',()=>agcDisplayValue);compat.readonly('agcRelayWords',()=>agcRelayWordsValue);compat.readonly('RELAY_DIGIT',()=>RELAY_DIGIT);relayDigitSlot=compat.mutable('relayDigit',relayDigitImpl,isFn);compat.accessor('agcCh11',()=>agcCh11Value,next=>{agcCh11Value=Number(next)||0});compat.accessor('agcCh13',()=>agcCh13Value,next=>{agcCh13Value=Number(next)||0});compat.accessor('agcCh163',()=>agcCh163Value,next=>{agcCh163Value=Number(next)||0});renderRegSlot=compat.mutable('renderAgcReg',baseRenderAgcReg,isFn);resetSlot=compat.mutable('resetAgcFace',baseResetAgcFace,isFn);decode10Slot=compat.mutable('decodeChannel10',baseDecodeChannel10,isFn);decode11Slot=compat.mutable('decodeChannel11',baseDecodeChannel11,isFn);decode13Slot=compat.mutable('decodeChannel13',baseDecodeChannel13,isFn);decode163Slot=compat.mutable('decodeChannel163',baseDecodeChannel163,isFn);applySnapshotSlot=compat.mutable('applySnapshotUi',baseApplySnapshotUi,isFn);compat.readonly('onAgcChannel',()=>onAgcChannelImpl);compat.readonly('renderAgcSnapshot',()=>renderAgcSnapshotImpl);compat.readonly('snapshotUiState',()=>snapshotUiStateImpl);

  const implementationSlots=Object.freeze({
    relayDigit:relayDigitSlot,
    renderReg:renderRegSlot,
    resetFace:resetSlot,
    decodeChannel10:decode10Slot,
    decodeChannel11:decode11Slot,
    decodeChannel13:decode13Slot,
    decodeChannel163:decode163Slot,
    applySnapshotUi:applySnapshotSlot
  });
  function implementation(name){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown display implementation: ${String(name)}`);
    return slot.get();
  }
  function installImplementation(name,next,reason='explicit display implementation'){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown display implementation: ${String(name)}`);
    if(typeof next!=='function')throw new TypeError(`Display implementation must be a function: ${String(name)}`);
    return slot.set(next,reason);
  }

  window.AGCDSKY_DISPLAY=Object.freeze({onChannel:(...args)=>onAgcChannelImpl(...args),resetFace:(...args)=>resetSlot.get()(...args),renderSnapshot:(...args)=>renderAgcSnapshotImpl(...args),snapshotUi:(...args)=>snapshotUiStateImpl(...args),applySnapshotUi:(...args)=>applySnapshotSlot.get()(...args),relayDigit:(...args)=>relayDigitSlot.get()(...args),renderReg:(...args)=>renderRegSlot.get()(...args),renderRelayWord:(relay,low11)=>projectRelayWord(relay,low11,true),commitRelayWord:(relay,low11,options)=>commitRelayWord(relay,low11,options),setChannelState,status:()=>agcDisplayStatus(),implementation,installImplementation,compatibilityVersions:()=>({relayDigit:relayDigitSlot.version(),renderReg:renderRegSlot.version(),reset:resetSlot.version(),ch10:decode10Slot.version(),ch11:decode11Slot.version(),ch13:decode13Slot.version(),ch163:decode163Slot.version(),applySnapshot:applySnapshotSlot.version()})});
})();