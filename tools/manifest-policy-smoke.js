#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const manifest = fs.readFileSync(
    path.resolve(__dirname, '../app/src/main/AndroidManifest.xml'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(!manifest.includes('android.permission.INTERNET'),
    'manifest must not request INTERNET');
assert(manifest.includes('android.permission.ACCESS_COARSE_LOCATION'),
    'coarse location permission missing for DREAM SOLAR');
assert(manifest.includes('android.permission.ACCESS_FINE_LOCATION'),
    'fine location permission missing for WebView geolocation compatibility');
assert(manifest.includes('android:allowBackup="false"'),
    'application backup must remain disabled');
assert(manifest.includes('android:usesCleartextTraffic="false"'),
    'cleartext traffic must remain explicitly disabled');
assert(manifest.includes('android:icon="@mipmap/ic_launcher_original"'),
    'original launcher icon reference missing');
assert(manifest.includes('android:roundIcon="@mipmap/ic_launcher_original"'),
    'original round launcher icon reference missing');
assert(fs.existsSync(path.resolve(__dirname,
    '../app/src/main/res/mipmap-xxhdpi/ic_launcher_original.webp')),
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
assert(manifest.includes('android.webkit.WebView.MetricsOptOut'),
    'WebView metrics opt-out missing');
assert(!manifest.includes('android:process='),
    'Activity and DreamService must remain in the same default process');
assert(manifest.includes('android.permission.BIND_DREAM_SERVICE'),
    'DreamService bind permission missing');
assert(manifest.includes('android.service.dreams.DreamService'),
    'DreamService intent registration missing');

console.log('manifest policy smoke: PASS');
