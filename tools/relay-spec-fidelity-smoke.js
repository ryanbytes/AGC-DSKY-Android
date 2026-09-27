#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fail=m=>{throw new Error('RELAY SPEC FIDELITY FAIL: '+m)};
const req=(s,t,m)=>{if(!s.includes(t))fail(m+': missing '+t)};
const no=(s,t,m)=>{if(s.includes(t))fail(m+': forbidden '+t)};

const identity=read('app/src/main/assets/relay-identity-audio.js');
const hardware=read('app/src/main/assets/hardware-fidelity.js');
const widget=read('app/src/main/java/org/apollo/agcdsky/WidgetRelayModel.java');
const visual=read('app/src/main/assets/relay-visual-coupling.js');
const inventory=JSON.parse(read('docs/physical-relay-inventory.json'));
const crosswalk=JSON.parse(read('docs/relay-package-functional-crosswalk-2005954A-2005973.json'));
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
if(crosswalk.evidenceStatus.AGC_channel_010_address_mapping!=='open')fail('AGC logical-address join was incorrectly promoted to proven');
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
if(crosswalk.nonLatchingRelays.K21.status!=='topology_only_function_not_promoted')fail('K21 uncertainty boundary changed');
if(crosswalk.nonLatchingRelays.K22.status!=='conflicting_transcriptions')fail('K22 conflict boundary changed');

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
  if(r.packageSlot!==null)fail('unproven AGC logical-row/bit -> physical Dn/Kx package assignment was made: '+r.id);
  if(!String(r.timingBasis||'').includes('not a measured 2004688'))fail('latching timing uncertainty missing: '+r.id);
}
for(const r of inventory.nonLatchingRelays){
  if(r.packageSlot!==null)fail('unproven runtime-function -> physical Dn/K21-K22 package assignment was made: '+r.id);
  if(!String(r.timingBasis||'').includes('not a measured 2004689'))fail('non-latching timing uncertainty missing: '+r.id);
  if(r.runtimeChannelOctal==='0o163'&&!String(r.runtimeChannelStatus||'').includes('fictitious'))
    fail('yaAGC channel 0163 was not identified as fictitious effective-hardware state: '+r.id);
}

if(!/120\s+latching relays and 12 nonlatching relays/.test(evidence))fail('R-700 population evidence missing');
req(evidence,'operate time: <= 3 ms','1006282 timing evidence');
req(evidence,'operate time: <= 5 ms','1010784 timing evidence');
if(!/K22[\s\S]{0,160}(conflict|disagreement|differ)/i.test(evidence))fail('K22 unresolved evidence missing');
req(evidence,'No pseudo-random per-relay operate/release time.','anti-fabrication rule');
req(evidence,'Comanche055 flight software RELTAB emits relay-word codes 1 through 12','flight row-code evidence');
req(evidence,'thirteen banks octal 00 through 14','1965 13-bank discrepancy evidence');
req(evidence,'bank 00 is not emitted by Comanche055 RELTAB','bank-00 non-use boundary');
req(evidence,'zero unresolved K1-K20 drive endpoints','source-joined K1-K20 crosswalk evidence');

console.log('relay specification fidelity smoke: PASS');
console.log('  132 production packages + 120/12 split + 12 logical holes retained; K1-K20 D1-D6/YDI-XDI join resolves 120 latching packages; AGC row/bit -> package and K21/K22 function joins remain explicitly unresolved');
