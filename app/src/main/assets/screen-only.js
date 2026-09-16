'use strict';
(() => {
  const screenState=window.AGCDSKY_APP_STATE;
  const shell=window.AGCDSKY_SHELL;
  const audio=window.AGCDSKY_AUDIO;
  if(!screenState||!shell||!audio)throw new Error('Screen-only service dependencies unavailable');
  const params=new URLSearchParams(location.search),isDream=params.get('dream')==='1',key='screenOnly';
  let enabled=isDream;
  if(!isDream){try{enabled=localStorage.getItem(key)==='1'}catch(_){}}
  const displayButton=document.getElementById('display'),el=document.getElementById('elpanel'),comp=document.getElementById('comp');

  function remember(){if(isDream)return;try{localStorage.setItem(key,enabled?'1':'0')}catch(_){} }
  function apply(){document.body.classList.toggle('screen-only',enabled);if(enabled)document.body.classList.remove('display-only');if(displayButton)displayButton.textContent=enabled?'FULL DSKY':'SCREEN';remember()}
  function enter(){enabled=true;apply()}
  function exit(showControlsAfter=true){if(isDream){try{if(window.DreamBridge&&DreamBridge.finishDream)DreamBridge.finishDream()}catch(_){};return}enabled=false;apply();if(showControlsAfter)shell.showControls()}
  function toggleTick(){if(!enabled)return;try{audio.ensure();screenState.tickSound=!screenState.tickSound;audio.applySetting();if(screenState.tickSound)audio.playBurst(1)}catch(_){} }

  if(displayButton)displayButton.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(enabled)exit(true);else enter()},true);

  let compExitTap=false;
  if(el)el.addEventListener('click',event=>{
    if(compExitTap&&comp&&comp.contains(event.target)){compExitTap=false;event.preventDefault();event.stopPropagation();return}
    if(!enabled){event.preventDefault();event.stopPropagation();enter()}
  },{passive:false});

  let downAt=0,hold=0,held=false;
  document.addEventListener('pointerdown',()=>{compExitTap=false;if(!enabled)return;downAt=performance.now();held=false;clearTimeout(hold);hold=setTimeout(()=>{held=true;exit(true)},1800)},{passive:true});
  document.addEventListener('pointerup',event=>{
    if(!enabled){clearTimeout(hold);return}
    const dt=performance.now()-downAt;clearTimeout(hold);
    if(!held&&dt<650){
      if(!isDream&&comp&&comp.contains(event.target)){compExitTap=true;exit(false)}
      else toggleTick()
    }
  },{passive:true});
  document.addEventListener('pointercancel',()=>{clearTimeout(hold);held=true},{passive:true});

  if(isDream)enabled=true;
  apply();
})();
