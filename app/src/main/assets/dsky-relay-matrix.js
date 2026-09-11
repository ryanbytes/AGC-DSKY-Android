'use strict';

/*
 * Apollo Block II DSKY five-relay character contact matrix.
 *
 * Each numeric character is controlled by five bistable relays K1..K5.  Their
 * DPST contacts wire the seven EL sections directly, so the electrical model
 * has 32 possible relay states even though AGC software normally emits only
 * blank and decimal 0..9 codes.
 *
 * Contact logic below follows VirtualAGC Tools/traceDSKY.py, which was traced
 * from the original DSKY schematics.  Schematic segment names map to the
 * app's conventional seven-segment names as:
 *
 *   E -> a (top)       H -> b (upper right)
 *   M -> c (lower right) N -> d (bottom)
 *   K -> e (lower left) F -> f (upper left)
 *   J -> g (middle)
 *
 * Channel 010 remains modeled in app.js as twelve selectable banks of eleven
 * bistable relays: B + C1..C5 + D1..D5.  This file only replaces the visual
 * shortcut that formerly treated unsupported five-relay states as blank.
 */
(() => {
  if (typeof decodeChannel10 !== 'function' || typeof glyph !== 'function' ||
      typeof signGlyph !== 'function' || typeof SEG !== 'object') return;

  const MATRIX_KEY = '__relay_matrix__';

  function segmentsForRelayCode(value) {
    const code = Number(value) & 0x1f;
    const k1 = (code >> 0) & 1;
    const k2 = (code >> 1) & 1;
    const k3 = (code >> 2) & 1;
    const k4 = (code >> 3) & 1;
    const k5 = (code >> 4) & 1;

    // Original schematic names: E F H J K M N.
    const on = {E:false,F:false,H:false,J:false,K:false,M:false,N:false};

    // Entire K1 contact set.
    if (k1) on.H = true;

    // Entire K4 contact set.
    if (k4) on.J = true;

    // Left contact of K3.
    if (k3) on.F = true;

    // Left contact of K5.
    if (k5) on.E = true;

    // Right contact of K2: K follows E when K2 is released.
    if (!k2) on.K = on.E;

    // Left contact of K2: M follows F when released, otherwise energizes.
    on.M = !k2 ? on.F : true;

    // Right contact of K3 feeds the right contact of K5 and therefore N.
    const internal = !k3 ? on.J : true;
    if (k5) on.N = internal;

    let segments = '';
    if (on.E) segments += 'a';
    if (on.H) segments += 'b';
    if (on.M) segments += 'c';
    if (on.N) segments += 'd';
    if (on.K) segments += 'e';
    if (on.F) segments += 'f';
    if (on.J) segments += 'g';
    return segments;
  }

  function relayGlyph(code, x) {
    const had = Object.prototype.hasOwnProperty.call(SEG, MATRIX_KEY);
    const previous = SEG[MATRIX_KEY];
    SEG[MATRIX_KEY] = segmentsForRelayCode(code);
    try {
      return glyph(MATRIX_KEY, x);
    } finally {
      if (had) SEG[MATRIX_KEY] = previous;
      else delete SEG[MATRIX_KEY];
    }
  }

  function word(bank) {
    return Number(agcRelayWords[bank] || 0) & 0x7ff;
  }
  function cCode(bank) { return (word(bank) >> 5) & 0x1f; }
  function dCode(bank) { return word(bank) & 0x1f; }
  function advance() {
    return Number(window.DSKY_DRAWING_GEOMETRY && window.DSKY_DRAWING_GEOMETRY.digitAdvance) || 14;
  }

  function renderPair(id, bank) {
    const el = document.getElementById(id);
    if (!el) return;
    const step = advance();
    el.innerHTML = relayGlyph(cCode(bank), 0) + relayGlyph(dCode(bank), step);
  }

  function registerCodes(name) {
    if (name === 'r1') return [dCode(8), cCode(7), dCode(7), cCode(6), dCode(6)];
    if (name === 'r2') return [cCode(5), dCode(5), cCode(4), dCode(4), cCode(3)];
    return [dCode(3), cCode(2), dCode(2), cCode(1), dCode(1)];
  }

  function renderRegister(name) {
    const el = document.getElementById(name);
    if (!el) return;
    const step = advance();
    const first = 12.0;
    const reg = agcDisplay[name];
    let out = signGlyph(regSign(reg));
    registerCodes(name).forEach((code, index) => {
      out += relayGlyph(code, first + index * step);
    });
    el.innerHTML = out;
  }

  function renderBank(bank) {
    if (bank === 11) renderPair('prog', 11);
    else if (bank === 10) renderPair('verb', 10);
    else if (bank === 9) renderPair('noun', 9);
    else if (bank === 8 || bank === 7 || bank === 6) renderRegister('r1');
    else if (bank === 5 || bank === 4) renderRegister('r2');
    else if (bank === 3) { renderRegister('r2'); renderRegister('r3'); }
    else if (bank === 2 || bank === 1) renderRegister('r3');
  }

  function renderAllRelayCharacters() {
    renderPair('prog', 11);
    renderPair('verb', 10);
    renderPair('noun', 9);
    renderRegister('r1');
    renderRegister('r2');
    renderRegister('r3');
  }

  const baseDecodeChannel10 = decodeChannel10;
  decodeChannel10 = function schematicRelayDecode(value) {
    const bank = (Number(value) >> 11) & 0x0f;
    baseDecodeChannel10(value);
    if (bank >= 1 && bank <= 11) renderBank(bank);
  };

  if (typeof renderAgcSnapshot === 'function') {
    const baseRenderAgcSnapshot = renderAgcSnapshot;
    renderAgcSnapshot = function schematicRelaySnapshot() {
      baseRenderAgcSnapshot();
      renderAllRelayCharacters();
    };
  }

  window.DSKY_RELAY_MATRIX = Object.freeze({
    source: 'Apollo DSKY relay-contact schematic via VirtualAGC Tools/traceDSKY.py',
    banks: 12,
    relaysPerBank: 11,
    characterRelays: 5,
    segmentsForCode: code => segmentsForRelayCode(code)
  });
})();
