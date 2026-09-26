#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const map=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/relay-code-map.json'),'utf8'));
const read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error('RELAY CODE MAP FAIL: '+m)}
function bitName(bit){if(bit===10)return'B';if(bit>=5)return `C-K${bit-4}`;return `D-K${bit+1}`}

assert(map.scope.modeledLatchingIdentities===132,'declared latching identity count changed');
assert(map.scope.modeledAuxiliaryIdentities===8,'declared auxiliary identity count changed');
assert(map.scope.totalModeledIdentities===140,'declared total identity count changed');
assert(map.latchingRelays.length===132,'JSON latching list must contain 132 entries');
assert(map.auxiliaryRelays.length===8,'JSON auxiliary list must contain 8 entries');

const all=[...map.latchingRelays,...map.auxiliaryRelays];
assert(new Set(all.map(x=>x.id)).size===140,'relay IDs must be unique');
assert(new Set(all.map(x=>x.ordinal)).size===140,'relay ordinals must be unique');
all.slice().sort((a,b)=>a.ordinal-b.ordinal).forEach((x,i)=>assert(x.ordinal===i,`ordinal gap/mismatch at ${i}`));

for(let row=1;row<=12;row++){
  for(let bit=0;bit<=10;bit++){
    const ordinal=(row-1)*11+bit,entry=map.latchingRelays.find(x=>x.ordinal===ordinal);
    assert(entry,`missing row ${row} bit ${bit}`);
    const label=bitName(bit),id=`ROW-${String(row).padStart(2,'0')}:${label}`;
    assert(entry.id===id,`identity mismatch for row ${row} bit ${bit}: ${entry.id}`);
    assert(entry.row===row&&entry.bit===bit,`row/bit mismatch for ${id}`);
    assert(entry.codeLabel===label,`code label mismatch for ${id}`);
    assert(entry.maskOctal==='0o'+(1<<bit).toString(8).padStart(4,'0'),`mask mismatch for ${id}`);
    assert(map.routeDefinitions[entry.route],`unknown route ${entry.route} for ${id}`);
  }
}

const expectedRow={
  1:['R3 digit 4 (index 3)','R3 digit 5 (index 4)','R3 MINUS sign'],
  2:['R3 digit 2 (index 1)','R3 digit 3 (index 2)','R3 PLUS sign'],
  3:['R2 digit 5 (index 4)','R3 digit 1 (index 0)','Unrendered / mechanically modeled'],
  4:['R2 digit 3 (index 2)','R2 digit 4 (index 3)','R2 MINUS sign'],
  5:['R2 digit 1 (index 0)','R2 digit 2 (index 1)','R2 PLUS sign'],
  6:['R1 digit 4 (index 3)','R1 digit 5 (index 4)','R1 MINUS sign'],
  7:['R1 digit 2 (index 1)','R1 digit 3 (index 2)','R1 PLUS sign'],
  8:['Visually unconnected C digit bank','R1 digit 1 (index 0)','Unrendered / mechanically modeled'],
  9:['NOUN left digit','NOUN right digit','Unrendered / mechanically modeled'],
  10:['VERB left digit','VERB right digit','Unrendered / mechanically modeled'],
  11:['PROG left digit','PROG right digit','Unrendered / mechanically modeled']
};
for(const [rowText,[c,d,b]] of Object.entries(expectedRow)){
  const row=Number(rowText);
  for(let bit=0;bit<=4;bit++)assert(map.latchingRelays[(row-1)*11+bit].destination===d,`row ${row} D destination changed`);
  for(let bit=5;bit<=9;bit++)assert(map.latchingRelays[(row-1)*11+bit].destination===c,`row ${row} C destination changed`);
  assert(map.latchingRelays[(row-1)*11+10].destination===b,`row ${row} B destination changed`);
}
const expectedRow12={
  0:'Unrendered / reserved in current CM projection',
  1:'Unrendered / reserved in current CM projection',
  2:'VEL condition lamp',
  3:'NO ATT condition lamp',
  4:'ALT condition lamp',
  5:'GIMBAL LOCK condition lamp',
  6:'Unrendered / reserved in current CM projection',
  7:'TRACKER condition lamp',
  8:'PROG condition lamp',
  9:'Unrendered / reserved in current CM projection',
  10:'Unrendered / reserved in current CM projection'
};
for(const [bitText,destination] of Object.entries(expectedRow12)){
  const bit=Number(bitText),entry=map.latchingRelays[(12-1)*11+bit];
  assert(entry.destination===destination,`row 12 bit ${bit} destination changed`);
}

const expectedAux=[
  ['comp','AUX:COMP-ACTY','0o011','0o00002','COMP ACTY lamp'],
  ['uplink','AUX:UPLINK-ACTY','0o011','0o00004','UPLINK ACTY lamp'],
  ['temp','AUX:TEMP','0o163','0o00010','TEMP lamp'],
  ['keyrel','AUX:KEY-REL','0o163','0o00020','KEY REL lamp'],
  ['oprerr','AUX:OPR-ERR','0o163','0o00100','OPR ERR lamp'],
  ['flash','AUX:FLASH','0o163','0o00040',"VERB/NOUN flash blanking contact (\`vn-flash-off\`)"],
  ['restart','AUX:RESTART','0o163','0o00200','RESTART lamp'],
  ['stby','AUX:STBY','0o163','0o00400','STBY lamp']
];
expectedAux.forEach((expected,i)=>{
  const e=map.auxiliaryRelays[i];
  assert(e.ordinal===132+i,`aux ordinal mismatch at ${i}`);
  assert(e.name===expected[0]&&e.id===expected[1]&&e.channelOctal===expected[2]&&e.maskOctal===expected[3]&&e.destination===expected[4],`aux map mismatch at ${expected[0]}`);
});

const identity=read('relay-identity-audio.js'),display=read('agc-display-runtime.js'),hardware=read('hardware-fidelity.js'),matrix=read('dsky-relay-matrix.js'),clock=read('phone-clock-runtime.js');
for(const token of [
  'const LATCHING_RELAY_COUNT = 132;',
  "const AUX_ORDER=Object.freeze(['comp','uplink','temp','keyrel','oprerr','flash','restart','stby']);",
  "function bitName(bit){if(bit===10)return'B';if(bit>=5)return\`C-K\${bit-4}\`;return\`D-K\${bit+1}\`}",
  'function relayIdentity(row,bit){'
])assert(identity.includes(token),'relay identity source contract changed: '+token);
for(const token of [
  'case 11:agcDisplayValue.prog[0]=digit(c);agcDisplayValue.prog[1]=digit(d)',
  'case 10:agcDisplayValue.verb[0]=digit(c);agcDisplayValue.verb[1]=digit(d)',
  'case 9:agcDisplayValue.noun[0]=digit(c);agcDisplayValue.noun[1]=digit(d)',
  'case 8:agcDisplayValue.r1.digits[0]=digit(d)',
  'case 3:agcDisplayValue.r2.digits[4]=digit(c);agcDisplayValue.r3.digits[0]=digit(d)',
  "displayRenderer.setLamp('vel',low11&0o00004)",
  "displayRenderer.setLamp('prog',low11&0o00400)"
])assert(display.includes(token),'display projection source contract changed: '+token);
for(const token of [
  "setAuxRelays({comp:!!(word&0o00002),uplink:!!(word&0o00004)}",
  "setAuxRelays({temp:!!(word&0o00010),keyrel:!!(word&0o00020),flash:!!(word&0o00040),oprerr:!!(word&0o00100),restart:!!(word&0o00200),stby:!!(word&0o00400)}"
])assert(hardware.includes(token),'auxiliary source contract changed: '+token);
for(const token of ['function segmentsForRelayCode(value)','if (k1) on.H = true;','if (k4) on.J = true;','if (k3) on.F = true;','if (k5) on.E = true;'])assert(matrix.includes(token),'digit matrix source contract changed: '+token);
assert(clock.includes('const CLOCK_GROUPS_VALUE=['),'clock relay topology source missing');

console.log('relay code map smoke: PASS');
console.log('  132 row/bit identities + 8 auxiliary identities are unique, contiguous, destination-mapped, and synchronized with relay/display/channel source contracts');
