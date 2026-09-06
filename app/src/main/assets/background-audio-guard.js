'use strict';

// Relay audio is only valid while the interactive DSKY activity is actually
// visible. The Android DreamService intentionally reuses the same clock page,
// and a paused WebView can keep JavaScript timers alive long enough to produce
// stray relay clicks. Suppress every relay-audio path when the page is hidden
// or when it is running as the Android screensaver.
(() => {
  const audibleNow = () => !dream && !document.hidden && appVisible;

  if (typeof emitTick === 'function') {
    const audibleEmitTick = emitTick;
    emitTick = function guardedRelayTick(ctx, when, strength) {
      if (!audibleNow()) return;
      return audibleEmitTick(ctx, when, strength);
    };
  }

  if (typeof playRelayBurst === 'function') {
    const audiblePlayRelayBurst = playRelayBurst;
    playRelayBurst = function guardedRelayBurst(count) {
      if (!audibleNow()) return;
      return audiblePlayRelayBurst(count);
    };
  }

  // Kill queued clock relay work as soon as the interactive page is hidden.
  // Dream mode still updates its display, but remains silent by design.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !dream && typeof stopClockQueue === 'function') {
      stopClockQueue();
    }
  });
})();
