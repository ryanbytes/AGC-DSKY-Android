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
const optics=read('optics.js');
const tapMark=read('sextant-tap-mark.js');
const phoneIcdu=read('phone-icdu.js');

for(const marker of [
  'const NORMAL_KEY_CHANNEL = 0o15;',
  'const PROCEED_CHANNEL = 0o32;',
  'const accepted = this.writeIo(NORMAL_KEY_CHANNEL, code);',
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

for(const marker of [
  'const accepted = this.writeIo(0o16, value & 0o177);',
  'this.exports.cpu_step(1);',
  'const ERASABLE_TO_INTERRUPT_REQUESTS = 92196;',
  'const addr = erasable + ERASABLE_TO_INTERRUPT_REQUESTS + 6;',
  'bytes[addr] = 1;',
  'return this.writeIo(0o16, 0);'
]) assert(core.includes(marker),'navigation KEYRUPT2 transport path missing: '+marker);
assert(core.includes('does not raise the')&&core.includes('corresponding KEYRUPT2 request'),'navigation transport shim is not explicitly documented');

for(const marker of [
  'const MARK_BIT = 0o40;',
  'const REJECT_BIT = 0o100;',
  "document.getElementById('sxt-mark').addEventListener('click', () => navPulse(MARK_BIT))",
  "document.getElementById('sxt-reject').addEventListener('click', () => navPulse(REJECT_BIT))",
  'const ok=c.navKeyPulse(bit,90);'
]) assert(optics.includes(marker),'optics MARK/MARK REJECT authority path missing: '+marker);
for(const forbidden of ['commitRelayWord(','setChannelState(','AGCDSKY_DISPLAY'])
  assert(!optics.includes(forbidden),'optics MARK/MARK REJECT bypasses yaAGC output authority: '+forbidden);

for(const marker of [
  'NON-FLIGHT SIMULATOR AID: tap-to-mark',
  "mode:'non-flight-simulator-aid'",
  "inputPath:'screen tap -> simulated CDU pulses -> channel 016 MARK -> yaAGC'",
  'writePulses(c, SHAFT_CH, shaftCounts)',
  'writePulses(c, TRUNNION_CH, trunnionCounts)',
  'c.navKeyPulse(MARK_BIT, 90)'
]) assert(tapMark.includes(marker),'tap-to-mark provenance/path missing: '+marker);
for(const forbidden of ['commitRelayWord(','setChannelState(','AGCDSKY_DISPLAY'])
  assert(!tapMark.includes(forbidden),'tap-to-mark bypasses yaAGC and writes DSKY output directly: '+forbidden);

for(const marker of [
  'This deliberately does NOT write Noun 20, erasable memory, or DSKY fields.',
  'const CDU_CHANNEL = [0o200 | 0o32, 0o200 | 0o33, 0o200 | 0o34];',
  'const PIPA_CHANNEL = [0o200 | 0o37, 0o200 | 0o40, 0o200 | 0o41];',
  'core.writeIo(CDU_CHANNEL[axis], sign > 0 ? PCDU_FAST : MCDU_FAST)',
  'core.writeIo(PIPA_CHANNEL[axis], sign > 0 ? PINC : MINC)'
]) assert(phoneIcdu.includes(marker),'phone spacecraft-peripheral path missing: '+marker);
for(const forbidden of ['commitRelayWord(','setChannelState(','AGCDSKY_DISPLAY'])
  assert(!phoneIcdu.includes(forbidden),'phone spacecraft peripheral writes DSKY output directly: '+forbidden);

for(const marker of [
  'CHANNEL 016 → yaAGC · KEYRUPT2 WASM TRANSPORT SHIM',
  'SIMULATED SPACECRAFT PERIPHERAL · UNPROGRAMMED INCREMENTS → yaAGC',
  'SIMULATED SPACECRAFT PERIPHERAL · PINC / MINC → yaAGC',
  'SIMULATED OPTICS PERIPHERAL · CDU PULSES → yaAGC',
  'NON-FLIGHT SIM AID · SCREEN TAP → CDU PULSES + CHANNEL 016 MARK'
]) assert(diagnostics.includes(marker),'peripheral authority label missing: '+marker);

console.log('operation authority smoke: PASS');
console.log('  DSKY keys/PRO, navigation keys, and simulated spacecraft peripherals enter yaAGC; AGC channels own DSKY output; simulator aids/non-flight paths are explicitly labeled');
