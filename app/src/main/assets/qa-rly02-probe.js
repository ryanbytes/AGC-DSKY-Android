'use strict';

// TEMPORARY QA-ONLY oracle. Never merge this file to main.
(() => {
  const bridge=window.DebugBridge;
  if(!bridge||typeof bridge.qa!=='function')return;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const fail=message=>{throw new Error(message)};

  async function services(){
    for(let i=0;i<120;i++){
      const registry=window.AGCDSKY_SERVICE_REGISTRY;
      const hardware=registry&&typeof registry.get==='function'?registry.get('AGCDSKY_HARDWARE'):null;
      const current={
        topology:window.DSKY_RELAY_TOPOLOGY,
        audio:window.DSKY_RELAY_AUDIO,
        display:window.AGCDSKY_DISPLAY,
        state:window.AGCDSKY_APP_STATE,
        hardware
      };
      if(current.topology&&current.audio&&current.display&&current.state&&current.hardware)return current;
      await sleep(250);
    }
    fail('runtime services did not initialize');
  }

  (async()=>{
    let priorMode=null,state=null;
    try{
      const s=await services();
      const t=s.topology,a=s.audio,d=s.display,h=s.hardware;
      state=s.state; priorMode=state.mode;
      const expectedHoles=['3:10','8:5','8:6','8:7','8:8','8:9','8:10','9:10','10:10','11:10','12:9','12:10'];

      if(t.physicalRelayCount!==132)fail('physicalRelayCount='+t.physicalRelayCount);
      if(t.latchingRelayCount!==120)fail('latchingRelayCount='+t.latchingRelayCount);
      if(t.nonLatchingRelayCount!==12)fail('nonLatchingRelayCount='+t.nonLatchingRelayCount);
      if(t.latchingRelays.length!==120||t.nonLatchingRelays.length!==12||t.packageSlots.length!==132)fail('runtime inventory lengths');

      const ids=[...t.latchingRelays,...t.nonLatchingRelays].map(item=>item.id);
      if(new Set(ids).size!==132)fail('duplicate physical relay identity');

      const packageIds=t.packageSlots.map(item=>item.id);
      if(new Set(packageIds).size!==132)fail('duplicate Dn:Kx package slot');
      const packageLatching=t.packageSlots.filter(item=>item.type==='latching').length;
      const packageNonLatching=t.packageSlots.filter(item=>item.type==='non-latching').length;
      if(packageLatching!==120||packageNonLatching!==12)fail('package-slot type population '+packageLatching+'+'+packageNonLatching);

      const holes=[];let profiles=0;
      for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++){
        const physical=t.isLatchingRelay(row,bit);
        const p=a.profileFor(row,bit);
        if(physical){
          if(!p)fail('missing latching profile '+row+':'+bit);
          profiles++;
        }else{
          holes.push(row+':'+bit);
          if(p!==null)fail('unpopulated position has profile '+row+':'+bit);
          if(a.hapticPatternFor(row,bit,true)!==null)fail('unpopulated position has haptic '+row+':'+bit);
          if(a.contactTraceFor(row,bit,true).length!==0)fail('unpopulated position has contact trace '+row+':'+bit);
        }
      }
      if(profiles!==120)fail('physical profile count='+profiles);
      if(JSON.stringify(holes)!==JSON.stringify(expectedHoles))fail('hole set '+JSON.stringify(holes));
      if(a.latchingRelayCount!==120||a.auxiliaryRelayCount!==12||a.totalIndividualRelays!==132)fail('audio model population');
      for(const name of t.nonLatchingNames)if(!a.auxiliaryProfileFor(name))fail('missing non-latching profile '+name);

      const snap0=h.snapshot();
      if(snap0.physicalRelayCount!==132||snap0.latchingRelayCount!==120||snap0.nonLatchingRelayCount!==12)fail('hardware snapshot population');

      state.mode='agc';
      d.onChannel(0o11,0);d.onChannel(0o12,0);d.onChannel(0o163,0);
      await sleep(140);
      d.onChannel(0o11,0o00007);d.onChannel(0o12,0o30000);d.onChannel(0o163,0o00771);
      await sleep(180);
      const asserted=h.snapshot().auxRelays;
      const missing=t.nonLatchingNames.filter(name=>!asserted[name]);
      if(missing.length)fail('non-latching source route did not assert '+missing.join(','));

      d.onChannel(0o11,0);d.onChannel(0o12,0);d.onChannel(0o163,0);
      await sleep(180);
      const released=h.snapshot().auxRelays;
      const stuck=t.nonLatchingNames.filter(name=>released[name]);
      if(stuck.length)fail('non-latching source route did not release '+stuck.join(','));

      const decode10=d.implementation('decodeChannel10');
      const resetFace=d.implementation('resetFace');
      resetFace();
      decode10((3<<11)|0o2000);
      const holeWrite=h.snapshot().lastWrite;
      if(!holeWrite||holeWrite.relay!==3||holeWrite.low11!==0o2000||holeWrite.changed!==0)fail('unpopulated ROW-03:B produced physical armature motion');

      state.mode=priorMode;
      bridge.qa('RLY02_PASS '+JSON.stringify({
        physical:132,latching:120,nonLatching:12,profiles,
        holes:holes.length,auxAsserted:12,auxReleased:12,row03BChanges:holeWrite.changed
      }));
    }catch(error){
      if(state&&priorMode!==null)state.mode=priorMode;
      bridge.qa('RLY02_FAIL '+String(error&&error.stack||error));
    }
  })();
})();
