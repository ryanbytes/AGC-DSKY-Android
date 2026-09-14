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
requireText('WebView current = webView;', 'race-safe WebView snapshot during configuration change');
requireText('current.requestLayout()', 'WebView relayout after rotation');
requireText('current.invalidate()', 'WebView redraw after rotation');
requireText('public void onWindowFocusChanged(boolean hasFocus)', 'immersive-mode focus recovery');
requireText('if (hasFocus) hideSystemBars()', 'system bar re-hide after rotation/focus');

// Android may dispatch onConfigurationChanged while DreamService is still being
// launched, before DreamService.getWindow() returns a real window. Every helper
// callable from that path must explicitly tolerate the unattached state.
const nullWindowGuards = (source.match(/Window window = getWindow\(\);\s*if \(window == null\) return;/g) || []).length;
if (nullWindowGuards < 3) {
  throw new Error(`Dream orientation smoke: expected null-window guards in orientation, system-bar and brightness helpers; found ${nullWindowGuards}`);
}
requireText('if (lp == null) return;', 'defensive window-layout-params guard');
requireText('if (decor == null) return;', 'legacy decor-view null guard');

if (/rotate\s*\(/.test(source) || /setRotation\s*\(/.test(source)) {
  throw new Error('Dream orientation smoke: content must not be manually rotated on top of window rotation');
}

console.log('dream orientation smoke: PASS');
console.log('  full-sensor rotation, early-callback null safety, WebView relayout, and immersive recovery verified');
