'use strict';

/*
 * Apollo Block II DSKY five-relay character contact matrix.
 *
 * Each numeric character is controlled by five bistable relays K1..K5. Their
 * contacts wire the seven EL sections directly, so there are 32 electrically
 * possible character states even though AGC software normally emits only blank
 * and decimal 0..9.
 *
 * Contact logic follows VirtualAGC Tools/traceDSKY.py, itself traced from the
 * original DSKY relay schematics. Schematic segment names map to the app's
 * conventional seven-segment names as:
 *
 *   E -> a (top)          H -> b (upper right)
 *   M -> c (lower right)  N -> d (bottom)
 *   K -> e (lower left)   F -> f (upper left)
 *   J -> g (middle)
 *
 * app.js/hardware-fidelity.js remain authoritative for the 12 selectable banks
 * of 11 bistable relays (B + C1..C5 + D1..D5), their 20-ms final settle
 * boundary, condition-light row, signs, and physical relay timing.
 * relay-visual-coupling.js uses this exact K1..K5 contact decoder during the
 * sub-20-ms armature motion so the EL elements follow the individual relay
 * contacts instead of waiting for the entire bank's final settled render.
 */
(() => {
  if (typeof relayDigit !== 'function' || typeof SEG !== 'object') return;

  function segmentsForRelayCode(value) {
    const code = Number(value) & 0x1f;
    const k1 = (code >> 0) & 1;
    const k2 = (code >> 1) & 1;
    const k3 = (code >> 2) & 1;
    const k4 = (code >> 3) & 1;
    const k5 = (code >> 4) & 1;

    // Original schematic segment names: E F H J K M N.
    const on = {E:false,F:false,H:false,J:false,K:false,M:false,N:false};

    if (k1) on.H = true;       // entire K1
    if (k4) on.J = true;       // entire K4
    if (k3) on.F = true;       // left contact of K3
    if (k5) on.E = true;       // left contact of K5
    if (!k2) on.K = on.E;      // right contact of K2
    on.M = !k2 ? on.F : true;  // left contact of K2

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

  // Keep normal codes human-readable in agcDisplay diagnostics. For any of the
  // other 21 physical K1..K5 states, use a private-use character whose SEG
  // entry is the exact contact-matrix result. Existing set2()/renderAgcReg()
  // and the source-art glyph renderer can draw both settled and intermediate
  // relay-contact states through the same physical decoder.
  const physicalChars = new Array(32);
  for (let code = 0; code < 32; code++) {
    const known = RELAY_DIGIT[code];
    if (known !== undefined) {
      physicalChars[code] = known;
      continue;
    }
    const ch = String.fromCharCode(0xe000 + code);
    SEG[ch] = segmentsForRelayCode(code);
    physicalChars[code] = ch;
  }

  const baseRelayDigit = relayDigit;
  relayDigit = function schematicRelayDigit(code) {
    const value = Number(code);
    if (!Number.isFinite(value)) return baseRelayDigit(code);
    return physicalChars[value & 0x1f];
  };

  window.DSKY_RELAY_MATRIX = Object.freeze({
    source: 'Apollo DSKY relay-contact schematic via VirtualAGC Tools/traceDSKY.py',
    banks: 12,
    relaysPerBank: 11,
    characterRelays: 5,
    segmentsForCode: code => segmentsForRelayCode(code)
  });
})();
