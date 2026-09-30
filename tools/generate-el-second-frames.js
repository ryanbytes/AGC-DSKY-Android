'use strict';

const fs = require('fs');
const path = require('path');

const outRoot = process.argv[2];
if (!outRoot) throw new Error('usage: node generate-el-second-frames.js <generated-res-dir>');
const drawable = path.join(outRoot, 'drawable');
fs.rmSync(outRoot, {recursive: true, force: true});
fs.mkdirSync(drawable, {recursive: true});

// MIT/IL SCD 1006315G nominal sign dimensions and STEP-derived digit geometry.
// Coordinates are inches in the shared component datum.
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

// 1006315G Detail A nominal sign islands and seven digit electrodes.
const n=v=>Number(v).toFixed(3).replace(/\.000$/,'');
const px=(ox,x)=>n((ox+x)*U);
const py=y=>n((y-DIGIT_TOP_IN)*U);
const rawRect=(ox,x,y,w,h)=>{
  const x0=(ox+x)*U,y0=(y-DIGIT_TOP_IN)*U,x1=x0+w*U,y1=y0+h*U;
  return `M${n(x0)},${n(y0)} L${n(x1)},${n(y0)} L${n(x1)},${n(y1)} L${n(x0)},${n(y1)} Z`;
};
function digitPath(logical,ox){
  switch(logical){
    case 0:return `M${px(ox,.199003944)},${py(.032239891)} L${px(ox,.236689000)},${py(.097239891)} L${px(ox,.410356000)},${py(.097239891)} L${px(ox,.427798000)},${py(.032239891)} Z`; // a: E / top
    case 1:return `M${px(ox,.438152000)},${py(.032239891)} L${px(ox,.370443000)},${py(.284562891)} L${px(ox,.437742000)},${py(.284562891)} L${px(ox,.505451000)},${py(.032239891)} Z`; // b: H / upper right
    case 2:return `M${px(ox,.435059000)},${py(.294562891)} L${px(ox,.367759000)},${py(.294562891)} L${px(ox,.325740000)},${py(.451148891)} L${px(ox,.371746000)},${py(.530501891)} Z`; // c: M / lower right
    case 3:return `M${px(ox,.138381000)},${py(.462239891)} L${px(ox,.068381000)},${py(.532239891)} L${px(ox,.361195000)},${py(.532239891)} L${px(ox,.322764000)},${py(.462239891)} Z`; // d: N / bottom
    case 4:return `M${px(ox,.117759000)},${py(.294562891)} L${px(ox,.053885898)},${py(.532591879)} L${px(ox,.145868000)},${py(.440610891)} L${px(ox,.185059000)},${py(.294562891)} Z`; // e: K / lower left
    case 5:return `M${px(ox,.187742000)},${py(.284562891)} L${px(ox,.233934000)},${py(.112425891)} L${px(ox,.188151849)},${py(.032240581)} L${px(ox,.120443000)},${py(.284562891)} Z`; // f: F / upper left
    case 6:return `M${px(ox,.206770000)},${py(.252239891)} L${px(ox,.189327000)},${py(.317239891)} L${px(ox,.351320000)},${py(.317239891)} L${px(ox,.368762000)},${py(.252239891)} Z`; // g: J / middle
    default:throw new Error('bad segment '+logical);
  }
}

// User-tuned blue-green EL while retaining the green-dominant 530-nm look.
const EL_COLOR='#6DECB4';

for (let sec=0; sec<60; sec++) {
  const paths=[
    rawRect(REGISTER_ROW_X_IN,.073794,.306536,.065000,.126500),
    rawRect(REGISTER_ROW_X_IN,-.024223,.231536,.265000,.065000),
    rawRect(REGISTER_ROW_X_IN,.073794,.095036,.065000,.126500),
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
  const xml=`<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="107.537dp"\n    android:height="23dp"\n    android:viewportWidth="107.537"\n    android:viewportHeight="23">\n    <group android:translateX="1.537">\n${body}\n    </group>\n</vector>\n`;
  fs.writeFileSync(path.join(drawable,`el_sec_${String(sec).padStart(2,'0')}.xml`),xml);
}
console.log(`generated 60 physical-datum Apollo relay-matrix EL second frames in ${drawable}`);