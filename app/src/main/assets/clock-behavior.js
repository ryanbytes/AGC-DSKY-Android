(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api) return;

  // This layer coordinates mode promotion caused by DSKY keypad input. It does
  // not own AGC execution or display state; app.js remains the state authority.
  // Keeping promotion here gives every clock-key handoff one serialized path,
  // including the case where another caller has already started AGC loading.
  const MODES = Object.freeze({
    CLOCK:'clock',
    AGC_LOADING:'agc-loading',
    AGC:'agc'
  });
  const AGC_KEY = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
  const LOAD_POLL_MS = 10;
  const MAX_LOAD_POLLS = 2000;

  const pendingKeys = [];
  let transitionPromise = null;
  let promotionPromise = null;
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

  async function drainClockInput() {
    try {
      await requestAgc('clock keypad handoff');
      const core = api.getCore && api.getCore();
      const current = status();
      if (!core || current.mode !== MODES.AGC) {
        throw new Error('AGC core unavailable after clock keypad handoff');
      }
      while (pendingKeys.length) {
        const next = pendingKeys.shift();
        const code = AGC_KEY[next];
        if (code !== undefined) core.keyPress(code);
      }
      if (typeof api.scheduleAgcAutosave === 'function') {
        api.scheduleAgcAutosave('clock keypad handoff');
      }
    } catch (error) {
      pendingKeys.length = 0;
      console.error('Clock-to-AGC keypad handoff', error);
    } finally {
      promotionPromise = null;
    }
  }

  function promoteClockInput(key) {
    pendingKeys.push(key);
    if (!promotionPromise) promotionPromise = drainClockInput();
    return promotionPromise;
  }

  document.addEventListener('pointerdown', event => {
    const key = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!key) return;
    let current;
    try { current = status(); } catch (_) { return; }
    if (current.mode !== MODES.CLOCK && current.mode !== MODES.AGC_LOADING) return;

    // Stop app.js's local clock-entry handler from consuming the key. Other
    // capture listeners on document still receive the completed user gesture.
    event.preventDefault();
    event.stopPropagation();
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 90);
    void promoteClockInput(key.dataset.key);
  }, {capture:true, passive:false});

  const runtime = Object.freeze({
    modes:MODES,
    requestAgc,
    promoteClockInput,
    snapshot:() => ({
      mode:status().mode,
      transitionInFlight:!!transitionPromise,
      promotionInFlight:!!promotionPromise,
      pendingKeys:pendingKeys.slice(),
      lastTransition:lastTransition ? {...lastTransition} : null
    })
  });
  window.AGCDSKY_RUNTIME = runtime;
  api.runtimeTransitions = runtime;
})();
