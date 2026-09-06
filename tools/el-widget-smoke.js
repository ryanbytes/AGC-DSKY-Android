'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const fail = message => {
  console.error(`EL WIDGET FAIL: ${message}`);
  process.exit(1);
};
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) fail(`${label} is missing: ${needle}`);
};
const forbid = (text, needle, label) => {
  if (text.includes(needle)) fail(`${label} must not contain: ${needle}`);
};

const manifest = read('app/src/main/AndroidManifest.xml');
const layout = read('app/src/main/res/layout/el_widget.xml');
const info = read('app/src/main/res/xml/el_widget_info.xml');
const provider = read('app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java');
const geometry = read('app/src/main/assets/dsky-geometry.js');
const gradle = read('app/build.gradle');
const font64 = read('tools/dsky-el-font.b64').replace(/\s+/g, '');

requireText(manifest, 'android:name=".ElWidgetProvider"', 'manifest');
requireText(manifest, 'android:resource="@xml/el_widget_info"', 'manifest');
requireText(manifest, 'android.appwidget.action.APPWIDGET_UPDATE', 'manifest');
forbid(manifest, 'android.permission.INTERNET', 'manifest');

requireText(layout, '<FrameLayout', 'widget layout');
requireText(layout, 'android:id="@+id/el_widget_root"', 'widget layout');
requireText(layout, 'android:id="@+id/el_widget_image"', 'widget layout');
requireText(layout, 'android:padding="0dp"', 'widget layout');
requireText(layout, 'android:scaleType="fitCenter"', 'widget layout');
if ((layout.match(/<ImageView\b/g) || []).length !== 1) {
  fail('widget layout must contain exactly one static ImageView');
}
if ((layout.match(/<TextClock\b/g) || []).length !== 3) {
  fail('widget layout must contain exactly three live TextClock registers');
}
for (const id of ['el_clock_r1', 'el_clock_r2', 'el_clock_r3']) {
  requireText(layout, `android:id="@+id/${id}"`, 'widget layout');
}
for (const fmt of ['+000HH', '+000mm', '+000ss']) {
  requireText(layout, `android:format24Hour="${fmt}"`, 'widget layout');
}
requireText(layout, 'android:fontFamily="@font/dsky_el"', 'widget layout');
for (const physical of ['Button', 'RelativeLayout']) {
  forbid(layout, `<${physical}`, 'widget layout');
}

requireText(info, 'android:updatePeriodMillis="0"', 'widget metadata');
requireText(info, 'android:initialLayout="@layout/el_widget"', 'widget metadata');
requireText(info, 'android:resizeMode="horizontal|vertical"', 'widget metadata');
requireText(info, 'android:widgetCategory="home_screen"', 'widget metadata');

requireText(provider, 'private static final float PANEL_W = 106f;', 'EL renderer');
requireText(provider, 'private static final float PANEL_H = 190f;', 'EL renderer');
requireText(provider, 'R.id.el_clock_r3', 'widget live clock');
requireText(provider, 'TextClock runs inside the launcher host', 'widget live clock');
forbid(provider, 'AlarmManager', 'widget live clock');
forbid(provider, 'RTC_WAKEUP', 'widget live clock');

for (const needle of [
  'SIGN_W = 6.731f * DIGIT_SCALE',
  'SIGN_T = 1.524f * DIGIT_SCALE',
  'SIGN_ARM = 3.175f * DIGIT_SCALE',
  'SIGN_GAP = 0.381f * DIGIT_SCALE',
  'FIRST_DIGIT_X = 12.0f'
]) requireText(provider, needle, 'Apollo sign geometry');
for (const needle of [
  'SIGN_W = 6.731 * SCALE',
  'SIGN_T = 1.524 * SCALE',
  'SIGN_ARM = 3.175 * SCALE',
  'SIGN_GAP = 0.381 * SCALE',
  'FIRST_DIGIT_X = 12.0'
]) requireText(geometry, needle, 'WebView Apollo sign geometry');
forbid(geometry, 'SIGN_SKEW', 'WebView Apollo sign geometry');

requireText(gradle, 'versionCode 18', 'Gradle');
requireText(gradle, "versionName '0.18'", 'Gradle');
requireText(gradle, 'stageElWidgetFont', 'Gradle');
requireText(gradle, 'font/dsky_el.ttf', 'Gradle');
let fontBytes;
try { fontBytes = Buffer.from(font64, 'base64'); } catch (e) { fail(`font base64 decode failed: ${e}`); }
if (fontBytes.length < 1024) fail(`decoded EL font is unexpectedly small: ${fontBytes.length}`);
if (fontBytes.slice(0, 4).toString('hex') !== '00010000') fail('decoded EL font is not a TrueType sfnt');

// The widget must remain the EL section rather than recreating physical DSKY
// hardware around it. Paths are required for digit/sign sections; these shape
// primitives are forbidden because they would normally add bezel/fasteners.
for (const primitive of ['drawRoundRect(', 'drawCircle(', 'drawOval(']) {
  forbid(provider, primitive, 'EL-only renderer');
}
for (const physical of ['faceplate', 'fastener', 'keyboard', 'annunciator bank']) {
  const implementation = provider.replace(/\/\*\*[\s\S]*?\*\//, '');
  if (implementation.toLowerCase().includes(physical)) {
    fail(`EL renderer implementation unexpectedly references ${physical}`);
  }
}

console.log('EL widget source smoke: PASS');
