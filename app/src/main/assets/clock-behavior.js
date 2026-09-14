(() => {
  'use strict';

  const api = window.AGCDSKY;
  const transitions = api?.runtimeTransitions;
  const AGC_KEY = window.AGCDSKY_KEY_CODES;
  if (!api || !transitions || typeof transitions.requestAgc !== 'function' || !AGC_KEY) return;

  // This layer owns only the document-level CLOCK keypad fallback. The live
  // CM electrical interlock normally captures physical normal keys earlier at
  // window capture and uses the same shared runtime transition service/key map.
  const pendingKeys = [];
  let promotionPromise = null;

  function status() {
    if (typeof api.appStatus !== 'function') throw new Error('AGC runtime status API unavailable');
    const value = api.appStatus();
    if (!value || typeof value.mode !== 'string') throw new Error('AGC runtime returned invalid mode state');
    return value;
  }

  async function drainClockInput() {
    try {
      await transitions.requestAgc('clock keypad fallback');
      const core = api.getCore && api.getCore();
      const current = status();
      if (!core || current.mode !== transitions.modes.AGC) {
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
    if (current.mode !== transitions.modes.CLOCK && current.mode !== transitions.modes.AGC_LOADING) return;

    // Before the CM electrical interlock is dynamically installed, this keeps
    // app.js's synthetic clock editor from consuming a normal DSKY contact.
    event.preventDefault();
    event.stopPropagation();
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 90);
    void promoteClockInput(key.dataset.key);
  }, {capture:true, passive:false});

  const clockBehavior = Object.freeze({
    promoteClockInput,
    isPromoting:() => !!promotionPromise,
    pendingCount:() => pendingKeys.length,
    snapshot:() => ({
      mode:status().mode,
      promotionInFlight:!!promotionPromise,
      pendingKeys:pendingKeys.slice()
    })
  });
  window.AGCDSKY_CLOCK_BEHAVIOR = clockBehavior;
  api.clockBehavior = clockBehavior;
})();
