'use strict';

/*
 * Apollo Block II DSKY EL geometry.
 *
 * Source of truth: MIT/IL SCD 1006315G. Digit segments retain the
 * drawing-backed rrainey/agc-mechanical-cad 1006315G-exact.step geometry
 * (commit 2d7dccd5bc4f0263a14ac5a4fd112a15d447010d). Detail A controls sign
 * island sizes because the STEP sign profiles do not meet those callouts.
 * The renderer service owns
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
  // Logical segment names follow the renderer/relay convention:
  // b/c are the physical right-side electrodes and e/f are the left-side
  // electrodes. Keep the accepted 1006315G polygon coordinates and slant
  // unchanged; only bind those physical electrodes to the correct logic names.
  const SEGMENT_PATH_IN=Object.freeze({
    // Physical segment identity follows the Apollo DSKY relay schematic:
    // E=a (top), H=b, M=c, N=d (bottom), K=e, F=f, J=g.
    // The archived STEP's +Z direction is upward while SVG +Y is downward.
    // These front-view polygons therefore preserve each named electrode's
    // physical identity instead of the prior 180-degree-rotated assignment.
    a:'M .199003944 .032239891 L .236689000 .097239891 L .410356000 .097239891 L .427798000 .032239891 Z',
    b:'M .438152000 .032239891 L .370443000 .284562891 L .437742000 .284562891 L .505451000 .032239891 Z',
    c:'M .435059000 .294562891 L .367759000 .294562891 L .325740000 .451148891 L .371746000 .530501891 Z',
    d:'M .138381000 .462239891 L .068381000 .532239891 L .361195000 .532239891 L .322764000 .462239891 Z',
    e:'M .117759000 .294562891 L .053885898 .532591879 L .145868000 .440610891 L .185059000 .294562891 Z',
    f:'M .187742000 .284562891 L .233934000 .112425891 L .188151849 .032240581 L .120443000 .284562891 Z',
    g:'M .206770000 .252239891 L .189327000 .317239891 L .351320000 .317239891 L .368762000 .252239891 Z'
  });
  const DIGIT_TOP_IN=.0322398905011428;
  const FACE_W_IN=2.360,FACE_H_IN=4.060,U=106/FACE_W_IN,MM_TO_U=U/25.4;
  const DIGIT_H=.500*U;
  const UPPER_ADVANCE_IN=.420,REGISTER_ADVANCE_IN=.410;
  const UPPER_ADVANCE=UPPER_ADVANCE_IN*U,REGISTER_ADVANCE=REGISTER_ADVANCE_IN*U;
  const BAR_FROM_BOTTOM_IN=Object.freeze([2.280,1.520,0.760]);
  const BAR_H_IN=.060;
  const REGISTER_GAP_IN=.060;
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
   * 1006315G Detail A register sign islands.
   * A is the two vertical islands used by '+'. B is the horizontal island
   * used by both '+' and '-'. The drawing controls island dimensions; the
   * STEP bar center retains their placement relative to the register row.
   */
  const SIGN_PATH_IN=Object.freeze({
    aTop:'M .073794 .433036 L .073794 .306536 L .138794 .306536 L .138794 .433036 Z',
    b:'M -.024223 .296536 L -.024223 .231536 L .240777 .231536 L .240777 .296536 Z',
    aBottom:'M .073794 .221536 L .073794 .095036 L .138794 .095036 L .138794 .221536 Z'
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

  const SVG_NS='http://www.w3.org/2000/svg';
  const SEGMENT_NAMES=Object.freeze(Object.keys(SEGMENT_PATH_IN));
  function clearNode(node){while(node.firstChild)node.removeChild(node.firstChild)}
  function stableSlots(el,kind,count){
    const existing=Array.from(el.children||[]);
    const valid=existing.length===count&&existing.every((node,index)=>
      node.getAttribute&&node.getAttribute('data-el-slot')===kind&&node.getAttribute('data-el-slot-index')===String(index));
    if(valid)return existing;
    clearNode(el);
    const slots=[];
    for(let index=0;index<count;index++){
      const slot=document.createElementNS(SVG_NS,'g');
      slot.setAttribute('data-el-slot',kind);
      slot.setAttribute('data-el-slot-index',String(index));
      el.appendChild(slot);slots.push(slot);
    }
    return slots;
  }
  function paintStableSlot(slot,value,markup){
    const key=String(value);
    if(slot.getAttribute('data-el-value')===key)return false;
    slot.innerHTML=markup;
    slot.setAttribute('data-el-value',key);
    return true;
  }
  function createSvgPath(className,dataName,dataValue,pathData){
    const path=document.createElementNS(SVG_NS,'path');
    path.setAttribute('class',className);
    path.setAttribute(dataName,dataValue);
    path.setAttribute('d',pathData);
    return path;
  }
  function ensureApolloDigitSlot(slot,xIn){
    const xKey=Number(xIn).toFixed(6),existing=slot.firstChild;
    const valid=slot.getAttribute('data-el-apollo-digit')===xKey&&existing&&existing.getAttribute&&existing.getAttribute('data-el-static-glyph')==='1'&&Array.from(existing.children||[]).length===SEGMENT_NAMES.length;
    if(valid)return existing;
    clearNode(slot);
    const glyph=document.createElementNS(SVG_NS,'g');
    glyph.setAttribute('class','el-glyph');
    glyph.setAttribute('data-el-static-glyph','1');
    glyph.setAttribute('transform',`translate(${Number(xIn*U).toFixed(3)} 0) scale(${U.toFixed(6)}) translate(0 ${(-DIGIT_TOP_IN).toFixed(6)})`);
    for(const name of SEGMENT_NAMES)glyph.appendChild(createSvgPath('el-seg','data-seg',name,SEGMENT_PATH_IN[name]));
    slot.appendChild(glyph);
    slot.setAttribute('data-el-apollo-digit',xKey);
    slot.setAttribute('data-el-value','');
    return glyph;
  }
  function paintApolloDigitSlot(slot,ch,xIn,glyphVersion){
    const glyph=ensureApolloDigitSlot(slot,xIn),key=`${glyphVersion}:${ch}`;
    if(slot.getAttribute('data-el-value')===key)return false;
    const lit=renderer.segmentPattern(ch);
    for(const path of Array.from(glyph.children||[])){
      const on=lit.includes(path.getAttribute('data-seg')),next=on?'el-seg on':'el-seg';
      if(path.getAttribute('class')!==next)path.setAttribute('class',next);
    }
    slot.setAttribute('data-el-value',key);
    return true;
  }
  function ensureApolloSignSlot(slot){
    const existing=slot.firstChild;
    const valid=existing&&existing.getAttribute&&existing.getAttribute('data-el-static-sign')==='1'&&Array.from(existing.children||[]).length===3;
    if(valid)return existing;
    clearNode(slot);
    const sign=document.createElementNS(SVG_NS,'g');
    sign.setAttribute('class','el-sign');
    sign.setAttribute('data-el-static-sign','1');
    sign.setAttribute('transform',`scale(${U.toFixed(6)}) translate(0 ${(-DIGIT_TOP_IN).toFixed(6)})`);
    sign.appendChild(createSvgPath('el-seg','data-sign-part','aTop',SIGN_PATH_IN.aTop));
    sign.appendChild(createSvgPath('el-seg','data-sign-part','aBottom',SIGN_PATH_IN.aBottom));
    sign.appendChild(createSvgPath('el-seg','data-sign-part','b',SIGN_PATH_IN.b));
    slot.appendChild(sign);
    slot.setAttribute('data-el-value','');
    return sign;
  }
  function paintApolloSignSlot(slot,value,signVersion){
    const sign=String(value||' '),group=ensureApolloSignSlot(slot),key=`${signVersion}:${sign}`;
    if(slot.getAttribute('data-el-value')===key)return false;
    for(const path of Array.from(group.children||[])){
      const part=path.getAttribute('data-sign-part'),on=sign==='+'||(sign==='-'&&part==='b'),next=on?'el-seg on':'el-seg';
      if(path.getAttribute('class')!==next)path.setAttribute('class',next);
    }
    slot.setAttribute('data-el-value',key);
    return true;
  }
  function apolloRenderDigits(el,text){
    const chars=String(text).split(''),glyph=renderer.implementation('glyph'),glyphVersion=renderer.compatibilityVersions().glyph;
    const slots=stableSlots(el,'upper-digit',chars.length);
    chars.forEach((ch,i)=>{
      if(glyph===apolloGlyph)paintApolloDigitSlot(slots[i],ch,i*UPPER_ADVANCE_IN,glyphVersion);
      else paintStableSlot(slots[i],`${glyphVersion}:${ch}`,glyph(ch,i*UPPER_ADVANCE_IN));
    });
  }
  const FIRST_DIGIT_X_IN=.180;
  function apolloRenderReg(el,text){
    text=String(text);
    const chars=text.slice(1).split(''),signGlyph=renderer.implementation('signGlyph'),glyph=renderer.implementation('glyph'),versions=renderer.compatibilityVersions();
    const slots=stableSlots(el,'register',1+chars.length);
    if(signGlyph===apolloSignGlyph)paintApolloSignSlot(slots[0],text[0],versions.signGlyph);
    else paintStableSlot(slots[0],`${versions.signGlyph}:${text[0]??''}`,signGlyph(text[0]));
    chars.forEach((ch,i)=>{
      const xIn=FIRST_DIGIT_X_IN+i*REGISTER_ADVANCE_IN;
      if(glyph===apolloGlyph)paintApolloDigitSlot(slots[i+1],ch,xIn,versions.glyph);
      else paintStableSlot(slots[i+1],`${versions.glyph}:${ch}`,glyph(ch,xIn));
    });
  }

  renderer.installImplementation('glyph',apolloGlyph,'Apollo drawing geometry');
  renderer.installImplementation('signGlyph',apolloSignGlyph,'Apollo drawing geometry');
  renderer.installImplementation('renderDigits',apolloRenderDigits,'Apollo drawing geometry');
  renderer.installImplementation('renderReg',apolloRenderReg,'Apollo drawing geometry');

  const RIGHT_FIELD_X_IN=1.434549;
  const UPPER_GROUP_X_OFFSET_IN=1.470;
  const LEFT_FIELD_X_IN=RIGHT_FIELD_X_IN-UPPER_GROUP_X_OFFSET_IN;
  const REGISTER_ROW_X_IN=.024223;
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
    signWidthIn:.265,
    signHeightIn:.338,
    signThicknessIn:.065,
    upperAdvance:UPPER_ADVANCE,
    registerAdvance:REGISTER_ADVANCE,
    barFromBottomIn:BAR_FROM_BOTTOM_IN,
    barCenterY:BAR_CENTER_Y,
    registerY:REGISTER_Y
  });
})();