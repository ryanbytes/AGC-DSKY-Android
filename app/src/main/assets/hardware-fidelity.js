'use strict';

/*
 * Apollo Block II DSKY hardware-fidelity service.
 *
 * Timing model follows the Apollo AGC display timing model:
 *   - normal display service is phase-locked to the 120 ms T4RUPT cadence;
 *   - a selected relay row is driven for 20 ms so its latching relays settle;
 *   - the drive is then removed for 20 ms;
 *   - the next dirty row can therefore begin 40 ms after the previous row.
 *
 * In AGC mode V35 is not synthesized here: the real Comanche 055 program,
 * yaAGC I/O, and yaAGC DSKY hardware-state output are authoritative. The
 * synthetic phone-clock V35 helpers are retained only for clock-mode testing.
 *
 * This module no longer mutates parser-global implementations directly. Display
 * implementation hooks are installed through AGCDSKY_DISPLAY; remaining clock
 * queue/V35 compatibility slots stay behind AGCDSKY_COMPAT until the clock
 * ownership slice. Hardware diagnostics and settled-paint policy live on
 * AGCDSKY_HARDWARE.
 */
(() => {
  const fidelityState=window.AGCDSKY_APP_STATE;
  const compat=window.AGCDSKY_COMPAT;
  const renderer=window.AGCDSKY_RENDERER;
  const audio=window.AGCDSKY_AUDIO;
  const clock=window.AGCDSKY_CLOCK;
  const display=window.AGCDSKY_DISPLAY;
  const shell=window.AGCDSKY_SHELL;
  if(!fidelityState||!compat||!renderer||!audio||!clock||!display||!shell)throw new Error('Hardware fidelity service dependencies unavailable');

  const DIGIT_RELAY=compat.get('DIGIT_RELAY');
  const CLOCK_GROUPS=compat.get('CLOCK_GROUPS');
  const desiredClockDigits=compat.get('desiredClockDigits');
  const clockWord=compat.get('clockWord');
  const T4_MS=120;
  const RELAY_DRIVE_MS=20;
  const DIRTY_ROW_START_MS=40;
  const V35_HOLD_MS=5000;
  const DSKY_FLASH_QUANTUM_MS=320;
  const DSKY_FLASH_PHASES=4;
  const V35_ORDER=Object.freeze([12,11,10,9,8,7,6,5,4,3,2,1]);
  const t4Epoch=performance.now();
  const scalerEpoch=performance.now();
  const CLOCK_ROWS=CLOCK_GROUPS.map(group=>({relay:group.relay,cells:group.cells,native:group}));

  const hw={
    latches:Object.create(null),relayGeneration:Object.create(null),activeDrive:0,
    timers:new Set(),clockToken:0,v35Token:0,v35FlashEnabled:false,
    v35DirectKeyRel:false,v35DirectOperErr:false,v35FlashTimer:0,lastWrite:null,
    auxRelays:Object.assign(Object.create(null),{comp:false,uplink:false,temp:false,keyrel:false,oprerr:false,flash:false,restart:false,stby:false})
  };
  const snapshotExtensions=new Map();
  const settledPaintPolicies=new Map();

  const getClockDigits=()=>compat.get('clockDigits');
  const getClockRelayWords=()=>compat.get('clockRelayWords');
  const getRelayQueue=()=>compat.get('relayQueue');
  const getRelayBusy=()=>!!compat.get('relayBusy');
  const setRelayBusy=value=>compat.replace('relayBusy',!!value,'hardware-fidelity queue state');
  const getLampTestActive=()=>clock.lampTestActive();
  const setLampTestActive=value=>compat.replace('lampTestActive',!!value,'hardware-fidelity V35 state');
  const setLampTestTimer=value=>compat.replace('lampTestTimer',Number(value)||0,'hardware-fidelity V35 timer');

  function later(fn,ms){
    const id=setTimeout(()=>{hw.timers.delete(id);fn()},Math.max(0,ms));hw.timers.add(id);return id;
  }
  function phaseDelay(period,epoch){const elapsed=Math.max(0,performance.now()-epoch),phase=elapsed%period;return phase<0.25?0:period-phase}
  function nextT4Delay(){return phaseDelay(T4_MS,t4Epoch)}

  const ARMATURE_SETTLE_MS=Object.freeze([6.2,11.7,8.4,13.6,7.1,15.0,9.5,12.5,5.6,14.3,10.5]);
  function relayArmatureClack(bit,turningOn,delayMs){
    if(!fidelityState.tickSound)return;
    const ctx=audio.ensure();if(!ctx)return;
    const schedule=()=>audio.emitTick(ctx,ctx.currentTime+Math.max(0.001,delayMs/1000),turningOn?0.66:0.58);
    if(ctx.state==='running')schedule();else ctx.resume().then(schedule).catch(()=>{});
  }
  function changedArmatures(prior,target){
    const out=[],diff=(prior^target)&0o3777;
    for(let bit=0;bit<11;bit++){const mask=1<<bit;if(diff&mask)out.push({bit,mask,on:!!(target&mask),delay:ARMATURE_SETTLE_MS[bit]})}
    out.sort((a,b)=>a.delay-b.delay||a.bit-b.bit);return out;
  }

  function auxRelayClack(engaging,releasing){
    const count=Math.max(0,engaging|0)+Math.max(0,releasing|0);if(!fidelityState.tickSound||count<=0)return;
    const ctx=audio.ensure();if(!ctx)return;
    const play=()=>audio.emitTick(ctx,ctx.currentTime+0.001,Math.min(0.90,0.62+0.08*Math.sqrt(Math.min(6,count))));
    if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});
  }
  const AUX_VISUAL=Object.freeze({comp:'comp',uplink:'uplink',temp:'temp',keyrel:'keyrel',oprerr:'oprerr',restart:'restart',stby:'stby'});
  function setAuxRelays(next,render=true){
    let engaging=0,releasing=0;
    for(const [name,requested] of Object.entries(next||{})){
      if(!Object.prototype.hasOwnProperty.call(hw.auxRelays,name))continue;
      const on=!!requested,before=!!hw.auxRelays[name];
      if(before!==on){if(on)engaging++;else releasing++;hw.auxRelays[name]=on}
      if(render&&AUX_VISUAL[name])renderer.setLamp(AUX_VISUAL[name],on);
    }
    auxRelayClack(engaging,releasing);
  }

  function clockLow11(row,want){return clockWord(row.native,want)&0o3777}
  function relayOfJob(job){return job.group?job.group.relay:job.relay}
  function cellsOfJob(job){return job.group?job.group.cells:[]}
  function low11ForPair(text){const s=String(text||'').padEnd(2,' ').slice(0,2);return((DIGIT_RELAY[s[0]]||0)<<5)|(DIGIT_RELAY[s[1]]||0)}
  function targetClockState(commandVerb=fidelityState.verb,commandNoun=fidelityState.noun){
    const want=desiredClockDigits(),state={11:low11ForPair('00'),10:low11ForPair(commandVerb),9:low11ForPair(commandNoun),12:0};
    for(const row of CLOCK_ROWS)state[row.relay]=clockLow11(row,want);return{state,want};
  }
  function currentClockLatchState(commandVerb=fidelityState.verb,commandNoun=fidelityState.noun){
    const relayWords=getClockRelayWords(),state={11:low11ForPair('00'),10:low11ForPair(commandVerb),9:low11ForPair(commandNoun),12:Object.prototype.hasOwnProperty.call(hw.latches,12)?hw.latches[12]:0};
    for(const row of CLOCK_ROWS)state[row.relay]=(relayWords[row.relay]??0)&0o3777;return state;
  }
  function v35State(){
    const eight=DIGIT_RELAY['8'],state={};
    for(let relay=1;relay<=11;relay++){const plus=relay===2||relay===5||relay===7;state[relay]=(plus?0o2000:0)|(eight<<5)|eight}
    state[12]=0o650;return state;
  }

  function settledPaintAllowed(relay,low11){
    for(const policy of settledPaintPolicies.values()){
      try{if(policy(relay,low11,{mode:fidelityState.mode,lampTestActive:getLampTestActive()})===false)return false}catch(error){console.error('DSKY settled-paint policy',error)}
    }
    return true;
  }
  function beginRelayDrive(relay,low11,render=true){
    low11&=0o3777;
    const prior=Object.prototype.hasOwnProperty.call(hw.latches,relay)?hw.latches[relay]:0;
    const motions=changedArmatures(prior,low11),generation=(hw.relayGeneration[relay]||0)+1;
    hw.relayGeneration[relay]=generation;hw.activeDrive=relay;hw.lastWrite={relay,low11,changed:motions.length,at:performance.now()};
    for(const motion of motions)relayArmatureClack(motion.bit,motion.on,motion.delay);
    later(()=>{
      if(hw.relayGeneration[relay]!==generation)return;
      hw.latches[relay]=low11;
      const paint=!!render&&settledPaintAllowed(relay,low11);
      display.commitRelayWord(relay,low11,{render:paint});
      if(hw.activeDrive===relay)hw.activeDrive=0;
    },RELAY_DRIVE_MS);
  }

  function hardwareDecodeChannel10(value){
    const word=Number(value)&0o77777,relay=(word>>11)&0o17;
    if(relay===0){hw.activeDrive=0;hw.lastWrite={relay:0,low11:0,changed:0,at:performance.now()};return true}
    if(relay<1||relay>12)return false;
    beginRelayDrive(relay,word&0o3777,true);return true;
  }
  display.installImplementation('decodeChannel10',hardwareDecodeChannel10,'hardware relay drive');

  const baseDecodeChannel11=display.implementation('decodeChannel11');
  function hardwareDecodeChannel11(value){
    const word=Number(value)&0o77777;setAuxRelays({comp:!!(word&0o00002),uplink:!!(word&0o00004),flash:!!(word&0o00040)},false);return baseDecodeChannel11.call(this,value);
  }
  display.installImplementation('decodeChannel11',hardwareDecodeChannel11,'hardware auxiliary relays');

  const baseDecodeChannel163=display.implementation('decodeChannel163');
  function hardwareDecodeChannel163(value){
    const word=Number(value)&0o77777;setAuxRelays({temp:!!(word&0o00010),keyrel:!!(word&0o00020),oprerr:!!(word&0o00100),restart:!!(word&0o00200),stby:!!(word&0o00400)},false);return baseDecodeChannel163.call(this,value);
  }
  display.installImplementation('decodeChannel163',hardwareDecodeChannel163,'hardware pulse-modulated auxiliaries');

  const baseResetAgcFace=display.implementation('resetFace');
  function hardwareResetAgcFace(...args){
    for(const key of Object.keys(hw.latches))delete hw.latches[key];for(const key of Object.keys(hw.relayGeneration))delete hw.relayGeneration[key];hw.activeDrive=0;for(const key of Object.keys(hw.auxRelays))hw.auxRelays[key]=false;return baseResetAgcFace.apply(this,args);
  }
  display.installImplementation('resetFace',hardwareResetAgcFace,'hardware reset state');

  const baseStopClockQueue=compat.get('stopClockQueue');
  function hardwareStopClockQueue(...args){hw.clockToken++;return baseStopClockQueue.apply(this,args)}
  compat.replace('stopClockQueue',hardwareStopClockQueue,'hardware clock queue ownership');

  function hardwareRunRelayQueue(){
    const queue=getRelayQueue();queue.sort((a,b)=>relayOfJob(b)-relayOfJob(a));
    const token=++hw.clockToken,startDelay=nextT4Delay();
    const step=()=>{
      if(token!==hw.clockToken||fidelityState.mode!=='clock'||getLampTestActive()){setRelayBusy(false);return}
      const job=queue.shift();if(!job){setRelayBusy(false);return}
      const relay=relayOfJob(job),low11=job.newWord&0o3777,relayWords=getClockRelayWords();
      const prior=Object.prototype.hasOwnProperty.call(hw.latches,relay)?hw.latches[relay]:(relayWords[relay]??0);hw.latches[relay]=prior&0o3777;
      // Normal PHONE CLOCK rendering is owned by clockDigits at the common
      // 20-ms settle boundary; do not transiently paint the AGC projection.
      beginRelayDrive(relay,low11,false);relayWords[relay]=low11;
      later(()=>{
        if(token!==hw.clockToken||fidelityState.mode!=='clock'||getLampTestActive())return;
        const digits=getClockDigits(),touched=new Set();
        for(const [name,index] of cellsOfJob(job)){digits[name][index]=job.want[name][index];touched.add(name)}
        touched.forEach(name=>clock.renderReg(name));
      },RELAY_DRIVE_MS);
      later(step,DIRTY_ROW_START_MS);
    };
    later(step,startDelay);
  }
  compat.replace('runRelayQueue',hardwareRunRelayQueue,'hardware T4 relay queue');

  function flashPhaseOff(){const elapsed=Math.max(0,performance.now()-scalerEpoch);return Math.floor(elapsed/DSKY_FLASH_QUANTUM_MS)%DSKY_FLASH_PHASES===0}
  function applySyntheticFlash(){
    if(!getLampTestActive()||!hw.v35FlashEnabled)return;
    const off=flashPhaseOff();document.body.classList.toggle('vn-flash-off',off);
    setAuxRelays({keyrel:hw.v35DirectKeyRel&&!off,oprerr:hw.v35DirectOperErr&&!off},true);
  }
  function scheduleSyntheticFlash(){
    if(!getLampTestActive()||!hw.v35FlashEnabled)return;applySyntheticFlash();
    const elapsed=Math.max(0,performance.now()-scalerEpoch),until=DSKY_FLASH_QUANTUM_MS-(elapsed%DSKY_FLASH_QUANTUM_MS);
    hw.v35FlashTimer=setTimeout(()=>{hw.v35FlashTimer=0;scheduleSyntheticFlash()},Math.max(1,until));
  }
  function seedPhoneLatches(state){
    for(const relay of V35_ORDER){const low11=(state[relay]??0)&0o3777;hw.latches[relay]=low11;display.commitRelayWord(relay,low11,{render:false})}
  }
  function scheduleSyntheticRows(target,token,onComplete){
    const start=nextT4Delay();
    V35_ORDER.forEach((relay,index)=>later(()=>{if(token!==hw.v35Token||!getLampTestActive())return;beginRelayDrive(relay,target[relay]??0,true)},start+index*DIRTY_ROW_START_MS));
    later(()=>{if(token!==hw.v35Token||!getLampTestActive())return;if(onComplete)onComplete()},start+(V35_ORDER.length-1)*DIRTY_ROW_START_MS+RELAY_DRIVE_MS+2);
  }

  const baseCancelLampTest=compat.get('cancelLampTest');
  function hardwareCancelLampTest(...args){
    hw.v35Token++;hw.v35FlashEnabled=false;hw.v35DirectKeyRel=false;hw.v35DirectOperErr=false;
    if(hw.v35FlashTimer)clearTimeout(hw.v35FlashTimer);hw.v35FlashTimer=0;document.body.classList.remove('vn-flash-off');
    if(fidelityState.mode==='clock')setAuxRelays({comp:false,uplink:false,temp:false,keyrel:false,oprerr:false,flash:false,restart:false,stby:false},true);
    return baseCancelLampTest.apply(this,args);
  }
  compat.replace('cancelLampTest',hardwareCancelLampTest,'hardware V35 cancellation');

  function hardwareLampTest(){
    clock.cancelLampTest();clock.stopQueue();setLampTestActive(true);const token=++hw.v35Token;
    setAuxRelays({comp:false,uplink:true,temp:true,restart:true,stby:true,flash:true},true);
    hw.v35DirectKeyRel=true;hw.v35DirectOperErr=true;hw.v35FlashEnabled=true;scheduleSyntheticFlash();
    const prior=currentClockLatchState(fidelityState.verb,fidelityState.noun);seedPhoneLatches(prior);const active=v35State();scheduleSyntheticRows(active,token,null);
    const timer=setTimeout(()=>{
      setLampTestTimer(0);if(token!==hw.v35Token||fidelityState.mode!=='clock')return;
      setAuxRelays({uplink:false,temp:false,restart:false,stby:false,flash:false},true);hw.v35DirectOperErr=false;hw.v35FlashEnabled=false;
      if(hw.v35FlashTimer)clearTimeout(hw.v35FlashTimer);hw.v35FlashTimer=0;document.body.classList.remove('vn-flash-off');setAuxRelays({oprerr:false,keyrel:hw.v35DirectKeyRel},true);
      const restoreData=targetClockState('16','65');restoreData.state[12]=0;
      scheduleSyntheticRows(restoreData.state,token,()=>{
        if(token!==hw.v35Token||fidelityState.mode!=='clock')return;
        hw.v35DirectKeyRel=false;setAuxRelays({keyrel:false,comp:false},true);fidelityState.verb='16';fidelityState.noun='65';
        const digits=getClockDigits();digits.r1=restoreData.want.r1.slice();digits.r2=restoreData.want.r2.slice();digits.r3=restoreData.want.r3.slice();
        const relayWords=getClockRelayWords();for(const row of CLOCK_ROWS)relayWords[row.relay]=restoreData.state[row.relay]&0o3777;
        setLampTestActive(false);const mode=shell.element('mode');if(mode)mode.textContent='V16 N65 · PHONE CLOCK';clock.syncFace();
      });
    },V35_HOLD_MS);setLampTestTimer(timer);
  }
  compat.replace('lampTest',hardwareLampTest,'hardware V35 sequence');

  // Run yaAGC from the original 1024-kHz/12 machine-cycle rate while draining
  // peripheral output at 250 Hz. The faster drain does not speed up the AGC.
  if(window.AgcCore&&AgcCore.prototype&&!AgcCore.prototype.__dskyFidelityStart){
    AgcCore.prototype.start=function fidelityStart(clockDivisor=1){
      if(this.running)return;this.clockDivisor=Math.max(0.05,Number(clockDivisor)||1);this.running=true;this.totalSteps=0;this.startTime=performance.now();
      const cycleMs=(1000*24)/2048000;
      this.timer=setInterval(()=>{
        if(!this.running)return;
        try{const target=Math.floor((performance.now()-this.startTime)/cycleMs/this.clockDivisor),diff=target-this.totalSteps;if(diff<0||diff>100000){this.startTime=performance.now();this.totalSteps=0;return}this.step(diff)}catch(error){this.stop();this.onError(error)}
      },4);
    };
    AgcCore.prototype.__dskyFidelityStart=true;
  }

  try{seedPhoneLatches(currentClockLatchState(fidelityState.verb,fidelityState.noun))}catch(_){}
  setInterval(()=>{try{if(fidelityState.mode==='clock'&&!getLampTestActive()&&!getRelayBusy())clock.tick()}catch(_){}},20);

  function baseSnapshot(){return{
    t4Ms:T4_MS,relayDriveMs:RELAY_DRIVE_MS,dirtyRowStartMs:DIRTY_ROW_START_MS,armatureSettleMs:ARMATURE_SETTLE_MS.slice(),v35Order:V35_ORDER.slice(),flashQuantumMs:DSKY_FLASH_QUANTUM_MS,flashPeriodMs:DSKY_FLASH_QUANTUM_MS*DSKY_FLASH_PHASES,activeDrive:hw.activeDrive,latches:Object.assign({},hw.latches),auxRelays:Object.assign({},hw.auxRelays),lastWrite:hw.lastWrite?Object.assign({},hw.lastWrite):null,lampTestActive:getLampTestActive()
  }}
  function snapshot(){
    let state=baseSnapshot();
    for(const [name,extension] of snapshotExtensions){
      try{const next=extension(state);if(next&&typeof next==='object')state=next}catch(error){console.error(`DSKY hardware snapshot extension ${name}`,error)}
    }
    return state;
  }
  function registerSnapshotExtension(name,extension){if(typeof name!=='string'||!name||typeof extension!=='function')throw new TypeError('Hardware snapshot extension requires name/function');snapshotExtensions.set(name,extension);return()=>snapshotExtensions.delete(name)}
  function registerSettledPaintPolicy(name,policy){if(typeof name!=='string'||!name||typeof policy!=='function')throw new TypeError('Settled-paint policy requires name/function');settledPaintPolicies.set(name,policy);return()=>settledPaintPolicies.delete(name)}

  window.AGCDSKY_HARDWARE=Object.freeze({snapshot,baseSnapshot,registerSnapshotExtension,registerSettledPaintPolicy,beginRelayDrive:(relay,word,render=true)=>beginRelayDrive(relay,word,render),relayDriveMs:RELAY_DRIVE_MS,dirtyRowStartMs:DIRTY_ROW_START_MS});
})();
