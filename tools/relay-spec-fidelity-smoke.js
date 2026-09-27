#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fail=m=>{throw new Error('RELAY SPEC FIDELITY FAIL: '+m)};
const req=(s,t,m)=>{if(!s.includes(t))fail(m+': missing '+t)};
const no=(s,t,m)=>{if(s.includes(t))fail(m+': forbidden '+t)};

const identity=read('app/src/main/assets/relay-identity-audio.js');
const topology=read('app/src/main/assets/dsky-relay-topology.js');
const hardware=read('app/src/main/assets/hardware-fidelity.js');
const widget=read('app/src/main/java/org/apollo/agcdsky/WidgetRelayModel.java');
const visual=read('app/src/main/assets/relay-visual-coupling.js');
const inventory=JSON.parse(read('docs/physical-relay-inventory.json'));
const crosswalk=JSON.parse(read('docs/relay-package-functional-crosswalk-2005954A-2005973.json'));
const logicalCrosswalk=JSON.parse(read('docs/relay-logical-physical-crosswalk-2005918.json'));
const evidence=read('docs/relay-fidelity-evidence.md');

if(inventory.scope.physicalRelayPackages!==132)fail('physical package total is not 132');
if(inventory.scope.latchingRelayPackages!==120)fail('latching package total is not 120');
if(inventory.scope.nonLatchingRelayPackages!==12)fail('non-latching package total is not 12');
if(inventory.scope.unpopulatedLogicalChannel10Positions!==12)fail('logical holes are not exactly 12');
if(inventory.latchingRelays.length!==120)fail('latching inventory length is not 120');
if(inventory.nonLatchingRelays.length!==12)fail('non-latching inventory length is not 12');
if(inventory.packageSlots.length!==132)fail('package-slot inventory length is not 132');

if(crosswalk.validation.modules!==6)fail('crosswalk module count is not 6');
if(crosswalk.validation.latchingRelaysPerModule!==20)fail('crosswalk latching relays/module is not 20');
if(crosswalk.validation.latchingPackagesResolved!==120)fail('crosswalk does not resolve all 120 latching packages');
if(crosswalk.validation.unresolvedK1K20Endpoints!==0)fail('crosswalk has unresolved K1-K20 drive endpoints');
if(crosswalk.evidenceStatus.K1_K20!=='proven_by_join')fail('K1-K20 crosswalk is not marked source-joined/proven');
if(crosswalk.evidenceStatus.K21_K22!=='proven_drive_function_mapping_design_basis')fail('K21/K22 drive-function crosswalk is not marked source-joined/proven');
if(crosswalk.evidenceStatus.AGC_channel_010_address_mapping!=='proven_by_2005918_join')fail('AGC logical-address join is not linked to the 2005918 proof');
if(crosswalk.validation.nonLatchingPackagesResolved!==12)fail('crosswalk does not resolve all 12 non-latching package drives');
if(crosswalk.validation.unresolvedK21K22DriveFunctions!==0)fail('crosswalk has unresolved K21/K22 drive functions');
if(crosswalk.validation.uniqueNonLatchingFunctions!==12)fail('crosswalk does not contain 12 unique non-latching functions');
let crosswalkCount=0;
for(let d=1;d<=6;d++){
  const module=crosswalk.modules['D'+d];
  if(!module)fail('missing D'+d+' crosswalk module');
  const slots=Object.keys(module.relays||{});
  if(slots.length!==20)fail('D'+d+' does not contain exactly K1-K20');
  for(let k=1;k<=20;k++){
    const relay=module.relays['K'+k];
    if(!relay)fail('missing D'+d+'/K'+k+' crosswalk');
    if(relay.status!=='proven_from_2005954A_plus_2005973')fail('unproven crosswalk status D'+d+'/K'+k);
    if(!Array.isArray(relay.directYdiSignals)||relay.directYdiSignals.length!==2||relay.directYdiSignals.some(x=>!/^YDI\d{2}$/.test(x)))
      fail('invalid YDI drive labels D'+d+'/K'+k);
    if(!/^XDI\d{2}$/.test(relay.steeredXdiSignal||''))fail('invalid XDI common label D'+d+'/K'+k);
    for(const coilName of ['coilA','coilB']){
      const coil=relay[coilName];
      if(!coil||!Array.isArray(coil.externalPath)||coil.externalPath.length!==2)fail('invalid '+coilName+' path D'+d+'/K'+k);
      if(coil.externalPath.some(x=>!Number.isInteger(x.moduleTerminal)||!x.signal||!x.connection))
        fail('incomplete '+coilName+' external path D'+d+'/K'+k);
    }
    crosswalkCount++;
  }
}
if(crosswalkCount!==120)fail('crosswalk enumeration did not total 120 packages');
if(crosswalk.nonLatchingRelays.K21.status!=='functional_drive_mapping_proven')fail('K21 drive mapping is not proven');
if(crosswalk.nonLatchingRelays.K22.status!=='functional_drive_mapping_proven_contact_conflict_preserved')fail('K22 drive mapping/contact-conflict boundary changed');
const auxMappings=crosswalk.nonLatchingFunctionalMappings||[];
if(auxMappings.length!==12)fail('non-latching crosswalk does not contain 12 package mappings');
if(new Set(auxMappings.map(x=>x.packageSlot)).size!==12)fail('non-latching crosswalk reuses a package slot');
if(new Set(auxMappings.map(x=>x.function)).size!==12)fail('non-latching crosswalk reuses a function');
for(const m of auxMappings){
  if(!/^D[1-6]:K(?:21|22)$/.test(m.packageSlot||''))fail('invalid non-latching package slot '+m.packageSlot);
  if(m.installedRelayPart!=='2004689-2')fail('non-latching mapping does not identify production 2004689-2: '+m.packageSlot);
  if(m.status!=='proven_design_basis_drive_join')fail('non-latching mapping status not proven: '+m.packageSlot);
  if(m.packageSlot.endsWith(':K22')){
    if(m.moduleInputTerminal!==85||m.driverTransistor!=='Q12'||m.moduleReturnTerminal!==87||m.relayDriveTerminal!==4)
      fail('K22 drive path mismatch: '+m.packageSlot);
  }else{
    if(m.moduleInputTerminal!==86||m.driverTransistor!=='Q13'||m.moduleReturnTerminal!==95||m.relayDriveTerminal!==7)
      fail('K21 drive path mismatch: '+m.packageSlot);
  }
  if(JSON.stringify(m.relayCoilPins)!=='[1,5]'||m.relayCommonTerminal!==26)
    fail('2004689-2 drive-pin/common path mismatch: '+m.packageSlot);
}

if(logicalCrosswalk.status!=='proven_for_all_120_latching_packages')fail('logical/physical crosswalk is not marked proven');
if(logicalCrosswalk.validation.logicalPositions!==132)fail('logical/physical crosswalk does not cover 132 row/bit positions');
if(logicalCrosswalk.validation.mappedPhysicalPackages!==120)fail('logical/physical crosswalk does not map exactly 120 packages');
if(logicalCrosswalk.validation.unpopulatedPositions!==12)fail('logical/physical crosswalk does not preserve exactly 12 holes');
if(logicalCrosswalk.validation.ambiguousMatches!==0)fail('logical/physical crosswalk has ambiguous matches');
if(logicalCrosswalk.validation.uniqueMappedPackageSlots!==120)fail('logical/physical crosswalk reuses a physical package');
const expectedHoles=['3:10','8:5','8:6','8:7','8:8','8:9','8:10','9:10','10:10','11:10','12:9','12:10'];
const sourceHoles=logicalCrosswalk.unpopulatedPositions.map(x=>x.row+':'+x.runtimeBit);
if(JSON.stringify([...sourceHoles].sort())!==JSON.stringify([...expectedHoles].sort()))fail('2005918-derived holes differ from runtime physical-population holes');
const logicalMap=new Map(logicalCrosswalk.mappings.map(x=>[x.row+':'+x.runtimeBit,x]));
if(logicalMap.size!==120)fail('logical/physical crosswalk mapping keys are not unique');
for(const m of logicalCrosswalk.mappings){
  if(!/^D[1-6]:K(?:[1-9]|1[0-9]|20)$/.test(m.packageSlot||''))fail('invalid latching package slot '+m.packageSlot);
  req(topology,`'${m.row}:${m.runtimeBit}':'${m.packageSlot}'`,`runtime package map ${m.row}:${m.runtimeBit}`);
}

req(identity,'const LATCHING_PRESENTATION_REFERENCE_MS = 3;','web latching timing reference');
req(identity,'const NON_LATCHING_PRESENTATION_REFERENCE_MS = 5;','web non-latching timing reference');
req(identity,'production-2004688-exact-timing-unresolved','web 2004688 uncertainty');
req(identity,'production-2004689-exact-timing-unresolved','web 2004689 uncertainty');
req(identity,'setBounceTimesMs:Object.freeze([])','web fabricated bounce suppression');
req(identity,'resetBounceTimesMs:Object.freeze([])','web fabricated bounce suppression');
req(identity,'poleSkewUs:0','web fabricated pole skew suppression');
no(identity,'manufacturingProfile(','synthetic web manufacturing timing');
no(identity,'positionPhase','synthetic web per-ordinal timing');
no(identity,'serialOffset=','synthetic web per-relay acoustic offset');
no(identity,'SET_TRAVEL_MIN_MS','old synthetic set range');
no(identity,'RESET_TRAVEL_MIN_MS','old synthetic reset range');

req(hardware,'const LATCHING_PRESENTATION_REFERENCE_MS=3;','hardware timing reference');
req(hardware,'Array(11).fill(LATCHING_PRESENTATION_REFERENCE_MS)','hardware per-bit timing uniformity');
no(hardware,'[6.2,11.7,8.4,13.6','old fabricated hardware settle table');

req(widget,'static final double LATCHING_PRESENTATION_REFERENCE_MS = 3.0;','widget timing reference');
req(widget,'new double[0], new double[0], 0','widget fabricated bounce/skew suppression');
no(widget,'XorShift32','widget synthetic timing RNG');
no(widget,'bouncePattern(','widget synthetic bounce generator');
no(widget,'SET_TRAVEL_MIN_MS','widget old synthetic timing range');

req(visual,"RELAY VISUAL SOURCE-BOUNDED",'relay visual user-facing timing label');
req(visual,'sourceBoundedTiming:true','relay visual source-bounded diagnostic');
req(visual,'exactProductionRelayTiming:false','relay visual production timing uncertainty');
req(visual,'authenticTiming:false','relay visual must not claim exact Apollo timing');
req(visual,'contactBounceVisible:false','relay visual must not claim unmeasured bounce');
no(visual,'Authentic manufactured per-relay travel/contact timing','old false relay timing claim');
no(visual,"contactBounceVisible:true",'old false visible-bounce claim');
no(visual,"authenticTiming:true",'old false exact-timing claim');

for(const r of inventory.latchingRelays){
  const m=logicalMap.get(r.row+':'+r.bit);
  if(!m)fail('documented latching identity lacks proven logical/physical mapping: '+r.id);
  if(r.packageSlot!==m.packageSlot)fail('documented package slot differs from 2005918 source join: '+r.id);
  if(r.packageSlotStatus!=='proven-source-join-2005918-2005954A-2005973')fail('documented package slot status not proven: '+r.id);
  if(!String(r.timingBasis||'').includes('not a measured 2004688'))fail('latching timing uncertainty missing: '+r.id);
}
if(new Set(inventory.latchingRelays.map(r=>r.packageSlot)).size!==120)fail('documented latching package slots are not one-to-one');
const auxBySignal=new Map(auxMappings.map(m=>[Number((String(m.externalSignal).match(/\d+/)||[])[0]),m]));
for(const r of inventory.nonLatchingRelays){
  const m=auxBySignal.get(Number(r.signal));
  if(!m)fail('non-latching inventory signal has no proven package mapping: '+r.id);
  if(r.packageSlot!==m.packageSlot)fail('non-latching inventory package differs from source join: '+r.id);
  if(!/^D[1-6]:K(?:21|22)$/.test(r.packageSlot||''))fail('invalid non-latching inventory package slot: '+r.id);
  if(r.packagePart!=='2004689-2')fail('non-latching inventory part is not 2004689-2: '+r.id);
  if(r.packageSlotStatus!=='proven-source-join-2005954A-2005973-drive')fail('non-latching package status not proven: '+r.id);
  req(topology,`packageSlot:'${r.packageSlot}'`,`runtime auxiliary package map ${r.id}`);
  if(!String(r.timingBasis||'').includes('not a measured 2004689'))fail('non-latching timing uncertainty missing: '+r.id);
  if(r.runtimeChannelOctal==='0o163'&&!String(r.runtimeChannelStatus||'').includes('fictitious'))
    fail('yaAGC channel 0163 was not identified as fictitious effective-hardware state: '+r.id);
}
if(new Set(inventory.nonLatchingRelays.map(r=>r.packageSlot)).size!==12)fail('documented non-latching package slots are not one-to-one');

if(!/120\s+latching relays and 12 nonlatching relays/.test(evidence))fail('R-700 population evidence missing');
req(evidence,'operate time: <= 3 ms','1006282 timing evidence');
req(evidence,'operate time: <= 5 ms','1010784 timing evidence');
if(!/K22[\s\S]{0,160}(conflict|disagreement|differ)/i.test(evidence))fail('K22 unresolved evidence missing');
req(evidence,'No pseudo-random per-relay operate/release time.','anti-fabrication rule');
req(evidence,'Comanche055 flight software RELTAB emits relay-word codes 1 through 12','flight row-code evidence');
req(evidence,'thirteen banks octal 00 through 14','1965 13-bank discrepancy evidence');
req(evidence,'bank 00 is not emitted by Comanche055 RELTAB','bank-00 non-use boundary');
req(evidence,'120 installed latching positions','source-joined K1-K20 population evidence');
req(evidence,'120 unique physical-package matches, 12 unpopulated logical positions','2005918 logical/physical join evidence');
req(evidence,'zero ambiguous matches','2005918 zero-ambiguity evidence');
req(evidence,'All 12 K21/K22 function drives are now source-joined','non-latching source-joined drive evidence');
req(evidence,'2004689-2','production non-latching relay dash evidence');
req(evidence,'positive voltage is applied on pin 1','production non-latching relay drive-pin evidence');
req(evidence,'D1: K22 FLASH; K21 OPR ERROR.','D1 non-latching function mapping evidence');
req(evidence,'D6: K22 CUTOFF; K21 CIRCUIT.','D6 non-latching function mapping evidence');
req(evidence,'remaining dispute is K22 switched-contact wiring','K22 contact-vs-drive boundary evidence');

console.log('relay specification fidelity smoke: PASS');
console.log('  132 production packages + 120/12 split + 12 logical holes retained; all 120 latching and all 12 non-latching function identities source-map one-to-one to D1-D6 package slots; exact production timing and the K22 switched-contact conflict remain bounded');
