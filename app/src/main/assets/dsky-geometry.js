'use strict';

/*
 * Apollo Block II DSKY EL geometry.
 *
 * Vertical spacing comes directly from MIT/IL SCD 1006315G sheet 2.
 * The 2.360 x 4.060 inch face, .760 inch register pitch, .060 inch
 * continuously-lit separator thickness, and .070 inch separator-to-digit
 * clearance are used as physical dimensions, not eyeballed screen spacing.
 * Segment contours remain the traced physical EL artwork from DSKY V2.svg.
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

  const SRC_X=88.116524,SRC_Y=85.303059,SRC_W=11.685430,SRC_H=12.700000,SRC_PITCH=10.668000;
  const SCALE=1.58,MIRROR_X=2*SRC_X+SRC_W;
  const SOURCE_FOR_LOGICAL=Object.freeze({a:'a',b:'f',c:'e',d:'d',e:'c',f:'b',g:'g'});
  const ADVANCE=SRC_PITCH*SCALE,DIGIT_W=SRC_W*SCALE,DIGIT_H=SRC_H*SCALE;

  // SCD 1006315G sheet 2 front-face datums, in inches.
  const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN;
  const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);
  const BAR_H_IN=.060;                 // .065/.055 TYP
  const REGISTER_TOP_GAP_IN=.070;      // .075/.065 TYP
  const REGISTER_Y=BAR_FROM_BOTTOM_IN.map(v=>(FACE_H_IN-v+BAR_H_IN+REGISTER_TOP_GAP_IN)*U);

  function segment(name,on){
    const sourceName=SOURCE_FOR_LOGICAL[name];
    return `<path class="el-seg ${on?'on':'off'}" data-seg="${name}" d="${SOURCE[sourceName]}"/>`;
  }

  glyph=function apolloGlyph(ch,x){
    const lit=SEG[ch]||'';
    const paths=['a','b','c','d','e','f','g'].map(name=>segment(name,lit.includes(name))).join('');
    return `<g class="el-glyph" transform="translate(${Number(x).toFixed(3)} 0) scale(${SCALE}) translate(${-SRC_X} ${-SRC_Y})"><g transform="matrix(-1 0 0 1 ${MIRROR_X.toFixed(6)} 0)">${paths}</g></g>`;
  };

  const SIGN_W=6.731*SCALE,SIGN_T=1.524*SCALE,SIGN_ARM=3.175*SCALE,SIGN_GAP=.381*SCALE;
  const SIGN_H=2*SIGN_ARM+SIGN_T+2*SIGN_GAP,SIGN_TOP=(DIGIT_H-SIGN_H)*.5,SIGN_X=.4,SIGN_VX=SIGN_X+(SIGN_W-SIGN_T)*.5,SIGN_HY=SIGN_TOP+SIGN_ARM+SIGN_GAP;
  function signH(on){return `<path class="el-seg ${on?'on':'off'}" d="M ${SIGN_X.toFixed(3)},${SIGN_HY.toFixed(3)} h ${SIGN_W.toFixed(3)} v ${SIGN_T.toFixed(3)} h ${(-SIGN_W).toFixed(3)} z"/>`;}
  function signV(part,on){const y0=part==='upper'?SIGN_TOP:SIGN_HY+SIGN_T+SIGN_GAP;return `<path class="el-seg ${on?'on':'off'}" d="M ${SIGN_VX.toFixed(3)},${y0.toFixed(3)} h ${SIGN_T.toFixed(3)} v ${SIGN_ARM.toFixed(3)} h ${(-SIGN_T).toFixed(3)} z"/>`;}
  signGlyph=function apolloSignGlyph(sign){const plus=sign==='+',bar=plus||sign==='-';return `<g class="el-sign">${signH(bar)}${signV('upper',plus)}${signV('lower',plus)}</g>`;};

  renderDigits=function apolloRenderDigits(el,text){let out='';String(text).split('').forEach((ch,i)=>{out+=glyph(ch,i*ADVANCE);});el.innerHTML=out;};
  const FIRST_DIGIT_X=12.0;
  renderReg=function apolloRenderReg(el,text){text=String(text);let out=signGlyph(text[0]);text.slice(1).split('').forEach((ch,i)=>{out+=glyph(ch,FIRST_DIGIT_X+i*ADVANCE);});el.innerHTML=out;};

  // The upper fields retain their source-art origins.  The three register rows
  // are calculated from the SCD dimension chain: bar top at 1.780/2.540/3.300
  // inches from the top, then .060 bar + .070 clearance before the digits.
  const transforms=Object.freeze({
    prog:'translate(66.75 14)',
    verb:'translate(3 59)',
    noun:'translate(66.75 59)',
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
    source:'MIT/IL SCD 1006315G sheet 2; DSKY V2.svg segment contours only',
    faceWidthIn:FACE_W_IN,
    faceHeightIn:FACE_H_IN,
    barFromBottomIn:BAR_FROM_BOTTOM_IN,
    barHeightIn:BAR_H_IN,
    registerTopGapIn:REGISTER_TOP_GAP_IN,
    digitWidth:DIGIT_W,
    digitHeight:DIGIT_H,
    digitAdvance:ADVANCE,
    registerY:REGISTER_Y
  });
})();
