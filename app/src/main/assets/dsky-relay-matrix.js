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
 * AGCDSKY_DISPLAY/hardware-fidelity.js remain authoritative for the 12
 * selectable banks of 11 bistable relays (B + C1..C5 + D1..D5), their 20-ms
 * final settle boundary, condition-light row, signs, and physical relay timing.
 * relay-visual-coupling.js uses this exact K1..K5 contact decoder during the
 * sub-20-ms armature motion so the EL elements follow the individual relay
 * contacts instead of waiting for the entire bank's final settled render.
 */
(() => {
  const compat=window.AGCDSKY_COMPAT;
  if(!compat)throw new Error('Runtime compatibility bridge unavailable');
  const segments=compat.get('SEG');
  const relayDigits=compat.get('RELAY_DIGIT');
  const baseRelayDigit=compat.get('relayDigit');
  if(typeof baseRelayDigit!=='function'||!segments||typeof segments!=='object'||!relayDigits||typeof relayDigits!=='object')throw new Error('DSKY relay matrix dependencies unavailable');

  function segmentsForRelayCode(value) {
    const code = Number(value) & 0x1f;
    const k1 = (code >> 0) & 1;
    const k2 = (code >> 1) & 1;
    const k3 = (code >> 2) & 1;
    const k4 = (code >> 3) & 1;
    const k5 = (code >> 4) & 1;

    const on = {E:false,F:false,H:false,J:false,K:false,M:false,N:false};
    if (k1) on.H = true;
    if (k4) on.J = true;
    if (k3) on.F = true;
    if (k5) on.E = true;
    if (!k2) on.K = on.E;
    on.M = !k2 ? on.F : true;
    const internal = !k3 ? on.J : true;
    if (k5) on.N = internal;

    let result = '';
    if (on.E) result += 'a';
    if (on.H) result += 'b';
    if (on.M) result += 'c';
    if (on.N) result += 'd';
    if (on.K) result += 'e';
    if (on.F) result += 'f';
    if (on.J) result += 'g';
    return result;
  }

  const physicalChars = new Array(32);
  for (let code = 0; code < 32; code++) {
    const known = relayDigits[code];
    if (known !== undefined) {
      physicalChars[code] = known;
      continue;
    }
    const ch = String.fromCharCode(0xe000 + code);
    segments[ch] = segmentsForRelayCode(code);
    physicalChars[code] = ch;
  }

  function schematicRelayDigit(code) {
    const value = Number(code);
    if (!Number.isFinite(value)) return baseRelayDigit(code);
    return physicalChars[value & 0x1f];
  }
  compat.replace('relayDigit',schematicRelayDigit,'schematic K1-K5 relay matrix');

  window.DSKY_RELAY_MATRIX = Object.freeze({
    source: 'Apollo DSKY relay-contact schematic via VirtualAGC Tools/traceDSKY.py',
    banks: 12,
    relaysPerBank: 11,
    characterRelays: 5,
    segmentsForCode: code => segmentsForRelayCode(code)
  });
})();
