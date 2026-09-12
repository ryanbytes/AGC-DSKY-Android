'use strict';

/*
 * Couple the visible EL/contact output to the individual relay that drives it.
 *
 * AUTHENTIC mode uses each relay's deterministic physical set/reset travel time
 * (normally about 5-14 ms) and leaves hardware-fidelity.js's 20-ms settled-bank
 * render untouched.
 *
 * STRETCHED mode is explicitly a visual presentation aid for displays whose
 * refresh cadence cannot expose sub-frame relay differences. The AGC, relay
 * latches, relay audio, channel timing, and 20-ms physical settle boundary are
 * NOT slowed. Only the rendered EL/contact sequence is expanded.
 *
 * In stretched mode a frame-lock keeps the last presentation contact state on
 * the screen while the underlying hardware model continues to settle normally.
 * This avoids the old final-state -> prior-state reset flash. Each changed relay
 * then advances the presentation once, with a deterministic delay derived from
 * that relay's own set/reset travel, stable-contact tail, pole skew and bounce
 * fingerprint. Bounce remains diagnostic/audio-only; it is never replayed as
 * EL flicker.
 *
 * The five K-relays for each character are decoded by dsky-relay-matrix.js,
 * which follows the original DSKY relay schematic (E/F/H/J/K/M/N sections).
 */
(() => {
  if (typeof decodeChannel10 !== 'function') return;
  if (!window.AGCDSKY || typeof window.AGCDSKY.hardware !== 'function') return;
  if (!window.DSKY_RELAY_AUDIO || typeof window.DSKY_RELAY_AUDIO.profileFor !== 'function') return;
  if (!window.DSKY_RELAY_MATRIX || typeof window.DSKY_RELAY_MATRIX.segmentsForCode !== 'function') return;

  const STORAGE_KEY = 'relayVisualTimingV1';
  const MODE_AUTHENTIC = 'authentic';
  const MODE_STRETCHED = 'stretched';
  const FINAL_SETTLE_MS = 20;

  const STRETCH_FIRST_BASE_MS = 72;
  const STRETCH_MIN_GAP_MS = 42;
  const STRETCH_MAX_GAP_MS = 78;
  const STRETCH_RELEASE_HOLD_MS = 38;

  const baseDecodeChannel10 = decodeChannel10;
  const generation = Object.create(null);
  const presentation = Object.create(null);
  let frameLoopRunning = false;

  function getStoredMode() {
    let value = null;
    try {
      if (typeof store !== 'undefined' && store && typeof store.get === 'function') value = store.get(STORAGE_KEY);
      else if (typeof localStorage !== 'undefined') value = localStorage.getItem(STORAGE_KEY);
    } catch (_) {}
    return value === MODE_STRETCHED ? MODE_STRETCHED : MODE_AUTHENTIC;
  }

  function saveMode(value) {
    try {
      if (typeof store !== 'undefined' && store && typeof store.set === 'function') store.set(STORAGE_KEY, value);
      else if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {}
  }

  let timingMode = getStoredMode();

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

  function profileFor(row, bit) {
    try { return window.DSKY_RELAY_AUDIO.profileFor(row, bit) || null; }
    catch (_) { return null; }
  }

  function contactDelayMs(row, bit, engaging) {
    const profile = profileFor(row, bit);
    if (profile) {
      const value = engaging ? profile.setTravelMs : profile.resetTravelMs;
      if (Number.isFinite(value)) return Math.max(0, Math.min(19.5, value));
    }
    const fallback = [6.2,11.7,8.4,13.6,7.1,15.0,9.5,12.5,5.6,14.3,10.5];
    return fallback[bit] || 10;
  }

  function collectMotions(row, prior, target) {
    const motions = [];
    const diff = (prior ^ target) & 0o3777;
    for (let bit = 0; bit < 11; bit++) {
      const mask = 1 << bit;
      if (!(diff & mask)) continue;
      const on = !!(target & mask);
      const profile = profileFor(row, bit);
      const physicalMs = contactDelayMs(row, bit, on);
      const stableCandidate = profile ? (on ? profile.setStableMs : profile.resetStableMs) : physicalMs;
      const stableMs = Number.isFinite(stableCandidate) ? Math.max(physicalMs, stableCandidate) : physicalMs;
      const bounceCountCandidate = profile ? (on ? profile.setBounceCount : profile.resetBounceCount) : 0;
      const bounceCount = Number.isFinite(bounceCountCandidate) ? Math.max(0, bounceCountCandidate) : 0;
      const poleSkewUs = profile && Number.isFinite(profile.poleSkewUs) ? profile.poleSkewUs : 0;
      motions.push({bit, mask, on, physicalMs, stableMs, bounceCount, poleSkewUs});
    }
    motions.sort((a, b) => a.physicalMs - b.physicalMs || a.bit - b.bit);
    return motions;
  }

  function stretchedGapMs(motion) {
    const tailMs = Math.max(0, motion.stableMs - motion.physicalMs);
    const signature =
      tailMs * 8.0 +
      Math.min(18, Math.abs(motion.poleSkewUs) / 11) +
      Math.min(14, motion.bounceCount * 2.2) +
      (motion.physicalMs - 4.7) * 1.7;
    return Math.max(STRETCH_MIN_GAP_MS, Math.min(STRETCH_MAX_GAP_MS, STRETCH_MIN_GAP_MS + signature));
  }

  function stretchedSchedule(motions) {
    let at = 0;
    return motions.map((motion, index) => {
      if (index === 0) {
        at = STRETCH_FIRST_BASE_MS + motion.physicalMs * 2.4 +
          Math.min(16, Math.abs(motion.poleSkewUs) / 14);
      } else {
        at += stretchedGapMs(motion);
      }
      return {...motion, stretchedMs: Math.round(at * 10) / 10};
    });
  }

  function activePresentations() {
    for (let row = 1; row <= 12; row++) {
      const state = presentation[row];
      if (state && state.active) return true;
    }
    return false;
  }

  function frameStep() {
    frameLoopRunning = false;
    if (timingMode !== MODE_STRETCHED) return;
    for (let row = 1; row <= 12; row++) {
      const state = presentation[row];
      if (!state || !state.active) continue;
      if (generation[row] !== state.token) {
        state.active = false;
        continue;
      }
      renderWord(row, state.contactWord);
    }
    if (activePresentations()) requestFrameLoop();
  }

  function requestFrameLoop() {
    if (frameLoopRunning || timingMode !== MODE_STRETCHED) return;
    frameLoopRunning = true;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frameStep);
    else setTimeout(frameStep, 16);
  }

  function releasePresentation(row, token, target) {
    setTimeout(() => {
      const state = presentation[row];
      if (!state || !state.active || state.token !== token || generation[row] !== token) return;
      state.contactWord = target & 0o3777;
      renderWord(row, state.contactWord);
      state.active = false;
    }, STRETCH_RELEASE_HOLD_MS);
  }

  function scheduleContactVisuals(row, prior, target) {
    const token = (generation[row] || 0) + 1;
    generation[row] = token;
    const motions = collectMotions(row, prior, target);
    if (!motions.length) return;

    if (timingMode === MODE_STRETCHED) {
      const scheduled = stretchedSchedule(motions);
      const state = presentation[row] = {
        token,
        active: true,
        contactWord: prior & 0o3777,
        target: target & 0o3777,
        scheduled
      };

      renderWord(row, state.contactWord);
      requestFrameLoop();

      scheduled.forEach((motion, index) => {
        setTimeout(() => {
          const live = presentation[row];
          if (!live || !live.active || live.token !== token || generation[row] !== token || timingMode !== MODE_STRETCHED) return;
          if (motion.on) live.contactWord |= motion.mask;
          else live.contactWord &= ~motion.mask;
          renderWord(row, live.contactWord);
          if (index === scheduled.length - 1) releasePresentation(row, token, target);
        }, motion.stretchedMs);
      });
      return;
    }

    let contactWord = prior & 0o3777;
    for (const motion of motions) {
      setTimeout(() => {
        if (generation[row] !== token || timingMode !== MODE_AUTHENTIC) return;
        if (motion.on) contactWord |= motion.mask;
        else contactWord &= ~motion.mask;
        renderWord(row, contactWord);
      }, motion.physicalMs);
    }
  }

  function cancelPendingVisuals() {
    for (let row = 1; row <= 12; row++) {
      generation[row] = (generation[row] || 0) + 1;
      if (presentation[row]) presentation[row].active = false;
    }
  }

  function syncSettledVisuals() {
    for (let row = 1; row <= 12; row++) renderWord(row, currentSettledWord(row));
  }

  function setTimingMode(next, persist = true) {
    const normalized = next === MODE_STRETCHED ? MODE_STRETCHED : MODE_AUTHENTIC;
    if (normalized === timingMode) {
      updateButton();
      return timingMode;
    }
    cancelPendingVisuals();
    timingMode = normalized;
    if (persist) saveMode(timingMode);
    syncSettledVisuals();
    updateButton();
    return timingMode;
  }

  function presentationDurationMs(row, prior, target) {
    if (timingMode !== MODE_STRETCHED) return FINAL_SETTLE_MS;
    const schedule = stretchedSchedule(collectMotions(row, prior, target));
    if (!schedule.length) return 0;
    return schedule[schedule.length - 1].stretchedMs + STRETCH_RELEASE_HOLD_MS;
  }

  const button = document.getElementById('relay-timing');
  function updateButton() {
    if (!button) return;
    const stretched = timingMode === MODE_STRETCHED;
    button.textContent = stretched ? 'RELAY VISUAL STRETCHED' : 'RELAY VISUAL AUTHENTIC';
    button.setAttribute('aria-pressed', stretched ? 'true' : 'false');
    button.title = stretched
      ? 'Visual-only per-relay stretched timing; AGC and physical relay timing remain authentic'
      : 'Authentic modeled relay contact timing';
  }

  if (button) {
    button.addEventListener('click', () => {
      setTimingMode(timingMode === MODE_AUTHENTIC ? MODE_STRETCHED : MODE_AUTHENTIC, true);
      try { if (typeof showControls === 'function') showControls(); } catch (_) {}
    });
  }
  updateButton();

  decodeChannel10 = function relayContactVisualDecode(value) {
    const word = Number(value) & 0o77777;
    const row = (word >> 11) & 0o17;
    const target = word & 0o3777;

    if (row >= 1 && row <= 12) {
      const prior = currentSettledWord(row);
      scheduleContactVisuals(row, prior, target);
    }

    return baseDecodeChannel10(value);
  };

  window.DSKY_RELAY_VISUAL = Object.freeze({
    mode: 'individual-contact-coupled',
    finalSettleMs: FINAL_SETTLE_MS,
    contactBounceVisible: false,
    authenticTiming: true,
    stretchedVisualOnly: true,
    stretchFirstBaseMs: STRETCH_FIRST_BASE_MS,
    stretchMinGapMs: STRETCH_MIN_GAP_MS,
    stretchMaxGapMs: STRETCH_MAX_GAP_MS,
    stretchReleaseHoldMs: STRETCH_RELEASE_HOLD_MS,
    getTimingMode: () => timingMode,
    setTimingMode,
    contactDelayMs,
    stretchedGapMs,
    stretchedScheduleFor: (row, prior, target) => stretchedSchedule(collectMotions(row, prior, target)).map(item => ({...item})),
    presentationDurationMs,
    renderWord
  });
})();
