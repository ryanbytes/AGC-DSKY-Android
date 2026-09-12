#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'app/src/main/assets/hardware-fidelity.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  'const AUDIO_PRESENTATION_FALLBACK_MS = 35;',
  'const AUDIO_PRESENTATION_MAX_MS = 120;',
  'function audioPresentationLatencyMs()',
  'const visualDelayMs = RELAY_DRIVE_MS + presentationLagMs;',
  'audioPresentationLatencyMs: audioPresentationLatencyMs()'
]) {
  assert(source.includes(token), `missing relay-presentation token: ${token}`);
}

const fnStart = source.indexOf('function audioPresentationLatencyMs()');
const fnEnd = source.indexOf('\n  }\n', fnStart) + 5;
assert(fnStart >= 0 && fnEnd > fnStart, 'could not isolate audio latency helper');
const fn = source.slice(fnStart, fnEnd);

function latency(tickSound, audioCtx) {
  const context = {tickSound, audioCtx, Number, Math};
  vm.createContext(context);
  vm.runInContext(
    'const AUDIO_PRESENTATION_FALLBACK_MS=35; ' +
    'const AUDIO_PRESENTATION_MAX_MS=120; ' +
    fn + '; this.f=audioPresentationLatencyMs;',
    context
  );
  return context.f();
}

assert(latency(false, {baseLatency: 0.01, outputLatency: 0.02}) === 0,
  'sound-off presentation latency must be zero');
assert(Math.abs(latency(true, {baseLatency: 0.01, outputLatency: 0.02}) - 30) < 1e-9,
  'baseLatency and outputLatency must both contribute to playout compensation');
assert(latency(true, {}) === 35,
  'older WebViews without latency metrics must use the bounded fallback');
assert(latency(true, {baseLatency: 0.1, outputLatency: 0.1}) === 120,
  'presentation compensation must remain bounded');

const driveStart = source.indexOf('function beginRelayDrive');
const driveEnd = source.indexOf('\n\n\n  // Real yaAGC output', driveStart);
assert(driveStart >= 0 && driveEnd > driveStart, 'could not isolate beginRelayDrive');
const drive = source.slice(driveStart, driveEnd);
assert(drive.indexOf('hw.latches[relay] = low11') <
       drive.indexOf('applyRelayLow11(relay, low11)'),
  'physical latch state must commit before the latency-compensated visible paint');
assert(drive.includes(
  'presentationLagMs = changed && render ? audioPresentationLatencyMs() : 0'),
  'only changed rendered relay rows should receive audio presentation compensation');
assert(drive.includes('}, RELAY_DRIVE_MS);') && drive.includes('}, visualDelayMs);'),
  'electrical settle and visible presentation must remain separate timers');

const clockStart = source.indexOf('runRelayQueue = function hardwareRunRelayQueue');
const clockEnd = source.indexOf('\n\n  function flashPhaseOff', clockStart);
assert(clockStart >= 0 && clockEnd > clockStart, 'could not isolate clock relay queue');
const clock = source.slice(clockStart, clockEnd);
assert(!clock.includes('touched.forEach(renderClockReg)'),
  'clock backing state must not bypass the latency-compensated relay renderer');

console.log('Relay presentation order smoke: PASS');
console.log('  20-ms physical settle preserved; Web Audio playout latency delays only visible EL presentation');
