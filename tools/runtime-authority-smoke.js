#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const read = name => fs.readFileSync(path.join(ASSETS, name), 'utf8');
const html = read('index.html');
const runtime = read('runtime-transitions.js');
const api = read('agc-api-runtime.js');
const shell = read('app-shell-runtime.js');
const input = read('dsky-input-runtime.js');
const clock = read('clock-behavior.js');
const proceed = read('proceed-electrical.js');
const keyboard = read('keyboard-electrical-interlock.js');
const fail = message => { console.error('RUNTIME AUTHORITY SMOKE FAIL: ' + message); process.exit(1); };
const assert = (condition, message) => { if (!condition) fail(message); };

for (const marker of [
  'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
  'const lifecycle = window.AGCDSKY_LIFECYCLE;',
  'const coreSession = window.AGCDSKY_CORE_SESSION;',
  'const baseEnterAgc = lifecycle.enterAgc;',
  'const baseEnterClock = lifecycle.enterClock;',
  'function mode()', 'function core()', 'function clockRequested()',
  'function enterAgc(reason', 'function enterClock(statusLabel', 'function onBeforeClock(handler)',
  'classicTransitionGlobals:false', 'publicApiDelegates:true',
  "registry.publish('AGCDSKY_RUNTIME',runtime"
]) assert(runtime.includes(marker), `runtime transition marker missing: ${marker}`);
for (const forbidden of [
  'const api = window.AGCDSKY', 'api.lifecycle', 'api.appStatus', 'api.getCore',
  'sharedEnterAgc', 'sharedEnterClock', 'window.enterAgc', 'window.enterClock',
  'api.enterClock =', 'api.enterAgc =', 'api.runtimeTransitions ='
]) assert(!runtime.includes(forbidden), `obsolete transition ownership remains: ${forbidden}`);

for (const marker of [
  'const apiServices=Object.freeze({',
  'function lateService(name){return apiLateServiceRegistry.get(name)}',
  'window.AGCDSKY_SERVICES=apiServices;', 'services:apiServices',
  'agcChannel:apiDisplay.onChannel', 'saveAgcState:apiSnapshot.save',
  "get runtimeTransitions(){return lateService('AGCDSKY_RUNTIME')}",
  "get inputRuntime(){return lateService('AGCDSKY_INPUT')}",
  "get clockBehavior(){return lateService('AGCDSKY_CLOCK_BEHAVIOR')}",
  'apiShell.initialize(window.AGCDSKY,apiServices);'
]) assert(api.includes(marker), `public API service marker missing: ${marker}`);
for (const forbidden of [
  'get runtimeTransitions(){return window.AGCDSKY_RUNTIME',
  'get inputRuntime(){return window.AGCDSKY_INPUT',
  'get clockBehavior(){return window.AGCDSKY_CLOCK_BEHAVIOR'
]) assert(!api.includes(forbidden), `public API regained compatibility-global dependency: ${forbidden}`);

for (const marker of [
  'window.AGCDSKY_SHELL=Object.freeze({', 'function initializeAppShell(api,services)',
  'services&&services.renderer', 'services&&services.snapshot', 'api.enterAgc()', 'api.enterClock()'
]) assert(shell.includes(marker), `shell service marker missing: ${marker}`);

for (const marker of [
  'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
  "const runtime = registry.get('AGCDSKY_RUNTIME');",
  'function keyMake(code)', 'function keyReset(coreOverride = null)', 'function proceed(pressed)',
  'core.keyPress(value)', 'core.keyRelease()', 'core.proceedKey(!!pressed)',
  "registry.publish('AGCDSKY_INPUT',input"
]) assert(input.includes(marker), `input runtime marker missing: ${marker}`);
for (const forbidden of ['const api = window.AGCDSKY', 'api.runtimeTransitions', 'api.inputRuntime =', 'api.appStatus(', 'api.getCore(']) {
  assert(!input.includes(forbidden), `input runtime regained public-facade dependency: ${forbidden}`);
}

for (const marker of [
  'const registry = window.AGCDSKY_SERVICE_REGISTRY;',
  "const transitions = registry?.get('AGCDSKY_RUNTIME');",
  "const input = registry?.get('AGCDSKY_INPUT');",
  'const snapshot = window.AGCDSKY_SNAPSHOT;',
  'transitions.clockRequested()', 'transitions.onBeforeClock(cancelClockInput)',
  "snapshot.scheduleAutosave('clock keypad handoff')",
  "registry.publish('AGCDSKY_CLOCK_BEHAVIOR',clockBehavior"
]) assert(clock.includes(marker), `CLOCK authority marker missing: ${marker}`);
for (const forbidden of [
  'const api = window.AGCDSKY', 'api?.runtimeTransitions', 'api?.inputRuntime',
  'api.scheduleAgcAutosave', 'api.appStatus(', 'api.getCore('
]) assert(!clock.includes(forbidden), `CLOCK behavior regained public-facade authority: ${forbidden}`);
for (const primitive of ['.keyPress(', '.keyRelease(', 'writeIo(0o15', '.proceedKey(']) {
  assert(!clock.includes(primitive), `CLOCK behavior bypasses input runtime with ${primitive}`);
}

for (const [file, source] of [['proceed-electrical.js', proceed], ['keyboard-electrical-interlock.js', keyboard]]) {
  assert(source.includes('runtimeTransitions'), `${file} does not consume runtime authority`);
  assert(source.includes('inputRuntime'), `${file} does not consume input authority`);
  assert(source.includes('clockRequested'), `${file} does not honor pending CLOCK intent`);
  assert(!source.includes('api.appStatus(') && !source.includes('api.getCore('), `${file} regained app/core ownership`);
  for (const primitive of ['.keyPress(', '.keyRelease(', 'writeIo(0o15', '.proceedKey(']) {
    assert(!source.includes(primitive), `${file} bypasses input runtime with ${primitive}`);
  }
}

const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
const inputIndex = html.indexOf('<script src="dsky-input-runtime.js"></script>');
const clockIndex = html.indexOf('<script src="clock-behavior.js"></script>');
assert(runtimeIndex >= 0 && inputIndex > runtimeIndex && clockIndex > inputIndex, 'runtime/input/CLOCK parser order changed');
console.log('runtime authority smoke: PASS');
console.log('  lifecycle/core-session runtime, registry input/CLOCK authority, snapshot autosave ownership, stable facade getters, and centralized channel-015/032 primitives verified');
