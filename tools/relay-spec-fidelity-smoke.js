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
const inventory=JSON.parse(read('docs/physical-relay-inventory.json'));
const evidence=read('docs/relay-fidelity-evidence.md');

if(inventory.scope.physicalRelayPackages!==132)fail('physical package total is not 132');
if(inventory.scope.latchingRelayPackages!==120)fail('latching package total is not 120');
if(inventory.scope.nonLatchingRelayPackages!==12)fail('non-latching package total is not 12');
if(inventory.scope.unpopulatedLogicalChannel10Positions!==12)fail('logical holes are not exactly 12');
if(inventory.latchingRelays.length!==120)fail('latching inventory length is not 120');
if(inventory.nonLatchingRelays.length!==12)fail('non-latching inventory length is not 12');
if(inventory.packageSlots.length!==132)fail('package-slot inventory length is not 132');

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

for(const r of inventory.latchingRelays){
  if(r.packageSlot!==null)fail('unproven latching Dn/Kx crosswalk was assigned: '+r.id);
  if(!String(r.timingBasis||'').includes('not a measured 2004688'))fail('latching timing uncertainty missing: '+r.id);
}
for(const r of inventory.nonLatchingRelays){
  if(r.packageSlot!==null)fail('unproven non-latching Dn/Kx crosswalk was assigned: '+r.id);
  if(!String(r.timingBasis||'').includes('not a measured 2004689'))fail('non-latching timing uncertainty missing: '+r.id);
  if(r.runtimeChannelOctal==='0o163'&&!String(r.runtimeChannelStatus||'').includes('fictitious'))
    fail('yaAGC channel 0163 was not identified as fictitious effective-hardware state: '+r.id);
}

req(evidence,'120 latching relays and 12 nonlatching relays','R-700 population evidence');
req(evidence,'operate time: <= 3 ms','1006282 timing evidence');
req(evidence,'operate time: <= 5 ms','1010784 timing evidence');
req(evidence,'K22 differs','K22 unresolved evidence');
req(evidence,'No pseudo-random per-relay operate/release time.','anti-fabrication rule');

console.log('relay specification fidelity smoke: PASS');
console.log('  132 production packages + 120/12 split + 12 logical holes retained; per-relay timing/bounce/skew fabrication removed; later production timing and Dn/Kx crosswalk remain explicitly unresolved');
