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

requireText(manifest, 'android:name=".ElWidgetProvider"', 'manifest');
requireText(manifest, 'android:resource="@xml/el_widget_info"', 'manifest');
requireText(manifest, 'android.appwidget.action.APPWIDGET_UPDATE', 'manifest');
requireText(manifest, 'android.intent.action.TIME_SET', 'manifest');
requireText(manifest, 'android.intent.action.TIMEZONE_CHANGED', 'manifest');
requireText(manifest, 'android.intent.action.DATE_CHANGED', 'manifest');
forbid(manifest, 'android.permission.INTERNET', 'manifest');

requireText(layout, 'android:id="@+id/el_widget_root"', 'widget layout');
requireText(layout, 'android:id="@+id/el_widget_image"', 'widget layout');
requireText(layout, 'android:background="@android:color/transparent"', 'widget host');
requireText(layout, 'android:scaleType="fitCenter"', 'EL panel image');
if ((layout.match(/<ImageView\b/g) || []).length !== 1) {
  fail('widget layout must contain exactly one ImageView');
}
for (const forbiddenView of ['TextClock', 'TextView', 'Button', 'RelativeLayout']) {
  forbid(layout, `<${forbiddenView}`, 'widget layout');
}
forbid(layout, 'fontFamily=', 'widget layout');

requireText(info, 'android:updatePeriodMillis="0"', 'widget metadata');
requireText(info, 'android:initialLayout="@layout/el_widget"', 'widget metadata');
requireText(info, 'android:resizeMode="horizontal|vertical"', 'widget metadata');
requireText(info, 'android:widgetCategory="home_screen"', 'widget metadata');

requireText(provider, 'private static final float PANEL_W = 106f;', 'EL renderer');
requireText(provider, 'private static final float PANEL_H = 190f;', 'EL renderer');
requireText(provider, 'ElRenderer.render(widthPx, heightPx, Calendar.getInstance())', 'vector register renderer');
requireText(provider, 'drawRegister(canvas, \'+\'', 'vector register renderer');
requireText(provider, 'AlarmManager', 'widget scheduler');
requireText(provider, 'alarm.setExact(AlarmManager.RTC', 'widget scheduler');
requireText(provider, 'alarm.set(AlarmManager.RTC', 'widget scheduler fallback');
forbid(provider, 'TextClock', 'widget renderer');
forbid(provider, 'R.id.el_clock_', 'widget renderer');

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

requireText(gradle, 'versionCode 20', 'Gradle');
requireText(gradle, "versionName '0.20'", 'Gradle');
forbid(gradle, 'stageElWidgetFont', 'Gradle');
forbid(gradle, 'dsky-el-font.b64', 'Gradle');

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
