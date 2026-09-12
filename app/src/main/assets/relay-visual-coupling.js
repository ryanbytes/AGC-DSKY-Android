'use strict';

/*
 * Couple the visible EL/contact output to the individual relay that drives it.
 *
 * hardware-fidelity.js remains authoritative for the 20-ms bank-drive/settle
 * envelope and final latched low-11 state. relay-identity-audio.js supplies the
 * deterministic per-relay set/reset mechanical profile. This layer observes
 * each channel-010 bank command and renders the electrically possible
 * intermediate contact-matrix state when each changed physical relay reaches
 * its armature/contact transition.
 *
 * The five K-relays for each character are decoded by dsky-relay-matrix.js,
 * which follows the original DSKY relay schematic (E/F/H/J/K/M/N sections).
 * Contact bounce remains modeled for diagnostics/audio but is not flashed onto
 * the EL phosphor: its sub-millisecond reversals are below the fidelity we can
 * justify optically. The original 20-ms render still confirms the final state.
 */
(() => {
  if (typeof decodeChannel10 !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;
  if (!window.DSKY_RELAY_AUDIO || typeof window.DSKY_RELAY_AUDIO.profileFor !== 'function') return;
  if (!window.DSKY_RELAY_MATRIX || typeof window.DSKY_RELAY_MATRIX.segmentsForCode !== 'function') return;

  const baseDecodeChannel10 = decodeChannel10;
  const generation = Object.create(null);

  function currentSettledWord(row) {
    try {
      const state = window.AGCDSKY.hardware();
      if (state && state.latches && state.latches[row] !== undefined) {
        return Number(state.latches[row]) & 0o3777;
      }
    } catch (_) {}
    try {
      if (agcRelayWords && agcRelayWords[row] !== undefined) {
        return Number(agcRelayWords[row]) & 0o3777;
      }
    } catch (_) {}
    return 0;
  }

  function renderWord(row, low11) {
    low11 &= 0o3777;
    const b = (low11 >> 10) & 1;
    const c = (low11 >> 5) & 0o37;
    const d = low11 & 0o37;

    switch (row) {
      case 12:
        setLamp('vel', !!(low11 & 0o00004));
        setLamp('noatt', !!(low11 & 0o00010));
        setLamp('alt', !!(low11 & 0o00020));
        setLamp('gimbal', !!(low11 & 0o00040));
        setLamp('tracker', !!(low11 & 0o00200));
        setLamp('prog', !!(low11 & 0o00400));
        break;
      case 11:
        agcDisplay.prog[0] = relayDigit(c);
        agcDisplay.prog[1] = relayDigit(d);
        set2('prog', agcDisplay.prog.join(''));
        break;
      case 10:
        agcDisplay.verb[0] = relayDigit(c);
        agcDisplay.verb[1] = relayDigit(d);
        set2('verb', agcDisplay.verb.join(''));
        break;
      case 9:
        agcDisplay.noun[0] = relayDigit(c);
        agcDisplay.noun[1] = relayDigit(d);
        set2('noun', agcDisplay.noun.join(''));
        break;
      case 8:
        agcDisplay.r1.digits[0] = relayDigit(d);
        renderAgcReg('r1');
        break;
      case 7:
        agcDisplay.r1.plus = !!b;
        agcDisplay.r1.digits[1] = relayDigit(c);
        agcDisplay.r1.digits[2] = relayDigit(d);
        renderAgcReg('r1');
        break;
      case 6:
        agcDisplay.r1.minus = !!b;
        agcDisplay.r1.digits[3] = relayDigit(c);
        agcDisplay.r1.digits[4] = relayDigit(d);
        renderAgcReg('r1');
        break;
      case 5:
        agcDisplay.r2.plus = !!b;
        agcDisplay.r2.digits[0] = relayDigit(c);
        agcDisplay.r2.digits[1] = relayDigit(d);
        renderAgcReg('r2');
        break;
      case 4:
        agcDisplay.r2.minus = !!b;
        agcDisplay.r2.digits[2] = relayDigit(c);
        agcDisplay.r2.digits[3] = relayDigit(d);
        renderAgcReg('r2');
        break;
      case 3:
        agcDisplay.r2.digits[4] = relayDigit(c);
        agcDisplay.r3.digits[0] = relayDigit(d);
        renderAgcReg('r2');
        renderAgcReg('r3');
        break;
      case 2:
        agcDisplay.r3.plus = !!b;
        agcDisplay.r3.digits[1] = relayDigit(c);
        agcDisplay.r3.digits[2] = relayDigit(d);
        renderAgcReg('r3');
        break;
      case 1:
        agcDisplay.r3.minus = !!b;
        agcDisplay.r3.digits[3] = relayDigit(c);
        agcDisplay.r3.digits[4] = relayDigit(d);
        renderAgcReg('r3');
        break;
    }
  }

  function contactDelayMs(row, bit, engaging) {
    try {
      const profile = window.DSKY_RELAY_AUDIO.profileFor(row, bit);
      const value = engaging ? profile.setTravelMs : profile.resetTravelMs;
      if (Number.isFinite(value)) return Math.max(0, Math.min(19.5, value));
    } catch (_) {}
    // Fallback mirrors the legacy mechanical fingerprint if the identity layer
    // cannot provide a profile for some reason.
    const fallback = [6.2,11.7,8.4,13.6,7.1,15.0,9.5,12.5,5.6,14.3,10.5];
    return fallback[bit] || 10;
  }

  function scheduleContactVisuals(row, prior, target) {
    const token = (generation[row] || 0) + 1;
    generation[row] = token;
    const motions = [];
    const diff = (prior ^ target) & 0o3777;

    for (let bit = 0; bit < 11; bit++) {
      const mask = 1 << bit;
      if (!(diff & mask)) continue;
      const on = !!(target & mask);
      motions.push({bit, mask, on, delayMs:contactDelayMs(row, bit, on)});
    }
    motions.sort((a, b) => a.delayMs - b.delayMs || a.bit - b.bit);
    if (!motions.length) return;

    let contactWord = prior & 0o3777;
    for (const motion of motions) {
      setTimeout(() => {
        if (generation[row] !== token) return;
        if (motion.on) contactWord |= motion.mask;
        else contactWord &= ~motion.mask;
        renderWord(row, contactWord);
      }, motion.delayMs);
    }
  }

  decodeChannel10 = function relayContactVisualDecode(value) {
    const word = Number(value) & 0o77777;
    const row = (word >> 11) & 0o17;
    const target = word & 0o3777;

    // Row 0 is the physical drive-off word. It carries no new contact target.
    if (row >= 1 && row <= 12) {
      const prior = currentSettledWord(row);
      scheduleContactVisuals(row, prior, target);
    }

    // Preserve the complete existing hardware path, including relay audio,
    // latching state, 20-ms final settle, and yaAGC-visible behavior.
    return baseDecodeChannel10(value);
  };

  window.DSKY_RELAY_VISUAL = Object.freeze({
    mode: 'individual-contact-coupled',
    finalSettleMs: 20,
    contactBounceVisible: false,
    contactDelayMs,
    renderWord
  });
})();
