#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const {installServiceRegistry}=require('./test-service-registry');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const keycodes=fs.readFileSync(path.join(ASSETS,'dsky-keycodes.js'),'utf8');
const specSource=fs.readFileSync(path.join(ASSETS,'key-electrical-spec.js'),'utf8');
const interlock=fs.readFileSync(path.join(ASSETS,'keyboard-electrical-interlock.js'),'utf8');
const core=fs.readFileSync(path.join(ASSETS,'agc-core.js'),'utf8');
const assert=(c,m)=>{if(!c)throw new Error(m)};

for(const marker of [
  "drawing:'2005903A'",
  "assembly:'2003909'",
  "module:'D8'",
  "expression:'AND OF S1 THRU S18NC'",
  "softwareMinimumHoldMs:null",
  "switchId:'S19'",
  "channel:0o32",
  "mask:0o20000",
  "activeLow:true",
  "registry.publish('AGCDSKY_KEY_ELECTRICAL_SPEC'"
])assert(specSource.includes(marker),'electrical spec missing: '+marker);

const expected=[
 ['S1','K',0o31],['S2','V',0o21],['S3','N',0o37],['S4','E',0o34],['S5','C',0o36],
 ['S6','+',0o32],['S7','-',0o33],['S8','0',0o20],['S9','1',0o01],['S10','2',0o02],
 ['S11','3',0o03],['S12','4',0o04],['S13','5',0o05],['S14','6',0o06],['S15','7',0o07],
 ['S16','8',0o10],['S17','9',0o11],['S18','R',0o22]
];

const context={console,window:null};context.window=context;
const registry=installServiceRegistry(context);
vm.createContext(context);
vm.runInContext(keycodes,context,{filename:'dsky-keycodes.js'});
vm.runInContext(specSource,context,{filename:'key-electrical-spec.js'});
const spec=registry.get('AGCDSKY_KEY_ELECTRICAL_SPEC');
assert(spec&&Object.isFrozen(spec),'electrical spec service missing/mutable');
assert(spec.normalSwitches.length===18,'normal switch count != 18');
for(let i=0;i<expected.length;i++){
  const [switchId,key,code]=expected[i],row=spec.normalSwitches[i];
  assert(row.switchId===switchId&&row.key===key&&row.code===code,
    'switch mapping mismatch at '+switchId);
  assert(row.makeContact==='NO'&&row.resetContact==='NC',
    switchId+' contact roles changed');
}
assert(spec.verifyKeycodes(context.AGCDSKY_KEY_CODES),'shared keycode table disagrees with 2005903A mapping');
assert(context.AGCDSKY_KEY_CODES.P===undefined,'PRO must not be in normal keycode table');
assert(spec.keyReset.assertedWhen==='all-normal-keys-released','KEYRST all-released condition changed');
assert(spec.keyReset.softwareMinimumHoldMs===null,'synthetic KEYRST dwell reintroduced');
assert(spec.proceed.switchId==='S19'&&spec.proceed.matrix==='separate','PRO/STBY S19 separation changed');
assert(spec.proceed.pressedValue===0&&spec.proceed.releasedValue===0o20000,'PRO active-low levels changed');

for(const forbidden of ['MIN_KEYCODE_HOLD_MS','keyResetTimer','keyResetPending','minKeycodeHoldMs'])
  assert(!interlock.includes(forbidden),'interlock retained synthetic KEYRST dwell state: '+forbidden);
assert(interlock.includes('if (!allNormalKeysReleased()) return;'),'interlock lost all-released KEYRST gate');
assert(interlock.includes('ELECTRICAL_SPEC.keyReset.expression'),'interlock diagnostics lost source-backed KEYRST expression');
assert(core.includes('if (pending && this.inputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK) !== pending'),
  'core lost pending-make transport flush before direct KEYRST clear');
assert(core.includes('return this.setInputChannelBits(NORMAL_KEY_CHANNEL, NORMAL_KEY_MASK, 0);'),
  'core lost non-KEYRUPT channel-015 release');

console.log('key electrical spec smoke: PASS');
console.log('  2005903A S1-S18 NO keycode matrix, S1-S18 NC KEYRST chain, separate S19 PRO/STBY, no synthetic KEYRST dwell, and transport-safe core release verified');
