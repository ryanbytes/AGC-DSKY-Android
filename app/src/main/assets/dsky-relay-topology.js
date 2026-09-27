'use strict';

/*
 * Block II DSKY physical relay topology.
 *
 * Physical population (production DSKY):
 *   - six interchangeable D1-D6 indicator-driver modules;
 *   - K1-K20 in each module are latching relay packages (120 total);
 *   - K21-K22 in each module are non-latching relay packages (12 total).
 *
 * Channel 010 remains an 11-bit logical relay-control word. Runtime row
 * ordinals 1..12 map to the Apollo 11 relay-word bank codes octal 01..14
 * respectively (row 8 -> bank 10, row 12 -> bank 14). Comanche055 RELTAB
 * emits these 12 codes; bank 00 from the 1965 Information Series description
 * is not emitted by the Apollo 11 flight table.
 *
 * Not every logical row/bit intersection has a physical latching relay installed.  This service
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
 * Original 2005918 signal-flow plus the source-joined 2005954A/2005973
 * package wiring now proves the complete Channel 010 logical row/bit ->
 * D1-D6/K1-K20 crosswalk for all 120 latching packages.  K21/K22 auxiliary
 * function-to-package assignment remains deliberately unresolved.
 */
(() => {
  const ABSENT_KEYS=new Set([
    '3:10',
    '8:5','8:6','8:7','8:8','8:9','8:10',
    '9:10','10:10','11:10',
    '12:9','12:10'
  ]);

  // Proven source join:
  //   Channel 010 relay-word code -> 2005918 XDI selection line
  //   OUT0 data bit logical 0/1 -> 2005918 YDI drive pair
  //   XDI/YDI pair -> 2005954A + 2005973 Dn/K package
  // See docs/relay-logical-physical-crosswalk-2005918.json.
  const PACKAGE_SLOT_BY_KEY=Object.freeze({
    '1:0':'D1:K1',
    '1:1':'D1:K2',
    '1:2':'D1:K3',
    '1:3':'D1:K4',
    '1:4':'D1:K5',
    '1:5':'D4:K1',
    '1:6':'D4:K2',
    '1:7':'D4:K3',
    '1:8':'D4:K4',
    '1:9':'D4:K5',
    '1:10':'D1:K20',
    '2:0':'D1:K6',
    '2:1':'D1:K7',
    '2:2':'D1:K8',
    '2:3':'D1:K9',
    '2:4':'D1:K10',
    '2:5':'D4:K6',
    '2:6':'D4:K7',
    '2:7':'D4:K8',
    '2:8':'D4:K9',
    '2:9':'D4:K10',
    '2:10':'D2:K20',
    '3:0':'D1:K11',
    '3:1':'D1:K12',
    '3:2':'D1:K13',
    '3:3':'D1:K14',
    '3:4':'D1:K15',
    '3:5':'D4:K11',
    '3:6':'D4:K12',
    '3:7':'D4:K13',
    '3:8':'D4:K14',
    '3:9':'D4:K15',
    '4:0':'D6:K1',
    '4:1':'D6:K2',
    '4:2':'D6:K3',
    '4:3':'D6:K4',
    '4:4':'D6:K5',
    '4:5':'D5:K1',
    '4:6':'D5:K2',
    '4:7':'D5:K3',
    '4:8':'D5:K4',
    '4:9':'D5:K5',
    '4:10':'D3:K20',
    '5:0':'D6:K6',
    '5:1':'D6:K7',
    '5:2':'D6:K8',
    '5:3':'D6:K9',
    '5:4':'D6:K10',
    '5:5':'D5:K6',
    '5:6':'D5:K7',
    '5:7':'D5:K8',
    '5:8':'D5:K9',
    '5:9':'D5:K10',
    '5:10':'D4:K20',
    '6:0':'D6:K11',
    '6:1':'D6:K12',
    '6:2':'D6:K13',
    '6:3':'D6:K14',
    '6:4':'D6:K15',
    '6:5':'D5:K11',
    '6:6':'D5:K12',
    '6:7':'D5:K13',
    '6:8':'D5:K14',
    '6:9':'D5:K15',
    '6:10':'D5:K20',
    '7:0':'D1:K17',
    '7:1':'D1:K16',
    '7:2':'D1:K18',
    '7:3':'D1:K19',
    '7:4':'D3:K19',
    '7:5':'D2:K17',
    '7:6':'D2:K16',
    '7:7':'D2:K18',
    '7:8':'D2:K19',
    '7:9':'D5:K19',
    '7:10':'D6:K20',
    '8:0':'D4:K17',
    '8:1':'D4:K16',
    '8:2':'D4:K18',
    '8:3':'D4:K19',
    '8:4':'D6:K19',
    '9:0':'D3:K1',
    '9:1':'D3:K2',
    '9:2':'D3:K3',
    '9:3':'D3:K4',
    '9:4':'D3:K5',
    '9:5':'D2:K1',
    '9:6':'D2:K2',
    '9:7':'D2:K3',
    '9:8':'D2:K4',
    '9:9':'D2:K5',
    '10:0':'D3:K6',
    '10:1':'D3:K7',
    '10:2':'D3:K8',
    '10:3':'D3:K9',
    '10:4':'D3:K10',
    '10:5':'D2:K6',
    '10:6':'D2:K7',
    '10:7':'D2:K8',
    '10:8':'D2:K9',
    '10:9':'D2:K10',
    '11:0':'D3:K11',
    '11:1':'D3:K12',
    '11:2':'D3:K13',
    '11:3':'D3:K14',
    '11:4':'D3:K15',
    '11:5':'D2:K11',
    '11:6':'D2:K12',
    '11:7':'D2:K13',
    '11:8':'D2:K14',
    '11:9':'D2:K15',
    '12:0':'D6:K17',
    '12:1':'D6:K16',
    '12:2':'D6:K18',
    '12:3':'D3:K17',
    '12:4':'D3:K16',
    '12:5':'D5:K17',
    '12:6':'D5:K16',
    '12:7':'D5:K18',
    '12:8':'D3:K18'
  });

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
        bankCode:row,
        bankCodeOctal:'0o'+row.toString(8).padStart(2,'0'),
        mask:1<<bit,
        maskOctal:'0o'+(1<<bit).toString(8).padStart(4,'0'),
        logicalLabel:bitName(bit),
        packagePart:'2004688',
        packageSlot:PACKAGE_SLOT_BY_KEY[key(row,bit)]||null,
        packageSlotStatus:'proven-source-join-2005918-2005954A-2005973'
      }));
    }
  }

  const NON_LATCHING_DEFS=[
    {name:'isswar',packageSlot:'D4:K21',id:'AUX:ISS-WARNING',signal:229,control:'ISSWAR',runtimeChannel:0o011,runtimeMask:0o00001,destination:'External ISS WARNING indication',sourceClass:'channel-command'},
    {name:'comp',packageSlot:'D4:K22',id:'AUX:COMP-ACTY',signal:230,control:'COMACT',runtimeChannel:0o011,runtimeMask:0o00002,destination:'COMP ACTY lamp',sourceClass:'channel-command'},
    {name:'stby',packageSlot:'D5:K21',id:'AUX:STBY',signal:231,control:'SBYLIT/STBY',runtimeChannel:0o163,runtimeMask:0o00400,destination:'STBY lamp',sourceClass:'hardware-phase'},
    {name:'restart',packageSlot:'D3:K21',id:'AUX:RESTART',signal:232,control:'RESTRT',runtimeChannel:0o163,runtimeMask:0o00200,destination:'RESTART lamp',sourceClass:'hardware-phase'},
    {name:'injseq',packageSlot:'D5:K22',id:'AUX:INJ-SEQ-START',signal:233,control:'S4BSEQ',runtimeChannel:0o012,runtimeMask:0o10000,destination:'External S-IVB INJ SEQ START / G HIGH indication (CM)',sourceClass:'channel-command'},
    {name:'cutoff',packageSlot:'D6:K22',id:'AUX:CUTOFF',signal:234,control:'S4BOFF',runtimeChannel:0o012,runtimeMask:0o20000,destination:'External S-IVB CUTOFF / G LOW indication (CM)',sourceClass:'channel-command'},
    {name:'uplink',packageSlot:'D3:K22',id:'AUX:UPLINK-ACTY',signal:235,control:'UPLACT',runtimeChannel:0o011,runtimeMask:0o00004,destination:'UPLINK ACTY lamp',sourceClass:'channel-command'},
    {name:'keyrel',packageSlot:'D2:K22',id:'AUX:KEY-REL',signal:236,control:'KYRLS',runtimeChannel:0o163,runtimeMask:0o00020,destination:'KEY REL lamp',sourceClass:'hardware-phase'},
    {name:'circuit',packageSlot:'D6:K21',id:'AUX:CIRCUIT-WARNING',signal:237,control:'CMCWAR/LGCWAR',runtimeChannel:0o163,runtimeMask:0o00001,destination:'External CMC/LGC warning indication',sourceClass:'hardware-phase'},
    {name:'flash',packageSlot:'D1:K22',id:'AUX:FLASH',signal:238,control:'FLASH',runtimeChannel:0o163,runtimeMask:0o00040,destination:'VERB/NOUN flash blanking contact',sourceClass:'hardware-phase'},
    {name:'oprerr',packageSlot:'D1:K21',id:'AUX:OPR-ERR',signal:244,control:'OPRERR',runtimeChannel:0o163,runtimeMask:0o00100,destination:'OPR ERR lamp',sourceClass:'hardware-phase'},
    {name:'temp',packageSlot:'D2:K21',id:'AUX:TEMP',signal:258,control:'TMPCAU',runtimeChannel:0o163,runtimeMask:0o00010,destination:'TEMP lamp',sourceClass:'hardware-phase'}
  ];
  const nonLatching=NON_LATCHING_DEFS.map((item,index)=>Object.freeze({
    type:'non-latching',
    ordinal:latching.length+index,
    packagePart:'2004689-2',
    packageSlotStatus:'proven-source-join-2005954A-2005973-drive',
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
        packagePart:k<=20?'2004688':'2004689-2'
      }));
    }
  }

  if(latching.length!==120)throw new Error(`Physical DSKY latching relay topology must contain 120 packages; got ${latching.length}`);
  if(nonLatching.length!==12)throw new Error(`Physical DSKY non-latching relay topology must contain 12 packages; got ${nonLatching.length}`);
  if(packageSlots.length!==132)throw new Error(`Physical DSKY package-slot inventory must contain 132 positions; got ${packageSlots.length}`);
  if(latching.some(item=>!/^D[1-6]:K(?:[1-9]|1[0-9]|20)$/.test(item.packageSlot||'')))throw new Error('Every latching logical identity must have a proven D1-D6/K1-K20 package slot');
  if(new Set(latching.map(item=>item.packageSlot)).size!==120)throw new Error('Latching logical-to-physical package crosswalk must be one-to-one across 120 slots');
  if(nonLatching.some(item=>!/^D[1-6]:K(?:21|22)$/.test(item.packageSlot||'')))throw new Error('Every non-latching identity must have a proven D1-D6/K21-K22 package slot');
  if(new Set(nonLatching.map(item=>item.packageSlot)).size!==12)throw new Error('Non-latching function-to-package drive crosswalk must be one-to-one across 12 slots');

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
