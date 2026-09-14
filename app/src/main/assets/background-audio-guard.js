'use strict';

// Late lifecycle guards. This file loads after the hardware and relay-identity
// layers, so it is also the right place to prevent stale relay/UI state from
// repainting the visible DSKY after those layers have initialized.
(() => {
  const audibleNow = () => !dream && !document.hidden && appVisible;

  // Chromium reports a WebAudio renderer/device failure by dispatching an
  // AudioContext "error" event and suspending the failed context. A suspended
  // failed context is not a useful object to keep retrying forever, so retire it
  // and allow one fresh context. If that replacement also fails before it has
  // been stable for a while, open a circuit breaker until the user turns relay
  // clicks off and back on.
  const AUDIO_STABLE_MS = 8000;
  const AUDIO_FAILURE_LIMIT = 2;
  let audioFailureCount = 0;
  let audioCircuitOpen = false;
  let audioFailureReported = false;
  let audioStableTimer = 0;
  const observedAudioContexts = new WeakSet();
  const retiredAudioContexts = new WeakSet();

  function audioErrorText(error) {
    if (!error) return 'unknown error';
    if (typeof error === 'string') return error;
    const name = error.name ? String(error.name) : '';
    const message = error.message ? String(error.message) : String(error);
    return name && message && !message.startsWith(name) ? `${name}: ${message}` : (message || name || 'unknown error');
  }

  function reportAudioFailure(reason, error) {
    if (audioFailureReported) return;
    audioFailureReported = true;
    const detail = `WebAudio recovery failed after ${audioFailureCount} consecutive failures: ${reason}; ${audioErrorText(error)}`;
    try {
      if (window.DebugBridge && typeof window.DebugBridge.report === 'function') {
        window.DebugBridge.report(detail);
      }
    } catch (_) {}
  }

  function updateAudioButtonForFailure() {
    try {
      const button = document.getElementById('sound');
      if (button) button.textContent = 'RELAY CLICKS ERROR · OFF/ON TO RETRY';
    } catch (_) {}
  }

  function clearStableTimer() {
    if (!audioStableTimer) return;
    clearTimeout(audioStableTimer);
    audioStableTimer = 0;
  }

  function markAudioStable(ctx) {
    if (!ctx || ctx !== audioCtx || ctx.state !== 'running' || audioFailureCount === 0 || audioStableTimer) return;
    audioStableTimer = setTimeout(() => {
      audioStableTimer = 0;
      if (ctx === audioCtx && ctx.state === 'running') {
        audioFailureCount = 0;
        audioCircuitOpen = false;
        audioFailureReported = false;
      }
    }, AUDIO_STABLE_MS);
  }

  function retireAudioContext(ctx, reason, error, countFailure = true) {
    if (!ctx || retiredAudioContexts.has(ctx)) return;
    retiredAudioContexts.add(ctx);
    if (ctx === audioCtx) audioCtx = null;
    clearStableTimer();

    if (countFailure) {
      audioFailureCount += 1;
      if (audioFailureCount >= AUDIO_FAILURE_LIMIT) {
        audioCircuitOpen = true;
        updateAudioButtonForFailure();
        reportAudioFailure(reason, error);
      }
    }

    try {
      if (ctx.state !== 'closed' && typeof ctx.close === 'function') {
        const closing = ctx.close();
        if (closing && typeof closing.catch === 'function') closing.catch(() => {});
      }
    } catch (_) {}
  }

  function adoptAudioContext(ctx) {
    if (!ctx || observedAudioContexts.has(ctx)) return ctx;
    observedAudioContexts.add(ctx);
    if (typeof ctx.addEventListener === 'function') {
      ctx.addEventListener('error', event => {
        retireAudioContext(ctx, 'renderer/device error event', event && event.error);
      });
      ctx.addEventListener('statechange', () => {
        if (ctx === audioCtx && ctx.state === 'running') markAudioStable(ctx);
      });
    }
    if (ctx.state === 'running') markAudioStable(ctx);
    return ctx;
  }

  function resetAudioCircuit() {
    audioFailureCount = 0;
    audioCircuitOpen = false;
    audioFailureReported = false;
    clearStableTimer();
  }

  const previousEnsureAudio = typeof ensureAudio === 'function' ? ensureAudio : null;
  if (previousEnsureAudio) {
    // Adopt a context that might already have been created before this late
    // guard loaded, then replace ensureAudio with a failure-aware constructor.
    try { if (audioCtx) adoptAudioContext(audioCtx); } catch (_) {}

    ensureAudio = function resilientEnsureAudio() {
      if (!audibleNow() || !tickSound || audioCircuitOpen) return null;

      if (audioCtx && audioCtx.state === 'closed') {
        retireAudioContext(audioCtx, 'context already closed', null, false);
      }

      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (typeof AC !== 'function') return null;
        try {
          audioCtx = adoptAudioContext(new AC());
        } catch (error) {
          audioFailureCount += 1;
          if (audioFailureCount >= AUDIO_FAILURE_LIMIT) {
            audioCircuitOpen = true;
            updateAudioButtonForFailure();
            reportAudioFailure('context construction failed', error);
          }
          return null;
        }
      } else {
        adoptAudioContext(audioCtx);
      }

      const ctx = audioCtx;
      if (!ctx) return null;
      if (ctx.state === 'running') {
        markAudioStable(ctx);
        return ctx;
      }
      if (ctx.state === 'closed') {
        retireAudioContext(ctx, 'context closed during acquisition', null, false);
        return null;
      }
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try {
          const resumed = ctx.resume();
          if (resumed && typeof resumed.then === 'function') {
            resumed.then(() => markAudioStable(ctx)).catch(error => {
              // Autoplay/user-gesture policy is not a broken audio renderer.
              // Leave that suspended context available for a later user gesture.
              if (error && error.name === 'NotAllowedError') return;
              retireAudioContext(ctx, 'resume rejected', error);
            });
          }
        } catch (error) {
          if (!error || error.name !== 'NotAllowedError') {
            retireAudioContext(ctx, 'resume threw', error);
            return null;
          }
        }
      }
      return ctx;
    };
  }

  // The sound button is the explicit manual reset for the circuit breaker.
  // app.js flips tickSound before calling applyTickSound(), so an ON transition
  // is the right point to permit another context after repeated failures.
  if (typeof applyTickSound === 'function') {
    const baseApplyTickSound = applyTickSound;
    applyTickSound = function resilientApplyTickSound() {
      if (tickSound && audioCircuitOpen) resetAudioCircuit();
      return baseApplyTickSound();
    };
  }

  if (window.AGCDSKY && typeof window.AGCDSKY === 'object') {
    window.AGCDSKY.audioStatus = () => ({
      state: audioCtx ? audioCtx.state : 'none',
      failures: audioFailureCount,
      circuitOpen: audioCircuitOpen
    });
  }

  if (typeof emitTick === 'function') {
    const audibleEmitTick = emitTick;
    emitTick = function guardedRelayTick(ctx, when, strength) {
      if (!audibleNow() || !ctx || ctx !== audioCtx || ctx.state === 'closed') return;
      return audibleEmitTick(ctx, when, strength);
    };
  }

  if (typeof playRelayBurst === 'function') {
    const audiblePlayRelayBurst = playRelayBurst;
    playRelayBurst = function guardedRelayBurst(count) {
      if (!audibleNow() || audioCircuitOpen) return;
      return audiblePlayRelayBurst(count);
    };
  }

  /*
   * PHONE CLOCK uses clockDigits as its visual source of truth. The physical
   * relay layer still updates agcDisplay at the 20-ms settle boundary because
   * the same bank model is shared with real AGC operation. Without this guard,
   * that update can briefly repaint a lower register from stale/partially
   * unrelated agcDisplay contents immediately before the clockDigits callback
   * repaints it again. During normal clock operation, route any such register
   * render back to clockDigits. Synthetic V35 is exempt because it deliberately
   * displays the relay-test state while lampTestActive is true.
   */
  if (typeof renderAgcReg === 'function' && typeof renderClockReg === 'function') {
    const settledAgcRender = renderAgcReg;
    renderAgcReg = function sourceConsistentRegisterRender(name) {
      if (typeof mode !== 'undefined' && mode === 'clock' &&
          !(typeof lampTestActive !== 'undefined' && lampTestActive)) {
        return renderClockReg(name);
      }
      return settledAgcRender(name);
    };
  }

  /*
   * A saved AGC snapshot contains both the physical relay words and a cached UI
   * projection. The relay words are authoritative; restoring the cached display
   * independently can resurrect a transient/inconsistent character state. Build
   * agcDisplay from the saved relay banks instead and reject malformed snapshots
   * rather than trusting duplicate visual state.
   */
  function snapshotWord(words, row) {
    if (!Object.prototype.hasOwnProperty.call(words, row) &&
        !Object.prototype.hasOwnProperty.call(words, String(row))) return 0;
    const raw = Object.prototype.hasOwnProperty.call(words, row) ? words[row] : words[String(row)];
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`snapshot relay row ${row} is invalid`);
    return value & 0o3777;
  }

  function clearSnapshotDisplayProjection() {
    agcDisplay.prog.fill(' ');
    agcDisplay.verb.fill(' ');
    agcDisplay.noun.fill(' ');
    for (const name of ['r1','r2','r3']) {
      agcDisplay[name].digits.fill(' ');
      agcDisplay[name].plus = false;
      agcDisplay[name].minus = false;
    }
  }

  function rebuildSnapshotDisplayFromRelays(words) {
    clearSnapshotDisplayProjection();

    let w = snapshotWord(words, 11);
    agcDisplay.prog[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.prog[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 10);
    agcDisplay.verb[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.verb[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 9);
    agcDisplay.noun[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.noun[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 8);
    agcDisplay.r1.digits[0] = relayDigit(w & 0o37);

    w = snapshotWord(words, 7);
    agcDisplay.r1.plus = !!((w >> 10) & 1);
    agcDisplay.r1.digits[1] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r1.digits[2] = relayDigit(w & 0o37);

    w = snapshotWord(words, 6);
    agcDisplay.r1.minus = !!((w >> 10) & 1);
    agcDisplay.r1.digits[3] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r1.digits[4] = relayDigit(w & 0o37);

    w = snapshotWord(words, 5);
    agcDisplay.r2.plus = !!((w >> 10) & 1);
    agcDisplay.r2.digits[0] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r2.digits[1] = relayDigit(w & 0o37);

    w = snapshotWord(words, 4);
    agcDisplay.r2.minus = !!((w >> 10) & 1);
    agcDisplay.r2.digits[2] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r2.digits[3] = relayDigit(w & 0o37);

    w = snapshotWord(words, 3);
    agcDisplay.r2.digits[4] = relayDigit(w & 0o37);
    agcDisplay.r3.digits[0] = relayDigit(w & 0o37);

    w = snapshotWord(words, 2);
    agcDisplay.r3.plus = !!((w >> 10) & 1);
    agcDisplay.r3.digits[1] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r3.digits[2] = relayDigit(w & 0o37);

    w = snapshotWord(words, 1);
    agcDisplay.r3.minus = !!((w >> 10) & 1);
    agcDisplay.r3.digits[3] = relayDigit((w >> 5) & 0o37);
    agcDisplay.r3.digits[4] = relayDigit(w & 0o37);
  }

  if (typeof applySnapshotUi === 'function') {
    applySnapshotUi = function relayAuthoritativeSnapshotUi(ui) {
      if (!ui || typeof ui !== 'object' || !ui.relayWords || typeof ui.relayWords !== 'object') {
        throw new Error('snapshot UI is missing authoritative relay words');
      }

      Object.keys(agcRelayWords).forEach(key => delete agcRelayWords[key]);
      for (let row = 1; row <= 12; row++) {
        if (Object.prototype.hasOwnProperty.call(ui.relayWords, row) ||
            Object.prototype.hasOwnProperty.call(ui.relayWords, String(row))) {
          agcRelayWords[row] = snapshotWord(ui.relayWords, row);
        }
      }

      rebuildSnapshotDisplayFromRelays(agcRelayWords);
      agcCh11 = Number(ui.ch11) & 0o77777;
      agcCh13 = Number(ui.ch13) & 0o77777;
      agcCh163 = Number(ui.ch163) & 0o77777;
      return true;
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !dream && typeof stopClockQueue === 'function') {
      stopClockQueue();
    }
  });
})();
