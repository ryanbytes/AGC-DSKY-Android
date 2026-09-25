'use strict';

/*
 * Apollo Block II DSKY keyboard electrical specification.
 *
 * Electrical reference:
 *   - MIT/IL DSKY keyboard schematic 2005903A (VirtualAGC CAD transcription
 *     of the original Apollo drawing), module D8 / keyboard assembly 2003909.
 *   - Normal pushbuttons S1..S18 use their NO contacts to feed the five-bit
 *     diode encoder. Their NC contacts form the all-released KEYRST chain:
 *       "AND OF S1 THRU S18NC".
 *   - PRO/STBY is S19 and is electrically separate from the normal keycode
 *     matrix; the AGC interface presents PRO as channel 032 bit 020000,
 *     active low.
 *
 * The drawing defines switch/contact logic. It does not define a fixed
 * software minimum keycode hold time, so this service intentionally contains
 * no synthetic dwell interval.
 */
(() => {
  const registry = window.AGCDSKY_SERVICE_REGISTRY;
  if (!registry) throw new Error('AGC service registry unavailable');

  const rows = [
    ['S1','K','KEY REL',0o31,'11001'],
    ['S2','V','VERB',   0o21,'10001'],
    ['S3','N','NOUN',   0o37,'11111'],
    ['S4','E','ENTR',   0o34,'11100'],
    ['S5','C','CLR',    0o36,'11110'],
    ['S6','+','PLUS',   0o32,'11010'],
    ['S7','-','MINUS',  0o33,'11011'],
    ['S8','0','0',      0o20,'10000'],
    ['S9','1','1',      0o01,'00001'],
    ['S10','2','2',     0o02,'00010'],
    ['S11','3','3',     0o03,'00011'],
    ['S12','4','4',     0o04,'00100'],
    ['S13','5','5',     0o05,'00101'],
    ['S14','6','6',     0o06,'00110'],
    ['S15','7','7',     0o07,'00111'],
    ['S16','8','8',     0o10,'01000'],
    ['S17','9','9',     0o11,'01001'],
    ['S18','R','RSET',  0o22,'10010']
  ];

  const normalSwitches = Object.freeze(rows.map(([switchId,key,label,code,binary]) =>
    Object.freeze({
      switchId,key,label,code,binary,
      codeOctal:code.toString(8).padStart(2,'0'),
      makeContact:'NO',
      resetContact:'NC'
    })
  ));
  const byKey = Object.freeze(Object.fromEntries(normalSwitches.map(row => [row.key,row])));
  const keyReset = Object.freeze({
    label:'KEYRST',
    expression:'AND OF S1 THRU S18NC',
    assertedWhen:'all-normal-keys-released',
    softwareMinimumHoldMs:null
  });
  const proceed = Object.freeze({
    switchId:'S19',
    label:'PRO/STBY',
    key:'P',
    matrix:'separate',
    channel:0o32,
    mask:0o20000,
    activeLow:true,
    pressedValue:0,
    releasedValue:0o20000
  });

  const service = Object.freeze({
    source:Object.freeze({
      drawing:'2005903A',
      assembly:'2003909',
      module:'D8',
      provenance:'VirtualAGC CAD transcription of original Apollo schematic'
    }),
    normalSwitches,
    byKey,
    keyReset,
    proceed,
    verifyKeycodes(table) {
      if (!table) return false;
      return normalSwitches.every(row => table[row.key] === row.code)
        && table.P === undefined;
    }
  });

  registry.publish('AGCDSKY_KEY_ELECTRICAL_SPEC', service,
    'Block II DSKY keyboard electrical specification publication');
})();
