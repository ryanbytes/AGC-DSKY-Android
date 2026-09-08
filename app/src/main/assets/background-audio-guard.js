'use strict';

// Relay audio is only valid while the interactive DSKY activity is visible.
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !dream && typeof stopClockQueue === 'function') {
      stopClockQueue();
    }
  });
})();
