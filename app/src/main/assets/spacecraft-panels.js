'use strict';

/* CM-only spacecraft panel compositor.  LM support intentionally removed. */
(() => {
  const app = document.getElementById('app');
  const dsky = document.getElementById('dsky');
  if (!app || !dsky || document.getElementById('spacecraft-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'spacecraft-panel';
  panel.setAttribute('aria-hidden', 'true');
  app.insertBefore(panel, dsky);

  const s = {
    // One diagram-scaled CM master is used for both orientations.  The live DSKY
    // replaces the blank 640x744 opening at x=560,y=680 without changing DSKY size.
    src:'cm-panel-photo.jpg', w:2200, h:2300, x:560, y:680, dw:640,
    attitude:[{x:480,y:75,w:500,h:500}],
    portraitSrc:'cm-portrait-master.jpg', portraitW:2200, portraitH:2300,
    portraitX:560, portraitY:680, portraitDW:640,
    portraitAttitude:[{x:480,y:75,w:500,h:500}]
  };

  function img(src, cls='') {
    const i=document.createElement('img'); i.src=src; i.alt=''; i.className=cls; return i;
  }
  function makePieces(container, src, prefix) {
    const pieces={};
    for (const part of ['top','left','right','bottom']) {
      const box=document.createElement('div');
      box.className=`spacecraft-piece ${prefix}-${part}`;
      const i=img(src,'spacecraft-photo');
      box.appendChild(i); container.appendChild(box); pieces[part]={box,img:i};
    }
    return pieces;
  }

  const scene=document.createElement('div');
  scene.className='spacecraft-scene cm-scene';
  scene.dataset.mode='cm';
  const landscape=document.createElement('div'); landscape.className='spacecraft-landscape';
  const landPieces=makePieces(landscape,s.src,'land-piece'); scene.appendChild(landscape);
  const portrait=document.createElement('div'); portrait.className='spacecraft-portrait';
  const portPieces=makePieces(portrait,s.portraitSrc,'port-piece'); scene.appendChild(portrait);

  const landAtt=s.attitude.map((a,i)=>{
    const c=document.createElement('canvas'); c.className='attitude-live attitude-landscape';
    c.dataset.mode='cm'; c.dataset.index=String(i); c.width=640; c.height=640;
    c.setAttribute('aria-label','Gyro-driven attitude indicator'); landscape.appendChild(c);
    return {canvas:c,spec:a};
  });
  const portAtt=s.portraitAttitude.map((a,i)=>{
    const c=document.createElement('canvas'); c.className='attitude-live attitude-portrait';
    c.dataset.mode='cm'; c.dataset.index=String(i); c.width=640; c.height=640;
    c.setAttribute('aria-label','Gyro-driven attitude indicator'); portrait.appendChild(c);
    return {canvas:c,spec:a};
  });
  panel.appendChild(scene);

  function placePiece(piece,x,y,w,h,panelW,panelH){
    const b=piece.box;
    b.style.left=`${x}px`; b.style.top=`${y}px`;
    b.style.width=`${Math.max(0,w)}px`; b.style.height=`${Math.max(0,h)}px`;
    const i=piece.img;
    i.style.width=`${panelW}px`; i.style.height=`${panelH}px`;
    i.style.left=`${-x}px`; i.style.top=`${-y}px`;
  }

  function syncPortrait(r){
    landscape.style.display='none'; portrait.style.display='block';
    landAtt.forEach(({canvas})=>canvas.style.display='none');
    const scale=r.width/s.portraitDW;
    const panelW=s.portraitW*scale, panelH=s.portraitH*scale;
    const holeX=s.portraitX*scale, holeY=s.portraitY*scale;
    const holeW=r.width, holeH=r.height;
    portrait.style.left=`${r.left-holeX}px`; portrait.style.top=`${r.top-holeY}px`;
    portrait.style.width=`${panelW}px`; portrait.style.height=`${panelH}px`;
    placePiece(portPieces.top,0,0,panelW,holeY,panelW,panelH);
    placePiece(portPieces.left,0,holeY,holeX,holeH,panelW,panelH);
    placePiece(portPieces.right,holeX+holeW,holeY,panelW-(holeX+holeW),holeH,panelW,panelH);
    placePiece(portPieces.bottom,0,holeY+holeH,panelW,panelH-(holeY+holeH),panelW,panelH);
    portAtt.forEach(({canvas,spec:a})=>{
      canvas.style.display='block';
      canvas.style.left=`${a.x*scale}px`; canvas.style.top=`${a.y*scale}px`;
      canvas.style.width=`${a.w*scale}px`; canvas.style.height=`${a.h*scale}px`;
    });
  }

  function syncLandscape(r){
    portrait.style.display='none'; landscape.style.display='block';
    portAtt.forEach(({canvas})=>canvas.style.display='none');
    landAtt.forEach(({canvas})=>canvas.style.display='block');
    const scale=r.width/s.dw;
    const panelW=s.w*scale, panelH=s.h*scale;
    const holeX=s.x*scale, holeY=s.y*scale, holeW=r.width, holeH=r.height;
    landscape.style.left=`${r.left-holeX}px`; landscape.style.top=`${r.top-holeY}px`;
    landscape.style.width=`${panelW}px`; landscape.style.height=`${panelH}px`;
    placePiece(landPieces.top,0,0,panelW,holeY,panelW,panelH);
    placePiece(landPieces.left,0,holeY,holeX,holeH,panelW,panelH);
    placePiece(landPieces.right,holeX+holeW,holeY,panelW-(holeX+holeW),holeH,panelW,panelH);
    placePiece(landPieces.bottom,0,holeY+holeH,panelW,panelH-(holeY+holeH),panelW,panelH);
    landAtt.forEach(({canvas,spec:a})=>{
      canvas.style.left=`${a.x*scale}px`; canvas.style.top=`${a.y*scale}px`;
      canvas.style.width=`${a.w*scale}px`; canvas.style.height=`${a.h*scale}px`;
    });
  }

  function syncPanel(){
    if (document.body.classList.contains('dream') || document.body.classList.contains('screen-only') || document.body.classList.contains('display-only')) return;
    const r=dsky.getBoundingClientRect(); if(!r.width||!r.height)return;
    const vw=window.innerWidth, vh=window.innerHeight;
    panel.style.left='0px'; panel.style.top='0px'; panel.style.width=`${vw}px`; panel.style.height=`${vh}px`;
    if (vh>=vw) syncPortrait(r); else syncLandscape(r);
    if(window.AGCDSKY&&typeof window.AGCDSKY.redrawAttitude==='function')window.AGCDSKY.redrawAttitude();
  }

  let raf=0; const queue=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(syncPanel)};
  addEventListener('resize',queue,{passive:true}); addEventListener('orientationchange',queue,{passive:true});
  new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(window.ResizeObserver)new ResizeObserver(queue).observe(dsky);
  panel.querySelectorAll('img').forEach(i=>{if(!i.complete)i.addEventListener('load',queue,{once:true})});
  queue();
  window.AGCDSKY=window.AGCDSKY||{};
  window.AGCDSKY.syncSpacecraftPanel=syncPanel;
  window.AGCDSKY.attitudeCanvases=()=>Array.from(panel.querySelectorAll('.attitude-live'));
})();
