#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const runtime = fs.readFileSync(path.join(ASSETS, 'runtime-transitions.js'), 'utf8');
const input = fs.readFileSync(path.join(ASSETS, 'dsky-input-runtime.js'), 'utf8');
const consumers = [
  ['clock-behavior.js', fs.readFileSync(path.join(ASSETS, 'clock-behavior.js'), 'utf8')],
  ['proceed-electrical.js', fs.readFileSync(path.join(ASSETS, 'proceed-electrical.js'), 'utf8')],
  ['keyboard-electrical-interlock.js', fs.readFileSync(path.join(ASSETS, 'keyboard-electrical-interlock.js'), 'utf8')]
];

function fail(message) {
  console.error('RUNTIME AUTHORITY SMOKE FAIL: ' + message);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}

for (const marker of [
  'const MODES = Object.freeze',
  'function status()',
  'function mode()',
  'function core()',
  'requestAgc,',
  'function onBeforeClock(handler)',
  'const clockEntryAvailable',
  'function sharedEnterClock(...args)',
  'window.enterClock = sharedEnterClock',
  'api.enterClock = sharedApiEnterClock',
  'modes:MODES',
  'mode,',
  'core,',
  'onBeforeClock,'
]) {
  assert(runtime.includes(marker), `runtime-transitions.js missing authority marker: ${marker}`);
}
assert(runtime.includes('api.appStatus()'),
  'runtime-transitions.js must remain the adapter over appStatus()');
assert(runtime.includes('api.getCore()'),
  'runtime-transitions.js must remain the adapter over getCore()');

for (const marker of [
  'const runtime = api.runtimeTransitions',
  'function keyMake(code)',
  'function keyReset(coreOverride = null)',
  'function proceed(pressed)',
  'core.keyPress(value)',
  'core.keyRelease()',
  'core.proceedKey(!!pressed)',
  'api.inputRuntime = input'
]) {
  assert(input.includes(marker), `dsky-input-runtime.js missing electrical marker: ${marker}`);
}
assert(!input.includes('api.appStatus(') && !input.includes('api.getCore('),
  'input runtime must consume runtime-transitions rather than app mode/core directly');
assert(!input.includes('window.enterClock ='),
  'input runtime must not wrap application CLOCK entry');

for (const [file, source] of consumers) {
  assert(source.includes('runtimeTransitions'), `${file} does not consume shared runtime authority`);
  assert(source.includes('inputRuntime'), `${file} does not consume shared input runtime`);
  assert(!source.includes('api.appStatus('), `${file} regained direct api.appStatus() ownership`);
  assert(!source.includes('api.getCore('), `${file} regained direct api.getCore() ownership`);
  assert(!source.includes('window.AGCDSKY.appStatus('), `${file} regained direct window.AGCDSKY.appStatus() ownership`);
  assert(!source.includes('window.AGCDSKY.getCore('), `${file} regained direct window.AGCDSKY.getCore() ownership`);
  assert(!source.includes('window.enterClock ='), `${file} regained direct CLOCK-transition wrapping`);
  for (const primitive of ['.keyPress(', '.keyRelease(', 'writeIo(0o15', '.proceedKey(']) {
    assert(!source.includes(primitive), `${file} bypasses shared input runtime with ${primitive}`);
  }
}

const proceed = consumers.find(([file]) => file === 'proceed-electrical.js')[1];
const keyboard = consumers.find(([file]) => file === 'keyboard-electrical-interlock.js')[1];
assert(proceed.includes('runtime.onBeforeClock(releaseProceed)'),
  'PRO must release through shared pre-CLOCK transition cleanup');
assert(keyboard.includes('runtime.onBeforeClock(releaseForClock)'),
  'normal keyboard must release through shared pre-CLOCK transition cleanup');

const runtimeIndex = html.indexOf('<script src="runtime-transitions.js"></script>');
const inputIndex = html.indexOf('<script src="dsky-input-runtime.js"></script>');
assert(runtimeIndex >= 0, 'runtime-transitions.js is not packaged');
assert(inputIndex > runtimeIndex, 'dsky-input-runtime.js must load after runtime-transitions.js');
for (const file of ['clock-behavior.js', 'proceed-electrical.js', 'keyboard-electrical-interlock.js']) {
  const index = html.indexOf(`<script src="${file}"`);
  assert(index > inputIndex, `${file} must load after dsky-input-runtime.js`);
}

console.log('runtime authority smoke: PASS');
console.log('  AGC/CLOCK transition ownership is centralized in runtime-transitions; channel-015/032 primitives are centralized in dsky-input-runtime');
