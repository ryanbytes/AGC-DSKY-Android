(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api || api.runtimeTransitions) return;

  const baseEnterAgc = api.enterAgc;
  const baseEnterClock = window.enterClock;
  const baseApiEnterClock = api.enterClock;
  if (typeof baseEnterAgc !== 'function'
      || typeof baseEnterClock !== 'function'
      || typeof baseApiEnterClock !== 'function') return;

  const MODES = Object.freeze({
    CLOCK:'clock',
    AGC_LOADING:'agc-loading',
    AGC:'agc'
  });

  let transitionPromise = null;
  let transitionSerial = 0;
  let lastTransition = null;
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
    // Keyboard/fallback callers require a ready AGC because they must inject a
    // key immediately after this awaits. Give them a checked derived Promise
    // without changing the underlying app-entry Promise's failure semantics.
    return beginAgc(reason).then(next => {
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

  function sharedEnterClock(...args) {
    const from = mode();
    runBeforeClock('app enterClock', from);
    const result = baseEnterClock.apply(this, args);
    const next = status();
    lastClockTransition = Object.freeze({
      serial:++clockTransitionSerial,
      from,
      to:next.mode,
      reason:'app enterClock'
    });
    return result;
  }

  // AGCDSKY.enterClock() in app.js is intentionally a no-argument convenience
  // wrapper that requests preserveAgc=true. Keep that wrapper intact and let it
  // resolve the replaced classic-script global enterClock binding, so cleanup
  // hooks run exactly once without changing the public API's historical default.
  function sharedApiEnterClock(...args) {
    return baseApiEnterClock.apply(this, args);
  }

  const runtime = Object.freeze({
    modes:MODES,
    mode,
    core,
    requestAgc,
    onBeforeClock,
    snapshot:() => ({
      mode:mode(),
      transitionInFlight:!!transitionPromise,
      lastTransition:lastTransition ? {...lastTransition} : null,
      lastClockTransition:lastClockTransition ? {...lastClockTransition} : null,
      beforeClockHooks:beforeClockHooks.size
    })
  });

  // app.js is a classic script, so its global transition identifiers resolve
  // through window at call time. Replace AGC entry directly. For CLOCK entry,
  // replace the global binding and keep the exported convenience wrapper above
  // so its preserveAgc=true behavior is unchanged.
  window.enterAgc = sharedEnterAgc;
  api.enterAgc = sharedEnterAgc;
  window.enterClock = sharedEnterClock;
  api.enterClock = sharedApiEnterClock;
  window.AGCDSKY_RUNTIME = runtime;
  api.runtimeTransitions = runtime;
})();
