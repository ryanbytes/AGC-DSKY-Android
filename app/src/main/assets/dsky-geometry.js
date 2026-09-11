'use strict';

/*
 * Apollo Block II DSKY EL segment geometry.
 *
 * DIMENSIONAL SOURCE OF TRUTH:
 *   MIT/IL SCD 1006315, INDICATOR, DIGITAL, ELECTROLUMINESCENT.
 *   Rev C sheet 1/2 gives the digit/detail dimensions and sheet 2/2 gives the
 *   front-face spacing used below.  The flown CM 2003994-121 assembly calls
 *   out 1006315-001 directly.
 *
 * The Ben Krasnow DSKY V2 SVG remains only a contour transcription for the
 * individual segment polygons.  It is NOT used for pitch, digit envelope,
 * register spacing, field origins, or panel aspect ratio.
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

  const SRC_X = 88.116524;
  const SRC_Y = 85.303059;
  const SRC_W = 11.685430;
  const SRC_H = 12.700000;
  const MIRROR_X = 2 * SRC_X + SRC_W;
  const SOURCE_FOR_LOGICAL = Object.freeze({a:'a', b:'f', c:'e', d:'d', e:'c', f:'b', g:'g'});

  // 1006315C dimensions, converted into the existing 106-unit panel width.
  // The drawing front face is 2.360 in wide and nominally 4.060 in high.
  const U = 106 / 2.360;
  const PANEL_H = 4.060 * U;
  const DIGIT_W = 0.320 * U;      // DETAIL A/C: .320 REF digit envelope
  const DIGIT_H = 0.500 * U;      // DETAIL C: nominal .500 active height
  const ADVANCE = 0.410 * U;      // DETAIL A: .410 position pitch
  const SCALE_X = DIGIT_W / SRC_W;
  const SCALE_Y = DIGIT_H / SRC_H;

  function segment(name, on) {
    const sourceName = SOURCE_FOR_LOGICAL[name];
    return `<path class="el-seg ${on ? 'on' : 'off'}" data-seg="${name}" d="${SOURCE[sourceName]}"/>`;
  }

  glyph = function apolloGlyph(ch, x) {
    const lit = SEG[ch] || '';
    const paths = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      .map(name => segment(name, lit.includes(name))).join('');
    return `<g class="el-glyph" transform="translate(${Number(x).toFixed(3)} 0) scale(${SCALE_X.toFixed(6)} ${SCALE_Y.toFixed(6)}) translate(${-SRC_X} ${-SRC_Y})"><g transform="matrix(-1 0 0 1 ${MIRROR_X.toFixed(6)} 0)">${paths}</g></g>`;
  };

  // 1006315 detail-A register geometry: the sign occupies the left end of a
  // 2.335-in nominal six-position group; digit 1 starts .375 in from that
  // left datum.  Keep the plus/minus centered in the same .500-in height.
  const SIGN_W = 0.270 * U;
  const SIGN_T = 0.070 * U;
  const SIGN_ARM = 0.120 * U;
  const SIGN_GAP = 0.015 * U;
  const SIGN_H = 2 * SIGN_ARM + SIGN_T + 2 * SIGN_GAP;
  const SIGN_TOP = (DIGIT_H - SIGN_H) * 0.5;
  const SIGN_X = 0;
  const SIGN_VX = SIGN_X + (SIGN_W - SIGN_T) * 0.5;
  const SIGN_HY = SIGN_TOP + SIGN_ARM + SIGN_GAP;
  function signH(on) {
    return `<path class="el-seg ${on ? 'on' : 'off'}" d="M ${SIGN_X.toFixed(3)},${SIGN_HY.toFixed(3)} h ${SIGN_W.toFixed(3)} v ${SIGN_T.toFixed(3)} h ${(-SIGN_W).toFixed(3)} z"/>`;
  }
  function signV(part, on) {
    const y0 = part === 'upper' ? SIGN_TOP : SIGN_HY + SIGN_T + SIGN_GAP;
    return `<path class="el-seg ${on ? 'on' : 'off'}" d="M ${SIGN_VX.toFixed(3)},${y0.toFixed(3)} h ${SIGN_T.toFixed(3)} v ${SIGN_ARM.toFixed(3)} h ${(-SIGN_T).toFixed(3)} z"/>`;
  }
  signGlyph = function apolloSignGlyph(sign) {
    const plus = sign === '+';
    const bar = plus || sign === '-';
    return `<g class="el-sign">${signH(bar)}${signV('upper', plus)}${signV('lower', plus)}</g>`;
  };

  renderDigits = function apolloRenderDigits(el, text) {
    let out = '';
    String(text).split('').forEach((ch, i) => { out += glyph(ch, i * ADVANCE); });
    el.innerHTML = out;
  };

  const FIRST_DIGIT_X = 0.375 * U;
  renderReg = function apolloRenderReg(el, text) {
    text = String(text);
    let out = signGlyph(text[0]);
    text.slice(1).split('').forEach((ch, i) => { out += glyph(ch, FIRST_DIGIT_X + i * ADVANCE); });
    el.innerHTML = out;
  };

  // 1006315C sheet 2 front-face dimensions.
  // - face: 2.360 x 4.060 in nominal
  // - register separator datums from bottom: .760, 1.520, 2.280 in
  // - register glyphs centered in each .760-in aperture
  // - two-digit groups use the .730-in nominal span from DETAIL B
  const transforms = Object.freeze({
    prog: `translate(${(1.555 * U).toFixed(3)} ${(0.312 * U).toFixed(3)})`,
    verb: `translate(${(0.075 * U).toFixed(3)} ${(1.205 * U).toFixed(3)})`,
    noun: `translate(${(1.555 * U).toFixed(3)} ${(1.205 * U).toFixed(3)})`,
    r1: `translate(${(0.0125 * U).toFixed(3)} ${(1.910 * U).toFixed(3)})`,
    r2: `translate(${(0.0125 * U).toFixed(3)} ${(2.670 * U).toFixed(3)})`,
    r3: `translate(${(0.0125 * U).toFixed(3)} ${(3.430 * U).toFixed(3)})`
  });
  for (const [id, transform] of Object.entries(transforms)) {
    const node = document.getElementById(id);
    if (node) node.setAttribute('transform', transform);
  }

  // Repaint the face because app.js rendered once before this refinement.
  if (typeof mode !== 'undefined' && mode === 'agc' && typeof renderAgcField === 'function') {
    ['prog', 'verb', 'noun', 'r1', 'r2', 'r3'].forEach(renderAgcField);
  } else {
    if (typeof set2 === 'function') set2('prog', '00');
    if (typeof show === 'function') show(verb, noun);
    if (typeof renderClockReg === 'function') ['r1', 'r2', 'r3'].forEach(renderClockReg);
  }

  window.DSKY_DRAWING_GEOMETRY = Object.freeze({
    source: 'MIT/IL SCD 1006315C sheets 1-2; segment contour only from DSKY V2.svg',
    panelWidthIn: 2.360,
    panelHeightIn: 4.060,
    panelHeight: PANEL_H,
    digitWidthIn: 0.320,
    digitHeightIn: 0.500,
    digitPitchIn: 0.410,
    digitWidth: DIGIT_W,
    digitHeight: DIGIT_H,
    digitAdvance: ADVANCE,
    firstRegisterDigitIn: 0.375
  });
})();
