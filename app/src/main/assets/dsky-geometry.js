'use strict';

/*
 * Apollo Block II DSKY EL geometry.
 *
 * Source of truth: MIT/IL SCD 1006315G. Segment and sign solids are transcribed
 * from the drawing-backed rrainey/agc-mechanical-cad 1006315G-exact.step model
 * (commit 2d7dccd5bc4f0263a14ac5a4fd112a15d447010d). The renderer service owns
 * the implementation slots; this late drawing-geometry layer installs those
 * slots through AGCDSKY_RENDERER and does not depend on replica SVG geometry,
 * the generic compatibility registry, or parser globals.
 */
(() => {
  const geometryState=window.AGCDSKY_APP_STATE;
  const renderer=window.AGCDSKY_RENDERER;
  const shell=window.AGCDSKY_SHELL;
  const clock=window.AGCDSKY_CLOCK;
  const display=window.AGCDSKY_DISPLAY;
  if(!geometryState)throw new Error('Shared application state unavailable');
  if(!renderer||!shell||!clock||!display)throw new Error('DSKY geometry service dependencies unavailable');

  /*
   * Exact 1006315G digit electrodes in inches, in the STEP component datum.
   * The model contains seven independent 0.010-in-thick EL solids. Two of the
   * electrodes preserve the drawing/model straight-edge intersections rather
   * than being flattened into a generic seven-segment font.
   */
  const SEGMENT_PATH_IN=Object.freeze({
    a:'M .420955898 .102240 L .490955898 .032240 L .198141898 .032240 L .236572898 .102240 Z',
    b:'M .124277898 .269917 L .191577898 .269917 L .2335968980 .113331 L .187590898 .033978 Z',
    c:'M .121184898 .532240 L .188893898 .279917 L .121594898 .279917 L .505451 .532240 Z',
    d:'M .360332954 .532240 L .322647898 .467240 L .148980898 .467240 L .131538898 .532240 Z',
    e:'M .371594898 .279917 L .325402898 .452054 L .371185049 .532239310 L .438893898 .279917 Z',
    f:'M .441577898 .269917 L .505451 .031888012 L .413468898 .123869 L .374277898 .269917 Z',
    g:'M .3525668980 .312240 L .370009898 .247240 L .2080168980 .247240 L .190574898 .312240 Z'
  });
  const DIGIT_TOP_IN=.0322398905011428;
  const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN,MM_TO_U=U/25.4;
  const DIGIT_H=.500*U;
  const UPPER_ADVANCE_IN=.420,REGISTER_ADVANCE_IN=.410;
  const UPPER_ADVANCE=UPPER_ADVANCE_IN*U,REGISTER_ADVANCE=REGISTER_ADVANCE_IN*U;
  const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);
  const BAR_H_IN=.060;
  const REGISTER_GAP_IN=.070;
  const BAR_CENTER_Y=BAR_FROM_BOTTOM_IN.map(v=>(FACE_H_IN-v)*U);
  const REGISTER_Y=BAR_CENTER_Y.map(c=>c+(BAR_H_IN*.5+REGISTER_GAP_IN)*U);

  function segment(name){
    return `<path class="el-seg on" data-seg="${name}" d="${SEGMENT_PATH_IN[name]}"/>`;
  }

  function apolloGlyph(ch,xIn){
    const lit=renderer.segmentPattern(ch);
    const paths=Array.from(lit).map(segment).join('');
    return `<g class="el-glyph" transform="translate(${Number(xIn*U).toFixed(3)} 0) scale(${U.toFixed(6)}) translate(0 ${(-DIGIT_TOP_IN).toFixed(6)})">${paths}</g>`;
  }

  /*
   * 1006315G register sign electrodes, again in the STEP component datum.
   * A is the two vertical electrodes used by '+'. B is the horizontal
   * electrode used by both '+' and '-'. Their relative placement to the
   * numeric digit is preserved from the source model.
   */
  const SIGN_PATH_IN=Object.freeze({
    aTop:'M .073794 .387908 L .073794 .305065 L .138794 .305065 L .138794 .387908 Z',
    b:'M -.007784 .296536 L -.007784 .231536 L .224338 .231536 L .224338 .296536 Z',
    aBottom:'M .073794 .221536 L .073794 .139908 L .138794 .139908 L .138794 .221536 Z'
  });
  function signPath(name,segmentName){
    return `<path class="el-seg on" data-sign-seg="${segmentName}" d="${SIGN_PATH_IN[name]}"/>`;
  }
  function apolloSignGlyph(sign){
    const a=sign==='+',b=a||sign==='-';
    if(!a&&!b)return '';
    const paths=(a?signPath('aTop','A')+signPath('aBottom','A'):'')+(b?signPath('b','B'):'');
    return `<g class="el-sign" transform="scale(${U.toFixed(6)}) translate(0 ${(-DIGIT_TOP_IN).toFixed(6)})">${paths}</g>`;
  }

  function apolloRenderDigits(el,text){
    let out='',glyph=renderer.implementation('glyph');
    String(text).split('').forEach((ch,i)=>{out+=glyph(ch,i*UPPER_ADVANCE_IN);});
    el.innerHTML=out;
  }
  const FIRST_DIGIT_X_IN=.180;
  function apolloRenderReg(el,text){
    text=String(text);
    const signGlyph=renderer.implementation('signGlyph'),glyph=renderer.implementation('glyph');
    let out=signGlyph(text[0]);
    text.slice(1).split('').forEach((ch,i)=>{out+=glyph(ch,FIRST_DIGIT_X_IN+i*REGISTER_ADVANCE_IN);});
    el.innerHTML=out;
  }

  renderer.installImplementation('glyph',apolloGlyph,'Apollo drawing geometry');
  renderer.installImplementation('signGlyph',apolloSignGlyph,'Apollo drawing geometry');
  renderer.installImplementation('renderDigits',apolloRenderDigits,'Apollo drawing geometry');
  renderer.installImplementation('renderReg',apolloRenderReg,'Apollo drawing geometry');

  const RIGHT_FIELD_X_IN=1.434549;
  const UPPER_GROUP_X_OFFSET_IN=1.470;
  const LEFT_FIELD_X_IN=RIGHT_FIELD_X_IN-UPPER_GROUP_X_OFFSET_IN;
  const REGISTER_ROW_X_IN=-.010;
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
    r1:`translate(${(REGISTER_ROW_X_IN*U).toFixed(3)} ${REGISTER_Y[0].toFixed(3)})`,
    r2:`translate(${(REGISTER_ROW_X_IN*U).toFixed(3)} ${REGISTER_Y[1].toFixed(3)})`,
    r3:`translate(${(REGISTER_ROW_X_IN*U).toFixed(3)} ${REGISTER_Y[2].toFixed(3)})`
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
    source:'MIT/IL SCD 1006315G via drawing-backed 1006315G-exact.step; no replica SVG segment geometry',
    faceWidthIn:FACE_W_IN,
    faceHeightIn:FACE_H_IN,
    detailCDatumWidthIn:.320,
    digitHeightIn:.500,
    upperPitchIn:.420,
    registerPitchIn:.410,
    mmToPanel:MM_TO_U,
    firstRegisterDigitDatumIn:FIRST_DIGIT_X_IN,
    registerRowDatumIn:REGISTER_ROW_X_IN,
    leftUpperDatumIn:LEFT_FIELD_X_IN,
    rightUpperDatumIn:RIGHT_FIELD_X_IN,
    upperGroupHorizontalSeparationIn:UPPER_GROUP_X_OFFSET_IN,
    progTopIn:PROG_TOP_IN,
    firstBarCenterFromTopIn:FIRST_BAR_CENTER_FROM_TOP_IN,
    verbNounToFirstBarCenterIn:VERB_NOUN_TO_FIRST_BAR_CENTER_IN,
    verbNounTopIn:VERB_NOUN_TOP_IN,
    upperRowVerticalSeparationIn:UPPER_ROW_Y_OFFSET_IN,
    upperDigitToSeparatorClearanceIn:UPPER_CLEARANCE_IN,
    signWidthIn:.232122,
    signHeightIn:.248000,
    signThicknessIn:.065,
    upperAdvance:UPPER_ADVANCE,
    registerAdvance:REGISTER_ADVANCE,
    barFromBottomIn:BAR_FROM_BOTTOM_IN,
    barCenterY:BAR_CENTER_Y,
    registerY:REGISTER_Y
  });
})();