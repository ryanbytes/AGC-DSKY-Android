'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const fail=m=>{throw new Error('EL GEOMETRY LOCK FAIL: '+m)};
const req=(src,needle,label)=>{if(!src.includes(needle))fail(label+' changed: '+needle)};

const web=read('app/src/main/assets/dsky-geometry.js');
const native=read('app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java');
const generated=read('tools/generate-el-second-frames.js');
const screenOnly=read('app/src/main/assets/screen-only.css');
const index=read('app/src/main/assets/index.html');

// Accepted 1006315G front-view geometry. Apollo identity is E/H/M/N/K/F/J -> a/b/c/d/e/f/g; any change requires new drawing-backed evidence.
const webPaths=[
  "a:'M .199003944 .032239891 L .236689000 .097239891 L .410356000 .097239891 L .427798000 .032239891 Z'",
  "b:'M .438152000 .032239891 L .370443000 .284562891 L .437742000 .284562891 L .505451000 .032239891 Z'",
  "c:'M .435059000 .294562891 L .367759000 .294562891 L .325740000 .451148891 L .371746000 .530501891 Z'",
  "d:'M .138381000 .462239891 L .068381000 .532239891 L .361195000 .532239891 L .322764000 .462239891 Z'",
  "e:'M .117759000 .294562891 L .053885898 .532591879 L .145868000 .440610891 L .185059000 .294562891 Z'",
  "f:'M .187742000 .284562891 L .233934000 .112425891 L .188151849 .032240581 L .120443000 .284562891 Z'",
  "g:'M .206770000 .252239891 L .189327000 .317239891 L .351320000 .317239891 L .368762000 .252239891 Z'"
];
for(const p of webPaths)req(web,p,'WebView segment polygon');

for(const marker of [
  "aTop:'M .073794 .433036 L .073794 .306536 L .138794 .306536 L .138794 .433036 Z'",
  "b:'M -.024223 .296536 L -.024223 .231536 L .240777 .231536 L .240777 .296536 Z'",
  "aBottom:'M .073794 .221536 L .073794 .095036 L .138794 .095036 L .138794 .221536 Z'",
  'const DIGIT_TOP_IN=.0322398905011428;',
  'const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN,MM_TO_U=U/25.4;',
  'const UPPER_ADVANCE_IN=.420,REGISTER_ADVANCE_IN=.410;',
  'const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);',
  'const BAR_H_IN=.060;',
  'const REGISTER_GAP_IN=.060;',
  'const FIRST_DIGIT_X_IN=.180;',
  'const RIGHT_FIELD_X_IN=1.434549;',
  'const UPPER_GROUP_X_OFFSET_IN=1.470;',
  'const REGISTER_ROW_X_IN=-.010;',
  'const PROG_TOP_IN=.315;',
  'const VERB_NOUN_TO_FIRST_BAR_CENTER_IN=.560;'
])req(web,marker,'WebView accepted datum/sign');

for(const marker of [
  'private static final float U=106f/2.360f,DIGIT_TOP_IN=.0322398905f;',
  'REG_ADV=.410f*U,FIRST_DIGIT_X=.180f*U,REGISTER_ROW_X=-.010f*U;',
  'LEFT_FIELD_X=-.035451f*U,RIGHT_FIELD_X=1.434549f*U;',
  'PROG_Y=.315f*U,VERB_NOUN_Y=1.220f*U;',
  'case 1: // b: physical H / upper right',
  '.438152000f,.032239891f,true);ml(p,ox,oy,.370443000f,.284562891f',
  'case 2: // c: physical M / lower right',
  '.435059000f,.294562891f,true);ml(p,ox,oy,.367759000f,.294562891f',
  'case 4: // e: physical K / lower left',
  '.117759000f,.294562891f,true);ml(p,ox,oy,.053885898f,.532591879f',
  'case 5: // f: physical F / upper left',
  '.187742000f,.284562891f,true);ml(p,ox,oy,.233934000f,.112425891f',
  'rawBox(ox,oy,-.024223f,.231536f,.265000f,.065000f)',
  'FRAME_X=-1.537f,FRAME_W=107.537f,FRAME_H=23f;',
  '(ACTIVE_X+FRAME_X)*scaleDp',
  'ACTIVE_W-FRAME_X',
  'setViewLayoutWidth(flippers[i],FRAME_W*scaleDp',
  'rawBox(ox,oy,.073794f,.306536f,.065000f,.126500f)',
  'rawBox(ox,oy,.073794f,.095036f,.065000f,.126500f)'
])req(native,marker,'native widget accepted geometry');

for(const marker of [
  'const FACE_W_IN=2.360, U=106/FACE_W_IN, DIGIT_TOP_IN=.0322398905011428;',
  'const REG_ADV_IN=.410, FIRST_DIGIT_X_IN=.180, REGISTER_ROW_X_IN=-.010;',
  'android:width="107.537dp"',
  'android:viewportWidth="107.537"',
  'android:translateX="1.537"',
  'px(ox,.199003944)', 'px(ox,.427798000)', 'py(.032239891)',
  'px(ox,.438152000)', 'px(ox,.505451000)', 'py(.284562891)',
  'px(ox,.435059000)', 'px(ox,.325740000)', 'py(.451148891)',
  'px(ox,.117759000)', 'px(ox,.053885898)', 'px(ox,.185059000)',
  'px(ox,.187742000)', 'px(ox,.233934000)', 'px(ox,.188151849)',
  'rawRect(REGISTER_ROW_X_IN,.073794,.306536,.065000,.126500)',
  'rawRect(REGISTER_ROW_X_IN,-.024223,.231536,.265000,.065000)',
  'rawRect(REGISTER_ROW_X_IN,.073794,.095036,.065000,.126500)'
])req(generated,marker,'generated-seconds accepted geometry');

for(const marker of [
  'width:min(calc(100vw - 32px),calc(100vh * 106 / 182.356))!important',
  'overflow:visible!important;',
  'height:min(100vh,calc((100vw - 32px) * 182.356 / 106))!important',
  'transform:translate(-50%,-50%)!important'
])req(screenOnly,marker,'screen-only accepted face geometry');

const insetFaceWidth='width:min(calc(100vw - 32px),calc(100vh * 106 / 182.356))!important';
if(screenOnly.split(insetFaceWidth).length-1!==2){
  fail('screen-only EL face and parallax backing must share the inset width');
}

const U=106/2.360,signMin=(-.010-.024223)*U,rightMax=(1.434549+.420+.505451)*U;
if(Math.abs(signMin+1.537)>.001||Math.abs(rightMax-106)>.001)fail('edge overhang changed unexpectedly');
if(!index.includes('viewBox="0 0 106 182.356"'))fail('EL viewBox changed');
if(!index.includes('x="-1.537" y="0" width="107.537" height="182.356"'))fail('EL glass does not cover sign overhang');
if(!screenOnly.includes('overflow:visible!important;'))fail('screen-only viewport clips overhang');
console.log('EL geometry lock: PASS');
console.log('  1006315G digit/sign polygons, datums, generated frames, and screen-only aspect are frozen');
