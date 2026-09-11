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
const screenOnly = read('app/src/main/assets/screen-only.css');
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
requireText(layout, 'android:layout_height="23dp"', 'drawing-height register frame');
requireText(layout, 'android:layout_marginTop="84.441dp"', 'register 1 drawing position');
requireText(layout, 'android:layout_marginTop="118.576dp"', 'register 2 drawing position');
requireText(layout, 'android:layout_marginTop="152.712dp"', 'register 3 drawing position');
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
requireText(provider, 'R.drawable.el_sec_59', 'generated EL frame table');
requireText(provider, 'pairFrames=buildFrames(context,60)', 'minute/seconds 60-frame adapter');
requireText(provider, 'hourFrames=buildFrames(context,24)', 'hour 24-frame adapter');
requireText(provider, 'alarm.setExactAndAllowWhileIdle', 'minute refresh');
requireText(provider, 'alarm.setAndAllowWhileIdle', 'minute refresh fallback');

// Production EL wavelength / rendering.
requireText(finish, '--el:#79ef4f', 'WebView production EL color');
requireText(provider, 'CORE=Color.rgb(121,239,79),RULE=CORE', 'native widget production EL color');
requireText(generator, "const EL_COLOR='#79EF4F'", 'generated frame production EL color');
forbid(finish, '--el:#62d9e8', 'old cyan EL color');
forbid(provider, 'setShadowLayer', 'widget EL no-glow renderer');

// MIT/IL SCD 1006315G face geometry.
requireText(provider, 'PANEL_W=106f,PANEL_H=182.356f', '1006315G native panel aspect');
requireText(provider, 'R1_Y=84.441f,R2_Y=118.576f,R3_Y=152.712f', '1006315G register positions');
requireText(provider, 'FRAME_H=23f', 'drawing-height native register frame');
requireText(html, 'viewBox="0 0 106 182.356"', '1006315G WebView panel aspect');
requireText(finish, 'height:49.0204%', '1006315G faceplate height');
requireText(finish, 'stroke-width:2.695', 'nominal .060-in separator thickness');
requireText(screenOnly, '106 / 182.356', 'screen-only aspect ratio');
requireText(screenOnly, '182.356 / 106', 'screen-only reciprocal aspect ratio');

// Sheet 1 details B/C: digits are .320 x .500 with separate X/Y fitting;
// upper two-digit fields use .420-in pitch.  A single uniform scale is forbidden.
requireText(geometry, 'const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN;', 'face dimensions');
requireText(geometry, 'const DIGIT_W=.320*U,DIGIT_H=.500*U;', 'drawing digit envelope');
requireText(geometry, 'const DIGIT_SX=DIGIT_W/SRC_W,DIGIT_SY=DIGIT_H/SRC_H;', 'affine digit fit');
requireText(geometry, 'const UPPER_ADVANCE=.420*U;', 'upper-field drawing pitch');
requireText(provider, 'DIGIT_W=.320f*U,DIGIT_H=.500f*U,DIGIT_SX=DIGIT_W/SRC_W,DIGIT_SY=DIGIT_H/SRC_H', 'native affine digit fit');
requireText(provider, 'UPPER_ADV=.420f*U,REG_ADV=.410f*U', 'native drawing pitches');
requireText(generator, 'const DIGIT_W=.320*U, DIGIT_H=.500*U;', 'generated digit envelope');
requireText(generator, 'const SX=DIGIT_W/SRC_W, SY=DIGIT_H/SRC_H;', 'generated affine digit fit');
forbid(provider, 'DIGIT_SCALE=', 'obsolete uniform digit scale');
forbid(geometry, 'const SCALE=1.58', 'obsolete uniform digit scale');

// Sheet 1 detail A: register digit pitch and sign envelope.
requireText(geometry, 'const REGISTER_ADVANCE=.410*U;', 'register drawing pitch');
requireText(geometry, 'const SIGN_W=.265*U,SIGN_H=.338*U,SIGN_T=.065*U;', 'WebView sign envelope');
requireText(provider, 'SIGN_W=.265f*U,SIGN_H=.338f*U,SIGN_T=.065f*U', 'native sign envelope');
requireText(generator, 'const REG_ADV=.410*U, FIRST_DIGIT_X=12.0;', 'generated register pitch');
requireText(generator, 'const SIGN_W=.265*U, SIGN_H=.338*U, SIGN_T=.065*U;', 'generated sign envelope');
requireText(generator, 'android:height="23dp"', 'generated frame height');
requireText(generator, 'android:viewportWidth="106"', 'generated register viewport width');
requireText(generator, 'android:viewportHeight="23"', 'generated register viewport height');
forbid(generator, 'android:viewportWidth="100"', 'obsolete squeezed register viewport');

// Sheet 2: .760-in bar-center pitch and .060-in luminous bars.  Register glyphs
// begin .070 in below the bar edge.
requireText(geometry, 'const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);', 'bar center datums');
requireText(geometry, 'const BAR_H_IN=.060;', 'separator thickness');
requireText(geometry, 'const REGISTER_GAP_IN=.070;', 'bar-to-digit clearance');
requireText(geometry, 'const BAR_CENTER_Y=BAR_FROM_BOTTOM_IN.map(v=>(FACE_H_IN-v)*U);', 'bar center transform');
requireText(geometry, 'const REGISTER_Y=BAR_CENTER_Y.map(c=>c+(BAR_H_IN*.5+REGISTER_GAP_IN)*U);', 'register transform');
requireText(html, 'y1="79.949"', 'register 1 separator center');
requireText(html, 'y1="114.085"', 'register 2 separator center');
requireText(html, 'y1="148.220"', 'register 3 separator center');

// Upper front-view geometry must not overlap legend boxes.
requireText(html, 'x="65.553" y="0.554" width="34.868" height="11.678"', 'PROG legend box');
requireText(html, 'x="6.019" y="42.721" width="35.162" height="11.678"', 'VERB legend box');
requireText(html, 'x="65.920" y="42.721" width="34.501" height="11.678"', 'NOUN legend box');
requireText(html, 'transform="translate(66.4 14)"', 'PROG digits clear of legend');
requireText(html, 'transform="translate(7 55.5)"', 'VERB digits clear of legend');
requireText(html, 'transform="translate(66.6 55.5)"', 'NOUN digits clear of legend');
requireText(provider, 'section(c,65.553f,.554f,34.868f,11.678f,LEGEND_BG_P)', 'native PROG legend');
requireText(provider, 'section(c,6.019f,42.721f,35.162f,11.678f,LEGEND_BG_P)', 'native VERB legend');
requireText(provider, 'section(c,65.920f,42.721f,34.501f,11.678f,LEGEND_BG_P)', 'native NOUN legend');
requireText(provider, 'digits(c,"00",66.4f,14f)', 'native PROG position');
requireText(provider, 'digits(c,"16",7f,55.5f)', 'native VERB position');
requireText(provider, 'digits(c,"65",66.6f,55.5f)', 'native NOUN position');

forbid(html, 'viewBox="0 0 106 190"', 'obsolete stretched WebView geometry');
forbid(provider, 'PANEL_W=106f,PANEL_H=190f', 'obsolete stretched native geometry');
forbid(layout, 'android:layout_marginTop="85.788dp"', 'old register-1 geometry');
forbid(layout, 'android:layout_marginTop="119.924dp"', 'old register-2 geometry');
forbid(layout, 'android:layout_marginTop="154.059dp"', 'old register-3 geometry');
forbid(html, 'transform="translate(66.75 14)"', 'old PROG origin');
forbid(html, 'transform="translate(3 59)"', 'old VERB origin');

requireText(gradle, 'versionCode 20051', 'Gradle');
requireText(gradle, "versionName '1.1.2'", 'Gradle');
requireText(generator, 'for (let sec=0; sec<60; sec++)', 'seconds generator');
requireText(generator, 'android:pathData', 'seconds generator');

console.log('EL widget source smoke: PASS');
console.log('  1006315G face, affine .320 x .500 digits, .420/.410 pitches, sign envelope, bar datums, upper-field clearance, and 530-nm EL rendering verified');
