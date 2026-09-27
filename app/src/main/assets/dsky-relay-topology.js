'use strict';

/*
 * Block II DSKY physical relay topology.
 *
 * Physical population (production DSKY):
 *   - six interchangeable D1-D6 indicator-driver modules;
 *   - K1-K20 in each module are latching relay packages (120 total);
 *   - K21-K22 in each module are non-latching relay packages (12 total).
 *
 * Channel 010 remains an 11-bit logical relay-control word.  Not every logical
 * row/bit intersection has a physical latching relay installed.  This service
 * is the authority for deciding whether a logical channel-010 transition has
 * a physical armature/contact event and therefore may produce relay sound or
 * haptic presentation.
 *
 * Sources used by the RLY-02 audit:
 *   - Block II DSKY assembly/BOM 2003952 / relay circuit assembly 2003910
 *   - AGC Information Series Issue 30, section 30-145 and appendices A/B
 *   - MIT/IL R-700 Block II AGC final report
 *   - yaAGC fake hardware channel 0163 definitions for hardware-origin states
 *
 * Exact D1-D6/K-number wiring for each logical/function identity is not
 * invented here.  packageSlots() enumerates all 132 real package positions;
 * logical/function identities are kept separately until the interconnect
 * drawing establishes a specific package-slot crosswalk.
 */
(() => {
  const ABSENT_KEYS=new Set([
    '3:10',
    '8:5','8:6','8:7','8:8','8:9','8:10',
    '9:10','10:10','11:10',
    '12:9','12:10'
  ]);

  function bitName(bit){if(bit===10)return'B';if(bit>=5)return`C-K${bit-4}`;return`D-K${bit+1}`}
  function key(row,bit){return `${Number(row)}:${Number(bit)}`}

  const latching=[];
  for(let row=1;row<=12;row++){
    for(let bit=0;bit<=10;bit++){
      if(ABSENT_KEYS.has(key(row,bit)))continue;
      latching.push(Object.freeze({
        type:'latching',
        ordinal:latching.length,
        id:`ROW-${String(row).padStart(2,'0')}:${bitName(bit)}`,
        row,bit,
        mask:1<<bit,
        maskOctal:'0o'+(1<<bit).toString(8).padStart(4,'0'),
        logicalLabel:bitName(bit),
        packagePart:'2004688',
        packageSlot:null,
        packageSlotStatus:'interconnect-crosswalk-unresolved'
      }));
    }
  }

  const NON_LATCHING_DEFS=[
    {name:'isswar',id:'AUX:ISS-WARNING',signal:229,control:'ISSWAR',runtimeChannel:0o011,runtimeMask:0o00001,destination:'External ISS WARNING indication',sourceClass:'channel-command'},
    {name:'comp',id:'AUX:COMP-ACTY',signal:230,control:'COMACT',runtimeChannel:0o011,runtimeMask:0o00002,destination:'COMP ACTY lamp',sourceClass:'channel-command'},
    {name:'stby',id:'AUX:STBY',signal:231,control:'SBYLIT/STBY',runtimeChannel:0o163,runtimeMask:0o00400,destination:'STBY lamp',sourceClass:'hardware-phase'},
    {name:'restart',id:'AUX:RESTART',signal:232,control:'RESTRT',runtimeChannel:0o163,runtimeMask:0o00200,destination:'RESTART lamp',sourceClass:'hardware-phase'},
    {name:'injseq',id:'AUX:INJ-SEQ-START',signal:233,control:'S4BSEQ',runtimeChannel:0o012,runtimeMask:0o10000,destination:'External S-IVB INJ SEQ START / G HIGH indication (CM)',sourceClass:'channel-command'},
    {name:'cutoff',id:'AUX:CUTOFF',signal:234,control:'S4BOFF',runtimeChannel:0o012,runtimeMask:0o20000,destination:'External S-IVB CUTOFF / G LOW indication (CM)',sourceClass:'channel-command'},
    {name:'uplink',id:'AUX:UPLINK-ACTY',signal:235,control:'UPLACT',runtimeChannel:0o011,runtimeMask:0o00004,destination:'UPLINK ACTY lamp',sourceClass:'channel-command'},
    {name:'keyrel',id:'AUX:KEY-REL',signal:236,control:'KYRLS',runtimeChannel:0o163,runtimeMask:0o00020,destination:'KEY REL lamp',sourceClass:'hardware-phase'},
    {name:'circuit',id:'AUX:CIRCUIT-WARNING',signal:237,control:'CMCWAR/LGCWAR',runtimeChannel:0o163,runtimeMask:0o00001,destination:'External CMC/LGC warning indication',sourceClass:'hardware-phase'},
    {name:'flash',id:'AUX:FLASH',signal:238,control:'FLASH',runtimeChannel:0o163,runtimeMask:0o00040,destination:'VERB/NOUN flash blanking contact',sourceClass:'hardware-phase'},
    {name:'oprerr',id:'AUX:OPR-ERR',signal:244,control:'OPRERR',runtimeChannel:0o163,runtimeMask:0o00100,destination:'OPR ERR lamp',sourceClass:'hardware-phase'},
    {name:'temp',id:'AUX:TEMP',signal:258,control:'TMPCAU',runtimeChannel:0o163,runtimeMask:0o00010,destination:'TEMP lamp',sourceClass:'hardware-phase'}
  ];
  const nonLatching=NON_LATCHING_DEFS.map((item,index)=>Object.freeze({
    type:'non-latching',
    ordinal:latching.length+index,
    packagePart:'2004689',
    packageSlot:null,
    packageSlotStatus:'interconnect-crosswalk-unresolved',
    ...item,
    runtimeChannelOctal:'0o'+item.runtimeChannel.toString(8).padStart(3,'0'),
    runtimeMaskOctal:'0o'+item.runtimeMask.toString(8).padStart(5,'0')
  }));

  const packageSlots=[];
  for(let module=1;module<=6;module++){
    for(let k=1;k<=22;k++){
      packageSlots.push(Object.freeze({
        id:`D${module}:K${k}`,
        module:`D${module}`,
        k,
        type:k<=20?'latching':'non-latching',
        packagePart:k<=20?'2004688':'2004689'
      }));
    }
  }

  if(latching.length!==120)throw new Error(`Physical DSKY latching relay topology must contain 120 packages; got ${latching.length}`);
  if(nonLatching.length!==12)throw new Error(`Physical DSKY non-latching relay topology must contain 12 packages; got ${nonLatching.length}`);
  if(packageSlots.length!==132)throw new Error(`Physical DSKY package-slot inventory must contain 132 positions; got ${packageSlots.length}`);

  const latchingByKey=new Map(latching.map(item=>[key(item.row,item.bit),item]));
  const nonLatchingByNameMap=new Map(nonLatching.map(item=>[item.name,item]));

  function latchingRelay(row,bit){return latchingByKey.get(key(row,bit))||null}
  function isLatchingRelay(row,bit){return latchingByKey.has(key(row,bit))}
  function latchingOrdinal(row,bit){const item=latchingRelay(row,bit);return item?item.ordinal:-1}
  function relayIdentity(row,bit){const item=latchingRelay(row,bit);return item?item.id:null}
  function nonLatchingRelay(name){return nonLatchingByNameMap.get(String(name))||null}
  function nonLatchingOrdinal(name){const item=nonLatchingRelay(name);return item?item.ordinal:-1}
  function nonLatchingIdentity(name){const item=nonLatchingRelay(name);return item?item.id:null}

  window.DSKY_RELAY_TOPOLOGY=Object.freeze({
    physicalRelayCount:132,
    latchingRelayCount:120,
    nonLatchingRelayCount:12,
    logicalChannel10Positions:132,
    absentLogicalPositions:Object.freeze(Array.from(ABSENT_KEYS)),
    latchingRelays:Object.freeze(latching.slice()),
    nonLatchingRelays:Object.freeze(nonLatching.slice()),
    nonLatchingNames:Object.freeze(nonLatching.map(item=>item.name)),
    packageSlots:Object.freeze(packageSlots.slice()),
    isLatchingRelay,latchingRelay,latchingOrdinal,relayIdentity,
    nonLatchingRelay,nonLatchingOrdinal,nonLatchingIdentity
  });
})();
