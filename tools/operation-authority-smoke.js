#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const read=n=>fs.readFileSync(path.join(ASSETS,n),'utf8');
function assert(c,m){if(!c)throw new Error(m)}

const core=read('agc-core.js');
const input=read('dsky-input-runtime.js');
const keyboard=read('keyboard-electrical-interlock.js');
const proceed=read('proceed-electrical.js');
const lifecycle=read('agc-lifecycle-runtime.js');
const display=read('agc-display-runtime.js');
const hardware=read('hardware-fidelity.js');
const visual=read('relay-visual-coupling.js');
const clock=read('phone-clock-runtime.js');
const diagnostics=read('diagnostics.js');
const relayShow=read('relay-show.js');

for(const marker of [
  'const NORMAL_KEY_CHANNEL = 0o15;',
  'const PROCEED_CHANNEL = 0o32;',
  'return this.writeIo(NORMAL_KEY_CHANNEL, code);',
  'return this.writeIo(PROCEED_CHANNEL, pressed ? 0 : PROCEED_MASK);',
  'this.onChannelUpdate(channel, value);'
]) assert(core.includes(marker),'AGC core authority path missing: '+marker);

for(const marker of [
  "currentMode !== runtime.modes.AGC",
  "const core = currentCore('DSKY key make');",
  'return core.keyPress(value);',
  'return core.keyRelease();',
  "const core = currentCore('DSKY PRO contact');",
  'return core.proceedKey(!!pressed);'
]) assert(input.includes(marker),'DSKY input authority path missing: '+marker);

assert(keyboard.includes('input.keyMake(code)'),'normal key electrical path does not feed AGC input service');
assert(keyboard.includes('input.keyReset('),'normal key electrical path does not restore KEYRST');
for(const forbidden of ['AGCDSKY_DISPLAY','commitRelayWord(','setChannelState(','renderer.setLamp(','renderer.set2(','renderer.setReg('])
  assert(!keyboard.includes(forbidden),'normal keyboard bypasses AGC and writes display/hardware directly: '+forbidden);

assert(proceed.includes('input.proceed(true)')&&proceed.includes('input.proceed(false)'),'PRO does not use AGC input service');
for(const forbidden of ['AGCDSKY_DISPLAY','commitRelayWord(','setChannelState(','renderer.setLamp('])
  assert(!proceed.includes(forbidden),'PRO bypasses AGC and writes output directly: '+forbidden);

assert(lifecycle.includes("new AgcCore({onChannelUpdate:lifecycleDisplay.onChannel"),'AGC core output is not wired to display channel authority');
assert(lifecycle.includes("await lifecycleCore.core.load({wasmUrl:'yaAGC.wasm',ropeUrl:selected.rope})"),'AGC lifecycle no longer loads yaAGC plus selected rope');

for(const marker of [
  "if(channel===0o10)decode10Slot.get()(value)",
  "else if(channel===0o11)decode11Slot.get()(value)",
  "else if(channel===0o13)decode13Slot.get()(value)",
  "else if(channel===0o163)decode163Slot.get()(value)"
]) assert(display.includes(marker),'AGC output channel route missing: '+marker);

assert(hardware.includes("display.installImplementation('decodeChannel10',hardwareDecodeChannel10"),'hardware model not attached to AGC channel 010 decode');
assert(hardware.includes("display.installImplementation('decodeChannel11',hardwareDecodeChannel11"),'hardware model not attached to AGC channel 011 decode');
assert(hardware.includes("display.installImplementation('decodeChannel163',hardwareDecodeChannel163"),'hardware model not attached to AGC channel 0163 decode');
for(const forbidden of ['hardwareLampTest','scheduleSyntheticRows','scheduleSyntheticFlash','state[12]=0o650',"clock.installImplementation('lampTest'"])
  assert(!hardware.includes(forbidden),'hardware layer regained synthetic flight operation: '+forbidden);

assert(visual.includes("const baseDecodeChannel10=display.implementation('decodeChannel10')"),'relay presentation lost underlying AGC output decoder');
assert(visual.includes('return baseDecodeChannel10(value);'),'relay presentation no longer forwards the original AGC channel word');

assert(clock.includes("throw new Error('V35 is an AGC/Comanche operation; PHONE CLOCK cannot synthesize it')"),
  'PHONE CLOCK can synthesize V35 again');
for(const forbidden of ['function v35Low11(','function v35RelayState(','scheduleV35RelaySounds','V35_TEST_MS'])
  assert(!clock.includes(forbidden),'PHONE CLOCK retained synthetic V35 machinery: '+forbidden);

assert(diagnostics.includes("section('OPERATION AUTHORITY')"),'diagnostics does not expose operation provenance');
for(const marker of [
  'CHANNEL 015 → yaAGC / COMANCHE',
  'CHANNEL 032 ACTIVE-LOW → yaAGC / COMANCHE',
  'yaAGC → CHANNELS 010 / 011 / 013 / 0163 → HARDWARE / DISPLAY',
  'PHONE CLOCK\',\'NON-FLIGHT',
  'Relay Show\',\'NON-FLIGHT',
  'NO SYNTHETIC AGC DISPLAY OUTPUT'
]) assert(diagnostics.includes(marker),'diagnostics authority label missing: '+marker);
assert(!/startDskyTest[\s\S]{0,1200}(?:keyMake|keyReset|writeIo|lampTest)/.test(diagnostics),
  'diagnostics V35 injects AGC inputs or display state instead of remaining user-driven');

assert(relayShow.includes('presentation choreography over the same physical relay service'),'Relay Show lost explicit presentation-only classification');
assert(relayShow.includes("showState.mode='relay-show'"),'Relay Show no longer isolates itself from AGC mode');

console.log('operation authority smoke: PASS');
console.log('  normal keys and PRO enter yaAGC; AGC output channels own the DSKY; PHONE CLOCK, Relay Show, and diagnostics are explicitly non-flight and cannot synthesize V35');
