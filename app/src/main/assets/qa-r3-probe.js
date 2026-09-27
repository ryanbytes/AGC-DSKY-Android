'use strict';

// TEMPORARY QA-ONLY oracle. Never merge this file to main.
(() => {
  const renderer=window.AGCDSKY_RENDERER;
  const clock=window.AGCDSKY_CLOCK;
  const state=window.AGCDSKY_APP_STATE;
  const visual=window.DSKY_RELAY_VISUAL;
  const bridge=window.DebugBridge;
  if(!renderer||!clock||!state||!visual||!bridge||typeof bridge.qa!=='function')return;

  const counters={r3Paints:0,mismatches:0,relayContacts:0,lastActual:'',lastExpected:''};
  const baseSetReg=renderer.implementation('setReg');
  renderer.installImplementation('setReg',function qaSetReg(id,sign,digits){
    if(id==='r3'&&state.mode==='clock'){
      const actual=String(digits).padEnd(5,' ').slice(0,5);
      const authoritative=clock.digits();
      const expected=authoritative&&Array.isArray(authoritative.r3)
        ? authoritative.r3.join('').padEnd(5,' ').slice(0,5)
        : '';
      counters.r3Paints++;
      counters.lastActual=actual;
      counters.lastExpected=expected;
      if(actual!==expected){
        counters.mismatches++;
        bridge.qa('R3_MISMATCH paint='+counters.r3Paints+' actual='+JSON.stringify(actual)+' expected='+JSON.stringify(expected));
      }else{
        bridge.qa('R3_MATCH paint='+counters.r3Paints+' value='+JSON.stringify(actual));
      }
    }
    return baseSetReg.apply(this,arguments);
  },'temporary QA R3 clock-paint oracle');

  visual.subscribe(event=>{
    if(state.mode==='clock'&&event&&event.type==='relay-contact')counters.relayContacts++;
  });

  window.__QA_R3_PROBE=Object.freeze({snapshot:()=>({...counters})});
  bridge.qa('R3_PROBE_READY');
  setInterval(()=>{
    bridge.qa('R3_SUMMARY paints='+counters.r3Paints+' mismatches='+counters.mismatches+' relayContacts='+counters.relayContacts+' last='+JSON.stringify(counters.lastActual));
  },2000);
})();
