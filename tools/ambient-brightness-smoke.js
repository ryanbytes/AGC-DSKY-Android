#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const controller = read('app/src/main/java/org/apollo/agcdsky/AmbientBrightnessController.java');
const activity = read('app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');
const manifest = read('app/src/main/AndroidManifest.xml');
const html = read('app/src/main/assets/index.html');
const frontend = read('app/src/main/assets/ambient-brightness.js');

assert(controller.includes('Sensor.TYPE_LIGHT'), 'native controller must use Android TYPE_LIGHT');
assert(controller.includes('SensorManager.SENSOR_DELAY_NORMAL'), 'light sensor must run at a low-rate normal delay');
assert(controller.includes('params.screenBrightness = clamped'), 'ambient control must drive native window brightness');
assert(controller.includes('params.screenBrightness = -1.0f'), 'disabling/pausing must restore Android system brightness');
assert(controller.includes('Math.log10(clampedLux + 1.0) / Math.log10(1001.0)'), 'lux mapping must retain logarithmic PWA-parity curve');
assert(controller.includes('MIN_BRIGHTNESS = 0.20f'), 'dark-room brightness floor must remain 20%');
assert(controller.includes('FACTOR_KEEP = 0.72f') && controller.includes('FACTOR_NEW = 0.28f'), 'ambient readings must be smoothed');
assert(controller.includes('DEFAULT_ENABLED = true'), 'ambient brightness should default on when a light sensor exists');
assert(controller.includes('lightSensor != null'), 'missing light sensor must be handled explicitly');

assert(activity.includes('new AmbientBrightnessController(this)'), 'interactive Activity must create native ambient controller');
assert(activity.includes('"BrightnessBridge"'), 'interactive WebView must expose brightness bridge');
assert(activity.includes('ambientBrightness.onResume()'), 'ambient controller must follow Activity resume');
assert(activity.includes('ambientBrightness.onPause()'), 'ambient controller must follow Activity pause');
assert(activity.includes('ambientBrightness.destroy()'), 'ambient controller must be destroyed with Activity');

assert(manifest.includes('android.hardware.sensor.light'), 'manifest must declare optional light-sensor feature');
assert(manifest.includes('android.hardware.sensor.light" android:required="false"'), 'light sensor must remain optional');
assert(html.includes('id="auto-brightness"'), 'native auto-brightness control missing from UI');
assert(html.includes('<script src="ambient-brightness.js"></script>'), 'ambient-brightness frontend script missing');
assert(frontend.includes('BrightnessBridge'), 'frontend must use the native Android brightness bridge');
assert(!frontend.includes('AmbientLightSensor'), 'Android frontend must not depend on Generic Sensor API support');

function expected(lux) {
  const factor = Math.max(0, Math.min(1, Math.log10(Math.max(0, lux) + 1) / Math.log10(1001)));
  return 0.20 + 0.80 * factor;
}
assert(Math.abs(expected(0) - 0.20) < 1e-9, '0 lux should map to 20%');
assert(Math.abs(expected(1000) - 1.0) < 1e-9, '1000 lux should map to full brightness');
assert(expected(10) > 0.20 && expected(10) < expected(100), 'lux curve must be monotonic');

console.log('ambient brightness smoke passed');
