'use strict';

/*
 * Stretched-relay presentation stability shim.
 *
 * The physical relay model must still latch at the real 20-ms boundary, but
 * hardware-fidelity.js also renders that settled word at the same time. In
 * STRETCHED presentation mode that hidden settled render can land between two
 * phone refreshes and briefly expose the final word before the slower visual
 * relay sequence reaches it. The result looks like contact bounce/flicker even
 * though relay-visual-coupling.js never replays electrical bounce visually.
 *
 * Keep the physical latch/AGC path untouched. For stretched presentation only:
 *   1. derive the relay word represented by the face that is actually visible;
 *   2. let relay-visual-coupling use that visible word as its presentation
 *      starting point, even if the private hardware latch is already ahead;
 *   3. repaint that held presentation at the same 20-ms settle deadline. This
 *      timer is registered after the real hardware path, so it follows the
 *      settled hardware update without leaving a separate 1-ms paint window.
 *
 * Authentic mode is a complete pass-through.
 */
(() => {
  const visual = window.DSKY_RELAY_VISUAL;
  if (!visual || typeof visual.getTimingMode !== 'function' || typeof visual.renderWord !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;
  if (typeof decodeChannel10 !== 'function' || typeof relayDigit !== 'function') return;

  const MODE_STRETCHED = 'stretched';
  const FINAL_SETTLE_MS = Number(visual.finalSettleMs) || 20;
  const SETTLE_SHIELD_MS = FINAL_SETTLE_MS;
  const baseDecodeChannel10 = decodeChannel10;
  const generation = Object.create(null);

  // relayDigit() is one-to-one for the 32 electrical K1..K5 states: normal
  // decimal characters retain their readable glyphs and non-decimal states use
  // private-use characters. Reverse it so the currently presented face can be
  // converted back to the physical five-relay word without guessing segments.
  const codeForChar = new Map();
  for (let code = 0; code < 32; code++) codeForChar.set(relayDigit(code), code);

  function codeOf(ch) {
    return codeForChar.has(ch) ? codeForChar.get(ch) : 0;
  }

  function hardwareLatch(row) {
    try {
      const state = window.AGCDSKY.hardware();
      if (state && state.latches && state.latches[row] !== undefined) return Number(state.latches[row]) & 0o3777;
    } catch (_) {}
    try {
      if (agcRelayWords && agcRelayWords[row] !== undefined) return Number(agcRelayWords[row]) & 0o3777;
    } catch (_) {}
    return 0;
  }

  function pairWord(chars) {
    return ((codeOf(chars[0]) & 0o37) << 5) | (codeOf(chars[1]) & 0o37);
  }

  function mergeVisible(base, mask, visible) {
    return ((base & ~mask) | (visible & mask)) & 0o3777;
  }

  function lampState(name) {
    if (!document || typeof document.querySelector !== 'function') return null;
    const el = document.querySelector(`[data-lamp="${name}"]`);
    if (!el || !el.classList || typeof el.classList.contains !== 'function') return null;
    return el.classList.contains('on');
  }

  function capturePresentedWord(row) {
    const base = hardwareLatch(row);
    try {
      switch (row) {
        case 12: {
          let mask = 0, visible = 0;
          const lamps = [
            [0o00004, 'vel'], [0o00010, 'noatt'], [0o00020, 'alt'],
            [0o00040, 'gimbal'], [0o00200, 'tracker'], [0o00400, 'prog']
          ];
          for (const [bit, name] of lamps) {
            const on = lampState(name);
            if (on === null) continue;
            mask |= bit;
            if (on) visible |= bit;
          }
          return mergeVisible(base, mask, visible);
        }
        case 11:
          return mergeVisible(base, 0o1777, pairWord(agcDisplay.prog));
        case 10:
          return mergeVisible(base, 0o1777, pairWord(agcDisplay.verb));
        case 9:
          return mergeVisible(base, 0o1777, pairWord(agcDisplay.noun));
        case 8:
          return mergeVisible(base, 0o0037, codeOf(agcDisplay.r1.digits[0]));
        case 7:
          return ((agcDisplay.r1.plus ? 0o2000 : 0) |
            ((codeOf(agcDisplay.r1.digits[1]) & 0o37) << 5) |
            (codeOf(agcDisplay.r1.digits[2]) & 0o37)) & 0o3777;
        case 6:
          return ((agcDisplay.r1.minus ? 0o2000 : 0) |
            ((codeOf(agcDisplay.r1.digits[3]) & 0o37) << 5) |
            (codeOf(agcDisplay.r1.digits[4]) & 0o37)) & 0o3777;
        case 5:
          return ((agcDisplay.r2.plus ? 0o2000 : 0) |
            ((codeOf(agcDisplay.r2.digits[0]) & 0o37) << 5) |
            (codeOf(agcDisplay.r2.digits[1]) & 0o37)) & 0o3777;
        case 4:
          return ((agcDisplay.r2.minus ? 0o2000 : 0) |
            ((codeOf(agcDisplay.r2.digits[2]) & 0o37) << 5) |
            (codeOf(agcDisplay.r2.digits[3]) & 0o37)) & 0o3777;
        case 3:
          return mergeVisible(base, 0o1777,
            ((codeOf(agcDisplay.r2.digits[4]) & 0o37) << 5) |
            (codeOf(agcDisplay.r3.digits[0]) & 0o37));
        case 2:
          return ((agcDisplay.r3.plus ? 0o2000 : 0) |
            ((codeOf(agcDisplay.r3.digits[1]) & 0o37) << 5) |
            (codeOf(agcDisplay.r3.digits[2]) & 0o37)) & 0o3777;
        case 1:
          return ((agcDisplay.r3.minus ? 0o2000 : 0) |
            ((codeOf(agcDisplay.r3.digits[3]) & 0o37) << 5) |
            (codeOf(agcDisplay.r3.digits[4]) & 0o37)) & 0o3777;
      }
    } catch (_) {}
    return base;
  }

  function withPresentedLatch(row, presentedWord, fn) {
    const actualHardware = window.AGCDSKY.hardware;
    window.AGCDSKY.hardware = function presentationAwareHardwareSnapshot() {
      const state = actualHardware.call(window.AGCDSKY);
      if (!state || !state.latches) return state;
      return {
        ...state,
        latches: {...state.latches, [row]: presentedWord & 0o3777}
      };
    };
    try { return fn(); }
    finally { window.AGCDSKY.hardware = actualHardware; }
  }

  decodeChannel10 = function stableStretchedRelayDecode(value) {
    const word = Number(value) & 0o77777;
    const row = (word >> 11) & 0o17;
    if (row < 1 || row > 12 || visual.getTimingMode() !== MODE_STRETCHED) {
      return baseDecodeChannel10(value);
    }

    const presentedWord = capturePresentedWord(row);
    const token = (generation[row] || 0) + 1;
    generation[row] = token;

    // relay-visual-coupling asks AGCDSKY.hardware() synchronously for its prior
    // presentation word. Supply what the crew is actually seeing while the
    // private hardware model continues to see and update its real latch state.
    const result = withPresentedLatch(row, presentedWord, () => baseDecodeChannel10(value));

    // If a new write arrives while an earlier stretched sequence is still
    // visible, do not allow the newer sequence's hardware-ahead prior state to
    // snap the face. Keep the same presented word until its first scheduled
    // relay contact advances it.
    visual.renderWord(row, presentedWord);

    // This timer is registered only after the base hardware decode has already
    // registered its 20-ms settle timer. Equal-deadline FIFO ordering therefore
    // restores the held presentation immediately after the real latch update,
    // before the browser has a useful interval in which to present the hidden
    // final state as a separate frame.
    setTimeout(() => {
      if (generation[row] !== token || visual.getTimingMode() !== MODE_STRETCHED) return;
      visual.renderWord(row, presentedWord);
    }, SETTLE_SHIELD_MS);

    return result;
  };

  window.DSKY_RELAY_STRETCH_STABILITY = Object.freeze({
    mode: 'settled-render-shield',
    settleShieldMs: SETTLE_SHIELD_MS,
    capturePresentedWord
  });
})();
