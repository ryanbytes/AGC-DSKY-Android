#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
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
assert(manifest.includes('android:icon="@mipmap/ic_launcher"'),
    'standard launcher icon reference missing');
assert(manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"'),
    'standard round launcher icon reference missing');

const res = rel => path.resolve(__dirname, '../app/src/main/res', rel);
const original = res('mipmap-xxhdpi/ic_launcher_original.png');
const expectedFiles = [
    original,
    res('mipmap-anydpi/ic_launcher.xml'),
    res('mipmap-anydpi/ic_launcher_round.xml'),
    res('mipmap-anydpi-v26/ic_launcher.xml'),
    res('mipmap-anydpi-v26/ic_launcher_round.xml'),
    res('drawable/ic_launcher_foreground.xml'),
];
for (const file of expectedFiles) {
    assert(fs.existsSync(file), `launcher resource missing: ${file}`);
}
const originalHash = crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex');
assert(originalHash === 'c82697819d541a8ed0b90bd9aacdf132685cc686953acf32229b3bfc6fd6bed5',
    `recovered launcher artwork changed: ${originalHash}`);
const foreground = fs.readFileSync(res('drawable/ic_launcher_foreground.xml'), 'utf8');
assert(foreground.includes('@mipmap/ic_launcher_original'),
    'adaptive icon foreground must use recovered original artwork');
for (const rel of ['mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml']) {
    const xml = fs.readFileSync(res(rel), 'utf8');
    assert(xml.includes('<adaptive-icon'), `${rel} must remain adaptive`);
    assert(xml.includes('@drawable/ic_launcher_foreground'),
        `${rel} must use the recovered-art foreground`);
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
