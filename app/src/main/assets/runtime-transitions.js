(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api || api.runtimeTransitions) return;

  const baseEnterAgc = api.enterAgc;
  if (typeof baseEnterAgc !== 'function') return;

  // CLOCK entry is present in production app.js, but keep the shared runtime
  // authority usable in isolated AGC-only harnesses as well. When both CLOCK
  // entry surfaces are present they are wrapped below without changing either
  // surface's existing calling convention.
  const baseEnterClock = typeof window.enterClock === 'function' ? window.enterClock : null;
  const baseApiEnterClock = typeof api.enterClock === 'function' ? api.enterClock : null;
  const clockEntryAvailable = !!(baseEnterClock && baseApiEnterClock);

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

    // runtime-transitions.js is loaded synchronously after app.js and the
    // required dream-silence guard, before the event loop can run app.js's
    // startup timeout and before the user can press the AGC control. All normal
    // entry points are replaced below, so seeing a loading state without our
    // Promise is an invariant violation, not a state to paper over with another
    // independent polling loop.
    if (current.mode === MODES.AGC_LOADING) {
      return Promise.reject(new Error('AGC loading state has no shared transition owner'));
    }

    const serial = ++transitionSerial;
    const from = current.mode;
    transitionPromise = (async () => {
      await baseEnterAgc();
      const next = status();
      // app.js historically catches its own load/runtime failure and returns to
      // clock mode. Preserve that behavior for the AGC button/startup caller:
      // the shared entry Promise resolves with the final state instead of
      // inventing a new unhandled rejection at this wrapper layer.
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

  function sharedEnterAgc() {
    return beginAgc('app enterAgc');
  }

  function requestAgc(reason = 'runtime request') {
    // Once CLOCK has been requested, no new input handoff may join an AGC load
    // that is only being allowed to finish so CLOCK can take ownership safely.
    if (clockRequestPending) {
      return Promise.reject(new Error('AGC transition rejected because CLOCK is pending'));
    }
    // Keyboard/fallback callers require a ready AGC because they must inject a
    // key immediately after this awaits. Give them a checked derived Promise
    // without changing the underlying app-entry Promise's failure semantics.
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

  function finishClock(thisArg, args, requestedFrom, deferred) {
    const executedFrom = mode();
    const result = baseEnterClock.apply(thisArg, args);
    const next = status();
    lastClockTransition = Object.freeze({
      serial:++clockTransitionSerial,
      from:requestedFrom,
      executedFrom,
      to:next.mode,
      reason:'app enterClock',
      deferred:!!deferred
    });
    return result;
  }

  function sharedEnterClock(...args) {
    if (!clockEntryAvailable) throw new Error('CLOCK runtime entry API unavailable');
    if (deferredClockPromise) return deferredClockPromise;

    const from = mode();
    // Mark CLOCK intent before cleanup so input layers can suppress any new
    // contact while an active AGC load is being allowed to finish.
    clockRequestPending = true;
    runBeforeClock('app enterClock', from);

    if (transitionPromise) {
      const activeTransition = transitionPromise;
      const thisArg = this;
      deferredClockPromise = activeTransition
        .catch(() => null)
        .then(() => finishClock(thisArg, args, from, true))
        .finally(() => {
          deferredClockPromise = null;
          clockRequestPending = false;
        });
      return deferredClockPromise;
    }

    try {
      return finishClock(this, args, from, false);
    } finally {
      clockRequestPending = false;
    }
  }

  // AGCDSKY.enterClock() in app.js is intentionally a no-argument convenience
  // wrapper that requests preserveAgc=true. Keep that wrapper intact and let it
  // resolve the replaced classic-script global enterClock binding, so cleanup
  // hooks run exactly once without changing the public API's historical default.
  function sharedApiEnterClock(...args) {
    if (!clockEntryAvailable) throw new Error('CLOCK runtime entry API unavailable');
    return baseApiEnterClock.apply(this, args);
  }

  const runtime = Object.freeze({
    modes:MODES,
    mode,
    core,
    clockRequested,
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
      clockEntryWrapped:clockEntryAvailable
    })
  });

  // app.js is a classic script, so its global transition identifiers resolve
  // through window at call time. AGC entry is always present. In production the
  // two CLOCK entry surfaces are also replaced; isolated AGC-only harnesses can
  // omit them and still exercise shared mode/core/input authority.
  window.enterAgc = sharedEnterAgc;
  api.enterAgc = sharedEnterAgc;
  if (clockEntryAvailable) {
    window.enterClock = sharedEnterClock;
    api.enterClock = sharedApiEnterClock;
  }
  window.AGCDSKY_RUNTIME = runtime;
  api.runtimeTransitions = runtime;
})();
