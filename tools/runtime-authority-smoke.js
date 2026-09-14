#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),ASSETS=path.join(ROOT,'app/src/main/assets');
const html=fs.readFileSync(path.join(ASSETS,'index.html'),'utf8');
const runtime=fs.readFileSync(path.join(ASSETS,'runtime-transitions.js'),'utf8');
const apiSource=fs.readFileSync(path.join(ASSETS,'agc-api-runtime.js'),'utf8');
const input=fs.readFileSync(path.join(ASSETS,'dsky-input-runtime.js'),'utf8');
const consumers=[['clock-behavior.js',fs.readFileSync(path.join(ASSETS,'clock-behavior.js'),'utf8')],['proceed-electrical.js',fs.readFileSync(path.join(ASSETS,'proceed-electrical.js'),'utf8')],['keyboard-electrical-interlock.js',fs.readFileSync(path.join(ASSETS,'keyboard-electrical-interlock.js'),'utf8')]];
function fail(m){console.error('RUNTIME AUTHORITY SMOKE FAIL: '+m);process.exit(1)}function assert(c,m){if(!c)fail(m)}
for(const marker of ['const MODES = Object.freeze','function status()','function mode()','function core()','function clockRequested()','let clockRequestPending = false','function enterAgc(reason','function enterClock(statusLabel','requestAgc,','clockRequested,','function onBeforeClock(handler)','const clockEntryAvailable','function sharedEnterClock(...args)','window.enterClock = sharedEnterClock','publicApiDelegates:true','modes:MODES','mode,','core,','onBeforeClock,'])assert(runtime.includes(marker),`runtime-transitions.js missing authority marker: ${marker}`);
assert(runtime.includes('api.appStatus()'),'runtime transitions must adapt appStatus()');assert(runtime.includes('api.getCore()'),'runtime transitions must adapt getCore()');
assert(!runtime.includes('baseApiEnterClock')&&!runtime.includes('sharedApiEnterClock')&&!runtime.includes('api.enterClock =')&&!runtime.includes('api.enterAgc ='),'transition runtime must not monkey-patch the public API facade');
for(const marker of ["const runtime=window.AGCDSKY_RUNTIME","runtime.enterAgc('public AGCDSKY.enterAgc')","runtime.enterClock(status,true,'public AGCDSKY.enterClock')"])assert(apiSource.includes(marker),`public API missing dynamic runtime delegation: ${marker}`);
for(const marker of ['const runtime = api.runtimeTransitions','function keyMake(code)','function keyReset(coreOverride = null)','function proceed(pressed)','core.keyPress(value)','core.keyRelease()','core.proceedKey(!!pressed)','api.inputRuntime = input'])assert(input.includes(marker),`dsky-input-runtime.js missing electrical marker: ${marker}`);
assert(!input.includes('api.appStatus(')&&!input.includes('api.getCore('),'input runtime must consume transition authority');
for(const [file,source] of consumers){assert(source.includes('runtimeTransitions'),`${file} does not consume shared runtime authority`);assert(source.includes('inputRuntime'),`${file} does not consume shared input runtime`);assert(source.includes('clockRequested'),`${file} does not honor pending CLOCK intent`);assert(!source.includes('api.appStatus(')&&!source.includes('api.getCore('),`${file} regained direct app mode/core ownership`);assert(!source.includes('window.enterClock ='),`${file} regained direct CLOCK wrapping`);for(const primitive of ['.keyPress(','.keyRelease(','writeIo(0o15','.proceedKey('])assert(!source.includes(primitive),`${file} bypasses shared input runtime with ${primitive}`)}
const clock=consumers.find(([f])=>f==='clock-behavior.js')[1],proceed=consumers.find(([f])=>f==='proceed-electrical.js')[1],keyboard=consumers.find(([f])=>f==='keyboard-electrical-interlock.js')[1];assert(clock.includes('transitions.onBeforeClock(cancelClockInput)'),'clock fallback cancellation hook missing');assert(proceed.includes('runtime.onBeforeClock(releaseProceed)'),'PRO pre-CLOCK release hook missing');assert(keyboard.includes('runtime.onBeforeClock(releaseForClock)'),'keyboard pre-CLOCK release hook missing');
const runtimeIndex=html.indexOf('<script src="runtime-transitions.js"></script>'),inputIndex=html.indexOf('<script src="dsky-input-runtime.js"></script>');assert(runtimeIndex>=0&&inputIndex>runtimeIndex,'runtime/input parser order changed');
console.log('runtime authority smoke: PASS');
console.log('  lifecycle base functions, stable public API delegation, centralized transition intent, and centralized channel-015/032 primitives verified');
