'use strict';
(() => {
  if (window.__DSKY_PHASE37_PRESENTATION__) return;
  window.__DSKY_PHASE37_PRESENTATION__ = true;

  const STORAGE_KEY='dskyHardwareColorMode';
  const body=document.body;
  const dsky=document.getElementById('dsky');
  const controls=document.getElementById('controls');
  if(!body||!dsky||!controls)return;

  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='phase37-presentation.css';
  link.dataset.feature='phase37-presentation';
  document.head.appendChild(link);

  let authentic=false;
  try{authentic=localStorage.getItem(STORAGE_KEY)==='authentic'}catch(_){}

  const button=document.createElement('button');
  button.id='hardware-color-mode';
  button.type='button';
  button.title='Switch between the default palette and FS 36231 body / FS 36076 EL colors';

  function applyColor(persist=false){
    body.classList.toggle('authentic-colors',authentic);
    button.textContent=authentic?'COLOR · FS595':'COLOR · DEFAULT';
    button.setAttribute('aria-pressed',authentic?'true':'false');
    if(persist){try{localStorage.setItem(STORAGE_KEY,authentic?'authentic':'default')}catch(_){}}
  }

  button.addEventListener('click',()=>{authentic=!authentic;applyColor(true)});
  const parallaxControls=controls.querySelector('.parallax-controls');
  controls.insertBefore(button,parallaxControls||null);
  applyColor(false);

  function numberVar(name,fallback=0){
    const n=parseFloat(dsky.style.getPropertyValue(name));
    return Number.isFinite(n)?n:fallback;
  }
  function setVar(name,value){
    if(dsky.style.getPropertyValue(name)!==value)dsky.style.setProperty(name,value);
  }
  function syncElParallax(){
    const tx=numberVar('--dsky-tilt-x');
    const ty=numberVar('--dsky-tilt-y');
    const px=numberVar('--dsky-parallax-x');
    const py=numberVar('--dsky-parallax-y');
    const lx=numberVar('--dsky-light-x',50);
    const ly=numberVar('--dsky-light-y',45);
    const sx=numberVar('--dsky-shadow-x');
    const sy=numberVar('--dsky-shadow-y',5);
    setVar('--dsky-el-tilt-x',`${(tx*1.55).toFixed(3)}deg`);
    setVar('--dsky-el-tilt-y',`${(ty*1.55).toFixed(3)}deg`);
    setVar('--dsky-el-parallax-x',(px*1.70).toFixed(3));
    setVar('--dsky-el-parallax-y',(py*1.70).toFixed(3));
    setVar('--dsky-el-light-x',`${(50+(lx-50)*(23/16)).toFixed(2)}%`);
    setVar('--dsky-el-light-y',`${(45+(ly-45)*(20/14)).toFixed(2)}%`);
    setVar('--dsky-el-shadow-x',`${(sx*1.35).toFixed(2)}px`);
    setVar('--dsky-el-shadow-y',`${(5.5+(sy-5)*(2.4/1.8)).toFixed(2)}px`);
  }

  if(typeof MutationObserver==='function')new MutationObserver(syncElParallax).observe(dsky,{attributes:true,attributeFilter:['style']});
  syncElParallax();

  const controller=Object.freeze({
    authentic:()=>authentic,
    setAuthentic(value){authentic=!!value;applyColor(true);return authentic},
    toggle(){authentic=!authentic;applyColor(true);return authentic},
    syncElParallax
  });
  window.AGCDSKY_PHASE37_PRESENTATION=controller;
  const api=window.AGCDSKY=window.AGCDSKY||{};
  api.hardwareColorMode=controller;
})();
