#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'app/src/main/assets/dsky-relay-inventory.js'),'utf8');
function assert(c,m){if(!c)throw new Error('RELAY INVENTORY FAIL: '+m)}
const context={window:null,Object,Array,Number,String,Map,Set};context.window=context;vm.createContext(context);
new vm.Script(source,{filename:'dsky-relay-inventory.js'}).runInContext(context);
const inv=context.DSKY_RELAY_INVENTORY;
assert(inv&&Object.isFrozen(inv),'inventory service missing/mutable');
assert(inv.physicalRelayCount===132,'physical count is not 132');
assert(inv.latchingRelayCount===120,'latching count is not 120');
assert(inv.nonLatchingRelayCount===12,'non-latching count is not 12');
const expectedCounts=[11,11,10,11,11,11,11,5,10,10,10,9];
for(let row=1;row<=12;row++)assert(inv.bitsForRow(row).length===expectedCounts[row-1],`row ${row} physical count changed`);
assert(inv.matrixRelays.length===120&&inv.auxiliaryRelays.length===12,'inventory arrays do not total 132');
const ids=[...inv.matrixRelays,...inv.auxiliaryRelays].map(r=>r.id);
assert(new Set(ids).size===132,'duplicate physical relay identity');
for(const r of inv.matrixRelays){
  assert(inv.isMatrixRelay(r.row,r.bit),`listed matrix relay is not physical: ${r.id}`);
  assert(r.role&&r.part==='2004688 / 1006282',`matrix provenance/role missing: ${r.id}`);
}
const holes=[];
for(let row=1;row<=12;row++)for(let bit=0;bit<11;bit++)if(!inv.isMatrixRelay(row,bit))holes.push(`${row}:${bit}`);
assert(holes.length===12,'expected exactly 12 unpopulated channel-010 positions');
for(const key of ['3:10','8:5','8:6','8:7','8:8','8:9','8:10','9:10','10:10','11:10','12:9','12:10'])
  assert(holes.includes(key),`known unpopulated position became physical: ${key}`);
const expectedAux={
  isswarn:[0o11,0o00001],comp:[0o11,0o00002],uplink:[0o11,0o00004],
  temp:[0o163,0o00010],keyrel:[0o163,0o00020],flash:[0o163,0o00040],oprerr:[0o163,0o00100],
  injseq:[0o12,0o10000],cutoff:[0o12,0o20000],restart:[0o163,0o00200],circuit:[0o163,0o00001],stby:[0o163,0o00400]
};
for(const [name,[channel,mask]] of Object.entries(expectedAux)){
  const relay=inv.auxiliaryByName[name];assert(relay,`missing non-latching relay ${name}`);
  assert(relay.sourceChannel===channel&&relay.sourceMask===mask,`source mismatch for ${name}`);
  assert(relay.part==='2004689 / 1010784',`non-latching part provenance missing for ${name}`);
}
console.log('relay inventory smoke: PASS');
console.log('  exactly 132 physical Block II DSKY relays: 120 populated matrix positions + 12 non-latching functions; 12 nonexistent dense-matrix positions excluded');
