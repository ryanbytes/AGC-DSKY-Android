#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLE = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/style.css'), 'utf8');
const CONTROLS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/controls-layout.css'), 'utf8');
const CM = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/cm-dsky-finish.css'), 'utf8');
const HARDWARE_COLORS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/hardware-color-mode.css'), 'utf8');
const HARDWARE_COLOR_MODE = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/hardware-color-mode.js'), 'utf8');
const CM_MODE = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/cm-mode.js'), 'utf8');
const SCREEN_ONLY = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/screen-only.css'), 'utf8');
const SCREEN_ONLY_JS = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/screen-only.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/index.html'), 'utf8');

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

/* 1006315G full-screen EL package geometry. The SVG ratio is the active
   digital-indicator face, while the bonded 2004745 cover and the 1006315
   package remain distinct depths. */
close(106 / 182.356, 2.360 / 4.060, 0.00002,
  'screen-only SVG must retain the 1006315G nominal 2.360 x 4.060 active-face ratio');
for (const marker of [
  'const COVER_CLEAR_WIDTH_IN=2.354',
  'const COVER_VIEW_THICKNESS_IN=0.134',
  'const INDICATOR_FACE_WIDTH_IN=2.360',
  'const INDICATOR_FACE_HEIGHT_MIN_IN=4.055',
  'const INDICATOR_FACE_HEIGHT_MAX_IN=4.065',
  'const INDICATOR_PACKAGE_DEPTH_MIN_IN=0.257',
  'const INDICATOR_PACKAGE_DEPTH_MAX_IN=0.263',
  'const nextCoverDepth=coverPxPerIn*COVER_VIEW_THICKNESS_IN',
  'const nextIndicatorDepth=indicatorPxPerIn*INDICATOR_PACKAGE_DEPTH_IN',
  'const nextTotalDepth=nextCoverDepth+nextIndicatorDepth',
  "'--dsky-screen-indicator-package-depth-px'",
  "'--dsky-screen-assembly-depth-px'",
  "'--dsky-screen-indicator-back-z'",
  "indicatorBack.className='el-indicator-back'",
  'dsky.insertBefore(indicatorBack,el)',
  "window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_SCREEN_ONLY_GEOMETRY',Object.freeze({"
]) assert(SCREEN_ONLY_JS.includes(marker), '1006315 screen-only geometry missing: ' + marker);
assert(!SCREEN_ONLY_JS.includes("setProperty('--dsky-el-z'"),
  'screen-only package geometry must never repurpose package depth as EL/phosphor depth');
for (const marker of [
  '.el-indicator-back{display:none}',
  'body.screen-only.parallax-3d:not(.dream):not(.display-only) #dsky .el-indicator-back',
  'var(--dsky-screen-indicator-back-z,-17.712px)',
  'background:#454a4d!important'
]) assert(SCREEN_ONLY.includes(marker), '1006315 package-rear rendering missing: ' + marker);

const nominalCoverDepthAt106 = 106 / 2.354 * 0.134;
const nominalIndicatorDepthAt106 = 106 / 2.360 * 0.260;
const nominalTotalDepthAt106 = nominalCoverDepthAt106 + nominalIndicatorDepthAt106;
close(nominalCoverDepthAt106, 6.034, 0.002,
  '2004745 cover depth at the 106-unit reference width');
close(nominalIndicatorDepthAt106, 11.678, 0.002,
  '1006315 package depth at the 106-unit active-face reference width');
close(nominalTotalDepthAt106, 17.712, 0.003,
  'full cover-plus-indicator stack depth at the 106-unit reference width');

assert(!STYLE.includes('--el:'),
  'base style must not define a competing EL color authority');
assert(CM.includes('--el:#6decb4'),
  'CM finish must remain the single EL color authority');
assert(!STYLE.includes('#79ef4f') && !CM.includes('#79ef4f'),
  'obsolete lime EL color must not reappear');

assert(!STYLE.includes('.el-field,.comp-el{filter:url(#elGlow)}'),
  'EL glow must not filter complete multi-glyph fields');
assert(STYLE.includes('.comp-el{filter:url(#elGlow)}'),
  'COMP ACTY glow must remain enabled');
assert(STYLE.includes('.el-field .el-seg.on{filter:url(#elGlow)}'),
  'numeric EL glow must be scoped to energized segments');
assert(!STYLE.includes('.el-seg.off'),
  'unlit numeric EL segments must not have a visible style');
assert(!STYLE.includes('.comp-el:not(.on){display:none}'),
  'COMP ACTY printed legend must remain visible while de-energized');
assert(STYLE.includes('.el-comp-bg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;') &&
       STYLE.includes('.comp-el.on .el-comp-bg{\n  display:block;\n  fill:var(--el);'),
  'COMP ACTY phosphor must be absent while off and explicit while energized');
assert(STYLE.includes('.el-seg{\n  display:none;\n  fill:none;\n  stroke:none;\n  opacity:0;') &&
       STYLE.includes('.el-seg.on{\n  display:inline;\n  fill:var(--el);'),
  'numeric/sign EL must be optically absent unless explicitly energized');

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
  'linear-gradient(180deg,#858a8c 0%,#7c8183 58%,#707578 100%)',
  'radial-gradient(ellipse 23% 12%',
  'border:.045vmin solid rgba(220,232,227,.18)'
]) assert(HARDWARE_COLORS.includes(marker), 'recovered FS595/glass marker missing: ' + marker);
assert(HARDWARE_COLORS.includes('body.spacecraft-cm.screen-only:not(.dream) .el-glass-rear') &&
       HARDWARE_COLORS.includes('body.spacecraft-cm.screen-only:not(.dream) .el-glass-sheen') &&
       HARDWARE_COLORS.includes('border:0!important') &&
       HARDWARE_COLORS.includes('box-shadow:none!important'),
  'screen-only cover-glass overlays must not draw internal border/shadow seams');
assert(HTML.includes('<link rel="stylesheet" href="hardware-color-mode.css">'),
  'hardware-color-mode.css must be parser-loaded');
assert(HTML.includes('<script src="hardware-color-mode.js"></script>'),
  'hardware-color-mode.js must be parser-loaded');
assert(HARDWARE_COLOR_MODE.includes("body.classList.add('authentic-colors')"),
  'forced FS595 module no longer enables authentic colors');
assert(HARDWARE_COLOR_MODE.includes("localStorage.removeItem('dskyHardwareColorMode')"),
  'forced FS595 module no longer clears the obsolete palette preference');
assert(CM_MODE.includes("document.body.classList.add('spacecraft-cm')") &&
       !CM_MODE.includes("document.body.classList.add('authentic-colors')"),
  'CM mode must own configuration while hardware-color-mode owns the palette');
for (const forbidden of ['.el-glass-back{','.el-glass-back,','--dsky-el-parallax-x','translate3d(calc(var(--dsky-el-parallax-x)'])
  assert(!HARDWARE_COLORS.includes(forbidden), 'color layer must not override physical glass/parallax geometry: ' + forbidden);

console.log('display/layout geometry smoke: PASS');
console.log(`  visible DSKY fraction: ${visibleFraction.toFixed(6)} (target ${expectedVisibleFraction.toFixed(6)})`);
console.log(`  vertical translation: ${translateFraction.toFixed(6)} (target ${(visibleFraction / 2).toFixed(6)})`);
console.log(`  full-screen EL stack: cover ${nominalCoverDepthAt106.toFixed(3)} + 1006315 package ${nominalIndicatorDepthAt106.toFixed(3)} = ${nominalTotalDepthAt106.toFixed(3)} units at 106-wide`);
console.log('  annunciators: three-source per-bulb thermal fade with foreground black legends');
console.log('  lighting: independent NUMERICS/INTEGRAL with white EL key legends');
console.log('  options: bounded DSKY-style illuminated key strip');
console.log('  recovered UI: forced FS595/glass finish is parser-loaded while physical parallax retains motion ownership');
