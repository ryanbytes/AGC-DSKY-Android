#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error('PHYSICAL RELAY AUDIT FAIL: '+m)}

const context={window:{}};vm.createContext(context);
vm.runInContext(read('dsky-relay-topology.js'),context,{filename:'dsky-relay-topology.js'});
const topo=context.window.DSKY_RELAY_TOPOLOGY;
assert(topo,'topology service missing');
assert(topo.physicalRelayCount===132,'physical total must be 132');
assert(topo.latchingRelayCount===120,'latching total must be 120');
assert(topo.nonLatchingRelayCount===12,'non-latching total must be 12');
assert(topo.latchingRelays.length===120,'runtime latching list must contain 120');
assert(topo.nonLatchingRelays.length===12,'runtime non-latching list must contain 12');
assert(topo.packageSlots.length===132,'package-slot list must contain 132');
assert(new Set(topo.packageSlots.map(x=>x.id)).size===132,'package slots must be unique');
assert(topo.packageSlots.filter(x=>x.type==='latching').length===120,'package slots must contain 120 latching K1-K20 positions');
assert(topo.packageSlots.filter(x=>x.type==='non-latching').length===12,'package slots must contain 12 non-latching K21-K22 positions');

const absent=['3:10','8:5','8:6','8:7','8:8','8:9','8:10','9:10','10:10','11:10','12:9','12:10'];
assert(topo.absentLogicalPositions.length===12,'exactly 12 logical channel-010 positions must be unpopulated');
for(const key of absent){const [row,bit]=key.split(':').map(Number);assert(!topo.isLatchingRelay(row,bit),'unpopulated logical position modeled as physical: '+key)}
for(let row=1;row<=12;row++)for(let bit=0;bit<=10;bit++){
  const shouldExist=!absent.includes(row+':'+bit);
  assert(topo.isLatchingRelay(row,bit)===shouldExist,`physical population mismatch row ${row} bit ${bit}`);
  const relay=topo.latchingRelay(row,bit);
  if(relay){
    assert(relay.bankCode===row,`bank code mismatch row ${row} bit ${bit}`);
    assert(relay.bankCodeOctal==='0o'+row.toString(8).padStart(2,'0'),`octal bank code mismatch row ${row} bit ${bit}`);
  }
}
assert(topo.latchingRelays.every(x=>x.bankCode>=1&&x.bankCode<=12),'flight topology must use relay-word codes 1..12 only');
assert(!topo.latchingRelays.some(x=>x.bankCode===0),'bank 00 must not appear in Apollo 11 flight topology');

const expectedAux={
  isswar:['AUX:ISS-WARNING','0o011','0o00001'],
  comp:['AUX:COMP-ACTY','0o011','0o00002'],
  stby:['AUX:STBY','0o163','0o00400'],
  restart:['AUX:RESTART','0o163','0o00200'],
  injseq:['AUX:INJ-SEQ-START','0o012','0o10000'],
  cutoff:['AUX:CUTOFF','0o012','0o20000'],
  uplink:['AUX:UPLINK-ACTY','0o011','0o00004'],
  keyrel:['AUX:KEY-REL','0o163','0o00020'],
  circuit:['AUX:CIRCUIT-WARNING','0o163','0o00001'],
  flash:['AUX:FLASH','0o163','0o00040'],
  oprerr:['AUX:OPR-ERR','0o163','0o00100'],
  temp:['AUX:TEMP','0o163','0o00010']
};
assert(new Set(topo.nonLatchingRelays.map(x=>x.name)).size===12,'non-latching function names must be unique');
for(const [name,[id,ch,mask]] of Object.entries(expectedAux)){
  const e=topo.nonLatchingRelay(name);assert(e,'missing non-latching relay '+name);
  assert(e.id===id&&e.runtimeChannelOctal===ch&&e.runtimeMaskOctal===mask,'source mapping mismatch for '+name);
}

const json=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/physical-relay-inventory.json'),'utf8'));
assert(json.packageSlots.length===132,'documented package-slot inventory must contain 132');
assert(json.latchingRelays.length===120,'documented latching inventory must contain 120');
assert(json.nonLatchingRelays.length===12,'documented non-latching inventory must contain 12');
assert(json.scope.logicalRelayWordRows===12,'documented flight relay-word row count must be 12');
assert(json.scope.logicalRelayWordBankCodesOctal==='01 through 14 (octal), corresponding to decimal row ordinals 1 through 12','documented flight bank-code range changed');
assert(json.latchingRelays.every(x=>x.bankCode===x.row&&x.bankCodeOctal==='0o'+x.row.toString(8).padStart(2,'0')),'documented latching bank-code identities must match flight row ordinals');
assert(new Set([...json.latchingRelays,...json.nonLatchingRelays].map(x=>x.id)).size===132,'documented modeled physical identities must be unique');
const requiredCoverage=['functionalEffect','functionalStatus','spareStatus','contactPath','timingModel','timingEvidence','soundCoupling','hapticCoupling','renderOrExternalEffect'];
for(const relay of [...json.latchingRelays,...json.nonLatchingRelays]){
  for(const field of requiredCoverage)assert(typeof relay[field]==='string'&&relay[field].trim().length>0,`physical identity ${relay.id} missing audit coverage field ${field}`);
}
assert(json.scope.functionalIdentityCoverage.coveredIdentities===132,'all 132 physical functional identities must have complete fidelity coverage');
assert(json.latchingRelays.filter(x=>x.spareStatus==='not-claimed-spare-without-interconnect-proof').length===3,'three populated bank-14 relays with unresolved current visible consumers must not be falsely labeled spare');

const hardware=read('hardware-fidelity.js'),visual=read('relay-visual-coupling.js'),identity=read('relay-identity-audio.js'),display=read('agc-display-runtime.js'),index=read('index.html');
for(const token of [
  'topology.isLatchingRelay(relay,bit)',
  'setAuxRelays({isswar:!!(word&0o00001),comp:!!(word&0o00002),uplink:!!(word&0o00004)}',
  'setAuxRelays({injseq:!!(word&0o10000),cutoff:!!(word&0o20000)}',
  'circuit:!!(word&0o00001)',
  "display.registerChannelHandler(0o12,hardwareDecodeChannel12,'hardware non-latching relays')"
])assert(hardware.includes(token),'hardware physical/source contract missing: '+token);
assert(visual.includes('if(!topology.isLatchingRelay(row,bit))continue;'),'relay presentation does not suppress unpopulated positions');
for(const token of [
  'const LATCHING_RELAY_COUNT = topology.latchingRelayCount;',
  'const AUX_ORDER=topology.nonLatchingNames;',
  'if(!topology.isLatchingRelay(row,bit))return false;',
  'Array.from({length:11},(_,bit)=>{if(!topology.isLatchingRelay(rowIndex+1,bit))return null;'
])assert(identity.includes(token),'identity/audio physical contract missing: '+token);
assert(display.includes('function registerChannelHandler('),'display output router cannot forward channel 012');
assert(index.includes('<script src="dsky-relay-topology.js"></script>'),'topology asset not loaded');

console.log('physical relay audit smoke: PASS');
console.log('  120 populated latching + 12 real non-latching functions = 132 physical identities; 12 nonexistent logical positions suppressed');
