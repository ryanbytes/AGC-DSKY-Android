'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dreamService = fs.readFileSync(path.join(root, 'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'app/src/main/assets/dream-agc.js'), 'utf8');

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Dream clock smoke: ${label} missing: ${needle}`);
}
function forbid(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Dream clock smoke: ${label} must not contain: ${needle}`);
}

// The Android system DreamService is intentionally the DSKY wall clock.
requireText(dreamService, 'index.html?dream=1&clock=1&display=1', 'DreamService wall-clock URL');
forbid(dreamService, 'index.html?dream=1&agc=1', 'DreamService AGC URL');
requireText(dreamService, 'SCREEN_ORIENTATION_FULL_SENSOR', 'four-way sensor orientation');
requireText(dreamService, 'if (window == null) return;', 'Android 17 pre-window guard');
requireText(dreamService, 'current.requestLayout()', 'rotation relayout');
requireText(dreamService, 'hideSystemBars()', 'immersive-mode restoration');

// dream-agc.js may remain packaged for development/PWA compatibility, but its
// explicit gate must make it inert for the clock DreamService URL above.
requireText(index, '<script src="dream-agc.js"></script>', 'shared dream bootstrap script');
requireText(bootstrap, "params.get('dream') === '1' && params.get('agc') === '1'", 'AGC-only bootstrap gate');

console.log('dream clock smoke: PASS');
console.log('  Android DreamService is clock mode with full-sensor rotation and Android 17 startup guards');
