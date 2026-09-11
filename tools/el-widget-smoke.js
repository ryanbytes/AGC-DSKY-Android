'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error(`EL WIDGET FAIL: ${m}`);process.exit(1);};
const req=(t,n,l)=>{if(!t.includes(n))fail(`${l} is missing: ${n}`);};
const no=(t,n,l)=>{if(t.includes(n))fail(`${l} must not contain: ${n}`);};

const manifest=read('app/src/main/AndroidManifest.xml');
const layout=read('app/src/main/res/layout/el_widget.xml');
const item=read('app/src/main/res/layout/el_second_frame.xml');
const info=read('app/src/main/res/xml/el_widget_info.xml');
const provider=read('app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java');
const geometry=read('app/src/main/assets/dsky-geometry.js');
const finish=read('app/src/main/assets/cm-dsky-finish.css');
const screenOnly=read('app/src/main/assets/screen-only.css');
const html=read('app/src/main/assets/index.html');
const gradle=read('app/build.gradle');
const generator=read('tools/generate-el-second-frames.js');

req(manifest,'android:name=".ElWidgetProvider"','manifest');
req(manifest,'android:resource="@xml/el_widget_info"','manifest');
req(manifest,'android.permission.INTERNET','manifest');
req(layout,'<AdapterViewFlipper','widget layout');
req(layout,'android:id="@+id/el_seconds_flipper"','seconds flipper');
req(layout,'android:flipInterval="1000"','seconds flipper');
req(layout,'android:background="#696D67"','EL glass background');
req(layout,'android:layout_height="182.356dp"','panel height');
req(layout,'android:layout_height="23dp"','register frame height');
req(layout,'android:layout_marginTop="84.441dp"','register 1 position');
req(layout,'android:layout_marginTop="118.576dp"','register 2 position');
req(layout,'android:layout_marginTop="152.712dp"','register 3 position');
req(item,'android:id="@+id/el_second_image"','seconds frame');
no(layout,'<TextClock','widget layout');
req(info,'android:updatePeriodMillis="1800000"','widget metadata');
req(info,'android:widgetCategory="home_screen"','widget metadata');
req(provider,'RemoteViews.RemoteCollectionItems.Builder','live register adapter');
req(provider,'R.drawable.el_sec_59','generated frame table');
req(provider,'pairFrames=buildFrames(context,60)','60-frame adapter');
req(provider,'hourFrames=buildFrames(context,24)','24-frame adapter');
req(provider,'alarm.setExactAndAllowWhileIdle','minute refresh');

// User-requested green with a visible blue component, identical in all paths.
req(finish,'--el:#6decb4','WebView EL color');
req(provider,'CORE=Color.rgb(109,236,180),RULE=CORE','native EL color');
req(generator,"const EL_COLOR='#6DECB4'",'generated EL color');
no(finish,'--el:#79ef4f','obsolete lime color');
no(provider,'Color.rgb(121,239,79)','obsolete native lime color');
no(generator,'#79EF4F','obsolete generated lime color');
no(provider,'setShadowLayer','no-glow renderer');

// SCD 1006315G face and register-bar geometry.
req(provider,'PANEL_W=106f,PANEL_H=182.356f','native panel aspect');
req(provider,'R1_Y=84.441f,R2_Y=118.576f,R3_Y=152.712f','native row positions');
req(provider,'FRAME_H=23f','native frame height');
req(html,'viewBox="0 0 106 182.356"','WebView panel aspect');
req(finish,'height:49.0204%','faceplate height');
req(finish,'stroke-width:2.695','separator thickness');
req(screenOnly,'106 / 182.356','screen-only aspect');
req(screenOnly,'182.356 / 106','screen-only reciprocal aspect');
req(geometry,'const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);','bar center datums');
req(geometry,'const BAR_H_IN=.060;','bar thickness');
req(geometry,'const REGISTER_GAP_IN=.070;','bar-to-digit gap');
req(html,'y1="79.949"','bar 1 center');
req(html,'y1="114.085"','bar 2 center');
req(html,'y1="148.220"','bar 3 center');

// Detail C's .320 REF is datum-to-edge, not the full slanted glyph bbox.
// The metric trace already realizes the drawing and therefore uses one scale.
req(geometry,'const MM_TO_U=U/25.4;','uniform metric conversion');
req(geometry,'const DATUM_X=MIRROR_X-96.244524;','Detail-C datum');
req(geometry,'scale(${MM_TO_U.toFixed(6)})','uniform WebView glyph scale');
req(provider,'MM_TO_U=U/25.4f','uniform native metric conversion');
req(provider,'DATUM_X=MIRROR_X-96.244524f','native Detail-C datum');
req(generator,'MM_TO_U=U/25.4','generated metric conversion');
req(generator,'DATUM_X=MIRROR_X-96.244524','generated Detail-C datum');
no(geometry,'DIGIT_SX','affine-squeezed WebView geometry');
no(geometry,'DIGIT_SY','affine-squeezed WebView geometry');
no(provider,'DIGIT_SX','affine-squeezed native geometry');
no(provider,'DIGIT_SY','affine-squeezed native geometry');
no(generator,'const SX=','affine-squeezed generated geometry');
no(generator,'const SY=','affine-squeezed generated geometry');

// Detail B/A datum chains.
req(geometry,'const UPPER_ADVANCE=.420*U;','upper pitch');
req(geometry,'const REGISTER_ADVANCE=.410*U;','register pitch');
req(geometry,'const FIRST_DIGIT_X=.400*U;','first register digit datum');
req(geometry,'const SIGN_W=.265*U,SIGN_H=.338*U,SIGN_T=.065*U,SIGN_X=.025*U;','WebView sign geometry');
req(geometry,'const LEFT_FIELD_X=.140*U,RIGHT_FIELD_X=1.620*U;','upper field datums');
req(provider,'FIRST_DIGIT_X=.400f*U','native first register datum');
req(provider,'LEFT_FIELD_X=.140f*U,RIGHT_FIELD_X=1.620f*U','native upper datums');
req(provider,'SIGN_W=.265f*U,SIGN_H=.338f*U,SIGN_T=.065f*U,SIGN_X=.025f*U','native sign geometry');
req(generator,'REG_ADV=.410*U, FIRST_DIGIT_X=.400*U','generated register datums');
req(generator,'SIGN_W=.265*U, SIGN_H=.338*U, SIGN_T=.065*U, SIGN_X=.025*U','generated sign geometry');
req(html,'transform="translate(72.763 14)"','PROG datum');
req(html,'transform="translate(6.288 55.5)"','VERB datum');
req(html,'transform="translate(72.763 55.5)"','NOUN datum');
req(html,'transform="translate(0 84.441)"','register origin');
req(provider,'digits(c,"00",RIGHT_FIELD_X,14f)','native PROG datum');
req(provider,'digits(c,"16",LEFT_FIELD_X,55.5f)','native VERB datum');
req(provider,"register(c,'+',five(now.get(Calendar.HOUR_OF_DAY)),0,R1_Y)",'native register datum');

req(generator,'android:viewportWidth="106"','generated viewport width');
req(generator,'android:viewportHeight="23"','generated viewport height');
no(generator,'android:viewportWidth="100"','obsolete squeezed viewport');
no(html,'viewBox="0 0 106 190"','obsolete stretched WebView');
no(provider,'PANEL_W=106f,PANEL_H=190f','obsolete stretched native panel');
req(gradle,'versionCode 20051','Gradle');
req(gradle,"versionName '1.1.2'",'Gradle');
req(generator,'for (let sec=0; sec<60; sec++)','seconds generator');
req(generator,'android:pathData','seconds generator');

console.log('EL widget source smoke: PASS');
console.log('  1006315G datum geometry, undistorted physical segment trace, register/upper pitches, and blue-green EL verified');
