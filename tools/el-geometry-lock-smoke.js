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

// Accepted 1006315G geometry. Any change requires new drawing-backed evidence.
const webPaths=[
  "a:'M .420955898 .102240 L .490955898 .032240 L .198141898 .032240 L .236572898 .102240 Z'",
  "b:'M .441577898 .269917 L .505451 .031888012 L .413468898 .123869 L .374277898 .269917 Z'",
  "c:'M .371594898 .279917 L .325402898 .452054 L .371185049 .532239310 L .438893898 .279917 Z'",
  "d:'M .360332954 .532240 L .322647898 .467240 L .148980898 .467240 L .131538898 .532240 Z'",
  "e:'M .121184898 .532240 L .188893898 .279917 L .121594898 .279917 L .053885898 .532240 Z'",
  "f:'M .124277898 .269917 L .191577898 .269917 L .2335968980 .113331 L .187590898 .033978 Z'",
  "g:'M .3525668980 .312240 L .370009898 .247240 L .2080168980 .247240 L .190574898 .312240 Z'"
];
for(const p of webPaths)req(web,p,'WebView segment polygon');

for(const marker of [
  "aTop:'M .073794 .387908 L .073794 .305065 L .138794 .305065 L .138794 .387908 Z'",
  "b:'M -.007784 .296536 L -.007784 .231536 L .224338 .231536 L .224338 .296536 Z'",
  "aBottom:'M .073794 .221536 L .073794 .139908 L .138794 .139908 L .138794 .221536 Z'",
  'const DIGIT_TOP_IN=.0322398905011428;',
  'const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN,MM_TO_U=U/25.4;',
  'const UPPER_ADVANCE_IN=.420,REGISTER_ADVANCE_IN=.410;',
  'const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);',
  'const BAR_H_IN=.060;',
  'const REGISTER_GAP_IN=.070;',
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
  'case 1: // b: physical right upper',
  '.441577898f,.269917f,true);ml(p,ox,oy,.505451f,.031888012f',
  'case 2: // c: physical right lower',
  '.371594898f,.279917f,true);ml(p,ox,oy,.325402898f,.452054f',
  'case 4: // e: physical left lower',
  '.121184898f,.532240f,true);ml(p,ox,oy,.188893898f,.279917f',
  'case 5: // f: physical left upper',
  '.124277898f,.269917f,true);ml(p,ox,oy,.191577898f,.269917f',
  'rawBox(ox,oy,-.007784f,.231536f,.232122f,.065000f)',
  'rawBox(ox,oy,.073794f,.305065f,.065000f,.082843f)',
  'rawBox(ox,oy,.073794f,.139908f,.065000f,.081628f)'
])req(native,marker,'native widget accepted geometry');

for(const marker of [
  'const FACE_W_IN=2.360, U=106/FACE_W_IN, DIGIT_TOP_IN=.0322398905011428;',
  'const REG_ADV_IN=.410, FIRST_DIGIT_X_IN=.180, REGISTER_ROW_X_IN=-.010;',
  'px(ox,.420955898)', 'px(ox,.490955898)', 'py(.032240)',
  'px(ox,.441577898)', 'px(ox,.505451)', 'py(.031888012)',
  'px(ox,.371594898)', 'px(ox,.325402898)', 'py(.452054)',
  'px(ox,.121184898)', 'px(ox,.188893898)', 'px(ox,.053885898)',
  'px(ox,.124277898)', 'px(ox,.191577898)', 'px(ox,.2335968980)',
  'rawRect(REGISTER_ROW_X_IN,.073794,.305065,.065000,.082843)',
  'rawRect(REGISTER_ROW_X_IN,-.007784,.231536,.232122,.065000)',
  'rawRect(REGISTER_ROW_X_IN,.073794,.139908,.065000,.081628)'
])req(generated,marker,'generated-seconds accepted geometry');

for(const marker of [
  'width:min(100vw,calc(100vh * 106 / 182.356))!important',
  'height:min(100vh,calc(100vw * 182.356 / 106))!important',
  'transform:translate(-50%,-50%)!important'
])req(screenOnly,marker,'screen-only accepted face geometry');

console.log('EL geometry lock: PASS');
console.log('  1006315G digit/sign polygons, datums, generated frames, and screen-only aspect are frozen');
