'use strict';
(() => {
  const screenState=window.AGCDSKY_APP_STATE;
  const shell=window.AGCDSKY_SHELL;
  const audio=window.AGCDSKY_AUDIO;
  if(!screenState||!shell||!audio)throw new Error('Screen-only service dependencies unavailable');
  const params=new URLSearchParams(location.search),isDream=params.get('dream')==='1',key='screenOnly';
  let enabled=isDream;
  if(!isDream){try{enabled=localStorage.getItem(key)==='1'}catch(_){}}
  const displayButton=document.getElementById('display'),el=document.getElementById('elpanel'),comp=document.getElementById('comp'),dsky=document.getElementById('dsky');

  /*
   * Full-screen EL physical stack, from the Apollo hardware specs.
   *
   * 1006315G SCD sheet 2:
   *   active digital-indicator face width = 2.360 in REF
   *   active face height = 4.055..4.065 in (4.060 nominal)
   *   digital-indicator package depth = 0.257..0.263 in (0.260 nominal)
   *
   * 2004745 / 2003988 cover assembly:
   *   raised clear-view width = 2.354 in
   *   outer cover front to indicator glass interface = 0.134 in
   *
   * R-700 3.10.1.4 confirms the laminated cover panel is optically bonded to
   * the digital indicator's own glass face. The 0.260-in indicator package
   * depth therefore belongs BEHIND that face; it is not phosphor setback.
   */
  const COVER_CLEAR_WIDTH_IN=2.354;
  const COVER_VIEW_THICKNESS_IN=0.134;
  const INDICATOR_FACE_WIDTH_IN=2.360;
  const INDICATOR_FACE_HEIGHT_MIN_IN=4.055;
  const INDICATOR_FACE_HEIGHT_MAX_IN=4.065;
  const INDICATOR_FACE_HEIGHT_IN=(INDICATOR_FACE_HEIGHT_MIN_IN+INDICATOR_FACE_HEIGHT_MAX_IN)/2;
  const INDICATOR_PACKAGE_DEPTH_MIN_IN=0.257;
  const INDICATOR_PACKAGE_DEPTH_MAX_IN=0.263;
  const INDICATOR_PACKAGE_DEPTH_IN=(INDICATOR_PACKAGE_DEPTH_MIN_IN+INDICATOR_PACKAGE_DEPTH_MAX_IN)/2;

  let renderedFaceWidthPx=0;
  let coverDepthPx=0;
  let indicatorPackageDepthPx=0;
  let totalAssemblyDepthPx=0;
  let geometryFrame=0;

  let indicatorBack=dsky&&dsky.querySelector('.el-indicator-back');
  if(!indicatorBack&&dsky&&el){
    indicatorBack=document.createElement('div');
    indicatorBack.className='el-indicator-back';
    indicatorBack.setAttribute('aria-hidden','true');
    dsky.insertBefore(indicatorBack,el);
  }

  function updateIndicatorGeometry(){
    geometryFrame=0;
    if(!dsky||!el)return;
    const rect=el.getBoundingClientRect();
    const widthPx=Number(el.offsetWidth)||rect.width||0;
    if(!(widthPx>0))return;

    const coverPxPerIn=widthPx/COVER_CLEAR_WIDTH_IN;
    const indicatorPxPerIn=widthPx/INDICATOR_FACE_WIDTH_IN;
    const nextCoverDepth=coverPxPerIn*COVER_VIEW_THICKNESS_IN;
    const nextIndicatorDepth=indicatorPxPerIn*INDICATOR_PACKAGE_DEPTH_IN;
    const nextTotalDepth=nextCoverDepth+nextIndicatorDepth;

    renderedFaceWidthPx=widthPx;
    coverDepthPx=nextCoverDepth;
    indicatorPackageDepthPx=nextIndicatorDepth;
    totalAssemblyDepthPx=nextTotalDepth;

    /* Outer cover front is the Z datum. parallax-3d.js already places the EL
       face one 2004745 cover thickness behind it. This variable places only
       the 1006315 package rear at cover + package depth. */
    dsky.style.setProperty('--dsky-screen-indicator-package-depth-px',`${nextIndicatorDepth.toFixed(3)}px`);
    dsky.style.setProperty('--dsky-screen-assembly-depth-px',`${nextTotalDepth.toFixed(3)}px`);
    dsky.style.setProperty('--dsky-screen-indicator-back-z',`${(-nextTotalDepth).toFixed(3)}px`);
  }

  function scheduleIndicatorGeometry(){
    if(geometryFrame)return;
    const raf=window.requestAnimationFrame||(fn=>setTimeout(fn,16));
    geometryFrame=raf(updateIndicatorGeometry);
  }

  function remember(){if(isDream)return;try{localStorage.setItem(key,enabled?'1':'0')}catch(_){}}
  function apply(){document.body.classList.toggle('screen-only',enabled);if(enabled)document.body.classList.remove('display-only');if(displayButton)displayButton.textContent=enabled?'FULL DSKY':'SCREEN';remember();scheduleIndicatorGeometry()}
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

  window.addEventListener('resize',scheduleIndicatorGeometry,{passive:true});
  if(typeof ResizeObserver==='function'&&el)new ResizeObserver(scheduleIndicatorGeometry).observe(el);

  window.AGCDSKY_SCREEN_ONLY_GEOMETRY=Object.freeze({
    indicatorFaceWidthIn:INDICATOR_FACE_WIDTH_IN,
    indicatorFaceHeightIn:INDICATOR_FACE_HEIGHT_IN,
    indicatorFaceHeightMinIn:INDICATOR_FACE_HEIGHT_MIN_IN,
    indicatorFaceHeightMaxIn:INDICATOR_FACE_HEIGHT_MAX_IN,
    indicatorPackageDepthIn:INDICATOR_PACKAGE_DEPTH_IN,
    indicatorPackageDepthMinIn:INDICATOR_PACKAGE_DEPTH_MIN_IN,
    indicatorPackageDepthMaxIn:INDICATOR_PACKAGE_DEPTH_MAX_IN,
    coverClearWidthIn:COVER_CLEAR_WIDTH_IN,
    coverViewThicknessIn:COVER_VIEW_THICKNESS_IN,
    rendered:()=>Object.freeze({
      faceWidthPx:renderedFaceWidthPx,
      coverDepthPx,
      indicatorPackageDepthPx,
      totalAssemblyDepthPx
    })
  });

  if(isDream)enabled=true;
  apply();
})();
