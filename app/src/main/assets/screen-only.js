'use strict';
(() => {
  const params=new URLSearchParams(location.search),isDream=params.get('dream')==='1',key='screenOnly';
  let enabled=isDream;
  if(!isDream){try{enabled=localStorage.getItem(key)==='1'}catch(_){}}
  const displayButton=document.getElementById('display');
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
    if(isDream){try{if(window.DreamBridge&&DreamBridge.finishDream)DreamBridge.finishDream()}catch(_){};return}
    enabled=false;apply();if(typeof showControls==='function')showControls();
  }
  function toggleTick(){if(!enabled)return;try{ensureAudio();tickSound=!tickSound;applyTickSound();if(tickSound)playRelayBurst(1)}catch(_){} }

  // Capture-phase handler prevents app.js's older DISPLAY listener from also
  // enabling the cropped faceplate mode on the same tap.
  if(displayButton)displayButton.addEventListener('click',(event)=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(enabled){if(isDream)exit();else{enabled=false;apply();if(typeof showControls==='function')showControls()}}
    else enter();
  },true);

  // Direct shortcut from the full panel: tap the EL glass to isolate it.
  if(el)el.addEventListener('click',(event)=>{
    if(!enabled){event.preventDefault();event.stopPropagation();enter()}
  },{passive:false});

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

  if(isDream)enabled=true
  apply();
})();
