'use strict';

/*
 * Apollo Block II DSKY EL geometry.
 *
 * Source of truth: MIT/IL SCD 1006315G plus the metric segment trace from
 * DSKY V2.svg. The renderer service owns the implementation slots; this late
 * drawing-geometry layer installs those slots through AGCDSKY_RENDERER and
 * does not depend on the generic compatibility registry or parser globals.
 */
(() => {
  const geometryState=window.AGCDSKY_APP_STATE;
  const renderer=window.AGCDSKY_RENDERER;
  const shell=window.AGCDSKY_SHELL;
  const clock=window.AGCDSKY_CLOCK;
  const display=window.AGCDSKY_DISPLAY;
  if(!geometryState)throw new Error('Shared application state unavailable');
  if(!renderer||!shell||!clock||!display)throw new Error('DSKY geometry service dependencies unavailable');

  const SOURCE = Object.freeze({
    a: 'M 95.137274,86.827056 l 1.10725,-1.523997 h -6.1558 l 0.40836,1.523997 z',
    f: 'M 91.361734,91.526056 l -1.66745,-6.222997 h -1.57776 l 1.66745,6.222997 z',
    e: 'M 89.886064,91.907059 h 1.57776 l 1.15699,4.317939 -1.1639,1.544551 z',
    d: 'M 93.002124,96.352056 l -1.24411,1.651003 h 7.812 l -2.15162,-1.651003 z',
    b: 'M 95.390774,87.126332 l 1.15266,-1.5865 1.60401,5.986224 h -1.57776 z',
    c: 'M 96.671774,91.907059 h 1.57776 l 1.55242,5.793732 -1.98611,-1.524 z',
    g: 'M 96.005094,90.891059 l 0.44238,1.651 h -4.41906 l -0.44239,-1.651 z'
  });

  const SRC_X=88.116524,SRC_Y=85.303059,SRC_W=11.685430;
  const MIRROR_X=2*SRC_X+SRC_W;
  const DATUM_X=MIRROR_X-96.244524;
  const SOURCE_FOR_LOGICAL=Object.freeze({a:'a',b:'f',c:'e',d:'d',e:'c',f:'b',g:'g'});

  const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN;
  const MM_TO_U=U/25.4;
  const DIGIT_H=.500*U;
  const UPPER_ADVANCE=.420*U;
  const REGISTER_ADVANCE=.410*U;
  const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);
  const BAR_H_IN=.060;
  const REGISTER_GAP_IN=.070;
  const BAR_CENTER_Y=BAR_FROM_BOTTOM_IN.map(v=>(FACE_H_IN-v)*U);
  const REGISTER_Y=BAR_CENTER_Y.map(c=>c+(BAR_H_IN*.5+REGISTER_GAP_IN)*U);

  function segment(name){
    const sourceName=SOURCE_FOR_LOGICAL[name];
    return `<path class="el-seg on" data-seg="${name}" d="${SOURCE[sourceName]}"/>`;
  }

  function apolloGlyph(ch,x){
    const lit=renderer.segmentPattern(ch);
    const paths=Array.from(lit).map(segment).join('');
    return `<g class="el-glyph" transform="translate(${Number(x).toFixed(3)} 0) scale(${MM_TO_U.toFixed(6)}) translate(${-DATUM_X.toFixed(6)} ${-SRC_Y})"><g transform="matrix(-1 0 0 1 ${MIRROR_X.toFixed(6)} 0)">${paths}</g></g>`;
  }

  const SIGN_W=.265*U,SIGN_H=.338*U,SIGN_T=.065*U,SIGN_X=.025*U,SIGN_GAP=.010*U;
  const SIGN_TOP=(DIGIT_H-SIGN_H)*.5;
  const SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)*.5;
  const SIGN_A_H=(SIGN_H-SIGN_T-2*SIGN_GAP)*.5;
  const SIGN_HY=SIGN_TOP+SIGN_A_H+SIGN_GAP;
  const SIGN_LOWER_Y=SIGN_HY+SIGN_T+SIGN_GAP;
  function signB(on){
    if(!on)return '';
    return `<path class="el-seg on" data-sign-seg="B" d="M ${SIGN_X.toFixed(3)},${SIGN_HY.toFixed(3)} h ${SIGN_W.toFixed(3)} v ${SIGN_T.toFixed(3)} h ${(-SIGN_W).toFixed(3)} z"/>`;
  }
  function signA(on){
    if(!on)return '';
    const top=`<path class="el-seg on" data-sign-seg="A" d="M ${SIGN_VX.toFixed(3)},${SIGN_TOP.toFixed(3)} h ${SIGN_T.toFixed(3)} v ${SIGN_A_H.toFixed(3)} h ${(-SIGN_T).toFixed(3)} z"/>`;
    const bottom=`<path class="el-seg on" data-sign-seg="A" d="M ${SIGN_VX.toFixed(3)},${SIGN_LOWER_Y.toFixed(3)} h ${SIGN_T.toFixed(3)} v ${SIGN_A_H.toFixed(3)} h ${(-SIGN_T).toFixed(3)} z"/>`;
    return top+bottom;
  }
  function apolloSignGlyph(sign){const a=sign==='+',b=a||sign==='-';return `<g class="el-sign">${signA(a)}${signB(b)}</g>`;}

  function apolloRenderDigits(el,text){
    let out='',glyph=renderer.implementation('glyph');
    String(text).split('').forEach((ch,i)=>{out+=glyph(ch,i*UPPER_ADVANCE);});
    el.innerHTML=out;
  }
  const FIRST_DIGIT_X=.400*U;
  function apolloRenderReg(el,text){
    text=String(text);
    const signGlyph=renderer.implementation('signGlyph'),glyph=renderer.implementation('glyph');
    let out=signGlyph(text[0]);
    text.slice(1).split('').forEach((ch,i)=>{out+=glyph(ch,FIRST_DIGIT_X+i*REGISTER_ADVANCE);});
    el.innerHTML=out;
  }

  renderer.installImplementation('glyph',apolloGlyph,'Apollo drawing geometry');
  renderer.installImplementation('signGlyph',apolloSignGlyph,'Apollo drawing geometry');
  renderer.installImplementation('renderDigits',apolloRenderDigits,'Apollo drawing geometry');
  renderer.installImplementation('renderReg',apolloRenderReg,'Apollo drawing geometry');

  const RIGHT_FIELD_X_IN=1.620;
  const UPPER_GROUP_X_OFFSET_IN=1.470;
  const LEFT_FIELD_X_IN=RIGHT_FIELD_X_IN-UPPER_GROUP_X_OFFSET_IN;
  const PROG_TOP_IN=.315;
  const FIRST_BAR_CENTER_FROM_TOP_IN=FACE_H_IN-BAR_FROM_BOTTOM_IN[0];
  const VERB_NOUN_TO_FIRST_BAR_CENTER_IN=.560;
  const VERB_NOUN_TOP_IN=FIRST_BAR_CENTER_FROM_TOP_IN-VERB_NOUN_TO_FIRST_BAR_CENTER_IN;
  const UPPER_ROW_Y_OFFSET_IN=VERB_NOUN_TOP_IN-PROG_TOP_IN;
  const UPPER_CLEARANCE_IN=FIRST_BAR_CENTER_FROM_TOP_IN-(BAR_H_IN*.5)-(VERB_NOUN_TOP_IN+.500);
  const LEFT_FIELD_X=LEFT_FIELD_X_IN*U,RIGHT_FIELD_X=RIGHT_FIELD_X_IN*U;
  const PROG_Y=PROG_TOP_IN*U,VERB_NOUN_Y=VERB_NOUN_TOP_IN*U;
  const transforms=Object.freeze({
    prog:`translate(${RIGHT_FIELD_X.toFixed(3)} ${PROG_Y.toFixed(3)})`,
    verb:`translate(${LEFT_FIELD_X.toFixed(3)} ${VERB_NOUN_Y.toFixed(3)})`,
    noun:`translate(${RIGHT_FIELD_X.toFixed(3)} ${VERB_NOUN_Y.toFixed(3)})`,
    r1:`translate(0 ${REGISTER_Y[0].toFixed(3)})`,
    r2:`translate(0 ${REGISTER_Y[1].toFixed(3)})`,
    r3:`translate(0 ${REGISTER_Y[2].toFixed(3)})`
  });
  for(const [id,transform] of Object.entries(transforms)){
    const node=document.getElementById(id);
    if(node)node.setAttribute('transform',transform);
  }

  if(geometryState.mode==='agc'||geometryState.mode==='agc-loading'){
    display.renderSnapshot();
  }else{
    renderer.set2('prog','00');
    shell.show(geometryState.verb,geometryState.noun);
    ['r1','r2','r3'].forEach(name=>clock.renderReg(name));
  }

  function restoreClockProg(){
    if(geometryState.mode!=='clock'||clock.lampTestActive())return;
    const prog=document.getElementById('prog');
    if(prog)renderer.renderDigits(prog,'00');
  }
  setTimeout(restoreClockProg,0);
  window.addEventListener('load',restoreClockProg,{once:true});
  window.addEventListener('pageshow',restoreClockProg,{passive:true});

  window.DSKY_DRAWING_GEOMETRY=Object.freeze({
    source:'MIT/IL SCD 1006315G plus metric DSKY V2 segment trace; uniform physical scale',
    faceWidthIn:FACE_W_IN,
    faceHeightIn:FACE_H_IN,
    detailCDatumWidthIn:.320,
    digitHeightIn:.500,
    upperPitchIn:.420,
    registerPitchIn:.410,
    mmToPanel:MM_TO_U,
    firstRegisterDigitDatumIn:.400,
    leftUpperDatumIn:LEFT_FIELD_X_IN,
    rightUpperDatumIn:RIGHT_FIELD_X_IN,
    upperGroupHorizontalSeparationIn:UPPER_GROUP_X_OFFSET_IN,
    progTopIn:PROG_TOP_IN,
    firstBarCenterFromTopIn:FIRST_BAR_CENTER_FROM_TOP_IN,
    verbNounToFirstBarCenterIn:VERB_NOUN_TO_FIRST_BAR_CENTER_IN,
    verbNounTopIn:VERB_NOUN_TOP_IN,
    upperRowVerticalSeparationIn:UPPER_ROW_Y_OFFSET_IN,
    upperDigitToSeparatorClearanceIn:UPPER_CLEARANCE_IN,
    signWidthIn:.265,
    signHeightIn:.338,
    signThicknessIn:.065,
    signSegmentGapIn:.010,
    upperAdvance:UPPER_ADVANCE,
    registerAdvance:REGISTER_ADVANCE,
    barFromBottomIn:BAR_FROM_BOTTOM_IN,
    barCenterY:BAR_CENTER_Y,
    registerY:REGISTER_Y
  });
})();
