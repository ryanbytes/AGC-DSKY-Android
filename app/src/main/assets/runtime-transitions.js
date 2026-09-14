(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api || api.runtimeTransitions) return;

  const MODES = Object.freeze({
    CLOCK:'clock',
    AGC_LOADING:'agc-loading',
    AGC:'agc'
  });
  const LOAD_POLL_MS = 10;
  const MAX_LOAD_POLLS = 2000;

  let transitionPromise = null;
  let transitionSerial = 0;
  let lastTransition = null;

  function status() {
    if (typeof api.appStatus !== 'function') throw new Error('AGC runtime status API unavailable');
    const value = api.appStatus();
    if (!value || typeof value.mode !== 'string') throw new Error('AGC runtime returned invalid mode state');
    return value;
  }

  async function waitForAgcReady() {
    for (let poll = 0; poll < MAX_LOAD_POLLS; poll++) {
      const current = status();
      if (current.mode === MODES.AGC) return current;
      if (current.mode !== MODES.AGC_LOADING) {
        throw new Error(`AGC transition ended in ${current.mode || 'unknown'} mode`);
      }
      await new Promise(resolve => setTimeout(resolve, LOAD_POLL_MS));
    }
    throw new Error('AGC transition timed out while loading');
  }

  function requestAgc(reason = 'runtime request') {
    const current = status();
    if (current.mode === MODES.AGC) return Promise.resolve(current);
    if (transitionPromise) return transitionPromise;

    const serial = ++transitionSerial;
    const from = current.mode;
    transitionPromise = (async () => {
      if (typeof api.enterAgc !== 'function') throw new Error('AGC mode API unavailable');
      await api.enterAgc();
      let next = status();
      // app.js currently returns early if enterAgc() is called while another
      // caller already owns agc-loading. Until app.js itself exposes its in-flight
      // Promise, retain one bounded wait here rather than duplicating polls in
      // every input layer.
      if (next.mode === MODES.AGC_LOADING) next = await waitForAgcReady();
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

  const runtime = Object.freeze({
    modes:MODES,
    requestAgc,
    snapshot:() => ({
      mode:status().mode,
      transitionInFlight:!!transitionPromise,
      lastTransition:lastTransition ? {...lastTransition} : null
    })
  });

  window.AGCDSKY_RUNTIME = runtime;
  api.runtimeTransitions = runtime;
})();
