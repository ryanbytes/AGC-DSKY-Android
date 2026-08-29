#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLE = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/style.css'), 'utf8');
const CONTROLS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/controls-layout.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance,
    `${label}: got ${actual}, expected ${expected} ± ${tolerance}`);
}

assert(STYLE.includes('aspect-ratio:320/372'),
  'DSKY physical aspect ratio must remain 320/372');
assert(STYLE.includes('calc(100vh * 320 / 220)'),
  'display-only viewport scaling must remain based on the 320x220 upper DSKY crop');

const displayBlock = STYLE.match(/body\.display-only \.dsky\{([\s\S]*?)\n\}/);
assert(displayBlock, 'display-only DSKY CSS block missing');

const clip = displayBlock[1].match(/clip-path:inset\(0 0 ([0-9.]+)% 0\)/);
const translate = displayBlock[1].match(/transform:translate\(-50%,-([0-9.]+)%\)/);
assert(clip, 'display-only lower crop percentage missing');
assert(translate, 'display-only vertical centering translation missing');

const clippedBottom = Number(clip[1]) / 100;
const visibleFraction = 1 - clippedBottom;
const translateFraction = Number(translate[1]) / 100;
const expectedVisibleFraction = 220 / 372;

// The display-only presentation intentionally shows the physical DSKY from
// y=0 through the keyboard boundary at y=220 in the 320x372 normalized drawing.
close(visibleFraction, expectedVisibleFraction, 0.0001,
  'display-only visible physical-height fraction');

// The full element remains 372 units high and clip-path only changes what is
// visible. Moving it upward by half the visible fraction centers the 220-unit
// visible section on the viewport rather than centering the hidden full unit.
close(translateFraction, visibleFraction / 2, 0.0001,
  'display-only vertical centering translation');

assert(/body\.display-only \.app-controls[^\n]*display:none!important/.test(STYLE),
  'display-only mode must hide app controls');
assert(/body\.display-only[^\n]*\.key[^\n]*display:none!important/.test(STYLE),
  'display-only mode must hide keypad keys');
assert(STYLE.includes('body.dream.display-only .dsky'),
  'DreamService display-only drift rule missing');
assert(STYLE.includes('@media (orientation:landscape)'),
  'landscape layout override missing');
assert(STYLE.match(/calc\(100vh \* 320 \/ 220\)/g)?.length >= 2,
  'display-only 320x220 scaling must be preserved in base and landscape rules');

assert(CONTROLS.includes('max-width:calc(100vw - 12px)'),
  'hidden control strip must remain constrained to the phone viewport');
assert(CONTROLS.includes('flex-wrap:wrap'),
  'hidden control strip must wrap on narrow portrait screens');
assert(CONTROLS.includes('flex:1 0 100%'),
  'mode/status text must retain its own wrapped row');
assert(CONTROLS.includes('text-overflow:ellipsis'),
  'mode/status text must not force controls beyond the viewport');

console.log('display/layout geometry smoke: PASS');
console.log(`  visible DSKY fraction: ${visibleFraction.toFixed(6)} (target ${expectedVisibleFraction.toFixed(6)})`);
console.log(`  vertical translation: ${translateFraction.toFixed(6)} (target ${(visibleFraction / 2).toFixed(6)})`);
