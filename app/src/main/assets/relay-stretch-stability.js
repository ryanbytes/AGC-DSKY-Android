'use strict';

/*
 * STRETCHED presentation stability layer.
 *
 * The real DSKY relay/latch model remains authoritative and still settles at
 * 20 ms.  STRETCHED is only a deliberately slowed crew-facing presentation.
 * This layer prevents the slowed presentation from manufacturing optical
 * artifacts that are not useful representations of the hardware:
 *
 *   - the hidden 20-ms hardware settle may update the latch/model, but is not
 *     allowed to paint or advance the stretched optical state;
 *   - identical EL surfaces are not rebuilt on every animation frame;
 *   - a segment that is changing from its displayed state toward the final
 *     K1..K5 target may make that transition once, but later intermediate
 *     K1..K5 states cannot reverse it (no artificial on-off-on flicker).
 *
 * AUTHENTIC mode is a pass-through.
 */
(() => {
  const visual = window.DSKY_RELAY_VISUAL;
  if (!visual || typeof visual.getTimingMode !== 'function' || typeof visual.renderWord !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;
  if (typeof decodeChannel10 !== 'function' || typeof relayDigit !== 'function') return;

  const MODE_STRETCHED = 'stretched';
  const FINAL_SETTLE_MS = Number(visual.finalSettleMs) || 20;
  const SEGMENT_ORDER = 'abcdefg';
  const SEGMENT_FULL_MASK = 0x7f;
  const baseDecodeChannel10 = decodeChannel10;

  let suppressCrewFacingWrite = 0;
  let lastObservedStretched = null;

  const codeForChar = new Map();
  const pseudoCharForMask = new Map();
  const shownMaskByPosition = new Map();
  const guardByPosition = new Map();
  const lastSurfaceSignature = new Map();

  for (let code = 0; code < 32; code++) codeForChar.set(relayDigit(code), code);

  const pairPositions = Object.freeze({
    prog: ['prog0', 'prog1'],
    verb: ['verb0', 'verb1'],
    noun: ['noun0', 'noun1']
  });
  const regPositions = Object.freeze({
    r1: ['r1d0', 'r1d1', 'r1d2', 'r1d3', 'r1d4'],
    r2: ['r2d0', 'r2d1', 'r2d2', 'r2d3', 'r2d4'],
    r3: ['r3d0', 'r3d1', 'r3d2', 'r3d3', 'r3d4']
  });

  function isStretched() {
    const stretched = visual.getTimingMode() === MODE_STRETCHED;
    if (lastObservedStretched !== stretched) {
      guardByPosition.clear();
      lastSurfaceSignature.clear();
      lastObservedStretched = stretched;
    }
    return stretched;
  }

  function codeOf(ch) {
    return codeForChar.has(ch) ? codeForChar.get(ch) : 0;
  }

  function hardwareLatch(row) {
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
          let mask = 0;
          let visible = 0;
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
        case 11: return mergeVisible(base, 0o1777, pairWord(agcDisplay.prog));
        case 10: return mergeVisible(base, 0o1777, pairWord(agcDisplay.verb));
        case 9:  return mergeVisible(base, 0o1777, pairWord(agcDisplay.noun));
        case 8:  return mergeVisible(base, 0o0037, codeOf(agcDisplay.r1.digits[0]));
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
        default: return base;
      }
    } catch (_) {
      return base;
    }
  }

  function withPresentedLatch(row, presentedWord, fn) {
    const actualHardware = window.AGCDSKY.hardware;
    window.AGCDSKY.hardware = function presentationAwareHardwareSnapshot() {
      const state = actualHardware.call(window.AGCDSKY);
      if (!state || !state.latches) return state;
      return {...state, latches: {...state.latches, [row]: presentedWord & 0o3777}};
    };
    try {
      return fn();
    } finally {
      window.AGCDSKY.hardware = actualHardware;
    }
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

          // Snapshot the crew-facing state at execution time.  The physical
          // callback is allowed to settle the real latch/model, but its normal
          // renderer is hidden from the stretched optical state.  In
          // particular, it must not make the monotonic guard believe the final
          // K1..K5 contact has already occurred.
          const heldWord = capturePresentedWord(row);
          suppressCrewFacingWrite++;
          try {
            callback(...args);
          } finally {
            suppressCrewFacingWrite--;
            visual.renderWord(row, heldWord);
          }
        }, ms);
      }
      return nativeSetTimeout.call(host, callback, delay, ...args);
    };

    try {
      return fn();
    } finally {
      host.setTimeout = nativeSetTimeout;
    }
  }

  function maskForSegments(segments) {
    let mask = 0;
    const text = String(segments || '');
    for (let i = 0; i < SEGMENT_ORDER.length; i++) {
      if (text.includes(SEGMENT_ORDER[i])) mask |= (1 << i);
    }
    return mask & SEGMENT_FULL_MASK;
  }

  function maskForChar(ch) {
    try {
      if (typeof SEG === 'object' && SEG) return maskForSegments(SEG[ch] || '');
    } catch (_) {}
    return 0;
  }

  function maskForRelayCode(code) {
    try {
      if (window.DSKY_RELAY_MATRIX && typeof window.DSKY_RELAY_MATRIX.segmentsForCode === 'function') {
        return maskForSegments(window.DSKY_RELAY_MATRIX.segmentsForCode(Number(code) & 0x1f));
      }
    } catch (_) {}
    return maskForChar(relayDigit(code));
  }

  function charForMask(mask) {
    const normalized = Number(mask) & SEGMENT_FULL_MASK;
    if (pseudoCharForMask.has(normalized)) return pseudoCharForMask.get(normalized);
    const ch = String.fromCharCode(0xe100 + normalized);
    try {
      if (typeof SEG === 'object' && SEG) {
        let segments = '';
        for (let i = 0; i < SEGMENT_ORDER.length; i++) {
          if (normalized & (1 << i)) segments += SEGMENT_ORDER[i];
        }
        SEG[ch] = segments;
      }
    } catch (_) {}
    pseudoCharForMask.set(normalized, ch);
    return ch;
  }

  function rowCharacterPositions(row, low11) {
    const c = (low11 >> 5) & 0o37;
    const d = low11 & 0o37;
    switch (row) {
      case 11: return [['prog0', c], ['prog1', d]];
      case 10: return [['verb0', c], ['verb1', d]];
      case 9:  return [['noun0', c], ['noun1', d]];
      case 8:  return [['r1d0', d]];
      case 7:  return [['r1d1', c], ['r1d2', d]];
      case 6:  return [['r1d3', c], ['r1d4', d]];
      case 5:  return [['r2d0', c], ['r2d1', d]];
      case 4:  return [['r2d2', c], ['r2d3', d]];
      case 3:  return [['r2d4', c], ['r3d0', d]];
      case 2:  return [['r3d1', c], ['r3d2', d]];
      case 1:  return [['r3d3', c], ['r3d4', d]];
      default: return [];
    }
  }

  function beginMonotonicTransition(row, priorWord, targetWord) {
    if (!isStretched() || row < 1 || row > 11) return;
    const priorCodes = new Map(rowCharacterPositions(row, priorWord));
    for (const [position, targetCode] of rowCharacterPositions(row, targetWord)) {
      const fallbackPrior = maskForRelayCode(priorCodes.get(position) || 0);
      const priorMask = shownMaskByPosition.has(position)
        ? shownMaskByPosition.get(position)
        : fallbackPrior;
      const targetMask = maskForRelayCode(targetCode);
      shownMaskByPosition.set(position, priorMask);
      guardByPosition.set(position, {
        targetCode: Number(targetCode) & 0x1f,
        targetMask,
        changedMask: (priorMask ^ targetMask) & SEGMENT_FULL_MASK
      });
    }
  }

  function filteredMask(position, requestedMask, requestedCode) {
    const requested = Number(requestedMask) & SEGMENT_FULL_MASK;
    if (!isStretched()) {
      shownMaskByPosition.set(position, requested);
      return requested;
    }

    const guard = guardByPosition.get(position);
    if (!guard) {
      shownMaskByPosition.set(position, requested);
      return requested;
    }

    let shown = shownMaskByPosition.has(position) ? shownMaskByPosition.get(position) : requested;
    const pending = guard.changedMask & (shown ^ guard.targetMask);
    const atTarget = (~(requested ^ guard.targetMask)) & SEGMENT_FULL_MASK;
    const commit = pending & atTarget;
    shown = ((shown & ~commit) | (guard.targetMask & commit)) & SEGMENT_FULL_MASK;
    shownMaskByPosition.set(position, shown);

    // Only the exact target K1..K5 code proves that every changed relay for
    // this character has made its legitimate final contact.  Do not release
    // the guard merely because an intermediate code is optically identical.
    if ((Number(requestedCode) & 0x1f) === guard.targetCode) guardByPosition.delete(position);
    return shown;
  }

  function stabilizePairText(id, text) {
    const keys = pairPositions[id];
    if (!keys) return null;
    const chars = String(text || '').padEnd(2, ' ').slice(0, 2).split('');
    const masks = chars.map((ch, i) => filteredMask(keys[i], maskForChar(ch), codeOf(ch)));
    return {text: masks.map(charForMask).join(''), signature: `${id}:${masks.join(',')}`};
  }

  function stabilizeRegisterText(id, sign, digits) {
    const keys = regPositions[id];
    if (!keys) return null;
    const chars = String(digits || '').padEnd(5, ' ').slice(0, 5).split('');
    const masks = chars.map((ch, i) => filteredMask(keys[i], maskForChar(ch), codeOf(ch)));
    return {
      digits: masks.map(charForMask).join(''),
      signature: `${id}:${String(sign || ' ')}:${masks.join(',')}`
    };
  }

  if (typeof set2 === 'function') {
    const baseSet2 = set2;
    set2 = function stableStretchedSet2(id, text) {
      if (suppressCrewFacingWrite > 0) return;
      if (!isStretched()) return baseSet2(id, text);
      const stable = stabilizePairText(id, text);
      if (!stable) return baseSet2(id, text);
      if (lastSurfaceSignature.get(id) === stable.signature) return;
      lastSurfaceSignature.set(id, stable.signature);
      return baseSet2(id, stable.text);
    };
  }

  if (typeof setReg === 'function') {
    const baseSetReg = setReg;
    setReg = function stableStretchedSetReg(id, sign, digits) {
      if (suppressCrewFacingWrite > 0) return;
      if (!isStretched()) return baseSetReg(id, sign, digits);
      const stable = stabilizeRegisterText(id, sign, digits);
      if (!stable) return baseSetReg(id, sign, digits);
      if (lastSurfaceSignature.get(id) === stable.signature) return;
      lastSurfaceSignature.set(id, stable.signature);
      return baseSetReg(id, sign, stable.digits);
    };
  }

  decodeChannel10 = function stableStretchedRelayDecode(value) {
    const word = Number(value) & 0o77777;
    const row = (word >> 11) & 0o17;
    if (row < 1 || row > 12 || visual.getTimingMode() !== MODE_STRETCHED) {
      return baseDecodeChannel10(value);
    }

    const presentedWord = capturePresentedWord(row);
    beginMonotonicTransition(row, presentedWord, word & 0o3777);

    const result = withAtomicSettlePaint(row, () =>
      withPresentedLatch(row, presentedWord, () => baseDecodeChannel10(value))
    );

    visual.renderWord(row, presentedWord);
    return result;
  };

  window.DSKY_RELAY_STRETCH_STABILITY = Object.freeze({
    mode: 'same-task-settle-shield',
    settleShieldMs: FINAL_SETTLE_MS,
    settleRepaintSameTask: true,
    settleCrewFacingWriteSuppressed: true,
    eventDrivenDomWrites: true,
    monotonicSegments: true,
    capturePresentedWord
  });
})();
