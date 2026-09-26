'use strict';

/*
 * Authoritative Block II DSKY physical relay inventory.
 *
 * Hardware basis:
 * - six D1-D6 indicator-driver modules;
 * - each module carries 20 magnetic-latching matrix relays (2004688 / 1006282)
 *   plus 2 general-purpose non-latching relays (2004689 / 1010784);
 * - total physical relays: 120 latching + 12 non-latching = 132.
 *
 * Channel 010 contains eleven relay-data bits, but not every row has eleven
 * physical latching relays.  The masks below are the actual populated matrix
 * positions; unpopulated bit positions must never generate relay motion,
 * sound, haptics, or contact bounce.
 */
(() => {
  const MATRIX_ROW_MASKS=Object.freeze({
    1:0o3777, 2:0o3777, 3:0o1777, 4:0o3777,
    5:0o3777, 6:0o3777, 7:0o3777, 8:0o0037,
    9:0o1777, 10:0o1777, 11:0o1777, 12:0o0777
  });

  const DIGIT_GROUP=Object.freeze({
    1:Object.freeze({C:'R3-D4',D:'R3-D5',B:'R3-MINUS'}),
    2:Object.freeze({C:'R3-D2',D:'R3-D3',B:'R3-PLUS'}),
    3:Object.freeze({C:'R2-D5',D:'R3-D1'}),
    4:Object.freeze({C:'R2-D3',D:'R2-D4',B:'R2-MINUS'}),
    5:Object.freeze({C:'R2-D1',D:'R2-D2',B:'R2-PLUS'}),
    6:Object.freeze({C:'R1-D4',D:'R1-D5',B:'R1-MINUS'}),
    7:Object.freeze({C:'R1-D2',D:'R1-D3',B:'R1-PLUS'}),
    8:Object.freeze({D:'R1-D1'}),
    9:Object.freeze({C:'NOUN-1',D:'NOUN-2'}),
    10:Object.freeze({C:'VERB-1',D:'VERB-2'}),
    11:Object.freeze({C:'PROG-1',D:'PROG-2'})
  });

  // Bank 14 / channel-010 row 12 has nine physical relay positions.
  // The Block II channel definition assigns the common G&N relay functions
  // below.  A specific CM/LM face may omit a legend even though the physical
  // relay position remains populated.  Bit 7 is the documented spare.
  const ROW12_ROLE=Object.freeze({
    0:'PRIO-DISP',
    1:'NO-DAP',
    2:'VEL',
    3:'NO-ATT',
    4:'ALT',
    5:'GIMBAL-LOCK',
    6:'SPARE',
    7:'TRACKER',
    8:'PROG-CAUTION'
  });

  const AUXILIARY=Object.freeze([
    Object.freeze({name:'isswarn',label:'ISS WARNING',sourceChannel:0o11,sourceMask:0o00001,effect:'spacecraft-warning',sourceKind:'direct-agc-output'}),
    Object.freeze({name:'comp',label:'COMP ACTY',sourceChannel:0o11,sourceMask:0o00002,effect:'dsky-lamp:comp',sourceKind:'direct-agc-output'}),
    Object.freeze({name:'uplink',label:'UPLINK ACTY',sourceChannel:0o11,sourceMask:0o00004,effect:'dsky-lamp:uplink',sourceKind:'direct-agc-output'}),
    Object.freeze({name:'temp',label:'TEMP',sourceChannel:0o163,sourceMask:0o00010,effect:'dsky-lamp:temp',sourceKind:'yaagc-effective-hardware'}),
    Object.freeze({name:'keyrel',label:'KEY REL',sourceChannel:0o163,sourceMask:0o00020,effect:'dsky-lamp:keyrel',sourceKind:'yaagc-effective-hardware'}),
    Object.freeze({name:'flash',label:'FLASH',sourceChannel:0o163,sourceMask:0o00040,effect:'verb-noun-flash-phase',sourceKind:'yaagc-effective-hardware'}),
    Object.freeze({name:'oprerr',label:'OPR ERR',sourceChannel:0o163,sourceMask:0o00100,effect:'dsky-lamp:oprerr',sourceKind:'yaagc-effective-hardware'}),
    Object.freeze({name:'injseq',label:'INJ SEQ START',sourceChannel:0o12,sourceMask:0o10000,effect:'spacecraft-discrete',sourceKind:'direct-agc-output'}),
    Object.freeze({name:'cutoff',label:'CUTOFF',sourceChannel:0o12,sourceMask:0o20000,effect:'spacecraft-discrete',sourceKind:'direct-agc-output'}),
    Object.freeze({name:'restart',label:'RESTART',sourceChannel:0o163,sourceMask:0o00200,effect:'dsky-lamp:restart',sourceKind:'yaagc-effective-hardware'}),
    Object.freeze({name:'circuit',label:'CIRCUIT / CGC WARNING',sourceChannel:0o163,sourceMask:0o00001,effect:'spacecraft-warning',sourceKind:'yaagc-effective-hardware'}),
    Object.freeze({name:'stby',label:'STBY',sourceChannel:0o163,sourceMask:0o00400,effect:'dsky-lamp:stby',sourceKind:'yaagc-effective-hardware'})
  ]);

  function bitName(bit){if(bit===10)return'B';if(bit>=5)return`C-K${bit-4}`;return`D-K${bit+1}`}
  function physicalMask(row){return MATRIX_ROW_MASKS[Number(row)]||0}
  function isMatrixRelay(row,bit){
    row=Number(row);bit=Number(bit);
    return row>=1&&row<=12&&bit>=0&&bit<=10&&!!(physicalMask(row)&(1<<bit));
  }
  function matrixRole(row,bit){
    row=Number(row);bit=Number(bit);if(!isMatrixRelay(row,bit))return null;
    if(row===12)return ROW12_ROLE[bit]||`BANK14-BIT${bit+1}`;
    const group=bit===10?'B':bit>=5?'C':'D',base=DIGIT_GROUP[row]&&DIGIT_GROUP[row][group];
    if(!base)return null;
    if(group==='B')return base;
    return `${base}-K${group==='C'?bit-4:bit+1}`;
  }
  function matrixIdentity(row,bit){return isMatrixRelay(row,bit)?`ROW-${String(row).padStart(2,'0')}:${bitName(bit)}`:null}
  function bitsForRow(row){const mask=physicalMask(row),out=[];for(let bit=0;bit<11;bit++)if(mask&(1<<bit))out.push(bit);return Object.freeze(out)}
  const matrixRelays=[];
  for(let row=1;row<=12;row++)for(const bit of bitsForRow(row))matrixRelays.push(Object.freeze({
    type:'latching',part:'2004688 / 1006282',row,bit,mask:1<<bit,id:matrixIdentity(row,bit),role:matrixRole(row,bit)
  }));
  const auxiliaryRelays=AUXILIARY.map((relay,index)=>Object.freeze({...relay,type:'non-latching',part:'2004689 / 1010784',ordinal:index,id:`AUX:${relay.label}`}));
  const auxByName=Object.freeze(Object.fromEntries(auxiliaryRelays.map(relay=>[relay.name,relay])));

  if(matrixRelays.length!==120)throw new Error(`Block II matrix relay inventory mismatch: ${matrixRelays.length}`);
  if(auxiliaryRelays.length!==12)throw new Error(`Block II non-latching relay inventory mismatch: ${auxiliaryRelays.length}`);

  window.DSKY_RELAY_INVENTORY=Object.freeze({
    physicalRelayCount:132,
    latchingRelayCount:120,
    nonLatchingRelayCount:12,
    matrixRowMasks:MATRIX_ROW_MASKS,
    matrixRelays:Object.freeze(matrixRelays),
    auxiliaryRelays:Object.freeze(auxiliaryRelays),
    auxiliaryNames:Object.freeze(auxiliaryRelays.map(relay=>relay.name)),
    auxiliaryByName:auxByName,
    physicalMask,
    bitsForRow,
    isMatrixRelay,
    matrixIdentity,
    matrixRole
  });
})();
