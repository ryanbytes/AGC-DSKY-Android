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
const finish = read('app/src/main/assets/cm-dsky-finish.css');
const html = read('app/src/main/assets/index.html');
const gradle = read('app/build.gradle');
const generator = read('tools/generate-el-second-frames.js');

requireText(manifest, 'android:name=".ElWidgetProvider"', 'manifest');
requireText(manifest, 'android:resource="@xml/el_widget_info"', 'manifest');
requireText(manifest, 'android.permission.INTERNET', 'manifest');

requireText(layout, '<AdapterViewFlipper', 'widget layout');
requireText(layout, 'android:id="@+id/el_seconds_flipper"', 'seconds flipper');
requireText(layout, 'android:autoStart="true"', 'seconds flipper');
requireText(layout, 'android:loopViews="true"', 'seconds flipper');
requireText(layout, 'android:flipInterval="1000"', 'seconds flipper');
requireText(layout, 'android:background="#696D67"', 'Block II EL glass background');
requireText(layout, 'android:layout_height="182.356dp"', '1006315G panel height');
requireText(layout, 'android:layout_marginTop="69.916dp"', 'register 1 drawing position');
requireText(layout, 'android:layout_marginTop="104.052dp"', 'register 2 drawing position');
requireText(layout, 'android:layout_marginTop="138.187dp"', 'register 3 drawing position');
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

// SCD 1006315 production revisions specify nominal 5300-A / 530-nm EL output.
requireText(finish, '--el:#79ef4f', 'WebView production EL color');
requireText(provider, 'CORE=Color.rgb(121,239,79),RULE=CORE', 'native widget production EL color');
requireText(generator, "const EL_COLOR='#79EF4F'", 'generated widget frame production EL color');
forbid(finish, '--el:#62d9e8', 'WebView old early-panel cyan color');
forbid(provider, 'Color.rgb(98,217,232)', 'widget old early-panel cyan color');
forbid(generator, '#62D9E8', 'generated old early-panel cyan frame color');

// SCD 1006315G sheet 2 is the geometry authority.  The old 106x190 canvas and
// 100-wide register frame caused the exact spacing/stretch regression this test guards.
requireText(provider, 'PANEL_W=106f,PANEL_H=182.356f', '1006315G native panel aspect');
requireText(provider, 'R1_Y=69.916f,R2_Y=104.052f,R3_Y=138.187f', '1006315G register positions');
requireText(html, 'viewBox="0 0 106 182.356"', '1006315G WebView panel aspect');
requireText(finish, 'height:49.0204%', '1006315G faceplate height');
requireText(geometry, 'DRAWING_FACE_W_IN = 2.360', '1006315G face width');
requireText(geometry, 'DRAWING_FACE_H_IN = 4.060', '1006315G face height');
requireText(geometry, 'regTop(2.280)', 'register 1 source dimension');
requireText(geometry, 'regTop(1.520)', 'register 2 source dimension');
requireText(geometry, 'regTop(0.760)', 'register 3 source dimension');
forbid(html, 'viewBox="0 0 106 190"', 'obsolete stretched WebView geometry');
forbid(provider, 'PANEL_W=106f,PANEL_H=190f', 'obsolete stretched native geometry');

requireText(provider, 'PANEL=Color.rgb(105,109,103),HARDWARE=Color.rgb(162,166,159),INK=Color.rgb(5,6,5)', 'widget Block II glass colors');
requireText(provider, 'c.drawColor(PANEL)', 'widget gray glass render');
requireText(provider, 'box(2.119f,2.350f,101.763f,177.656f)', 'widget glass border geometry');
requireText(provider, 'dot(c,53.000f,6.914f,1.294f,1.369f)', 'widget ITO-dot geometry');
requireText(provider, 'section(c,65.505f,2.807f,37.945f,11.866f,LEGEND_BG_P)', 'widget PROG EL legend section');
requireText(provider, 'section(c,2.550f,30.898f,37.945f,11.866f,LEGEND_BG_P)', 'widget VERB EL legend section');
requireText(provider, 'section(c,65.505f,30.898f,37.945f,11.866f,LEGEND_BG_P)', 'widget NOUN EL legend section');
requireText(provider, 'section(c,2.550f,2.807f,37.945f,25.500f,COMP_BG_P)', 'widget COMP ACTY EL section');
requireText(provider, 'digits(c,"00",66.75f,14)', 'widget PROG position');
requireText(provider, 'digits(c,"65",66.75f,43.664f)', 'widget NOUN position');
forbid(provider, 'setShadowLayer', 'widget EL no-glow renderer');
forbid(provider, 'drawRect(', 'widget renderer');
forbid(provider, 'drawRoundRect(', 'widget renderer');
forbid(provider, 'drawCircle(', 'widget renderer');
forbid(provider, 'drawOval(', 'widget renderer');
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

requireText(gradle, 'versionCode 20051', 'Gradle');
requireText(gradle, "versionName '1.1.2'", 'Gradle');
requireText(generator, 'for (let sec=0; sec<60; sec++)', 'seconds generator');
requireText(generator, 'android:pathData', 'seconds generator');
requireText(generator, 'android:viewportWidth="106"', 'unstretched generated register frame');
forbid(generator, 'android:viewportWidth="100"', 'obsolete squeezed register viewport');

console.log('EL widget source smoke: PASS');
console.log('  1006315G face aspect/register spacing, gray glass, hardware dots/border, no-glow 530-nm EL color, generated frames, and Apollo segment geometry verified');
