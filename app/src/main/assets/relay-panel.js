'use strict';

/*
 * Block II DSKY physical relay-package view.
 *
 * This module never synthesizes relay activity. It renders the source-proven
 * D1-D6/K1-K22 package inventory from DSKY_RELAY_TOPOLOGY and passively
 * follows the same DSKY_RELAY_VISUAL events that drive contact projection,
 * relay sound, and handset haptics.
 */
(() => {
  const host=document.getElementById('relay-panel');
  const visual=window.DSKY_RELAY_VISUAL;
  const topology=window.DSKY_RELAY_TOPOLOGY;
  const hardware=window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE');
  if(!host||!visual||!topology||!hardware||typeof visual.subscribe!=='function')return;

  if(topology.physicalRelayCount!==132||topology.latchingRelayCount!==120||topology.nonLatchingRelayCount!==12){
    throw new Error('Relay panel requires verified 132-package Block II DSKY topology');
  }

  const cells=new Map();

  function createCell(slot){
    const cell=document.createElement('div');
    cell.className=`relay-cell relay-${slot.type}`;
    cell.dataset.relaySlot=slot.id;
    cell.dataset.module=slot.module;
    cell.dataset.k=String(slot.k);
    cell.dataset.kLabel=`K${slot.k}`;
    cell.dataset.moduleLabel=slot.k===1?slot.module:'';
    cell.dataset.relayType=slot.type;
    cell.dataset.part=slot.packagePart;
    const title=`${slot.id} · ${slot.packagePart} · ${slot.type}`;
    cell.title=title;
    cell.setAttribute('role','img');
    cell.setAttribute('aria-label',title);

    const coil=document.createElement('i');coil.className='relay-coil';
    const armature=document.createElement('i');armature.className='relay-armature';
    const fixed=document.createElement('i');fixed.className='relay-fixed-contact';
    const moving=document.createElement('i');moving.className='relay-moving-contact';
    cell.append(coil,armature,fixed,moving);
    host.appendChild(cell);
    return cell;
  }

  function build(){
    host.replaceChildren();
    cells.clear();
    for(const slot of topology.packageSlots)cells.set(slot.id,createCell(slot));
    if(cells.size!==132)throw new Error(`Relay panel expected 132 package cells; got ${cells.size}`);
  }

  function latchingCell(row,bit){
    const relay=topology.latchingRelay(row,bit);
    return relay?cells.get(relay.packageSlot)||null:null;
  }

  function nonLatchingCell(name){
    const relay=topology.nonLatchingRelay(name);
    return relay?cells.get(relay.packageSlot)||null:null;
  }

  function setCellState(cell,on){
    if(!cell)return;
    cell.classList.toggle('on',!!on);
    cell.dataset.state=on?'on':'off';
  }

  function beginMotion(cell,targetOn,durationMs){
    if(!cell)return;
    const duration=Math.max(1,Number(durationMs)||1);
    cell.style.setProperty('--relay-travel-ms',`${duration}ms`);
    cell.classList.toggle('target-on',!!targetOn);
    cell.classList.add('moving');
  }

  function contactEvent(cell,event){
    if(!cell)return;
    setCellState(cell,event.state);
    if(event.phase==='armature'){
      cell.classList.remove('moving','target-on');
      cell.dataset.lastContact='armature';
    }else if(event.phase==='bounce'){
      cell.dataset.lastContact='bounce';
    }else if(event.phase==='settled'){
      cell.classList.remove('moving','target-on');
      cell.dataset.lastContact='settled';
    }
  }

  function syncSnapshot(){
    let snapshot;
    try{snapshot=hardware.snapshot()}catch(_){return}
    const latches=snapshot&&snapshot.latches||{};
    const aux=snapshot&&snapshot.auxRelays||{};

    for(const relay of topology.latchingRelays){
      const cell=cells.get(relay.packageSlot);
      const word=Number(latches[relay.row]??0)&0o3777;
      if(cell)cell.classList.remove('moving','target-on');
      setCellState(cell,!!(word&relay.mask));
    }
    for(const relay of topology.nonLatchingRelays){
      const cell=cells.get(relay.packageSlot);
      if(cell)cell.classList.remove('moving','target-on');
      setCellState(cell,!!aux[relay.name]);
    }
  }

  build();
  syncSnapshot();

  visual.subscribe(event=>{
    if(event.type==='relay-drive')beginMotion(latchingCell(event.row,event.bit),event.targetOn,event.durationMs);
    else if(event.type==='relay-contact')contactEvent(latchingCell(event.row,event.bit),event);
    else if(event.type==='aux-drive')beginMotion(nonLatchingCell(event.name),event.targetOn,event.durationMs);
    else if(event.type==='aux-contact')contactEvent(nonLatchingCell(event.name),event);
    else if(event.type==='reset')syncSnapshot();
  });

  window.DSKY_RELAY_PANEL=Object.freeze({
    totalCells:cells.size,
    latchingCells:topology.latchingRelayCount,
    nonLatchingCells:topology.nonLatchingRelayCount,
    sync:syncSnapshot
  });
})();
