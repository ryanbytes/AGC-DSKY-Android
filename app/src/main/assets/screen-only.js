'use strict';
(() => {
  const params=new URLSearchParams(location.search),isDream=params.get('dream')==='1',key='screenOnly';
  let enabled=isDream;
  if(!isDream){try{enabled=localStorage.getItem(key)==='1'}catch(_){}}
  const displayButton=document.getElementById('display');
  const dreamButton=document.getElementById('dreambright');
  const modeText=document.getElementById('mode');
  const el=document.getElementById('elpanel');

  function remember(){if(isDream)return;try{localStorage.setItem(key,enabled?'1':'0')}catch(_){}}
  function apply(){
    document.body.classList.toggle('screen-only',enabled);
    if(enabled)document.body.classList.remove('display-only');
    if(displayButton)displayButton.textContent=enabled?'FULL DSKY':'SCREEN';
    remember();
  }
  function enter(){enabled=true;apply()}
  function exit(){
    if(isDream){
      try{if(window.DreamBridge&&DreamBridge.finishDream)DreamBridge.finishDream()}catch(_){}
      return;
    }
    enabled=false;apply();
    if(typeof showControls==='function')showControls();
  }
  function toggleTick(){
    if(!enabled)return;
    try{
      if(typeof ensureAudio==='function')ensureAudio();
      tickSound=!tickSound;
      if(typeof applyTickSound==='function')applyTickSound();
      if(tickSound&&typeof playRelayBurst==='function')playRelayBurst(1);
    }catch(_){}
  }
  function refreshDreamModeLabel(){
    try{
      if(dreamButton&&dreamMode==='solar')dreamButton.textContent='SUN AUTO';
      if(!isDream&&modeText&&dreamMode==='solar')modeText.textContent='SUN AUTO · 60 MIN SUNRISE/SUNSET FADE';
    }catch(_){}
  }

  // Capture the control before app.js's DISPLAY handler so one tap has one
  // meaning: SCREEN enters the borderless EL readout and FULL DSKY exits.
  if(displayButton)displayButton.addEventListener('click',(event)=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(enabled){
      if(isDream)exit();
      else{enabled=false;apply();if(typeof showControls==='function')showControls()}
    }else enter();
  },true);

  // Direct shortcut from the full DSKY: tap the EL glass to isolate it.
  if(el)el.addEventListener('click',(event)=>{
    if(!enabled){event.preventDefault();event.stopPropagation();enter()}
  },{passive:false});

  // In SCREEN mode a short tap toggles relay-tick audio. A 1.8 s hold returns
  // to the full DSKY, or exits DreamService when the screen saver owns the view.
  let downAt=0,hold=0,held=false;
  document.addEventListener('pointerdown',()=>{
    if(!enabled)return;
    downAt=performance.now();held=false;clearTimeout(hold);
    hold=setTimeout(()=>{held=true;exit()},1800);
  },{passive:true});
  document.addEventListener('pointerup',()=>{
    if(!enabled){clearTimeout(hold);return}
    const dt=performance.now()-downAt;clearTimeout(hold);
    if(!held&&dt<650)toggleTick();
  },{passive:true});
  document.addEventListener('pointercancel',()=>{clearTimeout(hold);held=true},{passive:true});

  // app.js already provides the SUN/SOLAR mode. Make it explicit in the UI and
  // sample the smooth sunrise/sunset curve every 15 s while DreamService runs.
  if(dreamButton)dreamButton.addEventListener('click',()=>setTimeout(refreshDreamModeLabel,0));
  refreshDreamModeLabel();
  if(isDream)setInterval(()=>{
    try{if(dreamMode==='solar'&&typeof updateDreamEnvironment==='function')updateDreamEnvironment()}catch(_){}
  },15000);

  if(isDream)enabled=true;
  apply();
})();
