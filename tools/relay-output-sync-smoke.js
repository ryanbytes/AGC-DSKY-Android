#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sync = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/relay-output-sync.js'), 'utf8');
const sensor = fs.readFileSync(path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java'), 'utf8');
const bridge = fs.readFileSync(path.join(ROOT, 'app/src/main/java/org/apollo/agcdsky/RelayAudioBridge.java'), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }
new vm.Script(sync, {filename: 'relay-output-sync.js'});

for (const token of [
  'const WEB_AUDIO_GUARD_MS = 120;',
  'const NATIVE_AUDIO_GUARD_DEFAULT_MS = 320;',
  'const NATIVE_AUDIO_GUARD_MIN_MS = 160;',
  'const NATIVE_AUDIO_GUARD_MAX_MS = 500;',
  "const NATIVE_AUDIO_GUARD_STORAGE_KEY = 'agcRelayPresentationGuardMs';",
  'const RELAY_SETTLE_MS = 20;',
  'const HARDWARE_PRESENTATION_CAP_MS = 120;',
  'function nativeElExtraMs()',
  'set2 = function relaySynchronizedSet2(',
  'renderAgcReg = function relaySynchronizedRenderAgcReg(',
  'window.AGCDSKY.setRelayPresentationGuardMs',
  'window.AGCDSKY.getRelayPresentationGuardMs',
  's.relayPresentationGuardTunable = true;',
  "if (property === 'baseLatency') return guardMs() / 1000;",
  "deferLamp('comp'", "deferLamp('uplink'", "deferLamp('temp'",
  "deferLamp('keyrel'", "deferLamp('oprerr'", "deferLamp('restart'",
  "deferLamp('stby'", 's.presentationVisualDelayMs = visualDelayMs()'
]) assert(sync.includes(token), `missing relay-output-sync token: ${token}`);

for (const token of [
  'const webAudioEmitTick = emitTick;', 'emitTick = function androidNativeDskyRelayClick(',
  'RelayAudioBridge.playRelay(', 'window.DSKY_RELAY_AUDIO',
  "'android-soundpool-low-latency' : 'web-audio-fallback'"
]) assert(sync.includes(token), `missing native relay override token: ${token}`);

for (const token of [
  'private RelayAudioBridge relayAudioBridge;', 'relayAudioBridge=new RelayAudioBridge(this);',
  'addJavascriptInterface(relayAudioBridge,"RelayAudioBridge")', '"RelayAudioBridge"'
]) assert(sensor.includes(token), `missing SensorMainActivity relay bridge token: ${token}`);

for (const token of [
  'AudioAttributes.FLAG_LOW_LATENCY', 'AudioAttributes.USAGE_GAME', 'new SoundPool.Builder()',
  'private void warmIfReady()', 'soundPool.play(setSample, 0f, 0f, 0, 0, 1f);',
  '@JavascriptInterface\n    public boolean isReady()', '@JavascriptInterface\n    public void playRelay(',
  'new HandlerThread("dsky-relay-audio", Process.THREAD_PRIORITY_AUDIO)'
]) assert(bridge.includes(token), `missing RelayAudioBridge low-latency token: ${token}`);

assert(sync.indexOf('decode11BeforeSync.call(this, value)') < sync.indexOf("deferLamp('comp'"),
  'channel 11 must fire relay/audio model before visible paint');
assert(sync.indexOf('decode163BeforeSync.call(this, value)') < sync.indexOf("deferLamp('temp'"),
  'channel 163 must fire relay/audio model before visible paint');
assert(sync.includes('V/N flash and EL-OFF are electronic blanking behavior'),
  'electronic blanking exception must remain explicit');

console.log('Relay output sync smoke: PASS');
console.log('  native SoundPool default: 320-ms guard + 20-ms settle => ~340-ms relay-driven paint shift');
console.log('  persisted calibration range: 160..500 ms');
console.log('  WebAudio fallback: 120-ms guard + 20-ms settle => 140-ms paint shift');
