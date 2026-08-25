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
assert(manifest.includes('android.webkit.WebView.MetricsOptOut'),
    'WebView metrics opt-out missing');
assert(!manifest.includes('android:process='),
    'Activity and DreamService must remain in the same default process');
assert(manifest.includes('android.permission.BIND_DREAM_SERVICE'),
    'DreamService bind permission missing');
assert(manifest.includes('android.service.dreams.DreamService'),
    'DreamService intent registration missing');

console.log('manifest policy smoke: PASS');
