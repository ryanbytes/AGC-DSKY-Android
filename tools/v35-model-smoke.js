#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const shell=fs.readFileSync(path.join(ASSETS,'app-shell-runtime.js'),'utf8');
const api=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
const clock=fs.readFileSync(path.join(ASSETS,'phone-clock-runtime.js'),'utf8');
const fidelity=fs.readFileSync(path.join(ASSETS,'hardware-fidelity.js'),'utf8');
const relayAudio=fs.readFileSync(path.join(ASSETS,'relay-identity-audio.js'),'utf8');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
function assert(c,m){if(!c)throw new Error(m)}
function literal(source,name){const pattern=new RegExp('const\\s+'+name+'\\s*=\\s*(?:Object\\.freeze\\()?'+ '(\\{[\\s\\S]*?\\}|\\[[\\s\\S]*?\\])\\)?;');const match=source.match(pattern);assert(match,`could not locate ${name}`);return vm.runInNewContext('('+match[1]+')')}
const digitRelay=literal(clock,'DIGIT_RELAY_VALUE');assert(digitRelay['8']===0o35,'V35 digit 8 relay code changed');
for(const token of ['const DIGIT_RELAY_VALUE=','function v35Low11(','function executeClock(','PHONE CLOCK INPUT','V35 · REAL AGC MODE REQUIRED'])assert(!shell.includes(token)&&!api.includes(token),`non-clock runtime regained synthetic V35 ownership: ${token}`);
assert(clock.includes('const clockState=window.AGCDSKY_APP_STATE;'),'phone-clock runtime lost shared app-state binding');assert(clock.includes("compat.readonly('DIGIT_RELAY',()=>DIGIT_RELAY_VALUE)"),'legacy digit-relay access is not routed through the compatibility registry');
assert(!clock.includes('let selectedMission='),'phone-clock runtime regained private mission state');
assert(!fs.existsSync(path.join(ASSETS,'app.js')),'legacy app.js unexpectedly exists');assert(!html.includes('app-refine.js')&&!html.includes('runtime-debug.js'),'deleted patch/debug layer is loaded');
const stateRuntimeIndex=html.indexOf('<script src="app-state-runtime.js"></script>'),clockRuntimeIndex=html.indexOf('<script src="phone-clock-runtime.js"></script>'),apiIndex=html.indexOf('<script src="agc-api-runtime.js"></script>'),fidelityIndex=html.indexOf('<script src="hardware-fidelity.js"></script>');assert(stateRuntimeIndex>=0&&clockRuntimeIndex>stateRuntimeIndex&&apiIndex>clockRuntimeIndex&&fidelityIndex>apiIndex,'app-state/phone-clock/API/fidelity parser order changed');
const lowStart=clock.indexOf('function v35Low11(relay)'),lowEnd=clock.indexOf('function captureClockRelayState',lowStart);assert(lowStart>=0&&lowEnd>lowStart,'could not isolate v35Low11');const lowContext={DIGIT_RELAY_VALUE:digitRelay};vm.createContext(lowContext);vm.runInContext(clock.slice(lowStart,lowEnd)+'\nthis.v35Low11=v35Low11;',lowContext);for(const relay of [11,10,9,8,7,6,5,4,3,2,1]){const expected=[7,5,2].includes(relay)?0o3675:0o1675;assert(lowContext.v35Low11(relay)===expected,`V35 relay ${relay} low-11 changed`)}
const stateStart=clock.indexOf('function v35RelayState()'),stateEnd=clock.indexOf('function scheduleV35RelaySounds',stateStart);assert(stateStart>=0&&stateEnd>stateStart,'could not isolate v35RelayState');const stateContext={clockState:{selectedMission:'comanche055'},v35Low11:lowContext.v35Low11};vm.createContext(stateContext);vm.runInContext(clock.slice(stateStart,stateEnd)+'\nthis.v35RelayState=v35RelayState;',stateContext);const state=stateContext.v35RelayState();assert(state[12]===0o650,'Comanche V35 relay 12 changed');
assert(clock.includes('V35_ROW_MS=40,V35_TEST_MS=5000'),'clock V35 timing changed');assert(clock.includes("document.querySelectorAll('[data-lamp]').forEach(x=>x.classList.add('on'))"),'local clock lamp-test presentation changed');
for(const token of ['In AGC mode V35 is not synthesized here','const V35_HOLD_MS = 5000;','const DSKY_FLASH_QUANTUM_MS = 320;','state[12] = 0o650;','const plus = relay === 2 || relay === 5 || relay === 7;','AgcCore.prototype.start = function fidelityStart','}, 4);'])assert(fidelity.includes(token),`hardware fidelity missing ${token}`);
new vm.Script(relayAudio,{filename:'relay-identity-audio.js'});for(const token of ['const DRIVE_ENVELOPE_MS = 20;','MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS','setTravelMs','resetTravelMs','setStableMs','resetStableMs','setBounceTimesMs','resetBounceTimesMs','poleSkewUs','contactTraceFor','playContactBounce',"relayManufacturingModel = 'deterministic-per-relay-set-reset-bounce-v1'"])assert(relayAudio.includes(token),`relay manufacturing model missing ${token}`);assert(!relayAudio.includes('Math.random('),'relay manufacturing fingerprints must be persistent');assert(!relayAudio.includes('agcRelayWords['),'manufacturing layer must not publish partial contact words');assert(!relayAudio.includes('renderAgcReg(')&&!relayAudio.includes("set2('"),'manufacturing layer must not render sub-20-ms contact motion');
console.log('V35 relay model smoke: PASS');
console.log('  service-owned clock relay table/V35 model and real Comanche/yaAGC authority verified across the compatibility boundary');
