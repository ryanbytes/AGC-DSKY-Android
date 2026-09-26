#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

const clock=read('phone-clock-runtime.js');
const fidelity=read('hardware-fidelity.js');
const diagnostics=read('diagnostics.js');
const relayAudio=read('relay-identity-audio.js');
const driver=fs.readFileSync(path.join(ROOT,'tools/device-v35-smoke.js'),'utf8');
const html=read('index.html');

new vm.Script(clock,{filename:'phone-clock-runtime.js'});
new vm.Script(fidelity,{filename:'hardware-fidelity.js'});
new vm.Script(diagnostics,{filename:'diagnostics.js'});
new vm.Script(relayAudio,{filename:'relay-identity-audio.js'});

for(const forbidden of [
  'function v35Low11(','function v35RelayState(','scheduleV35RelaySounds',
  'V35_ROW_MS','V35_TEST_MS',"querySelectorAll('[data-lamp]')"
]) assert(!clock.includes(forbidden),'PHONE CLOCK retained synthetic V35 machinery: '+forbidden);
assert(clock.includes("throw new Error('V35 is an AGC/Comanche operation; PHONE CLOCK cannot synthesize it')"),
  'PHONE CLOCK must reject V35 explicitly');

for(const forbidden of [
  'hardwareLampTest','scheduleSyntheticRows','scheduleSyntheticFlash','applySyntheticFlash',
  'v35Token','v35Flash','v35Direct','V35_HOLD_MS','DSKY_FLASH_QUANTUM_MS',
  'clock.installImplementation(\'lampTest\''
]) assert(!fidelity.includes(forbidden),'hardware layer retained synthetic V35 machinery: '+forbidden);
assert(fidelity.includes('V35 is never synthesized here'),'hardware V35 authority statement missing');
assert(fidelity.includes("clock.installImplementation('runQueue'"),'normal clock relay queue hook missing');
assert(!fidelity.includes('state[12]=0o650'),'hardware layer must not manufacture Comanche V35 relay-12 state');

for(const marker of [
  "appState.mode!=='agc'","USE THE DSKY KEYS: VERB 3 5 ENTR",
  "REAL V35 · CLOSE AND KEY V 3 5 ENTR"
]) assert(diagnostics.includes(marker),'diagnostics real-V35 boundary missing: '+marker);
assert(!/startDskyTest[\s\S]{0,1200}(?:keyMake|keyReset|writeIo|lampTest)/.test(diagnostics),
  'diagnostics must not inject V35 or synthesize its outputs');

for(const marker of [
  "mission === 'comanche055'","keySequence(cdp, ['V','3','7','E','0','0','E']",
  "keySequence(cdp, ['V','3','5','E']",'12:0o0650',
  'pointer input -> yaAGC/Comanche055 -> raw channels/hardware latches -> DSKY'
]) assert(driver.includes(marker),'device V35 proof path missing: '+marker);

for(const token of [
  'const DRIVE_ENVELOPE_MS = 20;','MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS',
  'setTravelMs','resetTravelMs','setStableMs','resetStableMs','setBounceTimesMs','resetBounceTimesMs',
  'poleSkewUs','contactTraceFor','deterministic-per-relay-set-reset-bounce-v1'
]) assert(relayAudio.includes(token),'relay manufacturing model missing '+token);
assert(!relayAudio.includes('Math.random('),'relay manufacturing fingerprints must remain deterministic');

const clockIndex=html.indexOf('<script src="phone-clock-runtime.js"></script>');
const apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>');
const fidelityIndex=html.indexOf('<script src="hardware-fidelity.js"></script>');
assert(clockIndex>=0&&apiIndex>clockIndex&&fidelityIndex>apiIndex,'clock/API/hardware parser order changed');

console.log('V35 authority smoke: PASS');
console.log('  V35 has one authority: user DSKY input -> yaAGC/Comanche055 -> real output channels; PHONE CLOCK and hardware helpers cannot synthesize it');
