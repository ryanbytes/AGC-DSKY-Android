'use strict';

// Synthetic PHONE CLOCK relay/display authority. Historical mutable names are
// accessor-backed implementation/state slots at this service boundary; late
// hardware layers install overrides through AGCDSKY_CLOCK rather than touching
// the generic compatibility registry directly.
(() => {
  const clockState=window.AGCDSKY_APP_STATE;
  const clockShell=window.AGCDSKY_SHELL;
  const clockRenderer=window.AGCDSKY_RENDERER;
  const clockAudio=window.AGCDSKY_AUDIO;
  const compat=window.AGCDSKY_COMPAT;
  if(!clockState)throw new Error('Shared application state unavailable');
  if(!clockShell)throw new Error('Application shell service unavailable');
  if(!clockRenderer)throw new Error('DSKY renderer service unavailable');
  if(!clockAudio)throw new Error('Relay audio service unavailable');
  if(!compat)throw new Error('Runtime compatibility bridge unavailable');

  const CLOCK_RELAY_MS=120,CLOCK_SETTLE_MS=20,V35_ROW_MS=40,V35_TEST_MS=5000;
  let clockDigitsValue={r1:['0','0','0','0','0'],r2:['0','0','0','0','0'],r3:['0','0','0','0','0']};
  let clockRelayWordsValue={},relayQueueValue=[],relayBusyValue=false;
  let lampTestActiveValue=false,lampTestTimerValue=0,lampTestSoundTimers=[];
  const DIGIT_RELAY_VALUE={' ':0,'0':21,'1':3,'2':25,'3':27,'4':15,'5':30,'6':28,'7':19,'8':29,'9':31};
  const CLOCK_GROUPS_VALUE=[
    {relay:8,cells:[['r1',0]],singleRight:true},
    {relay:7,cells:[['r1',1],['r1',2]],b:1},{relay:6,cells:[['r1',3],['r1',4]],b:0},
    {relay:5,cells:[['r2',0],['r2',1]],b:1},{relay:4,cells:[['r2',2],['r2',3]],b:0},
    {relay:3,cells:[['r2',4],['r3',0]],b:0},
    {relay:2,cells:[['r3',1],['r3',2]],b:1},{relay:1,cells:[['r3',3],['r3',4]],b:0}
  ];
  let syncSlot,renderRegSlot,stopSlot,runQueueSlot,tickSlot,cancelSlot,lampTestSlot;

  function pad(n,len){return String(n).padStart(len,'0').slice(-len)}
  function desiredClockDigitsImpl(){const d=clockShell.accurateDate();return {r1:pad(d.getHours(),5).split(''),r2:pad(d.getMinutes(),5).split(''),r3:pad(d.getSeconds(),5).split('')}}
  function baseRenderClockReg(name){clockRenderer.setReg(name,'+',clockDigitsValue[name].join(''))}
  function clockWordImpl(group,want){
    let c=0,d=0;
    if(group.singleRight)d=DIGIT_RELAY_VALUE[want[group.cells[0][0]][group.cells[0][1]]]||0;
    else{c=DIGIT_RELAY_VALUE[want[group.cells[0][0]][group.cells[0][1]]]||0;d=DIGIT_RELAY_VALUE[want[group.cells[1][0]][group.cells[1][1]]]||0}
    return ((group.b||0)<<10)|(c<<5)|d;
  }
  function popcount11Impl(v){v&=0x7ff;let n=0;while(v){v&=v-1;n++}return n}
  function baseSyncClockFace(){
    const want=desiredClockDigitsImpl();
    for(const name of ['r1','r2','r3'])clockDigitsValue[name]=want[name].slice();
    for(const group of CLOCK_GROUPS_VALUE)clockRelayWordsValue[group.relay]=clockWordImpl(group,want);
    ['r1','r2','r3'].forEach(name=>renderRegSlot.get()(name));
  }
  function baseStopClockQueue(){relayQueueValue=[];relayBusyValue=false}
  function baseRunRelayQueue(){
    const job=relayQueueValue.shift();
    if(!job){relayBusyValue=false;return}
    if(clockState.mode!=='clock'){relayBusyValue=false;relayQueueValue=[];return}
    const old=clockRelayWordsValue[job.group.relay]??job.newWord,diff=popcount11Impl(old^job.newWord);
    clockRelayWordsValue[job.group.relay]=job.newWord;
    if(clockState.tickSound&&diff)clockAudio.playBurst(diff);
    setTimeout(()=>{
      if(clockState.mode!=='clock')return;
      const touched=new Set();
      for(const [name,i] of job.group.cells){clockDigitsValue[name][i]=job.want[name][i];touched.add(name)}
      touched.forEach(name=>renderRegSlot.get()(name));
    },CLOCK_SETTLE_MS);
    setTimeout(()=>runQueueSlot.get()(),CLOCK_RELAY_MS);
  }
  function baseTick(){
    if(clockState.mode!=='clock'||lampTestActiveValue||relayBusyValue)return;
    const want=desiredClockDigitsImpl(),jobs=[];
    for(const group of CLOCK_GROUPS_VALUE){const w=clockWordImpl(group,want);if(clockRelayWordsValue[group.relay]!==w)jobs.push({group,want,newWord:w})}
    if(!jobs.length)return;
    relayQueueValue=jobs;relayBusyValue=true;runQueueSlot.get()();
  }
  function clearLampTestSoundTimers(){for(const id of lampTestSoundTimers)clearTimeout(id);lampTestSoundTimers=[]}
  function baseCancelLampTest(){
    if(lampTestTimerValue){clearTimeout(lampTestTimerValue);lampTestTimerValue=0}
    clearLampTestSoundTimers();lampTestActiveValue=false;
  }
  function pairLow11(text){
    const value=String(text||'').padEnd(2,' ').slice(0,2);
    return ((DIGIT_RELAY_VALUE[value[0]]||0)<<5)|(DIGIT_RELAY_VALUE[value[1]]||0);
  }
  function v35Low11(relay){
    const eight=DIGIT_RELAY_VALUE['8'],plus=(relay===7||relay===5||relay===2)?1:0;
    return (plus<<10)|(eight<<5)|eight;
  }
  function captureClockRelayState(commandVerb=clockState.verb,commandNoun=clockState.noun){
    const out={11:pairLow11('00'),10:pairLow11(commandVerb),9:pairLow11(commandNoun),12:0};
    for(const group of CLOCK_GROUPS_VALUE)out[group.relay]=(clockRelayWordsValue[group.relay]??0)&0x7ff;
    return out;
  }
  function v35RelayState(){
    const out={};for(const relay of [11,10,9,8,7,6,5,4,3,2,1])out[relay]=v35Low11(relay);
    out[12]=clockState.selectedMission==='comanche055'?0o650:0o674;return out;
  }
  function scheduleV35RelaySounds(from,to){
    clearLampTestSoundTimers();
    if(!clockState.tickSound)return;
    clockAudio.ensure();
    [11,10,9,8,7,6,5,4,3,2,1,12].forEach((relay,index)=>{
      const changed=popcount11Impl((from[relay]||0)^(to[relay]||0));
      if(!changed)return;
      const id=setTimeout(()=>{lampTestSoundTimers=lampTestSoundTimers.filter(x=>x!==id);clockAudio.playBurst(changed)},index*V35_ROW_MS);
      lampTestSoundTimers.push(id);
    });
  }
  function baseLampTest(){
    cancelSlot.get()();stopSlot.get();
    const prior=captureClockRelayState(),active=v35RelayState();
    lampTestActiveValue=true;scheduleV35RelaySounds(prior,active);
    document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'));
    clockRenderer.set2('prog','88');clockRenderer.set2('verb','88');clockRenderer.set2('noun','88');['r1','r2','r3'].forEach(x=>clockRenderer.setReg(x,'+','88888'));
    lampTestTimerValue=setTimeout(()=>{
      lampTestTimerValue=0;if(clockState.mode!=='clock'){cancelSlot.get()();return}
      const want=desiredClockDigitsImpl();for(const group of CLOCK_GROUPS_VALUE)clockRelayWordsValue[group.relay]=clockWordImpl(group,want);
      const restore=captureClockRelayState('16','65');scheduleV35RelaySounds(active,restore);
      lampTestActiveValue=false;clockRenderer.clearLamps();clockRenderer.set2('prog','00');clockState.verb='16';clockState.noun='65';clockShell.show(clockState.verb,clockState.noun);stopSlot.get()();syncSlot.get();
    },V35_TEST_MS);
  }

  function cloneClockDigits(value=clockDigitsValue){
    const source=value&&typeof value==='object'?value:{};
    return{r1:Array.isArray(source.r1)?source.r1.slice():[],r2:Array.isArray(source.r2)?source.r2.slice():[],r3:Array.isArray(source.r3)?source.r3.slice():[]};
  }
  function digitRelayCode(value){return DIGIT_RELAY_VALUE[String(value)]??0}
  function snapshotBackingState(){return{digits:cloneClockDigits(),relayWords:{...clockRelayWordsValue}}}
  function restoreBackingState(next){
    if(!next||typeof next!=='object')throw new TypeError('Clock backing state must be an object');
    clockDigitsValue=cloneClockDigits(next.digits);
    clockRelayWordsValue=next.relayWords&&typeof next.relayWords==='object'?{...next.relayWords}:{};
    return snapshotBackingState();
  }
  function setQueueBusy(value){relayBusyValue=!!value;return relayBusyValue}
  function setLampTestActive(value){lampTestActiveValue=!!value;return lampTestActiveValue}
  function setLampTestTimer(value){lampTestTimerValue=Number(value)||0;return lampTestTimerValue}

  const isFn=value=>typeof value==='function';
  compat.readonly('DIGIT_RELAY',()=>DIGIT_RELAY_VALUE);
  compat.readonly('CLOCK_GROUPS',()=>CLOCK_GROUPS_VALUE);
  compat.readonly('CLOCK_RELAY_MS',()=>CLOCK_RELAY_MS);
  compat.readonly('CLOCK_SETTLE_MS',()=>CLOCK_SETTLE_MS);
  compat.readonly('V35_ROW_MS',()=>V35_ROW_MS);
  compat.readonly('V35_TEST_MS',()=>V35_TEST_MS);
  compat.readonly('desiredClockDigits',()=>desiredClockDigitsImpl);
  compat.readonly('clockWord',()=>clockWordImpl);
  compat.readonly('popcount11',()=>popcount11Impl);
  compat.accessor('clockDigits',()=>clockDigitsValue,next=>{clockDigitsValue=next});
  compat.accessor('clockRelayWords',()=>clockRelayWordsValue,next=>{clockRelayWordsValue=next||{}});
  compat.accessor('relayQueue',()=>relayQueueValue,next=>{relayQueueValue=Array.isArray(next)?next:[]});
  compat.accessor('relayBusy',()=>relayBusyValue,next=>{relayBusyValue=!!next});
  compat.accessor('lampTestActive',()=>lampTestActiveValue,next=>{lampTestActiveValue=!!next});
  compat.accessor('lampTestTimer',()=>lampTestTimerValue,next=>{lampTestTimerValue=Number(next)||0});
  renderRegSlot=compat.mutable('renderClockReg',baseRenderClockReg,isFn);
  syncSlot=compat.mutable('syncClockFace',baseSyncClockFace,isFn);
  stopSlot=compat.mutable('stopClockQueue',baseStopClockQueue,isFn);
  runQueueSlot=compat.mutable('runRelayQueue',baseRunRelayQueue,isFn);
  tickSlot=compat.mutable('tick',baseTick,isFn);
  cancelSlot=compat.mutable('cancelLampTest',baseCancelLampTest,isFn);
  lampTestSlot=compat.mutable('lampTest',baseLampTest,isFn);

  const implementationSlots=Object.freeze({
    renderReg:renderRegSlot,
    syncFace:syncSlot,
    stopQueue:stopSlot,
    runQueue:runQueueSlot,
    tick:tickSlot,
    cancelLampTest:cancelSlot,
    lampTest:lampTestSlot
  });
  function implementation(name){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown clock implementation: ${String(name)}`);
    return slot.get();
  }
  function installImplementation(name,next,reason='explicit clock implementation'){
    const slot=implementationSlots[name];
    if(!slot)throw new Error(`Unknown clock implementation: ${String(name)}`);
    if(typeof next!=='function')throw new TypeError(`Clock implementation must be a function: ${String(name)}`);
    return slot.set(next,reason);
  }

  window.AGCDSKY_CLOCK=Object.freeze({
    tick:(...args)=>tickSlot.get()(...args),
    syncFace:(...args)=>syncSlot.get()(...args),
    stopQueue:(...args)=>stopSlot.get()(...args),
    runQueue:(...args)=>runQueueSlot.get()(...args),
    cancelLampTest:(...args)=>cancelSlot.get()(...args),
    lampTest:(...args)=>lampTestSlot.get()(...args),
    renderReg:(...args)=>renderRegSlot.get()(...args),
    captureRelayState:(...args)=>captureClockRelayState(...args),
    v35RelayState:(...args)=>v35RelayState(...args),
    popcount11:(...args)=>popcount11Impl(...args),
    digitRelayCode,
    relayGroups:()=>CLOCK_GROUPS_VALUE,
    desiredDigits:(...args)=>desiredClockDigitsImpl(...args),
    relayWord:(...args)=>clockWordImpl(...args),
    digits:()=>clockDigitsValue,
    relayWords:()=>clockRelayWordsValue,
    queue:()=>relayQueueValue,
    queueBusy:()=>relayBusyValue,
    setQueueBusy,
    snapshotBackingState,
    restoreBackingState,
    lampTestActive:()=>lampTestActiveValue,
    setLampTestActive,
    lampTestTimer:()=>lampTestTimerValue,
    setLampTestTimer,
    implementation,
    installImplementation,
    compatibilityVersions:()=>({renderReg:renderRegSlot.version(),syncFace:syncSlot.version(),stopQueue:stopSlot.version(),runQueue:runQueueSlot.version(),tick:tickSlot.version(),cancelLampTest:cancelSlot.version(),lampTest:lampTestSlot.version()})
  });
})();
