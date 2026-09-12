#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sync = fs.readFileSync(
  path.join(ROOT, 'app/src/main/assets/relay-output-sync.js'), 'utf8');
const sensor = fs.readFileSync(
  path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'), 'utf8');
const bridge = fs.readFileSync(
  path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/RelayAudioBridge.java'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new vm.Script(sync, {filename: 'relay-output-sync.js'});

for (const token of [
  'const WEB_AUDIO_GUARD_MS = 120;',
  'const NATIVE_AUDIO_GUARD_MS = 60;',
  'const RELAY_SETTLE_MS = 20;',
  'return nativeReady() ? NATIVE_AUDIO_GUARD_MS : WEB_AUDIO_GUARD_MS;',
  "if (property === 'baseLatency') return guardMs() / 1000;",
  "deferLamp('comp'",
  "deferLamp('uplink'",
  "deferLamp('temp'",
  "deferLamp('keyrel'",
  "deferLamp('oprerr'",
  "deferLamp('restart'",
  "deferLamp('stby'",
  's.presentationVisualDelayMs = visualDelayMs()'
]) {
  assert(sync.includes(token), `missing relay-output-sync token: ${token}`);
}

for (const token of [
  'const webAudioEmitTick = emitTick;',
  'emitTick = function androidNativeDskyRelayClick(',
  'RelayAudioBridge.playRelay(',
  'window.DSKY_RELAY_AUDIO',
  "'android-soundpool-low-latency' : 'web-audio-fallback'"
]) {
  assert(sync.includes(token), `missing native relay override token: ${token}`);
}

for (const token of [
  'private RelayAudioBridge relayAudioBridge;',
  'relayAudioBridge=new RelayAudioBridge(this);',
  'addJavascriptInterface(relayAudioBridge,"RelayAudioBridge")',
  '"RelayAudioBridge"'
]) {
  assert(sensor.includes(token), `missing SensorMainActivity relay bridge token: ${token}`);
}

for (const token of [
  'AudioAttributes.FLAG_LOW_LATENCY',
  'new SoundPool.Builder()',
  '@JavascriptInterface\n    public boolean isReady()',
  '@JavascriptInterface\n    public void playRelay(',
  'new HandlerThread("dsky-relay-audio", Process.THREAD_PRIORITY_AUDIO)'
]) {
  assert(bridge.includes(token), `missing RelayAudioBridge low-latency token: ${token}`);
}

assert(sync.indexOf('decode11BeforeSync.call(this, value)') <
       sync.indexOf("deferLamp('comp'"),
  'channel 11 must let the relay/audio model fire before restoring visible paint');
assert(sync.indexOf('decode163BeforeSync.call(this, value)') <
       sync.indexOf("deferLamp('temp'"),
  'channel 163 must let the relay/audio model fire before restoring visible paint');
assert(sync.includes('V/N flash and EL-OFF are electronic blanking behavior'),
  'electronic blanking exception must remain explicit');

console.log('Relay output sync smoke: PASS');
console.log('  native SoundPool: 60-ms guard + 20-ms settle => 80-ms relay-driven paint shift');
console.log('  WebAudio fallback: 120-ms guard + 20-ms settle => 140-ms paint shift');
