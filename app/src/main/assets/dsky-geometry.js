'use strict';

/*
 * Apollo Block II DSKY EL geometry.
 *
 * Source of truth: MIT/IL SCD 1006315G.
 *   - Sheet 1, detail C: digit envelope .320 REF wide x .505/.495 high.
 *   - Sheet 1, detail B: two-digit field span .745/.735 with .320 digit width.
 *   - Sheet 1, detail A: five-digit register pitch .410.
 *   - Sheet 2: 2.360 x 4.060 EL face and .760 register pitch.
 *
 * The old build applied one uniform scale to the traced segment artwork.  That
 * made each digit too wide, caused adjacent digits to overlap, and let the
 * PROG digits intrude into the legend.  The traced contours are now affine-
 * fitted into the actual .320 x .500 drawing envelope and the drawing pitches
 * are used explicitly.
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

  const SRC_X=88.116524,SRC_Y=85.303059,SRC_W=11.685430,SRC_H=12.700000;
  const MIRROR_X=2*SRC_X+SRC_W;
  const SOURCE_FOR_LOGICAL=Object.freeze({a:'a',b:'f',c:'e',d:'d',e:'c',f:'b',g:'g'});

  const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN;
  const DIGIT_W=.320*U,DIGIT_H=.500*U;
  const DIGIT_SX=DIGIT_W/SRC_W,DIGIT_SY=DIGIT_H/SRC_H;
  const UPPER_ADVANCE=.420*U;   // detail B: .740 overall = .320 + .100 + .320
  const REGISTER_ADVANCE=.410*U;// detail A: successive digit datums differ .410

  // Sheet 2 register-bar dimension chain.  Use the dimensions as bar
  // centerlines; the luminous bar itself is nominally .060 high.
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
    return `<g class="el-glyph" transform="translate(${Number(x).toFixed(3)} 0) scale(${DIGIT_SX.toFixed(6)} ${DIGIT_SY.toFixed(6)}) translate(${-SRC_X} ${-SRC_Y})"><g transform="matrix(-1 0 0 1 ${MIRROR_X.toFixed(6)} 0)">${paths}</g></g>`;
  };

  // Detail A sign envelope: .270/.260 wide and .343/.333 high.  Use a
  // nominal .065 stroke (the .070/.060 TYP segment dimension).
  const SIGN_W=.265*U,SIGN_H=.338*U,SIGN_T=.065*U;
  const SIGN_TOP=(DIGIT_H-SIGN_H)*.5,SIGN_X=.4;
  const SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)*.5,SIGN_HY=SIGN_TOP+(SIGN_H-SIGN_T)*.5;
  function signH(on){return `<path class="el-seg ${on?'on':'off'}" d="M ${SIGN_X.toFixed(3)},${SIGN_HY.toFixed(3)} h ${SIGN_W.toFixed(3)} v ${SIGN_T.toFixed(3)} h ${(-SIGN_W).toFixed(3)} z"/>`;}
  function signV(on){return `<path class="el-seg ${on?'on':'off'}" d="M ${SIGN_VX.toFixed(3)},${SIGN_TOP.toFixed(3)} h ${SIGN_T.toFixed(3)} v ${SIGN_H.toFixed(3)} h ${(-SIGN_T).toFixed(3)} z"/>`;}
  signGlyph=function apolloSignGlyph(sign){const plus=sign==='+',bar=plus||sign==='-';return `<g class="el-sign">${signH(bar)}${signV(plus)}</g>`;};

  renderDigits=function apolloRenderDigits(el,text){let out='';String(text).split('').forEach((ch,i)=>{out+=glyph(ch,i*UPPER_ADVANCE);});el.innerHTML=out;};
  const FIRST_DIGIT_X=12.0;
  renderReg=function apolloRenderReg(el,text){text=String(text);let out=signGlyph(text[0]);text.slice(1).split('').forEach((ch,i)=>{out+=glyph(ch,FIRST_DIGIT_X+i*REGISTER_ADVANCE);});el.innerHTML=out;};

  // Upper-field origins were re-traced against the sheet-2 front view using
  // the 2.360 x 4.060 face datums.  These replace the hand-normalized values
  // that put the PROG digit inside its legend and pushed VERB/NOUN too low.
  const transforms=Object.freeze({
    prog:'translate(66.4 14)',
    verb:'translate(7 55.5)',
    noun:'translate(66.6 55.5)',
    r1:`translate(3 ${REGISTER_Y[0].toFixed(3)})`,
    r2:`translate(3 ${REGISTER_Y[1].toFixed(3)})`,
    r3:`translate(3 ${REGISTER_Y[2].toFixed(3)})`
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
    source:'MIT/IL SCD 1006315G sheets 1-2; traced segment contours affine-fitted to detail C',
    faceWidthIn:FACE_W_IN,
    faceHeightIn:FACE_H_IN,
    digitWidthIn:.320,
    digitHeightIn:.500,
    upperPitchIn:.420,
    registerPitchIn:.410,
    digitWidth:DIGIT_W,
    digitHeight:DIGIT_H,
    upperAdvance:UPPER_ADVANCE,
    registerAdvance:REGISTER_ADVANCE,
    barFromBottomIn:BAR_FROM_BOTTOM_IN,
    barCenterY:BAR_CENTER_Y,
    registerY:REGISTER_Y
  });
})();
