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
req(item,'android:id="@+id/el_second_image"','seconds frame');
no(layout,'<TextClock','widget layout');
req(info,'android:updatePeriodMillis="1800000"','widget metadata');
req(info,'android:widgetCategory="home_screen"','widget metadata');
req(provider,'RemoteViews.RemoteCollectionItems.Builder','live register adapter');
req(provider,'R.drawable.el_sec_59','generated frame table');
req(provider,'pairFrames=buildFrames(context,60)','60-frame adapter');
req(provider,'hourFrames=buildFrames(context,24)','24-frame adapter');
req(provider,'alarm.setExactAndAllowWhileIdle','minute refresh');

req(finish,'--el:#6decb4','WebView EL color');
req(provider,'CORE=Color.rgb(109,236,180),RULE=CORE','native EL color');
req(generator,"const EL_COLOR='#6DECB4'",'generated EL color');
no(finish,'--el:#79ef4f','obsolete lime color');
no(provider,'Color.rgb(121,239,79)','obsolete native lime color');
no(generator,'#79EF4F','obsolete generated lime color');
no(provider,'setShadowLayer','no-glow renderer');

// Android home widget keeps its own outer-frame representation.
req(layout,'android:layout_width="117.678dp"','outer widget width');
req(layout,'android:layout_height="198.525dp"','outer widget height');
req(layout,'android:background="#565A56"','outer frame color');
req(layout,'android:layout_width="106dp"','active register width');
req(layout,'android:layout_marginStart="5.839dp"','active face X inset');
req(layout,'android:layout_marginTop="92.526dp"','register 1 outer position');
req(layout,'android:layout_marginTop="126.661dp"','register 2 outer position');
req(layout,'android:layout_marginTop="160.797dp"','register 3 outer position');
req(layout,'android:layout_height="23dp"','register frame height');
req(provider,'ACTIVE_W=106f,ACTIVE_H=4.060f*U','native active face size');
req(provider,'ACTIVE_X=.130f*U,ACTIVE_Y=.180f*U','native active face inset');
req(provider,'PANEL_W=2.620f*U,PANEL_H=4.420f*U','native outer frame size');
req(provider,'ACTIVE_X*scaleDp','live register X inset');
req(provider,'(ACTIVE_Y+y[i])*scaleDp','live register Y inset');
req(provider,'ACTIVE_W*scaleDp','live register active width');

// In-app drawing geometry is the physical 106 x 182.356 active EL face.
// No UI-only gutter is allowed to alter its aspect ratio or field placement.
req(html,'viewBox="0 0 106 182.356"','physical WebView viewport');
req(html,'preserveAspectRatio="xMidYMid meet"','WebView aspect preservation');
req(html,'class="el-glass-background" x="0" y="0" width="106" height="182.356"','physical WebView glass');
no(html,'viewBox="0 0 107.5 182.356"','obsolete extended WebView viewport');
no(html,'el-right-safety-gutter','segment-covering safety mask');
no(html,'el-frame-background','duplicate WebView outer frame');
no(html,'el-hardware-border','duplicate WebView border');
no(html,'transform="translate(5.839 8.085)"','obsolete WebView active inset');
req(finish,'left:57.5000%','active DSKY face X');
req(finish,'top:5.1075%','active DSKY face Y');
req(finish,'width:33.125%','physical DSKY EL width');
req(finish,'height:49.0204%','active DSKY face height');
no(finish,'width:33.59375%','obsolete extended DSKY EL width');
req(finish,'.display-well{','rebuilt display well');
req(finish,'left:55.6753%','display-well hardware X');
req(finish,'top:2.9342%','display-well hardware Y');
req(finish,'width:36.7744%','display-well hardware width');
req(finish,'height:53.3670%','display-well hardware height');
no(finish,'width:38.27%','legacy oversized display-well width');
no(finish,'height:54.9%','legacy oversized display-well height');

// Screen-only mode uses the same physical active-face ratio without distortion.
req(screenOnly,'background:#696d67!important','screen-only gray field');
req(screenOnly,'left:50%!important','screen-only centered X');
req(screenOnly,'top:50%!important','screen-only centered Y');
req(screenOnly,'width:min(100vw,calc(100vh * 106 / 182.356))!important','screen-only aspect width');
req(screenOnly,'height:min(100vh,calc(100vw * 182.356 / 106))!important','screen-only aspect height');
req(screenOnly,'transform:translate(-50%,-50%)!important','screen-only centering');
no(screenOnly,'107.5 / 182.356','obsolete extended screen-only ratio');
no(screenOnly,'182.356 / 107.5','obsolete extended screen-only ratio');

// Active-face-local SCD geometry.
req(finish,'stroke-width:2.695','separator thickness');
req(geometry,'const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);','bar center datums');
req(geometry,'const BAR_H_IN=.060;','bar thickness');
req(geometry,'const REGISTER_GAP_IN=.070;','bar-to-digit gap');
req(html,'y1="79.949"','bar 1 center');
req(html,'y1="114.085"','bar 2 center');
req(html,'y1="148.220"','bar 3 center');

// Drawing-backed inch-datum digit geometry.  The current renderer uses the
// 1006315G STEP intersections directly; no generic radius or anisotropic
// scaling is permitted in any of the three render paths.
req(geometry,'MM_TO_U=U/25.4','WebView mm export conversion');
req(geometry,'scale(${U.toFixed(6)})','uniform WebView inch-datum glyph scale');
req(geometry,'1006315G-exact.step','drawing-backed geometry source');
req(geometry,"a:'M .420955898 .102240 L .490955898 .032240",'sharp WebView segment a');
req(geometry,"b:'M .441577898 .269917 L .505451 .031888012",'WebView b is physical right upper');
req(geometry,"c:'M .371594898 .279917 L .325402898 .452054 L .371185049 .532239310",'WebView c is physical right lower');
req(geometry,"d:'M .360332954 .532240 L .322647898 .467240",'sharp WebView segment d');
req(geometry,"e:'M .121184898 .532240 L .188893898 .279917",'WebView e is physical left lower');
req(geometry,"f:'M .124277898 .269917 L .191577898 .269917",'WebView f is physical left upper');
no(geometry,'A .020 .020','rounded WebView digit corners');
req(provider,'.490955898f,.032240f','sharp native segment a');
req(provider,'.360332954f,.532240f','sharp native segment d');
req(provider,'.371185049f,.532239310f','sharp native segment e');
req(provider,'.505451f,.031888012f','sharp native segment f');
req(provider,'case 1: // b: physical right upper','native b/right-upper mapping');
req(provider,'case 2: // c: physical right lower','native c/right-lower mapping');
req(provider,'case 4: // e: physical left lower','native e/left-lower mapping');
req(provider,'case 5: // f: physical left upper','native f/left-upper mapping');
no(provider,'arc(p,ox,oy','rounded native digit corners');
req(generator,'px(ox,.490955898)},${py(.032240)','sharp generated segment a');
req(generator,'px(ox,.360332954)},${py(.532240)','sharp generated segment d');
req(generator,'px(ox,.371185049)},${py(.532239310)','sharp generated segment e');
req(generator,'px(ox,.505451)},${py(.031888012)','sharp generated segment f');
req(generator,'// b: right upper','generated b/right-upper mapping');
req(generator,'// c: right lower','generated c/right-lower mapping');
req(generator,'// e: left lower','generated e/left-lower mapping');
req(generator,'// f: left upper','generated f/left-upper mapping');
no(generator,'A${A(.020)}','rounded generated digit corners');
no(geometry,'DIGIT_SX','affine-squeezed WebView geometry');
no(geometry,'DIGIT_SY','affine-squeezed WebView geometry');
no(provider,'DIGIT_SX','affine-squeezed native geometry');
no(provider,'DIGIT_SY','affine-squeezed native geometry');

// Detail A position 6: three physical sign islands from the same STEP datum.
req(geometry,"aTop:'M .073794 .387908",'WebView upper A sign island');
req(geometry,"b:'M -.007784 .296536",'WebView B sign island');
req(geometry,"aBottom:'M .073794 .221536",'WebView lower A sign island');
req(provider,'rawBox(ox,oy,-.007784f,.231536f,.232122f,.065000f)','native B sign island');
req(provider,'rawBox(ox,oy,.073794f,.305065f,.065000f,.082843f)','native upper A sign island');
req(provider,'rawBox(ox,oy,.073794f,.139908f,.065000f,.081628f)','native lower A sign island');
req(generator,'rawRect(REGISTER_ROW_X_IN,.073794,.305065,.065000,.082843)','generated upper A sign island');
req(generator,'rawRect(REGISTER_ROW_X_IN,-.007784,.231536,.232122,.065000)','generated B sign island');
req(generator,'rawRect(REGISTER_ROW_X_IN,.073794,.139908,.065000,.081628)','generated lower A sign island');

// Current 1006315G field/register datums shared by WebView and native paths.
req(geometry,'const UPPER_ADVANCE_IN=.420,REGISTER_ADVANCE_IN=.410;','upper/register pitch');
req(geometry,'const FIRST_DIGIT_X_IN=.180;','first register digit datum');
req(geometry,'const REGISTER_ROW_X_IN=-.010;','register row datum');
req(geometry,'const RIGHT_FIELD_X_IN=1.434549;','right upper datum');
req(geometry,'const UPPER_GROUP_X_OFFSET_IN=1.470;','VERB/NOUN horizontal separation');
req(geometry,'const LEFT_FIELD_X_IN=RIGHT_FIELD_X_IN-UPPER_GROUP_X_OFFSET_IN;','left upper datum derivation');
req(geometry,'const PROG_TOP_IN=.315;','PROG vertical datum');
req(geometry,'const FIRST_BAR_CENTER_FROM_TOP_IN=FACE_H_IN-BAR_FROM_BOTTOM_IN[0];','first separator top datum chain');
req(geometry,'const VERB_NOUN_TO_FIRST_BAR_CENTER_IN=.560;','VERB/NOUN to separator center dimension');
req(geometry,'const VERB_NOUN_TOP_IN=FIRST_BAR_CENTER_FROM_TOP_IN-VERB_NOUN_TO_FIRST_BAR_CENTER_IN;','VERB/NOUN top derivation');
req(geometry,'const UPPER_CLEARANCE_IN=FIRST_BAR_CENTER_FROM_TOP_IN-(BAR_H_IN*.5)-(VERB_NOUN_TOP_IN+.500);','upper electrode clearance');
req(provider,'REG_ADV=.410f*U,FIRST_DIGIT_X=.180f*U,REGISTER_ROW_X=-.010f*U','native register datums');
req(provider,'LEFT_FIELD_X=-.035451f*U,RIGHT_FIELD_X=1.434549f*U','native upper datums');
req(provider,'PROG_Y=.315f*U,VERB_NOUN_Y=1.220f*U','native upper vertical datums');
req(provider,'Typeface.create("sans-serif",Typeface.BOLD)','native legend face');
req(provider,'LABEL_P.setTextSize(7.42f)','native legend drawing height');
req(provider,'COMP_P.setTextSize(7.42f)','native COMP ACTY drawing height');
req(provider,'section(c,66.441f,.554f,39.525f,11.678f,LEGEND_BG_P)','native PROG zone');
req(provider,'section(c,0f,41.203f,39.525f,11.678f,LEGEND_BG_P)','native VERB zone');
req(provider,'section(c,66.441f,41.203f,39.525f,11.678f,LEGEND_BG_P)','native NOUN zone');
req(provider,'c.drawText("VERB",19.763f,49.252f,LABEL_P)','native VERB legend baseline');
req(provider,'c.drawText("NOUN",86.237f,49.252f,LABEL_P)','native NOUN legend baseline');
req(provider,'digits(c,"00",RIGHT_FIELD_X,PROG_Y)','native PROG datum');
req(provider,'digits(c,"16",LEFT_FIELD_X,VERB_NOUN_Y)','native VERB datum');
req(provider,'digits(c,"65",RIGHT_FIELD_X,VERB_NOUN_Y)','native NOUN datum');
req(generator,'REG_ADV_IN=.410, FIRST_DIGIT_X_IN=.180, REGISTER_ROW_X_IN=-.010','generated register datums');
req(provider,"register(c,'+',five(now.get(Calendar.HOUR_OF_DAY)),REGISTER_ROW_X,R1_Y)",'native register datum');

req(generator,'android:viewportWidth="106"','generated viewport width');
req(generator,'android:viewportHeight="23"','generated viewport height');
no(generator,'android:viewportWidth="100"','obsolete squeezed viewport');
no(html,'viewBox="0 0 106 190"','obsolete stretched WebView');
const versionCode=gradle.match(/\bversionCode\s+(\d+)/);
if(!versionCode || Number(versionCode[1]) < 20053) fail('Gradle versionCode is missing or regressed below 20053');
const versionName=gradle.match(/\bversionName\s+'(\d+)\.(\d+)\.(\d+)'/);
if(!versionName) fail('Gradle semantic versionName is missing');
const versionTuple=versionName.slice(1).map(Number);
const minimumTuple=[1,1,4];
for(let i=0;i<3;i++){
  if(versionTuple[i] > minimumTuple[i]) break;
  if(versionTuple[i] < minimumTuple[i]) fail(`Gradle versionName regressed below ${minimumTuple.join('.')}: ${versionTuple.join('.')}`);
}
req(generator,'for (let sec=0; sec<60; sec++)','seconds generator');
req(generator,'android:pathData','seconds generator');

console.log('EL widget source smoke: PASS');
console.log(`  1006315G active-face ratio, upper electrodes, labels, clearance, and app version ${versionTuple.join('.')} verified`);
