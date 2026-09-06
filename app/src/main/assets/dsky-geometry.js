'use strict';

// Drawing-based Block II DSKY numeric geometry.
//
// MIT/Raytheon specification-control drawing 1006315 defines the physical
// electroluminescent digital indicator used by the Block II DSKY.  The front
// layout gives a 0.760-in register pitch; Detail C gives the illuminated digit
// proportions, including the 0.315-0.325-in width envelope, 0.060-in segment
// stock, 0.010-in minimum segment clearance and the 0.395-in character pitch.
// The register-height callout is 0.655-0.665 in.  Use the nominal values rather
// than a generic seven-segment font so the rendered geometry scales with the
// original hardware drawing.
(() => {
  const SCALE = 34 / 0.760;       // Existing SVG register pitch -> drawing inch.
  const DIGIT_W = 0.320 * SCALE;  // Nominal of .315/.325 drawing limits.
  const DIGIT_H = 0.660 * SCALE;  // Nominal of .655/.665 drawing limits.
  const SEG_T = 0.060 * SCALE;
  const GAP = 0.010 * SCALE;
  const ADVANCE = 0.395 * SCALE;
  const BEVEL_ANGLE = 60.5 * Math.PI / 180;
  const BEVEL = (SEG_T / 2) / Math.tan(BEVEL_ANGLE);

  const MID_Y = (DIGIT_H - SEG_T) / 2;
  const UPPER_Y0 = SEG_T + GAP;
  const UPPER_Y1 = MID_Y - GAP;
  const LOWER_Y0 = MID_Y + SEG_T + GAP;
  const LOWER_Y1 = DIGIT_H - SEG_T - GAP;

  function points(values) {
    return values.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
  }

  function horizontal(y) {
    return points([
      [BEVEL, y],
      [DIGIT_W - BEVEL, y],
      [DIGIT_W, y + SEG_T / 2],
      [DIGIT_W - BEVEL, y + SEG_T],
      [BEVEL, y + SEG_T],
      [0, y + SEG_T / 2]
    ]);
  }

  function vertical(x, y0, y1) {
    return points([
      [x + SEG_T / 2, y0],
      [x + SEG_T, y0 + BEVEL],
      [x + SEG_T, y1 - BEVEL],
      [x + SEG_T / 2, y1],
      [x, y1 - BEVEL],
      [x, y0 + BEVEL]
    ]);
  }

  const DRAWING_PATH = Object.freeze({
    a: horizontal(0),
    g: horizontal(MID_Y),
    d: horizontal(DIGIT_H - SEG_T),
    f: vertical(0, UPPER_Y0, UPPER_Y1),
    b: vertical(DIGIT_W - SEG_T, UPPER_Y0, UPPER_Y1),
    e: vertical(0, LOWER_Y0, LOWER_Y1),
    c: vertical(DIGIT_W - SEG_T, LOWER_Y0, LOWER_Y1)
  });

  function segmentPolygon(name, on) {
    return `<polygon class="el-seg ${on ? 'on' : 'off'}" data-seg="${name}" points="${DRAWING_PATH[name]}"/>`;
  }

  // Replace app.js's hand-shaped generic glyph with the 1006315 proportions.
  glyph = function drawingGlyph(ch, x) {
    const lit = SEG[ch] || '';
    const body = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      .map((name) => segmentPolygon(name, lit.includes(name)))
      .join('');
    return `<g class="el-glyph" transform="translate(${x.toFixed(3)} 0)">${body}</g>`;
  };

  // The sign lives in the same illuminated register aperture.  Keep three
  // independently identifiable strokes for '+' so diagnostics continue to
  // distinguish plus/minus exactly as before, but scale the face to the real
  // register proportions rather than the undersized legacy mark.
  const SIGN_W = 0.225 * SCALE;
  const SIGN_T = SEG_T;
  const SIGN_X = 0;
  const SIGN_CY = DIGIT_H / 2;
  const SIGN_H0 = SIGN_CY - SIGN_T / 2;
  const SIGN_VH = 0.225 * SCALE;
  const SIGN_V0 = SIGN_CY - SIGN_VH / 2;
  const SIGN_CX = SIGN_W / 2;

  function rectSegment(x, y, w, h, on) {
    return `<rect class="el-seg ${on ? 'on' : 'off'}" x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"/>`;
  }

  signGlyph = function drawingSignGlyph(sign) {
    const plus = sign === '+';
    const bar = plus || sign === '-';
    const upperH = Math.max(0, SIGN_CY - SIGN_T / 2 - SIGN_V0);
    const lowerY = SIGN_CY + SIGN_T / 2;
    const lowerH = Math.max(0, SIGN_V0 + SIGN_VH - lowerY);
    return `<g class="el-sign">`
      + rectSegment(SIGN_X, SIGN_H0, SIGN_W, SIGN_T, bar)
      + rectSegment(SIGN_CX - SIGN_T / 2, SIGN_V0, SIGN_T, upperH, plus)
      + rectSegment(SIGN_CX - SIGN_T / 2, lowerY, SIGN_T, lowerH, plus)
      + `</g>`;
  };

  // Real character pitch from drawing 1006315.  The register x-origin in the
  // existing SVG was already sized for the physical five-character aperture.
  renderDigits = function drawingRenderDigits(el, text) {
    let out = '';
    String(text).split('').forEach((ch, i) => {
      out += glyph(ch, i * ADVANCE);
    });
    el.innerHTML = out;
  };

  const FIRST_DIGIT_X = 0.270 * SCALE;
  renderReg = function drawingRenderReg(el, text) {
    text = String(text);
    let out = signGlyph(text[0]);
    text.slice(1).split('').forEach((ch, i) => {
      out += glyph(ch, FIRST_DIGIT_X + i * ADVANCE);
    });
    el.innerHTML = out;
  };

  // Center the taller drawing-correct register glyphs in the three existing
  // register bands while preserving their exact 34-unit / 0.760-in pitch.
  const registerY = {r1: 92.5, r2: 126.5, r3: 160.5};
  for (const [id, y] of Object.entries(registerY)) {
    const node = document.getElementById(id);
    if (node) node.setAttribute('transform', `translate(3 ${y})`);
  }

  // app.js paints the initial face before this refinement file loads. Repaint
  // immediately so the first visible frame already uses the drawing geometry.
  if (typeof mode !== 'undefined' && mode === 'agc' && typeof renderAgcField === 'function') {
    ['prog', 'verb', 'noun', 'r1', 'r2', 'r3'].forEach(renderAgcField);
  } else {
    if (typeof set2 === 'function') set2('prog', '00');
    if (typeof show === 'function') show(verb, noun);
    if (typeof renderClockReg === 'function') ['r1', 'r2', 'r3'].forEach(renderClockReg);
  }

  window.DSKY_DRAWING_GEOMETRY = Object.freeze({
    source: 'MIT/Raytheon 1006315',
    scale: SCALE,
    digitWidth: DIGIT_W,
    digitHeight: DIGIT_H,
    digitAdvance: ADVANCE,
    segmentThickness: SEG_T,
    minimumGap: GAP
  });
})();
