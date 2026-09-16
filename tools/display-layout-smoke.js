#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLE = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/style.css'), 'utf8');
const CONTROLS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/controls-layout.css'), 'utf8');
const CM = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/cm-dsky-finish.css'), 'utf8');
const HARDWARE_COLORS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/hardware-color-mode.css'), 'utf8');
const CM_MODE = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/cm-mode.js'), 'utf8');

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

close(visibleFraction, expectedVisibleFraction, 0.0001,
  'display-only visible physical-height fraction');
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

assert(!STYLE.includes('.el-field,.comp-el{filter:url(#elGlow)}'),
  'EL glow must not filter complete multi-glyph fields');
assert(STYLE.includes('.comp-el{filter:url(#elGlow)}'),
  'COMP ACTY glow must remain enabled');
assert(STYLE.includes('.el-field .el-seg.on{filter:url(#elGlow)}'),
  'numeric EL glow must be scoped to energized segments');

assert(CM.includes('Alarm/status indicator, SCD 1006387C'),
  'annunciator SCD fidelity block missing');
assert(CM.includes('background:#74756f') && CM.includes('color:#11120f'),
  'unenergized annunciator must remain neutral gray with black legend');
assert(CM.includes('font-family:"Arial Narrow","Liberation Sans Narrow","Roboto Condensed"'),
  'Gorton-condensed fallback treatment missing');
assert((CM.match(/radial-gradient\(ellipse at/g) || []).length >= 12,
  'fallback plus thermal three-source incandescent pools missing');
assert(CM.includes('lamp-hardware-ready .lamp .lamp-legend'),
  'annunciator legend foreground layer missing');
assert(CM.includes('lamp-hardware-ready .lamp .lamp-source') &&
       CM.includes('.lamp-source-1') && CM.includes('.lamp-source-2') && CM.includes('.lamp-source-3'),
  'three physical incandescent source layers missing');
assert(CM.includes('transition-duration:var(--lamp-fall,52ms)') &&
       CM.includes('transition-duration:var(--lamp-rise,36ms)'),
  'per-bulb incandescent rise/decay timing missing');
assert(CM.includes('opacity:calc(var(--integral-level) * var(--lamp-gain,1))'),
  'per-bulb integral-light brightness personality missing');
assert(CM.includes('overflow:hidden'),
  'annunciator light must be clipped to prevent inter-cell leakage');
assert(!CM.includes('box-shadow:0 0 .62vmin') && !CM.includes('box-shadow:0 0 .7vmin'),
  'legacy exterior annunciator glow must not reappear in CM finish');

assert(CM.includes('--numerics-level:1') && CM.includes('--integral-level:1'),
  'independent lighting variables missing');
assert(CM.includes('.el-field .el-seg.on{opacity:calc(.92 * var(--numerics-level))}'),
  'NUMERICS feed must scale energized EL segments only');
assert(CM.includes('color:var(--key-el-color)') && CM.includes('text-shadow:var(--key-el-shadow)'),
  'white EL key legend illumination missing');
assert(CM.includes('.key.pressed') && CM.includes('translateY(var(--key-travel,.42vmin))'),
  'mechanical key travel rendering missing');

assert(CONTROLS.includes('max-width:calc(100vw - 8px)'),
  'control strip must remain constrained to the phone viewport');
assert(CONTROLS.includes('flex-flow:row wrap'),
  'control strip must wrap on narrow portrait screens');
assert(CONTROLS.includes('max-height:30vh') && CONTROLS.includes('overflow-y:auto'),
  'portrait control strip must stay vertically bounded and scroll if necessary');
assert(CONTROLS.includes('min-width:max-content'),
  'control labels must retain enough width to avoid truncation');
assert(CONTROLS.includes('text-overflow:clip') && CONTROLS.includes('white-space:nowrap'),
  'control button labels must remain unellipsized and on one line');
assert(CONTROLS.includes('.app-controls span{display:none!important}'),
  'obsolete mode/status span must stay hidden in the flowing control strip');
assert(CONTROLS.includes('100vh - 138px') && CONTROLS.includes('100vh - 164px'),
  'DSKY sizing must reserve room for the option strip');
assert(CONTROLS.includes('@media (orientation:landscape)'),
  'control strip landscape sizing override missing');
assert(CONTROLS.includes('body.dream .app-controls,body.display-only .app-controls,body.screen-only .app-controls{display:none!important}'),
  'dream/display-only/screen-only modes must suppress app controls');
for (const marker of [
  'same black-key / white-EL visual language as the DSKY',
  'color:var(--key-el-color',
  'text-shadow:var(--key-el-shadow',
  'linear-gradient(145deg,#343532',
  'transform:translateY(2px)',
  '"Arial Narrow"'
]) {
  assert(CONTROLS.includes(marker), 'DSKY-style settings-button treatment missing: ' + marker);
}
assert(!CONTROLS.includes('Series 2 barrier-mount operator indicators'),
  'obsolete Series 2 option-button styling must not return');

for (const marker of [
  'linear-gradient(148deg,#8d9294 0%,#7c8183 30%,#6d7275 68%,#797e80 100%)',
  '.el-glass-background{fill:#4e535a!important}',
  '.el-ito-dot{fill:#91999c!important;opacity:.68!important}',
  'linear-gradient(180deg,#858a8c 0%,#7c8183 58%,#707578 100%)'
]) assert(HARDWARE_COLORS.includes(marker), 'recovered FS595 color marker missing: ' + marker);
assert(CM_MODE.includes("document.body.classList.add('spacecraft-cm')") &&
       CM_MODE.includes("document.body.classList.add('authentic-colors')"),
  'CM mode no longer enables the recovered authentic palette');
assert(CM_MODE.includes("link.href = 'hardware-color-mode.css'"),
  'CM mode no longer loads the recovered hardware palette stylesheet');
for (const forbidden of ['el-glass-back','--dsky-el-parallax-x','translate3d(calc(var(--dsky-el-parallax-x)'])
  assert(!HARDWARE_COLORS.includes(forbidden), 'color layer must not override physical glass/parallax geometry: ' + forbidden);

console.log('display/layout geometry smoke: PASS');
console.log(`  visible DSKY fraction: ${visibleFraction.toFixed(6)} (target ${expectedVisibleFraction.toFixed(6)})`);
console.log(`  vertical translation: ${translateFraction.toFixed(6)} (target ${(visibleFraction / 2).toFixed(6)})`);
console.log('  annunciators: three-source per-bulb thermal fade with foreground black legends');
console.log('  lighting: independent NUMERICS/INTEGRAL with white EL key legends');
console.log('  options: bounded DSKY-style illuminated key strip');
console.log('  recovered UI: canonical FS595 hardware palette guarded without legacy glass-motion overrides');
