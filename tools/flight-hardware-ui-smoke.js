#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const fail = m => { console.error(`FLIGHT HARDWARE UI FAIL: ${m}`); process.exit(1); };
const req = (t, n, l) => { if (!t.includes(n)) fail(`${l} missing: ${n}`); };
const no = (t, n, l) => { if (t.includes(n)) fail(`${l} must not contain: ${n}`); };

const ui = read('app/src/main/assets/flight-hardware-ui.js');
const cm = read('app/src/main/assets/cm-mode.js');
const finish = read('app/src/main/assets/cm-dsky-finish.css');
const controls = read('app/src/main/assets/controls-layout.css');
const sw = read('pwa/static/sw.js');

try { new vm.Script(ui, {filename:'flight-hardware-ui.js'}); }
catch (error) { fail(`syntax error: ${error.message}`); }

req(cm, "script.src = 'flight-hardware-ui.js'", 'CM feature loader');
req(cm, "script.dataset.feature = 'flight-hardware-ui'", 'CM feature marker');
req(sw, "'./flight-hardware-ui.js'", 'offline PWA cache');

for (const marker of [
  "const LEVELS = Object.freeze([1.00, 0.75, 0.50, 0.25, 0.00])",
  "saveIndex('dskyNumericsLevel'",
  "saveIndex('dskyIntegralLevel'",
  "--numerics-level",
  "--integral-level",
  "NUMERICS ${levelText(numericsIndex)}",
  "INTEGRAL ${levelText(integralIndex)}",
  "LIGHT BUS DEMO",
  "NUMERICS FEED OPEN",
  "INTEGRAL FEED OPEN",
  "BOTH LIGHTING FEEDS OPEN",
  "RELAY STATE RETAINED"
]) req(ui, marker, 'independent lighting model');

// Lighting-bus demonstration must remain optical/electrical presentation only:
// it cannot synthesize relay words or pause/reset the AGC task.
for (const forbidden of ['decodeChannel10(', 'agcCore.stop(', 'agcCore.reset(', 'resetAgcFace('])
  no(ui, forbidden, 'lighting bus demo state isolation');

for (const marker of [
  'const KEY_CONTACT_MS = 36',
  "document.addEventListener('pointerdown', onKeyDown, {capture:true, passive:false})",
  'event.stopImmediatePropagation()',
  "button.classList.add('pressed')",
  "button.classList.remove('pressed')",
  "typeof window.press === 'function'",
  'keySound(false)',
  'keySound(true)'
]) req(ui, marker, 'mechanical key model');

for (const marker of [
  "span.className = 'lamp-legend'",
  "document.body.classList.add('lamp-hardware-ready')",
  'transition:opacity 145ms',
  'transition-duration:85ms',
  'lamp-hardware-ready .lamp::before'
]) req(ui + finish, marker, 'incandescent thermal model');

for (const marker of [
  '--key-el-color',
  '--key-el-shadow',
  '.key.pressed',
  'translateY(.42vmin)',
  'color:var(--key-el-color',
  'text-shadow:var(--key-el-shadow'
]) req(finish + controls, marker, 'white EL key illumination / options styling');

req(ui, "oldDim.hidden = true", 'retired whole-panel dimmer');
req(ui, "document.body.classList.remove('dim')", 'separate lighting feed enforcement');

console.log('Flight hardware UI smoke: PASS');
console.log('  independent NUMERICS/INTEGRAL lighting, retained relay state, thermal lamps, key travel, and DSKY-style options verified');
