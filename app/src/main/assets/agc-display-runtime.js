'use strict';

// Authoritative real-AGC DSKY output/display state. Parser-ordered hardware and
// presentation layers still replace historical handlers, but those names are
// accessor-backed slots owned here; AGCDSKY_DISPLAY always dispatches through
// the current slot implementation.
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
  const agcDisplayValue={
    prog:[' ',' '],verb:[' ',' '],noun:[' ',' '],
    r1:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},
    r2:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false},
    r3:{digits:[' ',' ',' ',' ',' '],plus:false,minus:false}
  };
  let relayDigitSlot,renderRegSlot,resetSlot,decode10Slot,decode11Slot,decode13Slot,decode163Slot,applySnapshotSlot;

  function relayDigitImpl(code){return RELAY_DIGIT[code]??' '}
  function displayPopcount11(v){v&=0x7ff;let n=0;while(v){v&=v-1;n++}return n}
  function regSign(reg){return reg.plus?'+':reg.minus?'-':' '}
  function baseRenderAgcReg(name){const r=agcDisplayValue[name];displayRenderer.setReg(name,regSign(r),r.digits.join(''))}
  function baseResetAgcFace(){
    agcDisplayValue.prog.fill(' ');agcDisplayValue.verb.fill(' ');agcDisplayValue.noun.fill(' ');
    ['r1','r2','r3'].forEach(name=>{agcDisplayValue[name].digits.fill(' ');agcDisplayValue[name].plus=false;agcDisplayValue[name].minus=false});
    Object.keys(agcRelayWordsValue).forEach(key=>delete agcRelayWordsValue[key]);
    agcCh11Value=0;agcCh13Value=0;agcCh163Value=0;
    displayRenderer.set2('prog','  ');displayRenderer.set2('verb','  ');displayRenderer.set2('noun','  ');['r1','r2','r3'].forEach(name=>renderRegSlot.get()(name));displayRenderer.clearLamps();
  }
  function baseDecodeChannel10(value){
    const relay=(value>>11)&0o17,b=(value>>10)&1,c=(value>>5)&0o37,d=value&0o37,low11=value&0o3777;
    if(relay>=1&&relay<=12){const prior=agcRelayWordsValue[relay];if(prior!==undefined&&displayState.tickSound){const n=displayPopcount11(prior^low11);if(n)displayAudio.playBurst(n)}agcRelayWordsValue[relay]=low11}
    switch(relay){
      case 12:displayRenderer.setLamp('vel',value&0o00004);displayRenderer.setLamp('noatt',value&0o00010);displayRenderer.setLamp('alt',value&0o00020);displayRenderer.setLamp('gimbal',value&0o00040);displayRenderer.setLamp('tracker',value&0o00200);displayRenderer.setLamp('prog',value&0o00400);break;
      case 11:agcDisplayValue.prog[0]=relayDigitSlot.get()(c);agcDisplayValue.prog[1]=relayDigitSlot.get()(d);displayRenderer.set2('prog',agcDisplayValue.prog.join(''));break;
      case 10:agcDisplayValue.verb[0]=relayDigitSlot.get()(c);agcDisplayValue.verb[1]=relayDigitSlot.get()(d);displayRenderer.set2('verb',agcDisplayValue.verb.join(''));break;
      case 9:agcDisplayValue.noun[0]=relayDigitSlot.get()(c);agcDisplayValue.noun[1]=relayDigitSlot.get()(d);displayRenderer.set2('noun',agcDisplayValue.noun.join(''));break;
      case 8:agcDisplayValue.r1.digits[0]=relayDigitSlot.get()(d);renderRegSlot.get()('r1');break;
      case 7:agcDisplayValue.r1.plus=!!b;agcDisplayValue.r1.digits[1]=relayDigitSlot.get()(c);agcDisplayValue.r1.digits[2]=relayDigitSlot.get()(d);renderRegSlot.get()('r1');break;
      case 6:agcDisplayValue.r1.minus=!!b;agcDisplayValue.r1.digits[3]=relayDigitSlot.get()(c);agcDisplayValue.r1.digits[4]=relayDigitSlot.get()(d);renderRegSlot.get()('r1');break;
      case 5:agcDisplayValue.r2.plus=!!b;agcDisplayValue.r2.digits[0]=relayDigitSlot.get()(c);agcDisplayValue.r2.digits[1]=relayDigitSlot.get()(d);renderRegSlot.get()('r2');break;
      case 4:agcDisplayValue.r2.minus=!!b;agcDisplayValue.r2.digits[2]=relayDigitSlot.get()(c);agcDisplayValue.r2.digits[3]=relayDigitSlot.get()(d);renderRegSlot.get()('r2');break;
      case 3:agcDisplayValue.r2.digits[4]=relayDigitSlot.get()(c);agcDisplayValue.r3.digits[0]=relayDigitSlot.get()(d);renderRegSlot.get()('r2');renderRegSlot.get()('r3');break;
      case 2:agcDisplayValue.r3.plus=!!b;agcDisplayValue.r3.digits[1]=relayDigitSlot.get()(c);agcDisplayValue.r3.digits[2]=relayDigitSlot.get()(d);renderRegSlot.get()('r3');break;
      case 1:agcDisplayValue.r3.minus=!!b;agcDisplayValue.r3.digits[3]=relayDigitSlot.get()(c);agcDisplayValue.r3.digits[4]=relayDigitSlot.get()(d);renderRegSlot.get()('r3');break;
    }
  }
  function updateAgcCompActy(){displayRenderer.setLamp('comp',!!(agcCh11Value&0o00002))}
  function baseDecodeChannel11(value){agcCh11Value=value;updateAgcCompActy();displayRenderer.setLamp('uplink',value&0o00004)}
  function baseDecodeChannel13(value){agcCh13Value=value}
  function baseDecodeChannel163(value){
    agcCh163Value=value;displayRenderer.setLamp('temp',value&0o00010);displayRenderer.setLamp('keyrel',value&0o00020);document.body.classList.toggle('vn-flash-off',!!(value&0o00040));displayRenderer.setLamp('oprerr',value&0o00100);displayRenderer.setLamp('restart',value&0o00200);displayRenderer.setLamp('stby',value&0o00400);document.body.classList.toggle('el-off',!!(value&0o01000));
  }
  function onAgcChannelImpl(channel,value){
    if(displayState.mode!=='agc'&&displayState.mode!=='agc-loading')return;
    if(channel===0o10)decode10Slot.get()(value);else if(channel===0o11)decode11Slot.get()(value);else if(channel===0o13)decode13Slot.get()(value);else if(channel===0o163)decode163Slot.get()(value);
  }
  function renderAgcSnapshotImpl(){
    displayRenderer.clearLamps();
    displayRenderer.set2('prog',agcDisplayValue.prog.join(''));displayRenderer.set2('verb',agcDisplayValue.verb.join(''));displayRenderer.set2('noun',agcDisplayValue.noun.join(''));
    ['r1','r2','r3'].forEach(name=>renderRegSlot.get()(name));
    const l12=agcRelayWordsValue[12]||0;
    displayRenderer.setLamp('vel',l12&0o00004);displayRenderer.setLamp('noatt',l12&0o00010);displayRenderer.setLamp('alt',l12&0o00020);displayRenderer.setLamp('gimbal',l12&0o00040);displayRenderer.setLamp('tracker',l12&0o00200);displayRenderer.setLamp('prog',l12&0o00400);
    updateAgcCompActy();displayRenderer.setLamp('uplink',agcCh11Value&0o00004);decode163Slot.get()(agcCh163Value);
  }
  function snapshotUiStateImpl(){
    return {display:JSON.parse(JSON.stringify(agcDisplayValue)),relayWords:{...agcRelayWordsValue},ch11:agcCh11Value,ch13:agcCh13Value,ch163:agcCh163Value};
  }
  function baseApplySnapshotUi(ui){
    if(!ui||!ui.display)return;
    for(const k of ['prog','verb','noun'])if(Array.isArray(ui.display[k]))agcDisplayValue[k]=ui.display[k].slice(0,2);
    for(const k of ['r1','r2','r3'])if(ui.display[k])agcDisplayValue[k]={digits:(ui.display[k].digits||[]).slice(0,5),plus:!!ui.display[k].plus,minus:!!ui.display[k].minus};
    Object.keys(agcRelayWordsValue).forEach(k=>delete agcRelayWordsValue[k]);Object.assign(agcRelayWordsValue,ui.relayWords||{});
    agcCh11Value=Number(ui.ch11)||0;agcCh13Value=Number(ui.ch13)||0;agcCh163Value=Number(ui.ch163)||0;
  }
  function agcDisplayStatus(){
    return {channels:{ch011:agcCh11Value,ch013:agcCh13Value,ch0163:agcCh163Value},display:JSON.parse(JSON.stringify(agcDisplayValue)),relayWords:{...agcRelayWordsValue}};
  }

  const isFn=value=>typeof value==='function';
  compat.readonly('agcDisplay',()=>agcDisplayValue);
  compat.readonly('agcRelayWords',()=>agcRelayWordsValue);
  compat.readonly('RELAY_DIGIT',()=>RELAY_DIGIT);
  relayDigitSlot=compat.mutable('relayDigit',relayDigitImpl,isFn);
  compat.accessor('agcCh11',()=>agcCh11Value,next=>{agcCh11Value=Number(next)||0});
  compat.accessor('agcCh13',()=>agcCh13Value,next=>{agcCh13Value=Number(next)||0});
  compat.accessor('agcCh163',()=>agcCh163Value,next=>{agcCh163Value=Number(next)||0});
  renderRegSlot=compat.mutable('renderAgcReg',baseRenderAgcReg,isFn);
  resetSlot=compat.mutable('resetAgcFace',baseResetAgcFace,isFn);
  decode10Slot=compat.mutable('decodeChannel10',baseDecodeChannel10,isFn);
  decode11Slot=compat.mutable('decodeChannel11',baseDecodeChannel11,isFn);
  decode13Slot=compat.mutable('decodeChannel13',baseDecodeChannel13,isFn);
  decode163Slot=compat.mutable('decodeChannel163',baseDecodeChannel163,isFn);
  applySnapshotSlot=compat.mutable('applySnapshotUi',baseApplySnapshotUi,isFn);
  compat.readonly('onAgcChannel',()=>onAgcChannelImpl);
  compat.readonly('renderAgcSnapshot',()=>renderAgcSnapshotImpl);
  compat.readonly('snapshotUiState',()=>snapshotUiStateImpl);

  window.AGCDSKY_DISPLAY=Object.freeze({
    onChannel:(...args)=>onAgcChannelImpl(...args),
    resetFace:(...args)=>resetSlot.get()(...args),
    renderSnapshot:(...args)=>renderAgcSnapshotImpl(...args),
    snapshotUi:(...args)=>snapshotUiStateImpl(...args),
    applySnapshotUi:(...args)=>applySnapshotSlot.get()(...args),
    relayDigit:(...args)=>relayDigitSlot.get()(...args),
    status:()=>agcDisplayStatus(),
    compatibilityVersions:()=>({relayDigit:relayDigitSlot.version(),renderReg:renderRegSlot.version(),reset:resetSlot.version(),ch10:decode10Slot.version(),ch11:decode11Slot.version(),ch13:decode13Slot.version(),ch163:decode163Slot.version(),applySnapshot:applySnapshotSlot.version()})
  });
})();
