(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api || api.runtimeTransitions) return;
  const lifecycle = api.lifecycle;
  if (!lifecycle
      || typeof lifecycle.enterAgc !== 'function'
      || typeof lifecycle.enterClock !== 'function') {
    throw new Error('AGC lifecycle service unavailable');
  }

  // The transition coordinator owns serialization; lifecycle owns the actual
  // core/mode mutation. Public AGCDSKY methods dynamically delegate here after
  // publication and retain stable function identity.
  const baseEnterAgc = lifecycle.enterAgc;
  const baseEnterClock = lifecycle.enterClock;

  const MODES = Object.freeze({
    CLOCK:'clock',
    AGC_LOADING:'agc-loading',
    AGC:'agc'
  });

  let transitionPromise = null;
  let transitionSerial = 0;
  let lastTransition = null;
  let deferredClockPromise = null;
  let clockRequestPending = false;
  let clockTransitionSerial = 0;
  let lastClockTransition = null;
  const beforeClockHooks = new Set();

  function status() {
    if (typeof api.appStatus !== 'function') throw new Error('AGC runtime status API unavailable');
    const value = api.appStatus();
    if (!value || typeof value.mode !== 'string') throw new Error('AGC runtime returned invalid mode state');
    return value;
  }

  function mode() {
    return status().mode;
  }

  function core() {
    if (typeof api.getCore !== 'function') throw new Error('AGC runtime core API unavailable');
    return api.getCore();
  }

  function clockRequested() {
    return clockRequestPending;
  }

  function beginAgc(reason = 'runtime request') {
    const current = status();
    if (current.mode === MODES.AGC) return Promise.resolve(current);
    if (transitionPromise) return transitionPromise;

    // All production AGC entry surfaces resolve through this coordinator before
    // the event loop can deliver user input. A loading state without the owned
    // Promise therefore signals a broken transition invariant; do not create a
    // second independent polling/loader path.
    if (current.mode === MODES.AGC_LOADING) {
      return Promise.reject(new Error('AGC loading state has no shared transition owner'));
    }

    const serial = ++transitionSerial;
    const from = current.mode;
    transitionPromise = (async () => {
      await baseEnterAgc();
      const next = status();
      // The lifecycle layer catches its own load/runtime failure and may return
      // to CLOCK. Preserve that contract for normal app/public entry callers.
      lastTransition = Object.freeze({
        serial,
        from,
        to:next.mode,
        reason,
        ready:next.mode === MODES.AGC
      });
      return next;
    })().finally(() => {
      transitionPromise = null;
    });
    return transitionPromise;
  }

  // Public/app entry preserves lifecycle failure semantics. Physical input
  // callers use requestAgc() below because they require a definitely-ready core
  // immediately after awaiting the transition.
  function enterAgc(reason = 'runtime enterAgc') {
    return beginAgc(reason);
  }

  function sharedEnterAgc() {
    return beginAgc('global enterAgc');
  }

  function requestAgc(reason = 'runtime request') {
    if (clockRequestPending) {
      return Promise.reject(new Error('AGC transition rejected because CLOCK is pending'));
    }
    return beginAgc(reason).then(next => {
      if (clockRequestPending) {
        throw new Error('AGC transition completed after CLOCK was requested');
      }
      if (next.mode !== MODES.AGC) {
        throw new Error(`AGC transition ended in ${next.mode || 'unknown'} mode`);
      }
      return next;
    });
  }

  function onBeforeClock(handler) {
    if (typeof handler !== 'function') throw new TypeError('CLOCK transition hook must be a function');
    beforeClockHooks.add(handler);
    return () => beforeClockHooks.delete(handler);
  }

  function runBeforeClock(reason, from) {
    for (const handler of Array.from(beforeClockHooks)) {
      try { handler(Object.freeze({reason, from})); }
      catch (error) { console.error('CLOCK transition cleanup failed', error); }
    }
  }

  function finishClock(args, requestedFrom, deferred, reason) {
    const executedFrom = mode();
    const result = baseEnterClock(...args);
    const next = status();
    lastClockTransition = Object.freeze({
      serial:++clockTransitionSerial,
      from:requestedFrom,
      executedFrom,
      to:next.mode,
      reason,
      deferred:!!deferred
    });
    return result;
  }

  function coordinateClock(args, reason = 'runtime enterClock') {
    if (deferredClockPromise) return deferredClockPromise;

    const from = mode();
    clockRequestPending = true;
    runBeforeClock(reason, from);

    if (transitionPromise) {
      const activeTransition = transitionPromise;
      deferredClockPromise = activeTransition
        .catch(() => null)
        .then(() => finishClock(args, from, true, reason))
        .finally(() => {
          deferredClockPromise = null;
          clockRequestPending = false;
        });
      return deferredClockPromise;
    }

    try {
      return finishClock(args, from, false, reason);
    } finally {
      clockRequestPending = false;
    }
  }

  function enterClock(statusLabel, preserveAgc = false, reason = 'runtime enterClock') {
    return coordinateClock([statusLabel, preserveAgc], reason);
  }

  function sharedEnterClock(...args) {
    return coordinateClock(args, 'global enterClock');
  }

  const runtime = Object.freeze({
    modes:MODES,
    mode,
    core,
    clockRequested,
    enterAgc,
    enterClock,
    requestAgc,
    onBeforeClock,
    snapshot:() => ({
      mode:mode(),
      transitionInFlight:!!transitionPromise,
      clockTransitionInFlight:!!deferredClockPromise,
      clockRequested:clockRequestPending,
      lastTransition:lastTransition ? {...lastTransition} : null,
      lastClockTransition:lastClockTransition ? {...lastClockTransition} : null,
      beforeClockHooks:beforeClockHooks.size,
      lifecycleService:true,
      publicApiDelegates:true
    })
  });

  // Temporary compatibility shims for any remaining classic-script callers.
  // Normal application paths use AGCDSKY/AGCDSKY_LIFECYCLE explicitly.
  window.enterAgc = sharedEnterAgc;
  window.enterClock = sharedEnterClock;
  window.AGCDSKY_RUNTIME = runtime;
  api.runtimeTransitions = runtime;
})();
