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
 * V35 is never synthesized here. The real mission program, yaAGC I/O, and
 * DSKY hardware-state output are authoritative for V35 and all AGC operations.
 * PHONE CLOCK is explicitly non-flight presentation and cannot invoke V35.
 *
 * This module no longer mutates parser-global implementations directly.
 * Display hooks are installed through AGCDSKY_DISPLAY, clock queue/V35 hooks
 * through AGCDSKY_CLOCK, and hardware diagnostics/settled-paint policy live on
 * AGCDSKY_HARDWARE.
 */
(() => {
  const fidelityState=window.AGCDSKY_APP_STATE;
  const renderer=window.AGCDSKY_RENDERER;
  const audio=window.AGCDSKY_AUDIO;
  const clock=window.AGCDSKY_CLOCK;
  const display=window.AGCDSKY_DISPLAY;
  const shell=window.AGCDSKY_SHELL;
  if(!fidelityState||!renderer||!audio||!clock||!display||!shell)throw new Error('Hardware fidelity service dependencies unavailable');

  const CLOCK_GROUPS=clock.relayGroups();
  const desiredClockDigits=()=>clock.desiredDigits();
  const clockWord=(group,want)=>clock.relayWord(group,want);
  const T4_MS=120;
  const RELAY_DRIVE_MS=20;
  const DIRTY_ROW_START_MS=40;
  const CLOCK_RELAY_ORDER=Object.freeze([12,11,10,9,8,7,6,5,4,3,2,1]);
  const t4Epoch=performance.now();
  const CLOCK_ROWS=CLOCK_GROUPS.map(group=>({relay:group.relay,cells:group.cells,native:group}));

  const hw={
    latches:Object.create(null),relayGeneration:Object.create(null),activeDrive:0,
    timers:new Set(),clockToken:0,lastWrite:null,
    auxRelays:Object.assign(Object.create(null),{comp:false,uplink:false,temp:false,keyrel:false,oprerr:false,flash:false,restart:false,stby:false})
  };
  const snapshotExtensions=new Map();
  const settledPaintPolicies=new Map();

  const getClockDigits=()=>clock.digits();
  const getClockRelayWords=()=>clock.relayWords();
  const getRelayQueue=()=>clock.queue();
  const getRelayBusy=()=>clock.queueBusy();
  const setRelayBusy=value=>clock.setQueueBusy(value);
  const getLampTestActive=()=>clock.lampTestActive();

  function later(fn,ms){
    const id=setTimeout(()=>{hw.timers.delete(id);fn()},Math.max(0,ms));hw.timers.add(id);return id;
  }
  function phaseDelay(period,epoch){const elapsed=Math.max(0,performance.now()-epoch),phase=elapsed%period;return phase<0.25?0:period-phase}
  function nextT4Delay(){return phaseDelay(T4_MS,t4Epoch)}

  const ARMATURE_SETTLE_MS=Object.freeze([6.2,11.7,8.4,13.6,7.1,15.0,9.5,12.5,5.6,14.3,10.5]);
  function relayArmatureClack(_relay,_bit,_turningOn,delayMs){
    if(!fidelityState.tickSound)return;
    later(()=>{
      if(!fidelityState.tickSound)return;
      audio.playBurst(1);
    },Math.max(1,delayMs));
  }
  function changedArmatures(prior,target){
    const out=[],diff=(prior^target)&0o3777;
    for(let bit=0;bit<11;bit++){const mask=1<<bit;if(diff&mask)out.push({bit,mask,on:!!(target&mask),delay:ARMATURE_SETTLE_MS[bit]})}
    out.sort((a,b)=>a.delay-b.delay||a.bit-b.bit);return out;
  }

  const AUX_VISUAL=Object.freeze({comp:'comp',uplink:'uplink',temp:'temp',keyrel:'keyrel',oprerr:'oprerr',restart:'restart',stby:'stby'});
  function commitAuxRelays(next,render=true){
    for(const [name,requested] of Object.entries(next||{})){
      if(!Object.prototype.hasOwnProperty.call(hw.auxRelays,name))continue;
      const on=!!requested;hw.auxRelays[name]=on;
      if(render&&AUX_VISUAL[name])renderer.setLamp(AUX_VISUAL[name],on);
    }
  }
  function setAuxRelays(next,render=true){
    const visual=window.DSKY_RELAY_VISUAL;
    if(visual&&typeof visual.presentAux==='function'){
      return visual.presentAux(next,{render,commit:(name,on,renderNow)=>commitAuxRelays({[name]:on},!!renderNow)});
    }
    return commitAuxRelays(next,render);
  }

  function clockLow11(row,want){return clockWord(row.native,want)&0o3777}
  function relayOfJob(job){return job.group?job.group.relay:job.relay}
  function cellsOfJob(job){return job.group?job.group.cells:[]}
  function low11ForPair(text){const s=String(text||'').padEnd(2,' ').slice(0,2);return(clock.digitRelayCode(s[0])<<5)|clock.digitRelayCode(s[1])}
  function currentClockLatchState(commandVerb=fidelityState.verb,commandNoun=fidelityState.noun){
    const relayWords=getClockRelayWords(),state={11:low11ForPair('00'),10:low11ForPair(commandVerb),9:low11ForPair(commandNoun),12:Object.prototype.hasOwnProperty.call(hw.latches,12)?hw.latches[12]:0};
    for(const row of CLOCK_ROWS)state[row.relay]=(relayWords[row.relay]??0)&0o3777;return state;
  }

  function settledPaintAllowed(relay,low11){
    for(const policy of settledPaintPolicies.values()){
      try{if(policy(relay,low11,{mode:fidelityState.mode,lampTestActive:getLampTestActive()})===false)return false}catch(error){console.error('DSKY settled-paint policy',error)}
    }
    return true;
  }
  function beginRelayDrive(relay,low11,render=true,present=true){
    low11&=0o3777;
    const prior=Object.prototype.hasOwnProperty.call(hw.latches,relay)?hw.latches[relay]:0;
    const motions=changedArmatures(prior,low11),generation=(hw.relayGeneration[relay]||0)+1;
    hw.relayGeneration[relay]=generation;hw.activeDrive=relay;hw.lastWrite={relay,low11,changed:motions.length,at:performance.now()};
    if(present){
      const visual=window.DSKY_RELAY_VISUAL;
      if(visual&&typeof visual.presentDrive==='function')visual.presentDrive(relay,prior,low11,{renderContact:true});
    }
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
    beginRelayDrive(relay,word&0o3777,true,false);return true;
  }
  display.installImplementation('decodeChannel10',hardwareDecodeChannel10,'hardware relay drive');

  function hardwareDecodeChannel11(value){
    const word=Number(value)&0o77777;display.setChannelState(0o11,word,{render:false});
    setAuxRelays({comp:!!(word&0o00002),uplink:!!(word&0o00004),flash:!!(word&0o00040)},true);return true;
  }
  display.installImplementation('decodeChannel11',hardwareDecodeChannel11,'hardware auxiliary relays');

  function hardwareDecodeChannel163(value){
    const word=Number(value)&0o77777;display.setChannelState(0o163,word,{render:false});
    document.body.classList.toggle('vn-flash-off',!!(word&0o00040));document.body.classList.toggle('el-off',!!(word&0o01000));
    setAuxRelays({temp:!!(word&0o00010),keyrel:!!(word&0o00020),oprerr:!!(word&0o00100),restart:!!(word&0o00200),stby:!!(word&0o00400)},true);return true;
  }
  display.installImplementation('decodeChannel163',hardwareDecodeChannel163,'hardware pulse-modulated auxiliaries');

  const baseResetAgcFace=display.implementation('resetFace');
  function hardwareResetAgcFace(...args){
    const visual=window.DSKY_RELAY_VISUAL;if(visual&&typeof visual.resetPresentation==='function')visual.resetPresentation();
    for(const key of Object.keys(hw.latches))delete hw.latches[key];for(const key of Object.keys(hw.relayGeneration))delete hw.relayGeneration[key];hw.activeDrive=0;for(const key of Object.keys(hw.auxRelays))hw.auxRelays[key]=false;return baseResetAgcFace.apply(this,args);
  }
  display.installImplementation('resetFace',hardwareResetAgcFace,'hardware reset state');

  const baseStopClockQueue=clock.implementation('stopQueue');
  function hardwareStopClockQueue(...args){hw.clockToken++;return baseStopClockQueue.apply(this,args)}
  clock.installImplementation('stopQueue',hardwareStopClockQueue,'hardware clock queue ownership');

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
  clock.installImplementation('runQueue',hardwareRunRelayQueue,'hardware T4 relay queue');

  function seedClockLatches(state){
    for(const relay of CLOCK_RELAY_ORDER){
      const low11=(state[relay]??0)&0o3777;
      hw.latches[relay]=low11;
      display.commitRelayWord(relay,low11,{render:false});
    }
  }


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

  try{seedClockLatches(currentClockLatchState(fidelityState.verb,fidelityState.noun))}catch(_){}
  setInterval(()=>{try{if(fidelityState.mode==='clock'&&!getLampTestActive()&&!getRelayBusy())clock.tick()}catch(_){}},20);

  function baseSnapshot(){return{
    t4Ms:T4_MS,relayDriveMs:RELAY_DRIVE_MS,dirtyRowStartMs:DIRTY_ROW_START_MS,armatureSettleMs:ARMATURE_SETTLE_MS.slice(),clockRelayOrder:CLOCK_RELAY_ORDER.slice(),activeDrive:hw.activeDrive,latches:Object.assign({},hw.latches),auxRelays:Object.assign({},hw.auxRelays),lastWrite:hw.lastWrite?Object.assign({},hw.lastWrite):null,lampTestActive:getLampTestActive()
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

  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_HARDWARE',Object.freeze({snapshot,baseSnapshot,registerSnapshotExtension,registerSettledPaintPolicy,beginRelayDrive:(relay,word,render=true,present=true)=>beginRelayDrive(relay,word,render,present),relayDriveMs:RELAY_DRIVE_MS,dirtyRowStartMs:DIRTY_ROW_START_MS}),'hardware-fidelity publication');
})();
