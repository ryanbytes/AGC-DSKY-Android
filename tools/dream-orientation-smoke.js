'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../app/src/main/java/org/apollo/agcdsky/AgcDreamService.java'),
  'utf8'
);

function requireText(needle, label) {
  if (!source.includes(needle)) throw new Error(`Dream orientation smoke: missing ${label}: ${needle}`);
}

requireText('ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR', 'all-four-way physical sensor orientation');
requireText('lp.screenOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR', 'Dream window orientation assignment');
requireText('ROTATION_ANIMATION_SEAMLESS', 'seamless rotation animation');
requireText('public void onConfigurationChanged(Configuration newConfig)', 'Dream configuration-change handling');
requireText('webView.requestLayout()', 'WebView relayout after rotation');
requireText('webView.invalidate()', 'WebView redraw after rotation');
requireText('public void onWindowFocusChanged(boolean hasFocus)', 'immersive-mode focus recovery');
requireText('if (hasFocus) hideSystemBars()', 'system bar re-hide after rotation/focus');

if (/rotate\s*\(/.test(source) || /setRotation\s*\(/.test(source)) {
  throw new Error('Dream orientation smoke: content must not be manually rotated on top of window rotation');
}

console.log('dream orientation smoke: PASS');
console.log('  full-sensor window rotation, WebView relayout, and immersive recovery verified');
