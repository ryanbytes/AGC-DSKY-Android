'use strict';

/*
 * Physical relay-rack view.
 *
 * No relay state is synthesized here. The rack is a passive subscriber to
 * DSKY_RELAY_VISUAL, whose single contact events also drive relay audio and
 * the DSKY contact projection.
 */
(() => {
  const host=document.getElementById('relay-panel');
  const viewButton=document.getElementById('relay-view');
  const visual=window.DSKY_RELAY_VISUAL;
  const audioModel=window.DSKY_RELAY_AUDIO;
  const hardware=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE');
  if(!host||!visual||!audioModel||!hardware||typeof visual.subscribe!=='function')return;

  const relayCells=new Map(),auxCells=new Map();
  let viewVisible=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const relayKey=(row,bit)=>`${Number(row)}:${Number(bit)}`;

  function createCell({id,title,profile,aux=false}){
    const cell=document.createElement('div');
    cell.className=`relay-cell${aux?' relay-aux':''}`;
    cell.setAttribute('role','img');
    cell.setAttribute('aria-label',title);
    cell.title=title;
    cell.dataset.relayId=id;
    const skew=profile&&Number.isFinite(profile.poleSkewUs)?clamp(profile.poleSkewUs/185,-1,1):0;
    const level=profile&&Number.isFinite(profile.level)?clamp(profile.level,.9,1.1):1;
    cell.style.setProperty('--relay-skew',`${(skew*.9).toFixed(3)}deg`);
    cell.style.setProperty('--relay-copper',String(level.toFixed(3)));
    const coil=document.createElement('i');coil.className='relay-coil';
    const armature=document.createElement('i');armature.className='relay-armature';
    const fixed=document.createElement('i');fixed.className='relay-fixed-contact';
    const moving=document.createElement('i');moving.className='relay-moving-contact';
    cell.append(coil,armature,fixed,moving);host.appendChild(cell);return cell;
  }

  function build(){
    host.replaceChildren();relayCells.clear();auxCells.clear();
    for(let row=12;row>=1;row--){
      for(let bit=10;bit>=0;bit--){
        const id=audioModel.relayIdentity(row,bit),p=audioModel.profileFor(row,bit);
        const title=`${id} · SET ${p.setTravelMs.toFixed(2)} ms · RESET ${p.resetTravelMs.toFixed(2)} ms · skew ${p.poleSkewUs} µs`;
        relayCells.set(relayKey(row,bit),createCell({id,title,profile:p}));
      }
    }
    for(const name of audioModel.auxiliaryNames||[]){
      const p=audioModel.auxiliaryProfileFor(name),id=`AUX:${String(name).toUpperCase()}`;
      const title=`${id} · SET ${p.setTravelMs.toFixed(2)} ms · RESET ${p.resetTravelMs.toFixed(2)} ms · skew ${p.poleSkewUs} µs`;
      auxCells.set(name,createCell({id,title,profile:p,aux:true}));
    }
    for(let i=(audioModel.auxiliaryNames||[]).length;i<11;i++){const filler=document.createElement('div');filler.className='relay-filler';host.appendChild(filler)}
  }

  function setCellState(cell,on){
    if(!cell)return;cell.classList.toggle('on',!!on);cell.setAttribute('aria-checked',on?'true':'false');
  }
  function beginMotion(cell,targetOn,durationMs){
    if(!cell)return;cell.style.setProperty('--relay-travel-ms',`${Math.max(1,Number(durationMs)||1)}ms`);
    cell.classList.toggle('target-on',!!targetOn);cell.classList.add('moving');
  }
  function contactEvent(cell,event){
    if(!cell)return;setCellState(cell,event.state);
    if(event.phase==='armature'){
      cell.classList.remove('moving');
      cell.classList.add('impact');
      void cell.offsetWidth;
      cell.classList.remove('impact');
    }else if(event.phase==='bounce'){
      cell.classList.add('bounce');
      void cell.offsetWidth;
      cell.classList.remove('bounce');
    }
  }
  function syncSnapshot(){
    let snapshot;try{snapshot=hardware.snapshot()}catch(_){return}
    const latches=snapshot&&snapshot.latches||{},aux=snapshot&&snapshot.auxRelays||{};
    for(let row=1;row<=12;row++){
      const word=Number(latches[row]??0)&0o3777;
      for(let bit=0;bit<11;bit++){
        const cell=relayCells.get(relayKey(row,bit));if(!cell)continue;
        cell.classList.remove('moving','target-on');setCellState(cell,!!(word&(1<<bit)));
      }
    }
    for(const [name,cell] of auxCells){cell.classList.remove('moving','target-on');setCellState(cell,!!aux[name])}
  }

  function updateViewButton(){
    if(!viewButton)return;
    viewButton.textContent=viewVisible?'RELAY VIEW ON':'RELAY VIEW OFF';
    viewButton.setAttribute('aria-pressed',viewVisible?'true':'false');
    viewButton.title=viewVisible?'Hide the physical relay inspection rack':'Show the physical relay inspection rack above the DSKY';
  }
  function setViewVisible(next){
    viewVisible=!!next;
    if(document.body&&document.body.classList)document.body.classList.toggle('relay-view-visible',viewVisible);
    host.setAttribute('aria-hidden',viewVisible?'false':'true');
    if(viewVisible)syncSnapshot();
    updateViewButton();
    return viewVisible;
  }

  build();syncSnapshot();
  setViewVisible(false);
  if(viewButton&&typeof viewButton.addEventListener==='function'){
    viewButton.addEventListener('click',()=>{
      setViewVisible(!viewVisible);
      const shell=window.AGCDSKY_SHELL;
      if(shell&&typeof shell.showControls==='function')shell.showControls();
    });
  }
  visual.subscribe(event=>{
    if(event.type==='relay-drive')beginMotion(relayCells.get(relayKey(event.row,event.bit)),event.targetOn,event.durationMs);
    else if(event.type==='relay-contact')contactEvent(relayCells.get(relayKey(event.row,event.bit)),event);
    else if(event.type==='aux-drive')beginMotion(auxCells.get(event.name),event.targetOn,event.durationMs);
    else if(event.type==='aux-contact')contactEvent(auxCells.get(event.name),event);
    else if(event.type==='reset')syncSnapshot();
  });

  window.DSKY_RELAY_PANEL=Object.freeze({
    latchingCells:relayCells.size,
    auxiliaryCells:auxCells.size,
    totalCells:relayCells.size+auxCells.size,
    isVisible:()=>viewVisible,
    setVisible:setViewVisible,
    sync:syncSnapshot
  });
})();
