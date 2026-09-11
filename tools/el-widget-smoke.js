'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const fail = message => { console.error(`EL WIDGET FAIL: ${message}`); process.exit(1); };
const requireText = (text, needle, label) => { if (!text.includes(needle)) fail(`${label} is missing: ${needle}`); };
const forbid = (text, needle, label) => { if (text.includes(needle)) fail(`${label} must not contain: ${needle}`); };

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
requireText(layout, 'android:flipInterval="1000"', 'seconds flipper');
requireText(layout, 'android:background="#696D67"', 'Block II EL glass background');
requireText(layout, 'android:layout_height="182.356dp"', '1006315G panel height');
requireText(layout, 'android:layout_height="23dp"', 'register frame height');
requireText(layout, 'android:layout_marginTop="84.441dp"', 'register 1 position');
requireText(layout, 'android:layout_marginTop="118.576dp"', 'register 2 position');
requireText(layout, 'android:layout_marginTop="152.712dp"', 'register 3 position');
requireText(item, 'android:id="@+id/el_second_image"', 'seconds frame');
forbid(layout, '<TextClock', 'widget layout');

requireText(info, 'android:updatePeriodMillis="1800000"', 'widget metadata');
requireText(info, 'android:widgetCategory="home_screen"', 'widget metadata');
requireText(provider, 'RemoteViews.RemoteCollectionItems.Builder', 'live register adapter');
requireText(provider, 'R.drawable.el_sec_59', 'generated EL frame table');
requireText(provider, 'pairFrames=buildFrames(context,60)', '60-frame adapter');
requireText(provider, 'hourFrames=buildFrames(context,24)', '24-frame adapter');
requireText(provider, 'alarm.setExactAndAllowWhileIdle', 'minute refresh');

// User-requested blue-green EL treatment must agree in all render paths.
requireText(finish, '--el:#6decb4', 'WebView EL color');
requireText(provider, 'CORE=Color.rgb(109,236,180),RULE=CORE', 'native EL color');
requireText(generator, "const EL_COLOR='#6DECB4'", 'generated frame EL color');
forbid(finish, '--el:#79ef4f', 'obsolete lime EL color');
forbid(provider, 'Color.rgb(121,239,79)', 'obsolete native lime EL color');
forbid(generator, '#79EF4F', 'obsolete generated lime EL color');
forbid(provider, 'setShadowLayer', 'widget no-glow renderer');

// Face and separator geometry from SCD 1006315G sheet 2.
requireText(provider, 'PANEL_W=106f,PANEL_H=182.356f', 'native panel aspect');
requireText(provider, 'R1_Y=84.441f,R2_Y=118.576f,R3_Y=152.712f', 'native register positions');
requireText(provider, 'FRAME_H=23f', 'native frame height');
requireText(html, 'viewBox="0 0 106 182.356"', 'WebView panel aspect');
requireText(finish, 'height:49.0204%', 'faceplate height');
requireText(finish, 'stroke-width:2.695', 'nominal .060-in separator thickness');
requireText(screenOnly, '106 / 182.356', 'screen-only aspect ratio');
requireText(screenOnly, '182.356 / 106', 'screen-only reciprocal aspect ratio');
requireText(geometry, 'const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);', 'bar center datums');
requireText(geometry, 'const BAR_H_IN=.060;', 'separator thickness');
requireText(geometry, 'const REGISTER_GAP_IN=.070;', 'bar-to-digit clearance');
requireText(html, 'y1="79.949"', 'register 1 separator center');
requireText(html, 'y1="114.085"', 'register 2 separator center');
requireText(html, 'y1="148.220"', 'register 3 separator center');

// Detail C: .320 REF is a datum-to-edge dimension, not a glyph bounding box.
// The metric trace itself carries the .500-in height, .065-ish segment widths,
// and 15-degree slope. It must be converted with one physical scale only.
requireText(geometry, 'const MM_TO_U=U/25.4;', 'uniform metric conversion');
requireText(geometry, 'const DATUM_X=MIRROR_X-96.244524;', 'Detail-C datum');
requireText(geometry, 'scale(${MM_TO_U.toFixed(6)})', 'uniform WebView glyph scale');
requireText(provider, 'MM_TO_U=U/25.4f', 'uniform native metric conversion');
requireText(provider, 'DATUM_X=MIRROR_X-96.244524f', 'native Detail-C datum');
requireText(generator, 'MM_TO_U=U/25.4', 'generated uniform metric conversion');
requireText(generator, 'DATUM_X=MIRROR_X-96.244524', 'generated Detail-C datum');
forbid(geometry, 'DIGIT_SX', 'affine-squeezed WebView geometry');
forbid(geometry, 'DIGIT_SY', 'affine-squeezed WebView geometry');
forbid(provider, 'DIGIT_SX', 'affine-squeezed native geometry');
forbid(provider, 'DIGIT_SY', 'affine-squeezed native geometry');
forbid(generator, 'const SX=', 'affine-squeezed generated geometry');
forbid(generator, 'const SY=', 'affine-squeezed generated geometry');

// Detail B/A datum chains.
requireText(geometry, 'const UPPER_ADVANCE=.420*U;', 'upper-field pitch');
requireText(geometry, 'const REGISTER_ADVANCE=.410*U;', 'register pitch');
requireText(geometry, 'const FIRST_DIGIT_X=.400*U;', 'first register digit datum');
requireText(geometry, 'const SIGN_W=.265*U,SIGN_H=.338*U,SIGN_T=.065*U,SIGN_X=.025*U;', 'sign geometry');
requireText(geometry, 'const LEFT_FIELD_X=.140*U,RIGHT_FIELD_X=1.620*U;', 'upper-field datums');
requireText(provider, 'FIRST_DIGIT_X=.400f*U', 'native first register datum');
requireText(provider, 'LEFT_FIELD_X=.140f*U,RIGHT_FIELD_X=1.620f*U', 'native upper-field datums');
requireText(provider, 'SIGN_W=.265f*U,SIGN_H=.338f*U,SIGN_T=.065f*U,SIGN_X=.025f*U', 'native sign geometry');
requireText(generator, 'REG_ADV=.410*U, FIRST_DIGIT_X=.400*U', 'generated register datums');
requireText(generator, 'SIGN_W=.265*U, SIGN_H=.338*U, SIGN_T=.065*U, SIGN_X=.025*U', 'generated sign geometry');

// Static HTML positions mirror the JS datum positions so there is no startup flash.
requireText(html, 'transform="translate(72.763 14)"', 'PROG datum');
requireText(html, 'transform="translate(6.288 55.5)"', 'VERB datum');
requireText(html, 'transform="translate(72.763 55.5)"', 'NOUN datum');
requireText(html, 'transform="translate(0 84.441)"', 'register 1 origin');
requireText(provider, 'digits(c,"00",RIGHT_FIELD_X,14f)', 'native PROG datum');
requireText(provider, 'digits(c,"16",LEFT_FIELD_X,55.5f)', 'native VERB datum');
requireText(provider, 'register(c,\'+\'', 'native register sign renderer');

requireText(generator, 'android:viewportWidth="106"', 'generated viewport width');
requireText(generator, 'android:viewportHeight="23"', 'generated viewport height');
forbid(generator, 'android:viewportWidth="100"', 'obsolete squeezed register viewport');
forbid(html, 'viewBox="0 0 106 190"', 'obsolete stretched WebView geometry');
forbid(provider, 'PANEL_W=106f,PANEL_H=190f', 'obsolete stretched native geometry');

requireText(gradle, 'versionCode 20051', 'Gradle');
requireText(gradle, "versionName '1.1.2'", 'Gradle');
requireText(generator, 'for (let sec=0; sec<60; sec++)', 'seconds generator');
requireText(generator, 'android:pathData', 'seconds generator');

console.log('EL widget source smoke: PASS');
console.log('  1006315G face/datums, undistorted physical segment trace, .420/.410 pitches, register sign geometry, and blue-green EL verified');
