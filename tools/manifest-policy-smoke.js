#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const mainManifest = fs.readFileSync(
    path.resolve(__dirname, '../app/src/main/AndroidManifest.xml'), 'utf8');
const fireManifest = fs.readFileSync(
    path.resolve(__dirname, '../app/src/fire/AndroidManifest.xml'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(!mainManifest.includes('android.permission.INTERNET'),
    'main manifest must not request INTERNET');
assert(!fireManifest.includes('android.permission.INTERNET'),
    'fire manifest must not request INTERNET');
assert(mainManifest.includes('android.permission.ACCESS_COARSE_LOCATION'),
    'coarse location permission missing for DREAM SOLAR');
assert(mainManifest.includes('android.permission.ACCESS_FINE_LOCATION'),
    'fine location permission missing for WebView geolocation compatibility');
assert(mainManifest.includes('android:allowBackup="false"'),
    'application backup must remain disabled');
assert(mainManifest.includes('android:usesCleartextTraffic="false"'),
    'cleartext traffic must remain explicitly disabled');
assert(mainManifest.includes('android:icon="@mipmap/ic_launcher_original"'),
    'original launcher icon reference missing');
assert(mainManifest.includes('android:roundIcon="@mipmap/ic_launcher_original"'),
    'original round launcher icon reference missing');
assert(fs.existsSync(path.resolve(__dirname,
    '../app/src/main/res/mipmap-xxhdpi/ic_launcher_original.png')),
    'recovered original launcher bitmap missing');
for (const rel of [
    '../app/src/main/res/mipmap-anydpi/ic_launcher.xml',
    '../app/src/main/res/mipmap-anydpi/ic_launcher_round.xml',
    '../app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
    '../app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
    '../app/src/main/res/drawable/ic_launcher_foreground.xml']) {
  assert(!fs.existsSync(path.resolve(__dirname, rel)),
      `superseded generic launcher resource must stay removed: ${rel}`);
}
assert(mainManifest.includes('android.webkit.WebView.MetricsOptOut'),
    'WebView metrics opt-out missing');
assert(!mainManifest.includes('android:process='),
    'Activity and DreamService must remain in the same default process');
assert(mainManifest.includes('android.permission.BIND_DREAM_SERVICE'),
    'DreamService bind permission missing');
assert(mainManifest.includes('android.service.dreams.DreamService'),
    'DreamService intent registration missing');
assert(mainManifest.includes('android.intent.category.HOME'),
    'standard Android HOME registration missing');

assert(!mainManifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),
    'Play/main manifest must not contain Fire boot permission');
assert(!mainManifest.includes('FireRedirectAccessibilityService'),
    'Play/main manifest must not contain Fire accessibility service');
assert(fireManifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),
    'Fire manifest boot permission missing');
assert(fireManifest.includes('FireRedirectAccessibilityService'),
    'Fire accessibility redirect missing');
assert(fireManifest.includes('android.permission.BIND_ACCESSIBILITY_SERVICE'),
    'Fire accessibility bind permission missing');
assert(fireManifest.includes('android.accessibilityservice.AccessibilityService'),
    'Fire accessibility service intent registration missing');

console.log('manifest policy smoke: PASS');
