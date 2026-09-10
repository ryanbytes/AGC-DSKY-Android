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
const item = read('app/src/main/res/layout/el_second_frame.xml');
const info = read('app/src/main/res/xml/el_widget_info.xml');
const provider = read('app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java');
const geometry = read('app/src/main/assets/dsky-geometry.js');
const gradle = read('app/build.gradle');
const generator = read('tools/generate-el-second-frames.js');

requireText(manifest, 'android:name=".ElWidgetProvider"', 'manifest');
requireText(manifest, 'android:resource="@xml/el_widget_info"', 'manifest');
forbid(manifest, 'android.permission.INTERNET', 'manifest');

requireText(layout, '<AdapterViewFlipper', 'widget layout');
requireText(layout, 'android:id="@+id/el_seconds_flipper"', 'seconds flipper');
requireText(layout, 'android:autoStart="true"', 'seconds flipper');
requireText(layout, 'android:loopViews="true"', 'seconds flipper');
requireText(layout, 'android:flipInterval="1000"', 'seconds flipper');
requireText(item, 'android:id="@+id/el_second_image"', 'seconds frame');
forbid(layout, '<TextClock', 'widget layout');
forbid(layout, 'fontFamily=', 'widget layout');

requireText(info, 'android:updatePeriodMillis="1800000"', 'widget metadata');
requireText(info, 'android:widgetCategory="home_screen"', 'widget metadata');

requireText(provider, 'RemoteViews.RemoteCollectionItems.Builder', 'live register adapter');
requireText(provider, 'views.setRemoteAdapter(R.id.el_hour_flipper', 'live hour adapter');
requireText(provider, 'views.setRemoteAdapter(R.id.el_minute_flipper', 'live minute adapter');
requireText(provider, 'views.setRemoteAdapter(R.id.el_seconds_flipper', 'live seconds adapter');
requireText(provider, 'views.setDisplayedChild(R.id.el_seconds_flipper', 'live seconds adapter');
requireText(provider, 'private static final int[] SECOND_DRAWABLES', 'generated EL frame table');
requireText(provider, 'R.drawable.el_sec_59', 'generated EL frame table');
requireText(provider, 'pairFrames=buildFrames(context,60)', 'minute/seconds 60-frame adapter');
requireText(provider, 'hourFrames=buildFrames(context,24)', 'hour 24-frame adapter');
requireText(provider, 'alarm.setExactAndAllowWhileIdle', 'minute refresh');
requireText(provider, 'alarm.setAndAllowWhileIdle', 'minute refresh fallback');
forbid(provider, 'R.id.el_clock_', 'widget renderer');

requireText(provider, 'CORE=Color.rgb(98,217,232)', 'widget EL color');
requireText(provider, 'LABEL=CORE,RULE=CORE', 'widget EL label/rule color');
requireText(generator, 'android:fillColor="#62D9E8"', 'generated widget frame color');
forbid(provider, 'Color.rgb(201,245,189)', 'widget old pale-green color');
forbid(generator, '#C9F5BD', 'generated old pale-green frame color');

for (const needle of [
  'SIGN_W=6.731f*DIGIT_SCALE',
  'SIGN_T=1.524f*DIGIT_SCALE',
  'SIGN_ARM=3.175f*DIGIT_SCALE',
  'SIGN_GAP=.381f*DIGIT_SCALE',
  'FIRST_DIGIT_X=12f'
]) requireText(provider, needle, 'Apollo sign geometry');
for (const needle of [
  'SIGN_W = 6.731 * SCALE',
  'SIGN_T = 1.524 * SCALE',
  'SIGN_ARM = 3.175 * SCALE',
  'SIGN_GAP = 0.381 * SCALE',
  'FIRST_DIGIT_X = 12.0'
]) requireText(geometry, needle, 'WebView Apollo sign geometry');

requireText(gradle, 'versionCode 20048', 'Gradle');
requireText(gradle, "versionName '1.0.9'", 'Gradle');
requireText(generator, 'for (let sec=0; sec<60; sec++)', 'seconds generator');
requireText(generator, 'android:pathData', 'seconds generator');

console.log('EL widget source smoke: PASS');
console.log('  EL-only widget, cyan-blue phosphor, 60 generated register frames, Apollo sign geometry, and minute resync verified');
