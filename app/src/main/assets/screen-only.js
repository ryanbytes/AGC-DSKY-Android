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
  function enter(){if(isDream)return;enabled=true;apply()}
  function exit(){if(isDream)return;enabled=false;apply();if(typeof showControls==='function')showControls()}

  // The existing DISPLAY control becomes the explicit SCREEN/FULL DSKY toggle.
  if(displayButton)displayButton.addEventListener('click',()=>{
    setTimeout(()=>{enabled=!enabled;apply();if(!enabled&&typeof showControls==='function')showControls()},0);
  });

  // Direct main-screen shortcut: tap the EL display itself to isolate it.
  if(el)el.addEventListener('click',(event)=>{if(!enabled){event.preventDefault();event.stopPropagation();enter()}},{passive:false});

  // In SCREEN mode, hold anywhere for 1.8 s to return to the complete DSKY.
  let hold=0;
  document.addEventListener('pointerdown',()=>{
    if(isDream||!enabled)return;
    clearTimeout(hold);hold=setTimeout(exit,1800);
  },{passive:true});
  document.addEventListener('pointerup',()=>clearTimeout(hold),{passive:true});
  document.addEventListener('pointercancel',()=>clearTimeout(hold),{passive:true});

  if(isDream)enabled=true;
  apply();
})();
