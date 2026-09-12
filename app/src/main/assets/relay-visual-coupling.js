'use strict';

/*
 * Couple visible EL/contact output to the individual relay that drives it.
 *
 * AUTHENTIC mode uses each relay's deterministic physical set/reset travel time
 * and leaves hardware-fidelity.js's 20-ms settled-bank render and full relay
 * contact/bounce audio untouched.
 *
 * STRETCHED mode is a screen presentation aid. The AGC, relay latches, channel
 * timing and 20-ms physical settle boundary remain authentic. A frame lock holds
 * the presentation state while relay contacts are revealed quickly enough to
 * resemble flight footage but far enough apart to survive phone refresh cadence.
 * The stretched click is emitted on the same animation frame as its EL change;
 * the earlier authentic latching-relay click is suppressed in this mode only.
 * Stretched clicks keep each relay's acoustic fingerprint but omit secondary
 * contact-bounce ticks so the sound cannot masquerade as extra EL transitions.
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

  // Brisk presentation: normally one to two 60-Hz frames between contacts.
  const STRETCH_FIRST_BASE_MS = 20;
  const STRETCH_MIN_GAP_MS = 18;
  const STRETCH_MAX_GAP_MS = 28;
  const STRETCH_RELEASE_HOLD_MS = 24;

  const baseDecodeChannel10 = decodeChannel10;
  const baseIdentityEmitTick = typeof emitTick === 'function' ? emitTick : null;
  const generation = Object.create(null);
  const presentation = Object.create(null);
  const presentationBufferCache = new Map();
  let frameLoopRunning = false;
  let lastPresentationClick = null;

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

  // hardware-fidelity schedules latching relay markers at 5.6-15 ms. In
  // stretched mode those would audibly precede their delayed EL changes. Let
  // auxiliary ~1-ms relay events through, but suppress the latching markers;
  // the matching per-relay presentation click is generated at paint time below.
  if (baseIdentityEmitTick) {
    emitTick = function relayVisualTimingAwareTick(ctx, when = ctx.currentTime, strength = 1) {
      if (timingMode === MODE_STRETCHED) {
        let state = null;
        try { state = window.AGCDSKY.hardware(); } catch (_) {}
        const row = Number(state && state.activeDrive) || 0;
        const deltaMs = Math.max(0, (Number(when) - Number(ctx.currentTime)) * 1000);
        if (row >= 1 && row <= 12 && deltaMs >= 4) return;
      }
      return baseIdentityEmitTick(ctx, when, strength);
    };
  }

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
      tailMs * 2.0 +
      Math.min(5, Math.abs(motion.poleSkewUs) / 35) +
      Math.min(4, motion.bounceCount * 0.55) +
      (motion.physicalMs - 4.7) * 0.45;
    return Math.max(STRETCH_MIN_GAP_MS, Math.min(STRETCH_MAX_GAP_MS, STRETCH_MIN_GAP_MS + signature));
  }

  function stretchedSchedule(motions) {
    let at = 0;
    return motions.map((motion, index) => {
      if (index === 0) {
        at = STRETCH_FIRST_BASE_MS + motion.physicalMs * 1.25 +
          Math.min(8, Math.abs(motion.poleSkewUs) / 32);
      } else {
        at += stretchedGapMs(motion);
      }
      return {...motion, stretchedMs: Math.round(at * 10) / 10};
    });
  }

  function xorshift32(seed) {
    let state = (Number(seed) >>> 0) || 1;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function presentationBuffer(ctx, row, bit, engaging, p) {
    const key = `${ctx.sampleRate}|${row}|${bit}|${engaging ? 'set' : 'reset'}`;
    const cached = presentationBufferCache.get(key);
    if (cached) return cached;

    const sr = ctx.sampleRate;
    const duration = engaging ? 0.0105 : 0.0097;
    const n = Math.max(32, Math.floor(sr * duration));
    const buffer = ctx.createBuffer(1, n, sr);
    const data = buffer.getChannelData(0);
    const rnd = xorshift32((p.phaseSeed >>> 0) ^ (engaging ? 0x53455421 : 0x52535421));
    const phase = [rnd(),rnd(),rnd(),rnd()].map(v => v * Math.PI * 2);
    const resetScale = engaging ? 1 : 0.93;
    const decayScale = engaging ? 1 : 0.90;
    let prevNoise = 0, prevDiff = 0;

    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const noise = rnd() * 2 - 1;
      const diff = noise - prevNoise;
      const highNoise = diff - prevDiff;
      prevNoise = noise;
      prevDiff = diff;
      const strike = highNoise * Math.exp(-t / p.strikeDecay) * p.strikeMix * resetScale;
      const ring = p.ringMix * (
        Math.sin(2 * Math.PI * p.f1 * t + phase[0]) * Math.exp(-t / (p.d1 * decayScale)) * 0.24 +
        Math.sin(2 * Math.PI * p.f2 * t + phase[1]) * Math.exp(-t / (p.d2 * decayScale)) * 0.34 +
        Math.sin(2 * Math.PI * p.f3 * t + phase[2]) * Math.exp(-t / (p.d3 * decayScale)) * 0.25 +
        Math.sin(2 * Math.PI * p.f4 * t + phase[3]) * Math.exp(-t / (p.d4 * decayScale)) * 0.13
      );
      data[i] = (strike + ring) * Math.min(1, t / 0.00009);
    }

    let mean = 0;
    for (let i = 0; i < n; i++) mean += data[i];
    mean /= n;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      data[i] -= mean;
      peak = Math.max(peak, Math.abs(data[i]));
    }
    if (peak > 0) {
      const scale = 0.82 / peak;
      for (let i = 0; i < n; i++) data[i] *= scale;
    }
    presentationBufferCache.set(key, buffer);
    return buffer;
  }

  function playPresentationClick(row, bit, engaging) {
    lastPresentationClick = {row, bit, engaging:!!engaging};
    if (typeof tickSound === 'boolean' && !tickSound) return;
    const p = profileFor(row, bit);
    if (!p || typeof ensureAudio !== 'function') return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const play = () => {
      const start = ctx.currentTime + 0.00005;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const level = typeof tickLevel === 'number' ? tickLevel : 1;
      const setReset = engaging ? 1.035 : 0.915;
      source.buffer = presentationBuffer(ctx, row, bit, engaging, p);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.43 * level * 0.66 * p.level * setReset, start + 0.00008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (engaging ? 0.0062 : 0.0055));
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(start);
      source.stop(start + 0.0115);
      // Deliberately no contact-bounce sources in stretched presentation mode.
    };

    if (ctx.state === 'running') play();
    else ctx.resume().then(play).catch(() => {});
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
      if (state.pendingClicks && state.pendingClicks.length) {
        const pending = state.pendingClicks.splice(0);
        for (const motion of pending) playPresentationClick(row, motion.bit, motion.on);
      }
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
        scheduled,
        pendingClicks: []
      };

      renderWord(row, state.contactWord);
      requestFrameLoop();

      scheduled.forEach((motion, index) => {
        setTimeout(() => {
          const live = presentation[row];
          if (!live || !live.active || live.token !== token || generation[row] !== token || timingMode !== MODE_STRETCHED) return;
          if (motion.on) live.contactWord |= motion.mask;
          else live.contactWord &= ~motion.mask;
          live.pendingClicks.push(motion);
          // The next animation frame both paints this contact state and emits
          // its click, keeping eye and ear tied to the same relay transition.
          requestFrameLoop();
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
      ? 'Frame-synchronized per-relay stretched visuals and clicks; AGC timing remains authentic'
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
    stretchedAudioFrameLocked: true,
    stretchedBounceAudio: false,
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
    lastPresentationClick: () => lastPresentationClick ? {...lastPresentationClick} : null,
    renderWord
  });
})();
