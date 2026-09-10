#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const manifest = fs.readFileSync(
    path.resolve(__dirname, '../app/src/main/AndroidManifest.xml'), 'utf8');
const fireManifest = fs.readFileSync(
    path.resolve(__dirname, '../app/src/fire/AndroidManifest.xml'), 'utf8');

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

const sensorActivity = manifest.match(
    /<activity\s[^>]*android:name="\.SensorMainActivity"[^>]*>([\s\S]*?)<\/activity>/);
assert(sensorActivity, 'SensorMainActivity declaration missing');
const sensorDeclaration = sensorActivity[0];
assert(/android:exported="true"/.test(sensorDeclaration),
    'SensorMainActivity must be exported for launcher and HOME intents');
const intentFilters = [...sensorDeclaration.matchAll(
    /<intent-filter>([\s\S]*?)<\/intent-filter>/g)].map(match => match[1]);
assert(intentFilters.some(filter =>
    filter.includes('android.intent.action.MAIN') &&
    filter.includes('android.intent.category.LAUNCHER')),
    'SensorMainActivity regular MAIN/LAUNCHER filter missing');
assert(intentFilters.some(filter =>
    filter.includes('android.intent.action.MAIN') &&
    filter.includes('android.intent.category.HOME') &&
    filter.includes('android.intent.category.DEFAULT')),
    'SensorMainActivity MAIN/HOME/DEFAULT filter missing');
assert(!manifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),
    'regular/main manifest must not contain Fire boot permission');
assert(!manifest.includes('FireRedirectAccessibilityService'),
    'regular/main manifest must not contain Fire redirect service');
assert(!fireManifest.includes('android.permission.INTERNET'),
    'Fire manifest must not request INTERNET');
assert(fireManifest.includes('android.permission.RECEIVE_BOOT_COMPLETED'),
    'Fire manifest boot permission missing');
assert(fireManifest.includes('FireRedirectAccessibilityService'),
    'Fire manifest redirect service missing');
assert(fireManifest.includes('android.permission.BIND_ACCESSIBILITY_SERVICE'),
    'Fire redirect bind permission missing');
assert(fireManifest.includes('android.accessibilityservice.AccessibilityService'),
    'Fire accessibility service intent registration missing');
assert(fireManifest.includes('FireBootReceiver'),
    'Fire boot receiver missing');

console.log('manifest policy smoke: PASS');
