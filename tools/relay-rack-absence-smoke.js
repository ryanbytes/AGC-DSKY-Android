#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'app/src/main/assets/index.html'),'utf8');

function assert(condition,message){if(!condition)throw new Error('RELAY RACK ABSENCE FAIL: '+message)}

for(const forbidden of [
  'id="relay-panel"',
  'relay-panel.css',
  'relay-panel.js',
  'id="relay-timing"',
  'RELAY VISUAL AUTHENTIC',
  'RELAY VISUAL STRETCHED'
]) assert(!html.includes(forbidden),`obsolete relay rack UI remains in index.html: ${forbidden}`);

assert(html.includes('<button id="relay-show">RELAY SHOW</button>'),
  'RELAY SHOW should remain available independently of the removed rack UI');
assert(html.includes('<script src="relay-visual-coupling.js"></script>'),
  'physical relay contact/audio/display coupling must remain loaded');
assert(html.includes('<script src="relay-identity-audio.js"></script>'),
  'per-relay manufactured audio identity model must remain loaded');

console.log('relay rack absence smoke: PASS');
console.log('  visual rack/timing controls removed; underlying relay simulation/audio/contact coupling retained');
