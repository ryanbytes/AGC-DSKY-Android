(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api || api.runtimeTransitions) return;

  const baseEnterAgc = api.enterAgc;
  if (typeof baseEnterAgc !== 'function') return;

  const MODES = Object.freeze({
    CLOCK:'clock',
    AGC_LOADING:'agc-loading',
    AGC:'agc'
  });

  let transitionPromise = null;
  let transitionSerial = 0;
  let lastTransition = null;

  function status() {
    if (typeof api.appStatus !== 'function') throw new Error('AGC runtime status API unavailable');
    const value = api.appStatus();
    if (!value || typeof value.mode !== 'string') throw new Error('AGC runtime returned invalid mode state');
    return value;
  }

  function beginAgc(reason = 'runtime request') {
    const current = status();
    if (current.mode === MODES.AGC) return Promise.resolve(current);
    if (transitionPromise) return transitionPromise;

    // runtime-transitions.js loads immediately after app.js, before the event
    // loop can run app.js's startup timeout and before the user can press the
    // AGC control.  All normal entry points are replaced below, so seeing a
    // loading state without our Promise is an invariant violation, not a state
    // to paper over with another independent polling loop.
    if (current.mode === MODES.AGC_LOADING) {
      return Promise.reject(new Error('AGC loading state has no shared transition owner'));
    }

    const serial = ++transitionSerial;
    const from = current.mode;
    transitionPromise = (async () => {
      await baseEnterAgc();
      const next = status();
      if (next.mode !== MODES.AGC) {
        throw new Error(`AGC transition ended in ${next.mode || 'unknown'} mode`);
      }
      lastTransition = Object.freeze({serial, from, to:next.mode, reason});
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
    return beginAgc(reason);
  }

  const runtime = Object.freeze({
    modes:MODES,
    requestAgc,
    snapshot:() => ({
      mode:status().mode,
      transitionInFlight:!!transitionPromise,
      lastTransition:lastTransition ? {...lastTransition} : null
    })
  });

  // app.js is a classic script, so its global `enterAgc` identifier resolves
  // through the window global binding at call time. Replacing both references
  // therefore covers the already-installed AGC button/startup closures as well
  // as later callers through AGCDSKY, without changing the underlying loader.
  window.enterAgc = sharedEnterAgc;
  api.enterAgc = sharedEnterAgc;
  window.AGCDSKY_RUNTIME = runtime;
  api.runtimeTransitions = runtime;
})();
