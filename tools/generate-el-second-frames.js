'use strict';

const fs = require('fs');
const path = require('path');

const outRoot = process.argv[2];
if (!outRoot) throw new Error('usage: node generate-el-second-frames.js <generated-res-dir>');
const drawable = path.join(outRoot, 'drawable');
fs.rmSync(outRoot, {recursive: true, force: true});
fs.mkdirSync(drawable, {recursive: true});

// MIT/IL SCD 1006315G geometry transcribed from the drawing-backed
// 1006315G-exact.step model. Coordinates are inches in the STEP component datum.
const FACE_W_IN=2.360, U=106/FACE_W_IN, DIGIT_TOP_IN=.0322398905011428;
const REG_ADV_IN=.410, FIRST_DIGIT_X_IN=.180, REGISTER_ROW_X_IN=-.010;

// Comanche RELTAB low-five-bit relay codes.  Generated launcher frames show
// the settled state produced by the same physical K1..K5 contact matrix used by
// the WebView and native WidgetRelayModel.  Android RemoteViews cannot reliably
// repaint at the real relay's sub-20-ms contact-bounce times, so transient
// armature motion stays in the native hardware model while these resources are
// the guaranteed settled result.
const DIGIT_RELAY=[21,3,25,27,15,30,28,19,29,31];
function segmentsForRelayCode(value){
  const code=Number(value)&0x1f;
  const k1=(code>>0)&1,k2=(code>>1)&1,k3=(code>>2)&1,k4=(code>>3)&1,k5=(code>>4)&1;
  const E=!!k5,F=!!k3,H=!!k1,J=!!k4;
  const K=!k2&&E;
  const M=!k2?F:true;
  const internal=!k3?J:true;
  const N=!!k5&&internal;
  let segments='';
  if(E)segments+='a';
  if(H)segments+='b';
  if(M)segments+='c';
  if(N)segments+='d';
  if(K)segments+='e';
  if(F)segments+='f';
  if(J)segments+='g';
  return segments;
}

// Exact 1006315G register sign and seven digit electrodes.
const n=v=>Number(v).toFixed(3).replace(/\.000$/,'');
const px=(ox,x)=>n((ox+x)*U);
const py=y=>n((y-DIGIT_TOP_IN)*U);
const rawRect=(ox,x,y,w,h)=>{
  const x0=(ox+x)*U,y0=(y-DIGIT_TOP_IN)*U,x1=x0+w*U,y1=y0+h*U;
  return `M${n(x0)},${n(y0)} L${n(x1)},${n(y0)} L${n(x1)},${n(y1)} L${n(x0)},${n(y1)} Z`;
};
function digitPath(logical,ox){
  const A=(r)=>n(r*U);
  switch(logical){
    case 0:return `M${px(ox,.138381)},${py(.102240)} L${px(ox,.070702)},${py(.034561)} A${A(.020)},${A(.020)} 0 0 1 ${px(ox,.080054)},${py(.032240)} L${px(ox,.361195)},${py(.032240)} L${px(ox,.322764)},${py(.102240)} Z`;
    case 1:return `M${px(ox,.435059)},${py(.269917)} L${px(ox,.367759)},${py(.269917)} L${px(ox,.325740)},${py(.113331)} L${px(ox,.371746)},${py(.033978)} Z`;
    case 2:return `M${px(ox,.438152)},${py(.532240)} L${px(ox,.370443)},${py(.279917)} L${px(ox,.437742)},${py(.279917)} L${px(ox,.505451)},${py(.532240)} Z`;
    case 3:return `M${px(ox,.203493)},${py(.532240)} A${A(.020)},${A(.020)} 0 0 1 ${px(ox,.199266)},${py(.531788)} L${px(ox,.236689)},${py(.467240)} L${px(ox,.410356)},${py(.467240)} L${px(ox,.427798)},${py(.532240)} Z`;
    case 4:return `M${px(ox,.187742)},${py(.279917)} L${px(ox,.233934)},${py(.452054)} L${px(ox,.190763)},${py(.527666)} A${A(.020)},${A(.020)} 0 0 1 ${px(ox,.184176)},${py(.517423)} L${px(ox,.120443)},${py(.279917)} Z`;
    case 5:return `M${px(ox,.117759)},${py(.269917)} L${px(ox,.060738)},${py(.057423)} A${A(.020)},${A(.020)} 0 0 1 ${px(ox,.063306)},${py(.041308)} L${px(ox,.145868)},${py(.123869)} L${px(ox,.185059)},${py(.269917)} Z`;
    case 6:return `M${px(ox,.206770)},${py(.312240)} L${px(ox,.189327)},${py(.247240)} L${px(ox,.351320)},${py(.247240)} L${px(ox,.368762)},${py(.312240)} Z`;
    default:throw new Error('bad segment '+logical);
  }
}

// User-tuned blue-green EL while retaining the green-dominant 530-nm look.
const EL_COLOR='#6DECB4';

for (let sec=0; sec<60; sec++) {
  const paths=[
    rawRect(REGISTER_ROW_X_IN,.073794,.305065,.065000,.082843),
    rawRect(REGISTER_ROW_X_IN,-.007784,.231536,.232122,.065000),
    rawRect(REGISTER_ROW_X_IN,.073794,.139908,.065000,.081628),
  ];
  const text=`000${String(sec).padStart(2,'0')}`;
  [...text].forEach((ch,i)=>{
    const lit=segmentsForRelayCode(DIGIT_RELAY[Number(ch)]);
    const ox=REGISTER_ROW_X_IN+FIRST_DIGIT_X_IN+i*REG_ADV_IN;
    [...'abcdefg'].forEach((name,logical)=>{
      if (lit.includes(name)) paths.push(digitPath(logical,ox));
    });
  });
  const body=paths.map(p=>`    <path android:fillColor="${EL_COLOR}" android:pathData="${p}" />`).join('\n');
  const xml=`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="106dp"\n    android:height="23dp"\n    android:viewportWidth="106"\n    android:viewportHeight="23">\n${body}\n</vector>\n`;
  fs.writeFileSync(path.join(drawable,`el_sec_${String(sec).padStart(2,'0')}.xml`),xml);
}
console.log(`generated 60 physical-datum Apollo relay-matrix EL second frames in ${drawable}`);
