#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const map=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/relay-code-map.json'),'utf8'));
const physical=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/physical-relay-inventory.json'),'utf8'));
const read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error('RELAY CODE MAP FAIL: '+m)}
function bitName(bit){if(bit===10)return'B';if(bit>=5)return `C-K${bit-4}`;return `D-K${bit+1}`}

assert(map.scope.logicalChannel10Identities===132,'logical channel-010 identity count changed');
assert(map.scope.modeledNonLatchingFunctions===12,'non-latching function count must be 12');
assert(map.scope.totalLogicalAndFunctionIdentities===144,'logical/function map must contain 144 entries');
assert(map.scope.physicalLatchingIdentities===120,'physical latching count must be 120');
assert(map.scope.physicalNonLatchingIdentities===12,'physical non-latching count must be 12');
assert(map.scope.totalPhysicalRelayIdentities===132,'physical relay total must be 132');
assert(map.latchingRelays.length===132,'logical latching list must preserve all 132 row/bit positions');
assert(map.auxiliaryRelays.length===12,'non-latching list must contain 12 functions');

const all=[...map.latchingRelays,...map.auxiliaryRelays];
assert(new Set(all.map(x=>x.id)).size===144,'logical/function IDs must be unique');
assert(new Set(all.map(x=>x.ordinal)).size===144,'map ordinals must be unique');
all.slice().sort((a,b)=>a.ordinal-b.ordinal).forEach((x,i)=>assert(x.ordinal===i,`ordinal gap/mismatch at ${i}`));

for(let row=1;row<=12;row++){
  for(let bit=0;bit<=10;bit++){
    const ordinal=(row-1)*11+bit,entry=map.latchingRelays.find(x=>x.ordinal===ordinal);
    assert(entry,`missing logical row ${row} bit ${bit}`);
    const label=bitName(bit),id=`ROW-${String(row).padStart(2,'0')}:${label}`;
    assert(entry.id===id,`identity mismatch for row ${row} bit ${bit}: ${entry.id}`);
    assert(entry.row===row&&entry.bit===bit,`row/bit mismatch for ${id}`);
    assert(entry.codeLabel===label,`code label mismatch for ${id}`);
    assert(entry.maskOctal==='0o'+(1<<bit).toString(8).padStart(4,'0'),`mask mismatch for ${id}`);
  }
}

const absent=new Set(physical.absentLogicalChannel10Positions.map(x=>`${x.row}:${x.bit}`));
const populated=map.latchingRelays.filter(x=>x.physicalPopulation);
const unpopulated=map.latchingRelays.filter(x=>!x.physicalPopulation);
assert(populated.length===120,'logical map must identify exactly 120 populated latching positions');
assert(unpopulated.length===12,'logical map must identify exactly 12 unpopulated positions');
assert(new Set(populated.map(x=>x.physicalOrdinal)).size===120,'physical latching ordinals must be unique');
populated.slice().sort((a,b)=>a.physicalOrdinal-b.physicalOrdinal).forEach((x,i)=>assert(x.physicalOrdinal===i,`physical latching ordinal gap at ${i}`));
for(const e of map.latchingRelays){
  const shouldExist=!absent.has(`${e.row}:${e.bit}`);
  assert(e.physicalPopulation===shouldExist,`physical-population flag mismatch for ${e.id}`);
  if(!shouldExist)assert(e.physicalOrdinal===null&&e.physicalRoute==='NO-PHYSICAL-RELAY',`unpopulated identity still has a physical route: ${e.id}`);
}

const expectedAux=new Map(physical.nonLatchingRelays.map(x=>[x.name,x]));
for(const e of map.auxiliaryRelays){
  const p=expectedAux.get(e.name);assert(p,`unexpected non-latching function ${e.name}`);
  assert(e.id===p.id,`non-latching ID mismatch for ${e.name}`);
  assert(e.channelOctal===p.runtimeChannelOctal&&e.maskOctal===p.runtimeMaskOctal,`runtime source mismatch for ${e.name}`);
  assert(e.physicalOrdinal===p.ordinal,`physical ordinal mismatch for ${e.name}`);
}

const identity=read('relay-identity-audio.js'),display=read('agc-display-runtime.js'),hardware=read('hardware-fidelity.js'),visual=read('relay-visual-coupling.js'),matrix=read('dsky-relay-matrix.js'),clock=read('phone-clock-runtime.js'),topology=read('dsky-relay-topology.js');
for(const token of [
  'physicalRelayCount:132',
  'latchingRelayCount:120',
  'nonLatchingRelayCount:12',
  "'3:10'",
  "'12:10'"
])assert(topology.includes(token),'physical topology source contract changed: '+token);
for(const token of [
  'const LATCHING_RELAY_COUNT = topology.latchingRelayCount;',
  'const AUX_ORDER=topology.nonLatchingNames;',
  'function relayIdentity(row,bit){return topology.relayIdentity(row,bit)}'
])assert(identity.includes(token),'relay identity source contract changed: '+token);
for(const token of [
  'case 11:agcDisplayValue.prog[0]=digit(c);agcDisplayValue.prog[1]=digit(d)',
  'case 10:agcDisplayValue.verb[0]=digit(c);agcDisplayValue.verb[1]=digit(d)',
  'case 9:agcDisplayValue.noun[0]=digit(c);agcDisplayValue.noun[1]=digit(d)',
  'case 8:agcDisplayValue.r1.digits[0]=digit(d)',
  'case 3:agcDisplayValue.r2.digits[4]=digit(c);agcDisplayValue.r3.digits[0]=digit(d)'
])assert(display.includes(token),'logical display projection source contract changed: '+token);
for(const token of [
  'topology.isLatchingRelay(relay,bit)',
  "setAuxRelays({isswar:!!(word&0o00001),comp:!!(word&0o00002),uplink:!!(word&0o00004)}",
  "setAuxRelays({injseq:!!(word&0o10000),cutoff:!!(word&0o20000)}",
  'circuit:!!(word&0o00001)'
])assert(hardware.includes(token),'hardware physical/source contract changed: '+token);
assert(visual.includes('if(!topology.isLatchingRelay(row,bit))continue;'),'visual coupling no longer follows physical population');
for(const token of ['function segmentsForRelayCode(value)','if (k1) on.H = true;','if (k4) on.J = true;','if (k3) on.F = true;','if (k5) on.E = true;'])assert(matrix.includes(token),'digit matrix source contract changed: '+token);
assert(clock.includes('const CLOCK_GROUPS_VALUE=['),'clock logical relay topology source missing');

console.log('relay code map smoke: PASS');
console.log('  132 logical channel-010 positions + 12 non-latching functions mapped; physical subset is exactly 120 + 12 = 132 relay packages');
