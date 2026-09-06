'use strict';

/*
 * Apollo Block II DSKY EL segment geometry.
 *
 * Segment outlines are normalized directly from the EL_Segments vector artwork
 * in Ben Krasnow's DSKY_EL_replica project (graphics/DSKY V2.svg), rather than
 * being generated as a generic seven-segment font.  That artwork was created
 * for a physical DSKY EL replica and captures the characteristic skewed,
 * asymmetric Apollo segment shapes visible on original hardware.
 *
 * Copyright (c) 2019 Ben Krasnow
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the condition that this copyright notice and
 * permission notice are included in all copies or substantial portions.
 */
(() => {
  // Exact source paths for one numeric cell from DSKY V2.svg.  Keep them in
  // their native coordinate system so there is no geometry reconstruction.
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

  // Scale the physical artwork to the DSKY panel viewBox.  v0.13 incorrectly
  // treated an overall drawing dimension as the illuminated cell height,
  // making the digits too tall and too symmetrical.  This target size keeps
  // the original artwork's aspect/skew and fits the real five-digit aperture.
  const SCALE = 1.58;
  // The replica artwork is viewed from the opposite face from the installed
  // DSKY readout. Mirror its handedness, then swap left/right logical segment
  // assignments so the numerals remain readable while the physical slant
  // matches the crew-facing EL panel.
  const MIRROR_X = 2 * SRC_X + SRC_W;
  const SOURCE_FOR_LOGICAL = Object.freeze({a:'a', b:'f', c:'e', d:'d', e:'c', f:'b', g:'g'});
  const ADVANCE = SRC_PITCH * SCALE;
  const DIGIT_W = SRC_W * SCALE;
  const DIGIT_H = SRC_H * SCALE;

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

  // The three register signs are considerably smaller than a numeral.  Use
  // the same skew direction and apparent stroke weight as the exact numeric
  // artwork instead of v0.13's oversized square sign.
  const SIGN_X = 0.95;
  const SIGN_Y = DIGIT_H * 0.50;
  const SIGN_W = 7.4;
  const SIGN_T = 1.55;
  const SIGN_SKEW = -0.75;
  function signH(on) {
    const y = SIGN_Y - SIGN_T / 2;
    return `<path class="el-seg ${on ? 'on' : 'off'}" d="M ${SIGN_X},${y.toFixed(3)} h ${SIGN_W} l ${SIGN_SKEW},${SIGN_T} h ${-SIGN_W} z"/>`;
  }
  function signV(part, on) {
    const x = SIGN_X + SIGN_W * 0.50;
    const cy = SIGN_Y;
    const len = 4.8;
    const y0 = part === 'upper' ? cy - SIGN_T / 2 - len : cy + SIGN_T / 2;
    return `<path class="el-seg ${on ? 'on' : 'off'}" d="M ${x.toFixed(3)},${y0.toFixed(3)} h ${SIGN_T} l ${SIGN_SKEW},${len.toFixed(3)} h ${-SIGN_T} z"/>`;
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

  // Sign + five digits fit inside the 106-wide EL viewbox with the same tight
  // spacing visible in the restored CuriousMarc/physical DSKY and replica art.
  const FIRST_DIGIT_X = 9.7;
  renderReg = function apolloRenderReg(el, text) {
    text = String(text);
    let out = signGlyph(text[0]);
    text.slice(1).split('').forEach((ch, i) => { out += glyph(ch, FIRST_DIGIT_X + i * ADVANCE); });
    el.innerHTML = out;
  };

  // Correct the field origins for the source-art proportions.  Two-character
  // fields are centered under their physical labels; registers are vertically
  // centered in their three ruled apertures.
  const transforms = Object.freeze({
    prog: 'translate(68 14)',
    verb: 'translate(3 59)',
    noun: 'translate(68 59)',
    r1: 'translate(3 97)',
    r2: 'translate(3 131)',
    r3: 'translate(3 165)'
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
    source: 'Ben Krasnow DSKY_EL_replica / DSKY V2.svg EL_Segments, crew-facing handedness',
    sourceWidth: SRC_W,
    sourceHeight: SRC_H,
    sourcePitch: SRC_PITCH,
    scale: SCALE,
    digitWidth: DIGIT_W,
    digitHeight: DIGIT_H,
    digitAdvance: ADVANCE
  });
})();
