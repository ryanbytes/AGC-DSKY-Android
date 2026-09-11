'use strict';

/*
 * Apollo Block II DSKY EL segment geometry.
 *
 * Dimensional source of truth is the original MIT Instrumentation Laboratory
 * SCD 1006315 (rev G), INDICATOR, DIGITAL, ELECTROLUMINESCENT.  The flown CM
 * 2003994-121 assembly calls out 1006315-001 directly.  In particular the
 * 2.360-in front-face width, 4.060-in nominal height and .760-in register
 * center pitch come from sheet 2 of that drawing.
 *
 * Ben Krasnow's DSKY V2 SVG is retained only as a transcription of the
 * individual segment contours.  It is not the spacing or panel-aspect source.
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
  const SRC_PITCH = 10.668000;
  const SCALE = 1.58;
  const MIRROR_X = 2 * SRC_X + SRC_W;
  const SOURCE_FOR_LOGICAL = Object.freeze({a:'a', b:'f', c:'e', d:'d', e:'c', f:'b', g:'g'});
  const ADVANCE = SRC_PITCH * SCALE;
  const DIGIT_W = SRC_W * SCALE;
  const DIGIT_H = SRC_H * SCALE;

  // Sheet-2 face dimensions mapped into the established 106-unit panel width.
  const DRAWING_FACE_W_IN = 2.360;
  const DRAWING_FACE_H_IN = 4.060;
  const U = 106 / DRAWING_FACE_W_IN;
  const PANEL_H = DRAWING_FACE_H_IN * U; // 182.356, not the old guessed 190.

  function segment(name, on) {
    const sourceName = SOURCE_FOR_LOGICAL[name];
    return `<path class="el-seg ${on ? 'on' : 'off'}" data-seg="${name}" d="${SOURCE[sourceName]}"/>`;
  }

  glyph = function apolloGlyph(ch, x) {
    const lit = SEG[ch] || '';
    const paths = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      .map(name => segment(name, lit.includes(name))).join('');
    return `<g class="el-glyph" transform="translate(${Number(x).toFixed(3)} 0) scale(${SCALE}) translate(${-SRC_X} ${-SRC_Y})"><g transform="matrix(-1 0 0 1 ${MIRROR_X.toFixed(6)} 0)">${paths}</g></g>`;
  };

  const SIGN_W = 6.731 * SCALE;
  const SIGN_T = 1.524 * SCALE;
  const SIGN_ARM = 3.175 * SCALE;
  const SIGN_GAP = 0.381 * SCALE;
  const SIGN_H = 2 * SIGN_ARM + SIGN_T + 2 * SIGN_GAP;
  const SIGN_TOP = (DIGIT_H - SIGN_H) * 0.5;
  const SIGN_X = 0.40;
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

  const FIRST_DIGIT_X = 12.0;
  renderReg = function apolloRenderReg(el, text) {
    text = String(text);
    let out = signGlyph(text[0]);
    text.slice(1).split('').forEach((ch, i) => { out += glyph(ch, FIRST_DIGIT_X + i * ADVANCE); });
    el.innerHTML = out;
  };

  // 1006315G sheet 2 dimensions: register centers are 2.280, 1.520 and
  // 0.760 inches above the bottom face datum.  Position glyphs by those
  // physical centers instead of spreading three rows through a 190-unit box.
  const regTop = centerFromBottomIn => (DRAWING_FACE_H_IN - centerFromBottomIn) * U - DIGIT_H / 2;
  const transforms = Object.freeze({
    prog: 'translate(66.75 14)',
    verb: 'translate(3 43.664)',
    noun: 'translate(66.75 43.664)',
    r1: `translate(3 ${regTop(2.280).toFixed(3)})`,
    r2: `translate(3 ${regTop(1.520).toFixed(3)})`,
    r3: `translate(3 ${regTop(0.760).toFixed(3)})`
  });
  for (const [id, transform] of Object.entries(transforms)) {
    const node = document.getElementById(id);
    if (node) node.setAttribute('transform', transform);
  }

  if (typeof mode !== 'undefined' && mode === 'agc' && typeof renderAgcField === 'function') {
    ['prog', 'verb', 'noun', 'r1', 'r2', 'r3'].forEach(renderAgcField);
  } else {
    if (typeof set2 === 'function') set2('prog', '00');
    if (typeof show === 'function') show(verb, noun);
    if (typeof renderClockReg === 'function') ['r1', 'r2', 'r3'].forEach(renderClockReg);
  }

  window.DSKY_DRAWING_GEOMETRY = Object.freeze({
    source: 'MIT/IL SCD 1006315G sheet 2; segment contours only from DSKY V2.svg',
    panelWidthIn: DRAWING_FACE_W_IN,
    panelHeightIn: DRAWING_FACE_H_IN,
    panelHeight: PANEL_H,
    registerCentersFromBottomIn: [2.280, 1.520, 0.760],
    digitWidth: DIGIT_W,
    digitHeight: DIGIT_H,
    digitAdvance: ADVANCE
  });
})();
