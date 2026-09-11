'use strict';

/*
 * Apollo Block II DSKY EL geometry.
 *
 * Source of truth: MIT/IL SCD 1006315G plus the metric segment trace from
 * DSKY V2.svg.  The trace already implements the drawing: 12.700 mm = .500 in
 * high, nominal .065-in segment thickness, 15-degree side slope, and the
 * drawing's .320-in REF datum-to-edge dimension.  Do not squeeze the trace to
 * a .320-in bounding box: .320 is a datum dimension in Detail C, not the full
 * slanted glyph bounding width.
 */
(() => {
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
  // After horizontal mirroring, this is the Detail-C digit datum.  From this
  // datum to the rightmost segment edge is exactly 8.128 mm = .320 in.
  const DATUM_X=MIRROR_X-96.244524;
  const SOURCE_FOR_LOGICAL=Object.freeze({a:'a',b:'f',c:'e',d:'d',e:'c',f:'b',g:'g'});

  const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN;
  const MM_TO_U=U/25.4;
  const DIGIT_H=.500*U;
  const UPPER_ADVANCE=.420*U;
  const REGISTER_ADVANCE=.410*U;

  // Sheet 2 register-bar dimension chain.
  const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);
  const BAR_H_IN=.060;
  const REGISTER_GAP_IN=.070;
  const BAR_CENTER_Y=BAR_FROM_BOTTOM_IN.map(v=>(FACE_H_IN-v)*U);
  const REGISTER_Y=BAR_CENTER_Y.map(c=>c+(BAR_H_IN*.5+REGISTER_GAP_IN)*U);

  function segment(name,on){
    const sourceName=SOURCE_FOR_LOGICAL[name];
    return `<path class="el-seg ${on?'on':'off'}" data-seg="${name}" d="${SOURCE[sourceName]}"/>`;
  }

  glyph=function apolloGlyph(ch,x){
    const lit=SEG[ch]||'';
    const paths=['a','b','c','d','e','f','g'].map(name=>segment(name,lit.includes(name))).join('');
    return `<g class="el-glyph" transform="translate(${Number(x).toFixed(3)} 0) scale(${MM_TO_U.toFixed(6)}) translate(${-DATUM_X.toFixed(6)} ${-SRC_Y})"><g transform="matrix(-1 0 0 1 ${MIRROR_X.toFixed(6)} 0)">${paths}</g></g>`;
  };

  // Detail A sign envelope and location.  The register digit datums are
  // .400, .810, 1.220, 1.630 and 2.040 inches from the left face datum.
  const SIGN_W=.265*U,SIGN_H=.338*U,SIGN_T=.065*U,SIGN_X=.025*U;
  const SIGN_TOP=(DIGIT_H-SIGN_H)*.5;
  const SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)*.5,SIGN_HY=SIGN_TOP+(SIGN_H-SIGN_T)*.5;
  function signH(on){return `<path class="el-seg ${on?'on':'off'}" d="M ${SIGN_X.toFixed(3)},${SIGN_HY.toFixed(3)} h ${SIGN_W.toFixed(3)} v ${SIGN_T.toFixed(3)} h ${(-SIGN_W).toFixed(3)} z"/>`;}
  function signV(on){return `<path class="el-seg ${on?'on':'off'}" d="M ${SIGN_VX.toFixed(3)},${SIGN_TOP.toFixed(3)} h ${SIGN_T.toFixed(3)} v ${SIGN_H.toFixed(3)} h ${(-SIGN_T).toFixed(3)} z"/>`;}
  signGlyph=function apolloSignGlyph(sign){const plus=sign==='+',bar=plus||sign==='-';return `<g class="el-sign">${signH(bar)}${signV(plus)}</g>`;};

  renderDigits=function apolloRenderDigits(el,text){let out='';String(text).split('').forEach((ch,i)=>{out+=glyph(ch,i*UPPER_ADVANCE);});el.innerHTML=out;};
  const FIRST_DIGIT_X=.400*U;
  renderReg=function apolloRenderReg(el,text){text=String(text);let out=signGlyph(text[0]);text.slice(1).split('').forEach((ch,i)=>{out+=glyph(ch,FIRST_DIGIT_X+i*REGISTER_ADVANCE);});el.innerHTML=out;};

  // Sheet 2 nominal .880-in left and right upper zones.  Detail B gives a
  // .740-in datum-to-final-edge two-digit field.  That places the first digit
  // datums at .140 and 1.620 inches respectively.
  const LEFT_FIELD_X=.140*U,RIGHT_FIELD_X=1.620*U;
  const transforms=Object.freeze({
    prog:`translate(${RIGHT_FIELD_X.toFixed(3)} 14)`,
    verb:`translate(${LEFT_FIELD_X.toFixed(3)} 55.5)`,
    noun:`translate(${RIGHT_FIELD_X.toFixed(3)} 55.5)`,
    r1:`translate(0 ${REGISTER_Y[0].toFixed(3)})`,
    r2:`translate(0 ${REGISTER_Y[1].toFixed(3)})`,
    r3:`translate(0 ${REGISTER_Y[2].toFixed(3)})`
  });
  for(const [id,transform] of Object.entries(transforms)){
    const node=document.getElementById(id);
    if(node)node.setAttribute('transform',transform);
  }

  if(typeof mode!=='undefined'&&mode==='agc'&&typeof renderAgcField==='function'){
    ['prog','verb','noun','r1','r2','r3'].forEach(renderAgcField);
  }else{
    if(typeof set2==='function')set2('prog','00');
    if(typeof show==='function')show(verb,noun);
    if(typeof renderClockReg==='function')['r1','r2','r3'].forEach(renderClockReg);
  }

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
    leftUpperDatumIn:.140,
    rightUpperDatumIn:1.620,
    upperAdvance:UPPER_ADVANCE,
    registerAdvance:REGISTER_ADVANCE,
    barFromBottomIn:BAR_FROM_BOTTOM_IN,
    barCenterY:BAR_CENTER_Y,
    registerY:REGISTER_Y
  });
})();
