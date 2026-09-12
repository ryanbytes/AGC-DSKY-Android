#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sync = fs.readFileSync(
  path.join(ROOT, 'app/src/main/assets/relay-output-sync.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

new vm.Script(sync, {filename: 'relay-output-sync.js'});

for (const token of [
  'const PRESENTATION_AUDIO_MS = 120;',
  'const RELAY_SETTLE_MS = 20;',
  'const VISUAL_DELAY_MS = RELAY_SETTLE_MS + PRESENTATION_AUDIO_MS;',
  "if (property === 'baseLatency') return PRESENTATION_AUDIO_MS / 1000;",
  "deferChangedLamp('comp'",
  "deferChangedLamp('uplink'",
  "deferChangedLamp('temp'",
  "deferChangedLamp('keyrel'",
  "deferChangedLamp('oprerr'",
  "deferChangedLamp('restart'",
  "deferChangedLamp('stby'",
  'presentationVisualDelayMs = VISUAL_DELAY_MS'
]) {
  assert(sync.includes(token), `missing relay-output-sync token: ${token}`);
}

assert(sync.indexOf('decode11BeforeSync.call(this, value)') <
       sync.indexOf("deferChangedLamp('comp'"),
  'channel 11 must let the relay/audio model fire before restoring visible paint');
assert(sync.indexOf('decode163BeforeSync.call(this, value)') <
       sync.indexOf("deferChangedLamp('temp'"),
  'channel 163 must let the relay/audio model fire before restoring visible paint');
assert(sync.includes('V/N flash and EL-OFF are deliberately not restored'),
  'electronic blanking exception must remain explicit');

console.log('Relay output sync smoke: PASS');
console.log('  120-ms Android audio guard + 20-ms relay settle => 140-ms relay-driven paint shift');
