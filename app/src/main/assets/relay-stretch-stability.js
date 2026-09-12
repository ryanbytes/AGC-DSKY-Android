'use strict';

/*
 * Stretched-relay presentation stability shim.
 *
 * The physical relay model still latches at the real 20-ms boundary. In
 * STRETCHED presentation mode, however, hardware-fidelity.js also performs its
 * normal settled-word paint at that boundary. A separate later repaint cannot
 * safely hide that paint: the browser can present the settled word for a frame
 * before the stretched face is restored, which looks like an already-lit EL
 * element flickering off and back on.
 *
 * Keep the physical latch/AGC path untouched. For stretched presentation only:
 *   1. derive the relay word represented by the face that is actually visible;
 *   2. let relay-visual-coupling use that visible word as its presentation
 *      starting point, even if the private hardware latch is already ahead;
 *   3. wrap the hardware layer's 20-ms settle callback so its normal paint and
 *      restoration of the current stretched presentation happen in the SAME
 *      JavaScript task. The browser therefore never receives an intermediate
 *      settled-word frame to composite.
 *
 * The restoration word is captured when the 20-ms callback actually fires,
 * not when the channel write was scheduled. Once a stretched relay transition
 * has been presented, the settle path therefore cannot roll that contact back.
 * Authentic mode is a complete pass-through.
 */
(() => {
  const visual = window.DSKY_RELAY_VISUAL;
  if (!visual || typeof visual.getTimingMode !== 'function' || typeof visual.renderWord !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;
  if (typeof decodeChannel10 !== 'function' || typeof relayDigit !== 'function') return;

  const MODE_STRETCHED = 'stretched';
  const FINAL_SETTLE_MS = Number(visual.finalSettleMs) || 20;
  const baseDecodeChannel10 = decodeChannel10;

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

  function withAtomicSettlePaint(row, fn) {
    const host = typeof globalThis !== 'undefined' ? globalThis : window;
    const nativeSetTimeout = host.setTimeout;
    if (typeof nativeSetTimeout !== 'function') return fn();
    let settleWrapped = false;

    host.setTimeout = function stretchedSettleAwareTimeout(callback, delay, ...args) {
      const ms = Number(delay);
      if (!settleWrapped && Number.isFinite(ms) && Math.abs(ms - FINAL_SETTLE_MS) < 0.001) {
        settleWrapped = true;
        return nativeSetTimeout.call(host, () => {
          if (visual.getTimingMode() !== MODE_STRETCHED) {
            callback(...args);
            return;
          }

          // Capture at execution time. A stretched contact that became visible
          // after this channel write was issued is now part of the held state
          // and may not be rolled back by the physical settle paint.
          const heldWord = capturePresentedWord(row);
          try {
            callback(...args);
          } finally {
            // The hardware callback may update the display model and DOM while
            // committing the real latch. Restore the held presentation before
            // yielding this task, so no browser frame can contain that hidden
            // settled-word paint.
            visual.renderWord(row, heldWord);
          }
        }, ms);
      }
      return nativeSetTimeout.call(host, callback, delay, ...args);
    };

    try { return fn(); }
    finally { host.setTimeout = nativeSetTimeout; }
  }

  decodeChannel10 = function stableStretchedRelayDecode(value) {
    const word = Number(value) & 0o77777;
    const row = (word >> 11) & 0o17;
    if (row < 1 || row > 12 || visual.getTimingMode() !== MODE_STRETCHED) {
      return baseDecodeChannel10(value);
    }

    const presentedWord = capturePresentedWord(row);

    // relay-visual-coupling asks AGCDSKY.hardware() synchronously for its prior
    // presentation word. Supply what the crew is actually seeing while the
    // private hardware model continues to see and update its real latch state.
    const result = withAtomicSettlePaint(row, () =>
      withPresentedLatch(row, presentedWord, () => baseDecodeChannel10(value))
    );

    // A new channel write must begin from what is actually on the face, not a
    // private latch that may already be ahead. This immediate render is safe:
    // later legitimate stretched contacts own all subsequent visible changes.
    visual.renderWord(row, presentedWord);
    return result;
  };

  window.DSKY_RELAY_STRETCH_STABILITY = Object.freeze({
    mode: 'same-task-settle-shield',
    settleShieldMs: FINAL_SETTLE_MS,
    settleRepaintSameTask: true,
    capturePresentedWord
  });
})();
